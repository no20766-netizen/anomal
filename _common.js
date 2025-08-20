// Common helpers for serverless NICEPAY (Vercel style)
const querystring = require('querystring');
function parseBody(req) {
  return new Promise((resolve) => {
    let data=''; req.on('data', c=>data+=c); req.on('end', ()=>{
      const ct=(req.headers['content-type']||'').toLowerCase();
      if(ct.includes('application/json')) { try{ resolve(JSON.parse(data||'{}')); } catch{ resolve({}); } }
      else if(ct.includes('application/x-www-form-urlencoded')) { resolve(querystring.parse(data)); }
      else { try{ resolve(JSON.parse(data||'{}')); } catch{ resolve(querystring.parse(data)); } }
    });
  });
}
function json(res, code, obj){ res.statusCode=code; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(obj)); }
function html(res, code, text){ res.statusCode=code; res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(text); }
function cors(res){ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization'); }
module.exports = { parseBody, json, html, cors };
