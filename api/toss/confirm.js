// File: api/toss/confirm.js
export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).end();
  try{
    const { paymentKey, orderId, amount } = req.body || {};
    if(!paymentKey || !orderId || typeof amount !== 'number'){
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const basic = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64');
    const resp = await fetch('https://api.tosspayments.com/v1/payments/confirm',{
      method:'POST',
      headers:{
        'Authorization': `Basic ${basic}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });

    const data = await resp.json();
    if(!resp.ok){
      console.error('Toss confirm error', data);
      return res.status(resp.status).json(data);
    }

    // TODO: 주문 DB 저장, 재고 차감, 송장 생성 등 비즈니스 로직
    res.status(200).json({
      orderId: data.orderId,
      approvedAt: data.approvedAt,
      method: data.method,
      receipt: data.receipt
    });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
}
