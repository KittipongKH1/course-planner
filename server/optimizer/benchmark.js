// Benchmark: greedy heuristic (baseline เดิมใน src/utils/scheduler.js) vs Genetic Algorithm (ga.js)
// รันด้วย `npm run optimizer:benchmark` — ผลลัพธ์เอาไปใช้เขียนเล่มวิจัย Project 1 ได้ตรง ๆ
// GA เป็น stochastic จึงรันหลาย seed แล้วรายงาน mean ± SD (seed คงที่ = รันซ้ำได้ผลเดิม)
import { COURSES } from '../../src/data/curriculum.js';
import { generatePlan, termIndex, ON_TIME_TERM, OFFERING_POLICIES } from '../../src/utils/scheduler.js';
import { runGA } from './ga.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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
    options: { track: 'DATA', hoursPerWeek: 20, startTerm: 22, retakeCodes: ['CP352001'] },
  },
];

function timeIt(fn) {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

function summarize(result) {
  const lastTerm = result.plan.at(-1)?.term ?? null;
  return {
    gradTerm: lastTerm,
    delay: lastTerm ? Math.max(0, termIndex(lastTerm) - termIndex(ON_TIME_TERM)) : 0,
    terms: result.plan.length,
    warningCount: result.warnings.length,
    unresolved: result.warnings.some((w) => w.type === 'unresolved'),
  };
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
const fmt = (xs, digits = 1) => `${mean(xs).toFixed(digits)} ± ${sd(xs).toFixed(digits)}`;

console.log('# Benchmark: Greedy (baseline) vs Genetic Algorithm\n');
console.log(`GA: populationSize=60, generations=150, seeds=${SEEDS.join(',')} (รายงาน mean ± SD)\n`);

Object.entries(OFFERING_POLICIES).forEach(([policy, label]) => {
  console.log(`## สมมติฐานการเปิดสอน: ${label} (offeringPolicy='${policy}')\n`);
  console.log('| Profile | Method | เวลา (ms) | จบเทอมที่ (1–8 = ภายใน 4 ปี) | ช้ากว่าปี 4/2 (เทอม) | คำเตือน | ลงไม่ครบ? |');
  console.log('|---|---|---:|---:|---:|---:|:---:|');

  PROFILES.forEach((profile) => {
    const options = { ...profile.options, offeringPolicy: policy };
    const greedy = timeIt(() => generatePlan(profile.completed, options));
    const g = summarize(greedy.result);
    console.log(
      `| ${profile.name} | Greedy | ${greedy.ms.toFixed(1)} | ${termIndex(g.gradTerm) + 1} | ${g.delay} | ${g.warningCount} | ${g.unresolved ? '⚠️' : '-'} |`
    );

    const runs = SEEDS.map((seed) => {
      const { result, ms } = timeIt(() => runGA(profile.completed, { ...options, seed }));
      return { ms, ...summarize(result) };
    });
    console.log(
      `| ${profile.name} | GA | ${fmt(runs.map((r) => r.ms))} | ${fmt(runs.map((r) => termIndex(r.gradTerm) + 1))} | ${fmt(runs.map((r) => r.delay))} | ${fmt(runs.map((r) => r.warningCount))} | ${runs.some((r) => r.unresolved) ? '⚠️' : '-'} |`
    );
  });
  console.log('');
});
