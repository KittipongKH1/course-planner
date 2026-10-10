// RAG pipeline: ค้นเอกสารหลักสูตร (retriever.js) -> แนบเป็น context -> ให้ LLM ตอบโดยอ้างอิงเอกสาร
// ถ้า AI ล่ม/ไม่ได้ตั้งค่า จะ fallback เป็นการแสดงเอกสารที่เกี่ยวข้องที่สุดตรง ๆ (extractive) — ผู้ใช้ยังได้คำตอบเสมอ
// ถ้าค้นไม่เจอเอกสารที่เกี่ยวข้องเลย จะไม่เรียก LLM (กัน hallucination และประหยัด token)
import { chatJSON } from '../ai/kkuIntelSphere.js';
import { COURSE_MAP, termLabel, TRACKS } from '../../src/data/curriculum.js';
import { buildKnowledgeBase } from './knowledgeBase.js';
import { createRetriever, extractCourseCodes } from './retriever.js';

const TOP_K = 5;
const MAX_HISTORY = 4;
const RAG_TIMEOUT_MS = 30000;
const FALLBACK_DOCS = 2;
const FALLBACK_SNIPPET_CHARS = 220;
// คะแนน BM25 ต่ำกว่านี้ถือว่าไม่เกี่ยวข้อง — ชุดทดสอบ: คำถามในขอบเขตได้ ≥ 5.5, คำถามนอกเรื่องได้ ≤ 4.9
// ตั้งไว้ต่ำกว่าเส้นแบ่งนั้นมากเพื่อไม่ตัดคำถามจริงทิ้ง (ชุดทดสอบเล็ก) ส่วนคำถามนอกเรื่องที่หลุดมาให้ LLM ปฏิเสธตามกฎข้อ 5
const MIN_RELEVANCE = 3;

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยตอบคำถามเกี่ยวกับหลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ (ปรับปรุง พ.ศ. 2565)
วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น

กฎ:
1. ตอบจากข้อมูลใน <context> และ <student> เท่านั้น ห้ามเดาหรือใช้ความรู้นอกเอกสาร
2. ถ้าข้อมูลไม่พอจะตอบ ให้บอกตรง ๆ ว่าไม่พบข้อมูลในเอกสารหลักสูตร และแนะนำให้สอบถามอาจารย์ที่ปรึกษา
3. ระบุ id ของเอกสารที่ใช้ตอบในวงเล็บเหลี่ยมท้ายประโยค เช่น [CP352001]
4. ตอบเป็นภาษาไทย กระชับ ไม่เกิน 6 บรรทัด
5. คำถามที่ไม่เกี่ยวกับหลักสูตรหรือการเรียน ให้ปฏิเสธอย่างสุภาพ

ตอบเป็น JSON object เดียว: {"answer": string, "citedIds": string[]}`;

let retriever = null;
function getRetriever() {
  retriever ??= createRetriever(buildKnowledgeBase().documents);
  return retriever;
}

// คำถามต่อเนื่อง ("แล้วต้องผ่านอะไรก่อน") ไม่มีชื่อวิชาในตัว — ค้นทั้งคำถามเดี่ยวและคำถามที่รวมคำถามก่อนหน้า
// แล้วรวมผล (คะแนนสูงสุดของแต่ละเอกสาร)
function retrieve(question, history) {
  const { search } = getRetriever();
  const results = new Map();
  const add = (list) => list.forEach((r) => {
    if ((results.get(r.doc.id)?.score ?? -1) < r.score) results.set(r.doc.id, r);
  });
  add(search(question, { k: TOP_K }));
  const previous = [...history].reverse().find((m) => m.role === 'user')?.text;
  if (previous && !extractCourseCodes(question).length) add(search(`${previous} ${question}`, { k: TOP_K }));
  return [...results.values()]
    .filter((r) => r.score >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

function describeStudent({ tracks = [], plan = {} }, docs) {
  const lines = [];
  if (tracks.length) lines.push(`สายอาชีพเป้าหมาย: ${tracks.map((t) => TRACKS[t].label).join(', ')}`);
  docs.forEach(({ doc }) => {
    if (doc.code && plan[doc.code]) lines.push(`ในแผนการเรียนปัจจุบันของนักศึกษา ${doc.code} อยู่ ${termLabel(plan[doc.code])}`);
  });
  return lines.join('\n');
}

function buildUserMessage(question, history, docs, student) {
  const context = docs.map(({ doc }) => `<doc id="${doc.id}">\n${doc.text}\n</doc>`).join('\n');
  const conversation = history.map((m) => `${m.role === 'user' ? 'นักศึกษา' : 'ผู้ช่วย'}: ${m.text}`).join('\n');
  return [
    `<context>\n${context}\n</context>`,
    student ? `<student>\n${student}\n</student>` : '',
    conversation ? `<history>\n${conversation}\n</history>` : '',
    `คำถาม: ${question}`,
  ].filter(Boolean).join('\n\n');
}

// ตัดเครื่องหมายอ้างอิง เช่น "[CP353004, SECTION-3-15]" ออกจากข้อความคำตอบ — id ภายในอย่าง SECTION-3-15
// ไม่มีความหมายกับผู้ใช้ และหน้าแชทแสดงแหล่งอ้างอิงเป็นป้ายใต้คำตอบอยู่แล้ว
export function stripCitationMarkers(answer, ids) {
  return answer
    .replace(/\[([^\]]+)\]/g, (match, inner) => (inner.split(/\s*,\s*/).every((id) => ids.has(id.trim())) ? '' : match))
    .replace(/[ \t]+([.,])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function toSource({ doc, score }) {
  return { id: doc.id, code: doc.code, nameTh: doc.nameTh, nameEn: doc.nameEn, score: Number(score.toFixed(2)) };
}

function extractiveAnswer(docs) {
  const parts = docs.slice(0, FALLBACK_DOCS).map(({ doc }) => {
    const [title, ...rest] = doc.text.split('\n');
    const description = rest.find((l) => l.startsWith('คำอธิบายรายวิชา:')) ?? rest.join(' ');
    const prereq = rest.find((l) => l.startsWith('วิชาบังคับก่อน'));
    const snippet = description.length > FALLBACK_SNIPPET_CHARS ? `${description.slice(0, FALLBACK_SNIPPET_CHARS)}…` : description;
    return [`• ${title}`, prereq, snippet].filter(Boolean).join('\n  ');
  });
  return `ตอนนี้เชื่อมต่อ AI ไม่ได้ จึงแสดงข้อมูลที่ใกล้เคียงที่สุดจากเอกสารหลักสูตรแทน (ถ้าไม่ตรงคำถาม แสดงว่าเรื่องนี้อาจไม่มีในเอกสารหลักสูตร):\n${parts.join('\n')}`;
}

/**
 * @param {{question: string, history?: {role: 'user'|'bot', text: string}[], student?: {tracks?: string[], plan?: Record<string, number>}}} args
 * @returns {Promise<{answer: string, citedIds: string[], sources: object[], source: 'ai'|'fallback'|'no-match', error?: string}>}
 */
export async function answerQuestion({ question, history = [], student = {} }) {
  const recent = history.slice(-MAX_HISTORY);
  const docs = retrieve(question, recent);
  const sources = docs.map(toSource);

  if (!docs.length) {
    return {
      answer: 'ไม่พบข้อมูลที่เกี่ยวข้องในเอกสารหลักสูตร ลองถามด้วยชื่อวิชาหรือรหัสวิชา หรือสอบถามอาจารย์ที่ปรึกษาครับ',
      citedIds: [],
      sources,
      source: 'no-match',
    };
  }

  try {
    const raw = await chatJSON({
      systemPrompt: SYSTEM_PROMPT,
      userText: buildUserMessage(question, recent, docs, describeStudent(student, docs)),
      timeoutMs: RAG_TIMEOUT_MS,
    });
    // อ้างอิงได้เฉพาะเอกสารที่ส่งไปจริง — กัน LLM แต่ง id ขึ้นมาเอง
    const retrievedIds = new Set(docs.map(({ doc }) => doc.id));
    const answer = typeof raw?.answer === 'string' ? stripCitationMarkers(raw.answer, retrievedIds) : '';
    if (!answer) throw new Error('AI returned an empty answer');
    const citedIds = (Array.isArray(raw.citedIds) ? raw.citedIds : []).filter((id) => retrievedIds.has(id));
    return { answer, citedIds, sources, source: 'ai' };
  } catch (err) {
    return {
      answer: extractiveAnswer(docs),
      citedIds: docs.slice(0, FALLBACK_DOCS).map(({ doc }) => doc.id),
      sources,
      source: 'fallback',
      error: err.message,
    };
  }
}

// ตรวจ/ทำความสะอาด input จาก client — route ใช้ก่อนเรียก answerQuestion
export const LIMITS = { questionChars: 500, historyItems: 6, historyChars: 1000 };

export function sanitizeRequest(body = {}) {
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return { error: 'question (string) is required' };
  if (question.length > LIMITS.questionChars) return { error: `question must be at most ${LIMITS.questionChars} characters` };

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'bot') && typeof m.text === 'string')
    .slice(-LIMITS.historyItems)
    .map((m) => ({ role: m.role, text: m.text.slice(0, LIMITS.historyChars) }));

  const rawPlan = body.student?.plan && typeof body.student.plan === 'object' ? body.student.plan : {};
  const plan = Object.fromEntries(
    Object.entries(rawPlan).filter(([code, term]) => COURSE_MAP[code] && Number.isInteger(term) && term >= 11 && term <= 62)
  );
  const tracks = (Array.isArray(body.student?.tracks) ? body.student.tracks : []).filter((t) => TRACKS[t]).slice(0, 2);

  return { question, history, student: { tracks, plan } };
}
