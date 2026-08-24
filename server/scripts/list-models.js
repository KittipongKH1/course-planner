// รันด้วย `node server/scripts/list-models.js` เพื่อดูรายชื่อโมเดลที่ gateway (KKUIntelSphere)
// รองรับจริงตอนนี้ — มีประโยชน์เพราะบางโมเดลอาจไม่มี endpoint ให้บริการ หรือไม่ยึด
// response_format:json_object เป๊ะ ๆ (ดูหมายเหตุใน server/ai/kkuIntelSphere.js)
import 'dotenv/config';

const BASE_URL = process.env.KKU_BASE_URL ?? 'https://gen.ai.kku.ac.th/api/v1';
const API_KEY = process.env.API_KEY ?? '';

const res = await fetch(`${BASE_URL}/models`, {
  headers: { Authorization: `Bearer ${API_KEY}` },
});
console.log('status:', res.status);
const data = await res.json();
const list = data?.data ?? data;

if (Array.isArray(list)) {
  console.log(`${list.length} models found:`);
  list.forEach((m) => console.log('-', m.id ?? m));
} else {
  console.log(JSON.stringify(data, null, 2).slice(0, 2000));
}
