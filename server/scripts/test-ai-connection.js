// รันด้วย `npm run ai:test-connection` เพื่อยืนยัน request/response shape จริงของ
// KKUIntelSphere ก่อนพึ่งพา provider.js ในระบบจริง — ต้องมี KKU_API_KEY ใน .env ก่อน
import 'dotenv/config';
import { chatJSON, KKUIntelSphereError } from '../ai/kkuIntelSphere.js';

async function main() {
  console.log(`Testing KKUIntelSphere at ${process.env.KKU_BASE_URL ?? '(KKU_BASE_URL not set)'} ...`);
  try {
    const result = await chatJSON({
      systemPrompt: 'ตอบเป็น JSON เท่านั้น: {"ok": true, "message": "<ทวนคำที่ผู้ใช้พิมพ์>"}',
      userText: 'สวัสดี ทดสอบการเชื่อมต่อ',
    });
    console.log('SUCCESS — parsed JSON response:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\nถ้า shape ตรงกับที่คาด (choices[0].message.content เป็น JSON string) แปลว่า provider.js ใช้ได้เลย');
  } catch (err) {
    console.error('FAILED —', err instanceof KKUIntelSphereError ? err.message : err);
    console.error('\nตรวจสอบ: KKU_API_KEY ถูกต้องไหม, KKU_BASE_URL ถูกต้องไหม, endpoint นี้ใช้ path/response shape แบบอื่นหรือเปล่า');
    console.error('ถ้า shape ไม่ตรง (เช่น ไม่รองรับ response_format: json_object) ให้แก้เฉพาะ server/ai/kkuIntelSphere.js');
    process.exitCode = 1;
  }
}

main();
