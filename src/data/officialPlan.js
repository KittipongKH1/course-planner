// แผนการศึกษาอย่างเป็นทางการ ตามเอกสารหลักสูตร (ตัวอย่างแผนการศึกษา ชั้นปีที่ 1-4)
// นี่คือ "โครงกระดูก" ที่ตายตัว ระบบจะลงวิชาบังคับตามนี้ก่อนเสมอ
// ส่วน "วิชาเลือกเฉพาะทาง" (elective slot) ในแต่ละเทอม จะถูกเลือกเติมตามสายอาชีพที่ผู้ใช้สนใจภายหลัง

export const OFFICIAL_PLAN = [
  {
    term: 11, yearLabel: 'ปี 1 เทอม 1',
    required: ['LI101001', 'GE341511', 'GE321415', 'SC401201', 'CP351001', 'CP351002'],
    electiveCredits: 0,
  },
  {
    term: 12, yearLabel: 'ปี 1 เทอม 2',
    required: ['LI101002', 'CP001001', 'SC002104', 'SC401202', 'CP351003', 'CP351004'],
    electiveCredits: 3,
  },
  {
    term: 21, yearLabel: 'ปี 2 เทอม 1',
    required: ['LI102003', 'GE363789', 'SC402101', 'SC602005', 'CP352001', 'CP352002'],
    electiveCredits: 3,
  },
  {
    term: 22, yearLabel: 'ปี 2 เทอม 2',
    required: ['LI102004', 'SC402401', 'CP352003', 'CP352004', 'CP352005', 'CP352006'],
    electiveCredits: 3,
  },
  {
    term: 31, yearLabel: 'ปี 3 เทอม 1',
    required: ['GE362785', 'SC403602', 'CP353001', 'CP353002', 'CP353003', 'CP353761'],
    electiveCredits: 3,
  },
  {
    term: 32, yearLabel: 'ปี 3 เทอม 2',
    required: ['GE142145', 'CP353004', 'CP353005', 'CP353764', 'CP353796'],
    electiveCredits: 6,
    coopExtra: ['CP002001'], // เฉพาะสายที่จะเลือกสหกิจศึกษา ต้องลงเพิ่ม (ไม่นับหน่วยกิต)
  },
  // ปี 4: มี 3 เส้นทางให้เลือก — โครงงานล้วน, สหกิจ-เทอมต้น, สหกิจ-เทอมปลาย
  {
    term: 41, yearLabel: 'ปี 4 เทอม 1 (ต้น)',
    project: { required: ['CP354771'], freeElectiveCredits: 6 },
    coop_early: { required: ['CP354785'], freeElectiveCredits: 0, note: 'ไปสหกิจเทอมนี้เลย — ต้องเก็บวิชาบังคับ/เลือกอื่น ๆ ให้ครบตั้งแต่ปี 1-3 ก่อน ไม่ต้องลง Project 1' },
    coop_late: { required: ['CP354771'], freeElectiveCredits: 6 },
  },
  {
    term: 42, yearLabel: 'ปี 4 เทอม 2 (ปลาย)',
    project: { required: ['CP354772'], freeElectiveCredits: 0 },
    coop_early: { required: [], freeElectiveCredits: 6, note: 'ไปสหกิจไปแล้วเทอมก่อน เทอมนี้เก็บวิชาเลือกเสรีที่เหลือ (ถ้ามี)' },
    coop_late: { required: ['CP354785'], freeElectiveCredits: 0, note: 'ไปสหกิจแทน Project 2' },
  },
];

export const YEAR4_PATHS = {
  project: 'แผนโครงงานทางวิทยาการคอมพิวเตอร์ (Project I & II)',
  coop_early: 'แผนสหกิจศึกษา — ไปเทอมต้น (ปี 4/1)',
  coop_late: 'แผนสหกิจศึกษา — ไปเทอมปลาย (ปี 4/2)',
};
