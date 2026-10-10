// ข้อมูลสายอาชีพสำหรับหน้า "เป้าหมาย" + แบบสอบถามช่วยเลือกสายสำหรับนักศึกษาที่ยังไม่แน่ใจ (data cold-start)
// หมายเหตุ: น้ำหนักคำถาม → สายอาชีพ ผู้พัฒนากำหนดเอง ยังไม่ได้ปรับเทียบกับข้อมูลจริง
// (ควรให้อาจารย์/รุ่นพี่ที่ทำงานสายนั้นตรวจทาน — ดู ReSearch.md ข้อ 2)

import { TRACKS } from './curriculum.js';

export const TRACK_PROFILES = {
  FRONTEND: { icon: '🎨', summary: 'สร้างหน้าเว็บ/UI ที่ผู้ใช้เห็นและโต้ตอบ', skills: ['HTML/CSS', 'JavaScript/React', 'UX Design'] },
  FULLSTACK: { icon: '🌐', summary: 'พัฒนาเว็บแอปครบทั้งหน้าบ้าน หลังบ้าน และฐานข้อมูล', skills: ['Web Framework', 'Database', 'API Design'] },
  DATA: { icon: '📊', summary: 'วิเคราะห์และจัดการข้อมูลเพื่อหาข้อมูลเชิงลึก', skills: ['Python/SQL', 'Statistics', 'Data Pipeline'] },
  AI: { icon: '🤖', summary: 'พัฒนาโมเดล Machine Learning และระบบอัจฉริยะ', skills: ['Machine Learning', 'Deep Learning', 'Math'] },
  DEVOPS: { icon: '⚙️', summary: 'ดูแลเซิร์ฟเวอร์ คลาวด์ และระบบ deploy อัตโนมัติ', skills: ['Linux/Network', 'Cloud', 'CI/CD & Script'] },
  SECURITY: { icon: '🛡️', summary: 'ปกป้องระบบและเครือข่ายจากภัยคุกคาม', skills: ['Network Security', 'Cryptography', 'Pentest'] },
  GAMEDEV: { icon: '🎮', summary: 'สร้างเกม แอนิเมชัน และสื่อดิจิทัลแบบโต้ตอบ', skills: ['Game Engine', 'Graphics', 'Animation'] },
  MOBILE: { icon: '📱', summary: 'พัฒนาแอปบน Android / iOS', skills: ['Mobile Framework', 'Mobile UI', 'API Integration'] },
};

// คำตอบเป็นมาตราส่วน 1 (ไม่ใช่เลย) – 5 (ใช่มาก) / weights = ความเกี่ยวข้องของคำถามกับแต่ละสาย (0–1)
export const QUIZ_QUESTIONS = [
  { id: 'ui', text: 'ชอบออกแบบหน้าจอให้สวยและใช้งานง่าย', weights: { FRONTEND: 1, MOBILE: 0.6, GAMEDEV: 0.4, FULLSTACK: 0.4 } },
  { id: 'web', text: 'อยากสร้างเว็บหรือระบบที่ใช้งานได้ครบทั้งหน้าบ้านและหลังบ้าน', weights: { FULLSTACK: 1, FRONTEND: 0.5, MOBILE: 0.3 } },
  { id: 'data', text: 'ชอบหาข้อสรุปหรือรูปแบบจากข้อมูล ตัวเลข และสถิติ', weights: { DATA: 1, AI: 0.6 } },
  { id: 'ml', text: 'สนใจทำให้คอมพิวเตอร์เรียนรู้เองได้ (AI/ML) และไม่กลัวคณิตศาสตร์', weights: { AI: 1, DATA: 0.5 } },
  { id: 'infra', text: 'ชอบดูแลเซิร์ฟเวอร์และเครือข่าย ทำให้ระบบรันได้เสถียรและอัตโนมัติ', weights: { DEVOPS: 1, SECURITY: 0.4 } },
  { id: 'sec', text: 'สนใจการหาช่องโหว่และป้องกันการโจมตีระบบ', weights: { SECURITY: 1, DEVOPS: 0.3 } },
  { id: 'game', text: 'อยากสร้างเกม แอนิเมชัน หรือสื่อแบบโต้ตอบ', weights: { GAMEDEV: 1, FRONTEND: 0.3 } },
  { id: 'mobile', text: 'อยากทำแอปมือถือที่คนใช้ในชีวิตประจำวัน', weights: { MOBILE: 1, FRONTEND: 0.3, FULLSTACK: 0.3 } },
];

export const LIKERT = [
  { value: 1, label: 'ไม่ใช่เลย' },
  { value: 2, label: 'ไม่ค่อย' },
  { value: 3, label: 'เฉย ๆ' },
  { value: 4, label: 'ค่อนข้างใช่' },
  { value: 5, label: 'ใช่มาก' },
];

/**
 * คะแนนความเหมาะสมของแต่ละสาย (0–100) = ค่าเฉลี่ยถ่วงน้ำหนักของคำตอบที่ normalize เป็น 0–1
 * เรียงจากมากไปน้อย พร้อมเหตุผล = คำถามที่ส่งคะแนนให้สายนั้นมากที่สุด (สูงสุด 2 ข้อ)
 * @param {Record<string, number>} answers  questionId -> 1..5
 */
export function scoreQuiz(answers) {
  return Object.keys(TRACKS)
    .map((track) => {
      let weighted = 0;
      let totalWeight = 0;
      const contributions = [];
      QUIZ_QUESTIONS.forEach((q) => {
        const w = q.weights[track] ?? 0;
        if (!w || answers[q.id] === undefined) return;
        const normalized = (answers[q.id] - 1) / 4;
        weighted += w * normalized;
        totalWeight += w;
        contributions.push({ text: q.text, value: w * normalized, answer: answers[q.id] });
      });
      // เหตุผลนับเฉพาะข้อที่ตอบ "ค่อนข้างใช่/ใช่มาก" กับคำถามที่เกี่ยวกับสายนั้นจริง (ตอบ "เฉย ๆ" ไม่ใช่เหตุผล)
      const reasons = contributions
        .filter((c) => c.answer >= 4 && c.value >= 0.5)
        .sort((a, b) => b.value - a.value)
        .slice(0, 2)
        .map((c) => c.text);
      return { track, score: totalWeight ? Math.round((weighted / totalWeight) * 100) : 0, reasons };
    })
    .sort((a, b) => b.score - a.score);
}
