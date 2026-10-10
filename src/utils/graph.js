import { COURSES, COURSE_MAP } from '../data/curriculum.js';

// กราฟหลักสูตรเป็นข้อมูลคงที่ (COURSES ไม่เปลี่ยนระหว่างรัน) จึง cache ผลคำนวณระดับ module ไว้
// ไม่ต้องคำนวณใหม่ทุกครั้งที่ scheduler/GA/fallback เรียก
const cache = {};
function memo(key, fn) {
  if (!(key in cache)) cache[key] = fn();
  return cache[key];
}

// Build forward (prereq -> dependents) adjacency
export function buildDependentsMap() {
  return memo('dependents', () => {
    const map = {};
    COURSES.forEach((c) => { map[c.code] = []; });
    COURSES.forEach((c) => {
      c.prereq.forEach((p) => {
        if (map[p]) map[p].push(c.code);
      });
    });
    return map;
  });
}

// Topological order (Kahn's algorithm). Throws if a cycle is found (shouldn't happen).
export function topoOrder() {
  return memo('topo', () => {
    const inDegree = {};
    COURSES.forEach((c) => { inDegree[c.code] = c.prereq.filter((p) => COURSE_MAP[p]).length; });
    const queue = COURSES.filter((c) => inDegree[c.code] === 0).map((c) => c.code);
    const order = [];
    const dependents = buildDependentsMap();
    while (queue.length) {
      const code = queue.shift();
      order.push(code);
      dependents[code].forEach((dep) => {
        inDegree[dep] -= 1;
        if (inDegree[dep] === 0) queue.push(dep);
      });
    }
    if (order.length !== COURSES.length) throw new Error('Curriculum graph has a prerequisite cycle');
    return order;
  });
}

// Longest path length (in # of edges) ending at each node -> critical path / depth
export function computeDepths() {
  return memo('depths', () => {
    const depth = {};
    topoOrder().forEach((code) => {
      const prereqDepths = COURSE_MAP[code].prereq.map((p) => (depth[p] ?? 0) + 1);
      depth[code] = prereqDepths.length ? Math.max(...prereqDepths) : 0;
    });
    return depth;
  });
}

// Longest path length (in # of edges) starting at each node — ใช้คู่กับ computeDepths เพื่อหา delay factor
export function computeHeights() {
  return memo('heights', () => {
    const dependents = buildDependentsMap();
    const height = {};
    [...topoOrder()].reverse().forEach((code) => {
      const kidHeights = dependents[code].map((k) => height[k] + 1);
      height[code] = kidHeights.length ? Math.max(...kidHeights) : 0;
    });
    return height;
  });
}

// Count of ALL downstream dependents (direct + transitive) for each course.
// A high count = "bottleneck" course: failing/withdrawing from it stalls many future courses.
// = "Blocking factor" ใน Curricular Analytics ของ Heileman et al. (2018)
export function computeDownstreamCounts() {
  return memo('downstream', () => {
    const counts = {};
    COURSES.forEach((c) => { counts[c.code] = getImpactCone(c.code).length; });
    return counts;
  });
}

/**
 * ตัวชี้วัดความซับซ้อนเชิงโครงสร้างของหลักสูตร ตาม Heileman, Abdallah, Slim & Hickman (2018)
 * "Curricular Analytics: A Framework for Quantifying the Impact of Curricular Reforms and
 * Pedagogical Innovations" (อ้างอิง [2] ในเล่ม progress1.md)
 *  - blocking factor b(v) = จำนวนวิชาที่ลงไม่ได้ถ้าไม่ผ่าน v (วิชาที่ reach ได้จาก v)
 *  - delay factor   d(v) = จำนวนวิชาบน path ที่ยาวที่สุดที่ผ่าน v — ถ้าตก v เส้นทางนี้จะเลื่อนทั้งเส้น
 *  - cruciality     c(v) = b(v) + d(v)
 *  - structural complexity ของหลักสูตร = Σ c(v)
 * @returns {{byCourse: Record<string, {blocking: number, delay: number, cruciality: number}>, structuralComplexity: number}}
 */
export function computeCurricularComplexity() {
  return memo('complexity', () => {
    const depth = computeDepths();
    const height = computeHeights();
    const blocking = computeDownstreamCounts();
    const byCourse = {};
    let structuralComplexity = 0;
    COURSES.forEach(({ code }) => {
      const delay = depth[code] + height[code] + 1;
      const cruciality = blocking[code] + delay;
      byCourse[code] = { blocking: blocking[code], delay, cruciality };
      structuralComplexity += cruciality;
    });
    return { byCourse, structuralComplexity };
  });
}

// The "critical path" itself: the single longest prerequisite chain in the whole curriculum.
export function computeCriticalPath() {
  return memo('criticalPath', () => {
    const depth = computeDepths();
    const order = topoOrder();
    let endCode = order[0];
    order.forEach((code) => {
      if (depth[code] >= depth[endCode]) endCode = code;
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
  });
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
  return (computeDownstreamCounts()[code] ?? 0) >= threshold;
}
