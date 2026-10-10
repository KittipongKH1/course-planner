import { useEffect, useState } from 'react';
import {
  CalendarRange,
  ClipboardCheck,
  GitBranch,
  MessagesSquare,
  Moon,
  RotateCcw,
  Sun,
  Target,
  X,
} from 'lucide-react';
import ChatBot from './components/ChatBot.jsx';
import GoalsPage from './components/GoalsPage.jsx';
import TranscriptPanel from './components/TranscriptPanel.jsx';
import RoadmapDashboard from './components/RoadmapDashboard.jsx';
import CriticalPathPanel from './components/CriticalPathPanel.jsx';
import { tracksLabel } from './utils/intent.js';
import { termLabel } from './data/curriculum.js';
import './App.css';

// short = ชื่อบนแถบแท็บด้านล่างของมือถือ (พื้นที่แคบ)
const TABS = [
  { id: 'goals', label: 'เป้าหมาย', short: 'เป้าหมาย', title: 'เป้าหมายของฉัน', Icon: Target },
  { id: 'dashboard', label: 'แผนการเรียน', short: 'แผน', title: 'แผนการเรียน', Icon: CalendarRange },
  { id: 'critical', label: 'เส้นทางวิกฤต', short: 'วิกฤต', title: 'เส้นทางวิกฤตของหลักสูตร', Icon: GitBranch },
  { id: 'transcript', label: 'ผลการเรียน', short: 'ผลเรียน', title: 'ผลการเรียน', Icon: ClipboardCheck },
  { id: 'chat', label: 'ถาม-ตอบหลักสูตร', short: 'ถาม-ตอบ', title: 'ถาม-ตอบหลักสูตร', Icon: MessagesSquare },
];

const ONBOARDING_DISMISSED_KEY = 'course-planner:onboarding-dismissed';
const STATE_KEY = 'course-planner:state:v1';
const THEME_KEY = 'course-planner:theme';

const DEFAULT_CONSTRAINTS = {
  tracks: [], // สายหลักอยู่ตัวแรก สูงสุด 2 สาย
  hoursPerWeek: 20,
  honors: false,
  gradSchool: false,
  yearPathPreference: 'project',
  offeringPolicy: 'every',
};

// เก็บสถานะไว้ในเบราว์เซอร์ — เดิมรีเฟรชหน้าแล้ว transcript/เงื่อนไขหายหมด ต้องติ๊กใหม่ทุกครั้ง
function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null');
    if (!saved) return null;
    // state เดิมเก็บสายอาชีพเดี่ยวไว้ใน `track` — ย้ายเข้า `tracks` ให้ผู้ใช้เดิมไม่ต้องเลือกใหม่
    const { track, ...savedConstraints } = saved.constraints ?? {};
    if (!Array.isArray(savedConstraints.tracks)) savedConstraints.tracks = track ? [track] : [];
    return {
      constraints: { ...DEFAULT_CONSTRAINTS, ...savedConstraints },
      completed: new Set(saved.completed ?? []),
      failed: new Set(saved.failed ?? []),
    };
  } catch {
    return null;
  }
}

// ธีมฟ้า-ขาวเป็นค่าเริ่มต้นตามที่เจ้าของโครงงานกำหนด ธีมมืดเป็นตัวเลือกที่ผู้ใช้เปิดเอง
function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#f5f7fb');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore (e.g. private browsing ปิด localStorage)
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function ThemeToggle({ theme, onToggle, compact = false }) {
  const dark = theme === 'dark';
  const label = dark ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด';
  return (
    <button type="button" className={`theme-toggle ${compact ? 'compact' : ''}`} onClick={onToggle} aria-label={label} title={label}>
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      {!compact && <span>{dark ? 'ธีมสว่าง' : 'ธีมมืด'}</span>}
    </button>
  );
}

export default function App() {
  const [saved] = useState(loadSavedState);
  const [tab, setTab] = useState(() => (saved?.constraints.tracks.length ? 'dashboard' : 'goals'));
  const [constraints, setConstraints] = useState(saved?.constraints ?? DEFAULT_CONSTRAINTS);
  const [completed, setCompleted] = useState(saved?.completed ?? new Set());
  const [failed, setFailed] = useState(saved?.failed ?? new Set()); // วิชาที่ตก/ถอน — ต้องลงใหม่ในเทอมถัดไป
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({ constraints, completed: [...completed], failed: [...failed] })
      );
    } catch {
      // ignore (e.g. private browsing ปิด localStorage)
    }
  }, [constraints, completed, failed]);

  function resetAll() {
    if (!window.confirm('ล้างผลการเรียนและเงื่อนไขทั้งหมด? (ย้อนกลับไม่ได้)')) return;
    setConstraints(DEFAULT_CONSTRAINTS);
    setCompleted(new Set());
    setFailed(new Set());
  }
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) !== '1';
    } catch {
      return true;
    }
  });

  function dismissOnboarding() {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
    } catch {
      // ignore (e.g. private browsing ปิด localStorage)
    }
  }

  function goTo(id) {
    setTab(id);
    window.scrollTo({ top: 0 });
  }

  const current = TABS.find((t) => t.id === tab);
  const hasData = completed.size > 0 || failed.size > 0 || constraints.tracks.length > 0;
  const context = [
    constraints.tracks.length ? tracksLabel(constraints.tracks) : 'ยังไม่ได้เลือกสายอาชีพ',
    `${constraints.hoursPerWeek} ชม./สัปดาห์`,
    constraints.honors ? 'ตั้งเป้าเกียรตินิยม' : null,
    constraints.startTerm ? `อยู่${termLabel(constraints.startTerm)}` : null,
    'หลักสูตร 2565',
  ].filter(Boolean);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">CP</span>
          <span className="brand-text">
            <strong>Course Planner</strong>
            <small>วิทยาลัยการคอมพิวเตอร์ มข.</small>
          </span>
        </div>

        <nav className="side-nav" aria-label="เมนูหลัก">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`side-nav-item ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => goTo(id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {id === 'transcript' && failed.size > 0 && (
                <span className="nav-count" title={`ต้องลงใหม่ ${failed.size} วิชา`}>{failed.size}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <dl className="my-status">
            <dt>สายอาชีพ</dt>
            <dd>{constraints.tracks.length ? tracksLabel(constraints.tracks) : 'ยังไม่ได้เลือก'}</dd>
            <dt>เวลาเรียน</dt>
            <dd>{constraints.hoursPerWeek} ชม./สัปดาห์{constraints.honors ? ' · เกียรตินิยม' : ''}</dd>
          </dl>
          {constraints.honors && failed.size > 0 && (
            <p className="sidebar-warning" title="ตามเงื่อนไขในระบบ: เกียรตินิยมห้ามมี F/W">เสี่ยงหลุดเกียรตินิยม</p>
          )}
          <div className="sidebar-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            {hasData && (
              <button type="button" className="ghost-button danger-text" onClick={resetAll}>
                <RotateCcw size={14} aria-hidden="true" />
                ล้างข้อมูล
              </button>
            )}
          </div>
        </div>
      </aside>

      <header className="mobile-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">CP</span>
          <span className="brand-text">
            <strong>Course Planner</strong>
            <small>วิทยาลัยการคอมพิวเตอร์ มข.</small>
          </span>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} compact />
      </header>

      <main className="page">
        <header className="page-header">
          <h1>{current.title}</h1>
          <p className="page-context">{context.join(' · ')}</p>
        </header>

        {showOnboarding && (
          <section className="onboarding" aria-label="เริ่มต้นใช้งาน">
            <div>
              <h2>เริ่มต้นใช้งานใน 3 ขั้นตอน</h2>
              <ol>
                <li>เลือกสายอาชีพและเวลาว่างในหน้า <strong>เป้าหมาย</strong> ยังไม่แน่ใจก็ทำแบบสอบถามสั้น ๆ ได้</li>
                <li>ดูแผนที่คำนวณให้ในหน้า <strong>แผนการเรียน</strong> ลองสลับแผนหลักสูตรกับแผน GA</li>
                <li>บันทึกผลสอบในหน้า <strong>ผลการเรียน</strong> ระบบจะจัดวิชาที่ตกไปลงใหม่ให้อัตโนมัติ</li>
              </ol>
            </div>
            <button type="button" className="icon-button" onClick={dismissOnboarding} aria-label="ปิดคำแนะนำ">
              <X size={18} aria-hidden="true" />
            </button>
          </section>
        )}

        {tab === 'goals' && (
          <GoalsPage constraints={constraints} setConstraints={setConstraints} onDone={() => goTo('dashboard')} />
        )}
        {tab === 'chat' && (
          <ChatBot constraints={constraints} completed={completed} failed={failed} onGoToGoals={() => goTo('goals')} />
        )}
        {tab === 'dashboard' && (
          <RoadmapDashboard
            constraints={constraints}
            setConstraints={setConstraints}
            completed={completed}
            failed={failed}
            onNavigateToGoals={() => goTo('goals')}
            onNavigateToTranscript={() => goTo('transcript')}
          />
        )}
        {tab === 'critical' && <CriticalPathPanel failed={failed} />}
        {tab === 'transcript' && (
          <TranscriptPanel
            completed={completed}
            setCompleted={setCompleted}
            failed={failed}
            setFailed={setFailed}
            constraints={constraints}
          />
        )}

        <footer className="app-footer">
          <span>Phase 1: เป้าหมาย + Dashboard</span>
          <span>Phase 2: ถาม-ตอบหลักสูตร (RAG) + Live System</span>
          <span>Phase 3: Scheduling Optimization (Genetic Algorithm + Dynamic Re-planning)</span>
        </footer>
      </main>

      <nav className="bottom-nav" aria-label="เมนูหลัก">
        {TABS.map(({ id, short, Icon }) => (
          <button
            key={id}
            type="button"
            className={`bottom-nav-item ${tab === id ? 'active' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => goTo(id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
