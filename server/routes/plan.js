import { Router } from 'express';
import { COURSE_MAP } from '../../src/data/curriculum.js';
import { generatePlan, generateOfficialPlan, OFFERING_POLICIES } from '../../src/utils/scheduler.js';
import { YEAR4_PATHS } from '../../src/data/officialPlan.js';
import { runGA } from '../optimizer/ga.js';

const router = Router();

// กรองรหัสวิชาที่ไม่มีในหลักสูตรทิ้ง กัน client ส่งค่าแปลก ๆ เข้ามาทำให้ engine คำนวณผิด
function courseCodes(value) {
  return Array.isArray(value) ? value.filter((code) => typeof code === 'string' && COURSE_MAP[code]) : [];
}

// POST /api/plan/generate { completed: string[], failed: string[], constraints: {...}, method: 'ga'|'official'|'greedy' }
// `failed` = วิชาที่ตก/ถอน ต้องลงใหม่ — engine จะจัดให้เร็วที่สุด (Dynamic Re-planning)
router.post('/generate', (req, res) => {
  const { constraints = {}, method = 'ga' } = req.body ?? {};
  const completed = courseCodes(req.body?.completed);
  const failed = courseCodes(req.body?.failed);

  const options = {
    // normalizeTracks() ใน scheduler กรอง id ที่ไม่มีจริงทิ้งและจำกัดจำนวนสายให้เอง
    tracks: Array.isArray(constraints.tracks) ? constraints.tracks : undefined,
    track: constraints.track ?? null,
    hoursPerWeek: Number(constraints.hoursPerWeek) || 20,
    honors: !!constraints.honors,
    gradSchool: !!constraints.gradSchool,
    retakeCodes: failed,
    yearPathPreference: YEAR4_PATHS[constraints.yearPathPreference] ? constraints.yearPathPreference : 'project',
    offeringPolicy: OFFERING_POLICIES[constraints.offeringPolicy] ? constraints.offeringPolicy : 'every',
    ...(constraints.startTerm ? { startTerm: Number(constraints.startTerm) } : {}),
  };

  let result;
  if (method === 'official') {
    result = generateOfficialPlan(completed, options);
  } else if (method === 'greedy') {
    result = generatePlan(completed, options);
  } else {
    result = runGA(completed, options);
  }

  res.json({ method, ...result });
});

export default router;
