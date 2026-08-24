// High-level AI provider interface — เรียก KKUIntelSphere ก่อนเสมอ
// ถ้าล้มเหลว (network/timeout/parse/no key) ให้ fallback ไปยัง rule-based logic เดิมทันที
// เพื่อไม่ให้ผู้ใช้ค้าง (ตรงกับหลัก "graceful degradation" ที่วางแผนไว้)
import { chatJSON, KKUIntelSphereError } from './kkuIntelSphere.js';
import { extractIntent } from '../../src/utils/intent.js';
import { TRACKS, COURSE_MAP } from '../../src/data/curriculum.js';
import { isBottleneck, getImpactCone } from '../../src/utils/graph.js';

const TRACK_IDS = Object.keys(TRACKS);

const INTENT_SYSTEM_PROMPT = `คุณเป็นระบบสกัดข้อมูล (intent extraction) สำหรับแอปวางแผนการเรียนของนักศึกษาวิทยาการคอมพิวเตอร์
อ่านข้อความภาษาไทย/อังกฤษของนักศึกษา แล้วตอบเป็น JSON object เดียวเท่านั้น ห้ามมีข้อความอื่นนอก JSON
รูปแบบ JSON ที่ต้องตอบ:
{
  "track": one of [${TRACK_IDS.join(', ')}] or null,
  "hoursPerWeek": number or null,
  "honors": true | false | null,
  "gradSchool": true | false | null,
  "partTimeJob": true | false | null
}
กติกา:
- "track": ให้เลือกจากรายการที่กำหนดเท่านั้น ถ้าไม่ชัดเจนให้เป็น null
- "hoursPerWeek": ชั่วโมงว่างสำหรับเรียนต่อสัปดาห์ (แปลง "วันละ X ชม." เป็น X*7 ด้วย) ถ้าไม่มีข้อมูลให้เป็น null
- "honors": true ถ้านักศึกษาพูดถึงเกียรตินิยม/ห้ามติด F หรือ W
- "gradSchool": true ถ้านักศึกษาพูดถึงการเรียนต่อ/ป.โท/งานวิจัย
- "partTimeJob": true ถ้าพูดถึงงานพาร์ทไทม์`;

/**
 * สกัด intent จากข้อความแชท — พยายามใช้ AI ก่อน ถ้าไม่สำเร็จ fallback เป็น rule-based
 * @param {string} text
 * @returns {Promise<{intent: object, source: 'ai'|'fallback', error?: string}>}
 */
export async function extractIntentSmart(text) {
  try {
    const raw = await chatJSON({ systemPrompt: INTENT_SYSTEM_PROMPT, userText: text });
    const intent = normalizeIntent(raw);
    return { intent, source: 'ai' };
  } catch (err) {
    const reason = err instanceof KKUIntelSphereError ? err.message : String(err);
    return { intent: extractIntent(text), source: 'fallback', error: reason };
  }
}

function normalizeIntent(raw) {
  return {
    track: TRACK_IDS.includes(raw?.track) ? raw.track : null,
    hoursPerWeek: Number.isFinite(raw?.hoursPerWeek) ? raw.hoursPerWeek : null,
    honors: typeof raw?.honors === 'boolean' ? raw.honors : null,
    gradSchool: typeof raw?.gradSchool === 'boolean' ? raw.gradSchool : null,
    partTimeJob: typeof raw?.partTimeJob === 'boolean' ? raw.partTimeJob : null,
  };
}

const TRANSCRIPT_SYSTEM_PROMPT = `คุณเป็นที่ปรึกษาวิชาการ วิเคราะห์ประวัติการเรียน (transcript) ของนักศึกษาวิทยาการคอมพิวเตอร์
แล้วประเมินความเสี่ยงต่อเป้าหมาย (เช่น เกียรตินิยม, จบตามเวลา) ตอบเป็น JSON object เดียวเท่านั้น:
{
  "riskLevel": "low" | "medium" | "high",
  "warnings": ["ข้อความคำเตือนภาษาไทย", ...]
}
ให้พิจารณา: วิชาที่ตก/ถอน (status = failed/withdrawn) ที่เป็นวิชาคอขวด (bottleneck) จะกระทบวิชาที่ต่อยอดจำนวนมาก
ควรยกความเสี่ยงเป็น high และอธิบายว่ากระทบวิชาอะไรบ้าง`;

/**
 * วิเคราะห์ transcript — พยายามใช้ AI ก่อน ถ้าไม่สำเร็จ fallback เป็น rule-based
 * โดยใช้ critical-path/bottleneck detection ที่มีอยู่แล้วใน src/utils/graph.js
 * @param {{code: string, status: 'completed'|'failed'|'withdrawn'}[]} records
 * @param {object} constraints
 */
export async function analyzeTranscriptSmart(records, constraints = {}) {
  try {
    const raw = await chatJSON({
      systemPrompt: TRANSCRIPT_SYSTEM_PROMPT,
      userText: JSON.stringify({ records, constraints }),
    });
    return {
      result: {
        riskLevel: ['low', 'medium', 'high'].includes(raw?.riskLevel) ? raw.riskLevel : 'medium',
        warnings: Array.isArray(raw?.warnings) ? raw.warnings.filter((w) => typeof w === 'string') : [],
      },
      source: 'ai',
    };
  } catch (err) {
    const reason = err instanceof KKUIntelSphereError ? err.message : String(err);
    return { result: ruleBasedTranscriptRisk(records, constraints), source: 'fallback', error: reason };
  }
}

function ruleBasedTranscriptRisk(records, constraints) {
  const problemCodes = records.filter((r) => r.status === 'failed' || r.status === 'withdrawn').map((r) => r.code);
  const warnings = [];
  let riskLevel = 'low';

  problemCodes.forEach((code) => {
    const course = COURSE_MAP[code];
    if (!course) return;
    if (isBottleneck(code)) {
      const impacted = getImpactCone(code);
      riskLevel = 'high';
      warnings.push(
        `${code} (${course.nameEn}) เป็นวิชาคอขวด — กระทบวิชาที่ต่อยอด ${impacted.length} วิชา ควรลงซ้ำโดยเร็วที่สุด`
      );
    } else {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      warnings.push(`${code} (${course.nameEn}) ยังไม่ผ่าน — วางแผนลงซ้ำในเทอมถัดไป`);
    }
  });

  if (constraints?.honors && problemCodes.length > 0) {
    riskLevel = 'high';
    warnings.push('ตั้งเป้าเกียรตินิยมไว้ แต่มีวิชาที่ยังไม่ผ่าน — เงื่อนไขห้ามติด F/W อาจไม่เป็นไปตามเป้า');
  }

  return { riskLevel, warnings };
}
