// Serves the site and relays contact-form messages through Postmark.
// Needs Node 18+ (built-in fetch). No dependencies.
//
// Environment variables (set these in Railway, never commit them):
//   POSTMARK_SERVER_TOKEN  Postmark server API token
//   CONTACT_FROM           Verified Postmark sender, e.g. "GDK Services <hello@yourdomain.com>"
//   CONTACT_TO             Where messages go (defaults to gavinknowles@gmail.com)
//   PORT                   Set automatically by Railway

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.POSTMARK_SERVER_TOKEN;
const FROM = process.env.CONTACT_FROM;
const TO = process.env.CONTACT_TO || 'gavinknowles@gmail.com';
const ROOT = __dirname;
const ASSETS = path.join(ROOT, 'assets');
// Root-level files that may be served. Everything else public lives in /assets.
const PUBLIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/og-image.png': 'og-image.png',
  '/Gavin_Knowles_CV.pdf': 'Gavin_Knowles_CV.pdf',
  '/robots.txt': 'robots.txt',
};
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg', '.txt']);

// Map a request path to a file on disk, or null. Blocks path traversal.
function resolveFile(pathname) {
  if (PUBLIC_FILES[pathname]) return path.join(ROOT, PUBLIC_FILES[pathname]);
  if (!pathname.startsWith('/assets/')) return null;
  let decoded;
  try { decoded = decodeURIComponent(pathname.slice('/assets/'.length)); } catch { return null; }
  const file = path.resolve(ASSETS, decoded);
  return file.startsWith(ASSETS + path.sep) ? file : null;
}

function serveFile(req, res, file) {
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext];
  if (!type) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const headers = {
      'Content-Type': type,
      // HTML revalidates every time; assets are cached for a day.
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Accept-Encoding',
    };
    let body = data;
    const accept = req.headers['accept-encoding'] || '';
    if (COMPRESSIBLE.has(ext) && data.length > 1024) {
      if (/\bbr\b/.test(accept)) { body = zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } }); headers['Content-Encoding'] = 'br'; }
      else if (/\bgzip\b/.test(accept)) { body = zlib.gzipSync(data); headers['Content-Encoding'] = 'gzip'; }
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}

// Simple per-IP rate limit: 5 messages per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleContact(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (rateLimited(ip)) return sendJson(res, 429, { error: 'Too many messages. Please try again later.' });

  let payload;
  try { payload = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'Invalid request.' }); }

  // Honeypot field: real visitors never fill it in, bots often do.
  if (payload.website) return sendJson(res, 200, { ok: true });

  const name = String(payload.name || '').trim().slice(0, 200);
  const email = String(payload.email || '').trim().slice(0, 200);
  const message = String(payload.message || '').trim().slice(0, 10000);
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(res, 400, { error: 'Please fill in your name, a valid email and a message.' });
  }

  if (!TOKEN || !FROM) {
    console.error('POSTMARK_SERVER_TOKEN or CONTACT_FROM is not set');
    return sendJson(res, 500, { error: 'The contact form is not configured yet.' });
  }

  try {
    const r = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': TOKEN,
      },
      body: JSON.stringify({
        From: FROM,
        To: TO,
        ReplyTo: `"${name.replace(/["\r\n]/g, '')}" <${email}>`,
        Subject: `Website enquiry from ${name.replace(/[\r\n]/g, ' ')}`,
        TextBody: `${message}\n\n${name}\n${email}`,
        MessageStream: 'outbound',
      }),
    });
    if (!r.ok) {
      console.error('Postmark error', r.status, await r.text());
      return sendJson(res, 502, { error: 'Sorry, the message could not be sent. Please try again later.' });
    }
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Postmark request failed', err);
    return sendJson(res, 502, { error: 'Sorry, the message could not be sent. Please try again later.' });
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/contact') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
    return handleContact(req, res);
  }
  const file = resolveFile(url.pathname);
  if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  serveFile(req, res, file);
}).listen(PORT, () => console.log(`Listening on port ${PORT}`));
