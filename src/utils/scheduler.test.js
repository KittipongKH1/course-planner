import { describe, it, expect } from 'vitest';
import { COURSES, COURSE_MAP } from '../data/curriculum.js';
import { computeDownstreamCounts } from './graph.js';
import { OFFICIAL_PLAN } from '../data/officialPlan.js';
import {
  generatePlan,
  generateOfficialPlan,
  computeShiftedTerms,
  loadBudgetFromHours,
  selectTargetCourses,
  prereqsSatisfied,
  unmetPrereqs,
  REQUIRED_CATEGORIES,
} from './scheduler.js';

describe('loadBudgetFromHours', () => {
  it('increases the budget as free hours per week increase', () => {
    expect(loadBudgetFromHours(5)).toBeLessThan(loadBudgetFromHours(15));
    expect(loadBudgetFromHours(15)).toBeLessThan(loadBudgetFromHours(25));
    expect(loadBudgetFromHours(25)).toBeLessThan(loadBudgetFromHours(40));
  });
});

describe('unmetPrereqs', () => {
  it('returns the list of prereq codes not yet completed, empty once all are done', () => {
    const course = COURSES.find((c) => c.prereq.length > 0);
    expect(unmetPrereqs(course, new Set())).toEqual(course.prereq);
    expect(unmetPrereqs(course, new Set(course.prereq))).toEqual([]);
  });
});

describe('selectTargetCourses', () => {
  it('drops courses already completed from the target pool', () => {
    const { targetCodes } = selectTargetCourses(new Set(['CP351001']), { track: null, electiveCreditGoal: 15 });
    expect(targetCodes.has('CP351001')).toBe(false);
  });

  it('only includes electives tagged with the requested track', () => {
    const { targetCodes } = selectTargetCourses(new Set(), { track: 'AI', electiveCreditGoal: 6 });
    [...targetCodes]
      .filter((code) => COURSE_MAP[code].category.startsWith('Elective'))
      .forEach((code) => expect(COURSE_MAP[code].tracks).toContain('AI'));
  });
});

describe('generatePlan (greedy baseline)', () => {
  it('never schedules a course before its prerequisites are completed', () => {
    const { plan } = generatePlan([], { track: 'FULLSTACK', hoursPerWeek: 20 });
    const completedByThen = new Set();
    plan.forEach((termPlan) => {
      termPlan.courses.forEach((c) => {
        expect(prereqsSatisfied(c, completedByThen)).toBe(true);
      });
      termPlan.courses.forEach((c) => completedByThen.add(c.code));
    });
  });

  it('never exceeds maxCreditsPerTerm or the computed load budget in any term', () => {
    const { plan, maxLoad } = generatePlan([], { track: 'DATA', hoursPerWeek: 20, maxCreditsPerTerm: 19 });
    plan.forEach((termPlan) => {
      expect(termPlan.credits).toBeLessThanOrEqual(19);
      expect(termPlan.load).toBeLessThanOrEqual(maxLoad);
    });
  });

  it('honors mode reduces the load budget compared to normal mode', () => {
    const normal = generatePlan([], { track: 'AI', hoursPerWeek: 20, honors: false });
    const honors = generatePlan([], { track: 'AI', hoursPerWeek: 20, honors: true });
    expect(honors.maxLoad).toBeLessThan(normal.maxLoad);
  });
});

describe('generatePlan — dynamic re-planning for failed/retake courses', () => {
  // จำลอง: นักศึกษาผ่านทุกวิชาถึงเทอม 21 แล้ว ยกเว้น SC401201 (Calculus 1) ที่ตก ต้องลงใหม่
  // (ตัดวิชาที่ต่อยอดจาก SC401201 ออกจาก completed ด้วย เพราะในความเป็นจริงจะยังลงไม่ได้ถ้ายังไม่ผ่าน prereq)
  const completedExceptCal1 = COURSES
    .filter((c) => (c.term ?? 99) < 21 && c.code !== 'SC401201' && c.code !== 'SC401202')
    .map((c) => c.code);

  it('reschedules the failed prerequisite and always keeps its dependent course after it (cascade delay)', () => {
    const { plan } = generatePlan(completedExceptCal1, {
      track: 'FULLSTACK',
      hoursPerWeek: 20,
      startTerm: 21,
      retakeCodes: ['SC401201'],
    });

    const cal1Index = plan.findIndex((t) => t.courses.some((c) => c.code === 'SC401201'));
    const cal2Index = plan.findIndex((t) => t.courses.some((c) => c.code === 'SC401202'));

    expect(cal1Index).toBeGreaterThanOrEqual(0);
    expect(cal2Index).toBeGreaterThan(cal1Index); // Calculus 2 ต้องมาหลัง Calculus 1 เสมอ
  });

  it('prioritizes the retake course into the very first available term via the retakeCodes bonus', () => {
    const { plan } = generatePlan(completedExceptCal1, {
      track: 'FULLSTACK',
      hoursPerWeek: 20,
      startTerm: 21,
      retakeCodes: ['SC401201'],
    });
    // SC401201 ไม่มี prereq ของตัวเอง จึงควรถูกจัดในเทอมแรกที่วางแผนได้เสมอเมื่อมี retake bonus
    expect(plan[0].courses.some((c) => c.code === 'SC401201')).toBe(true);
  });
});

describe('generatePlan — retake priority scales with downstream dependents ("ตัวต่อ")', () => {
  it('schedules a retake course with more dependents no later than a retake with none, all else equal', () => {
    const downstreamCounts = computeDownstreamCounts();
    const rootRequired = COURSES.filter(
      (c) => c.prereq.length === 0 && REQUIRED_CATEGORIES.includes(c.category)
    );
    const sortedByDeps = [...rootRequired].sort(
      (a, b) => (downstreamCounts[b.code] ?? 0) - (downstreamCounts[a.code] ?? 0)
    );
    const withDeps = sortedByDeps[0];
    const withoutDeps = rootRequired.find((c) => (downstreamCounts[c.code] ?? 0) === 0) ?? sortedByDeps.at(-1);

    expect(withDeps).toBeTruthy();
    expect(withoutDeps).toBeTruthy();
    expect(downstreamCounts[withDeps.code] ?? 0).toBeGreaterThan(downstreamCounts[withoutDeps.code] ?? 0);

    const { plan } = generatePlan([], {
      track: 'FULLSTACK',
      hoursPerWeek: 20,
      retakeCodes: [withDeps.code, withoutDeps.code],
    });

    const termOf = (code) => plan.findIndex((t) => t.courses.some((c) => c.code === code));
    const depsTerm = termOf(withDeps.code);
    const noDepsTerm = termOf(withoutDeps.code);

    expect(depsTerm).toBeGreaterThanOrEqual(0);
    expect(depsTerm).toBeLessThanOrEqual(noDepsTerm);
    if (depsTerm === noDepsTerm) {
      const order = plan[depsTerm].courses.map((c) => c.code);
      expect(order.indexOf(withDeps.code)).toBeLessThan(order.indexOf(withoutDeps.code));
    }
  });
});

describe('computeShiftedTerms', () => {
  it('bumps a retake to nextTerm of its own official term, and cascades to dependents only when they collide', () => {
    const { effTerm, officialTerm } = computeShiftedTerms(new Set(), new Set(['LI101001']));
    expect(officialTerm.LI101001).toBe(11);
    expect(effTerm.LI101001).toBe(12); // nextTerm(11)
    expect(effTerm.LI101002).toBe(21); // English II ชนกับ Eng I ที่เทอม 12 -> เลื่อนไป nextTerm(12)
  });

  it('does not shift a course whose prerequisite still finishes with enough slack before it', () => {
    // CP351001 (เทอม 11) ตก -> effTerm 12 ยังเร็วกว่า CP352001 (เทอม 21) เดิมมาก จึงไม่ต้องเลื่อน
    const { effTerm, officialTerm } = computeShiftedTerms(new Set(), new Set(['CP351001']));
    expect(effTerm.CP352001).toBe(officialTerm.CP352001);
  });
});

describe('generateOfficialPlan (no retakes) — regression baseline', () => {
  it('places every course in exactly its OFFICIAL_PLAN term when nothing is retaken', () => {
    const { plan } = generateOfficialPlan([], { yearPathPreference: 'project' });
    const termOf = {};
    plan.forEach((t) => t.courses.forEach((c) => { termOf[c.code] = t.term; }));
    OFFICIAL_PLAN.forEach((row) => {
      const codes = row.term <= 32 ? row.required : row.project.required;
      codes.forEach((code) => expect(termOf[code]).toBe(row.term));
    });
  });
});

describe('generateOfficialPlan — retake cascades into the correct later term (ตัวต่อ)', () => {
  it('เลื่อน Eng I ที่ตกไปเทอมถัดไป และเลื่อน Eng II (ตัวต่อ) ตามไปด้วย', () => {
    const { plan } = generateOfficialPlan([], { retakeCodes: ['LI101001'] });
    const termOf = (code) => plan.find((t) => t.courses.some((c) => c.code === code))?.term;
    expect(termOf('LI101001')).toBe(12); // nextTerm(11) = ปี 1 เทอม 2
    expect(termOf('LI101002')).toBe(21); // nextTerm(12) = ปี 2 เทอม 1 — ตรงตัวอย่างที่ผู้ใช้ให้มา
  });

  it('เลื่อนต่อเป็นทอด ๆ ตลอดสายโซ่ (transitive), ไม่ใช่แค่ตัวต่อชั้นแรก', () => {
    const { plan } = generateOfficialPlan([], { retakeCodes: ['LI101001'] });
    const termOf = (code) => plan.find((t) => t.courses.some((c) => c.code === code))?.term;
    expect(termOf('LI102003')).toBe(22); // English III, ตัวต่อของ English II ที่เลื่อนมา
    expect(termOf('LI102004')).toBe(31); // English IV, ตัวต่อของ English III ที่เลื่อนมา
  });

  it('ขึ้น warning แบบ "shifted" อธิบายว่าวิชาไหนเลื่อนไปเพราะอะไร', () => {
    const { warnings } = generateOfficialPlan([], { retakeCodes: ['LI101001'] });
    const shifted = warnings.filter((w) => w.type === 'shifted');
    expect(shifted.some((w) => w.message.includes('LI101001'))).toBe(true);
    expect(shifted.some((w) => w.message.includes('LI101002'))).toBe(true);
  });
});

describe('generateOfficialPlan — delay pushing past the standard 4-year plan', () => {
  it('synthesizes a term beyond 42 when a zero-slack chain (Project I -> II) is retaken', () => {
    const completedThroughYear3 = COURSES.filter((c) => (c.term ?? 99) <= 32).map((c) => c.code);
    const { plan, warnings } = generateOfficialPlan(completedThroughYear3, {
      yearPathPreference: 'project',
      retakeCodes: ['CP354771'],
    });
    const cp2 = plan.find((t) => t.courses.some((c) => c.code === 'CP354772'));
    expect(cp2.term).toBe(51);
    expect(warnings.some((w) => w.type === 'extended')).toBe(true);
  });
});
