// supabase server client (Node runtime) — tolerant require
let createClient = null;
try { ({ createClient } = require('@supabase/supabase-js')); } catch { /* optional in dev */ }
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || null;

let supaAdmin = null;
if (createClient && url && serviceKey) {
  supaAdmin = createClient(url, serviceKey, { auth: { persistSession: false } });
}

module.exports = { supaAdmin };