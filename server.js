// 로컬 개발용 서버 (Vercel 배포 시에는 api/ 폴더의 함수가 대신 동작)
// 실행: npm start  →  http://localhost:3000
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

process.loadEnvFile(path.join(__dirname, '.env.local'));

const { getCollection, getAllClicks, incrementClick } = require('./lib/clicks');

const PORT = Number(process.env.PORT) || 3000;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (pathname === '/api/clicks' && req.method === 'GET') {
      return sendJson(res, 200, await getAllClicks());
    }

    const match = pathname.match(/^\/api\/clicks\/([a-z0-9-]+)$/);
    if (match && req.method === 'POST') {
      const clicks = await incrementClick(match[1]);
      if (clicks === null) return sendJson(res, 404, { error: 'unknown link' });
      return sendJson(res, 200, { id: match[1], clicks });
    }

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

// 시작 시 MongoDB 연결을 먼저 확인
getCollection()
  .then(() => server.listen(PORT, () => console.log(`http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('MongoDB 연결 실패:', err.message);
    process.exit(1);
  });
