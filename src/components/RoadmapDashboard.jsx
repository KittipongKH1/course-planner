import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forecastGraduation,
  generateOfficialPlan,
  generatePlan,
  nextTerm,
  OFFERING_POLICIES,
  ON_TIME_TERM,
  REQUIRED_CATEGORIES,
} from '../utils/scheduler.js';
import { computeCriticalPath, computeCurricularComplexity, computeDownstreamCounts } from '../utils/graph.js';
import { tracksLabel } from '../utils/intent.js';
import { YEAR4_PATHS } from '../data/officialPlan.js';
import { termLabel, COURSES, COURSE_MAP } from '../data/curriculum.js';
import { generatePlanRemote } from '../services/api.js';
import CourseCard from './CourseCard.jsx';
import SegmentedControl from './SegmentedControl.jsx';
import GraduationForecast from './GraduationForecast.jsx';

const TERM_OPTIONS = [11, 12, 21, 22, 31, 32, 41, 42, 51, 52];
const PLAN_METHOD_OPTIONS = [
  { id: 'official', label: 'แผนหลักสูตร (Official)' },
  { id: 'ga', label: 'GA Optimized', tone: 'accent' },
];
const GA_DEBOUNCE_MS = 300; // กันยิง request รัว ๆ ตอนลาก slider ชั่วโมง/สัปดาห์

export default function RoadmapDashboard({
  constraints,
  setConstraints,
  completed,
  failed = new Set(),
  onNavigateToGoals,
  onNavigateToTranscript,
}) {
  const tracks = constraints.tracks ?? [];
  const downstreamCounts = useMemo(() => computeDownstreamCounts(), []);
  const criticalSet = useMemo(() => new Set(computeCriticalPath()), []);
  const complexity = useMemo(() => computeCurricularComplexity().byCourse, []);
  const [planMethod, setPlanMethod] = useState('official'); // 'official' | 'ga'
  const [gaState, setGaState] = useState({ loading: false, result: null, source: null });
  const yearPathPreference = constraints.yearPathPreference ?? 'project';
  const offeringPolicy = constraints.offeringPolicy ?? 'every';

  // เก็บ ref ของแต่ละ term-column ไว้เลื่อนหน้าจอลงไปหา — ใช้ Map แทน DOM query string
  // เพราะ term เปลี่ยนแปลงได้ตาม plan ที่ generate ใหม่ทุกครั้ง
  const termRefs = useRef(new Map());
  function scrollToTerm(term) {
    termRefs.current.get(term)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // เทอมปัจจุบัน: แนะนำอัตโนมัติจากเทอมสูงสุดของวิชาที่ผ่านแล้ว+1 แต่ผู้ใช้ปรับเองได้ผ่าน dropdown
  const suggestedStartTerm = useMemo(() => {
    const terms = [...completed, ...failed].map((code) => COURSE_MAP[code]?.term).filter(Boolean);
    return terms.length ? nextTerm(Math.max(...terms)) : 11;
  }, [completed, failed]);
  const effectiveStartTerm = constraints.startTerm ?? suggestedStartTerm;

  const officialResult = useMemo(() => {
    return generateOfficialPlan([...completed], {
      tracks,
      yearPathPreference,
      offeringPolicy,
      hoursPerWeek: constraints.hoursPerWeek,
      honors: constraints.honors,
      retakeCodes: [...failed],
    });
  }, [completed, tracks, constraints.hoursPerWeek, constraints.honors, yearPathPreference, offeringPolicy, failed]);

  useEffect(() => {
    if (planMethod !== 'ga') return undefined;
    let cancelled = false;
    setGaState((s) => ({ ...s, loading: true }));

    const gaConstraints = { ...constraints, startTerm: effectiveStartTerm };

    const timer = setTimeout(() => {
      generatePlanRemote({ completed: [...completed], failed: [...failed], constraints: gaConstraints, method: 'ga' })
        .then((result) => {
          if (!cancelled) setGaState({ loading: false, result, source: 'server (GA)' });
        })
        .catch(() => {
          // Backend ไม่รัน/ล่ม -> fallback เป็น greedy heuristic ฝั่ง client ทันที (ใช้งานได้แม้ offline)
          if (cancelled) return;
          const fallback = generatePlan([...completed], { ...gaConstraints, retakeCodes: [...failed] });
          setGaState({ loading: false, result: fallback, source: 'client fallback (greedy)' });
        });
    }, GA_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [planMethod, completed, failed, constraints, effectiveStartTerm]);

  const isGa = planMethod === 'ga';
  const { plan, warnings, electiveCreditTotal, electiveSource = {}, recommendedMore } = isGa
    ? {
        plan: gaState.result?.plan ?? [],
        warnings: gaState.result?.warnings ?? [],
        electiveCreditTotal: gaState.result?.electiveCreditTotal ?? 0,
        electiveSource: gaState.result?.electiveSource,
        recommendedMore: [],
      }
    : officialResult;

  const forecast = useMemo(
    () => forecastGraduation({ plan, completedCodes: completed, failedCodes: failed, startTerm: effectiveStartTerm }),
    [plan, completed, failed, effectiveStartTerm]
  );

  const unrecordedCount = useMemo(
    () => COURSES.filter(
      (c) => REQUIRED_CATEGORIES.includes(c.category) && c.term < effectiveStartTerm
        && !completed.has(c.code) && !failed.has(c.code)
    ).length,
    [completed, failed, effectiveStartTerm]
  );

  const retakeRisks = useMemo(
    () => [...failed]
      .map((code) => ({ code, ...complexity[code] }))
      .filter((r) => r.cruciality !== undefined)
      .sort((a, b) => b.cruciality - a.cruciality),
    [failed, complexity]
  );

  // เทอมที่ถือว่า "ปัจจุบัน" สำหรับ quick-nav — เลือกคอลัมน์แรกที่ >= effectiveStartTerm
  // (เผื่อกรณี startTerm ไม่ตรงกับ term column ใดเป๊ะๆ เช่นแผนเริ่มช้ากว่าที่ตั้งไว้)
  const currentTermForNav = plan.find((t) => t.term >= effectiveStartTerm)?.term ?? plan[0]?.term;

  function setConstraint(key, value) {
    setConstraints((c) => ({ ...c, [key]: value }));
  }

  return (
    <div className="dashboard">
      <h2 style={{ marginTop: 0 }}>Dynamic Roadmap Dashboard</h2>

      <GraduationForecast
        forecast={forecast}
        loading={isGa && (gaState.loading || !gaState.result)}
        constraints={constraints}
        isGa={isGa}
        onTryGa={() => setPlanMethod('ga')}
        onGoToTranscript={onNavigateToTranscript}
        retakeRisks={retakeRisks}
        unrecordedCount={unrecordedCount}
      />

      <div className="dashboard-toolbar">
        <p className="hint dashboard-hint">
          แผนหลัก: <strong>{isGa ? 'เพิ่มประสิทธิภาพด้วย Genetic Algorithm' : 'ตามโครงสร้างหลักสูตร ปี 1–4 (เอกสารทางการ)'}</strong>
          {' · '}สายอาชีพที่ใช้เติมวิชาเลือก: <strong>{tracks.length ? tracksLabel(tracks) : 'ยังไม่ระบุ'}</strong>
          {' · '}วิชาเลือกที่เติมแล้ว: <strong>{electiveCreditTotal}</strong>/15
          {isGa && gaState.source && <> {' · '}แหล่งคำนวณ: {gaState.source}</>}
          {isGa && failed.size > 0 && <> {' · '}<span className="status-chip warning" style={{ marginLeft: '0.3rem' }}>🔁 จัดวิชาที่ต้องลงใหม่ {failed.size} วิชาให้เร็วที่สุด</span></>}
          {!isGa && failed.size > 0 && <> {' · '}<span className="status-chip warning" style={{ marginLeft: '0.3rem' }}>⏩ เลื่อนวิชาที่ต้องลงใหม่และวิชาตัวต่อ {failed.size} วิชาให้อัตโนมัติ</span></>}
          {' '}
          <button type="button" className="link-button" onClick={onNavigateToGoals}>
            แก้ไขเป้าหมาย (สายอาชีพ/ชม.ต่อสัปดาห์/เกียรตินิยม) →
          </button>
        </p>

        <div className="dashboard-controls">
          <SegmentedControl options={PLAN_METHOD_OPTIONS} value={planMethod} onChange={setPlanMethod} />

          <div className="control-group">
            <span className="hint" style={{ marginBottom: 0 }}>ปี 4:</span>
            <select value={yearPathPreference} onChange={(e) => setConstraint('yearPathPreference', e.target.value)}>
              {Object.entries(YEAR4_PATHS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>

          <div className="control-group" title="สมมติฐานว่าวิชาที่ตกจะลงใหม่ได้เมื่อไหร่ — ถ้าคณะเปิดวิชาปีละครั้ง การตกวิชาจะทำให้รอ 1 ปี">
            <span className="hint" style={{ marginBottom: 0 }}>การเปิดสอน:</span>
            <select value={offeringPolicy} onChange={(e) => setConstraint('offeringPolicy', e.target.value)}>
              {Object.entries(OFFERING_POLICIES).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <span className="hint" style={{ marginBottom: 0 }}>อยู่เทอมปัจจุบัน:</span>
            <select value={effectiveStartTerm} onChange={(e) => setConstraint('startTerm', Number(e.target.value))}>
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>{termLabel(t)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <details className="warnings-group" open={warnings.length <= 4}>
          <summary>⚠️ คำเตือนของแผนนี้ ({warnings.length})</summary>
          <div className="warnings">
            {warnings.map((w, i) => (
              <div key={i} className={`warning-item ${w.type}`}>
                {w.type === 'bottleneck' && '🚧 '}
                {w.type === 'overload' && '⏱ '}
                {w.type === 'shifted' && '⏩ '}
                {w.type === 'extended' && '🎓 '}
                {w.type === 'filled' && 'ℹ️ '}
                {w.term ? `[${termLabel(w.term)}] ` : ''}{w.message}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="term-nav-strip">
        {plan.map((termPlan) => (
          <button
            key={termPlan.term}
            type="button"
            className={`term-nav-chip ${termPlan.term === currentTermForNav ? 'current' : ''} ${termPlan.term > ON_TIME_TERM ? 'late' : ''}`}
            onClick={() => scrollToTerm(termPlan.term)}
          >
            {Math.floor(termPlan.term / 10)}/{termPlan.term % 10}
          </button>
        ))}
      </div>

      <div className="roadmap-grid">
        {plan.map((termPlan) => {
          const overloaded = termPlan.maxLoad && termPlan.load > termPlan.maxLoad;
          return (
            <div
              key={termPlan.term}
              className={`term-column ${termPlan.term > ON_TIME_TERM ? 'late' : ''} ${termPlan.term < effectiveStartTerm ? 'past' : ''}`}
              ref={(el) => {
                if (el) termRefs.current.set(termPlan.term, el);
                else termRefs.current.delete(termPlan.term);
              }}
            >
              <div className="term-header">
                <span>{termPlan.yearLabel ?? termLabel(termPlan.term)}</span>
                <span className="term-credit-badge">{termPlan.credits} หน่วยกิต</span>
              </div>
              {termPlan.maxLoad > 0 && termPlan.courses.length > 0 && (
                <div className={`load-meter ${overloaded ? 'over' : ''}`} title="ภาระทางปัญญารวม (Cognitive Load) เทียบกับงบที่คำนวณจากเวลาว่างต่อสัปดาห์">
                  <div className="load-meter-track">
                    <div className="load-meter-fill" style={{ width: `${Math.min(100, (termPlan.load / termPlan.maxLoad) * 100)}%` }} />
                  </div>
                  <span>ภาระ {termPlan.load}/{termPlan.maxLoad}{overloaded ? ' · เกินงบ' : ''}</span>
                </div>
              )}
              {termPlan.courses.map((c) => (
                <CourseCard
                  key={c.code}
                  course={c}
                  downstreamCount={downstreamCounts[c.code]}
                  isCritical={criticalSet.has(c.code)}
                  retake={failed.has(c.code)}
                  electiveSource={electiveSource[c.code]}
                />
              ))}
              {termPlan.electivePlaceholderCredits > 0 && (
                <div className="course-card placeholder">
                  <div className="course-name">
                    ⬜ วิชาเลือกเฉพาะทาง ({termPlan.electivePlaceholderCredits} หน่วยกิต)
                  </div>
                  <div className="hint" style={{ fontSize: '0.72rem' }}>
                    {tracks.length ? 'ไม่มีวิชาที่ตรงเงื่อนไข prerequisite ในเทอมนี้ — เลือกเองภายหลัง' : 'เลือกสายอาชีพในแท็บ "เป้าหมาย" เพื่อให้ระบบช่วยเลือก'}
                  </div>
                </div>
              )}
              {termPlan.freeElectiveCredits > 0 && (
                <div className="course-card placeholder">
                  <div className="course-name">⬜ วิชาเลือกเสรี ({termPlan.freeElectiveCredits} หน่วยกิต)</div>
                </div>
              )}
              {termPlan.note && (
                <div className="hint" style={{ fontSize: '0.72rem', marginTop: '0.4rem' }}>ℹ️ {termPlan.note}</div>
              )}
            </div>
          );
        })}
      </div>

      {tracks.length > 0 && recommendedMore.length > 0 && (
        <div className="panel" style={{ marginTop: '1.2rem' }}>
          <h3>➕ แนะนำเพิ่มเติมตามความสนใจ ({tracksLabel(tracks)})</h3>
          <p className="hint">
            วิชาเหล่านี้ตรงกับสายอาชีพที่คุณสนใจ แต่ยังไม่ถูกใส่ในช่องวิชาเลือกบังคับของแผนหลัก
            สามารถนำไปใช้แทนวิชาเลือกเสรีในปี 4 หรือสลับกับวิชาเลือกเฉพาะทางในแผนได้ตามต้องการ
          </p>
          <div className="recommend-grid">
            {recommendedMore.slice(0, 8).map((c) => (
              <CourseCard key={c.code} course={c} downstreamCount={downstreamCounts[c.code]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
