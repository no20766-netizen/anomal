/**
 * POST /api/profile/save
 * Body: { authUserId, email, name, phone, zipcode, addr1, addr2 }
 * Upserts into 'profiles' table.
 */
const { json, cors } = require('../../_common');
let supaAdmin = null;
try { ({ supaAdmin } = require('../_supabase')); } catch {}
module.exports = async (req, res) => {
  cors(res); if (req.method==='OPTIONS') return res.end();
  if (req.method!=='POST') return json(res, 405, { error: 'POST only' });

  let body = '';
  await new Promise(resolve => { req.on('data', c=>body+=c); req.on('end', resolve); });
  try { body = JSON.parse(body||'{}'); } catch { body = {}; }

  const { authUserId, email, name, phone, zipcode, addr1, addr2 } = body;
  if (!authUserId) return json(res, 400, { error: 'authUserId required' });

  if (!supaAdmin) {
    // No DB configured: pretend save ok for dev/sandbox
    return json(res, 200, { ok: true, fallback: true });
  }

  const { error } = await supaAdmin
    .from('profiles')
    .upsert({
      auth_user_id: authUserId,
      email: email || null,
      name: name || null,
      phone: phone || null,
      zipcode: zipcode || null,
      addr1: addr1 || null,
      addr2: addr2 || null
    }, { onConflict: 'auth_user_id' });

  if (error) return json(res, 500, { error: error.message });
  return json(res, 200, { ok: true });
};
