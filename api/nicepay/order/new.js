/**
 * /api/nicepay/order/new
 * - 주문번호 생성
 * - (선택) Supabase에 orders 레코드 생성 + customer 매핑
 * - Vercel Node.js Runtime (require 사용)
 */
const { randomUUID } = require('crypto');

// ✅ 폴더 구조: /api/nicepay/order/new.js
//   - 공통 유틸은 상위 폴더 ../_common 에 있음
//   - Supabase 서버 클라이언트는 ../../_supabase 에 있음
const { json, cors } = require('../_common');          // ../_common.js
let supaAdmin = null;
try {
  // 서비스키가 없거나 파일 경로가 틀려도 API가 죽지 않도록 try/catch
  ({ supaAdmin } = require('../../_supabase'));       // ../../_supabase.js
} catch (e) {
  // noop
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.end();

  const url = new URL(req.url, 'http://x');
  const goodsName = url.searchParams.get('goodsName') || 'anomal item';
  const amount = parseInt(url.searchParams.get('amount') || '1000', 10);
  const method = (url.searchParams.get('method') || 'card').toLowerCase();

  const authUserId = url.searchParams.get('authUserId') || null;
  const email = url.searchParams.get('email') || null;

  const orderId = randomUUID();

  // DB 반영은 실패하더라도 결제 진행을 막지 않도록 try/catch
  try {
    if (typeof supaAdmin === 'function') {
      const supa = supaAdmin();

      // 고객 찾거나 생성
      let customerId = null;
      if (authUserId || email) {
        const { data: cust } = await supa
          .from('customers')
          .select('id')
          .or(`auth_user_id.eq.${authUserId || ''},email.eq.${email || ''}`)
          .limit(1)
          .maybeSingle();

        if (cust) {
          customerId = cust.id;
        } else if (email) {
          const ins = await supa
            .from('customers')
            .insert({ auth_user_id: authUserId, email })
            .select()
            .single();
          customerId = ins.data?.id || null;
        }
      }

      // 주문 저장
      await supa.from('orders').insert({
        order_id: orderId,
        total_amount: amount,
        method,
        status: 'created',
        customer_id: customerId,
      });
    }
  } catch (e) {
    // Vercel 로그에서 확인할 수 있도록만 남기고, 결제 흐름은 계속 진행
    console.error('[order/new] DB insert error:', e?.message || e);
  }

  return json(res, 200, { orderId, goodsName, amount, method });
};
