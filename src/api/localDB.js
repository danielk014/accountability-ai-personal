// Local localStorage-based entity store with per-user data isolation

// ─── Auth session helpers ────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('auth_session') || 'null');
  } catch { return null; }
}

function getCurrentUserId() {
  return getCurrentUser()?.id || 'anonymous';
}

function getCurrentUserEmail() {
  return getCurrentUser()?.email || 'unknown';
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function runCleanup() {
  const uid = getCurrentUserId();

  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoffDate30 = cutoff30.toISOString().split('T')[0];
  const cutoffISO30  = cutoff30.toISOString();

  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoffDate90 = cutoff90.toISOString().split('T')[0];

  // TaskCompletion — 30 days (extended from 7 to preserve streak history)
  try {
    const key = `user_${uid}_TaskCompletion`;
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(
      records.filter(r => (r.completed_date || '') >= cutoffDate30)
    ));
  } catch {}

  // Completed TodoItems — 30 days
  try {
    const key = `user_${uid}_TodoItem`;
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(
      records.filter(r => {
        if (!r.is_done) return true;
        const ts = r.completed_at || r.created_at;
        return !ts || ts >= cutoffISO30;
      })
    ));
  } catch {}

  // Sleep entries — 90 days (extended from 30 for better progress charts)
  try {
    const key = `user_${uid}_Sleep`;
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(
      records.filter(r => (r.date || '') >= cutoffDate90)
    ));
  } catch {}
}

// ─── Entity store factory ─────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function createEntityStore(name) {
  // Key is computed at call-time so it always reflects the logged-in user
  const storageKey = () => `user_${getCurrentUserId()}_${name}`;
  const listeners = new Set();

  function getAll() {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '[]'); }
    catch { return []; }
  }

  function saveAll(records) {
    localStorage.setItem(storageKey(), JSON.stringify(records));
    listeners.forEach(cb => cb(records));
  }

  return {
    filter(criteria = {}, sort = null, limit = null) {
      let records = getAll();
      records = records.filter(record =>
        Object.entries(criteria).every(([k, v]) => record[k] === v)
      );
      if (sort) {
        const desc  = sort.startsWith('-');
        const field = desc ? sort.slice(1) : sort;
        records.sort((a, b) => {
          const av = String(a[field] ?? '');
          const bv = String(b[field] ?? '');
          return desc ? bv.localeCompare(av) : av.localeCompare(bv);
        });
      }
      if (limit) records = records.slice(0, limit);
      return Promise.resolve(records);
    },

    create(data) {
      const records = getAll();
      const record = {
        ...data,
        id: generateId(),
        created_at: new Date().toISOString(),
        created_by: getCurrentUserEmail(),
      };
      records.push(record);
      saveAll(records);
      return Promise.resolve(record);
    },

    update(id, data) {
      const records = getAll();
      const idx = records.findIndex(r => r.id === id);
      if (idx === -1) return Promise.reject(new Error(`Record ${id} not found`));
      records[idx] = { ...records[idx], ...data };
      saveAll(records);
      return Promise.resolve(records[idx]);
    },

    delete(id) {
      saveAll(getAll().filter(r => r.id !== id));
      return Promise.resolve();
    },

    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

// ─── Auth store ───────────────────────────────────────────────────────────────

function hashFNV(password) {
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 'local_' + h.toString(16).padStart(8, '0');
}

async function hashPassword(password) {
  if (!window?.crypto?.subtle) {
    return hashFNV(password);
  }
  try {
    const data = new TextEncoder().encode(password);
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto.subtle failed — fall back to FNV-1a so login always works
    return hashFNV(password);
  }
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem('auth_users') || '[]'); }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem('auth_users', JSON.stringify(users));
}

const authStore = {
  async register(email, password, name) {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const hash = await hashPassword(trimmedPassword);
    const user = {
      id: generateId(),
      email: trimmedEmail.toLowerCase(),
      name: name || email.split('@')[0],
      password_hash: hash,
      created_at: new Date().toISOString(),
    };
    users.push(user);
    try {
      saveUsers(users);
    } catch (e) {
      throw new Error('Could not save your account. Your browser may have storage restrictions (e.g. private/incognito mode or full storage). Please try again in a regular browser window.');
    }
    // Verify the account was actually persisted
    const saved = getUsers();
    if (!saved.find(u => u.id === user.id)) {
      throw new Error('Account was not saved. Please ensure your browser allows localStorage and is not in private/incognito mode.');
    }
    const session = { id: user.id, email: user.email, name: user.name };
    try {
      localStorage.setItem('auth_session', JSON.stringify(session));
    } catch (e) {
      throw new Error('Could not save your session. Please check your browser storage settings.');
    }
    return session;
  },

  async login(email, password) {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const users = getUsers();
    const user  = users.find(u => u.email.toLowerCase() === trimmedEmail.toLowerCase());
    if (!user) throw new Error('No account found with this email.');
    // Match hash algorithm to what was used at registration time
    let hash;
    if (user.password_hash?.startsWith('local_')) {
      hash = hashFNV(trimmedPassword);
    } else {
      hash = await hashPassword(trimmedPassword);
    }
    if (hash !== user.password_hash) throw new Error('Incorrect password.');
    const session = { id: user.id, email: user.email, name: user.name, picture: user.picture };
    localStorage.setItem('auth_session', JSON.stringify(session));
    return session;
  },

  me() {
    const s = getCurrentUser();
    if (!s) return Promise.reject(new Error('Not authenticated'));
    return Promise.resolve({ id: s.id, email: s.email, full_name: s.name });
  },

  logout() {
    localStorage.removeItem('auth_session');
  },

  isAuthenticated() {
    return !!getCurrentUser();
  },
};

// ─── Exported DB ──────────────────────────────────────────────────────────────

export const localDB = {
  entities: {
    Task:                 createEntityStore('Task'),
    TaskCompletion:       createEntityStore('TaskCompletion'),
    UserProfile:          createEntityStore('UserProfile'),
    TodoItem:             createEntityStore('TodoItem'),
    Sleep:                createEntityStore('Sleep'),
    Project:              createEntityStore('Project'),
    ProjectTask:          createEntityStore('ProjectTask'),
    HomeworkChapter:      createEntityStore('HomeworkChapter'),
    ChapterSummaryEntry:  createEntityStore('ChapterSummaryEntry'),
    Flashcard:            createEntityStore('Flashcard'),
    LearningObjective:    createEntityStore('LearningObjective'),
  },
  auth: authStore,
};
