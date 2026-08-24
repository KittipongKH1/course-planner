import { useState, useRef, useEffect } from 'react';
import { extractIntent, trackLabel } from '../utils/intent.js';
import { extractIntentRemote } from '../services/api.js';

const SUGGESTIONS = [
  'อยากเป็น DevOps แต่ไม่ชอบคำนวณมาก มีเวลาอ่านหนังสือวันละ 2 ชั่วโมง',
  'อยากเป็น Data Scientist ทำงานพาร์ทไทม์ด้วย สัปดาห์ละ 15 ชั่วโมง',
  'อยากเป็น Front-end อยากได้เกียรตินิยม มีเวลาเรียนสัปดาห์ละ 25 ชั่วโมง',
  'อยากเรียนต่อป.โทสาย AI',
];

export default function ChatBot({ onIntent, constraints }) {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: 'สวัสดีครับ ผมเป็นผู้ช่วยวางแผนเส้นทางการเรียน 🎓 ลองบอกเป้าหมายสายอาชีพ ข้อจำกัดเวลา หรือเงื่อนไขส่วนตัวของคุณมาได้เลย เช่น "อยากเป็น DevOps มีเวลาอ่านหนังสือวันละ 2 ชั่วโมง"',
    },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    // block: 'nearest' กัน scrollIntoView ไล่ scroll ทั้งหน้าเว็บ (รวม status bar/onboarding banner
    // ด้านบน) ให้เลื่อนแค่ภายใน .chatbot-messages เอง
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  async function handleSend(text) {
    const value = (text ?? input).trim();
    if (!value || pending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: value }]);
    setPending(true);

    // พยายามใช้ AI จริง (KKUIntelSphere ผ่าน backend) ก่อนเสมอ
    // ถ้า backend ไม่รัน/AI ล่ม ให้ fallback เป็น rule-based extraction ฝั่ง client ทันที (ใช้งานได้แม้ offline)
    let intent;
    let source = 'fallback';
    try {
      const remote = await extractIntentRemote(value);
      intent = remote.intent;
      source = remote.source;
    } catch {
      intent = extractIntent(value);
    }

    const botReply = buildReply(intent, source);
    setMessages((m) => [...m, { role: 'bot', text: botReply }]);
    setPending(false);
    onIntent(intent);
  }

  function buildReply(intent, source) {
    const parts = [];
    if (intent.track) parts.push(`ตั้งเป้าสายอาชีพ: **${trackLabel(intent.track)}**`);
    if (intent.hoursPerWeek !== null) parts.push(`เวลาเรียนที่มี: ~${intent.hoursPerWeek} ชม./สัปดาห์`);
    if (intent.honors) parts.push('เปิดโหมดป้องกันเกียรตินิยม (ลดภาระต่อเทอมเพื่อลดความเสี่ยง F/W)');
    if (intent.gradSchool) parts.push('จะเน้นวิชาทฤษฎี/วิจัยเพิ่มสำหรับสายเรียนต่อ');
    const sourceNote = source === 'ai' ? '(สกัดด้วย AI จริงผ่าน KKUIntelSphere)' : '(โหมด fallback — rule-based)';
    if (!parts.length) {
      return `รับทราบครับ ${sourceNote}\nลองระบุสายอาชีพที่สนใจ (เช่น DevOps, Data Scientist, Front-end) และเวลาที่มีต่อสัปดาห์ เพื่อให้ผมช่วยคำนวณแผนได้แม่นยำขึ้นนะครับ`;
    }
    return `เข้าใจแล้วครับ 👍 ${sourceNote}\n${parts.join('\n')}\nไปที่แท็บ "Dashboard" เพื่อดูแผนการเรียนที่คำนวณให้ได้เลยครับ`;
  }

  return (
    <div className="chatbot">
      <div className="chatbot-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role}`}>
            <span className={`avatar ${m.role}`}>{m.role === 'bot' ? '🤖' : '🧑'}</span>
            <div className={`bubble ${m.role}`}>
              {m.text.split('\n').map((line, j) => (
                <div key={j}>{line}</div>
              ))}
            </div>
          </div>
        ))}
        {pending && (
          <div className="bubble-row bot">
            <span className="avatar bot">🤖</span>
            <div className="bubble bot pending">กำลังวิเคราะห์...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chatbot-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => handleSend(s)} disabled={pending}>{s}</button>
        ))}
      </div>
      <form
        className="chatbot-input"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="พิมพ์เป้าหมาย เวลาว่าง หรือเงื่อนไขของคุณ..."
          disabled={pending}
        />
        <button type="submit" disabled={pending}>ส่ง</button>
      </form>
      {constraints && (
        <div className="current-constraints">
          <strong>เงื่อนไขปัจจุบัน:</strong>{' '}
          {constraints.track ? trackLabel(constraints.track) : 'ยังไม่ระบุสายอาชีพ'} ·{' '}
          {constraints.hoursPerWeek ?? '20'} ชม./สัปดาห์ ·{' '}
          {constraints.honors ? 'โหมดเกียรตินิยม' : 'โหมดปกติ'}
        </div>
      )}
    </div>
  );
}
