// Retriever ของ RAG — BM25 (Robertson & Zaragoza, 2009) บนคำที่ตัดด้วย Intl.Segmenter
// ภาษาไทยไม่มีช่องว่างระหว่างคำ จึงต้องตัดคำก่อนทำ index — Intl.Segmenter มากับ Node (ICU) ไม่ต้องติดตั้งเพิ่ม
// เลือก BM25 แทน vector search เพราะไม่ต้องพึ่ง embedding API (ทำงานได้แม้ AI ล่ม) และเอกสารชุดนี้เล็ก (~100 ชิ้น)
import { fixThaiSaraAm } from './knowledgeBase.js';

const K1 = 1.5;
const B = 0.75;
const NAME_BOOST = 3; // ชื่อวิชาสำคัญกว่าคำในคำอธิบาย — ใส่ชื่อซ้ำใน index เท่ากับเพิ่มน้ำหนัก
const CODE_MATCH_BONUS = 100; // ถามด้วยรหัสวิชาตรง ๆ ต้องได้วิชานั้นอันดับ 1 เสมอ

// คำถาม/คำลงท้ายที่พบในทุกคำถาม ไม่ช่วยแยกเอกสาร
const STOPWORDS = new Set([
  'อะไร', 'ไหม', 'มั้ย', 'ยังไง', 'อย่างไร', 'บ้าง', 'ครับ', 'ค่ะ', 'คะ', 'นะ', 'หน่อย', 'คือ', 'ที่', 'และ', 'หรือ',
  'ของ', 'ใน', 'ได้', 'จะ', 'ก็', 'ให้', 'ว่า', 'กับ', 'นี้', 'นั้น', 'เป็น', 'มี', 'the', 'of', 'and', 'to', 'in', 'a',
  'for', 'is', 'what', 'how',
]);

const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

// รหัสวิชาเขียนได้หลายแบบ ("CP 353 102", "cp353102", "353102") — แปลงเป็นทั้งรหัสเต็มและเลข 6 หลัก
// เลข 6 หลักทำให้ "SC 353 102" ในเอกสารเก่าจับคู่กับ "CP353102" ในระบบได้
const CODE_PATTERN = /\b([A-Za-z]{2})\s?(\d{3})\s?(\d{3})\b/g;

export function extractCourseCodes(text) {
  return [...text.matchAll(CODE_PATTERN)].map((m) => `${m[1]}${m[2]}${m[3]}`.toUpperCase());
}

export function tokenize(text) {
  const normalized = fixThaiSaraAm(text.normalize('NFC'))
    .replace(CODE_PATTERN, (_, p, a, b) => ` ${p}${a}${b} ${a}${b} `)
    .toLowerCase();
  const tokens = [];
  for (const { segment, isWordLike } of segmenter.segment(normalized)) {
    if (!isWordLike) continue;
    const t = segment.trim();
    if (t && !STOPWORDS.has(t)) tokens.push(t);
  }
  return tokens;
}

// หมายเหตุ: เคยลองตัดป้ายชื่อช่อง ("วิชาบังคับก่อน:", "สายอาชีพที่เกี่ยวข้อง:") ออกจาก index แล้วผลแย่ลง
// (Hit@1 66.7% -> 63.3%) เพราะป้ายอย่าง "วิชาบังคับก่อน" ช่วยคำถามเรื่อง prerequisite จึงคง index ทั้งข้อความไว้
export function createRetriever(documents) {
  const indexed = documents.map((doc) => {
    const name = `${doc.code ?? ''} ${doc.nameTh} ${doc.nameEn}`;
    const tokens = [...tokenize(doc.text), ...Array(NAME_BOOST).fill(tokenize(name)).flat()];
    const tf = new Map();
    tokens.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    return { doc, tf, length: tokens.length };
  });

  const avgLength = indexed.reduce((s, d) => s + d.length, 0) / indexed.length;
  const df = new Map();
  indexed.forEach(({ tf }) => tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const idf = (t) => Math.log(1 + (indexed.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

  /**
   * @param {string} query
   * @param {{k?: number}} [options]
   * @returns {{doc: object, score: number}[]} เรียงคะแนนมากไปน้อย เฉพาะเอกสารที่มีคำตรงอย่างน้อย 1 คำ
   */
  function search(query, { k = 5 } = {}) {
    const terms = [...new Set(tokenize(query))];
    const codes = extractCourseCodes(query);
    return indexed
      .map(({ doc, tf, length }) => {
        let score = 0;
        terms.forEach((t) => {
          const f = tf.get(t);
          if (!f) return;
          score += idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * length) / avgLength)));
        });
        if (doc.code && codes.some((c) => c === doc.code || c.slice(2) === doc.code.slice(2))) score += CODE_MATCH_BONUS;
        return { doc, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  return { search, size: indexed.length };
}
