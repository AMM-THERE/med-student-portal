/* ============================================================
   js/supabase-db.js — Supabase Client Setup
   ============================================================ */
const SUPABASE_URL = 'https://afqtxwjxwedsmcijcqcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aOR78qzeFJIXW49k2sYIqA_ippDSULS';

if (window.supabase) {
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Supabase Client Initialized!');
} else {
  console.error('❌ Supabase SDK is missing from index.html');
}