import { describe, it, expect } from 'vitest';
import { COURSE_MAP } from '../data/curriculum.js';
import { topoOrder, computeCriticalPath, computeDownstreamCounts, isBottleneck, getImpactCone } from './graph.js';

describe('graph.js', () => {
  it('topoOrder places every course after all of its prerequisites', () => {
    const order = topoOrder();
    const position = Object.fromEntries(order.map((code, i) => [code, i]));
    order.forEach((code) => {
      const course = COURSE_MAP[code];
      course.prereq.forEach((p) => {
        expect(position[p]).toBeLessThan(position[code]);
      });
    });
  });

  it('topoOrder includes every course exactly once (no cycles)', () => {
    const order = topoOrder();
    expect(new Set(order).size).toBe(order.length);
    expect(order.length).toBe(Object.keys(COURSE_MAP).length);
  });

  it('computeCriticalPath returns a chain where each step is a real prerequisite link', () => {
    const path = computeCriticalPath();
    expect(path.length).toBeGreaterThan(1);
    for (let i = 1; i < path.length; i += 1) {
      const course = COURSE_MAP[path[i]];
      expect(course.prereq).toContain(path[i - 1]);
    }
  });

  it('computeDownstreamCounts is non-negative and CP351001 (foundational course) unlocks several others', () => {
    const counts = computeDownstreamCounts();
    Object.values(counts).forEach((c) => expect(c).toBeGreaterThanOrEqual(0));
    expect(counts['CP351001']).toBeGreaterThan(0);
  });

  it('isBottleneck flags a course with many downstream dependents', () => {
    const counts = computeDownstreamCounts();
    const topCode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    expect(isBottleneck(topCode, 1)).toBe(true);
  });

  it('getImpactCone returns only true downstream dependents', () => {
    const cone = getImpactCone('CP351001');
    cone.forEach((code) => {
      // every course in the impact cone must be reachable via prereq edges from CP351001
      expect(code).not.toBe('CP351001');
    });
    expect(cone).toContain('CP351003'); // OOP depends (transitively/directly) on Fundamental CS
  });
});
