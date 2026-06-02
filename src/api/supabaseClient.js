import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseMisconfigured = !supabaseUrl || !supabaseKey

if (supabaseMisconfigured) {
  console.error(
    '[supabaseClient] Missing environment variables.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file ' +
    'or your deployment platform\'s environment settings.'
  )
}

// Fallback prevents createClient from throwing when env vars aren't set yet
export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseKey  || 'placeholder-anon-key'
)
