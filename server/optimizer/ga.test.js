import { describe, it, expect } from 'vitest';
import { COURSES, COURSE_MAP } from '../../src/data/curriculum.js';
import { prereqsSatisfied, DEFAULT_OPTIONS, selectTargetCourses, isOffered } from '../../src/utils/scheduler.js';
import { decodeChromosome, runGA, scoreFitness } from './ga.js';

function randomChromosome(codes) {
  const arr = [...codes];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

describe('decodeChromosome — hard constraints must never be violated', () => {
  const opts = { ...DEFAULT_OPTIONS, track: 'AI', hoursPerWeek: 20 };
  const { targetCodes } = selectTargetCourses(new Set(), opts);
  const genes = [...targetCodes];

  it('respects prerequisite ordering, credit cap, and load cap for 10 random chromosome orderings', () => {
    for (let trial = 0; trial < 10; trial += 1) {
      const chromosome = randomChromosome(genes);
      const { plan } = decodeChromosome(chromosome, [], opts);

      const completedByThen = new Set();
      plan.forEach((termPlan) => {
        expect(termPlan.credits).toBeLessThanOrEqual(opts.maxCreditsPerTerm);
        termPlan.courses.forEach((c) => {
          expect(prereqsSatisfied(c, completedByThen)).toBe(true);
        });
        termPlan.courses.forEach((c) => completedByThen.add(c.code));
      });
    }
  });

  it('never schedules the same course twice', () => {
    const chromosome = randomChromosome(genes);
    const { plan } = decodeChromosome(chromosome, [], opts);
    const scheduled = plan.flatMap((t) => t.courses.map((c) => c.code));
    expect(new Set(scheduled).size).toBe(scheduled.length);
  });
});

describe('runGA', () => {
  it('produces a feasible, complete plan for a simple cold-start scenario (small pop/gen for test speed)', () => {
    const result = runGA([], {
      track: 'FULLSTACK',
      hoursPerWeek: 20,
      populationSize: 20,
      generations: 20,
    });

    const unresolved = result.warnings.find((w) => w.type === 'unresolved');
    expect(unresolved).toBeUndefined();

    const completedByThen = new Set();
    result.plan.forEach((termPlan) => {
      termPlan.courses.forEach((c) => {
        expect(prereqsSatisfied(c, completedByThen)).toBe(true);
      });
      termPlan.courses.forEach((c) => completedByThen.add(c.code));
    });
  });

  it('returns an empty plan with a note when there is nothing left to schedule', () => {
    const { targetCodes } = selectTargetCourses(new Set(), { ...DEFAULT_OPTIONS, track: null, electiveCreditGoal: 0 });
    // simulate a student who already completed every required course, no track electives
    const allRequired = [...targetCodes].filter((code) => COURSE_MAP[code]);
    const result = runGA(allRequired, { track: null, electiveCreditGoal: 0, populationSize: 10, generations: 5 });
    expect(result.plan).toEqual([]);
  });
});

describe('runGA — dynamic re-planning for failed/retake courses', () => {
  // จำลอง: นักศึกษาผ่านทุกวิชาถึงเทอม 21 แล้ว ยกเว้น SC401201 (Calculus 1) ที่ตก ต้องลงใหม่
  // (ตัด SC401202 ออกจาก completed ด้วย เพราะจริง ๆ แล้วลงไม่ได้ถ้ายังไม่ผ่าน prereq)
  const completedExceptCal1 = COURSES
    .filter((c) => (c.term ?? 99) < 21 && c.code !== 'SC401201' && c.code !== 'SC401202')
    .map((c) => c.code);

  it('always keeps SC401202 (Calculus 2) after SC401201 (Calculus 1) and prioritizes the retake into the first term', () => {
    const result = runGA(completedExceptCal1, {
      track: 'FULLSTACK',
      hoursPerWeek: 20,
      startTerm: 21,
      retakeCodes: ['SC401201'],
      populationSize: 30,
      generations: 40,
    });

    const cal1Index = result.plan.findIndex((t) => t.courses.some((c) => c.code === 'SC401201'));
    const cal2Index = result.plan.findIndex((t) => t.courses.some((c) => c.code === 'SC401202'));

    expect(cal1Index).toBeGreaterThanOrEqual(0);
    expect(cal2Index).toBeGreaterThan(cal1Index);
    expect(cal1Index).toBe(0); // ไม่มี prereq ของตัวเอง + มี retake bonus -> ควรได้เทอมแรกเสมอ
  });
});

describe('GA — offering constraint, gap terms and reproducibility', () => {
  it('decoder never places a course in a semester it is not offered (annual policy)', () => {
    const opts = { ...DEFAULT_OPTIONS, track: 'DEVOPS', hoursPerWeek: 20, offeringPolicy: 'annual' };
    const genes = [...selectTargetCourses(new Set(), opts).targetCodes];
    for (let trial = 0; trial < 5; trial += 1) {
      const { plan } = decodeChromosome(randomChromosome(genes), [], opts);
      plan.forEach((t) => t.courses.forEach((c) => expect(isOffered(c, t.term, 'annual')).toBe(true)));
    }
  });

  it('scoreFitness counts empty waiting semesters toward time-to-degree', () => {
    const course = { code: 'X', load: 2 };
    const opts = { startTerm: 11 };
    const contiguous = { plan: [{ term: 11, courses: [course], load: 2 }, { term: 12, courses: [course], load: 2 }], relaxations: 0 };
    const withGap = { plan: [{ term: 11, courses: [course], load: 2 }, { term: 21, courses: [course], load: 2 }], relaxations: 0 };
    expect(scoreFitness(contiguous, opts, 2)).toBeGreaterThan(scoreFitness(withGap, opts, 2));
  });

  it('same seed -> identical plan', () => {
    const run = () => runGA([], { track: 'AI', populationSize: 15, generations: 10, seed: 42 });
    const codes = (r) => r.plan.map((t) => t.courses.map((c) => c.code).join(','));
    expect(codes(run())).toEqual(codes(run()));
  });

  it('never schedules both the project and the co-op path', () => {
    const result = runGA([], { track: 'FULLSTACK', yearPathPreference: 'project', populationSize: 10, generations: 5, seed: 1 });
    const scheduled = new Set(result.plan.flatMap((t) => t.courses.map((c) => c.code)));
    expect(scheduled.has('CP354772')).toBe(true);
    expect(scheduled.has('CP354785')).toBe(false);
  });
});

describe('scoreFitness — retake bonus scales with downstream dependent count', () => {
  it('rewards retaking a course with more dependents more than one with none, all else equal', () => {
    const opts = { retakeCodes: new Set(['X']) };
    const decoded = { plan: [{ term: 21, courses: [{ code: 'X' }], credits: 3, load: 3 }], relaxations: 0 };

    const scoreHighDeps = scoreFitness(decoded, opts, 1, { X: 6 });
    const scoreNoDeps = scoreFitness(decoded, opts, 1, { X: 0 });

    expect(scoreHighDeps).toBeGreaterThan(scoreNoDeps);
  });

  it('matches the original (pre-weighting) score when downstreamCounts is omitted or the course has no dependents', () => {
    const opts = { retakeCodes: new Set(['X']) };
    const decoded = { plan: [{ term: 21, courses: [{ code: 'X' }], credits: 3, load: 3 }], relaxations: 0 };

    const scoreNoArg = scoreFitness(decoded, opts, 1);
    const scoreZeroDeps = scoreFitness(decoded, opts, 1, { X: 0 });

    expect(scoreNoArg).toBe(scoreZeroDeps);
  });
});
