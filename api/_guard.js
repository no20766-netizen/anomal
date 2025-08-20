// api/_guard.js
import crypto from 'crypto';

function verifyToken(token, secret) {
  try {
    const [base, sig] = String(token || '').split('.');
    if (!base || !sig) return false;
    const expected = crypto.createHmac('sha256', secret || 'change-me')
      .update(base).digest('base64url');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function normalizeAdminPath(raw) {
  const p = (raw || '').replace(/^\/+/, '');
  if (!p || p === '/') return 'index.html';
  if (/^login(?:\.html)?$/i.test(p)) return 'login.html';
  if (/\.[a-z0-9]+$/i.test(p)) return p;
  return `${p}.html`;
}

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParam = url.searchParams.get('path') || '';
  const normalized = normalizeAdminPath(pathParam);

  const cookieHeader = req.headers.cookie || '';
  const token = cookieHeader.split(';').map(v => v.trim())
    .find(v => v.startsWith('anomal_admin='))?.split('=')[1];

  const ok = token && verifyToken(token, process.env.JWT_SECRET);

  if (!ok && /^login\.html$/i.test(normalized)) {
    res.statusCode = 307;
    res.setHeader('Location', `/__public/admin/${normalized}`);
    return res.end();
  }

  if (!ok) {
    const next = `/admin/${normalized.replace(/\.html$/i, '')}`;
    res.statusCode = 302;
    res.setHeader('Location', `/__public/admin/login.html?next=${encodeURIComponent(next)}`);
    return res.end();
  }

  res.statusCode = 307;
  res.setHeader('Location', `/__public/admin/${normalized}`);
  return res.end();
}