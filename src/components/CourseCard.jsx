import { AlertTriangle, Gauge, Link2, Plus, RotateCcw } from 'lucide-react';
import { TRACKS } from '../data/curriculum.js';
import { ELECTIVE_SOURCES } from '../utils/scheduler.js';

export default function CourseCard({ course, downstreamCount = 0, isCritical = false, retake = false, electiveSource }) {
  const primaryTrack = course.tracks?.[0] ? TRACKS[course.tracks[0]] : null;
  const filled = electiveSource === 'related' || electiveSource === 'other';
  return (
    <div className={`course-card ${isCritical ? 'critical' : ''} ${retake ? 'retake' : ''}`} title={course.nameTh}>
      <div className="course-card-top">
        <span className="course-code">
          {primaryTrack && <span className="track-dot" style={{ background: primaryTrack.color }} title={primaryTrack.label} />}
          {course.code}
        </span>
        <span className="course-credits">{course.credits} นก.</span>
      </div>
      <div className="course-name">{course.nameEn}</div>
      <div className="course-meta">
        <span className="badge" title={`ภาระการเรียน (Cognitive Load Index) ${course.load} จาก 3`}>
          <Gauge size={13} aria-hidden="true" /> {course.load}/3
        </span>
        {downstreamCount > 0 && (
          <span className="badge" title={`ปลดล็อกวิชาที่ต่อยอด ${downstreamCount} วิชา`}>
            <Link2 size={13} aria-hidden="true" /> {downstreamCount}
          </span>
        )}
        {isCritical && (
          <span className="badge critical" title="อยู่บนเส้นทางวิกฤต — ถ้าเลื่อน จะจบช้า">
            <AlertTriangle size={13} aria-hidden="true" /> วิกฤต
          </span>
        )}
        {retake && (
          <span className="badge danger" title="เคยตก/ถอน — ระบบจัดให้ลงใหม่ในเทอมนี้">
            <RotateCcw size={13} aria-hidden="true" /> ลงใหม่
          </span>
        )}
        {filled && (
          <span className="badge" title="วิชาเลือกของสายที่เลือกมีไม่พอ ระบบจึงเติมวิชานี้จากกลุ่มใกล้เคียง — เปลี่ยนเป็นวิชาอื่นได้">
            <Plus size={13} aria-hidden="true" /> {ELECTIVE_SOURCES[electiveSource]}
          </span>
        )}
      </div>
    </div>
  );
}
