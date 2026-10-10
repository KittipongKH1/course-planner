// ฐานความรู้ (knowledge base) สำหรับ RAG — แปลงหมวด "5. คำอธิบายรายวิชา" ใน โครงสร้างหลักสูตร.md เป็น
// เอกสาร (chunk) ละ 1 รายวิชา แล้วเติมข้อมูลเชิงโครงสร้างจาก curriculum.js (prereq, เทอมแนะนำ, สายอาชีพ, วิชาตัวต่อ)
// เพื่อให้ LLM ตอบได้ทั้งคำถามเชิงเนื้อหาวิชาและเชิงแผนการเรียน โดยอ้างอิงข้อมูลชุดเดียวกับที่ optimizer ใช้
//
// เอกสารต้นฉบับแปลงมาจาก PDF จึงมี 2 รูปแบบปนกัน (หัวข้อ markdown และตาราง HTML) รหัสวิชาบางตัวต่างจากระบบ
// (เอกสาร "SC 351 003" = ระบบ "CP351003") และสระ "ำ" แตกเป็น " า" — ตัวแปลงนี้จัดการทุกกรณีดังกล่าว
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COURSES, COURSE_MAP, TRACKS, termLabel } from '../../src/data/curriculum.js';

const CURRICULUM_DOC = fileURLToPath(new URL('../../โครงสร้างหลักสูตร.md', import.meta.url));
const SECTION_HEADING = /^## 5\. ค\s?ำ?\s?าอธิบายรายวิชา/m;
const CONDITION = /เงื่อนไขของรายวิชา\s*:?/;
const CREDITS_LINE = /^\d+\s?\(\s?\d+\s?-\s?\d+\s?-\s?\d+\s?\)$/;
const CODE = /([A-Z]{2})\s?(\d{3})\s?(\d{3})/;
const SECTION_END = /^(?:## (?:[6-9]|1[0-9])\.\s|<table><tr><td>ที่<\/td><td>ชื่อ)/m;
const TOP_SECTION = /^## (\d{1,2})\.\s+(\D.*)$/gm;
const MAX_GENERAL_DOC_CHARS = 1500;
const MIN_CHUNK_CHARS = 300;

// "ค าอธิบาย" -> "คำอธิบาย": คำไทยไม่มีทางขึ้นต้นด้วย "า" ช่องว่างหน้า "า" จึงเป็นสระอำที่แตกตอนแปลง PDF เสมอ
export function fixThaiSaraAm(text) {
  return text.replace(/([ก-ฮ][่-๋]?)\s+า/g, '$1ำ');
}

function toPlainText(markdown) {
  return fixThaiSaraAm(
    markdown
      .replace(/<\/?(table|tr)[^>]*>/g, '\n')
      .replace(/<td[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*/g, '')
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const CODE_LINE = /^[A-Z]{2}\s?\d{3}\s?\d{3}$/;
const MAX_HEADER_LINE = 150; // หัววิชา (รหัส/ชื่อ) สั้นกว่านี้เสมอ ส่วนคำอธิบายรายวิชายาวกว่า

// หัวของวิชาถัดไป (รหัส / ชื่อไทย / หน่วยกิต / ชื่ออังกฤษ) อยู่ท้ายส่วนของวิชาก่อนหน้าเสมอ — แยกออกจากคำอธิบาย
// คืน trailingCredits ด้วย เพราะตารางบางแบบวางช่องหน่วยกิตไว้ "หลัง" คำอธิบาย (ของวิชาปัจจุบัน) แล้วตามด้วยรหัสวิชาถัดไป
function splitHeaderTail(lines) {
  let start = lines.length;
  const creditIdx = lines.findLastIndex((l) => CREDITS_LINE.test(l));
  if (creditIdx !== -1 && CODE_LINE.test(lines[creditIdx + 1] ?? '')) {
    return {
      body: lines.slice(0, creditIdx),
      header: lines.slice(creditIdx + 1),
      trailingCredits: lines[creditIdx].replace(/\s/g, ''),
    };
  }
  if (creditIdx !== -1 && creditIdx >= lines.length - 3) {
    // บรรทัดก่อนหน่วยกิตเป็น "ชื่อวิชา" ก็ต่อเมื่อสั้น — ถ้ายาวคือคำอธิบายของวิชาก่อนหน้า (หัวแบบไม่มีชื่อไทย)
    start = creditIdx > 0 && lines[creditIdx - 1].length < MAX_HEADER_LINE ? creditIdx - 1 : creditIdx;
    if (start > 0 && CODE_LINE.test(lines[start - 1])) start -= 1;
  } else {
    // หัวแบบตาราง/ไม่มีหน่วยกิต: บรรทัดสั้นท้าย ๆ (คำอธิบายรายวิชาเป็นบรรทัดยาวเสมอ)
    while (start > 0 && lines[start - 1].length < MAX_HEADER_LINE && lines.length - start < 3) start -= 1;
  }
  return { body: lines.slice(0, start), header: lines.slice(start) };
}

function parseHeader(headerLines) {
  const text = headerLines.filter((l) => !CREDITS_LINE.test(l)).join(' ');
  const code = text.match(CODE);
  const credits = headerLines.find((l) => CREDITS_LINE.test(l))?.replace(/\s/g, '') ?? null;
  const nameEn = (text.match(/[A-Za-z][A-Za-z0-9&,'()\-\s/]*[A-Za-z0-9)]/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => !CODE.test(s))
    .sort((a, b) => b.length - a.length)[0] ?? '';
  const nameTh = (text.replace(CODE, '').match(/[ก-๙][ก-๙0-9\s]*[ก-๙0-9]/g) ?? [])
    .sort((a, b) => b.length - a.length)[0]?.trim() ?? '';
  return { docCode: code ? `${code[1]}${code[2]}${code[3]}` : null, nameEn, nameTh, credits };
}

const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
function jaccard(a, b) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / (A.size + B.size - inter);
}

// จับคู่หัววิชาในเอกสารกับรายวิชาในระบบ — วิธีที่เชื่อถือได้ (รหัส, ชื่อไทย) ต้องได้เลือกก่อนวิธีเดา (ชื่ออังกฤษ
// ใกล้เคียง) "ทุกรายการ" ไม่ใช่แค่ภายในรายการเดียว: เดิมจับคู่ทีละรายการตามลำดับในเอกสาร ทำให้ "Enterprise Application
// Development" (ไม่มีรหัส) แย่ง CP353204 "Web Application Development" ไปด้วยชื่ออังกฤษก่อนที่รายการรหัส
// SC 353 204 ตัวจริงจะมาถึง
const MATCHERS = [
  (e, free) => e.docCode && free.find((c) => c.code === e.docCode),
  (e, free) => e.docCode && free.find((c) => c.code.slice(2) === e.docCode.slice(2)), // SC 353 204 = CP353204
  (e, free) => {
    // ชื่อไทยในเอกสารมักยาวกว่าในระบบ (เช่น "...เชิงโครงสร้างสำหรับวิทยาการคอมพิวเตอร์") จึงเทียบแบบขึ้นต้นด้วย
    const th = e.nameTh.replace(/\s/g, '');
    if (th.length < 4) return null;
    return free.find((c) => c.nameTh.replace(/\s/g, '') === th)
      ?? free.find((c) => c.nameTh.length >= 6 && th.startsWith(c.nameTh.replace(/\s/g, '')));
  },
  (e, free) => {
    const best = free.map((c) => ({ c, score: jaccard(c.nameEn, e.nameEn) })).sort((a, b) => b.score - a.score)[0];
    return best && best.score >= 0.5 ? best.c : null;
  },
];

export function matchAll(entries) {
  const matched = new Map(); // course code -> entry
  const used = new Set(); // entry index
  MATCHERS.forEach((matcher) => {
    entries.forEach((entry, i) => {
      if (used.has(i)) return;
      const course = matcher(entry, COURSES.filter((c) => !matched.has(c.code)));
      if (!course) return;
      matched.set(course.code, entry);
      used.add(i);
    });
  });
  return { matched, unmatchedEntries: entries.filter((_, i) => !used.has(i)) };
}

export function parseCourseDescriptions(markdown) {
  const start = markdown.search(SECTION_HEADING);
  if (start === -1) throw new Error('ไม่พบหมวด "5. คำอธิบายรายวิชา" ในเอกสารหลักสูตร');
  // จบที่หัวข้อหลักถัดไป (เช่น "## 7. ...") หรือตารางรายชื่ออาจารย์ (หมวด 6 ไม่มีหัวข้อ) ไม่งั้นข้อมูลท้ายเอกสาร
  // จะไปปนกับคำอธิบายวิชาสุดท้าย
  const rest = markdown.slice(start + 1);
  const nextSection = rest.search(SECTION_END);
  const lines = toPlainText(nextSection === -1 ? rest : rest.slice(0, nextSection)).slice(1);

  // แบ่งตาม "เงื่อนไขของรายวิชา" (มีวิชาละ 1 ครั้ง) — ส่วนที่ i = prereq + คำอธิบายของวิชา i + หัวของวิชา i+1
  const segments = [[]];
  lines.forEach((line) => {
    const parts = line.split(CONDITION);
    segments[segments.length - 1].push(parts[0]);
    parts.slice(1).forEach((p) => segments.push([p]));
  });

  const entries = [];
  let header = splitHeaderTail(segments[0].filter(Boolean)).header;
  for (let i = 1; i < segments.length; i += 1) {
    const { body, header: nextHeader, trailingCredits } = i === segments.length - 1
      ? { body: segments[i], header: [] }
      : splitHeaderTail(segments[i]);
    const description = body.join(' ').replace(/^\s*:?\s*/, '').replace(/^ไม่มี\s*/, '').trim();
    const parsedHeader = parseHeader(header);
    entries.push({ ...parsedHeader, credits: parsedHeader.credits ?? trailingCredits ?? null, description });
    header = nextHeader;
  }
  return entries;
}

// หมวดอื่นของเอกสาร (โครงสร้างหลักสูตร/แผนการศึกษา, เกณฑ์การสำเร็จการศึกษา, ระยะเวลาศึกษา, ค่าธรรมเนียม, อาชีพ ฯลฯ)
// หมวดยาวแบ่งเป็นหลายชิ้นตามขอบบรรทัด — หมวด 5 (คำอธิบายรายวิชา) แยกเป็นรายวิชาแล้วจึงข้าม
export function parseGeneralSections(markdown) {
  const headings = [...markdown.matchAll(TOP_SECTION)];
  return headings.flatMap((h, i) => {
    const number = Number(h[1]);
    if (number === 5) return [];
    const end = headings[i + 1]?.index ?? markdown.length;
    const title = fixThaiSaraAm(h[2].trim());
    // หมวดใหญ่ (เช่น หมวด 3 ที่รวมโครงสร้างหลักสูตรและแผนการศึกษา) เริ่มชิ้นใหม่ที่หัวข้อย่อย (ถ้าชิ้นปัจจุบัน
    // ยาวพอแล้ว) และตั้งชื่อชิ้นตามหัวข้อย่อยนั้น — ชิ้นที่ยาวเกินจะถูกตัดต่อโดยใช้ชื่อหัวข้อย่อยเดิม
    const chunks = [];
    let current = { subtitle: title, text: '' };
    const startChunk = (subtitle) => {
      if (current.text.trim()) chunks.push(current);
      current = { subtitle, text: '' };
    };
    markdown.slice(h.index, end).split(/\r?\n/).slice(1).forEach((raw) => {
      const subheading = raw.match(/^##+\s*(.+)$/);
      if (subheading && current.text.length >= MIN_CHUNK_CHARS) startChunk(fixThaiSaraAm(subheading[1].trim()));
      toPlainText(raw).forEach((line) => {
        if (current.text && current.text.length + line.length > MAX_GENERAL_DOC_CHARS) startChunk(current.subtitle);
        current.text += `${line.slice(0, MAX_GENERAL_DOC_CHARS)}\n`;
      });
    });
    chunks.push(current);
    return chunks
      .filter((c) => c.text.trim().length > 20)
      .map((c, part) => ({ number, part: part + 1, title, subtitle: c.subtitle, body: c.text.trim() }));
  });
}

function courseLine(code) {
  const c = COURSE_MAP[code];
  return c ? `${c.code} ${c.nameTh} (${c.nameEn})` : code;
}

// เอกสาร 1 ชิ้นต่อวิชา: ข้อมูลเชิงโครงสร้างจากระบบ + คำอธิบายรายวิชาจากเอกสารหลักสูตร
function toDocument(course, parsed) {
  const dependents = COURSES.filter((c) => c.prereq.includes(course.code)).map((c) => c.code);
  const lines = [
    `รหัสวิชา: ${course.code} | ${course.nameTh} / ${course.nameEn}`,
    `หน่วยกิต: ${parsed?.credits ?? course.credits} | หมวด: ${course.category}${course.term ? ` | แผนการศึกษาแนะนำ: ${termLabel(course.term)}` : ''}`,
    `วิชาบังคับก่อน (prerequisite): ${course.prereq.length ? course.prereq.map(courseLine).join(', ') : 'ไม่มี'}`,
  ];
  if (dependents.length) lines.push(`เป็นวิชาบังคับก่อนของ: ${dependents.map(courseLine).join(', ')}`);
  if (course.tracks?.length) lines.push(`สายอาชีพที่เกี่ยวข้อง: ${course.tracks.map((t) => TRACKS[t].label).join(', ')}`);
  if (parsed?.description) lines.push(`คำอธิบายรายวิชา: ${parsed.description}`);
  return {
    id: course.code,
    code: course.code,
    nameTh: course.nameTh,
    nameEn: course.nameEn,
    inPlanner: true,
    hasDescription: Boolean(parsed?.description),
    text: lines.join('\n'),
  };
}

/**
 * @returns {{documents: object[], unmatchedCourses: string[]}}
 *   documents = วิชาในระบบทุกวิชา (มี/ไม่มีคำอธิบาย) + วิชาในเอกสารที่ไม่ได้อยู่ในระบบวางแผน (เช่น วิชาเลือกเสรี)
 */
export function buildKnowledgeBase(markdown = readFileSync(CURRICULUM_DOC, 'utf8')) {
  const { matched, unmatchedEntries } = matchAll(parseCourseDescriptions(markdown));
  const extras = unmatchedEntries.filter((e) => e.description && (e.nameEn || e.nameTh));

  const documents = COURSES.map((c) => toDocument(c, matched.get(c.code)));
  extras.forEach((e, i) => {
    const id = e.docCode ?? `DOC${i}`;
    documents.push({
      id,
      code: e.docCode,
      nameTh: e.nameTh,
      nameEn: e.nameEn,
      inPlanner: false,
      hasDescription: true,
      text: [
        `รหัสวิชา: ${e.docCode ?? '-'} | ${e.nameTh} / ${e.nameEn}`,
        `หน่วยกิต: ${e.credits ?? '-'} | (วิชาในเอกสารหลักสูตรที่ไม่ได้อยู่ในระบบวางแผน เช่น วิชาเลือกเสรี/วิชาศึกษาทั่วไปทางเลือก)`,
        `คำอธิบายรายวิชา: ${e.description}`,
      ].join('\n'),
    });
  });

  parseGeneralSections(markdown).forEach((s) => {
    documents.push({
      id: `SECTION-${s.number}-${s.part}`,
      code: null,
      nameTh: s.subtitle === s.title ? s.title : `${s.title} — ${s.subtitle}`,
      nameEn: '',
      inPlanner: false,
      hasDescription: true,
      text: `หมวด ${s.number}. ${s.title}${s.subtitle === s.title ? '' : ` — ${s.subtitle}`}\n${s.body}`,
    });
  });

  return { documents, unmatchedCourses: COURSES.filter((c) => !matched.has(c.code)).map((c) => c.code) };
}
