import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, FastForward, GraduationCap, Info, Lock, RotateCcw } from 'lucide-react';
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

// ไอคอน + โทนของคำเตือนแต่ละประเภทจาก scheduler/GA
const WARNING_STYLE = {
  bottleneck: { Icon: Lock, tone: 'warning' },
  overload: { Icon: CalendarClock, tone: 'info' },
  shifted: { Icon: FastForward, tone: 'info' },
  extended: { Icon: GraduationCap, tone: 'warning' },
  filled: { Icon: Info, tone: 'success' },
  unresolved: { Icon: AlertTriangle, tone: 'danger' },
};

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

  const methodNote = isGa
    ? `เพิ่มประสิทธิภาพด้วย Genetic Algorithm${gaState.source ? ` · ${gaState.source}` : ''}`
    : 'ตามโครงสร้างหลักสูตร ปี 1–4 (เอกสารทางการ)';

  return (
    <div className="stack">
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

      <section className="toolbar" aria-label="ตัวเลือกแผน">
        <div className="toolbar-row">
          <SegmentedControl label="วิธีคำนวณแผน" options={PLAN_METHOD_OPTIONS} value={planMethod} onChange={setPlanMethod} />
          <label className="field-inline">
            <span>ปี 4</span>
            <select value={yearPathPreference} onChange={(e) => setConstraint('yearPathPreference', e.target.value)}>
              {Object.entries(YEAR4_PATHS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field-inline" title="สมมติฐานว่าวิชาที่ตกจะลงใหม่ได้เมื่อไหร่ — ถ้าคณะเปิดวิชาปีละครั้ง การตกวิชาจะทำให้รอ 1 ปี">
            <span>การเปิดสอน</span>
            <select value={offeringPolicy} onChange={(e) => setConstraint('offeringPolicy', e.target.value)}>
              {Object.entries(OFFERING_POLICIES).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <span>เทอมปัจจุบัน</span>
            <select value={effectiveStartTerm} onChange={(e) => setConstraint('startTerm', Number(e.target.value))}>
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>{termLabel(t)}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="toolbar-meta">
          <span>{methodNote}</span>
          <span>วิชาเลือกสาขา <strong className="tabular">{electiveCreditTotal}/15</strong> หน่วยกิต จาก {tracks.length ? tracksLabel(tracks) : 'ยังไม่ได้เลือกสาย'}</span>
          {failed.size > 0 && (
            <span className="meta-flag">
              <RotateCcw size={14} aria-hidden="true" />
              {isGa ? `จัดวิชาที่ต้องลงใหม่ ${failed.size} วิชาให้เร็วที่สุด` : `เลื่อนวิชาที่ต้องลงใหม่และวิชาตัวต่อ ${failed.size} วิชาให้อัตโนมัติ`}
            </span>
          )}
          <button type="button" className="link-button" onClick={onNavigateToGoals}>แก้ไขเป้าหมาย</button>
        </p>
      </section>

      {warnings.length > 0 && (
        <details className="warnings-group" open={warnings.length <= 4}>
          <summary>
            <AlertTriangle size={16} aria-hidden="true" />
            คำเตือนของแผนนี้ <span className="count">{warnings.length}</span>
          </summary>
          <ul className="warnings">
            {warnings.map((w, i) => {
              const { Icon, tone } = WARNING_STYLE[w.type] ?? WARNING_STYLE.overload;
              return (
                <li key={i} className={`notice ${tone}`}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{w.term ? <strong>{termLabel(w.term)} · </strong> : null}{w.message}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <nav className="term-nav" aria-label="ไปยังเทอม">
        {plan.map((termPlan) => (
          <button
            key={termPlan.term}
            type="button"
            className={`term-nav-chip ${termPlan.term === currentTermForNav ? 'current' : ''} ${termPlan.term > ON_TIME_TERM ? 'late' : ''} ${termPlan.term < effectiveStartTerm ? 'past' : ''}`}
            style={{ flexGrow: Math.max(termPlan.credits, 3) }}
            onClick={() => scrollToTerm(termPlan.term)}
            title={`${termLabel(termPlan.term)} · ${termPlan.credits} หน่วยกิต`}
          >
            <span>{Math.floor(termPlan.term / 10)}/{termPlan.term % 10}</span>
            <small className="tabular">{termPlan.credits}</small>
          </button>
        ))}
      </nav>

      <div className="roadmap-grid">
        {plan.map((termPlan) => {
          const overloaded = termPlan.maxLoad && termPlan.load > termPlan.maxLoad;
          const isCurrent = termPlan.term === currentTermForNav;
          return (
            <section
              key={termPlan.term}
              className={`term-column ${termPlan.term > ON_TIME_TERM ? 'late' : ''} ${termPlan.term < effectiveStartTerm ? 'past' : ''} ${isCurrent ? 'current' : ''}`}
              aria-label={termPlan.yearLabel ?? termLabel(termPlan.term)}
              ref={(el) => {
                if (el) termRefs.current.set(termPlan.term, el);
                else termRefs.current.delete(termPlan.term);
              }}
            >
              <header className="term-header">
                <h3>{termPlan.yearLabel ?? termLabel(termPlan.term)}</h3>
                <span className="term-credits tabular">{termPlan.credits} นก.</span>
              </header>
              {termPlan.maxLoad > 0 && termPlan.courses.length > 0 && (
                <div className={`load-meter ${overloaded ? 'over' : ''}`} title="ภาระทางปัญญารวม (Cognitive Load) เทียบกับงบที่คำนวณจากเวลาว่างต่อสัปดาห์">
                  <div className="load-meter-track">
                    <div className="load-meter-fill" style={{ width: `${Math.min(100, (termPlan.load / termPlan.maxLoad) * 100)}%` }} />
                  </div>
                  <span className="tabular">ภาระ {termPlan.load}/{termPlan.maxLoad}{overloaded ? ' · เกินงบ' : ''}</span>
                </div>
              )}
              <div className="course-list">
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
                    <div className="course-name">วิชาเลือกเฉพาะทาง {termPlan.electivePlaceholderCredits} หน่วยกิต</div>
                    <div className="placeholder-hint">
                      {tracks.length ? 'ไม่มีวิชาที่ตรงเงื่อนไข prerequisite ในเทอมนี้ — เลือกเองภายหลัง' : (
                        <>ยังไม่ได้เลือกสายอาชีพ <button type="button" className="link-button" onClick={onNavigateToGoals}>เลือกในหน้าเป้าหมาย</button></>
                      )}
                    </div>
                  </div>
                )}
                {termPlan.freeElectiveCredits > 0 && (
                  <div className="course-card placeholder">
                    <div className="course-name">วิชาเลือกเสรี {termPlan.freeElectiveCredits} หน่วยกิต</div>
                  </div>
                )}
                {termPlan.courses.length === 0 && !termPlan.electivePlaceholderCredits && !termPlan.freeElectiveCredits && (
                  <p className="term-empty">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    ไม่มีวิชาที่ต้องลงในเทอมนี้แล้ว
                  </p>
                )}
              </div>
              {termPlan.note && <p className="term-note">{termPlan.note}</p>}
            </section>
          );
        })}
      </div>

      {tracks.length > 0 && recommendedMore.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">แนะนำเพิ่มเติมตามความสนใจ</h2>
          <p className="hint">
            วิชาเหล่านี้ตรงกับ{tracksLabel(tracks)} แต่ยังไม่ถูกใส่ในช่องวิชาเลือกของแผนหลัก
            ใช้แทนวิชาเลือกเสรีในปี 4 หรือสลับกับวิชาเลือกเฉพาะทางในแผนได้
          </p>
          <div className="recommend-grid">
            {recommendedMore.slice(0, 8).map((c) => (
              <CourseCard key={c.code} course={c} downstreamCount={downstreamCounts[c.code]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

