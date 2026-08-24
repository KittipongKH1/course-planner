// Fetch wrapper สำหรับเรียก backend (server/index.js) — ทุกฟังก์ชัน throw เมื่อ network/HTTP error
// เพื่อให้ผู้เรียกใช้ (component) จับ error แล้ว fallback ไป local logic ได้เอง (progressive enhancement)

const BASE = '/api';

async function postJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

/** @returns {Promise<{intent: object, source: 'ai'|'fallback', error?: string}>} */
export function extractIntentRemote(text) {
  return postJSON('/intent/extract', { text });
}

/** @returns {Promise<object>} plan result shape เดียวกับ generatePlan/generateOfficialPlan/runGA */
export function generatePlanRemote({ completed, constraints, method }) {
  return postJSON('/plan/generate', { completed, constraints, method });
}

/** @returns {Promise<{records, analysis}>} */
export function saveTranscriptRemote({ studentCode, email, courseCode, status, term, constraints }) {
  return postJSON('/transcript', { studentCode, email, courseCode, status, term, constraints });
}

export async function fetchTranscriptRemote(studentCode) {
  const res = await fetch(`${BASE}/transcript/${encodeURIComponent(studentCode)}`);
  if (!res.ok) throw new Error(`transcript fetch -> HTTP ${res.status}`);
  return res.json();
}
