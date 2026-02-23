// Lightweight module-level store for the current user's storage prefix.
// Updated by AuthContext on login/logout so non-React modules (claudeClient, reminderEngine)
// can build user-scoped localStorage keys without needing React context.
//
// Initialised synchronously from auth_session so the prefix is correct even
// before the async auth.me() call in AuthContext resolves (avoids edge-cases
// where getUserPrefix() is called before the first React render completes).
function _prefixFromStorage() {
  try {
    const session = JSON.parse(localStorage.getItem('auth_session') || 'null');
    if (session?.email) {
      return session.email.toLowerCase().replace(/[^a-z0-9]/g, '_') + '__';
    }
  } catch {}
  return '';
}

let _prefix = _prefixFromStorage();

export function setCurrentUser(email) {
  _prefix = email
    ? email.toLowerCase().replace(/[^a-z0-9]/g, '_') + '__'
    : '';
}

export function clearCurrentUser() {
  _prefix = '';
}

// Returns e.g. "john_doe_gmail_com__" — prefix every localStorage key with this.
export function getUserPrefix() {
  return _prefix;
}
