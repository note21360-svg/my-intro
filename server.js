// 자기소개 페이지 + 링크 클릭수 API 서버
// 실행: node server.js  →  http://localhost:3000
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { MongoClient } = require('mongodb');

process.loadEnvFile(path.join(__dirname, '.env.local'));

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('.env.local에 MONGODB_URI가 없습니다.');
  process.exit(1);
}

// 클릭수를 셀 수 있는 링크 목록 (이 외의 id는 거부)
const LINK_IDS = ['github', 'linkedin'];

const client = new MongoClient(MONGODB_URI);
let links; // 컬렉션: { _id: 'github', clicks: 24 }

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// GET /api/clicks → { github: 24, linkedin: 3 }
async function getAllClicks(res) {
  const docs = await links.find({ _id: { $in: LINK_IDS } }).toArray();
  const counts = Object.fromEntries(LINK_IDS.map((id) => [id, 0]));
  for (const doc of docs) counts[doc._id] = doc.clicks ?? 0;
  sendJson(res, 200, counts);
}

// POST /api/clicks/:id → { id, clicks }
async function incrementClick(res, id) {
  if (!LINK_IDS.includes(id)) return sendJson(res, 404, { error: 'unknown link' });
  const doc = await links.findOneAndUpdate(
    { _id: id },
    { $inc: { clicks: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  sendJson(res, 200, { id, clicks: doc.clicks });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (pathname === '/api/clicks' && req.method === 'GET') return await getAllClicks(res);

    const match = pathname.match(/^\/api\/clicks\/([a-z0-9-]+)$/);
    if (match && req.method === 'POST') return await incrementClick(res, match[1]);

    if ((pathname === '/' || pathname === '/index.html') && req.method === 'GET') {
      const html = await fs.readFile(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'server error' });
  }
});

client.connect()
  .then(() => {
    links = client.db('my-intro').collection('links');
    server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB 연결 실패:', err.message);
    process.exit(1);
  });
