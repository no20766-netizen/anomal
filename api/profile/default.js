/**
 * GET /api/profile/default?authUserId=...
 * Returns customer's stored profile (email/name/phone/address)
 */
const { json, cors } = require('../../_common');
let supaAdmin = null;
try { ({ supaAdmin } = require('../_supabase')); } catch {}
module.exports = async (req, res) => {
  cors(res); if (req.method==='OPTIONS') return res.end();
  const u = new URL(req.url, 'http://x');
  const authUserId = u.searchParams.get('authUserId') || null;
  if (!authUserId) return json(res, 400, { error: 'authUserId required' });

  // If no Supabase admin configured, return empty response gracefully
  if (!supaAdmin) return json(res, 200, { customer: null, address: null });

  const { data, error } = await supaAdmin
    .from('profiles')
    .select('email,name,phone,zipcode,addr1,addr2')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) return json(res, 500, { error: error.message });

  const customer = { email: data?.email || null };
  const address = data ? {
    recipient: data.name || '',
    phone: data.phone || '',
    zipcode: data.zipcode || '',
    addr1: data.addr1 || '',
    addr2: data.addr2 || ''
  } : null;

  return json(res, 200, { customer, address });
};
