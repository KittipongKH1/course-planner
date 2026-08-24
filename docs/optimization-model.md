# นิยามคณิตศาสตร์ของปัญหา — Scheduling Optimization Engine

เอกสารนี้ตอบคำถามอาจารย์ใน `scopeAdvisor.md` ที่ขอให้ "flesh out the mathematical definition of your
constraints for the scheduling problem" ก่อนเริ่มเขียนโค้ด optimization engine — ใช้เป็นฐานทั้งสำหรับ
เล่มวิจัยและสำหรับออกแบบ fitness function ของ Genetic Algorithm ใน `server/optimizer/ga.js`

## Sets และ Parameters

- `C` = เซตของรายวิชาทั้งหมดในหลักสูตร (จาก `src/data/curriculum.js`)
- `T` = เซตของเทอมที่เป็นไปได้ (ปี 1 เทอม 1 ถึงปี ≥4 เทอม 2, เข้ารหัสเป็น `year*10 + semester`)
- `prereq(c) ⊆ C` = เซตของวิชาที่เป็นเงื่อนไขก่อนของวิชา `c`
- `credits(c)` = จำนวนหน่วยกิตของวิชา `c`
- `load(c) ∈ {1,2,3}` = ดัชนีภาระทางปัญญา (Cognitive Load Index) ของวิชา `c`
- `tracks(c) ⊆ Tracks` = สายอาชีพที่วิชา `c` เกี่ยวข้อง
- `theoretical(c) ∈ {0,1}` = วิชานี้เป็นวิชาทฤษฎี/วิจัยหรือไม่ (ใช้เมื่อ `gradSchool = true`)
- `completed ⊆ C` = วิชาที่นักศึกษาผ่านแล้ว (จาก mock/live transcript)
- `hoursPerWeek` = ชั่วโมงว่างต่อสัปดาห์ที่นักศึกษาระบุ
- `maxLoad(hoursPerWeek)` = งบภาระต่อเทอม คำนวณจาก `loadBudgetFromHours()` (`src/utils/scheduler.js`)
- `honors, gradSchool, track` = เงื่อนไขส่วนบุคคลจาก Chat/Constraints panel

## ตัวแปรตัดสินใจ

```
x[c][t] ∈ {0, 1}   สำหรับ c ∈ C \ completed, t ∈ T
x[c][t] = 1  ก็ต่อเมื่อ นักศึกษาลงทะเบียนวิชา c ในเทอม t
```

## Hard Constraints

1. **แต่ละวิชาถูกจัดลงเทอมได้ครั้งเดียว**
   `Σ_t x[c][t] = 1   ∀c ∈ target`
   (โดย `target` = วิชาบังคับทั้งหมด + วิชาเลือกตามสายอาชีพจนครบเป้าหมายหน่วยกิต — คำนวณจาก `selectTargetCourses()`)

2. **Prerequisite ordering (Critical Path constraint)**
   `x[c][t] = 1  ⟹  ∀p ∈ prereq(c): Σ_{t' < t} x[p][t'] = 1  ∨  p ∈ completed`
   (วิชา `c` ลงได้ในเทอม `t` ก็ต่อเมื่อทุกวิชาก่อนหน้าผ่านมาแล้วก่อนเทอม `t`)

3. **Credit cap ต่อเทอม**
   `Σ_c credits(c)·x[c][t] ≤ maxCreditsPerTerm   ∀t`  (ค่าเริ่มต้น 19 หน่วยกิต)

4. **Cognitive-load cap ต่อเทอม (Work-Study Balance for Gen Z)**
   `Σ_c load(c)·x[c][t] ≤ maxLoad(hoursPerWeek) · (0.85 ถ้า honors=true)`
   (honors ลดงบภาระลง 15% เพื่อลดความเสี่ยงติด F/W)

## Objective Function

```
minimize:  W1 · terms_used
         + W2 · Σ_t variance(load ต่อเทอม)
         − W3 · Σ_c theoretical(c)·x[c][t]·earliness(t)     (เฉพาะเมื่อ gradSchool = true)
```

โดย `terms_used` = จำนวนเทอมที่มีวิชาถูกจัดอย่างน้อย 1 วิชา, `earliness(t)` ให้ค่าเป็นบวกมากขึ้นถ้า
`t` อยู่ใกล้จุดเริ่มแผน (ผลักวิชาทฤษฎี/วิจัยให้มาเรียนเร็วขึ้นเมื่อมีเป้าหมายเรียนต่อ)

## Fallback / Constraint Relaxation

เมื่อไม่มีคำตอบที่ satisfy hard constraint #4 ได้ (เช่น `hoursPerWeek` ต่ำมากรวมกับ track ที่วิชาหนัก)
ระบบจะ **ผ่อนคลาย (relax) constraint #4 ทีละขั้น** (`maxLoad += 2` ต่อครั้ง สูงสุด 6 ครั้ง — ดู
`MAX_LOAD_RELAXATIONS` ใน `server/optimizer/ga.js`) ก่อนจะยอมรับว่าหาคำตอบไม่ได้ และรายงาน
`warnings` ให้ผู้ใช้เห็นว่า relax อะไรไปกี่ครั้ง — ตอบคำถามอาจารย์เรื่อง "fallback strategy" ที่ระบุไว้
ใน `scopeAdvisor.md`

Constraint #2 (prerequisite) **ไม่มีการ relax** เพราะเป็นข้อเท็จจริงทางวิชาการที่ละเมิดไม่ได้ — ถ้าหา
คำตอบไม่ได้เพราะ prereq ระบบจะรายงานเป็น `type: 'bottleneck'` แทน

## จาก ILP formulation สู่ Genetic Algorithm

รอบการพัฒนานี้เลือก implement เป็น **Genetic Algorithm** (`server/optimizer/ga.js`) แทนที่จะแก้ปัญหา
ILP ตรง ๆ ด้วย solver (เช่น OR-Tools CP-SAT) เพราะไม่ต้องพึ่ง backend ภาษาที่สอง (ดูเหตุผลใน
`แผนพัฒนา-Phase2-3.md`) — การออกแบบ chromosome/decoder ใน `ga.js` แปลง constraint #1-2 ให้เป็น
"guarantee โดยโครงสร้าง" (decoder ไม่มีทางสร้างคำตอบที่ละเมิด prereq ได้เลย) ส่วน GA ทำหน้าที่ค้นหา
ลำดับความสำคัญของวิชาที่ทำให้ objective function ข้างต้นดีที่สุด — เทียบเท่ากับการแก้ปัญหาบน reduced
search space ที่ตัด infeasible region ออกไปแล้วโดย decoder เอง

CP-SAT/ILP แบบ exact ยังคงเป็นงานต่อยอดที่วางแผนไว้ (ดู M ถัดไปใน `แผนพัฒนา-Phase2-3.md`) เพื่อ
เปรียบเทียบ (benchmark) กับ GA ตามที่อาจารย์แนะนำ
