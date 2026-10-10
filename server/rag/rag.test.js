import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { COURSES } from '../../src/data/curriculum.js';
import { buildKnowledgeBase, fixThaiSaraAm, matchAll, parseCourseDescriptions } from './knowledgeBase.js';
import { createRetriever, extractCourseCodes, tokenize } from './retriever.js';
import { evaluate } from './eval/evaluateRetriever.js';

describe('knowledge base', () => {
  const kb = buildKnowledgeBase();

  it('repairs the broken Thai sara am from the PDF conversion', () => {
    expect(fixThaiSaraAm('ค าอธิบายรายวิชา ภาวะผู้น า')).toBe('คำอธิบายรายวิชา ภาวะผู้นำ');
  });

  it('has one document with a description for every course in the planner', () => {
    expect(kb.unmatchedCourses).toEqual([]);
    COURSES.forEach((c) => {
      const doc = kb.documents.find((d) => d.id === c.code);
      expect(doc?.hasDescription).toBe(true);
    });
  });

  it('enriches course documents with prerequisite data from the planner graph', () => {
    const ml = kb.documents.find((d) => d.id === 'CP353102');
    expect(ml.text).toContain('CP353003');
    expect(ml.text).toContain('CP353108'); // ตัวต่อ
  });

  // บั๊กเดิม: "Enterprise Application Development" (ไม่มีรหัส) แย่งคำอธิบายของ CP353204 ไปด้วยชื่ออังกฤษคล้ายกัน
  it('matches every course to a description whose title agrees with the course name', () => {
    const { matched } = matchAll(parseCourseDescriptions(readFileSync(new URL('../../โครงสร้างหลักสูตร.md', import.meta.url), 'utf8')));
    const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
    COURSES.forEach((c) => {
      const entry = matched.get(c.code);
      const sameDigits = entry.docCode?.slice(2) === c.code.slice(2);
      const A = words(c.nameEn);
      const B = words(entry.nameEn);
      const overlap = [...A].filter((w) => B.has(w)).length / new Set([...A, ...B]).size;
      expect(sameDigits || overlap >= 0.2, `${c.code} matched "${entry.nameEn}"`).toBe(true);
    });
  });

  it('does not leave a planner course duplicated as an "extra" document', () => {
    const planner = kb.documents.filter((d) => d.inPlanner);
    const extras = kb.documents.filter((d) => !d.inPlanner && d.code);
    extras.forEach((e) => expect(planner.some((p) => p.code.slice(2) === e.code.slice(2)), e.id).toBe(false));
    expect(kb.documents.find((d) => d.id === 'CP353204').text).toContain('เว็บเต็มรูปแบบ');
  });

  it('keeps document ids unique and does not leak the faculty list into the last course', () => {
    expect(new Set(kb.documents.map((d) => d.id)).size).toBe(kb.documents.length);
    expect(kb.documents.find((d) => d.id === 'CP353206').text).not.toContain('ตำแหน่งทางวิชาการ');
  });
});

describe('retriever', () => {
  const retriever = createRetriever(buildKnowledgeBase().documents);

  it('normalizes course codes written in different ways', () => {
    expect(extractCourseCodes('cp 353 102 กับ SC352006')).toEqual(['CP353102', 'SC352006']);
    expect(tokenize('CP 353 102')).toEqual(expect.arrayContaining(['cp353102', '353102']));
  });

  it('ranks a course first when asked by code, including old SC codes', () => {
    expect(retriever.search('CP353306 คือวิชาอะไร')[0].doc.id).toBe('CP353306');
    expect(retriever.search('SC 352 006 เรียนอะไร')[0].doc.id).toBe('CP352006');
  });

  it('returns nothing for a question unrelated to the curriculum', () => {
    expect(retriever.search('xyzzy qwerty')).toEqual([]);
  });

  // กันผลถอยหลัง — ตัวเลขจริงดูได้จาก `npm run rag:eval`
  it('keeps Hit@5 on the development question set at or above 90%', () => {
    const { questions } = JSON.parse(readFileSync(new URL('./eval/questions.json', import.meta.url), 'utf8'));
    expect(evaluate(retriever, questions).overall.hit5).toBeGreaterThanOrEqual(0.9);
  });
});

describe('answerQuestion (RAG pipeline)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.API_KEY = 'test-key';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  const aiReply = (content) => vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  });

  it('answers with the AI and keeps only citations of retrieved documents', async () => {
    const fetchMock = aiReply({ answer: 'เรียนโครงสร้างข้อมูลแบบต่าง ๆ [CP352001]', citedIds: ['CP352001', 'MADE-UP'] });
    vi.stubGlobal('fetch', fetchMock);
    const { answerQuestion } = await import('./ragService.js');

    const result = await answerQuestion({ question: 'วิชาโครงสร้างข้อมูลเรียนอะไร' });

    expect(result.source).toBe('ai');
    expect(result.citedIds).toEqual(['CP352001']);
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content;
    expect(prompt).toContain('<doc id="CP352001">');
  });

  it('strips citation markers of retrieved ids from the answer text but keeps other brackets', async () => {
    const { stripCitationMarkers } = await import('./ragService.js');
    const ids = new Set(['CP353004', 'SECTION-3-15']);
    expect(stripCitationMarkers('อยู่ปี 3 เทอม 2 [CP353004, SECTION-3-15] ครับ [CP353004].', ids)).toBe('อยู่ปี 3 เทอม 2 ครับ.');
    expect(stripCitationMarkers('ดู [หมายเหตุ] และ [FAKE1]', ids)).toBe('ดู [หมายเหตุ] และ [FAKE1]');
  });

  it('passes the student plan term of retrieved courses to the model', async () => {
    const fetchMock = aiReply({ answer: 'ok', citedIds: [] });
    vi.stubGlobal('fetch', fetchMock);
    const { answerQuestion } = await import('./ragService.js');

    await answerQuestion({ question: 'วิศวกรรมซอฟต์แวร์อยู่เทอมไหน', student: { plan: { CP353004: 32 } } });

    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content;
    expect(prompt).toContain('CP353004 อยู่ ปี 3 เทอม 2');
  });

  it('falls back to showing the retrieved documents when the AI call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { answerQuestion } = await import('./ragService.js');

    const result = await answerQuestion({ question: 'CP352001 เรียนอะไร' });

    expect(result.source).toBe('fallback');
    expect(result.answer).toContain('CP352001');
    expect(result.citedIds[0]).toBe('CP352001');
  });

  it('does not call the AI when nothing relevant is retrieved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { answerQuestion } = await import('./ragService.js');

    const result = await answerQuestion({ question: 'xyzzy qwerty' });

    expect(result.source).toBe('no-match');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid requests and drops unknown plan codes and tracks', async () => {
    const { sanitizeRequest } = await import('./ragService.js');
    expect(sanitizeRequest({}).error).toBeTruthy();
    expect(sanitizeRequest({ question: 'x'.repeat(501) }).error).toBeTruthy();
    const ok = sanitizeRequest({ question: 'hi', student: { plan: { CP353004: 32, FAKE: 11 }, tracks: ['AI', 'NOPE'] } });
    expect(ok.student).toEqual({ plan: { CP353004: 32 }, tracks: ['AI'] });
  });
});
