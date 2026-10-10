// ประเมิน retriever ด้วยชุดคำถามใน questions.json — รายงาน Hit@1, Hit@3, Hit@5 และ MRR แยกตามประเภทคำถาม
// รันด้วย `npm run rag:eval` (ไม่ต้องใช้ AI) — ผลลัพธ์เอาไปใส่เล่มวิจัยได้ตรง ๆ
import { readFileSync } from 'node:fs';
import { buildKnowledgeBase } from '../knowledgeBase.js';
import { createRetriever } from '../retriever.js';

export function evaluate(retriever, questions) {
  const rows = questions.map((q) => {
    const ranked = retriever.search(q.question, { k: 5 }).map((r) => r.doc.id);
    const firstHit = ranked.findIndex((id) => q.relevant.includes(id));
    return { ...q, ranked, rank: firstHit === -1 ? null : firstHit + 1 };
  });
  const summarize = (subset) => ({
    n: subset.length,
    hit1: subset.filter((r) => r.rank === 1).length / subset.length,
    hit3: subset.filter((r) => r.rank && r.rank <= 3).length / subset.length,
    hit5: subset.filter((r) => r.rank && r.rank <= 5).length / subset.length,
    mrr: subset.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / subset.length,
  });
  const types = [...new Set(rows.map((r) => r.type))];
  return {
    rows,
    overall: summarize(rows),
    byType: Object.fromEntries(types.map((t) => [t, summarize(rows.filter((r) => r.type === t))])),
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('evaluateRetriever.js')) {
  const { questions } = JSON.parse(readFileSync(new URL('./questions.json', import.meta.url), 'utf8'));
  const { documents } = buildKnowledgeBase();
  const result = evaluate(createRetriever(documents), questions);
  const pct = (x) => `${(x * 100).toFixed(1)}%`;

  console.log(`# Retriever evaluation (BM25, ${documents.length} documents, ${questions.length} questions)\n`);
  console.log('| ประเภท | n | Hit@1 | Hit@3 | Hit@5 | MRR |');
  console.log('|---|---:|---:|---:|---:|---:|');
  [...Object.entries(result.byType), ['รวม', result.overall]].forEach(([type, s]) => {
    console.log(`| ${type} | ${s.n} | ${pct(s.hit1)} | ${pct(s.hit3)} | ${pct(s.hit5)} | ${s.mrr.toFixed(3)} |`);
  });

  const misses = result.rows.filter((r) => r.rank !== 1);
  if (misses.length) {
    console.log('\n## คำถามที่อันดับ 1 ไม่ถูก\n');
    misses.forEach((r) => console.log(`- ${r.id} "${r.question}" → อันดับที่ถูก: ${r.rank ?? 'ไม่ติด top 5'} (ได้: ${r.ranked.slice(0, 3).join(', ')})`));
  }
}
