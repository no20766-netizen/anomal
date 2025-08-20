const { json, cors } = require('./_common');
module.exports = async (req, res) => {
  cors(res); if (req.method==='OPTIONS') return res.end();
  const clientKey = process.env.NICEPAY_CLIENT_KEY || '';
  const base = process.env.BASE_URL || 'http://localhost:3000';
  return json(res, 200, { clientKey, returnUrl: `${base}/api/nicepay/return` });
};
