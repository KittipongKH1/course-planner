# แผนพัฒนา Phase 2–3 — ปิดช่องว่างจาก Gap Analysis

อ้างอิงจากการสำรวจโค้ดปัจจุบัน (`src/`) เทียบกับ `scopeAdvisor.md` — เอกสารนี้วางแผนงานที่ต้องทำใน
**Phase 2 (วิชา RM)** และ **Phase 3 (Project 1)** เพื่อปิดช่องว่างทั้ง 6 ข้อที่พบ

---

## หลักการจัดลำดับงาน

1. งานที่ "ทุกอย่างอื่นพึ่งพา" ต้องทำก่อน (ข้อมูลหลักสูตร 2570, schema ที่ decouple ได้)
2. โครงสร้าง backend/Live System ต้องมาก่อน AI integration เพราะ API key ห้าม expose ฝั่ง frontend
3. Optimization engine (Phase 3) ต้องมี "นิยามคณิตศาสตร์" ก่อนลงมือเขียนโค้ด ตามที่อาจารย์ขอใน scopeAdvisor.md
4. Testing ทำคู่ขนานไปกับแต่ละโมดูล ไม่ทิ้งไว้ท้ายสุด

---

## Phase 2 (RM — Live System)

### 2.1 ย้ายฐานข้อมูลไปหลักสูตรปี 2570 [ลำดับ 1 — ทำก่อนสุด]

- **Action:** ขอร่างหลักสูตร 2570 จากภาควิชา/อาจารย์ที่ปรึกษาให้เร็วที่สุด (ตาม "Action Item" ที่อาจารย์ระบุใน scopeAdvisor.md)
- **ถ้ายังไม่ finalize:** อย่ารอ — ออกแบบ schema ให้ curriculum เป็น **versioned config** ทันที:
  - แยก `src/data/curriculum2565.js` (ของเดิม, เก็บไว้เป็น archive) และ `src/data/curriculum2570.js` (draft/mock ตามข้อมูลที่มี)
  - เพิ่ม adapter/selector: `getCurriculum(version)` แทนการ import ตรง ๆ ทุกที่
  - เก็บ `CURRICULUM_VERSION` ไว้ใน app state/config เดียว เพื่อสลับได้จุดเดียว
- **เป้าหมาย:** สลับหลักสูตรได้โดยไม่แก้โค้ด logic (`graph.js`, `scheduler.js`) เลย — ตรงกับคำแนะนำของอาจารย์เรื่อง "decouple schema"

### 2.2 AI Integration แทน keyword-based `intent.js`

- **สถาปัตยกรรมที่เสนอ:**
  ```
  Chat message → Backend proxy → LLM (system prompt สกัด intent เป็น JSON)
    → validate/parse → merge เข้า constraints state
  ```
- ต้องมี **backend เบา ๆ** เป็นตัวกลางเรียก LLM (ห้ามเรียก API ตรงจาก frontend เพราะจะหลุด API key) — นี่คือจุดเริ่มต้นของ "Live System" ด้วยในตัว
- **Semantic matching วิชา ↔ ความสนใจ:** ใช้ embedding (เช่น text-embedding model) แปลงคำอธิบายรายวิชา + ข้อความนักศึกษาเป็น vector แล้วจับคู่ด้วย cosine similarity แทนการ hardcode `TRACK_KEYWORDS` ปัจจุบัน — ทำให้ระบบเข้าใจประโยคที่ไม่ตรง keyword ตรง ๆ ได้
- **Fallback:** เก็บ keyword-based extraction เดิมไว้เป็น fallback เมื่อเรียก LLM ไม่สำเร็จ (graceful degradation — ไม่ใช่ throw away โค้ดเดิม)

### 2.3 Live System จริง (Backend + Database)

- Stack แนะนำ: Node/Express (เบา, ใช้ JS เดิมได้ต่อเนื่อง) + SQLite (dev) / Postgres (ถ้าต้อง deploy จริง)
- **ย้าย curriculum data จาก static JS → ตารางใน DB:** `courses`, `prerequisites` (edge table), `tracks` — เพื่อให้ "สลับหลักสูตร" ทำได้ที่ระดับข้อมูล ไม่ใช่แค่ import ไฟล์คนละตัว
- ตารางเพิ่ม: `users` (รหัสนักศึกษา), `transcripts`, `constraints_history`, `generated_plans`
- API endpoints ขั้นต่ำ: `POST /api/intent/extract`, `GET /api/courses`, `POST /api/plan/generate`, `GET/POST /api/transcript`
- Auth แบบง่าย (รหัสนักศึกษา + email) ไม่ต้องซับซ้อน — เป้าหมายคือให้มี "ผู้ใช้จริง" ป้อนข้อมูลได้ ไม่ใช่ demo local state อย่างเดียว

### 2.4 AI วิเคราะห์ Mock Transcript

- ปัจจุบัน `TranscriptPanel.jsx` เป็นแค่ checkbox — เพิ่มเป็น **risk analyzer module**:
  - รับ transcript (เกรด/สถานะ W) → คำนวณความเสี่ยงต่อเป้าหมาย (honors ติด F/W?, ตกวิชาคอขวด?)
  - ใช้ LLM สรุปเป็นคำแนะนำภาษาธรรมชาติ หรือ rule-based scoring ก็ได้ ขึ้นกับเวลาที่มี — ให้เลือกอย่างใดอย่างหนึ่งอย่างจริงจัง อย่าทิ้งไว้เป็นแค่ UI toggle เหมือนตอนนี้

### Phase 2 — Checklist ก่อนส่งอาจารย์

- [x] Backend + SQLite ใช้งานได้จริง (`server/`, `npm run db:migrate`) — ไม่ใช่ local state ในเบราว์เซอร์อย่างเดียวแล้ว
- [x] Chat ขับเคลื่อนด้วย AI จริงผ่าน KKUIntelSphere (`server/ai/kkuIntelSphere.js`) พร้อม rule-based fallback อัตโนมัติเมื่อ API ล่ม/ไม่ได้ตั้งค่า (ทดสอบแล้วผ่านทั้งสอง path)
- [x] Transcript analyzer ให้ risk report จริง (`AI Transcript Risk Analyzer` ใน `TranscriptPanel.jsx`) ไม่ใช่แค่ checkbox — บันทึกลง SQLite และวิเคราะห์ด้วย bottleneck detection เป็น fallback
- [ ] ข้อมูลหลักสูตร 2570 — **ยังไม่ทำตามการตัดสินใจของผู้ใช้** (ใช้หลักสูตร 2565 เป็นตัวหลักต่อไป) แต่ schema ใน `server/db.js` มีคอลัมน์ `curriculum_version` เตรียมไว้ให้สลับได้ในอนาคต
- [ ] แผน pilot testing กับนักศึกษาจริง — ยังไม่ได้ตัดสินใจ (คำถามอาจารย์ข้อ 2 ยังค้างอยู่)
- [x] ยืนยัน request/response shape ของ `gen.ai.kku.ac.th` แล้ว (2026-08-24) — เป็น OpenAI-compatible จริงตามที่คาด (คล้าย OpenRouter) แต่มี 2 quirk ที่แก้แล้วใน `server/ai/kkuIntelSphere.js`:
  1. โมเดล `gemini-2.5-flash-lite` (ค่า default เดิม) ไม่มี endpoint ให้บริการตอนนี้ (404 "No endpoints found") — เปลี่ยน default เป็น `gpt-5-nano` ซึ่งทดสอบแล้วใช้งานได้จริง
  2. บางโมเดล (เช่น กลุ่ม gemini) ไม่ยึด `response_format:json_object` เป๊ะ ๆ ห่อคำตอบด้วย ```` ```json ```` fence — เพิ่ม `stripMarkdownFence()` รองรับแล้ว
  ทดสอบ end-to-end จริงผ่านทั้ง `extractIntentSmart` และ `analyzeTranscriptSmart` ได้ผลลัพธ์คุณภาพดี (source: "ai")

---

## Phase 3 (Project 1 — Advanced Optimization)

### 3.1 นิยามคณิตศาสตร์ของปัญหาก่อนเขียนโค้ด [ลำดับแรกของ Phase 3]

ตอบโจทย์อาจารย์โดยตรง ("flesh out the mathematical definition of your constraints") — เขียนเป็นเอกสารก่อน แล้วค่อย implement:

- ตัวแปรตัดสินใจ: `x[c][t] ∈ {0,1}` — ลงวิชา c ในเทอม t หรือไม่
- Objective: ตัวอย่างเช่น minimize จำนวนเทอมทั้งหมด + minimize deviation จาก career-track coverage
- Constraints:
  - Prerequisite: `x[c][t] = 1 → ∀p∈prereq(c), Σ_{t'<t} x[p][t'] = 1`
  - Credit cap ต่อเทอม: `Σ_c credits[c]·x[c][t] ≤ maxCredits`
  - Cognitive load cap ต่อเทอม (ผูกกับ hoursPerWeek): `Σ_c load[c]·x[c][t] ≤ loadBudget(hoursPerWeek)`
  - แต่ละวิชาถูกลงได้ครั้งเดียว: `Σ_t x[c][t] = 1` (ยกเว้นวิชาที่ตกแล้วต้องลงซ้ำ)
  - Elective credit goal ≥ 15 หน่วยกิตตามสายอาชีพ

เอกสารนี้ใช้เป็นส่วนหนึ่งของเล่มวิจัยได้โดยตรง

### 3.2 เปลี่ยนจาก Greedy Heuristic → Real Optimization Algorithm

`scheduler.js` ปัจจุบันเป็น greedy scoring — อาจารย์ระบุชัดว่าต้อง exploring GA/ASP/ILP จริง เสนอ 2 แนวทางที่ทำคู่กันเพื่อ benchmark:

| แนวทาง | เครื่องมือ | บทบาท |
|---|---|---|
| **Constraint Programming (แนะนำเป็นตัวหลัก)** | Google OR-Tools CP-SAT (ต้องรันฝั่ง Python backend) | รับประกัน feasibility/optimality ชัดเจน เหมาะกับ constraint ที่ hard เช่น prerequisite |
| **Genetic Algorithm** | เขียนเองใน JS ได้ (population = candidate term-plan, fitness = ผสม critical-path progress + track match + load balance) | ใช้เป็น metaheuristic baseline เทียบประสิทธิภาพ/เวลาในการคำนวณ |

- ต้องมี **backend service (Python)** แยกจาก frontend สำหรับรัน CP-SAT/OR-Tools แล้วเชื่อมผ่าน API เดียวกับที่สร้างใน Phase 2.3 (`POST /api/plan/generate` เรียก solver แทน greedy function เดิม)
- เก็บ greedy heuristic เดิมไว้เป็น **baseline สำหรับ benchmark** (ข้อ 3.3) ไม่ต้องลบทิ้ง

### 3.3 Benchmark Suite

- สร้างชุด mock student profile หลายแบบ: cold-start (transcript ว่าง), ใกล้จบ, ติด F/W วิชาคอขวด, honors, งานพาร์ทไทม์หนัก (hoursPerWeek ต่ำ)
- เทียบ **Greedy (baseline เดิม) vs GA vs CP-SAT** บน 3 มิติ: เวลาในการคำนวณ, คุณภาพแผน (จำนวนเทอมจนจบ, credit balance ต่อเทอม), feasibility rate
- บันทึกผลเป็นตาราง/กราฟสำหรับเล่มวิจัย — ตรงกับที่อาจารย์บอกไว้ว่า "ต้อง benchmark เปรียบเทียบวิธีต่าง ๆ"

### 3.4 ผูก `gradSchool` constraint เข้ากับ scheduler จริง

ปัจจุบัน flag นี้มีผลแค่ข้อความใน ChatBot ไม่มีผลต่อแผนจริง:

- เพิ่ม field `theoretical: boolean` ให้วิชาที่เกี่ยวกับทฤษฎี/วิจัย (Theory of Computation, Numerical Methods ฯลฯ) ใน course data
- เพิ่ม weight ในทั้ง objective function (ILP/CP) และ fitness function (GA) เมื่อ `gradSchool = true`

### 3.5 Fallback / Constraint Relaxation

ตอบคำถามอาจารย์ข้อ 3 ("ถ้า Optimization Engine หา zero valid schedule"):

- เมื่อ solver หา feasible plan ไม่ได้ (เช่น hoursPerWeek ต่ำมาก + track หนัก) ให้มี **relaxation strategy แบบขั้นบันได**: เพิ่ม maxTerms ทีละ 1 → ลด elective credit goal → เตือนผู้ใช้ว่า trade-off อะไรไปบ้าง
- Log การ relax ทุกครั้งเพื่อความโปร่งใส (แสดงในหน้า warning ของ dashboard เหมือนที่มี `warnings` array อยู่แล้วตอนนี้)

### 3.6 Testing

- Unit test สำหรับ `graph.js`: topological sort ถูกต้อง, critical path ถูกต้อง, cycle detection (แม้ curriculum จริงไม่ควรมี cycle แต่ต้อง guard ไว้)
- Unit test สำหรับ scheduler: ไม่ละเมิด credit cap/load cap/prerequisite ในทุก edge case
- Integration test: cold-start, honors, gradSchool, ติด F/W ตามที่ระบุใน 3.3
- Framework แนะนำ: **Vitest** (เข้ากับ Vite ที่ใช้อยู่แล้ว ไม่ต้องเพิ่ม config ซับซ้อน)

### Phase 3 — Checklist ก่อนส่งอาจารย์

- [x] เอกสารนิยามคณิตศาสตร์ของปัญหา (3.1) — `docs/optimization-model.md`
- [x] Solver จริง: Genetic Algorithm (`server/optimizer/ga.js`) แทน greedy heuristic ล้วน ๆ — CP-SAT/ILP ยังไม่ทำ (ตัดสินใจเลื่อนไปอนาคตตามที่ตกลงกัน)
- [x] Benchmark report เทียบ greedy vs GA บน 5 mock profile (`npm run optimizer:benchmark`) — ผลจริง: GA ให้จำนวนเทอมเท่ากันหรือน้อยกว่า greedy ในทุก profile ที่ทดสอบ (7 vs 8 เทอมใน 2 profile) แลกกับเวลาในการคำนวณที่มากขึ้น (~100-250ms เทียบกับ <2ms) — feasibility 100% ทั้งสองวิธี
- [x] Test suite ผ่านทั้งหมด (Vitest, 21 tests: graph/scheduler/GA hard-constraint fuzzing/AI fallback)
- [x] `gradSchool` มีผลจริงต่อแผนที่ได้แล้ว — เพิ่ม field `theoretical` ให้วิชาทฤษฎี/วิจัย 8 วิชา และให้ bonus ใน GA fitness function เมื่อจัดวิชาเหล่านี้ไว้เทอมต้น ๆ
- [x] Fallback/relaxation logic เมื่อหา solution ไม่ได้ — GA decoder ผ่อน load budget ทีละขั้น (สูงสุด 6 ครั้ง) ก่อนยอมแพ้ พร้อม warning message อธิบายทุกครั้งที่ relax
- [ ] CP-SAT/ILP (exact method) สำหรับ benchmark เพิ่มเติม — ยังไม่ทำ (ตัดสินใจเลื่อนตามที่ตกลงกัน เพราะ Python 3.14 ในเครื่องอาจยังไม่รองรับ OR-Tools เต็มที่)

---

## ลำดับงานที่แนะนำ (Sequencing)

1. หลักสูตร 2570 + schema decouple (2.1)
2. Backend proxy + AI intent extraction (2.2) — เริ่มวางฐาน Live System ไปพร้อมกัน
3. Live System เต็มรูปแบบ: DB + API (2.3)
4. AI transcript analyzer (2.4)
5. นิยามคณิตศาสตร์ของปัญหา (3.1)
6. Implement CP-SAT solver เป็นตัวหลัก (3.2)
7. Implement GA เป็นตัวเทียบ (3.2)
8. Testing framework คู่ขนานกับข้อ 6–7 (3.6)
9. ผูก gradSchool weighting + fallback relaxation (3.4, 3.5)
10. Benchmark report + สรุปผลเขียนเล่ม (3.3)

---

## คำถาม/ความเสี่ยงที่ต้องตัดสินใจกับอาจารย์ก่อนเริ่ม

- หลักสูตร 2570 ยังไม่ finalize — ใช้ draft ไปก่อนได้ไหม หรือต้องรอฉบับทางการ
- มีงบ/สิทธิ์ใช้ LLM API (เช่น Anthropic/OpenAI) ไหม หรือต้องใช้ open-source model รันเอง (ผลต่อ cost และ architecture ของ backend)
- Pilot user กลุ่มไหน (คำถามอาจารย์ข้อ 2 ใน scopeAdvisor.md) — นักศึกษาปี 1 จริง หรือ simulate ด้วย mock profile หลายแบบไปก่อน
