// api/admin/[...route].js
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const config = { api: { bodyParser: true } };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ok   = (res, data) => res.status(200).json(data);
const bad  = (res, msg)  => res.status(400).json({ error: msg });
const nope = (res)       => res.status(405).end();

function getSlug(req) {
  const r = req?.query?.route;
  if (r) return Array.isArray(r) ? r.join('/') : String(r);
  const pathname = (req.url || '').split('?')[0] || '';
  return pathname.replace(/^\/api\/admin\/?/, '');
}
function getQuery(req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return req.query || {};
  }
}
function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}
function setAdminCookie(res) {
  const base = Buffer.from(JSON.stringify({ t: Date.now() })).toString('base64url');
  const sig  = crypto.createHmac('sha256', process.env.JWT_SECRET || 'change-me').update(base).digest('base64url');
  const value = `${base}.${sig}`;
  const maxAge = 60*60*24*7; // 7d
  res.setHeader('Set-Cookie', `anomal_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

// NICEPAY 취소/환불 헬퍼(엔드포인트/성공코드는 실계정 문서에 맞춰 조정)
async function pgCancelOrRefund({ mode, tid, amount, reason }) {
  const MID = process.env.NICEPAY_CLIENT_KEY;
  const SECRET = process.env.NICEPAY_SECRET_KEY;
  const edi = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const signSrc = MID + String(amount) + edi + tid + SECRET;
  const sign = crypto.createHash('sha256').update(signSrc).digest('hex');
  const endpoint =
    process.env.NICEPAY_MODE === 'prod'
      ? 'https://webapi.nicepay.co.kr/v1/' + (mode === 'cancel' ? 'cancel' : 'refund')
      : 'https://sandbox-api.nicepay.co.kr/v1/' + (mode === 'cancel' ? 'cancel' : 'refund');

  const payload = { Mid: MID, Tid: tid, CancelAmt: String(amount), CancelMsg: reason || '', EdiDate: edi, SignData: sign };
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, body: j };
}

export default async function handler(req, res) {
  const slug = getSlug(req);

  try {
    switch (slug) {
      // ----- auth -----
      case 'login': {
        if (req.method !== 'POST') return nope(res);
        const { id, pw } = getBody(req);
        if (id === process.env.ADMIN_ID && pw === process.env.ADMIN_PW) {
          setAdminCookie(res);
          return ok(res, { ok: true });
        }
        return res.status(401).json({ ok: false });
      }
      case 'logout': {
        if (req.method !== 'POST') return nope(res);
        res.setHeader('Set-Cookie', 'anomal_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
        return ok(res, { ok: true });
      }

      // ----- members -----
      case 'members': {
        if (req.method !== 'GET') return nope(res);
        const { data: usersResp, error: usersErr } =
          await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (usersErr) throw usersErr;

        // profiles: auth_user_id, name, phone, addr1, addr2, zipcode
        let profiles = [];
        try {
          const { data: pData, error: pErr } =
            await supabase.from('profiles').select('auth_user_id, name, phone, addr1, addr2, zipcode');
          if (!pErr) profiles = pData || [];
          else console.error('[profiles.select] error:', pErr);
        } catch (e) {
          console.error('[profiles.select] exception:', e);
        }

        const q = (getQuery(req).q || '').toString().toLowerCase();
        const merged = (usersResp.users || []).map(u => {
          const p = profiles?.find(pr => pr.auth_user_id === u.id);
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            name: p?.name || '',
            phone: p?.phone || '',
            address: [p?.addr1, p?.addr2].filter(Boolean).join(' '),
            zipcode: p?.zipcode || ''
          };
        }).filter(r => !q || [r.email, r.name].some(v => (v || '').toLowerCase().includes(q)));

        return ok(res, merged);
      }

      // ----- orders -----
      case 'orders': {
        if (req.method !== 'GET') return nope(res);
        const { data: orders, error: ordersErr } = await supabase
          .from('orders')
          .select('id, order_id, customer_id, status, total_amount, paid_amount, refunded_amount, method, created_at, paid_at, tid')
          .order('created_at', { ascending: false });
        if (ordersErr) throw ordersErr;

        const { data: usersList, error: usersErr2 } =
          await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (usersErr2) throw usersErr2;

        const { data: profs, error: profErr2 } =
          await supabase.from('profiles').select('auth_user_id, name');
        if (profErr2) throw profErr2;

        const ordMerged = (orders || []).map(o => {
          const usr = (usersList?.users || []).find(u => u.id === o.customer_id);
          const p = (profs || []).find(pr => pr.auth_user_id === o.customer_id);
          return {
            id: o.id,
            order_id: o.order_id,
            amount: o.total_amount,
            status: o.status,
            created_at: o.created_at,
            paid_at: o.paid_at,
            email: usr?.email || '',
            name: p?.name || ''
          };
        });
        return ok(res, ordMerged);
      }

      // ----- dashboard small stats -----
      case 'todayMembers': {
        if (req.method !== 'GET') return nope(res);
        const start = new Date(); start.setHours(0,0,0,0);
        const { data: allUsers, error: listErr } =
          await supabase.auth.admin.listUsers({ page:1, perPage:1000 });
        if (listErr) throw listErr;

        const today = (allUsers.users || [])
          .filter(u => new Date(u.created_at) >= start)
          .map(u => ({ id:u.id, email:u.email, created_at:u.created_at }));

        return ok(res, today);
      }
      case 'todayOrders': {
        if (req.method !== 'GET') return nope(res);
        const dayStart = new Date(); dayStart.setHours(0,0,0,0);
        const { data: todayO, error: todayErr } = await supabase
          .from('orders')
          .select('id, order_id, total_amount, created_at')
          .gte('created_at', dayStart.toISOString());
        if (todayErr) throw todayErr;
        return ok(res, todayO || []);
      }

      // ----- cancel / refund management -----
      case 'cancelRequests': {
        if (req.method !== 'GET') return nope(res);
        const q = getQuery(req);
        const status = q.status || '';
        let query = supabase
          .from('cancel_requests')
          .select('id, order_id, user_id, status, requested_amount, cancel_amount, reason, created_at, updated_at, approved_at, return_required')
          .order('created_at', { ascending: false });
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return ok(res, data);
      }
      case 'cancelRequests/detail': {
        if (req.method !== 'GET') return nope(res);
        const { id } = getQuery(req);
        const { data, error } = await supabase
          .from('cancel_requests')
          .select('*, cancel_attachments(file_url)')
          .eq('id', id).single();
        if (error) throw error;
        return ok(res, data);
      }
      case 'cancelRequests/approve': {
        if (req.method !== 'POST') return nope(res);
        const { id, cancelAmount = null, returnRequired = false } = getBody(req);

        const { data: reqRow, error: rErr } = await supabase.from('cancel_requests').select('*').eq('id', id).single();
        if (rErr || !reqRow) throw rErr || new Error('request not found');

        const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', reqRow.order_id).single();
        if (oErr || !order) throw oErr || new Error('order not found');

        // 7일 제한
        const paidAt = order.paid_at ? new Date(order.paid_at) : null;
        if (!paidAt || (Date.now() - paidAt.getTime() > 7*24*60*60*1000)) {
          return res.status(400).json({ error: 'cancel allowed within 7 days' });
        }

        const amt = cancelAmount ?? ((order.paid_amount ?? order.total_amount) - (order.refunded_amount || 0));
        const newStatus = returnRequired ? 'awaiting_return' : 'approved';

        const { error: uErr } = await supabase
          .from('cancel_requests')
          .update({ status: newStatus, approved_by: 'admin', approved_at: new Date().toISOString(), cancel_amount: amt, return_required: !!returnRequired })
          .eq('id', id);
        if (uErr) throw uErr;

        return ok(res, { ok: true });
      }
      case 'cancelRequests/reject': {
        if (req.method !== 'POST') return nope(res);
        const { id, reason='' } = getBody(req);
        const { error: uErr } = await supabase
          .from('cancel_requests')
          .update({ status:'rejected', rejected_by: 'admin', rejected_at: new Date().toISOString(), admin_memo: reason })
          .eq('id', id);
        if (uErr) throw uErr;
        return ok(res, { ok:true });
      }
      case 'cancelRequests/markReturned': {
        if (req.method !== 'POST') return nope(res);
        const { id } = getBody(req);
        const { error: uErr } = await supabase
          .from('cancel_requests')
          .update({ status:'returned' })
          .eq('id', id);
        if (uErr) throw uErr;
        return ok(res, { ok:true });
      }
      case 'cancelRequests/refund': {
        if (req.method !== 'POST') return nope(res);
        const { id } = getBody(req);

        const { data: reqRow, error: rErr } = await supabase.from('cancel_requests').select('*').eq('id', id).single();
        if (rErr || !reqRow) throw rErr || new Error('request not found');
        const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', reqRow.order_id).single();
        if (oErr || !order) throw oErr || new Error('order not found');

        const amount = reqRow.cancel_amount ?? ((order.paid_amount ?? order.total_amount) - (order.refunded_amount || 0));
        const mode = (order.status === 'paid' || order.status === 'fulfilling') ? 'cancel' : 'refund';

        await supabase.from('cancel_requests').update({ status:'refunding' }).eq('id', id);

        const result = await pgCancelOrRefund({ mode, tid: order.tid, amount, reason: reqRow.reason || 'refund' });
        await supabase.from('payment_events').insert({
          order_id: order.id,
          type: mode,
          payload: result.body || {},
          success: !!result.ok,
          message: result.body?.ResultMsg || ''
        });

        if (!result.ok) {
          await supabase.from('cancel_requests').update({ status:'failed' }).eq('id', id);
          return res.status(502).json({ error: 'PG failed', detail: result.body || null });
        }

        const newRefunded = (order.refunded_amount || 0) + amount;
        const newOrderStatus = (newRefunded >= (order.paid_amount ?? order.total_amount)) ? 'refunded' : 'partially_refunded';

        await supabase.from('orders')
          .update({ refunded_amount: newRefunded, status: newOrderStatus })
          .eq('id', order.id);

        await supabase.from('cancel_requests')
          .update({ status:'completed' })
          .eq('id', id);

        return ok(res, { ok:true });
      }

      default:
        return bad(res, `Unknown route: ${slug || '(empty)'}`);
    }
  } catch (e) {
    console.error(e);
    const msg = e?.message || e?.error_description || String(e);
    return res.status(500).json({ error: msg });
  }
}