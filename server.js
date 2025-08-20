const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

dotenv.config();
const app = express();

// ---- config
const NICEPAY_BASE = process.env.NICEPAY_MODE === 'production'
  ? 'https://api.nicepay.co.kr'
  : 'https://sandbox-api.nicepay.co.kr';
const CLIENT_KEY = process.env.NICEPAY_CLIENT_KEY;
const SECRET_KEY = process.env.NICEPAY_SECRET_KEY;
const BASE_URL   = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_BEARER = process.env.ADMIN_BEARER || '';

const authHeader = 'Basic ' + Buffer.from(`${CLIENT_KEY}:${SECRET_KEY}`).toString('base64');
const DATA_FILE = path.join(__dirname, 'data', 'orders.json');

// ---- helpers: persistence
function loadOrders() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return new Map(JSON.parse(raw));
  } catch (e) {
    return new Map();
  }
}
function saveOrders(store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([...store.entries()], null, 2));
  } catch (e) {
    console.error('[saveOrders error]', e.message);
  }
}
const orders = loadOrders();

// ---- middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 정적 파일 (CSS/JS 등) public 폴더에서 제공
app.use(express.static(path.join(__dirname, 'public')));

// Very small bearer guard for admin APIs
function requireAdmin(req, res, next) {
  if (!ADMIN_BEARER) return next(); // if unset, allow (for convenience)
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token === ADMIN_BEARER) return next();
  return res.status(401).send('Unauthorized');
}

// ---- utilities
const nowISO = () => new Date().toISOString();
function setOrder(order) {
  orders.set(order.orderId, order);
  saveOrders(orders);
  return order;
}
function updateOrder(orderId, patch) {
  const cur = orders.get(orderId) || { orderId, createdAt: nowISO() };
  const next = { ...cur, ...patch };
  orders.set(orderId, next);
  saveOrders(orders);
  return next;
}

// ---- APIs
app.get('/api/health', (req, res) => res.json({ ok: true, mode: process.env.NICEPAY_MODE, base: NICEPAY_BASE }));

// public config for client
app.get('/api/public-config', (req, res) => {
  res.json({ clientKey: CLIENT_KEY, returnUrl: `${BASE_URL}/pay/return` });
});

// Create order
app.get('/api/order/new', (req, res) => {
  const goodsName = req.query.goodsName || 'anomal item';
  const amount = parseInt(req.query.amount || '1000', 10);
  const method = (req.query.method || 'card').toLowerCase(); // card | bank | vbank | mobile
  const orderId = uuidv4();

  const order = {
    orderId, goodsName, amount, method,
    status: 'created',
    createdAt: nowISO()
  };
  setOrder(order);

  return res.json({
    orderId, goodsName, amount, method,
    returnUrl: `${BASE_URL}/pay/return`
  });
});

// Return URL after auth
app.post('/pay/return', async (req, res) => {
  const payload = Object.keys(req.body || {}).length ? req.body : {};
  const { authResultCode, authResultMsg, tid, orderId, amount } = payload;

  const order = orders.get(orderId);
  if (!order) return res.status(400).send('Unknown orderId');

  if (parseInt(amount, 10) !== order.amount) {
    updateOrder(orderId, { status: 'amount_mismatch' });
    return res.status(400).send('Amount mismatch');
  }
  if (authResultCode !== '0000') {
    updateOrder(orderId, { status: 'auth_failed' });
    return res.status(400).send(`Auth failed: ${authResultMsg || 'unknown'}`);
  }

  try {
    // Approve
    const url = `${NICEPAY_BASE}/v1/payments/${encodeURIComponent(tid)}`;
    const response = await axios.post(url, { amount: order.amount }, {
      headers: { 'Content-Type': 'application/json', Authorization: authHeader }
    });
    const data = response.data || {};

    // Normalize fields
    const nStatus = (data.status || '').toLowerCase();
    const method = order.method;

    if (nStatus === 'paid') {
      updateOrder(orderId, {
        status: 'paid', tid: data.tid || tid, receiptUrl: data.receiptUrl, approvedAt: nowISO(), paidAt: nowISO()
      });
      return res.send(`
        <meta charset="utf-8"/>
        <h2>결제 성공</h2>
        <p>주문번호: ${orderId}</p>
        <p>결제수단: ${method}</p>
        <p><a href="${data.receiptUrl}" target="_blank" rel="noopener">영수증 보기</a></p>
      `);
    }

    // vbank flow: account issued
    if (method === 'vbank' && (nStatus === 'ready' || nStatus === 'issued' || nStatus === 'virtual_account_issued')) {
      const vbank = {
        accountNumber: data.vbankNumber || data.vacctNo || data.accountNumber,
        bankCode: data.bankCode || data.vbankBankCode,
        bankName: data.bankName || data.vbankBankName,
        depositor: data.depositor || data.vbankDepositor || '',
        dueDate: data.dueDate || data.vacctExpDate || data.expireDate || ''
      };
      updateOrder(orderId, {
        status: 'vbank_issued', tid: data.tid || tid, vbank, approvedAt: nowISO()
      });

      return res.send(`
        <meta charset="utf-8"/>
        <h2>가상계좌 발급 완료</h2>
        <p>주문번호: ${orderId}</p>
        <p><b>${vbank.bankName || vbank.bankCode}</b> / 계좌번호 <b>${vbank.accountNumber}</b></p>
        <p>입금기한: ${vbank.dueDate || '지정 기한'}</p>
        <p class="note">입금 완료되면 자동으로 결제 완료 처리됩니다.</p>
      `);
    }

    updateOrder(orderId, { status: 'approve_unknown', tid: data.tid || tid, approvedAt: nowISO(), raw: data });
    return res.status(200).send(`<meta charset="utf-8"/>처리 상태: ${data.status || 'unknown'}`);
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[approve error]', errData);
    return res.status(500).send('승인 API 호출 오류');
  }
});

// Webhook
app.all('/webhook/nicepay', async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const body = req.is('application/json') ? req.body : req.body;
  console.log('[NICEPAY webhook]', body);

  const orderId = body.orderId || body.order_id || body.moid || body.MOID;
  const status = (body.status || body.ResultStatus || '').toLowerCase();
  const tid = body.tid || body.TID;

  if (orderId && orders.has(orderId)) {
    const patch = { webhookLast: { at: nowISO(), body } };
    if (tid) patch.tid = tid;

    if (status === 'paid') {
      patch.status = 'paid';
      patch.paidAt = nowISO();
    } else if (status === 'expired' || status === 'timeout') {
      patch.status = 'expired';
      patch.expiredAt = nowISO();
    } else if (status === 'cancelled' || status === 'canceled') {
      patch.status = 'cancelled';
      patch.cancelledAt = nowISO();
    } else if (status) {
      patch.status = status;
    }
    updateOrder(orderId, patch);
  }
  res.status(200).send('OK');
});

// Inquire payment status
app.get('/api/payment/inquire', requireAdmin, async (req, res) => {
  const { tid } = req.query || {};
  if (!tid) return res.status(400).json({ error: 'tid required' });
  try {
    const url = `${NICEPAY_BASE}/v1/payments/${encodeURIComponent(tid)}`;
    const response = await axios.get(url, { headers: { Authorization: authHeader } });
    res.json(response.data);
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[inquire error]', errData);
    res.status(500).json({ error: 'inquire_failed', detail: errData });
  }
});

// Cancel API
app.post('/api/payment/cancel', requireAdmin, async (req, res) => {
  const { tid, amount, reason } = req.body || {};
  if (!tid) return res.status(400).json({ error: 'tid required' });

  try {
    const url = `${NICEPAY_BASE}/v1/payments/${encodeURIComponent(tid)}/cancel`;
    const payload = {};
    if (amount) payload.amount = amount;
    if (reason) payload.reason = reason;
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json', Authorization: authHeader }
    });
    res.json(response.data);
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[cancel error]', errData);
    res.status(500).json({ error: 'cancel_failed', detail: errData });
  }
});

// Admin APIs
app.get('/api/orders', requireAdmin, (req, res) => {
  const list = [...orders.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(list);
});
app.get('/api/order/:id', requireAdmin, (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  res.json(o);
});

// ---- Serve HTML files directly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
