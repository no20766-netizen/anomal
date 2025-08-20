const { json, cors, parseBody } = require('./_common');
const { supaAdmin } = require('./_supabase');

module.exports = async (req, res) => {
  cors(res);
  if (req.method==='OPTIONS') return res.end();
  if (req.method!=='POST') return json(res, 405, { error:'POST required' });

  const body = await parseBody(req);
  const supa = supaAdmin();
  try {
    // 로그 적재
    await supa.from('webhooks').insert({ event: (body.status||'').toLowerCase(), body });
    const orderId = body.orderId || body.moid || body.MOID || null;
    const status = (body.status||'').toLowerCase();
    if (orderId) {
      const patch = {};
      if (status==='paid') patch.status='paid', patch.paid_at=new Date().toISOString();
      if (status==='cancelled' || status==='canceled') patch.status='cancelled', patch.cancelled_at=new Date().toISOString();
      if (status==='expired') patch.status='expired';
      if (Object.keys(patch).length) await supa.from('orders').update(patch).eq('order_id', orderId);
    }
  } catch (_) {}

  return json(res, 200, { ok:true });
};
