// api/nicepay/webhook.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { Tid, ResultCode, ResultMsg, Amt, OrderId } = body;

    // 주문 찾기
    let { data: order } = await supabase.from('orders').select('*').eq('tid', Tid).single();
    if (!order && OrderId) {
      const r = await supabase.from('orders').select('*').eq('order_id', OrderId).single();
      order = r.data;
    }
    if (!order) {
      await supabase.from('payment_events').insert({ type:'webhook', payload: body, success:false, message:'order not found' });
      return res.status(200).json({ ok:true });
    }

    // 로깅
    await supabase.from('payment_events').insert({ order_id: order.id, type:'webhook', payload: body, success:true, message: ResultMsg || '' });

    // 성공 코드 처리(코드는 실계정 문서에 맞춰 조정)
    if (String(ResultCode || '').startsWith('2')) {
      const amount = Number(Amt || 0);
      const newRefunded = (order.refunded_amount || 0) + amount;
      const newStatus = (newRefunded >= (order.paid_amount || order.total_amount)) ? 'refunded' : 'partially_refunded';
      await supabase.from('orders').update({ refunded_amount: newRefunded, status: newStatus }).eq('id', order.id);
    }

    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error('[webhook]', e);
    return res.status(200).json({ ok:true }); // 웹훅은 200 유지
  }
}
