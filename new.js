const { json, cors } = require('./_common');
const { randomUUID } = require('crypto');
const { supaAdmin } = require('./_supabase');

module.exports = async (req, res) => {
  cors(res);
  if (req.method==='OPTIONS') return res.end();
  const url = new URL(req.url, 'http://x');

  const goodsName = url.searchParams.get('goodsName') || 'anomal item';
  const amount = parseInt(url.searchParams.get('amount') || '1000', 10);
  const method = (url.searchParams.get('method') || 'card').toLowerCase();

  const authUserId = url.searchParams.get('authUserId') || null;
  const email = url.searchParams.get('email') || null;

  const orderId = randomUUID();

  try {
    const supa = supaAdmin();

    // 고객 찾거나 생성
    let customerId = null;
    if (authUserId || email) {
      const { data: cust } = await supa
        .from('customers')
        .select('id')
        .or(`auth_user_id.eq.${authUserId||''},email.eq.${email||''}`)
        .limit(1)
        .maybeSingle();

      if (cust) {
        customerId = cust.id;
      } else if (email) {
        const ins = await supa.from('customers').insert({ auth_user_id: authUserId, email }).select().single();
        customerId = ins.data?.id || null;
      }
    }

    // 주문 저장
    await supa.from('orders').insert({
      order_id: orderId,
      total_amount: amount,
      method,
      status: 'created',
      customer_id: customerId
    });
  } catch (e) {
    // allow flow to continue
  }

  return json(res, 200, { orderId, goodsName, amount, method });
};
