/**
 * supabaseStorage — drop-in replacement for localStorage that syncs to Supabase.
 *
 * Reads are synchronous (served from an in-memory cache).
 * Writes update the cache immediately, then push to Supabase in the background.
 *
 * Call hydrateStorage(userId) once after login to load all KV data from
 * Supabase into the cache. Call clearStorage() on logout.
 */
import { supabase } from './supabaseClient'

const _cache  = new Map()
let   _userId = null

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/** Load all KV rows for this user into the in-memory cache. */
export async function hydrateStorage(userId) {
  _userId = userId
  _cache.clear()
  try {
    const { data, error } = await supabase
      .from('user_kv')
      .select('key, value')
      .eq('user_id', userId)
    if (!error && data) {
      data.forEach(({ key, value }) => _cache.set(key, value))
    }
  } catch (err) {
    console.warn('[supabaseStorage] hydration failed:', err)
  }
}

/** Clear the cache on logout. */
export function clearStorage() {
  _cache.clear()
  _userId = null
}

// ─── Storage API (same shape as localStorage) ─────────────────────────────────

export const supabaseStorage = {
  getItem(key) {
    const val = _cache.get(key)
    return val !== undefined ? JSON.stringify(val) : null
  },

  setItem(key, rawValue) {
    let parsed
    try { parsed = JSON.parse(rawValue) } catch { parsed = rawValue }
    _cache.set(key, parsed)
    if (_userId) {
      supabase
        .from('user_kv')
        .upsert(
          { user_id: _userId, key, value: parsed, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,key' }
        )
        .then(({ error }) => {
          if (error) console.warn('[supabaseStorage] write failed:', key, error)
        })
    }
  },

  removeItem(key) {
    _cache.delete(key)
    if (_userId) {
      supabase
        .from('user_kv')
        .delete()
        .eq('user_id', _userId)
        .eq('key', key)
        .then(({ error }) => {
          if (error) console.warn('[supabaseStorage] delete failed:', key, error)
        })
    }
  },
}
