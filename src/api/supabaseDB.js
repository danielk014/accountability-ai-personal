/**
 * supabaseDB — full replacement for localDB.js.
 *
 * Keeps the exact same API surface (base44.entities.*, base44.auth.*) so
 * every page/component works unchanged after swapping base44Client.js.
 *
 * Data is stored in two Supabase tables:
 *   user_entities  – all entity stores (Task, Sleep, UserProfile, etc.)
 *   user_kv        – used by supabaseStorage for chat/gym/reminders/financials
 */
import { supabase } from './supabaseClient'

// ─── Module-level user cache (set by AuthContext via _setUser / _clearUser) ──

let _currentUserId    = null
let _currentUserEmail = null

export function _setUser(id, email) {
  _currentUserId    = id
  _currentUserEmail = email
}

export function _clearUser() {
  _currentUserId    = null
  _currentUserEmail = null
}

// ─── ID generator (same as localDB) ──────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

// ─── Entity store factory ─────────────────────────────────────────────────────

function createEntityStore(entityType) {
  const listeners = new Set()

  return {
    async filter(criteria = {}, sort = null, limit = null) {
      if (!_currentUserId) return []

      const { data, error } = await supabase
        .from('user_entities')
        .select('id, data, created_at')
        .eq('user_id', _currentUserId)
        .eq('entity_type', entityType)

      if (error) { console.error('[supabaseDB] filter error:', entityType, error); return [] }

      let records = (data || []).map(r => ({ ...r.data, id: r.id, created_at: r.created_at }))

      // Apply criteria filter in JS (mirrors original behaviour)
      if (Object.keys(criteria).length > 0) {
        records = records.filter(record =>
          Object.entries(criteria).every(([k, v]) => record[k] === v)
        )
      }

      if (sort) {
        const desc  = sort.startsWith('-')
        const field = desc ? sort.slice(1) : sort
        records.sort((a, b) => {
          const av = String(a[field] ?? '')
          const bv = String(b[field] ?? '')
          return desc ? bv.localeCompare(av) : av.localeCompare(bv)
        })
      }

      if (limit) records = records.slice(0, limit)
      return records
    },

    async create(data) {
      if (!_currentUserId) throw new Error('Not authenticated')
      const id = generateId()
      const record = {
        ...data,
        id,
        created_at: new Date().toISOString(),
        created_by: _currentUserEmail,
      }

      const { error } = await supabase.from('user_entities').insert({
        id,
        user_id:     _currentUserId,
        entity_type: entityType,
        data:        record,
        created_at:  record.created_at,
      })

      if (error) throw new Error(error.message)
      listeners.forEach(cb => cb([record]))
      return record
    },

    async update(id, updateData) {
      const { data: existing, error: fetchErr } = await supabase
        .from('user_entities')
        .select('data')
        .eq('id', id)
        .single()

      if (fetchErr || !existing) throw new Error(`Record ${id} not found`)

      const updated = { ...existing.data, ...updateData }

      const { error } = await supabase
        .from('user_entities')
        .update({ data: updated })
        .eq('id', id)

      if (error) throw new Error(error.message)
      listeners.forEach(cb => cb([updated]))
      return updated
    },

    async delete(id) {
      const { error } = await supabase
        .from('user_entities')
        .delete()
        .eq('id', id)

      if (error) throw new Error(error.message)
      listeners.forEach(cb => cb([]))
    },

    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
}

// ─── Auth store ───────────────────────────────────────────────────────────────

const authStore = {
  async register(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email:   email.trim().toLowerCase(),
      password: password.trim(),
      options: { data: { name: name || email.split('@')[0] } },
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Registration failed — please try again.')
    return { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name }
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email:   email.trim().toLowerCase(),
      password: password.trim(),
    })
    if (error) throw new Error(
      error.message.toLowerCase().includes('invalid') ? 'Incorrect email or password.' : error.message
    )
    return {
      id:      data.user.id,
      email:   data.user.email,
      name:    data.user.user_metadata?.name,
      picture: data.user.user_metadata?.picture,
    }
  },

  me() {
    if (!_currentUserId || !_currentUserEmail) {
      return Promise.reject(new Error('Not authenticated'))
    }
    return Promise.resolve({
      id:        _currentUserId,
      email:     _currentUserEmail,
      full_name: _currentUserEmail.split('@')[0],
    })
  },

  logout() {
    return supabase.auth.signOut()
  },

  isAuthenticated() {
    return !!_currentUserId
  },
}

// ─── Cleanup (called by App.jsx + Progress.jsx) ───────────────────────────────

export async function runCleanup() {
  if (!_currentUserId) return

  const cutoff30 = new Date()
  cutoff30.setDate(cutoff30.getDate() - 30)
  const cutoffDate30 = cutoff30.toISOString().split('T')[0]
  const cutoffISO30  = cutoff30.toISOString()

  const cutoff90 = new Date()
  cutoff90.setDate(cutoff90.getDate() - 90)
  const cutoffDate90 = cutoff90.toISOString().split('T')[0]

  // TaskCompletion: drop records older than 30 days
  try {
    await supabase
      .from('user_entities')
      .delete()
      .eq('user_id', _currentUserId)
      .eq('entity_type', 'TaskCompletion')
      .filter('data->>completed_date', 'lt', cutoffDate30)
  } catch {}

  // TodoItem: drop completed items older than 30 days (filter in JS)
  try {
    const { data } = await supabase
      .from('user_entities')
      .select('id, data')
      .eq('user_id', _currentUserId)
      .eq('entity_type', 'TodoItem')

    if (data) {
      const toDelete = data
        .filter(r => {
          if (!r.data.is_done) return false
          const ts = r.data.completed_at || r.data.created_at
          return ts && ts < cutoffISO30
        })
        .map(r => r.id)

      if (toDelete.length > 0) {
        await supabase.from('user_entities').delete().in('id', toDelete)
      }
    }
  } catch {}

  // Sleep: drop entries older than 90 days
  try {
    await supabase
      .from('user_entities')
      .delete()
      .eq('user_id', _currentUserId)
      .eq('entity_type', 'Sleep')
      .filter('data->>date', 'lt', cutoffDate90)
  } catch {}
}

// ─── Exported DB (same shape as localDB) ─────────────────────────────────────

export const supabaseDB = {
  entities: {
    Task:                createEntityStore('Task'),
    TaskCompletion:      createEntityStore('TaskCompletion'),
    UserProfile:         createEntityStore('UserProfile'),
    TodoItem:            createEntityStore('TodoItem'),
    Sleep:               createEntityStore('Sleep'),
    Project:             createEntityStore('Project'),
    ProjectTask:         createEntityStore('ProjectTask'),
    HomeworkChapter:     createEntityStore('HomeworkChapter'),
    ChapterSummaryEntry: createEntityStore('ChapterSummaryEntry'),
    Flashcard:           createEntityStore('Flashcard'),
    LearningObjective:   createEntityStore('LearningObjective'),
  },
  auth: authStore,
}
