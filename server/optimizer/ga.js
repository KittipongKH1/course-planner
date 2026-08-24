// Genetic Algorithm scheduling optimizer — แทนที่ greedy heuristic เดิมด้วย metaheuristic จริง
// ตามที่ scopeAdvisor.md ระบุว่าต้อง explore GA/ASP/ILP (เริ่มด้วย GA ก่อนตามที่ตกลงกันไว้)
//
// นิยามปัญหา (ดูรายละเอียดเต็มใน docs/optimization-model.md):
//   ตัวแปรตัดสินใจ x[c][t] ∈ {0,1} — ลงวิชา c ในเทอม t หรือไม่
//   Hard constraints: prerequisite ordering, credit cap/เทอม, cognitive-load cap/เทอม
//   Objective: minimize จำนวนเทอม + สมดุลภาระต่อเทอม + (ถ้า gradSchool) ให้น้ำหนักวิชาทฤษฎี/วิจัยมากขึ้น
//
// การออกแบบ chromosome: ใช้ "priority ordering" (permutation ของรหัสวิชา) แทนที่จะ encode
// เทอมตรง ๆ — ตัว decoder (decodeChromosome) จะเดินตามลำดับนี้แล้ววางวิชาลงเทอมแรกที่ไม่ละเมิด
// hard constraint เสมอ ผลลัพธ์ที่ decode ออกมาจึง "ไม่มีทางละเมิด prerequisite/credit-cap/load-cap"
// ไม่ว่า chromosome จะเป็นลำดับอะไรก็ตาม — GA จึงค้นหาแค่ "ลำดับที่ดีที่สุด" ไม่ต้อง repair solution
import { COURSES } from '../../src/data/curriculum.js';
import { computeDownstreamCounts } from '../../src/utils/graph.js';
import {
  DEFAULT_OPTIONS,
  loadBudgetFromHours,
  nextTerm,
  prereqsSatisfied,
  selectTargetCourses,
} from '../../src/utils/scheduler.js';

const COURSE_MAP = Object.fromEntries(COURSES.map((c) => [c.code, c]));
const MAX_LOAD_RELAXATIONS = 6;

/**
 * ถอดรหัส chromosome (ลำดับความสำคัญของวิชา) ให้เป็นแผนเทอมต่อเทอมที่เป็นไปได้จริงเสมอ
 * ถ้าเจองบภาระ (load budget) ไม่พอ จะ "ผ่อน" (relax) ทีละขั้นก่อนยอมแพ้ (ปิดช่องว่างเรื่อง
 * fallback/constraint relaxation ที่อาจารย์ถามไว้ใน scopeAdvisor.md)
 */
export function decodeChromosome(chromosome, completedCodes, opts) {
  const completed = new Set(completedCodes);
  const remaining = new Set(chromosome);
  const baseLoad = loadBudgetFromHours(opts.hoursPerWeek);
  let maxLoad = opts.honors ? Math.round(baseLoad * 0.85) : baseLoad;

  const plan = [];
  const warnings = [];
  let term = opts.startTerm;
  let guard = 0;
  let relaxations = 0;
  const hardCap = opts.maxTerms + MAX_LOAD_RELAXATIONS + 10;

  while (remaining.size > 0 && guard < hardCap) {
    guard += 1;
    const eligible = chromosome.filter(
      (code) => remaining.has(code) && prereqsSatisfied(COURSE_MAP[code], completed)
    );

    const termCourses = [];
    let termCredits = 0;
    let termLoad = 0;
    for (const code of eligible) {
      const c = COURSE_MAP[code];
      const nextCredits = termCredits + c.credits;
      const nextLoad = termLoad + c.load;
      if (nextCredits > opts.maxCreditsPerTerm) continue;
      if (nextLoad > maxLoad) continue;
      termCourses.push(c);
      termCredits += c.credits;
      termLoad += c.load;
    }

    if (termCourses.length === 0) {
      const blockedByPrereq = [...remaining].some(
        (code) => !prereqsSatisfied(COURSE_MAP[code], completed)
      );
      if (!blockedByPrereq && relaxations < MAX_LOAD_RELAXATIONS) {
        maxLoad += 2;
        relaxations += 1;
        warnings.push({
          term,
          type: 'overload',
          message: `ผ่อนงบภาระการเรียนต่อเทอมเป็น ${maxLoad} หน่วยโหลด เพื่อให้แผนหาคำตอบได้ (relax ครั้งที่ ${relaxations}/${MAX_LOAD_RELAXATIONS})`,
        });
        continue; // ลองเทอมเดิมซ้ำด้วยงบที่ผ่อนแล้ว
      }
      warnings.push({
        term,
        type: blockedByPrereq ? 'bottleneck' : 'overload',
        message: blockedByPrereq
          ? 'เทอมนี้ไม่มีวิชาที่ลงได้ เพราะยังติดวิชาบังคับก่อน (Prerequisite) — ตรวจสอบวิชาคอขวด'
          : 'งบภาระการเรียนต่อเทอมไม่พอสำหรับวิชาที่เหลือ แม้ผ่อนจนสุดขีดจำกัดแล้ว',
      });
      term = nextTerm(term);
      continue;
    }

    termCourses.forEach((c) => {
      completed.add(c.code);
      remaining.delete(c.code);
    });

    plan.push({ term, courses: termCourses, credits: termCredits, load: termLoad, maxLoad });
    term = nextTerm(term);
  }

  if (remaining.size > 0) {
    warnings.push({
      term: null,
      type: 'unresolved',
      message: `ยังมีวิชาที่วางแผนไม่ได้: ${[...remaining].join(', ')}`,
    });
  }

  return { plan, warnings, maxLoad, relaxations };
}

export function scoreFitness(decoded, opts, targetCount, downstreamCounts) {
  const { plan, relaxations } = decoded;
  const scheduledCount = plan.reduce((s, t) => s + t.courses.length, 0);
  const unresolved = Math.max(0, targetCount - scheduledCount);
  const termsUsed = plan.length || 1;

  const loads = plan.map((t) => t.load);
  const meanLoad = loads.reduce((s, l) => s + l, 0) / (loads.length || 1);
  const variance = loads.reduce((s, l) => s + (l - meanLoad) ** 2, 0) / (loads.length || 1);

  let score = 0;
  score -= termsUsed * 12; // จำนวนเทอมน้อยกว่า = ดีกว่า (ตรง Critical Path objective)
  score -= unresolved * 500; // ลงวิชาไม่ครบ = แย่มาก
  score -= relaxations * 15; // ต้องผ่อน load budget = แย่กว่าทำได้ในงบปกติ
  score -= variance * 4; // ภาระไม่สมดุลระหว่างเทอม = แย่ (Work-Study Balance)

  if (opts.gradSchool) {
    let bonus = 0;
    plan.forEach((termPlan, idx) => {
      termPlan.courses.forEach((c) => {
        if (c.theoretical) bonus += Math.max(0, termsUsed - idx); // ยิ่งเรียนเร็วยิ่งได้โบนัสเยอะ
      });
    });
    score += bonus * 2;
  }

  // วิชาที่เคยตก/ถอน (retakeCodes) ควรถูกจัดให้เร็วที่สุด — น้ำหนักสูงกว่า gradSchool bonus
  // เพราะการปล่อยให้ค้างนานกระทบเวลาจบโดยตรง (ตรงกับ Dynamic Re-planning ใน scopeAdvisor.md)
  // ยิ่งวิชานั้นมีตัวต่อ (downstream dependents) มาก ยิ่งได้น้ำหนักสูงกว่า — ไม่ใช่แค่ "เร็วเท่าไหร่"
  // แต่ "เร็วแค่ไหน x กระทบกว้างแค่ไหน" ถึงจะสะท้อน priority ที่ถูกต้อง
  if (opts.retakeCodes?.size) {
    let retakeBonus = 0;
    plan.forEach((termPlan, idx) => {
      termPlan.courses.forEach((c) => {
        if (opts.retakeCodes.has(c.code)) {
          const dependentWeight = 1 + (downstreamCounts?.[c.code] ?? 0) * 0.5;
          retakeBonus += Math.max(0, termsUsed - idx) * dependentWeight;
        }
      });
    });
    score += retakeBonus * 3;
  }

  return score;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Order Crossover (OX) — มาตรฐานสำหรับ permutation-based GA (รักษาความเป็น permutation ของลูก)
function orderCrossover(p1, p2) {
  const len = p1.length;
  const a = Math.floor(Math.random() * len);
  const b = Math.floor(Math.random() * len);
  const [start, end] = a < b ? [a, b] : [b, a];

  const child = new Array(len).fill(null);
  for (let i = start; i <= end; i += 1) child[i] = p1[i];

  const filled = new Set(child.filter(Boolean));
  let ptr = 0;
  for (let i = 0; i < len; i += 1) {
    if (child[i]) continue;
    while (filled.has(p2[ptr])) ptr += 1;
    child[i] = p2[ptr];
    filled.add(p2[ptr]);
  }
  return child;
}

function swapMutate(chromosome) {
  const c = [...chromosome];
  const i = Math.floor(Math.random() * c.length);
  const j = Math.floor(Math.random() * c.length);
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

/**
 * รัน Genetic Algorithm เพื่อหาแผนการเรียนที่ดีที่สุด (เทียบเท่า/ดีกว่า greedy baseline เดิม)
 * @param {string[]} completedCodes
 * @param {object} options — ใช้ shape เดียวกับ generatePlan/generateOfficialPlan เดิม
 *   บวก populationSize, generations, mutationRate (optional, มีค่า default)
 */
export function runGA(completedCodes = [], options = {}) {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    populationSize: options.populationSize ?? 60,
    generations: options.generations ?? 150,
    mutationRate: options.mutationRate ?? 0.15,
    retakeCodes: new Set(options.retakeCodes ?? []),
  };

  const completedSet = new Set(completedCodes);
  const { targetCodes, electiveCreditTotal } = selectTargetCourses(completedSet, opts);
  const genes = [...targetCodes];

  if (genes.length === 0) {
    return {
      plan: [],
      warnings: [],
      electiveCreditTotal,
      maxLoad: loadBudgetFromHours(opts.hoursPerWeek),
      meta: { method: 'ga', generations: 0, note: 'ไม่มีวิชาเหลือให้วางแผน (เรียนครบแล้ว)' },
    };
  }

  const downstreamCounts = computeDownstreamCounts();
  // seed แรกให้ความสำคัญกับวิชาที่ต้องลงใหม่ก่อนเสมอ ก่อนจะเรียงตาม downstream count เหมือนเดิม
  const greedySeed = [...genes].sort((a, b) => {
    const retakeDiff = (opts.retakeCodes.has(b) ? 1 : 0) - (opts.retakeCodes.has(a) ? 1 : 0);
    if (retakeDiff !== 0) return retakeDiff;
    return (downstreamCounts[b] ?? 0) - (downstreamCounts[a] ?? 0);
  });

  let population = [greedySeed, ...Array.from({ length: opts.populationSize - 1 }, () => shuffle([...genes]))];

  let best = null;
  let bestScore = -Infinity;
  const fitnessHistory = [];

  for (let gen = 0; gen < opts.generations; gen += 1) {
    const scored = population.map((chromo) => {
      const decoded = decodeChromosome(chromo, completedCodes, opts);
      const score = scoreFitness(decoded, opts, genes.length, downstreamCounts);
      return { chromo, decoded, score };
    });
    scored.sort((a, b) => b.score - a.score);

    if (scored[0].score > bestScore) {
      bestScore = scored[0].score;
      best = scored[0];
    }
    fitnessHistory.push(scored[0].score);

    const elites = scored.slice(0, 4).map((s) => s.chromo);
    const parents = scored.slice(0, Math.ceil(scored.length / 2)).map((s) => s.chromo);

    const nextPop = [...elites];
    while (nextPop.length < opts.populationSize) {
      const p1 = parents[Math.floor(Math.random() * parents.length)];
      const p2 = parents[Math.floor(Math.random() * parents.length)];
      let child = orderCrossover(p1, p2);
      if (Math.random() < opts.mutationRate) child = swapMutate(child);
      nextPop.push(child);
    }
    population = nextPop;
  }

  return {
    plan: best.decoded.plan,
    warnings: best.decoded.warnings,
    electiveCreditTotal,
    maxLoad: best.decoded.maxLoad,
    meta: {
      method: 'ga',
      generations: opts.generations,
      populationSize: opts.populationSize,
      bestScore,
      relaxations: best.decoded.relaxations,
    },
  };
}
