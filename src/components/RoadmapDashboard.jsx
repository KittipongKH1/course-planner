import { useEffect, useMemo, useRef, useState } from 'react';
import { generateOfficialPlan, generatePlan, nextTerm } from '../utils/scheduler.js';
import { computeDownstreamCounts, computeCriticalPath } from '../utils/graph.js';
import { trackLabel } from '../utils/intent.js';
import { YEAR4_PATHS } from '../data/officialPlan.js';
import { termLabel, COURSE_MAP } from '../data/curriculum.js';
import { generatePlanRemote } from '../services/api.js';
import CourseCard from './CourseCard.jsx';
import SegmentedControl from './SegmentedControl.jsx';

const TERM_OPTIONS = [11, 12, 21, 22, 31, 32, 41, 42, 51, 52];
const PLAN_METHOD_OPTIONS = [
  { id: 'official', label: 'แผนหลักสูตร (Official)' },
  { id: 'ga', label: 'GA Optimized', tone: 'accent' },
];
const TOTAL_DEGREE_CREDITS = 128; // ตาม โครงสร้างหลักสูตร.md

export default function RoadmapDashboard({ constraints, setConstraints, completed, failed = new Set(), onNavigateToChat }) {
  const downstreamCounts = useMemo(() => computeDownstreamCounts(), []);
  const criticalSet = useMemo(() => new Set(computeCriticalPath()), []);
  const [yearPathPreference, setYearPathPreference] = useState('project');
  const [planMethod, setPlanMethod] = useState('official'); // 'official' | 'ga'
  const [gaState, setGaState] = useState({ loading: false, result: null, source: null });

  // เก็บ ref ของแต่ละ term-column ไว้เลื่อนหน้าจอลงไปหา — ใช้ Map แทน DOM query string
  // เพราะ term เปลี่ยนแปลงได้ตาม plan ที่ generate ใหม่ทุกครั้ง
  const termRefs = useRef(new Map());
  function scrollToTerm(term) {
    termRefs.current.get(term)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // เทอมปัจจุบัน: แนะนำอัตโนมัติจากเทอมสูงสุดของวิชาที่ผ่านแล้ว+1 แต่ผู้ใช้ปรับเองได้ผ่าน dropdown
  const suggestedStartTerm = useMemo(() => {
    const terms = [...completed].map((code) => COURSE_MAP[code]?.term).filter(Boolean);
    return terms.length ? nextTerm(Math.max(...terms)) : 11;
  }, [completed]);
  const effectiveStartTerm = constraints.startTerm ?? suggestedStartTerm;

  const earnedCredits = useMemo(
    () => [...completed].reduce((sum, code) => sum + (COURSE_MAP[code]?.credits ?? 0), 0),
    [completed]
  );

  const officialResult = useMemo(() => {
    return generateOfficialPlan([...completed], {
      track: constraints.track,
      yearPathPreference,
      retakeCodes: [...failed],
    });
  }, [completed, constraints.track, yearPathPreference, failed]);

  useEffect(() => {
    if (planMethod !== 'ga') return;
    let cancelled = false;
    setGaState((s) => ({ ...s, loading: true }));

    const gaConstraints = { ...constraints, startTerm: effectiveStartTerm };

    generatePlanRemote({ completed: [...completed], failed: [...failed], constraints: gaConstraints, method: 'ga' })
      .then((result) => {
        if (!cancelled) setGaState({ loading: false, result, source: 'server (GA)' });
      })
      .catch(() => {
        // Backend ไม่รัน/ล่ม -> fallback เป็น greedy heuristic ฝั่ง client ทันที (ใช้งานได้แม้ offline)
        if (cancelled) return;
        const fallback = generatePlan([...completed], {
          track: constraints.track,
          hoursPerWeek: constraints.hoursPerWeek,
          honors: constraints.honors,
          gradSchool: constraints.gradSchool,
          startTerm: effectiveStartTerm,
          retakeCodes: [...failed],
        });
        setGaState({ loading: false, result: fallback, source: 'client fallback (greedy)' });
      });

    return () => { cancelled = true; };
  }, [planMethod, completed, failed, constraints, effectiveStartTerm]);

  const isGa = planMethod === 'ga';
  const { plan, warnings, electiveCreditTotal, recommendedMore } = isGa
    ? {
        plan: gaState.result?.plan ?? [],
        warnings: gaState.result?.warnings ?? [],
        electiveCreditTotal: gaState.result?.electiveCreditTotal ?? 0,
        recommendedMore: [],
      }
    : officialResult;

  // เทอมที่ถือว่า "ปัจจุบัน" สำหรับ quick-nav — เลือกคอลัมน์แรกที่ >= effectiveStartTerm
  // (เผื่อกรณี startTerm ไม่ตรงกับ term column ใดเป๊ะๆ เช่นแผนเริ่มช้ากว่าที่ตั้งไว้)
  const currentTermForNav = plan.find((t) => t.term >= effectiveStartTerm)?.term ?? plan[0]?.term;

  return (
    <div className="dashboard">
      <h2 style={{ marginTop: 0 }}>Dynamic Roadmap Dashboard</h2>

      <div className="progress-bar-wrap">
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(100, (earnedCredits / TOTAL_DEGREE_CREDITS) * 100)}%` }}
          />
        </div>
        <div className="progress-bar-label">
          หน่วยกิตสะสม {earnedCredits}/{TOTAL_DEGREE_CREDITS}
        </div>
      </div>

      <div className="dashboard-toolbar">
        <p className="hint dashboard-hint">
          แผนหลัก: <strong>{isGa ? 'เพิ่มประสิทธิภาพด้วย Genetic Algorithm' : 'ตามโครงสร้างหลักสูตร ปี 1–4 (เอกสารทางการ)'}</strong>
          {' · '}สายอาชีพที่ใช้เติมวิชาเลือก: <strong>{constraints.track ? trackLabel(constraints.track) : 'ยังไม่ระบุ'}</strong>
          {' · '}วิชาเลือกที่เติมแล้ว: <strong>{electiveCreditTotal}</strong>/15
          {isGa && gaState.source && <> {' · '}แหล่งคำนวณ: {gaState.source}</>}
          {isGa && failed.size > 0 && <> {' · '}<span className="status-chip warning" style={{ marginLeft: '0.3rem' }}>🔁 จัดวิชาที่ต้องลงใหม่ {failed.size} วิชาให้เร็วที่สุด</span></>}
          {!isGa && failed.size > 0 && <> {' · '}<span className="status-chip warning" style={{ marginLeft: '0.3rem' }}>⏩ เลื่อนวิชาที่ต้องลงใหม่และวิชาตัวต่อ {failed.size} วิชาให้อัตโนมัติ</span></>}
          {' '}
          <button type="button" className="link-button" onClick={onNavigateToChat}>
            แก้ไขเงื่อนไข (track/ชม.ต่อสัปดาห์/honors) →
          </button>
        </p>

        <div className="dashboard-controls">
          <SegmentedControl options={PLAN_METHOD_OPTIONS} value={planMethod} onChange={setPlanMethod} />

          {!isGa && (
            <div className="control-group">
              <span className="hint" style={{ marginBottom: 0 }}>ปี 4:</span>
              <select value={yearPathPreference} onChange={(e) => setYearPathPreference(e.target.value)}>
                {Object.entries(YEAR4_PATHS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {isGa && (
            <div className="control-group">
              <span className="hint" style={{ marginBottom: 0 }}>อยู่เทอมปัจจุบัน:</span>
              <select
                value={effectiveStartTerm}
                onChange={(e) => setConstraints((c) => ({ ...c, startTerm: Number(e.target.value) }))}
              >
                {TERM_OPTIONS.map((t) => (
                  <option key={t} value={t}>{termLabel(t)}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {isGa && gaState.loading && (
        <div className="hint" style={{ margin: '0.5rem 0' }}>⏳ กำลังรัน Genetic Algorithm เพื่อหาแผนที่ดีที่สุด...</div>
      )}

      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i} className={`warning-item ${w.type}`}>
              {w.type === 'bottleneck' && '🚧 '}
              {w.type === 'overload' && '⏱ '}
              {w.type === 'shifted' && '⏩ '}
              {w.type === 'extended' && '🎓 '}
              {w.term ? `[ปี ${Math.floor(w.term / 10)} เทอม ${w.term % 10}] ` : ''}{w.message}
            </div>
          ))}
        </div>
      )}

      <div className="term-nav-strip">
        {plan.map((termPlan) => (
          <button
            key={termPlan.term}
            type="button"
            className={`term-nav-chip ${termPlan.term === currentTermForNav ? 'current' : ''}`}
            onClick={() => scrollToTerm(termPlan.term)}
          >
            {Math.floor(termPlan.term / 10)}/{termPlan.term % 10}
          </button>
        ))}
      </div>

      <div className="roadmap-grid">
        {plan.map((termPlan) => (
          <div
            key={termPlan.term}
            className="term-column"
            ref={(el) => {
              if (el) termRefs.current.set(termPlan.term, el);
              else termRefs.current.delete(termPlan.term);
            }}
          >
            <div className="term-header">
              <span>{termPlan.yearLabel ?? termLabel(termPlan.term)}</span>
              <span className="term-credit-badge">{termPlan.credits} หน่วยกิต</span>
            </div>
            {isGa && (
              <div className="hint" style={{ fontSize: '0.72rem', marginBottom: '0.3rem' }}>
                ภาระ: {termPlan.load}/{termPlan.maxLoad}
              </div>
            )}
            {termPlan.courses.map((c) => (
              <CourseCard
                key={c.code}
                course={c}
                downstreamCount={downstreamCounts[c.code]}
                isCritical={criticalSet.has(c.code)}
                retake={failed.has(c.code)}
              />
            ))}
            {termPlan.electivePlaceholderCredits > 0 && (
              <div className="course-card placeholder">
                <div className="course-name">
                  ⬜ วิชาเลือกเฉพาะทาง ({termPlan.electivePlaceholderCredits} หน่วยกิต)
                </div>
                <div className="hint" style={{ fontSize: '0.72rem' }}>
                  {constraints.track ? 'ไม่มีวิชาที่ตรงเงื่อนไข prerequisite ในเทอมนี้ — เลือกเองภายหลัง' : 'ระบุสายอาชีพในแท็บ Chat เพื่อให้ระบบช่วยเลือก'}
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
        ))}
      </div>

      {constraints.track && recommendedMore.length > 0 && (
        <div className="panel" style={{ marginTop: '1.2rem' }}>
          <h3>➕ แนะนำเพิ่มเติมตามความสนใจ ({trackLabel(constraints.track)})</h3>
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
