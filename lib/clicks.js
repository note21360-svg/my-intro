// 링크 클릭수 저장소 (로컬 server.js와 Vercel api/ 함수가 함께 사용)
const { MongoClient } = require('mongodb');

// 클릭수를 셀 수 있는 링크 목록 (이 외의 id는 거부)
const LINK_IDS = ['github', 'linkedin'];

// 서버리스 환경에서 호출마다 새로 연결하지 않도록 연결을 재사용
let clientPromise;
function getCollection() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI 환경 변수가 없습니다.');
    clientPromise = new MongoClient(uri).connect().catch((err) => {
      clientPromise = undefined; // 실패하면 다음 요청에서 다시 시도
      throw err;
    });
  }
  // 컬렉션: { _id: 'github', clicks: 24 }
  return clientPromise.then((client) => client.db('my-intro').collection('links'));
}

// → { github: 24, linkedin: 3 }
async function getAllClicks() {
  const links = await getCollection();
  const docs = await links.find({ _id: { $in: LINK_IDS } }).toArray();
  const counts = Object.fromEntries(LINK_IDS.map((id) => [id, 0]));
  for (const doc of docs) counts[doc._id] = doc.clicks ?? 0;
  return counts;
}

// → 증가된 클릭수, 알 수 없는 id면 null
async function incrementClick(id) {
  if (!LINK_IDS.includes(id)) return null;
  const links = await getCollection();
  const doc = await links.findOneAndUpdate(
    { _id: id },
    { $inc: { clicks: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.clicks;
}

module.exports = { getCollection, getAllClicks, incrementClick };
