const { json, cors } = require('../_common'); // <- fixed path (was './_common')
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.end();
  return json(res, 200, {
    url: process.env.SUPABASE_URL || null,
    anonKey: process.env.SUPABASE_ANON_KEY || null
  });
};
