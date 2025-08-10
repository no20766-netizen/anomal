// File: api/toss/webhook.js
export default async function handler(req, res){
  try{
    const payload = req.body || {};
    console.log('Toss webhook:', JSON.stringify(payload));
    // TODO: eventType 별로 상태 동기화
    res.status(200).json({ ok: true });
  }catch(err){
    console.error(err);
    res.status(500).json({ ok: false });
  }
}
