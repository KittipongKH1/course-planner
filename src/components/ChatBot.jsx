// แชทถาม-ตอบหลักสูตร — กำลังเปลี่ยนเป็น RAG (ค้นคำอธิบายรายวิชาจากเอกสารหลักสูตรแล้วให้ LLM ตอบ)
// การตั้งเป้าหมาย/ข้อจำกัดย้ายไปอยู่หน้า "เป้าหมาย" (GoalsPage.jsx) แล้ว แชทจึงไม่แก้ constraints อีกต่อไป

const EXAMPLE_QUESTIONS = [
  'วิชา Data Structures เรียนเกี่ยวกับอะไร',
  'ถ้าอยากลง Machine Learning ต้องผ่านวิชาอะไรก่อน',
  'ทำไมวิชา Software Engineering อยู่ปี 3 เทอม 2 ในแผนของฉัน',
];

export default function ChatBot({ onGoToGoals }) {
  return (
    <div className="chatbot">
      <div className="chatbot-messages">
        <div className="bubble-row bot">
          <span className="avatar bot">🤖</span>
          <div className="bubble bot">
            <div>ส่วนถาม-ตอบหลักสูตรกำลังพัฒนาเป็นระบบ RAG — จะตอบคำถามเกี่ยวกับรายวิชาโดยอ้างอิงจากเอกสารหลักสูตรจริง</div>
            <div>ตัวอย่างคำถามที่จะถามได้:</div>
            {EXAMPLE_QUESTIONS.map((q) => <div key={q}>• {q}</div>)}
          </div>
        </div>
      </div>
      <form className="chatbot-input" onSubmit={(e) => e.preventDefault()}>
        <input placeholder="ยังไม่เปิดให้ใช้งาน (อยู่ระหว่างพัฒนา RAG)" disabled />
        <button type="submit" disabled>ส่ง</button>
      </form>
      <div className="current-constraints">
        ต้องการตั้งสายอาชีพหรือเวลาว่าง?
        <button type="button" className="link-button" onClick={onGoToGoals}>ไปที่หน้าเป้าหมาย →</button>
      </div>
    </div>
  );
}
