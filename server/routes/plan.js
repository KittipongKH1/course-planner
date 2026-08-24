import { Router } from 'express';
import { generatePlan, generateOfficialPlan } from '../../src/utils/scheduler.js';
import { runGA } from '../optimizer/ga.js';

const router = Router();

// POST /api/plan/generate { completed: string[], failed: string[], constraints: {...}, method: 'ga'|'official'|'greedy' }
// `failed` = วิชาที่ตก/ถอน ต้องลงใหม่ — engine จะจัดให้เร็วที่สุด (Dynamic Re-planning)
router.post('/generate', (req, res) => {
  const { completed = [], failed = [], constraints = {}, method = 'ga' } = req.body ?? {};

  const options = {
    track: constraints.track ?? null,
    hoursPerWeek: constraints.hoursPerWeek ?? 20,
    honors: !!constraints.honors,
    gradSchool: !!constraints.gradSchool,
    retakeCodes: failed,
    ...(constraints.startTerm ? { startTerm: constraints.startTerm } : {}),
  };

  let result;
  if (method === 'official') {
    result = generateOfficialPlan(completed, {
      track: options.track,
      yearPathPreference: constraints.yearPathPreference ?? 'project',
      retakeCodes: options.retakeCodes,
    });
  } else if (method === 'greedy') {
    result = generatePlan(completed, options);
  } else {
    result = runGA(completed, options);
  }

  res.json({ method, ...result });
});

export default router;
