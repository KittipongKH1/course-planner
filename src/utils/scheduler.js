import { COURSES, COURSE_MAP, termLabel } from '../data/curriculum.js';
import { computeDownstreamCounts } from './graph.js';
import { OFFICIAL_PLAN } from '../data/officialPlan.js';

export const REQUIRED_CATEGORIES = ['GenEd', 'Math/Sci', 'CoreCS', 'Project'];

// Map free hours/week (self-reported) -> max cognitive-load units allowed per term.
// This encodes the "Work-Study Balance for Gen Z" constraint from the scope doc.
export function loadBudgetFromHours(hoursPerWeek) {
  if (hoursPerWeek <= 10) return 16; // works a lot / little study time -> light load
  if (hoursPerWeek <= 20) return 22;
  if (hoursPerWeek <= 30) return 28;
  return 34; // plenty of study time
}

export const DEFAULT_OPTIONS = {
  maxCreditsPerTerm: 19,
  electiveCreditGoal: 15, // หมวดวิชาเลือกสาขาทางวิทยาการคอมพิวเตอร์ (ไม่น้อยกว่า 15 หน่วยกิต)
  hoursPerWeek: 20,
  honors: false, // เงื่อนไขเกียรตินิยม: ห้าม F/W -> ลดภาระต่อเทอมลงเพื่อลดความเสี่ยง
  startTerm: 11,
  maxTerms: 10,
  track: null,
};

export function prereqsSatisfied(course, completedSet) {
  return course.prereq.every((p) => completedSet.has(p));
}

// รายชื่อ prereq ที่ยังไม่ผ่าน — ใช้ตอน validate ก่อนให้ติ๊ก "ผ่านแล้ว" ในหน้า transcript
export function unmetPrereqs(course, completedSet) {
  return course.prereq.filter((p) => !completedSet.has(p));
}

/**
 * เลือกกลุ่มวิชาเป้าหมาย (required categories ทั้งหมด + วิชาเลือกตามสายอาชีพจนครบ electiveCreditGoal)
 * แยกออกมาเป็นฟังก์ชันกลาง เพื่อให้ทั้ง greedy scheduler (generatePlan) และ GA optimizer (server/optimizer/ga.js)
 * ใช้ตรรกะการเลือกวิชาชุดเดียวกัน ไม่ต้อง duplicate logic
 * @param {Set<string>} completedSet
 * @param {{track: string|null, electiveCreditGoal: number}} opts
 * @returns {{targetCodes: Set<string>, electiveCreditTotal: number}}
 */
export function selectTargetCourses(completedSet, opts) {
  const requiredCodes = new Set(
    COURSES.filter((c) => REQUIRED_CATEGORIES.includes(c.category)).map((c) => c.code)
  );

  const trackElectives = COURSES
    .filter((c) => c.category.startsWith('Elective') && c.tracks?.includes(opts.track))
    .sort((a, b) => a.term - b.term);

  let electiveCreditTotal = 0;
  const chosenElectives = new Set();
  for (const c of trackElectives) {
    if (electiveCreditTotal >= opts.electiveCreditGoal) break;
    chosenElectives.add(c.code);
    electiveCreditTotal += c.credits;
  }

  const targetCodes = new Set([...requiredCodes, ...chosenElectives]);
  targetCodes.forEach((code) => { if (completedSet.has(code)) targetCodes.delete(code); });

  return { targetCodes, electiveCreditTotal };
}

export function nextTerm(term) {
  const year = Math.floor(term / 10);
  const sem = term % 10;
  return sem === 1 ? year * 10 + 2 : (year + 1) * 10 + 1;
}

function scoreCourse(course, { downstreamCounts, track, retakeCodes }) {
  let score = 0;
  // 1. Critical Path priority: courses that unlock more future courses go first
  score += (downstreamCounts[course.code] ?? 0) * 10;
  // 2. Core categories outrank electives
  if (REQUIRED_CATEGORIES.includes(course.category)) score += 50;
  // 3. Career-track match bonus
  if (track && course.tracks?.includes(track)) score += 30;
  // 4. Prefer the curriculum's own recommended term (keeps plan close to the official flow)
  score += Math.max(0, 20 - Math.abs((course.term ?? 99) - 11));
  // 5. วิชาที่เคยตก/ถอน (ต้องลงใหม่) ควรได้ลงโดยเร็วที่สุดเท่าที่เป็นไปได้ — ป้องกันจบช้า
  // ยิ่งวิชานั้นมี "ตัวต่อ" (วิชาที่ต้องใช้วิชานี้เป็น prereq) มาก ยิ่งต้องรีบเคลียร์ก่อน เพราะปล่อยค้างไว้
  // จะบล็อกวิชาถัดไปเป็นวงกว้างกว่า
  if (retakeCodes?.has(course.code)) {
    score += 60 + (downstreamCounts[course.code] ?? 0) * 15;
  }
  return score;
}

/**
 * Generate a term-by-term registration plan.
 * @param {string[]} completedCodes - courses the student has already passed (mock transcript / cold-start = [])
 * @param {object} options
 */
export function generatePlan(completedCodes = [], options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const downstreamCounts = computeDownstreamCounts();
  const maxLoad = opts.honors ? Math.round(loadBudgetFromHours(opts.hoursPerWeek) * 0.85) : loadBudgetFromHours(opts.hoursPerWeek);

  const completed = new Set(completedCodes);
  const retakeCodes = new Set(opts.retakeCodes ?? []);
  const { targetCodes, electiveCreditTotal } = selectTargetCourses(completed, opts);

  const plan = [];
  const warnings = [];
  let term = opts.startTerm;
  let scheduled = new Set();
  let guard = 0;

  while (targetCodes.size > 0 && guard < opts.maxTerms) {
    guard += 1;
    const eligible = COURSES.filter(
      (c) => targetCodes.has(c.code) && prereqsSatisfied(c, completed)
    ).sort((a, b) => scoreCourse(b, { downstreamCounts, track: opts.track, retakeCodes }) - scoreCourse(a, { downstreamCounts, track: opts.track, retakeCodes }));

    const termCourses = [];
    let termCredits = 0;
    let termLoad = 0;
    for (const c of eligible) {
      const nextCredits = termCredits + c.credits;
      const nextLoad = termLoad + c.load;
      if (nextCredits > opts.maxCreditsPerTerm) continue;
      if (nextLoad > maxLoad) continue;
      termCourses.push(c);
      termCredits += c.credits;
      termLoad += c.load;
    }

    if (termCourses.length === 0) {
      // Nothing fits: either blocked by prereqs (real bottleneck) or by load budget.
      const blockedByPrereq = COURSES.some((c) => targetCodes.has(c.code) && !prereqsSatisfied(c, completed));
      warnings.push({
        term,
        type: blockedByPrereq ? 'bottleneck' : 'overload',
        message: blockedByPrereq
          ? `เทอมนี้ไม่มีวิชาที่ลงได้ เพราะยังติดวิชาบังคับก่อน (Prerequisite) — ตรวจสอบวิชาคอขวด`
          : `งบภาระการเรียน (load budget) ต่อเทอมไม่พอสำหรับวิชาที่เหลือ ลองเพิ่มชั่วโมงว่างต่อสัปดาห์`,
      });
      term = nextTerm(term);
      continue;
    }

    termCourses.forEach((c) => {
      completed.add(c.code);
      targetCodes.delete(c.code);
      scheduled.add(c.code);
    });

    plan.push({ term, courses: termCourses, credits: termCredits, load: termLoad, maxLoad });
    term = nextTerm(term);
  }

  if (targetCodes.size > 0) {
    warnings.push({
      term: null,
      type: 'unresolved',
      message: `ยังมีวิชาที่วางแผนไม่ได้ภายใน ${opts.maxTerms} เทอม: ${[...targetCodes].join(', ')}`,
    });
  }

  return { plan, warnings, electiveCreditTotal, maxLoad };
}

export function totalCreditsInPlan(plan) {
  return plan.reduce((sum, t) => sum + t.credits, 0);
}

/**
 * คำนวณ "เทอมจริง" (effective term) ของแต่ละวิชาในแผน Official เมื่อมีวิชาที่ต้อง "ลงใหม่" (retake)
 * - วิชาที่ตกเอง (อยู่ใน retakeCodes) เลื่อนไป nextTerm(เทอมทางการเดิม) เสมอ — ตรงตัวอักษร ไม่ใช่ "เทอมว่างถัดไป"
 *   แบบอิสระ
 * - วิชา "ตัวต่อ" (dependent) เลื่อนตามเป็นทอด ๆ ก็ต่อเมื่อ prereq ของมัน "ชนหรือช้ากว่า" เทอมที่มันควรจะลง
 * - วิชาที่ "ยังไม่ถึงคิว" (ไม่อยู่ใน completed, ไม่อยู่ใน retakeCodes) จะไม่ถูกบังคับเลื่อนเอง — สมมติว่านักศึกษา
 *   จะผ่านตามแผนปกติ มันจะขยับก็ต่อเมื่อ prereq ของมันเองถูกเลื่อนมาเท่านั้น (cascade แท้ ๆ ไม่ใช่การเดา)
 * - OFFICIAL_PLAN เรียงแถวเป็น topological order อยู่แล้ว (prereq ต้องอยู่แถวก่อนเสมอ) จึงเดินเป็นแถวเดียวพอ
 *   ไม่ต้องเรียก topoOrder()
 */
export function computeShiftedTerms(completedSet, retakeCodes, yearPathPreference = 'project') {
  const effTerm = {}; // code -> เทอมจริงที่จะลง (เฉพาะวิชาที่ยังไม่ผ่าน)
  const officialTerm = {}; // code -> เทอมทางการเดิมตามเอกสารหลักสูตร (ไว้เทียบตอนสร้าง warning)

  OFFICIAL_PLAN.forEach((row) => {
    const codes = row.term <= 32
      ? [...row.required, ...(yearPathPreference.startsWith('coop') ? (row.coopExtra ?? []) : [])]
      : row[yearPathPreference].required;

    codes.forEach((code) => {
      officialTerm[code] = row.term;
      if (completedSet.has(code)) return; // ผ่านแล้วจริง ไม่ต้องคำนวณ ไม่บล็อกใคร

      const course = COURSE_MAP[code];
      let eff = retakeCodes.has(code) ? nextTerm(row.term) : row.term;

      course.prereq.forEach((p) => {
        if (completedSet.has(p)) return; // prereq ผ่านแล้วจริง ไม่ดีเลย์
        const prereqEff = effTerm[p];
        if (prereqEff === undefined) return; // prereq ไม่ได้อยู่ในระบบเลื่อนอัตโนมัติ (เช่น เป็นวิชาเลือก) — ปล่อยเป็น bottleneck ตามเดิม
        if (prereqEff >= eff) eff = nextTerm(prereqEff); // prereq ไม่จบก่อนเทอมนี้ -> เลื่อนไปเทอมถัดจาก prereq
      });

      effTerm[code] = eff;
    });
  });

  return { effTerm, officialTerm };
}

/**
 * แผนอ้างอิงตามเอกสารหลักสูตร (ปี 1-4 ตรงตามตัวอย่างแผนการศึกษา)
 * วิชาบังคับ/GenEd/แกน จะถูกจัดตามปี-เทอมที่หลักสูตรกำหนดไว้เป๊ะ ๆ เสมอ
 * ส่วน "วิชาเลือกเฉพาะทาง" ในแต่ละเทอมจะเลือกเติมจากสายอาชีพที่ผู้ใช้สนใจ (ถ้ามี)
 * ถ้ายังไม่ระบุสายอาชีพ ช่องเลือกจะถูกทิ้งไว้เป็น placeholder ให้ผู้ใช้ไปเลือกเองทีหลัง
 *
 * @param {string[]} completedCodes
 * @param {object} options { track, yearPathPreference: 'project' | 'coop' }
 */
export function generateOfficialPlan(completedCodes = [], options = {}) {
  const { track = null, yearPathPreference = 'project', retakeCodes: retakeInput = [] } = options;
  const completed = new Set(completedCodes);
  const retakeCodes = new Set(retakeInput);
  const downstreamCounts = computeDownstreamCounts();

  const trackElectivePool = COURSES
    .filter((c) => c.category.startsWith('Elective') && track && c.tracks?.includes(track))
    .sort((a, b) => (downstreamCounts[b.code] ?? 0) - (downstreamCounts[a.code] ?? 0));

  const usedElectives = new Set();
  const plan = [];
  const warnings = [];
  let electiveCreditTotal = 0;

  function takeElectivesForSlot(creditBudget) {
    const picked = [];
    let remaining = creditBudget;
    for (const c of trackElectivePool) {
      if (remaining <= 0) break;
      if (usedElectives.has(c.code) || completed.has(c.code)) continue;
      if (!c.prereq.every((p) => completed.has(p))) continue; // respect prerequisite even for electives
      if (c.credits > remaining) continue;
      usedElectives.add(c.code);
      picked.push(c);
      electiveCreditTotal += c.credits;
      remaining -= c.credits;
    }
    return { picked, unfilledCredits: remaining };
  }

  // Pass 1: คำนวณเทอมจริงของทุกวิชาบังคับ/โครงงานทั้งหมดในคราวเดียว (รองรับวิชาตกที่ต้องเลื่อน + ตัวต่อที่เลื่อนตาม)
  const { effTerm, officialTerm } = computeShiftedTerms(completed, retakeCodes, yearPathPreference);

  const byTerm = {};
  Object.entries(effTerm).forEach(([code, t]) => {
    (byTerm[t] ??= []).push(code);
  });

  const officialRowByTerm = Object.fromEntries(OFFICIAL_PLAN.map((r) => [r.term, r]));
  const sortedTerms = [...new Set([...OFFICIAL_PLAN.map((r) => r.term), ...Object.keys(byTerm).map(Number)])]
    .sort((a, b) => a - b);

  // Pass 2: จัดกลุ่มวิชาตาม effective term เป็น plan[] ต่อเทอม — วิชาเลือกยังผูกกับ "เทอมทางการเดิม" ของแถวนั้น
  // เสมอ (ไม่เลื่อนตามวิชาบังคับ) เพราะไม่ได้อยู่ในสายบังคับที่ต้องเลื่อน และถ้าวิชาบังคับเลื่อนออกจากเทอมนี้ไปแล้ว
  // งบวิชาเลือกเดิมก็จะ "เติมที่ว่าง" ให้เองโดยอัตโนมัติอยู่แล้ว
  sortedTerms.forEach((term) => {
    const courses = (byTerm[term] ?? [])
      .map((code) => COURSE_MAP[code])
      .filter(Boolean)
      .sort((a, b) => (officialTerm[a.code] - officialTerm[b.code]) || a.code.localeCompare(b.code));

    courses.forEach((c) => {
      const missing = c.prereq.filter((p) => !completed.has(p));
      if (missing.length) {
        // เหลือน้อยมากหลังมีระบบเลื่อนอัตโนมัติ — เกิดเฉพาะ prereq ที่ไม่ได้อยู่ในระบบเลื่อน (เช่น เป็นวิชาเลือก)
        warnings.push({
          term,
          type: 'bottleneck',
          message: `${c.code} (${c.nameEn}) ยังไม่ผ่านวิชาก่อนหน้า: ${missing.join(', ')} — ระบบเลื่อนอัตโนมัติให้ไม่ได้ (ไม่ได้อยู่ในแผนหลักสูตรหลัก)` +
            (c.code === 'CP354785' ? ' (ต้องลงและผ่าน CP002001 ปฐมนิเทศสหกิจศึกษาในปี 3 เทอม 2)' : ''),
        });
      } else if (officialTerm[c.code] !== undefined && officialTerm[c.code] !== term) {
        const causeCodes = c.prereq.filter((p) => effTerm[p] !== undefined && effTerm[p] !== officialTerm[p]);
        warnings.push({
          term,
          type: 'shifted',
          message: retakeCodes.has(c.code)
            ? `${c.code} (${c.nameEn}) ตกในแผนเดิม — ระบบเลื่อนจาก ${termLabel(officialTerm[c.code])} ไปเป็น ${termLabel(term)} โดยอัตโนมัติ`
            : `${c.code} (${c.nameEn}) เลื่อนจาก ${termLabel(officialTerm[c.code])} ไปเป็น ${termLabel(term)} เพราะ ${causeCodes.map((p) => COURSE_MAP[p]?.nameEn ?? p).join(', ')} ถูกเลื่อน (ตัวต่อ)`,
        });
      }
    });

    const row = officialRowByTerm[term];
    if (row && row.term <= 32) {
      const { picked: electiveCourses, unfilledCredits } = takeElectivesForSlot(row.electiveCredits);
      if (unfilledCredits > 0 && row.electiveCredits > 0) {
        warnings.push({
          term,
          type: 'overload',
          message: track
            ? `หาวิชาเลือกสายอาชีพที่ตรงเงื่อนไข (prerequisite) เติมช่องว่างเทอมนี้ไม่ครบ (${unfilledCredits} หน่วยกิตยังว่าง)`
            : `ยังไม่ได้ระบุสายอาชีพ — เหลือช่องวิชาเลือก ${unfilledCredits} หน่วยกิตในเทอมนี้ให้เลือกเอง`,
        });
      }

      const allCourses = [...courses, ...electiveCourses];
      allCourses.forEach((c) => completed.add(c.code));

      plan.push({
        term,
        yearLabel: row.yearLabel,
        courses: allCourses,
        electivePlaceholderCredits: unfilledCredits > 0 ? unfilledCredits : 0,
        credits: allCourses.reduce((s, c) => s + c.credits, 0),
      });
    } else if (row) {
      // ปี 4: เลือกเส้นทาง โครงงาน หรือ สหกิจศึกษา
      const branch = row[yearPathPreference];
      courses.forEach((c) => completed.add(c.code));

      plan.push({
        term,
        yearLabel: row.yearLabel,
        courses,
        freeElectiveCredits: branch.freeElectiveCredits,
        note: branch.note,
        credits: courses.reduce((s, c) => s + c.credits, 0) + branch.freeElectiveCredits,
      });
    } else {
      // เทอมสังเคราะห์เกินแผน 4 ปีปกติ — เกิดจากวิชาที่ต้องลงใหม่เลื่อน "ตัวต่อ" จนพ้นแผนมาตรฐาน
      courses.forEach((c) => completed.add(c.code));

      plan.push({
        term,
        yearLabel: `${termLabel(term)} (แผนขยายจากความล่าช้า)`,
        courses,
        credits: courses.reduce((s, c) => s + c.credits, 0),
        note: 'เทอมที่เพิ่มขึ้นจากการเลื่อนแผนอัตโนมัติ เนื่องจากมีวิชาที่ต้องลงใหม่',
      });
    }
  });

  const overflowTerms = sortedTerms.filter((t) => !officialRowByTerm[t]);
  if (overflowTerms.length > 0) {
    warnings.unshift({
      term: overflowTerms[0],
      type: 'extended',
      message: `มีวิชาที่ต้องลงใหม่ทำให้ "ตัวต่อ" เลื่อนเกินแผน 4 ปีปกติ — ระบบขยายแผนเพิ่มเป็น ${overflowTerms.map(termLabel).join(', ')} โดยอัตโนมัติ`,
    });
  }

  // เตือนพิเศษ: ถ้าเลือก "สหกิจ-เทอมต้น" ต้องเก็บวิชาบังคับ/วิชาเลือกทั้งหมดให้ครบก่อนปี 4/1
  if (yearPathPreference === 'coop_early') {
    const unresolvedElectiveSlots = plan.filter((t) => t.term <= 32 && t.electivePlaceholderCredits > 0);
    if (unresolvedElectiveSlots.length > 0) {
      warnings.unshift({
        term: 41,
        type: 'bottleneck',
        message: 'เลือก "สหกิจ-เทอมต้น" แต่ยังมีวิชาเลือกที่ยังไม่ได้เติมครบในปี 1-3 — ต้องเก็บให้ครบก่อนถึงปี 4/1 ไม่งั้นจะไปสหกิจไม่ได้ตามกำหนด',
      });
    }
  }

  // วิชาเลือกสายอาชีพที่เหลือ (ยังไม่ถูกใส่ใน slot บังคับ) แนะนำให้ใช้แทนวิชาเลือกเสรีในปี 4 ได้ภายหลัง
  const recommendedMore = trackElectivePool.filter(
    (c) => !usedElectives.has(c.code) && !completed.has(c.code)
  );

  return { plan, warnings, electiveCreditTotal, recommendedMore };
}
