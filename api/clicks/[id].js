// Vercel 함수: POST /api/clicks/:id → { id, clicks }
const { incrementClick } = require('../../lib/clicks');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { id } = req.query;
  try {
    const clicks = await incrementClick(id);
    if (clicks === null) return res.status(404).json({ error: 'unknown link' });
    res.status(200).json({ id, clicks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
};
