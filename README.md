# Course Planner — Career-Driven Adaptive Learning Path Planner

ระบบจัดเส้นทางการเรียนรู้แบบปรับเปลี่ยนตามสายอาชีพ พร้อม Academic Scheduling Optimization Engine
(หลักสูตร วท.บ. วิทยาการคอมพิวเตอร์ มข. 2565) — ดูรายละเอียดสโคปเต็มใน `scopeAdvisor.md` และแผนพัฒนา
Phase 2–3 ใน `แผนพัฒนา-Phase2-3.md`

## สถาปัตยกรรม

- **Frontend:** React + Vite (`src/`)
- **Backend:** Node/Express + SQLite (`node:sqlite`, มากับ Node ≥22 อยู่แล้ว ไม่ต้อง install native module) (`server/`)
- **AI:** KKUIntelSphere gateway (`server/ai/`) — มี rule-based fallback อัตโนมัติเมื่อ AI เรียกไม่สำเร็จ
- **Optimization Engine:** Genetic Algorithm (`server/optimizer/ga.js`) เทียบกับ greedy heuristic เดิม (`src/utils/scheduler.js`)

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env        # แล้วกรอก API_KEY จริง (ยืนยันแล้วว่าใช้ได้กับ model gpt-5-nano)
npm run db:migrate          # โหลดข้อมูลหลักสูตรเข้า SQLite (ครั้งแรกเท่านั้น)
npm run dev:all             # รัน frontend (Vite, port 5173) + backend (Express, port 3001) พร้อมกัน
```

เปิด http://localhost:5173 — ถ้า backend ไม่ได้รันหรือ AI ล่ม ระบบจะ fallback เป็น rule-based logic
ฝั่ง client อัตโนมัติ (progressive enhancement) ใช้งานได้แม้ backend ไม่พร้อม

## คำสั่งอื่น ๆ ที่มีประโยชน์

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run test` | รัน Vitest ทั้งหมด (graph, scheduler, GA, AI fallback) |
| `npm run ai:test-connection` | ยืนยัน shape ของ KKUIntelSphere response ก่อนใช้งานจริง |
| `npm run optimizer:benchmark` | เทียบ greedy vs GA บน mock profile หลายแบบ (ผลลัพธ์เอาไปเขียนเล่มได้) |
| `npm run server` | รัน backend อย่างเดียว |
| `npm run dev` | รัน frontend อย่างเดียว |

## เอกสารเพิ่มเติม

- `docs/optimization-model.md` — นิยามคณิตศาสตร์ของปัญหา scheduling optimization
- `แผนพัฒนา-Phase2-3.md` — แผนพัฒนาและ checklist ปิดช่องว่างของแต่ละ Phase
