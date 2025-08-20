
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { orderId, reason = '', amount = null, attachments = [] } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    // 사용자 인증 (클라에서 Supabase access_token을 Authorization Bearer로 전달)
    const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken);
    if (userErr || !userRes?.user) return res.status(401).json({ error: 'unauthorized' });
    const user = userRes.user;

    // 주문 확인
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_id, status, total_amount, paid_amount, paid_at, refunded_amount, tid')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) return res.status(404).json({ error: 'order not found' });

    if (order.customer_id !== user.id) return res.status(403).json({ error: 'forbidden' });

    // 결제 후 7일 제한
    const paidAt = order.paid_at ? new Date(order.paid_at) : null;
    if (!paidAt) return res.status(400).json({ error: 'order not paid' });
    if (Date.now() - paidAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'cancel allowed within 7 days of payment' });
    }

    if (['canceled','refunded'].includes(order.status)) {
      return res.status(400).json({ error: 'already finalized' });
    }

    const reqAmount = amount ?? (order.paid_amount - (order.refunded_amount || 0));

    const { data: reqRow, error: reqErr } = await supabase
      .from('cancel_requests')
      .insert({
        order_id: order.id,
        user_id: user.id,
        reason,
        status: 'requested',
        requested_amount: reqAmount
      })
      .select()
      .single();
    if (reqErr) throw reqErr;

    if (attachments?.length) {
      const rows = attachments.map(url => ({ request_id: reqRow.id, file_url: url }));
      await supabase.from('cancel_attachments').insert(rows);
    }

    return res.status(200).json({ ok: true, request_id: reqRow.id });
  } catch (e) {
    console.error('[cancel-request]', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
