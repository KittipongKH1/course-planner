// Benchmark: greedy heuristic (baseline เดิมใน src/utils/scheduler.js) vs Genetic Algorithm (ga.js)
// รันด้วย `npm run optimizer:benchmark` — ผลลัพธ์เอาไปใช้เขียนเล่มวิจัย Project 1 ได้ตรง ๆ
import { COURSES } from '../../src/data/curriculum.js';
import { generatePlan } from '../../src/utils/scheduler.js';
import { runGA } from './ga.js';

function completedUpToTerm(term, excludeCodes = []) {
  return COURSES.filter((c) => (c.term ?? 99) < term && !excludeCodes.includes(c.code)).map((c) => c.code);
}

const PROFILES = [
  { name: 'Cold-start (นักศึกษาใหม่, สาย Full-Stack)', completed: [], options: { track: 'FULLSTACK', hoursPerWeek: 20 } },
  { name: 'Honors (เกียรตินิยม, สาย AI)', completed: [], options: { track: 'AI', hoursPerWeek: 20, honors: true } },
  { name: 'พาร์ทไทม์หนัก (สาย DevOps, ว่างแค่ 8 ชม./สัปดาห์)', completed: [], options: { track: 'DEVOPS', hoursPerWeek: 8 } },
  {
    name: 'เรียนต่อป.โท (grad school, สาย AI, ผ่านมาถึงปี 3)',
    completed: completedUpToTerm(31),
    options: { track: 'AI', hoursPerWeek: 20, gradSchool: true, startTerm: 31 },
  },
  {
    name: 'ติดวิชาคอขวด (ตกโครงสร้างข้อมูล CP352001)',
    completed: completedUpToTerm(21, ['CP352001']),
    options: { track: 'DATA', hoursPerWeek: 20, startTerm: 21 },
  },
];

function timeIt(fn) {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

function summarize(result) {
  const scheduledCourses = result.plan.reduce((s, t) => s + t.courses.length, 0);
  return {
    terms: result.plan.length,
    scheduledCourses,
    warningCount: result.warnings.length,
    unresolved: result.warnings.some((w) => w.type === 'unresolved'),
  };
}

console.log('# Benchmark: Greedy (baseline) vs Genetic Algorithm\n');
console.log('| Profile | Method | เวลา (ms) | จำนวนเทอม | วิชาที่ลงได้ | คำเตือน | ลงไม่ครบ? |');
console.log('|---|---|---:|---:|---:|---:|:---:|');

PROFILES.forEach((profile) => {
  const greedy = timeIt(() => generatePlan(profile.completed, profile.options));
  const ga = timeIt(() => runGA(profile.completed, profile.options));

  const g = summarize(greedy.result);
  const a = summarize(ga.result);

  console.log(
    `| ${profile.name} | Greedy | ${greedy.ms.toFixed(1)} | ${g.terms} | ${g.scheduledCourses} | ${g.warningCount} | ${g.unresolved ? '⚠️' : '-'} |`
  );
  console.log(
    `| ${profile.name} | GA | ${ga.ms.toFixed(1)} | ${a.terms} | ${a.scheduledCourses} | ${a.warningCount} | ${a.unresolved ? '⚠️' : '-'} |`
  );
});

console.log('\n(หมายเหตุ: GA ใช้ populationSize=60, generations=150 ค่าเริ่มต้น — ปรับได้ผ่าน options ของ runGA)');
