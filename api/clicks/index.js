// Vercel 함수: GET /api/clicks → { github: 24, linkedin: 3 }
const { getAllClicks } = require('../../lib/clicks');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    res.status(200).json(await getAllClicks());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
};
