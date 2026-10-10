import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  Gamepad2,
  Globe,
  HelpCircle,
  LayoutTemplate,
  Server,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { COURSES, TRACKS } from '../data/curriculum.js';
import { YEAR4_PATHS } from '../data/officialPlan.js';
import { LIKERT, QUIZ_QUESTIONS, TRACK_PROFILES, scoreQuiz } from '../data/careerQuiz.js';
import { DEFAULT_OPTIONS, MAX_TRACKS } from '../utils/scheduler.js';
import { tracksLabel } from '../utils/intent.js';

// หน้าเป้าหมาย: รับเงื่อนไขทั้งหมดที่ optimizer ใช้ผ่านฟอร์ม (แทนการสกัดจากแชท เพื่อไม่ให้ LLM ตีความผิด)
// แชทถูกแยกไปทำหน้าที่ถาม-ตอบหลักสูตร (RAG) อย่างเดียว

const ELECTIVE_GOAL = DEFAULT_OPTIONS.electiveCreditGoal;

const TRACK_ICONS = {
  FRONTEND: LayoutTemplate,
  FULLSTACK: Globe,
  DATA: BarChart3,
  AI: BrainCircuit,
  DEVOPS: Server,
  SECURITY: ShieldCheck,
  GAMEDEV: Gamepad2,
  MOBILE: Smartphone,
};

function trackElectiveStats() {
  return Object.fromEntries(Object.keys(TRACKS).map((id) => {
    const electives = COURSES.filter((c) => c.category.startsWith('Elective') && c.tracks?.includes(id));
    return [id, { count: electives.length, credits: electives.reduce((s, c) => s + c.credits, 0) }];
  }));
}

export default function GoalsPage({ constraints, setConstraints, onDone }) {
  const tracks = constraints.tracks ?? [];
  const stats = useMemo(trackElectiveStats, []);
  const [quizOpen, setQuizOpen] = useState(false);

  function set(key, value) {
    setConstraints((c) => ({ ...c, [key]: value }));
  }

  function toggleTrack(id) {
    if (tracks.includes(id)) set('tracks', tracks.filter((t) => t !== id));
    else if (tracks.length < MAX_TRACKS) set('tracks', [...tracks, id]);
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="goals-section-head">
          <div>
            <h2 className="panel-title"><span className="step-num">1</span>เลือกสายอาชีพเป้าหมาย</h2>
            <p className="hint">
              เลือกได้สูงสุด {MAX_TRACKS} สาย — สายแรกที่เลือกเป็น <strong>สายหลัก</strong> ระบบจะเลือกวิชาเลือกจากสายหลักก่อน
              แล้วค่อยเติมจากสายรอง
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={() => setQuizOpen((o) => !o)} aria-expanded={quizOpen}>
            <HelpCircle size={16} aria-hidden="true" />
            {quizOpen ? 'ปิดแบบสอบถาม' : 'ยังไม่แน่ใจ? ทำแบบสอบถาม 8 ข้อ'}
          </button>
        </div>

        {quizOpen && (
          <CareerQuiz
            onPick={(picked) => { set('tracks', picked); setQuizOpen(false); }}
          />
        )}

        <div className="track-grid">
          {Object.values(TRACKS).map((t) => {
            const profile = TRACK_PROFILES[t.id];
            const order = tracks.indexOf(t.id);
            const selected = order !== -1;
            const disabled = !selected && tracks.length >= MAX_TRACKS;
            const { count, credits } = stats[t.id];
            const TrackIcon = TRACK_ICONS[t.id];
            return (
              <button
                key={t.id}
                type="button"
                className={`track-card ${selected ? 'selected' : ''}`}
                style={{ '--track-color': t.color }}
                onClick={() => toggleTrack(t.id)}
                disabled={disabled}
                aria-pressed={selected}
              >
                <span className="track-card-head">
                  <span className="track-icon" aria-hidden="true"><TrackIcon size={20} /></span>
                  {selected ? (
                    <span className="track-order"><Check size={13} aria-hidden="true" />{order === 0 ? 'สายหลัก' : 'สายรอง'}</span>
                  ) : null}
                </span>
                <span className="track-name">{t.label}</span>
                <span className="track-summary">{profile.summary}</span>
                <span className="track-skills">
                  {profile.skills.map((s) => <span key={s} className="skill-tag">{s}</span>)}
                </span>
                <span className="track-stat">
                  วิชาเลือกเฉพาะสาย {count} วิชา ({credits} หน่วยกิต)
                  {credits < ELECTIVE_GOAL && (
                    <span className="track-stat-note">ไม่ถึง {ELECTIVE_GOAL} หน่วยกิต — ระบบเติมจากกลุ่มวิชาใกล้เคียงให้</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {tracks.length === 2 && (
          <button type="button" className="ghost-button" onClick={() => set('tracks', [tracks[1], tracks[0]])}>
            <ArrowLeftRight size={15} aria-hidden="true" />
            สลับสายหลัก/สายรอง
          </button>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title"><span className="step-num">2</span>ข้อจำกัดและเป้าหมายส่วนตัว</h2>
        <div className="goals-constraints">
          <label className="field-stack">
            <span>เวลาว่างสำหรับเรียนต่อสัปดาห์ <strong className="tabular">{constraints.hoursPerWeek} ชม.</strong></span>
            <input
              className="range"
              type="range"
              min="4"
              max="45"
              value={constraints.hoursPerWeek}
              onChange={(e) => set('hoursPerWeek', parseInt(e.target.value, 10))}
            />
            <span className="hint field-hint">ถ้าทำงานพาร์ทไทม์ ให้หักชั่วโมงทำงานออก — ระบบจะจำกัดภาระต่อเทอมตามค่านี้</span>
          </label>

          <div className="goals-checks">
            <label className="checkbox-row">
              <input type="checkbox" checked={constraints.honors} onChange={(e) => set('honors', e.target.checked)} />
              ต้องการเกียรตินิยม (ห้ามได้ F/W — ระบบลดภาระต่อเทอมลงเพื่อความปลอดภัย)
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={constraints.gradSchool} onChange={(e) => set('gradSchool', e.target.checked)} />
              ต้องการเรียนต่อ ป.โท (จัดวิชาทฤษฎี/วิจัยให้เรียนเร็วขึ้น)
            </label>
          </div>

          <fieldset className="radio-group">
            <legend>ปี 4 เลือกเส้นทาง</legend>
            {Object.entries(YEAR4_PATHS).map(([id, label]) => (
              <label key={id} className="checkbox-row">
                <input
                  type="radio"
                  name="yearPath"
                  checked={(constraints.yearPathPreference ?? 'project') === id}
                  onChange={() => set('yearPathPreference', id)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      <div className="goals-footer">
        <span className="hint">
          {tracks.length
            ? <>เป้าหมาย: <strong>{tracksLabel(tracks)}</strong> · {constraints.hoursPerWeek} ชม./สัปดาห์</>
            : 'ยังไม่ได้เลือกสายอาชีพ — แผนจะยังไม่มีวิชาเลือกสาขา'}
        </span>
        <button type="button" className="primary-button" onClick={onDone}>
          ดูแผนการเรียน
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CareerQuiz({ onPick }) {
  const [answers, setAnswers] = useState({});
  const answeredAll = QUIZ_QUESTIONS.every((q) => answers[q.id] !== undefined);
  const results = useMemo(() => (answeredAll ? scoreQuiz(answers) : []), [answers, answeredAll]);

  return (
    <div className="quiz">
      <p className="hint">ตอบตามความรู้สึก ไม่มีถูกผิด ({Object.keys(answers).length}/{QUIZ_QUESTIONS.length} ข้อ)</p>
      {QUIZ_QUESTIONS.map((q, i) => (
        <fieldset key={q.id} className="quiz-question">
          <legend>{i + 1}. {q.text}</legend>
          <div className="likert">
            {LIKERT.map((opt) => (
              <label key={opt.value} className={answers[q.id] === opt.value ? 'active' : ''}>
                <input
                  type="radio"
                  name={`quiz-${q.id}`}
                  checked={answers[q.id] === opt.value}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.value }))}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {answeredAll && (
        <div className="quiz-results">
          <h3>สายที่เหมาะกับคุณ</h3>
          {results.slice(0, 3).map((r) => {
            const TrackIcon = TRACK_ICONS[r.track];
            return (
            <div key={r.track} className="quiz-result-row">
              <span className="quiz-result-name"><TrackIcon size={16} aria-hidden="true" />{TRACKS[r.track].label}</span>
              <span className="quiz-bar"><span style={{ width: `${r.score}%`, background: TRACKS[r.track].color }} /></span>
              <span className="quiz-score">{r.score}%</span>
              {r.reasons.length > 0 && <span className="quiz-reasons">เพราะคุณ{r.reasons.join(' และ')}</span>}
            </div>
            );
          })}
          <button
            type="button"
            className="primary-button"
            onClick={() => onPick(results.slice(0, MAX_TRACKS).filter((r) => r.score > 0).map((r) => r.track))}
          >
            ใช้ {MAX_TRACKS} อันดับแรกเป็นเป้าหมาย
          </button>
        </div>
      )}
    </div>
  );
}
