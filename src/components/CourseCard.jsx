import { TRACKS } from '../data/curriculum.js';

export default function CourseCard({ course, downstreamCount = 0, isCritical = false, retake = false }) {
  const primaryTrack = course.tracks?.[0] ? TRACKS[course.tracks[0]] : null;
  return (
    <div
      className={`course-card ${isCritical ? 'critical' : ''} ${retake ? 'retake' : ''}`}
      style={{ borderLeftColor: retake ? '#f59e0b' : primaryTrack?.color ?? '#94a3b8' }}
      title={course.nameTh}
    >
      <div className="course-card-top">
        <span className="course-code">{course.code}</span>
        <span className="course-credits">{course.credits} หน่วยกิต</span>
      </div>
      <div className="course-name">{course.nameEn}</div>
      <div className="course-meta">
        <span className="badge-icon" title={`Cognitive Load Index: ${course.load}/3`}>⚡ {course.load}/3</span>
        {downstreamCount > 0 && (
          <span className="badge-icon info" title={`ปลดล็อกวิชาที่ต่อยอด ${downstreamCount} วิชา`}>
            🔗 {downstreamCount}
          </span>
        )}
        {isCritical && <span className="badge-icon danger" title="วิชาคอขวด — อยู่บน Critical Path">⚠ คอขวด</span>}
        {retake && <span className="badge-icon warning" title="เคยตก/ถอน — ระบบจัดให้ลงใหม่ในเทอมนี้">🔁 ลงใหม่</span>}
      </div>
    </div>
  );
}
