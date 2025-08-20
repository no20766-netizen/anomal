const { parseBody, html, cors } = require('./_common');
const https = require('https');
function apiBase(){ return process.env.NICEPAY_MODE==='production' ? 'https://api.nicepay.co.kr' : 'https://sandbox-api.nicepay.co.kr'; }
function basicAuth(){ return 'Basic ' + Buffer.from((process.env.NICEPAY_CLIENT_KEY||'') + ':' + (process.env.NICEPAY_SECRET_KEY||'')).toString('base64'); }
function postJson(url, body){ return new Promise((resolve,reject)=>{ const u=new URL(url); const data=JSON.stringify(body||{});
  const req=https.request({method:'POST',hostname:u.hostname,path:u.pathname+(u.search||''),headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),'Authorization':basicAuth()}}, resp=>{ let raw=''; resp.on('data',c=>raw+=c); resp.on('end',()=>{ try{resolve(JSON.parse(raw))}catch{resolve({})} }); });
  req.on('error',reject); req.write(data); req.end(); }); }
module.exports = async (req, res) => {
  cors(res); if (req.method==='OPTIONS') return res.end();
  if (req.method!=='POST') return html(res, 200, 'OK');
  const body = await parseBody(req);
  const { authResultCode, authResultMsg, tid, orderId, amount, method } = body;
  if (authResultCode !== '0000') return html(res, 400, `<meta charset="utf-8"/>인증 실패: ${authResultMsg||'unknown'}`);
  try {
    const result = await postJson(`${apiBase()}/v1/payments/${encodeURIComponent(tid)}`, { amount: parseInt(amount,10) });
    const status = (result.status||'').toLowerCase();
    if (status==='paid') return html(res, 200, `<meta charset="utf-8"/><h2>결제 성공</h2><p>주문번호:${orderId}</p><p><a href="${result.receiptUrl}" target="_blank" rel="noopener">영수증 보기</a></p>`);
    if (method==='vbank' && (status==='ready'||status==='issued'||status==='virtual_account_issued')) {
      const acc=result.vbankNumber||result.vacctNo||result.accountNumber||''; const bank=result.bankName||result.vbankBankName||result.bankCode||''; const due=result.dueDate||result.expireDate||result.vacctExpDate||'';
      return html(res, 200, `<meta charset="utf-8"/><h2>가상계좌 발급 완료</h2><p>${bank} ${acc}</p><p>입금기한: ${due||'지정 기한'}</p>`);
    }
    return html(res, 200, `<meta charset="utf-8"/>상태: ${result.status||'unknown'}`);
  } catch (e) { return html(res, 500, `<meta charset="utf-8"/>승인 API 호출 오류`); }
};
