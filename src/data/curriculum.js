// Curriculum Graph Data
// Source: หลักสูตร วท.บ. วิทยาการคอมพิวเตอร์ (ปรับปรุง พ.ศ. 2565) วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น
// Node = รายวิชา (course), Edge = Prerequisite
// `load` = ดัชนีภาระทางปัญญา (Cognitive Load Index) โดยประมาณ 1 (เบา) - 3 (หนัก)
// `term` = ปี-ภาคเรียนตามแผนการศึกษาแนะนำ (ใช้เป็นค่าเริ่มต้น/baseline สำหรับ critical path)

export const TRACKS = {
  FRONTEND: { id: 'FRONTEND', label: 'Front-End Developer', color: '#6366f1' },
  FULLSTACK: { id: 'FULLSTACK', label: 'Full-Stack Web', color: '#0ea5e9' },
  DATA: { id: 'DATA', label: 'Data Scientist / Data Engineer', color: '#10b981' },
  AI: { id: 'AI', label: 'AI Engineer', color: '#8b5cf6' },
  DEVOPS: { id: 'DEVOPS', label: 'DevOps / System Admin', color: '#f59e0b' },
  SECURITY: { id: 'SECURITY', label: 'Cyber Security', color: '#ef4444' },
  GAMEDEV: { id: 'GAMEDEV', label: 'Game / Multimedia Developer', color: '#ec4899' },
  MOBILE: { id: 'MOBILE', label: 'Mobile App Developer', color: '#14b8a6' },
};

// helper: term encoded as year*10+semester, e.g. 11 = year1 sem1
export const COURSES = [
  // ---------- General Education ----------
  { code: 'LI101001', nameTh: 'ภาษาอังกฤษ 1', nameEn: 'English I', credits: 3, prereq: [], category: 'GenEd', term: 11, load: 1, tracks: [] },
  { code: 'LI101002', nameTh: 'ภาษาอังกฤษ 2', nameEn: 'English II', credits: 3, prereq: ['LI101001'], category: 'GenEd', term: 12, load: 1, tracks: [] },
  { code: 'LI102003', nameTh: 'ภาษาอังกฤษ 3', nameEn: 'English III', credits: 3, prereq: ['LI101002'], category: 'GenEd', term: 21, load: 1, tracks: [] },
  { code: 'LI102004', nameTh: 'ภาษาอังกฤษ 4', nameEn: 'English IV', credits: 3, prereq: ['LI102003'], category: 'GenEd', term: 22, load: 1, tracks: [] },
  { code: 'GE321415', nameTh: 'ทักษะการเรียนรู้', nameEn: 'Learning Skills', credits: 3, prereq: [], category: 'GenEd', term: 11, load: 1, tracks: [] },
  { code: 'GE341511', nameTh: 'การคิดเชิงคำนวณและเชิงสถิติสำหรับเอบีซีดี', nameEn: 'Computational & Statistical Thinking for ABCD', credits: 3, prereq: [], category: 'GenEd', term: 11, load: 2, tracks: [] },
  { code: 'CP001001', nameTh: 'เอบีซีดีสำหรับทุกวิชาชีพ', nameEn: 'ABCD for All Professions', credits: 3, prereq: [], category: 'GenEd', term: 12, load: 1, tracks: [] },
  { code: 'GE363789', nameTh: 'ผู้ประกอบการสร้างสรรค์', nameEn: 'Creative Entrepreneurs', credits: 3, prereq: [], category: 'GenEd', term: 21, load: 1, tracks: [] },
  { code: 'GE362785', nameTh: 'การคิดเชิงสร้างสรรค์และการแก้ปัญหา', nameEn: 'Creative Thinking and Problem Solving', credits: 3, prereq: [], category: 'GenEd', term: 31, load: 1, tracks: [] },
  { code: 'GE142145', nameTh: 'ภาวะผู้นำและการจัดการ', nameEn: 'Leadership and Management', credits: 3, prereq: [], category: 'GenEd', term: 32, load: 1, tracks: [] },

  // ---------- Math & Science core ----------
  { code: 'SC002104', nameTh: 'วิทยาศาสตร์กายภาพ', nameEn: 'Physical Science', credits: 3, prereq: [], category: 'Math/Sci', term: 12, load: 2, tracks: [] },
  { code: 'SC401201', nameTh: 'แคลคูลัสสำหรับวิทยาศาสตร์กายภาพ 1', nameEn: 'Calculus for Physical Science 1', credits: 3, prereq: [], category: 'Math/Sci', term: 11, load: 2, tracks: [] },
  { code: 'SC401202', nameTh: 'แคลคูลัสสำหรับวิทยาศาสตร์กายภาพ 2', nameEn: 'Calculus for Physical Science 2', credits: 3, prereq: ['SC401201'], category: 'Math/Sci', term: 12, load: 2, tracks: [] },
  { code: 'SC402101', nameTh: 'พีชคณิตเชิงเส้น 1', nameEn: 'Linear Algebra 1', credits: 3, prereq: [], category: 'Math/Sci', term: 21, load: 2, tracks: [] },
  { code: 'SC602005', nameTh: 'ความน่าจะเป็นและสถิติ', nameEn: 'Probability and Statistics', credits: 3, prereq: [], category: 'Math/Sci', term: 21, load: 2, tracks: ['DATA', 'AI'] },
  { code: 'SC402401', nameTh: 'วิยุตคณิตและการประยุกต์', nameEn: 'Discrete Mathematics and Applications', credits: 3, prereq: ['SC401201'], category: 'Math/Sci', term: 22, load: 2, tracks: [] },
  { code: 'SC403602', nameTh: 'วิธีเชิงตัวเลขสำหรับวิทยาการคอมพิวเตอร์', nameEn: 'Numerical Methods for Computer Science', credits: 3, prereq: ['SC401201'], category: 'Math/Sci', term: 31, load: 2, tracks: [], theoretical: true },

  // ---------- CS core (critical spine) ----------
  { code: 'CP351001', nameTh: 'วิทยาการคอมพิวเตอร์หลักมูล', nameEn: 'Fundamental Computer Science', credits: 3, prereq: [], category: 'CoreCS', term: 11, load: 2, tracks: [] },
  { code: 'CP351002', nameTh: 'การเขียนโปรแกรมเชิงโครงสร้าง', nameEn: 'Structure Programming for CS', credits: 3, prereq: [], category: 'CoreCS', term: 11, load: 3, tracks: [] },
  { code: 'CP351003', nameTh: 'การเขียนโปรแกรมเชิงวัตถุ', nameEn: 'Object Oriented Programming', credits: 3, prereq: ['CP351001'], category: 'CoreCS', term: 12, load: 3, tracks: [] },
  { code: 'CP351004', nameTh: 'สถาปัตยกรรมคอมพิวเตอร์', nameEn: 'Computer Architecture', credits: 3, prereq: [], category: 'CoreCS', term: 12, load: 2, tracks: ['DEVOPS'] },
  { code: 'CP352001', nameTh: 'โครงสร้างข้อมูล', nameEn: 'Data Structures', credits: 3, prereq: ['CP351001'], category: 'CoreCS', term: 21, load: 3, tracks: [] },
  { code: 'CP352002', nameTh: 'การออกแบบประสบการณ์ผู้ใช้', nameEn: 'User Experience Design', credits: 3, prereq: ['CP351001'], category: 'CoreCS', term: 21, load: 2, tracks: ['FRONTEND'] },
  { code: 'CP352003', nameTh: 'ระบบจัดการฐานข้อมูลและการออกแบบฐานข้อมูล', nameEn: 'Database Management System and Design', credits: 3, prereq: [], category: 'CoreCS', term: 22, load: 2, tracks: ['FULLSTACK', 'DATA'] },
  { code: 'CP352004', nameTh: 'ปฏิบัติการระบบฐานข้อมูลและการออกแบบ', nameEn: 'Database System and Design Lab', credits: 1, prereq: [], category: 'CoreCS', term: 22, load: 1, tracks: ['FULLSTACK', 'DATA'] },
  { code: 'CP352005', nameTh: 'เครือข่ายคอมพิวเตอร์', nameEn: 'Computer Networks', credits: 3, prereq: [], category: 'CoreCS', term: 22, load: 2, tracks: ['DEVOPS', 'SECURITY'] },
  { code: 'CP352006', nameTh: 'การวิเคราะห์ขั้นตอนวิธี', nameEn: 'Analysis of Algorithms', credits: 3, prereq: ['CP352001'], category: 'CoreCS', term: 22, load: 3, tracks: [], theoretical: true },
  { code: 'CP353001', nameTh: 'ระบบปฏิบัติการและการเขียนโปรแกรมซีสเต็มคอล', nameEn: 'Operating Systems and System Calls', credits: 3, prereq: ['CP351004'], category: 'CoreCS', term: 31, load: 3, tracks: ['DEVOPS'] },
  { code: 'CP353002', nameTh: 'หลักการออกแบบพัฒนาซอฟต์แวร์', nameEn: 'Principles of Software Design and Development', credits: 3, prereq: ['CP351003'], category: 'CoreCS', term: 31, load: 2, tracks: ['FULLSTACK'] },
  { code: 'CP353003', nameTh: 'ปัญญาประดิษฐ์', nameEn: 'Artificial Intelligence', credits: 3, prereq: [], category: 'CoreCS', term: 31, load: 3, tracks: ['AI', 'DATA'] },
  { code: 'CP353761', nameTh: 'สัมมนาทางวิทยาการคอมพิวเตอร์', nameEn: 'Seminar in Computer Science', credits: 1, prereq: [], category: 'CoreCS', term: 31, load: 1, tracks: [] },
  { code: 'CP353004', nameTh: 'วิศวกรรมซอฟต์แวร์', nameEn: 'Software Engineering', credits: 3, prereq: ['CP353002'], category: 'CoreCS', term: 32, load: 3, tracks: ['FULLSTACK'] },
  { code: 'CP353005', nameTh: 'ทฤษฎีการคำนวณ', nameEn: 'Theory of Computation', credits: 3, prereq: ['CP352001'], category: 'CoreCS', term: 32, load: 3, tracks: [], theoretical: true },
  { code: 'CP353764', nameTh: 'ระเบียบวิธีวิจัย', nameEn: 'Research Methodology', credits: 3, prereq: [], category: 'CoreCS', term: 32, load: 2, tracks: [] },
  { code: 'CP353796', nameTh: 'การฝึกงานทางวิทยาการคอมพิวเตอร์', nameEn: 'Internship in Computer Science', credits: 0, prereq: [], category: 'CoreCS', term: 32, load: 2, tracks: [] },
  { code: 'CP354771', nameTh: 'โครงงานทางวิทยาการคอมพิวเตอร์ 1', nameEn: 'Computer Science Project I', credits: 3, prereq: ['CP353004'], category: 'Project', term: 41, load: 3, tracks: [] },
  { code: 'CP354772', nameTh: 'โครงงานทางวิทยาการคอมพิวเตอร์ 2', nameEn: 'Computer Science Project II', credits: 3, prereq: ['CP354771'], category: 'Project', term: 42, load: 3, tracks: [] },
  { code: 'CP002001', nameTh: 'การเตรียมความพร้อมสหกิจศึกษา', nameEn: 'Co-op Orientation', credits: 0, prereq: [], category: 'Project', term: 32, load: 1, tracks: [] },
  { code: 'CP354785', nameTh: 'สหกิจศึกษาทางวิทยาการคอมพิวเตอร์', nameEn: 'Co-Operative Education in CS', credits: 6, prereq: ['CP002001'], category: 'Project', term: 42, load: 3, tracks: [] },

  // ---------- Elective group 1: AI & Data Science ----------
  { code: 'CP351101', nameTh: 'วิทยาการคำนวณ', nameEn: 'Computational Science', credits: 3, prereq: [], category: 'Elective-AI/Data', term: 21, load: 2, tracks: ['AI', 'DATA'] },
  { code: 'CP352101', nameTh: 'วิทยาการข้อมูลขั้นแนะนำ', nameEn: 'Introduction to Data Science', credits: 3, prereq: [], category: 'Elective-AI/Data', term: 22, load: 2, tracks: ['DATA'] },
  { code: 'CP352103', nameTh: 'การเขียนโปรแกรมเชิงแข่งขัน', nameEn: 'Competitive Programming', credits: 3, prereq: ['CP352001'], category: 'Elective-AI/Data', term: 22, load: 3, tracks: ['AI', 'DATA'] },
  { code: 'CP353101', nameTh: 'วิศวกรรมข้อมูล', nameEn: 'Data Engineering', credits: 3, prereq: ['CP352003'], category: 'Elective-AI/Data', term: 31, load: 3, tracks: ['DATA'] },
  { code: 'CP353102', nameTh: 'เครื่องจักรเรียนรู้เบื้องต้น', nameEn: 'Introduction to Machine Learning', credits: 3, prereq: ['CP353003', 'SC602005'], category: 'Elective-AI/Data', term: 31, load: 3, tracks: ['AI', 'DATA'], theoretical: true },
  { code: 'CP353103', nameTh: 'การวิเคราะห์และการประยุกต์ข้อมูล', nameEn: 'Data Analytics and Application', credits: 3, prereq: ['CP352101'], category: 'Elective-AI/Data', term: 31, load: 2, tracks: ['DATA'] },
  { code: 'CP353108', nameTh: 'โครงข่ายประสาทและการเรียนรู้เชิงลึก', nameEn: 'Neural Network and Deep Learning', credits: 3, prereq: ['CP353102'], category: 'Elective-AI/Data', term: 32, load: 3, tracks: ['AI'], theoretical: true },
  { code: 'CP353109', nameTh: 'การประมวลผลภาษาธรรมชาติ', nameEn: 'Natural Language Processing', credits: 3, prereq: ['CP353102'], category: 'Elective-AI/Data', term: 32, load: 3, tracks: ['AI'], theoretical: true },
  { code: 'CP353112', nameTh: 'การวิเคราะห์ข้อมูลขนาดใหญ่', nameEn: 'Big Data Analytics', credits: 3, prereq: ['CP353101'], category: 'Elective-AI/Data', term: 32, load: 3, tracks: ['DATA'] },

  // ---------- Elective group 2: Multimedia & Application Development ----------
  { code: 'CP351201', nameTh: 'คอมพิวเตอร์แอนิเมชัน', nameEn: 'Computer Animation', credits: 3, prereq: [], category: 'Elective-Media/App', term: 21, load: 2, tracks: ['GAMEDEV'] },
  { code: 'CP351202', nameTh: 'องค์ประกอบของการพัฒนาโมบายแอปพลิเคชัน', nameEn: 'Elements of Mobile Application Development', credits: 3, prereq: [], category: 'Elective-Media/App', term: 21, load: 2, tracks: ['MOBILE'] },
  { code: 'CP351203', nameTh: 'การเขียนโปรแกรมเว็บและการประยุกต์ใช้', nameEn: 'Web Programming and Application', credits: 3, prereq: [], category: 'Elective-Media/App', term: 21, load: 2, tracks: ['FRONTEND', 'FULLSTACK'] },
  { code: 'CP352202', nameTh: 'การเขียนโปรแกรมสำหรับโมบายแอปพลิเคชัน', nameEn: 'Programming for Mobile Application', credits: 3, prereq: ['CP351202'], category: 'Elective-Media/App', term: 22, load: 3, tracks: ['MOBILE'] },
  { code: 'CP352203', nameTh: 'การพัฒนาเกมคอมพิวเตอร์', nameEn: 'Computer Game Development', credits: 3, prereq: ['CP351201'], category: 'Elective-Media/App', term: 22, load: 3, tracks: ['GAMEDEV'] },
  { code: 'CP352204', nameTh: 'การวิเคราะห์และออกแบบระบบ', nameEn: 'System Analysis and Design', credits: 3, prereq: [], category: 'Elective-Media/App', term: 22, load: 2, tracks: ['FULLSTACK', 'FRONTEND'] },
  { code: 'CP353201', nameTh: 'การประกันคุณภาพซอฟต์แวร์', nameEn: 'Software Quality Assurance', credits: 3, prereq: [], category: 'Elective-Media/App', term: 31, load: 2, tracks: ['FULLSTACK'] },
  { code: 'CP353204', nameTh: 'การพัฒนาโปรแกรมประยุกต์บนเว็บ', nameEn: 'Web Application Development', credits: 3, prereq: ['CP351203'], category: 'Elective-Media/App', term: 31, load: 3, tracks: ['FRONTEND', 'FULLSTACK'] },
  { code: 'CP353206', nameTh: 'วิธีรูปนัยสำหรับทวนสอบซอฟต์แวร์', nameEn: 'Formal Method for Software Verification', credits: 3, prereq: [], category: 'Elective-Media/App', term: 32, load: 3, tracks: [], theoretical: true },

  // ---------- Elective group 3: Systems, Networks & Infrastructure ----------
  { code: 'CP352301', nameTh: 'การเขียนโปรแกรมสคริปต์', nameEn: 'Script Programming', credits: 3, prereq: [], category: 'Elective-Systems', term: 22, load: 2, tracks: ['DEVOPS'] },
  { code: 'CP362301', nameTh: 'ตรรกะดิจิทัลและระบบฝังตัว', nameEn: 'Digital Logic and Embedded Systems', credits: 3, prereq: ['CP351004'], category: 'Elective-Systems', term: 31, load: 3, tracks: ['DEVOPS'] },
  { code: 'CP353301', nameTh: 'การเชื่อมต่ออินเทอร์เน็ต', nameEn: 'Internetworking', credits: 3, prereq: ['CP352005'], category: 'Elective-Systems', term: 31, load: 3, tracks: ['DEVOPS', 'SECURITY'] },
  { code: 'CP353302', nameTh: 'ความมั่นคงสารสนเทศและไซเบอร์', nameEn: 'Information and Cyber Security', credits: 3, prereq: ['CP352005'], category: 'Elective-Systems', term: 31, load: 3, tracks: ['SECURITY'] },
  { code: 'CP353303', nameTh: 'วิทยาการเข้ารหัสลับและความมั่นคงระบบเครือข่าย', nameEn: 'Cryptography and Network Security', credits: 3, prereq: ['CP353302'], category: 'Elective-Systems', term: 32, load: 3, tracks: ['SECURITY'] },
  { code: 'CP353305', nameTh: 'อินเทอร์เน็ตของสรรพสิ่ง', nameEn: 'Internet of Things', credits: 3, prereq: [], category: 'Elective-Systems', term: 31, load: 2, tracks: ['DEVOPS'] },
  { code: 'CP353306', nameTh: 'วิศวกรรม DevOps', nameEn: 'DevOps Engineering', credits: 3, prereq: ['CP352005'], category: 'Elective-Systems', term: 32, load: 3, tracks: ['DEVOPS'] },
  { code: 'CP363305', nameTh: 'การประมวลผลแบบกลุ่มเมฆและการประยุกต์', nameEn: 'Cloud Computing and Application', credits: 3, prereq: ['CP352005'], category: 'Elective-Systems', term: 32, load: 2, tracks: ['DEVOPS'] },
];

export const COURSE_MAP = Object.fromEntries(COURSES.map((c) => [c.code, c]));

export function getCourse(code) {
  return COURSE_MAP[code];
}

export function termLabel(term) {
  const year = Math.floor(term / 10);
  const sem = term % 10;
  return `ปี ${year} เทอม ${sem}`;
}
