import { createClient } from '@supabase/supabase-js'

// Reemplaza estos valores con los de tu proyecto Supabase:
// Supabase Dashboard > Project Settings > API
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://TU-PROYECTO.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'TU-ANON-KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
