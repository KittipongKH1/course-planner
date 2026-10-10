// Very small rule-based "Intent Extraction" module.
// In Phase 2 (RM) ของสโคป นี่คือจุดที่จะสลับมาใช้ semantic search / LLM จริง
// ตอนนี้ (Phase 1 prototype) ใช้ keyword matching ล้วน ๆ เพื่อแปลงข้อความภาษาธรรมชาติ
// เป็นเงื่อนไขตัวแปร (track, hoursPerWeek, honors, gradSchool)

import { TRACKS } from '../data/curriculum.js';

const TRACK_KEYWORDS = {
  FRONTEND: ['front-end', 'frontend', 'front end', 'หน้าบ้าน', 'ui', 'ux'],
  FULLSTACK: ['full-stack', 'fullstack', 'full stack', 'เว็บ', 'web dev', 'เขียนเว็บ'],
  DATA: ['data scientist', 'data engineer', 'นักวิทยาการข้อมูล', 'data', 'ข้อมูล'],
  AI: ['ai', 'ปัญญาประดิษฐ์', 'machine learning', 'ml', 'deep learning'],
  DEVOPS: ['devops', 'system admin', 'ผู้ดูแลระบบ', 'cloud', 'infra'],
  SECURITY: ['security', 'cyber', 'ความปลอดภัย', 'แฮก', 'hacker'],
  GAMEDEV: ['game', 'เกม', 'animation', 'แอนิเมชัน'],
  MOBILE: ['mobile', 'มือถือ', 'แอนดรอยด์', 'android', 'ios app'],
};

export function extractIntent(text) {
  const lower = text.toLowerCase();
  const result = { track: null, hoursPerWeek: null, honors: null, gradSchool: null, partTimeJob: null };

  for (const [trackId, keywords] of Object.entries(TRACK_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      result.track = trackId;
      break;
    }
  }

  // hours per week: look for patterns like "วันละ 2 ชั่วโมง" (~14/wk), "สัปดาห์ละ 10 ชั่วโมง", "10 ชม./สัปดาห์"
  const perDay = lower.match(/วันละ\s*(\d+)\s*ชั่วโมง/);
  const perWeek = lower.match(/(\d+)\s*(ชั่วโมง|ชม\.?)\s*(ต่อ|\/|)\s*สัปดาห์/);
  const justNumberHours = lower.match(/(\d+)\s*(ชั่วโมง|ชม\.?)/);
  if (perDay) result.hoursPerWeek = parseInt(perDay[1], 10) * 7;
  else if (perWeek) result.hoursPerWeek = parseInt(perWeek[1], 10);
  else if (justNumberHours) result.hoursPerWeek = parseInt(justNumberHours[1], 10);

  if (lower.includes('พาร์ทไทม์') || lower.includes('ทำงานพิเศษ') || lower.includes('part-time') || lower.includes('part time')) {
    result.partTimeJob = true;
    if (result.hoursPerWeek === null) result.hoursPerWeek = 10; // conservative default
  }

  if (lower.includes('เกียรตินิยม') || lower.includes('honors') || lower.includes('เกรดสูง')) {
    result.honors = true;
  }

  if (lower.includes('เรียนต่อ') || lower.includes('ป.โท') || lower.includes('grad school') || lower.includes('วิจัย')) {
    result.gradSchool = true;
  }

  return result;
}

export function trackLabel(trackId) {
  return TRACKS[trackId]?.label ?? trackId;
}

// สายหลัก + สายรอง เช่น "AI Engineer + Data Scientist / Data Engineer"
export function tracksLabel(tracks = []) {
  return tracks.map(trackLabel).join(' + ');
}
