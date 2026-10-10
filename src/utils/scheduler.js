import { COURSES, COURSE_MAP, TRACKS, termLabel } from '../data/curriculum.js';
import { computeCurricularComplexity, computeDownstreamCounts } from './graph.js';
import { OFFICIAL_PLAN } from '../data/officialPlan.js';

export const REQUIRED_CATEGORIES = ['GenEd', 'Math/Sci', 'CoreCS', 'Project'];

export const TOTAL_DEGREE_CREDITS = 128; // ตาม โครงสร้างหลักสูตร.md
export const ON_TIME_TERM = 42; // จบตามกำหนด = ปี 4 เทอม 2

// ลำดับเทอมแบบต่อเนื่อง (11 -> 0, 12 -> 1, 21 -> 2, ...) ใช้นับระยะห่างระหว่างเทอม
export function termIndex(term) {
  return (Math.floor(term / 10) - 1) * 2 + (term % 10) - 1;
}

/**
 * สมมติฐานภาคการศึกษาที่เปิดสอน (offering constraint — Srisamutr et al., 2018 อ้างอิง [4] ในเล่ม)
 *  - every:  ทุกวิชาเปิดทุกเทอม (พฤติกรรมเดิมของระบบ — ตกแล้วลงซ้ำเทอมถัดไปได้ทันที)
 *  - annual: วิชาเปิดปีละครั้งตามเทอมในแผนหลักสูตร ยกเว้น GenEd ที่เปิดทุกเทอม — กรณีเลวร้ายกว่า
 *            ที่ตรงกับมหาวิทยาลัยส่วนใหญ่ (ตกวิชาเทอม 1 ต้องรอลงใหม่เทอม 1 ปีถัดไป)
 * วิชาไหนรู้ตารางเปิดสอนจริงแล้ว ให้ใส่ field `offered: [1, 2]` ใน curriculum.js เพื่อ override
 */
export const OFFERING_POLICIES = {
  every: 'เปิดสอนทุกเทอม',
  annual: 'เปิดสอนปีละครั้ง (ตามเทอมในแผน)',
};

export function offeredSemesters(course, policy = 'every') {
  if (course.offered) return course.offered;
  if (policy !== 'annual' || course.category === 'GenEd' || !course.term) return [1, 2];
  return [course.term % 10];
}

export function isOffered(course, term, policy = 'every') {
  return offeredSemesters(course, policy).includes(term % 10);
}

// เทอมแรกที่ >= term ที่วิชานี้เปิดสอน
export function firstOfferedTerm(course, term, policy = 'every') {
  let t = term;
  while (!isOffered(course, t, policy)) t = nextTerm(t);
  return t;
}

// งบภาระต่อเทอมตามเวลาว่าง — honors ลดลง 15% เพื่อลดความเสี่ยง F/W
export function loadBudget({ hoursPerWeek = DEFAULT_OPTIONS.hoursPerWeek, honors = false } = {}) {
  const base = loadBudgetFromHours(hoursPerWeek);
  return honors ? Math.round(base * 0.85) : base;
}

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
  tracks: [], // สายอาชีพเป้าหมาย สูงสุด MAX_TRACKS สาย (สายหลักอยู่ตัวแรก) — ยังรับ `track` เดี่ยวแบบเดิมได้
  yearPathPreference: 'project',
  offeringPolicy: 'every',
};

// วิชาปี 4 ที่ขึ้นกับเส้นทาง (โครงงาน / สหกิจ) — ดึงจาก OFFICIAL_PLAN เพื่อไม่ให้ hardcode ซ้ำ
// นักศึกษาลงแค่เส้นทางเดียว จึงต้องตัดวิชาของเส้นทางอื่นออกจากชุดเป้าหมายของ greedy/GA
function year4PathCodes(path) {
  const codes = new Set();
  OFFICIAL_PLAN.forEach((row) => {
    if (row[path]) row[path].required.forEach((c) => codes.add(c));
    if (path.startsWith('coop')) (row.coopExtra ?? []).forEach((c) => codes.add(c));
  });
  return codes;
}

const ALL_YEAR4_PATH_CODES = new Set(
  ['project', 'coop_early', 'coop_late'].flatMap((p) => [...year4PathCodes(p)])
);

export function prereqsSatisfied(course, completedSet) {
  return course.prereq.every((p) => completedSet.has(p));
}

// รายชื่อ prereq ที่ยังไม่ผ่าน — ใช้ตอน validate ก่อนให้ติ๊ก "ผ่านแล้ว" ในหน้า transcript
export function unmetPrereqs(course, completedSet) {
  return course.prereq.filter((p) => !completedSet.has(p));
}

export const MAX_TRACKS = 2;

// สายอาชีพที่เลือก (สายหลักมาก่อน) — รับได้ทั้ง `tracks: []` (ใหม่) และ `track` เดี่ยว (API/benchmark เดิม)
export function normalizeTracks(opts = {}) {
  const list = Array.isArray(opts.tracks) ? opts.tracks : opts.track ? [opts.track] : [];
  return [...new Set(list.filter((t) => TRACKS[t]))].slice(0, MAX_TRACKS);
}

const isElective = (c) => c.category.startsWith('Elective');
const byTermThenLoad = (a, b) => (a.term - b.term) || (a.load - b.load) || a.code.localeCompare(b.code);

export const ELECTIVE_SOURCES = {
  primary: 'สายหลัก',
  secondary: 'สายรอง',
  related: 'กลุ่มวิชาใกล้เคียง',
  other: 'กลุ่มวิชาอื่น',
};

/**
 * จัดลำดับวิชาเลือกสาขาตามสายอาชีพ: สายหลัก → สายรอง → กลุ่มวิชาใกล้เคียง → กลุ่มอื่น
 * "กลุ่มวิชาใกล้เคียง" = วิชาเลือกใน category เดียวกับวิชาของสายที่เลือก (เช่น Front-End อยู่กลุ่ม Media/App)
 * ใช้เติมเมื่อวิชาที่ติดป้ายสายนั้นมีหน่วยกิตไม่ถึง electiveCreditGoal — เดิมสาย FRONTEND/SECURITY/GAMEDEV/MOBILE/
 * FULLSTACK มีแค่ 6–12 หน่วยกิต แผนจึงมีวิชาเลือกไม่ครบเกณฑ์จบโดยไม่มีคำเตือน
 * @param {string[]} tracks
 * @returns {{course: object, source: keyof ELECTIVE_SOURCES}[]}
 */
export function rankElectives(tracks) {
  if (!tracks.length) return [];
  const electives = COURSES.filter(isElective);
  const ranked = [];
  const seen = new Set();
  const push = (source) => (c) => {
    if (seen.has(c.code)) return;
    seen.add(c.code);
    ranked.push({ course: c, source });
  };

  tracks.forEach((t, i) => {
    electives.filter((c) => c.tracks?.includes(t)).sort(byTermThenLoad).forEach(push(i === 0 ? 'primary' : 'secondary'));
  });
  const groups = new Set(ranked.map((r) => r.course.category));
  electives.filter((c) => groups.has(c.category)).sort(byTermThenLoad).forEach(push('related'));
  [...electives].sort(byTermThenLoad).forEach(push('other'));
  return ranked;
}

/**
 * เลือกกลุ่มวิชาเป้าหมาย (required categories ทั้งหมด + วิชาเลือกตามสายอาชีพจนครบ electiveCreditGoal)
 * แยกออกมาเป็นฟังก์ชันกลาง เพื่อให้ทั้ง greedy scheduler (generatePlan) และ GA optimizer (server/optimizer/ga.js)
 * ใช้ตรรกะการเลือกวิชาชุดเดียวกัน ไม่ต้อง duplicate logic
 * @param {Set<string>} completedSet
 * @param {{tracks?: string[], track?: string|null, electiveCreditGoal: number, yearPathPreference?: string}} opts
 * @returns {{targetCodes: Set<string>, electiveCreditTotal: number, electiveSource: Record<string, string>}}
 */
export function selectTargetCourses(completedSet, opts) {
  const pathCodes = year4PathCodes(opts.yearPathPreference ?? 'project');
  const requiredCodes = new Set(
    COURSES.filter((c) => REQUIRED_CATEGORIES.includes(c.category))
      .filter((c) => !ALL_YEAR4_PATH_CODES.has(c.code) || pathCodes.has(c.code))
      .map((c) => c.code)
  );

  let electiveCreditTotal = 0;
  const chosenElectives = new Set();
  const electiveSource = {};
  for (const { course: c, source } of rankElectives(normalizeTracks(opts))) {
    if (electiveCreditTotal >= opts.electiveCreditGoal) break;
    // วิชาเลือกที่มี prereq เป็นวิชาเลือกอีกตัว (เช่น Game Dev ← Animation) ต้องมีตัวก่อนหน้าอยู่ในแผนด้วย
    // ไม่งั้นจะวางแผนไม่ได้ตลอดไป
    const prereqOutsidePlan = c.prereq.some(
      (p) => COURSE_MAP[p] && isElective(COURSE_MAP[p]) && !chosenElectives.has(p) && !completedSet.has(p)
    );
    if (prereqOutsidePlan) continue;
    chosenElectives.add(c.code);
    electiveSource[c.code] = source;
    electiveCreditTotal += c.credits;
  }

  const targetCodes = new Set([...requiredCodes, ...chosenElectives]);
  targetCodes.forEach((code) => { if (completedSet.has(code)) targetCodes.delete(code); });

  return { targetCodes, electiveCreditTotal, electiveSource };
}

/**
 * คำเตือนเรื่องวิชาเลือกสาขา — ใช้ร่วมกันทั้ง greedy, GA และแผน Official
 * - ยังไม่เลือกสาย: แผนไม่มีวิชาเลือกสาขาเลย
 * - สายที่เลือกมีวิชาไม่พอ: บอกว่าเติมวิชาไหนจากกลุ่มใกล้เคียง (ให้นักศึกษาเห็นว่าระบบเลือกแทน)
 */
export function electiveWarnings({ tracks, electiveSource, electiveCreditTotal, electiveCreditGoal }) {
  if (electiveCreditTotal >= electiveCreditGoal && !Object.keys(electiveSource).length) return [];
  if (!tracks.length) {
    return [{
      term: null,
      type: 'overload',
      message: `ยังไม่ได้เลือกสายอาชีพ — แผนนี้ยังไม่มีวิชาเลือกสาขา (ต้องการอย่างน้อย ${electiveCreditGoal} หน่วยกิต) ไปเลือกได้ที่แท็บ "เป้าหมาย"`,
    }];
  }
  const warnings = [];
  const filled = Object.entries(electiveSource).filter(([, s]) => s === 'related' || s === 'other').map(([code]) => code);
  if (filled.length) {
    warnings.push({
      term: null,
      type: 'filled',
      message: `วิชาเลือกของ${tracks.map((t) => TRACKS[t].label).join(' + ')}มีไม่พอสำหรับช่องวิชาเลือกในแผน — ระบบเติมจากกลุ่มวิชาใกล้เคียง: ${filled.map((code) => `${code} (${COURSE_MAP[code].nameEn})`).join(', ')}`,
    });
  }
  if (electiveCreditTotal < electiveCreditGoal) {
    warnings.push({
      term: null,
      type: 'unresolved',
      message: `วิชาเลือกสาขาในแผนมี ${electiveCreditTotal}/${electiveCreditGoal} หน่วยกิต — ยังไม่ครบเกณฑ์จบ`,
    });
  }
  return warnings;
}

export function nextTerm(term) {
  const year = Math.floor(term / 10);
  const sem = term % 10;
  return sem === 1 ? year * 10 + 2 : (year + 1) * 10 + 1;
}

function scoreCourse(course, { cruciality, tracks, retakeCodes }) {
  let score = 0;
  // 1. Critical Path priority: ใช้ cruciality (blocking + delay factor, Heileman et al. 2018) แทนการนับ
  // แค่ตัวต่อ — วิชาที่อยู่บนห่วงโซ่ยาว (delay สูง) ต้องรีบลงแม้จะปลดล็อกวิชาไม่มาก ไม่งั้นจบช้า
  score += (cruciality[course.code] ?? 0) * 10;
  // 2. Core categories outrank electives
  if (REQUIRED_CATEGORIES.includes(course.category)) score += 50;
  // 3. Career-track match bonus (สายหลักได้มากกว่าสายรอง)
  if (course.tracks?.includes(tracks[0])) score += 30;
  else if (tracks[1] && course.tracks?.includes(tracks[1])) score += 20;
  // 4. Prefer the curriculum's own recommended term (keeps plan close to the official flow)
  // ลดหลั่นทีละ 5 ต่อเทอม ครอบคลุมปี 1-4 (สูตรเดิมอิงปี 1/1 ตายตัว ทำให้วิชาปี 3-4 ได้ 0 เท่ากันหมด)
  score += Math.max(0, 40 - termIndex(course.term ?? ON_TIME_TERM) * 5);
  // 5. วิชาที่เคยตก/ถอน (ต้องลงใหม่) ควรได้ลงโดยเร็วที่สุดเท่าที่เป็นไปได้ — ป้องกันจบช้า
  // ยิ่งวิชานั้นมี "ตัวต่อ" มาก ยิ่งต้องรีบเคลียร์ก่อน เพราะปล่อยค้างไว้จะบล็อกวิชาถัดไปเป็นวงกว้างกว่า
  if (retakeCodes?.has(course.code)) {
    score += 60 + (cruciality[course.code] ?? 0) * 15;
  }
  return score;
}

function crucialityMap() {
  const { byCourse } = computeCurricularComplexity();
  return Object.fromEntries(Object.entries(byCourse).map(([code, m]) => [code, m.cruciality]));
}

/**
 * Generate a term-by-term registration plan.
 * @param {string[]} completedCodes - courses the student has already passed (mock transcript / cold-start = [])
 * @param {object} options
 */
export function generatePlan(completedCodes = [], options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cruciality = crucialityMap();
  const maxLoad = loadBudget(opts);

  const completed = new Set(completedCodes);
  const retakeCodes = new Set(opts.retakeCodes ?? []);
  const tracks = normalizeTracks(opts);
  const { targetCodes, electiveCreditTotal, electiveSource } = selectTargetCourses(completed, opts);
  const scoreCtx = { cruciality, tracks, retakeCodes };

  const plan = [];
  const warnings = electiveWarnings({ tracks, electiveSource, electiveCreditTotal, electiveCreditGoal: opts.electiveCreditGoal });
  let term = opts.startTerm;
  let guard = 0;

  while (targetCodes.size > 0 && guard < opts.maxTerms) {
    guard += 1;
    const prereqReady = COURSES.filter((c) => targetCodes.has(c.code) && prereqsSatisfied(c, completed));
    const eligible = prereqReady
      .filter((c) => isOffered(c, term, opts.offeringPolicy))
      .sort((a, b) => scoreCourse(b, scoreCtx) - scoreCourse(a, scoreCtx));

    if (eligible.length === 0 && prereqReady.length > 0) {
      // มีวิชาที่ลงได้ตาม prereq แต่เทอมนี้ไม่เปิดสอน — รอเทอมถัดไป (เทอมว่างนี้นับรวมในเวลาจบ)
      term = nextTerm(term);
      continue;
    }

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
      const blockedByPrereq = eligible.length === 0;
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

  return { plan, warnings, electiveCreditTotal, electiveSource, maxLoad };
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
export function computeShiftedTerms(completedSet, retakeCodes, yearPathPreference = 'project', offeringPolicy = 'every') {
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
      // ลงซ้ำได้ในเทอมถัดไปที่วิชานี้เปิดสอน (policy 'annual' = รอปีถัดไป)
      let eff = retakeCodes.has(code) ? firstOfferedTerm(course, nextTerm(row.term), offeringPolicy) : row.term;

      course.prereq.forEach((p) => {
        if (completedSet.has(p)) return; // prereq ผ่านแล้วจริง ไม่ดีเลย์
        const prereqEff = effTerm[p];
        if (prereqEff === undefined) return; // prereq ไม่ได้อยู่ในระบบเลื่อนอัตโนมัติ (เช่น เป็นวิชาเลือก) — ปล่อยเป็น bottleneck ตามเดิม
        // prereq ไม่จบก่อนเทอมนี้ -> เลื่อนไปเทอมที่เปิดสอนถัดจาก prereq
        if (prereqEff >= eff) eff = firstOfferedTerm(course, nextTerm(prereqEff), offeringPolicy);
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
 * @param {object} options { tracks, yearPathPreference, retakeCodes, offeringPolicy, hoursPerWeek, honors }
 *   hoursPerWeek/honors ไม่เปลี่ยนแผน (แผนทางการตายตัว) แต่ใช้ตรวจว่าเทอมไหนภาระเกินงบที่นักศึกษารับได้
 */
export function generateOfficialPlan(completedCodes = [], options = {}) {
  const {
    yearPathPreference = 'project',
    retakeCodes: retakeInput = [],
    offeringPolicy = 'every',
  } = options;
  const tracks = normalizeTracks(options);
  const completed = new Set(completedCodes);
  const retakeCodes = new Set(retakeInput);
  const downstreamCounts = computeDownstreamCounts();
  const maxLoad = loadBudget(options);

  // วิชาของสายที่เลือก (หลัก/รอง) เรียงตามจำนวนตัวต่อ ตามด้วยกลุ่มใกล้เคียงไว้เติมช่องที่ยังว่าง
  const ranked = rankElectives(tracks);
  const sourceOf = Object.fromEntries(ranked.map((r) => [r.course.code, r.source]));
  const isTrackSource = (code) => sourceOf[code] === 'primary' || sourceOf[code] === 'secondary';
  const trackElectivePool = ranked.filter((r) => isTrackSource(r.course.code)).map((r) => r.course)
    .sort((a, b) => (downstreamCounts[b.code] ?? 0) - (downstreamCounts[a.code] ?? 0));
  const electivePool = [...trackElectivePool, ...ranked.filter((r) => !isTrackSource(r.course.code)).map((r) => r.course)];

  const usedElectives = new Set();
  const electiveSource = {};
  const plan = [];
  const warnings = [];
  let electiveCreditTotal = 0;

  function takeElectivesForSlot(creditBudget) {
    const picked = [];
    let remaining = creditBudget;
    for (const c of electivePool) {
      if (remaining <= 0) break;
      if (usedElectives.has(c.code) || completed.has(c.code)) continue;
      if (!c.prereq.every((p) => completed.has(p))) continue; // respect prerequisite even for electives
      if (c.credits > remaining) continue;
      usedElectives.add(c.code);
      electiveSource[c.code] = sourceOf[c.code];
      picked.push(c);
      electiveCreditTotal += c.credits;
      remaining -= c.credits;
    }
    return { picked, unfilledCredits: remaining };
  }

  // Pass 1: คำนวณเทอมจริงของทุกวิชาบังคับ/โครงงานทั้งหมดในคราวเดียว (รองรับวิชาตกที่ต้องเลื่อน + ตัวต่อที่เลื่อนตาม)
  const { effTerm, officialTerm } = computeShiftedTerms(completed, retakeCodes, yearPathPreference, offeringPolicy);

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
          message: tracks.length
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

  // แผนทางการไม่สนเวลาว่างของนักศึกษา — คำนวณภาระต่อเทอมไว้เทียบกับงบ (Work-Study Balance)
  // เพื่อชี้ให้เห็นว่าเทอมไหนหนักเกินที่รับได้ แล้วค่อยไปลองโหมด GA ที่จัดภาระให้เอง
  plan.forEach((termPlan) => {
    termPlan.load = termPlan.courses.reduce((s, c) => s + c.load, 0);
    termPlan.maxLoad = maxLoad;
    if (termPlan.load > maxLoad) {
      warnings.push({
        term: termPlan.term,
        type: 'overload',
        message: `ภาระเทอมนี้ ${termPlan.load} หน่วยโหลด เกินงบ ${maxLoad} ที่คำนวณจากเวลาว่างของคุณ — ลองโหมด GA Optimized เพื่อกระจายภาระ`,
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

  if (tracks.length) {
    warnings.unshift(...electiveWarnings({
      tracks,
      electiveSource,
      electiveCreditTotal,
      electiveCreditGoal: options.electiveCreditGoal ?? DEFAULT_OPTIONS.electiveCreditGoal,
    }));
  }

  return { plan, warnings, electiveCreditTotal, electiveSource, recommendedMore, maxLoad };
}

/**
 * พยากรณ์การจบการศึกษาจากแผนที่คำนวณได้ (ใช้ได้ทั้งแผน Official, greedy และ GA)
 * @param {{plan: {term: number, credits: number, courses: object[]}[], completedCodes: Iterable<string>,
 *   failedCodes?: Iterable<string>, startTerm: number}} args
 */
export function forecastGraduation({ plan, completedCodes, failedCodes = [], startTerm }) {
  const earnedCredits = [...completedCodes].reduce((s, code) => s + (COURSE_MAP[code]?.credits ?? 0), 0);
  const remainingCredits = Math.max(0, TOTAL_DEGREE_CREDITS - earnedCredits);
  const activeTerms = plan.filter((t) => t.term >= startTerm && (t.courses.length > 0 || t.credits > 0));
  const gradTerm = activeTerms.length ? Math.max(...activeTerms.map((t) => t.term)) : null;
  const delaySemesters = gradTerm ? Math.max(0, termIndex(gradTerm) - termIndex(ON_TIME_TERM)) : 0;
  const semestersLeftOnTime = Math.max(0, termIndex(ON_TIME_TERM) - termIndex(startTerm) + 1);
  const failedCount = [...failedCodes].length;

  return {
    gradTerm,
    onTime: delaySemesters === 0,
    delaySemesters,
    earnedCredits,
    remainingCredits,
    semestersLeftOnTime,
    // หน่วยกิตเฉลี่ยต่อเทอมที่ต้องลงเพื่อให้จบทันปี 4/2 (ใช้เทียบกับเพดาน maxCreditsPerTerm)
    creditsPerTermNeeded: semestersLeftOnTime ? Math.ceil(remainingCredits / semestersLeftOnTime) : null,
    honorsEligible: failedCount === 0,
  };
}
