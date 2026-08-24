import { COURSES, COURSE_MAP } from '../data/curriculum.js';

// Build forward (prereq -> dependents) adjacency
export function buildDependentsMap() {
  const map = {};
  COURSES.forEach((c) => { map[c.code] = []; });
  COURSES.forEach((c) => {
    c.prereq.forEach((p) => {
      if (map[p]) map[p].push(c.code);
    });
  });
  return map;
}

// Topological order (Kahn's algorithm). Throws if a cycle is found (shouldn't happen).
export function topoOrder() {
  const inDegree = {};
  COURSES.forEach((c) => { inDegree[c.code] = 0; });
  COURSES.forEach((c) => {
    c.prereq.forEach((p) => {
      if (inDegree[c.code] !== undefined) inDegree[c.code] += 1;
    });
  });
  const queue = COURSES.filter((c) => inDegree[c.code] === 0).map((c) => c.code);
  const order = [];
  const dependents = buildDependentsMap();
  while (queue.length) {
    const code = queue.shift();
    order.push(code);
    (dependents[code] || []).forEach((dep) => {
      inDegree[dep] -= 1;
      if (inDegree[dep] === 0) queue.push(dep);
    });
  }
  return order;
}

// Longest path length (in # of courses) ending at each node -> critical path / depth
export function computeDepths() {
  const order = topoOrder();
  const depth = {};
  order.forEach((code) => {
    const c = COURSE_MAP[code];
    const prereqDepths = c.prereq.map((p) => (depth[p] ?? 0) + 1);
    depth[code] = prereqDepths.length ? Math.max(...prereqDepths) : 0;
  });
  return depth;
}

// Count of ALL downstream dependents (direct + transitive) for each course.
// A high count = "bottleneck" course: failing/withdrawing from it stalls many future courses.
export function computeDownstreamCounts() {
  const dependents = buildDependentsMap();
  const memo = {};
  function dfs(code, visiting) {
    if (memo[code] !== undefined) return memo[code];
    if (visiting.has(code)) return 0; // guard against accidental cycles
    visiting.add(code);
    const kids = dependents[code] || [];
    const set = new Set();
    kids.forEach((k) => {
      set.add(k);
      dfs(k, visiting).forEach; // no-op, kept for clarity
      const subKids = dfsSet(k, visiting);
      subKids.forEach((s) => set.add(s));
    });
    visiting.delete(code);
    memo[code] = set.size;
    return set.size;
  }
  function dfsSet(code, visiting) {
    if (visiting.has(code)) return new Set();
    visiting.add(code);
    const kids = dependents[code] || [];
    const set = new Set();
    kids.forEach((k) => {
      set.add(k);
      dfsSet(k, visiting).forEach((s) => set.add(s));
    });
    visiting.delete(code);
    return set;
  }
  const counts = {};
  COURSES.forEach((c) => { counts[c.code] = dfsSet(c.code, new Set()).size; });
  return counts;
}

// The "critical path" itself: the single longest prerequisite chain in the whole curriculum.
export function computeCriticalPath() {
  const depth = computeDepths();
  const order = topoOrder();
  let endCode = order[0];
  order.forEach((code) => {
    if ((depth[code] ?? 0) >= (depth[endCode] ?? 0)) endCode = code;
  });
  // walk backwards choosing the deepest prereq each time
  const path = [];
  let cur = endCode;
  while (cur) {
    path.unshift(cur);
    const c = COURSE_MAP[cur];
    if (!c.prereq.length) break;
    let best = c.prereq[0];
    c.prereq.forEach((p) => {
      if ((depth[p] ?? 0) > (depth[best] ?? 0)) best = p;
    });
    cur = best;
  }
  return path;
}

// Given a course code that a student failed/withdrew from, find every course
// that becomes blocked or delayed (its full downstream cone).
export function getImpactCone(code) {
  const dependents = buildDependentsMap();
  const visited = new Set();
  const queue = [code];
  while (queue.length) {
    const cur = queue.shift();
    (dependents[cur] || []).forEach((dep) => {
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    });
  }
  return Array.from(visited);
}

export function isBottleneck(code, threshold = 3) {
  const counts = computeDownstreamCounts();
  return (counts[code] ?? 0) >= threshold;
}
