import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import { COURSES, COURSE_MAP, termLabel } from '../data/curriculum.js';
import { saveTranscriptRemote } from '../services/api.js';
import { forecastGraduation, generateOfficialPlan, unmetPrereqs } from '../utils/scheduler.js';
import SegmentedControl from './SegmentedControl.jsx';

const STATUS_OPTIONS = [
  { id: 'none', label: 'ยังไม่เรียน' },
  { id: 'completed', label: 'ผ่านแล้ว', tone: 'success' },
  { id: 'failed', label: 'ตก/ถอน', tone: 'warning' },
];

const RISK_LABEL = { low: 'ความเสี่ยงต่ำ', medium: 'ความเสี่ยงปานกลาง', high: 'ความเสี่ยงสูง' };
const RISK_TONE = { low: 'success', medium: 'warning', high: 'danger' };

function courseStatus(code, completed, failed) {
  if (completed.has(code)) return 'completed';
  if (failed.has(code)) return 'failed';
  return 'none';
}

// จัดกลุ่มวิชาของปีเดียวกันแยกตามเทอม — sem = term % 10 คือ 1 หรือ 2 เสมอ (ตามโครงสร้างหลักสูตร ไม่มีปีไหนมีมากกว่า 2 เทอม)
function groupBySem(courses) {
  const bySem = {};
  courses.forEach((c) => {
    const sem = (c.term ?? 11) % 10;
    bySem[sem] = bySem[sem] || [];
    bySem[sem].push(c);
  });
  return Object.entries(bySem)
    .map(([sem, semCourses]) => ({ sem: Number(sem), courses: semCourses }))
    .sort((a, b) => a.sem - b.sem);
}

export default function TranscriptPanel({ completed, setCompleted, failed, setFailed, constraints }) {
  const [studentCode, setStudentCode] = useState('demo-student-001');
  const [analysis, setAnalysis] = useState(null);
  const [pendingCode, setPendingCode] = useState(null);

  const years = useMemo(() => {
    const byYear = {};
    COURSES.forEach((c) => {
      const year = Math.floor((c.term ?? 11) / 10);
      byYear[year] = byYear[year] || [];
      byYear[year].push(c);
    });
    return Object.entries(byYear)
      .map(([year, courses]) => ({ year: Number(year), terms: groupBySem(courses) }))
      .sort((a, b) => a.year - b.year);
  }, []);

  // ปีที่มีความคืบหน้าแล้ว (มีวิชาผ่าน/ตกอยู่) รวมถึงปี 1 เสมอ จะเปิด accordion ไว้ default — ปีอนาคตพับเก็บ
  const openUpToYear = useMemo(() => {
    const touched = [...completed, ...failed]
      .map((code) => Math.floor((COURSE_MAP[code]?.term ?? 11) / 10))
      .filter(Boolean);
    return touched.length ? Math.max(1, ...touched) : 1;
  }, [completed, failed]);

  const earnedCredits = useMemo(
    () => [...completed].reduce((sum, code) => sum + (COURSE_MAP[code]?.credits ?? 0), 0),
    [completed]
  );

  // ผลกระทบต่อเวลาจบทันทีที่เปลี่ยนสถานะ (อิงแผนทางการ + วิชาที่ต้องลงใหม่) — ไม่ต้องสลับไปแท็บ Dashboard
  const forecast = useMemo(() => {
    const { plan } = generateOfficialPlan([...completed], {
      tracks: constraints.tracks,
      yearPathPreference: constraints.yearPathPreference,
      offeringPolicy: constraints.offeringPolicy,
      retakeCodes: [...failed],
    });
    return forecastGraduation({ plan, completedCodes: completed, failedCodes: failed, startTerm: 11 });
  }, [completed, failed, constraints.tracks, constraints.yearPathPreference, constraints.offeringPolicy]);

  async function setStatus(code, status) {
    // อัปเดต local state ทันที (ไม่ต้องรอ backend) — Dashboard คำนวณแผนใหม่ได้เลย
    if (status === 'completed') {
      const course = COURSE_MAP[code];
      const missing = course ? unmetPrereqs(course, completed) : [];
      if (missing.length > 0) {
        setAnalysis({
          result: {
            riskLevel: 'high',
            warnings: [
              `ยังทำเครื่องหมาย "ผ่านแล้ว" ให้ ${course.code} (${course.nameTh}) ไม่ได้ เพราะยังไม่ผ่านวิชาก่อนหน้า: ${missing
                .map((p) => (COURSE_MAP[p] ? `${p} (${COURSE_MAP[p].nameTh})` : p))
                .join(', ')} — กรุณาทำเครื่องหมาย "ผ่านแล้ว" ให้วิชาก่อนหน้าให้ครบก่อน`,
            ],
          },
          source: 'validation',
          courseCode: code,
        });
        return; // hard gate — ไม่แตะ completed/failed state และไม่ยิง request ไป backend
      }
      setCompleted((prev) => new Set(prev).add(code));
      setFailed((prev) => {
        if (!prev.has(code)) return prev;
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    } else if (status === 'failed') {
      setFailed((prev) => new Set(prev).add(code));
      setCompleted((prev) => {
        if (!prev.has(code)) return prev;
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    } else {
      setCompleted((prev) => {
        if (!prev.has(code)) return prev;
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
      setFailed((prev) => {
        if (!prev.has(code)) return prev;
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
      return; // "ยังไม่เรียน" ไม่มีสถานะให้บันทึก/วิเคราะห์ที่ backend
    }

    setPendingCode(code);
    try {
      const { analysis: result } = await saveTranscriptRemote({
        studentCode,
        courseCode: code,
        status,
        constraints,
      });
      setAnalysis({ ...result, courseCode: code });
    } catch (err) {
      setAnalysis({
        result: { riskLevel: 'medium', warnings: [`ไม่สามารถเชื่อมต่อ backend ได้ (${err.message}) — สถานะวิชาถูกอัปเดตในเครื่องแล้ว แผนการเรียนจะคำนวณใหม่ตามนี้ ลองรัน npm run dev:all เพื่อบันทึกลง SQLite และดู AI risk analysis`] },
        source: 'error',
        courseCode: code,
      });
    } finally {
      setPendingCode(null);
    }
  }

  return (
    <div className="stack">
      <section className="summary-strip" aria-label="สรุปผลการเรียน">
        <div className="summary-stat">
          <span className="value tabular">{earnedCredits}</span>
          <span className="label">หน่วยกิตสะสม</span>
        </div>
        <div className="summary-stat">
          <span className="value tabular">{completed.size}</span>
          <span className="label">วิชาที่ผ่านแล้ว</span>
        </div>
        <div className="summary-stat">
          <span className={`value tabular ${failed.size > 0 ? 'danger' : ''}`}>{failed.size}</span>
          <span className="label">วิชาที่ต้องลงใหม่</span>
        </div>
        <div className="summary-stat">
          <span className={`value ${forecast.onTime ? '' : 'warning'}`}>
            {forecast.gradTerm ? termLabel(forecast.gradTerm) : '–'}
          </span>
          <span className="label">
            คาดว่าจบ{forecast.onTime ? ' (ตามกำหนด)' : ` (ช้า ${forecast.delaySemesters} เทอม)`}
          </span>
        </div>
        <label className="field-stack summary-input">
          <span>รหัสนักศึกษา (จำลอง)</span>
          <input className="input" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
        </label>
      </section>

      <p className="hint">
        เลือกสถานะแต่ละวิชา — "ตก/ถอน" จะให้ AI (KKUIntelSphere หรือ rule-based fallback) ประเมินความเสี่ยง
        และหน้าแผนการเรียนจะจัดวิชานั้นไปลงใหม่ในเทอมที่เปิดสอนถัดไปให้อัตโนมัติ (ทั้งแผนหลักสูตรและแผน GA)
      </p>

      {years.map(({ year, terms }) => {
        const allCourses = terms.flatMap((t) => t.courses); // รวมยอดทั้งปีไว้โชว์ใน summary header เหมือนเดิม
        return (
          <details key={year} className="year-accordion" open={year <= openUpToYear}>
            <summary>
              <ChevronDown className="accordion-chevron" size={18} aria-hidden="true" />
              <span>ปีการศึกษาที่ {year}</span>
              <span className="year-meta">
                {allCourses.filter((c) => completed.has(c.code)).length}/{allCourses.length} วิชาผ่านแล้ว
                {allCourses.some((c) => failed.has(c.code)) && ` · ${allCourses.filter((c) => failed.has(c.code)).length} วิชาต้องลงใหม่`}
              </span>
            </summary>

            {terms.map(({ sem, courses }) => (
              <div key={sem}>
                <div className="term-subheading">
                  <span>เทอม {sem}</span>
                  <span className="term-subheading-meta">
                    {courses.filter((c) => completed.has(c.code)).length}/{courses.length} วิชาผ่านแล้ว
                    {courses.some((c) => failed.has(c.code)) && ` · ${courses.filter((c) => failed.has(c.code)).length} วิชาต้องลงใหม่`}
                  </span>
                </div>
                <div className="year-body">
                  {courses.map((c) => {
                    const missingForCompleted = completed.has(c.code) ? [] : unmetPrereqs(c, completed);
                    const rowOptions = STATUS_OPTIONS.map((opt) =>
                      opt.id === 'completed' && missingForCompleted.length > 0
                        ? { ...opt, disabled: true, title: `ต้องผ่านก่อน: ${missingForCompleted.join(', ')}` }
                        : opt
                    );
                    return (
                      <div key={c.code} className="course-row">
                        <span
                          className={`course-row-name ${failed.has(c.code) ? 'retake' : ''}`}
                          title={c.nameTh}
                        >
                          <span className="mono-code">{c.code}</span>
                          <span>{c.nameEn}</span>
                          {pendingCode === c.code && <Loader2 className="spin" size={14} aria-label="กำลังบันทึก" />}
                        </span>
                        <SegmentedControl
                          size="sm"
                          label={`สถานะของ ${c.code}`}
                          options={rowOptions}
                          value={courseStatus(c.code, completed, failed)}
                          onChange={(status) => setStatus(c.code, status)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </details>
        );
      })}

      {analysis && (
        <section className="panel risk-panel" aria-live="polite">
          <h2 className="panel-title">
            <Activity size={18} aria-hidden="true" />
            วิเคราะห์ความเสี่ยงจากผลการเรียน
          </h2>
          <p className="hint">
            จากการเปลี่ยนสถานะ <strong>{analysis.courseCode}</strong> ล่าสุด · แหล่งวิเคราะห์: {analysis.source}
          </p>
          <span className={`risk-level ${RISK_TONE[analysis.result?.riskLevel] ?? ''}`}>
            {RISK_LABEL[analysis.result?.riskLevel] ?? analysis.result?.riskLevel}
          </span>
          <ul className="warnings">
            {(analysis.result?.warnings ?? []).map((w, i) => (
              <li key={i} className="notice warning">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
