import { useEffect, useState } from 'react';
import ChatBot from './components/ChatBot.jsx';
import GoalsPage from './components/GoalsPage.jsx';
import TranscriptPanel from './components/TranscriptPanel.jsx';
import RoadmapDashboard from './components/RoadmapDashboard.jsx';
import CriticalPathPanel from './components/CriticalPathPanel.jsx';
import { tracksLabel } from './utils/intent.js';
import { termLabel } from './data/curriculum.js';
import './App.css';

const TABS = [
  { id: 'goals', label: '🎯 เป้าหมาย' },
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'critical', label: '🧭 Critical Path' },
  { id: 'transcript', label: '📄 Transcript' },
  { id: 'chat', label: '💬 ถาม-ตอบหลักสูตร' },
];

const ONBOARDING_DISMISSED_KEY = 'course-planner:onboarding-dismissed';
const STATE_KEY = 'course-planner:state:v1';

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

export default function App() {
  const [saved] = useState(loadSavedState);
  const [tab, setTab] = useState(() => (saved?.constraints.tracks.length ? 'dashboard' : 'goals'));
  const [constraints, setConstraints] = useState(saved?.constraints ?? DEFAULT_CONSTRAINTS);
  const [completed, setCompleted] = useState(saved?.completed ?? new Set());
  const [failed, setFailed] = useState(saved?.failed ?? new Set()); // วิชาที่ตก/ถอน — ต้องลงใหม่ในเทอมถัดไป

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Career-Driven Adaptive Learning Path Planner</h1>
        <p className="subtitle">
          ระบบจัดเส้นทางการเรียนรู้แบบปรับเปลี่ยนตามสายอาชีพ พร้อม Academic Scheduling Optimization Engine
          — Phase 1–3 Prototype (หลักสูตร วท.บ. วิทยาการคอมพิวเตอร์ มข. 2565)
        </p>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="status-bar">
        <span className="status-bar-label">สถานะของฉัน</span>
        <span className={`status-chip ${constraints.tracks.length ? 'accent' : ''}`}>
          🎯 {constraints.tracks.length ? tracksLabel(constraints.tracks) : 'ยังไม่ระบุสายอาชีพ'}
        </span>
        <span className="status-chip">⏱ {constraints.hoursPerWeek} ชม./สัปดาห์</span>
        <span className="status-chip">{constraints.honors ? '🏅 โหมดเกียรตินิยม' : '📘 โหมดปกติ'}</span>
        <span className="status-chip">
          📅 {constraints.startTerm ? termLabel(constraints.startTerm) : 'ยังไม่ระบุเทอมปัจจุบัน'}
        </span>
        {failed.size > 0 && (
          <span className="status-chip warning">🔁 ต้องลงใหม่ {failed.size} วิชา</span>
        )}
        {constraints.honors && failed.size > 0 && (
          <span className="status-chip warning" title="ตามเงื่อนไขในระบบ: เกียรตินิยมห้ามมี F/W">🏅 เสี่ยงหลุดเกียรตินิยม</span>
        )}
        {(completed.size > 0 || failed.size > 0 || constraints.tracks.length > 0) && (
          <button type="button" className="link-button status-reset" onClick={resetAll}>
            ล้างข้อมูลทั้งหมด
          </button>
        )}
      </div>

      {showOnboarding && (
        <div className="onboarding-banner">
          <div>
            <h4>👋 เริ่มต้นใช้งานใน 3 ขั้นตอน</h4>
            <ol className="onboarding-steps">
              <li>เลือกสายอาชีพและเวลาว่างของคุณในแท็บ <strong>เป้าหมาย</strong> (ยังไม่แน่ใจก็ทำแบบสอบถามสั้น ๆ ได้)</li>
              <li>ดูแผนการเรียนที่คำนวณให้ที่แท็บ <strong>Dashboard</strong> (ลองสลับโหมด Official / GA Optimized)</li>
              <li>อัปเดตผลการเรียนที่แท็บ <strong>Transcript</strong> เมื่อผลสอบออก — ระบบจะจัดวิชาที่ตกไปลงใหม่ให้อัตโนมัติ</li>
            </ol>
          </div>
          <button className="onboarding-dismiss" onClick={dismissOnboarding}>ปิด</button>
        </div>
      )}

      <main className="app-main">
        {tab === 'goals' && (
          <GoalsPage constraints={constraints} setConstraints={setConstraints} onDone={() => setTab('dashboard')} />
        )}
        {tab === 'chat' && <ChatBot onGoToGoals={() => setTab('goals')} />}
        {tab === 'dashboard' && (
          <RoadmapDashboard
            constraints={constraints}
            setConstraints={setConstraints}
            completed={completed}
            failed={failed}
            onNavigateToGoals={() => setTab('goals')}
            onNavigateToTranscript={() => setTab('transcript')}
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
      </main>

      <footer className="app-footer">
        <span>Phase 1: Goals + Dashboard UI/UX prototype</span>
        <span>Phase 2: Curriculum Q&amp;A (RAG, กำลังพัฒนา) + Live System</span>
        <span>Phase 3: Scheduling Optimization Engine (Genetic Algorithm + Dynamic Re-planning)</span>
      </footer>
    </div>
  );
}
