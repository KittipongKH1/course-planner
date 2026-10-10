# Research Gap Analysis — งานวิจัยอ้างอิงและสิ่งที่ควรปรับในโครงงาน

วิเคราะห์เมื่อ 11 ต.ค. 2569 โดยเทียบ 3 แหล่ง: (1) โจทย์ของอาจารย์ใน `scopeAdvisor.md` (Career-driven Track + 4 Core
Problems) (2) เล่มรายงาน `progress1.md` (3) โค้ดจริงใน `src/` และ `server/` — แล้วค้นงานวิจัยมาอ้างอิงในแต่ละประเด็น

> เลขอ้างอิงต่อจากเล่มเดิม (เล่มใช้ [1]–[10] แล้ว) งานใหม่จึงเริ่มที่ [11] — รายการเต็มอยู่ท้ายเอกสาร

---

## สรุปสั้น: 7 จุดที่ขาด (เรียงตามความสำคัญ)

| # | ช่องว่าง | ระดับ | ทำไมสำคัญ |
|---|---|---|---|
| 1 | เล่มเขียนว่าใช้ **RAG** แต่โค้ดไม่มี RAG เลย | 🔴 สูงมาก | กรรมการเปิดโค้ดเทียบเล่มแล้วจะเจอทันที — ความน่าเชื่อถือทั้งเล่มเสีย |
| 2 | **"Career-driven"** ไม่ได้อยู่ใน optimizer — การเลือกวิชาเลือกตามสายอาชีพเป็น greedy ก่อนเข้า GA | 🔴 สูงมาก | เป็นคำแรกของชื่อโครงงาน แต่ไม่ได้ถูก optimize จริง |
| 3 | ไม่มี **exact method (ILP)** เทียบกับ GA — ไม่รู้ว่า GA ห่างจากคำตอบดีที่สุดเท่าไร | 🟠 สูง | อาจารย์ขอให้ benchmark GA/ASP/ILP ตรง ๆ และอุปสรรคเดิม (ต้องใช้ Python) แก้ได้แล้ว |
| 4 | **Cognitive Load Index (1–3)** และ `loadBudgetFromHours()` ตั้งค่าเอง ไม่มีที่มา | 🟠 สูง | เป็นแกนของ Work-Study Balance (Core Problem ข้อ 3) แต่ไม่มีหลักฐานรองรับ |
| 5 | **วัตถุประสงค์ข้อ 4 (ประเมินผล) ยังไม่เริ่ม** — ไม่มี metric, ไม่มีผู้ใช้จริง | 🟠 สูง | ไม่มีส่วนนี้ = ไม่มี "ผลการวิจัย" |
| 6 | น้ำหนักใน fitness function (12, 500, 15, 4, 2) ไม่มีเหตุผลรองรับ | 🟡 กลาง | กรรมการจะถามว่า "ทำไม 12 ไม่ใช่ 10" |
| 7 | ทบทวนวรรณกรรมขาดงานด้าน **course planning optimization**, **workload** และ **work-study** | 🟡 กลาง | ตารางเปรียบเทียบ (ตารางที่ 1) ไม่มีคอลัมน์ของ Core Problem ข้อ 3–4 ที่อาจารย์ให้มา |

---

## 1. RAG: เล่มกับโค้ดไม่ตรงกัน 🔴

**สิ่งที่พบ**
- บทคัดย่อ, วัตถุประสงค์ข้อ 2, ขอบเขตข้อ 1, Keywords และข้อ 5.2.2 ("ฐานข้อมูลเวกเตอร์") เขียนว่าระบบใช้ RAG
- แต่ใน `server/ai/` มีแค่ intent extraction (ข้อความ → JSON) และ transcript risk analysis — ไม่มี retriever,
  embedding หรือ vector store เลย (ค้นทั้ง `src/` และ `server/` ไม่เจอโค้ดส่วนนี้)

**งานวิจัยที่เกี่ยวข้อง**
- Husain et al. [10] (อยู่ในเล่มแล้ว) และ RAGAS [19] — ถ้าจะอ้างว่าใช้ RAG ต้องวัดผลด้วย metric เช่น
  Faithfulness, Answer Relevance, Context Precision

**ทางเลือก (ต้องเลือกอย่างใดอย่างหนึ่ง)**
- **ก. ทำ RAG จริงแบบเบา (แนะนำ):** ข้อมูลพร้อมอยู่แล้ว — `โครงสร้างหลักสูตร.md` มีคำอธิบายรายวิชาครบ
  1. ตัดคำอธิบายรายวิชาเป็น chunk ละ 1 วิชา
  2. Retriever: เริ่มด้วย BM25/keyword ใน JS ก่อน (ไม่ต้องมี vector DB) แล้วค่อยเพิ่ม embedding ถ้า KKUIntelSphere
     มี embedding endpoint
  3. ใส่ chunk ที่ได้ลง prompt ตอนนักศึกษาถามเรื่องรายวิชา
  4. ทำชุดคำถามทดสอบ 30–50 ข้อ แล้ววัดด้วยแนวคิดของ RAGAS [19]
- **ข. ตัด RAG ออกจากเล่ม:** เปลี่ยนเป็น "LLM-based Intent Extraction" ให้ตรงกับที่ทำจริง — ง่ายกว่า แต่ความโดดเด่น
  ในตารางเปรียบเทียบจะลดลง

---

## 2. "Career-driven" ยังไม่ได้อยู่ในการ optimize 🔴

**สิ่งที่พบ**
- `selectTargetCourses()` (`src/utils/scheduler.js:103`) เลือกวิชาเลือกตามสายอาชีพแบบ greedy: เรียงตามเทอม
  แล้วหยิบไปเรื่อย ๆ จนครบ 15 หน่วยกิต — **ก่อน** ส่งเข้า GA
- `scoreFitness()` (`server/optimizer/ga.js:115`) ไม่มีเทอมใดเกี่ยวกับสายอาชีพเลย GA ทำหน้าที่แค่ "จัดลงเทอม"
  ไม่ได้ "เลือกวิชา"
- การจับคู่วิชา ↔ สายอาชีพ (`tracks: [...]` ใน `curriculum.js`) ผู้พัฒนากำหนดเอง ไม่มีแหล่งอ้างอิง

**งานวิจัยที่เกี่ยวข้อง**
- Parameswaran et al. [11]: งาน CourseRank (Stanford) — การแนะนำรายวิชาภายใต้ข้อกำหนดหลักสูตรเป็นปัญหา **NP-hard**
  ต้องเลือกวิชาที่ "ทั้งผ่านเงื่อนไขและเป็นที่ต้องการ" ไปพร้อมกัน — ใช้อ้างได้เลยว่าการเลือกวิชาเลือกเป็นส่วนหนึ่ง
  ของปัญหา optimization ไม่ควรแยกเป็น greedy
- Mohamed [12]: IDiSC — วางแผนการเรียนระยะยาวด้วย mathematical optimization โดยชั่งน้ำหนักความต้องการนักศึกษา
  กับคำแนะนำอาจารย์ที่ปรึกษา
- ACM/IEEE/AAAI CS2023 [16]: กรอบ Knowledge Areas/Competencies มาตรฐาน — ใช้เป็นฐานจับคู่วิชากับสายอาชีพแทนการ
  กำหนดเอง
- UniSkill [17]: ชุดข้อมูลจับคู่ learning outcome ของรายวิชากับทักษะอาชีพตาม ESCO taxonomy

**สิ่งที่ควรทำ**
1. ย้ายการเลือกวิชาเลือกเข้าไปใน optimizer: ให้ chromosome มีส่วน "เลือกวิชาเลือกชุดไหน" ด้วย หรือให้ ILP มีตัวแปร
   `y[c] ∈ {0,1}` (เลือกวิชา c หรือไม่) พร้อม constraint `Σ credits(c)·y[c] ≥ 15`
2. เพิ่มเทอม **career relevance** ใน objective เช่น `+ W · Σ relevance(c, track)·y[c]` โดย `relevance ∈ [0,1]`
   ไม่ใช่แค่มี/ไม่มี
3. ให้ `relevance` มีที่มา: จับคู่คำอธิบายรายวิชากับ Knowledge Area ของ CS2023 [16] หรือกับทักษะในประกาศรับสมัครงาน
   ของแต่ละสายอาชีพ (ใช้ LLM ช่วยจับคู่ได้ แล้วให้อาจารย์ตรวจทาน) — จะได้งานส่วน AI ที่มีความหมายมากกว่า chatbot

---

## 3. ยังไม่มี Exact Method มาเทียบกับ GA 🟠

**สิ่งที่พบ**
- `docs/optimization-model.md` มีสูตร ILP ครบแล้ว แต่ยังไม่ได้ implement — เหตุผลที่ระบุไว้คือ "ต้องใช้ Python/OR-Tools"
- Benchmark ตอนนี้เทียบแค่ GA กับ greedy จึงบอกได้ว่า GA "ดีกว่า greedy" แต่ไม่รู้ว่า "ห่างจาก optimum แค่ไหน"

**งานวิจัยที่เกี่ยวข้อง**
- Charoenruengkit [13] (มศว, งานไทย): วางแผนรายวิชาด้วย **ILP** พร้อม conditional constraints และเสนอดัชนีคุณภาพ
  การแนะแนว `%Q`
- StudyPlanner, TU Munich [14]: ใช้ integer programming วางแผนรายวิชา ตัวแปรแบบเดียวกับของคุณ (`x[c][t]`) และ
  objective คือลดจำนวนเทอม/หน่วยกิต
- Srisamutr et al. [4] (อยู่ในเล่มแล้ว): GA วางแผนรายวิชา

**สิ่งที่ควรทำ — อุปสรรคเรื่อง Python ไม่มีแล้ว**
- ใช้ **`glpk.js`** หรือ **`highs-js`** ซึ่งเป็น MILP solver แบบ WebAssembly รันใน Node ได้เลย [18] ไม่ต้องมี backend
  Python ไม่ต้องเพิ่มภาษาที่สอง
- นำสูตรใน `docs/optimization-model.md` มาเขียนเป็น `server/optimizer/ilp.js`
- เพิ่มคอลัมน์ใน benchmark: **optimality gap** = `(GA − ILP) / ILP` และเวลาคำนวณ
- ผลที่ได้เป็นข้อค้นพบวิจัยจริง: "GA ได้คำตอบห่างจาก optimum X% ใช้เวลาน้อยกว่า Y เท่า" หรือ "ILP แก้ได้ภายใน
  เวลาที่ใช้งานจริงได้ จึงไม่จำเป็นต้องใช้ GA" — ผลออกมาแบบไหนก็เขียนเล่มได้

---

## 4. Cognitive Load Index ต้องมีที่มา 🟠

**สิ่งที่พบ**
- `load: 1|2|3` ใน `curriculum.js` ผู้พัฒนากำหนดเอง
- `loadBudgetFromHours()` (`src/utils/scheduler.js:52`) แปลงชั่วโมงว่างเป็นงบภาระแบบขั้นบันได (16/22/28/34) ไม่มีที่มา
- เล่มอ้างแค่ Sweller [5] ซึ่งเป็นทฤษฎีระดับหน่วยความจำใช้งาน (working memory) ไม่ใช่ภาระงานระดับเทอม

**ข้อมูลจริงที่มีอยู่แล้วในโปรเจกต์**
`โครงสร้างหลักสูตร.md` ระบุหน่วยกิตเป็นรูปแบบ `หน่วยกิต(บรรยาย-ปฏิบัติ-ศึกษาด้วยตนเอง)` ชั่วโมง/สัปดาห์ เช่น:

| รูปแบบ | จำนวนวิชา | ชั่วโมง/สัปดาห์รวม |
|---|---:|---:|
| 3(3-0-6) | 77 | 9 |
| 3(2-2-5) | 72 | 9 |
| 1(0-2-2) | 4 | 4 |
| 3(0-9-6) | 3 | 15 |
| 6(0-18-9) | 2 | 27 |

**งานวิจัยที่เกี่ยวข้อง**
- Borchers & Pardos [15]: สำรวจภาระงานที่นักศึกษารับรู้ 596 รายการ (UC Berkeley) พบว่า **หน่วยกิตอย่างเดียวอธิบาย
  ภาระงานได้น้อย** ต้องดูปัจจัยอื่นประกอบ เช่น จำนวนงานที่มอบหมาย — สนับสนุนว่าควรมี load index แยกจากหน่วยกิต
  แต่ต้องวัดจากข้อมูล ไม่ใช่ตั้งเอง
- Al-Twijri [20]: สร้าง Course Difficulty Index จากข้อมูลผลการเรียนในอดีต และใช้กำหนดค่าความยากสูงสุดต่อเทอม
  ตรงกับแนวคิด load cap ของคุณ
- Huntington-Klein & Gill [21]: ฉบับ working paper **ไม่พบหลักฐาน**ว่าการลงหน่วยกิตมากต่อเทอมทำให้ผลการเรียนแย่ลง —
  เป็นข้อโต้แย้งที่ต้องรู้ไว้ เพราะ load cap ของคุณตั้งอยู่บนสมมติฐานตรงข้าม (ควรอ้างแล้วอธิบายว่าทำไมยังจำกัดภาระ
  เช่น เพราะกลุ่มเป้าหมายทำงานพาร์ทไทม์ ซึ่งต่างจากกลุ่มตัวอย่างของงานนั้น)

**สิ่งที่ควรทำ**
1. **แยก 2 ค่า:** (ก) `weeklyHours(c)` = บรรยาย+ปฏิบัติ+ศึกษาเอง ดึงจากเอกสารหลักสูตรตรง ๆ เป็นข้อมูลทางการ
   (ข) `difficulty(c)` = ความยาก ซึ่งต้องปรับเทียบ (calibrate) จากข้อมูลจริง
2. **ทำให้งบภาระมีหน่วยเป็น "ชั่วโมง":** constraint #4 กลายเป็น `Σ weeklyHours(c)·x[c][t] ≤ ชั่วโมงที่นักศึกษามี`
   อธิบายได้ทันทีโดยไม่มีตัวเลขลอย ๆ แบบ 16/22/28/34 (ต้องนิยาม `hoursPerWeek` ในแชทให้ชัดว่าหมายถึง
   ชั่วโมงเรียนรวม ไม่ใช่ชั่วโมงว่าง)
3. **ปรับเทียบ `difficulty`:** ทำแบบสอบถามนักศึกษารุ่นพี่ให้ให้คะแนนความหนักของแต่ละวิชาที่เคยเรียน (แบบเดียวกับ
   [15]) หรือขอสถิติอัตรา F/W รายวิชาจากภาควิชา (แบบเดียวกับ [20])

---

## 5. Work-Study Balance (Core Problem ข้อ 3) ยังไม่มีงานวิจัยรองรับ 🟡

**สิ่งที่พบ:** ในเล่มไม่มีงานวิจัยด้านนักศึกษาที่ทำงานระหว่างเรียนเลย ทั้งที่เป็น 1 ใน 4 ปัญหาที่อาจารย์กำหนด

**งานวิจัยที่เกี่ยวข้อง**
- Neyt et al. [22]: review ผลของการทำงานระหว่างเรียน (Journal of Economic Surveys, 2019) — พบว่าการทำงานส่งผลเสีย
  ต่อ **การมีส่วนร่วมในการเรียนและการตัดสินใจเรียนต่อ** มากกว่าผลการเรียน และผลเสียชัดขึ้นเมื่อทำงานหนัก (intensive work)
  — ใช้เป็นเหตุผลว่าทำไมระบบต้องจำกัดภาระเมื่อนักศึกษาทำงานหลายชั่วโมง

**สิ่งที่ควรทำ:** เพิ่มหัวข้อ 2.1.6 "การทำงานระหว่างเรียนกับผลลัพธ์ทางการศึกษา" ในบทที่ 2 แล้วอ้าง [21][22] คู่กัน
(มุมที่สนับสนุนและมุมที่แย้ง) ทำให้ทบทวนวรรณกรรมมีน้ำหนักกว่าการอ้างทฤษฎีด้านเดียว

---

## 6. การประเมินผล (วัตถุประสงค์ข้อ 4) 🟠

**สิ่งที่พบ:** ตารางที่ 8–10 ในเล่มยังเป็น "รอทดสอบ" / "ยังไม่เริ่ม" — ทั้งที่โค้ดมี unit test 24 เคสและผล benchmark
แล้ว (ควรอัปเดตเล่มส่วนนี้ด้วย) และคำถามของอาจารย์เรื่อง "ใครเป็นคนทดสอบ" ยังไม่มีคำตอบ

**กรอบการประเมินที่เสนอ (4 ด้าน)**

| ด้าน | วิธีวัด | อ้างอิง |
|---|---|---|
| คุณภาพแผน (algorithm) | benchmark Greedy vs GA vs ILP บน synthetic profile **≥ 100 แบบ** (สุ่มสายอาชีพ/ชั่วโมง/วิชาที่ตก) รายงาน mean ± SD, optimality gap, เวลา + ทดสอบนัยสำคัญ (เช่น Wilcoxon) | [13][14] |
| ความถูกต้องเทียบผู้เชี่ยวชาญ | ให้อาจารย์ที่ปรึกษา 3–5 ท่านประเมินแผนที่ระบบสร้าง 10–20 แผน (มาตราส่วน 5 ระดับ) | Laoniatkul & Boonpho [23] ใช้วิธีนี้ (ผู้เชี่ยวชาญให้ค่าเฉลี่ย 4.77) |
| ความแม่นของการสกัด intent | ทำชุดประโยคภาษาไทย 50–100 ประโยคพร้อมคำตอบที่ถูก วัด accuracy แยกตาม field (track, hours, honors, gradSchool) เทียบ LLM กับ rule-based | NL4Opt [24] พบว่า LLM สกัดเงื่อนไขผิดได้ (coefficient ผิด, ตัวแปรหาย) จึงต้องวัด |
| ความใช้งานได้ (usability) | SUS กับนักศึกษา 15–30 คน (เกณฑ์เฉลี่ยทั่วไป ≈ 68) | Brooke [25], Bangor et al. [26] |

ข้อสุดท้ายตอบคำถามอาจารย์ข้อ 2 (pilot) ได้: ทดลองกับนักศึกษาจริงกลุ่มเล็ก + synthetic profile จำนวนมากสำหรับส่วน
algorithm

---

## 7. น้ำหนักใน Fitness Function 🟡

**สิ่งที่พบ:** `scoreFitness()` ใช้ค่า `12, 500, 15, 4, 2` (`server/optimizer/ga.js:130-142`) โดยไม่มีที่มา

**สิ่งที่ควรทำ (เลือก 1 ทาง)**
- **Sensitivity analysis:** ปรับน้ำหนักทีละตัว ±50% แล้วดูว่าแผนเปลี่ยนไหม — ถ้าไม่เปลี่ยนมาก แสดงว่าระบบ robust
  (ทำง่ายที่สุด ใช้ benchmark script เดิมได้)
- **Multi-objective (NSGA-II [27]):** ไม่รวมเป้าหมายเป็นค่าเดียว แต่หา Pareto front ระหว่าง "จบเร็ว" กับ "ภาระสมดุล"
  แล้วให้นักศึกษาเลือกเอง — เข้ากับแนวคิด personalization และเป็นจุดเด่นเชิงวิจัย

---

## 8. Data Cold-Start (คำถามอาจารย์ข้อ 1) — งานต่อยอดใน Project 2

ตอนนี้นักศึกษาใหม่ใช้ค่า default ทั้งหมด งานด้าน **grade prediction** (Polyzou & Karypis [28]) ทำนายเกรดวิชาถัดไปจาก
เกรดวิชาก่อนหน้า ใช้ประเมินความเสี่ยงของแผนได้หลังนักศึกษาเรียนผ่าน 1–2 เทอม — สำหรับปี 1 เทอม 1 ให้ใช้แผนแบบ
conservative (load ต่ำ) แล้วปรับหลังได้เกรดเทอมแรก (ต่อยอดจาก Dynamic Re-planning ที่มีอยู่แล้ว) — ต้องมีข้อมูล
เกรดย้อนหลังจากภาควิชา จึงเหมาะเป็นงาน Project 2

---

## 9. ข้อแก้เล็ก ๆ ในเล่ม (`progress1.md`)

- บทคัดย่อภาษาอังกฤษ: `Kittipong Khotsa and .` — ขาดชื่อผู้แต่งคนที่ 2 (นายพชธกร ไพรนารี)
- Keywords ทั้งไทย/อังกฤษลงท้ายด้วย `,` — ยังไม่ครบ
- ตารางที่ 10 เขียนว่า "ทบทวนวรรณกรรม 8 แหล่ง" แต่หัวข้อ 2.2 มี 7 งาน
- ข้อ 5.2.2 พูดถึง "ฐานข้อมูลเวกเตอร์" ซึ่งระบบไม่มี (ดูข้อ 1)
- ส่วน 4.4 ควรใส่ผล unit test 24 เคสและตาราง benchmark จริงแทน "รอทดสอบ"
- บทนำ/ตารางเปรียบเทียบอ้างแค่ 2 Core Problem (Critical Path, Scheduling) ทั้งที่อาจารย์ให้มา 4 ข้อ

---

## ตารางเปรียบเทียบงานวิจัยฉบับปรับปรุง (แทนตารางที่ 1 ในเล่ม)

เพิ่มคอลัมน์ให้ครบ 4 Core Problem ของอาจารย์ + สายอาชีพ + วิธีแก้ปัญหา (✓ = มี, – = ไม่มี)

| งานวิจัย | LLM/RAG | DAG / Critical Path | Scheduling Opt. | วิธี | Workload / Work-Study | Career Track | Dynamic Re-plan |
|---|:-:|:-:|:-:|---|:-:|:-:|:-:|
| Assayed et al. [6] | ✓ | – | – | – | – | – | – |
| Mi et al. [9] SmartCourse | ✓ | – | – | – | – | – | ✓ |
| Heileman et al. [2] | – | ✓ | – | metrics | – | – | – |
| Srisamutr et al. [4] | – | ✓ | ✓ | GA | – | – | – |
| Parameswaran et al. [11] | – | ✓ | ✓ | exact + heuristic | – | – | – |
| Mohamed [12] | – | ✓ | ✓ | math. optimization | – | – | – |
| Charoenruengkit [13] | – | ✓ | ✓ | ILP | – | – | – |
| Borchers & Pardos [15] | – | – | – | analytics | ✓ | – | – |
| **โครงงานนี้ (เป้าหมาย)** | ✓ | ✓ | ✓ | **GA + ILP** | ✓ | ✓ | ✓ |

> ช่อง "Career Track" และ "Workload" เป็นจุดที่ทำให้งานนี้ต่างจากงานอื่น แต่จะอ้างได้จริงก็ต่อเมื่อแก้ข้อ 2 และ 4 แล้ว

---

## ลำดับงานที่แนะนำ

| ลำดับ | งาน | ข้อ | ขนาดงาน |
|---|---|---|---|
| 1 | ตัดสินใจเรื่อง RAG (ทำจริง หรือแก้เล่ม) | 1 | เล็ก–กลาง |
| 2 | แก้ข้อผิดพลาดเล็ก ๆ ในเล่ม + อัปเดตผลทดสอบ | 9 | เล็ก |
| 3 | ILP ด้วย `glpk.js`/`highs-js` + optimality gap ใน benchmark | 3 | กลาง |
| 4 | ดึง `weeklyHours` จาก `(บรรยาย-ปฏิบัติ-ศึกษาเอง)` + เปลี่ยนงบภาระเป็นหน่วยชั่วโมง | 4 | เล็ก–กลาง |
| 5 | ย้ายการเลือกวิชาเลือกเข้า optimizer + career relevance score | 2 | กลาง–ใหญ่ |
| 6 | เพิ่มงานวิจัยในบทที่ 2 + ตารางเปรียบเทียบใหม่ | 5, 7 | เล็ก |
| 7 | กรอบการประเมิน 4 ด้าน (เริ่มจาก benchmark ≥100 profile + intent test set) | 6 | กลาง |
| 8 | Sensitivity analysis ของน้ำหนัก | 7 | เล็ก |

---

## เอกสารอ้างอิงเพิ่มเติม (ต่อจาก [10] ในเล่ม)

> ตรวจสอบข้อมูลบรรณานุกรมจากหน้าเว็บของแต่ละงานแล้ว ยกเว้น [26] และ [27] ที่ข้อมูลเล่ม/หน้ามาจากความรู้เดิม ก่อนใส่เล่มจริงควรเปิดอ่าน
> ฉบับเต็มอีกครั้ง โดยเฉพาะ [21] ที่อ่านได้เฉพาะ working paper (ฉบับตีพิมพ์ต้องเข้าผ่านห้องสมุด)

[11] A. G. Parameswaran, P. Venetis, and H. Garcia-Molina, "Recommendation systems with complex constraints: A course
recommendation perspective," *ACM Transactions on Information Systems*, vol. 29, no. 4, pp. 20:1–20:33, 2011,
doi: 10.1145/2037661.2037665.

[12] A. Mohamed, "A decision support model for long-term course planning," *Decision Support Systems*, vol. 74,
pp. 33–45, 2015, doi: 10.1016/j.dss.2015.03.002.

[13] W. Charoenruengkit, "Course planning optimization with conditional constraints using integer linear programming,"
in *ACM International Conference Proceeding Series*, 2018, pp. 71–76, doi: 10.1145/3284497.3284506.

[14] TU Munich, "StudyPlanner: Helping students to plan university courses with integer programming," EURO Practice
Forum 2026 (slides). [Online]. Available: https://www.euro-online.org/websites/or-in-practice/wp-content/uploads/sites/8/2026/05/EuroPF2026_C4_TUMunich_Wiese.pdf

[15] C. Borchers and Z. A. Pardos, "Insights into undergraduate pathways using course load analytics," in *Proc. 13th
International Learning Analytics and Knowledge Conference (LAK '23)*, 2023, pp. 219–229, doi: 10.1145/3576050.3576081.

[16] ACM/IEEE-CS/AAAI Joint Task Force, *Computer Science Curricula 2023 (CS2023)*, 2024. [Online]. Available:
https://csed.acm.org/

[17] "UniSkill: A dataset for matching university curricula to professional competencies," arXiv:2603.03134, 2026.

[18] jvail, "glpk.js: GLPK for browser & node (WebAssembly)," npm package. [Online]. Available:
https://www.npmjs.com/package/glpk.js — ทางเลือก: highs-js, https://github.com/coder0xff/highs-js

[19] S. Es, J. James, L. Espinosa-Anke, and S. Schockaert, "RAGAs: Automated evaluation of retrieval augmented
generation," in *Proc. 18th Conference of the EACL: System Demonstrations*, 2024, pp. 150–158.

[20] M. I. Al-Twijri, "Modelling course difficulty indexes to enhance students performance and course study plans,"
Ph.D. dissertation, Dept. Computer Science and AI, Universidad de Granada, 2022. [Online]. Available:
https://hdl.handle.net/10481/75974

[21] N. Huntington-Klein and A. Gill, "Semester course load and student performance," *Research in Higher Education*,
vol. 62, pp. 623–650, 2021, doi: 10.1007/s11162-020-09614-8.

[22] B. Neyt, E. Omey, D. Verhaest, and S. Baert, "Does student work really affect educational outcomes? A review of
the literature," *Journal of Economic Surveys*, vol. 33, no. 3, pp. 896–921, 2019.

[23] จามรกุล เหล่าเกียรติกุล และ วุฒินันท์ บุญโพธิ์, "A development of decision support system for optimized study
planning in higher education," *International Journal of Applied Computer Technology and Information Systems*,
vol. 1, no. 2, 2012.

[24] R. Ramamonjison et al., "NL4Opt competition: Formulating optimization problems based on their natural language
descriptions," in *Proc. NeurIPS 2022 Competitions Track*, PMLR 220, 2022.

[25] J. Brooke, "SUS: A 'quick and dirty' usability scale," in *Usability Evaluation in Industry*, London: Taylor &
Francis, 1996, pp. 189–194.

[26] A. Bangor, P. Kortum, and J. Miller, "Determining what individual SUS scores mean: Adding an adjective rating
scale," *Journal of Usability Studies*, vol. 4, no. 3, pp. 114–123, 2009.

[27] K. Deb, A. Pratap, S. Agarwal, and T. Meyarivan, "A fast and elitist multiobjective genetic algorithm: NSGA-II,"
*IEEE Transactions on Evolutionary Computation*, vol. 6, no. 2, pp. 182–197, 2002.

[28] A. Polyzou and G. Karypis, "Grade prediction with models specific to students and courses," *International
Journal of Data Science and Analytics*, 2016, doi: 10.1007/s41060-016-0024-z.

### ลิงก์ที่ใช้ค้นข้อมูล

- [Parameswaran et al. — TOIS 2011](https://ir.webis.de/anthology/2011.tois_journal-ir0anthology0volumeA29A4.3/)
- [Mohamed — DSS 2015](https://datalearner.com/academic/journal-papers/0167-9236/volumes-and-issues/236/paper-detail/4133)
- [Charoenruengkit — ILP course planning (SWU)](https://ir.swu.ac.th/entities/publication/f21bc834-fcb8-446b-9a1a-58a6f0576018)
- [StudyPlanner — TU Munich](https://www.euro-online.org/websites/or-in-practice/wp-content/uploads/sites/8/2026/05/EuroPF2026_C4_TUMunich_Wiese.pdf)
- [Borchers & Pardos — arXiv 2212.09974](https://arxiv.org/abs/2212.09974v1)
- [CS2023 — ACM](https://www.acm.org/articles/bulletins/2024/june/cs2023-curricular-guidelines)
- [UniSkill — arXiv](https://arxiv.org/html/2603.03134v1)
- [glpk.js — npm](https://www.npmjs.com/package/glpk.js), [highs-js — GitHub](https://github.com/coder0xff/highs-js)
- [RAGAs — ACL Anthology](https://aclanthology.org/2024.eacl-demo.16)
- [Al-Twijri — Course Difficulty Indexes](https://produccioncientifica.ugr.es/documentos/6407e4e2664b5416d589e11c?lang=en)
- [Huntington-Klein & Gill — IDEAS](https://ideas.repec.org/a/spr/reihed/v62y2021i5d10.1007_s11162-020-09614-8.html), [working paper](https://business.fullerton.edu/academics/Economics/assets/CSUF_WP_9-18_upd.pdf)
- [Neyt et al. — IZA DP 11023](https://iza.org/publications/dp/11023)
- [Laoniatkul & Boonpho — ThaiJO](https://ph01.tci-thaijo.org/index.php/IJACTIS/article/view/98803)
- [NL4Opt — PMLR](https://proceedings.mlr.press/v220/ramamonjison23a.html)
- [SUS — Bangor et al. 2009](https://uxpajournal.org/wp-content/uploads/sites/7/pdf/JUS_Bangor_May2009.pdf)
- [Polyzou & Karypis — arXiv](https://arxiv.org/pdf/1906.00792)
