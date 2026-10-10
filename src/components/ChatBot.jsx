import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, SendHorizontal, UserRound } from 'lucide-react';
import { askCurriculumRemote } from '../services/api.js';
import { generateOfficialPlan } from '../utils/scheduler.js';

// ถาม-ตอบหลักสูตรด้วย RAG: backend ค้นเอกสารหลักสูตร (โครงสร้างหลักสูตร.md + ข้อมูลรายวิชาในระบบ) แล้วให้ LLM ตอบ
// โดยอ้างอิงเอกสาร — แชทไม่แก้เป้าหมาย/ข้อจำกัดของแผน (ย้ายไปหน้า "เป้าหมาย" แล้ว)

const EXAMPLE_QUESTIONS = [
  'วิชาโครงสร้างข้อมูลเรียนเกี่ยวกับอะไร',
  'ถ้าอยากลง Machine Learning ต้องผ่านวิชาอะไรก่อน',
  'ทำไมวิชาวิศวกรรมซอฟต์แวร์อยู่ปี 3 เทอม 2 ในแผนของฉัน',
  'จบแล้วทำงานอาชีพอะไรได้บ้าง',
];

const SOURCE_NOTE = {
  ai: 'ตอบด้วย AI จากเอกสารหลักสูตร',
  fallback: 'AI ไม่พร้อม — แสดงข้อความจากเอกสารหลักสูตรตรง ๆ',
  'no-match': 'ไม่พบเอกสารที่เกี่ยวข้อง',
};

const WELCOME = {
  role: 'bot',
  text: 'สวัสดีครับ ถามเรื่องหลักสูตรได้เลย เช่น วิชานี้เรียนอะไร ต้องผ่านวิชาไหนก่อน หรือทำไมวิชานี้อยู่เทอมนี้ในแผนของคุณ — ผมจะตอบจากเอกสารหลักสูตร มข. 2565 และบอกว่าอ้างอิงจากวิชาไหน',
};

export default function ChatBot({ constraints, completed, failed, onGoToGoals }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const bottomRef = useRef(null);

  // ส่งเทอมของแต่ละวิชาในแผน Official ไปด้วย เพื่อให้ตอบคำถามแบบ "ทำไมวิชานี้อยู่เทอมนี้ในแผนของฉัน" ได้
  const planTerms = useMemo(() => {
    const { plan } = generateOfficialPlan([...completed], {
      tracks: constraints.tracks,
      yearPathPreference: constraints.yearPathPreference,
      offeringPolicy: constraints.offeringPolicy,
      retakeCodes: [...failed],
    });
    return Object.fromEntries(plan.flatMap((t) => t.courses.map((c) => [c.code, t.term])));
  }, [completed, failed, constraints.tracks, constraints.yearPathPreference, constraints.offeringPolicy]);

  useEffect(() => {
    // block: 'nearest' กัน scrollIntoView ไล่ scroll ทั้งหน้าเว็บ ให้เลื่อนแค่ภายใน .chatbot-messages เอง
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, pending]);

  async function handleSend(text) {
    const question = (text ?? input).trim();
    if (!question || pending) return;
    setInput('');
    const history = messages.filter((m) => m !== WELCOME).map(({ role, text: t }) => ({ role, text: t }));
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setPending(true);

    try {
      const result = await askCurriculumRemote({
        question,
        history,
        student: { tracks: constraints.tracks, plan: planTerms },
      });
      const cited = new Set(result.citedIds);
      setMessages((m) => [...m, {
        role: 'bot',
        text: result.answer,
        source: result.source,
        sources: result.sources.filter((s) => cited.has(s.id)),
      }]);
    } catch {
      setMessages((m) => [...m, {
        role: 'bot',
        text: 'เชื่อมต่อ backend ไม่ได้ — ระบบถาม-ตอบต้องรัน server ด้วย (npm run dev:all)',
        source: 'error',
      }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="chatbot">
      <div className="chatbot-messages" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role}`}>
            <span className={`avatar ${m.role}`} aria-hidden="true">
              {m.role === 'bot' ? <Bot size={16} /> : <UserRound size={16} />}
            </span>
            <div className={`bubble ${m.role} ${m.source === 'error' ? 'error' : ''}`}>
              {m.text.split('\n').map((line, j) => <p key={j}>{line}</p>)}
              {m.sources?.length > 0 && (
                <div className="chat-sources">
                  <span className="chat-sources-label">อ้างอิง</span>
                  {m.sources.map((s) => (
                    <span key={s.id} className="source-chip" title={s.nameEn || s.nameTh}>
                      <BookOpen size={12} aria-hidden="true" />
                      {s.code ? `${s.code} ${s.nameTh}` : s.nameTh}
                    </span>
                  ))}
                </div>
              )}
              {SOURCE_NOTE[m.source] && <div className="chat-source-note">{SOURCE_NOTE[m.source]}</div>}
            </div>
          </div>
        ))}
        {pending && (
          <div className="bubble-row bot">
            <span className="avatar bot" aria-hidden="true"><Bot size={16} /></span>
            <div className="bubble bot pending">
              <span className="typing" aria-hidden="true"><i /><i /><i /></span>
              กำลังค้นเอกสารหลักสูตร
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chatbot-suggestions">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => handleSend(q)} disabled={pending}>{q}</button>
        ))}
      </div>
      <form className="chatbot-input" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ถามเรื่องรายวิชา วิชาบังคับก่อน หรือหลักสูตร"
          aria-label="คำถามเกี่ยวกับหลักสูตร"
          maxLength={500}
          disabled={pending}
        />
        <button type="submit" className="primary-button" disabled={pending || !input.trim()}>
          <SendHorizontal size={16} aria-hidden="true" />
          ส่ง
        </button>
      </form>
      <p className="chatbot-foot">
        ต้องการตั้งสายอาชีพหรือเวลาว่าง?
        <button type="button" className="link-button" onClick={onGoToGoals}>ไปที่หน้าเป้าหมาย</button>
      </p>
    </div>
  );
}
