import { useState } from 'react';
import ChatBot from './components/ChatBot.jsx';
import ConstraintsPanel from './components/ConstraintsPanel.jsx';
import TranscriptPanel from './components/TranscriptPanel.jsx';
import RoadmapDashboard from './components/RoadmapDashboard.jsx';
import CriticalPathPanel from './components/CriticalPathPanel.jsx';
import { trackLabel } from './utils/intent.js';
import { termLabel } from './data/curriculum.js';
import './App.css';

const TABS = [
  { id: 'chat', label: '💬 Chat' },
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'critical', label: '🧭 Critical Path' },
  { id: 'transcript', label: '📄 Transcript' },
];

const ONBOARDING_DISMISSED_KEY = 'course-planner:onboarding-dismissed';

export default function App() {
  const [tab, setTab] = useState('chat');
  const [constraints, setConstraints] = useState({
    track: null,
    hoursPerWeek: 20,
    honors: false,
    gradSchool: false,
  });
  const [completed, setCompleted] = useState(new Set());
  const [failed, setFailed] = useState(new Set()); // วิชาที่ตก/ถอน — ต้องลงใหม่ในเทอมถัดไป
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

  function handleIntent(intent) {
    setConstraints((c) => ({
      ...c,
      track: intent.track ?? c.track,
      hoursPerWeek: intent.hoursPerWeek ?? c.hoursPerWeek,
      honors: intent.honors ?? c.honors,
      gradSchool: intent.gradSchool ?? c.gradSchool,
    }));
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
        <span className={`status-chip ${constraints.track ? 'accent' : ''}`}>
          🎯 {constraints.track ? trackLabel(constraints.track) : 'ยังไม่ระบุสายอาชีพ'}
        </span>
        <span className="status-chip">⏱ {constraints.hoursPerWeek} ชม./สัปดาห์</span>
        <span className="status-chip">{constraints.honors ? '🏅 โหมดเกียรตินิยม' : '📘 โหมดปกติ'}</span>
        <span className="status-chip">
          📅 {constraints.startTerm ? termLabel(constraints.startTerm) : 'ยังไม่ระบุเทอมปัจจุบัน'}
        </span>
        {failed.size > 0 && (
          <span className="status-chip warning">🔁 ต้องลงใหม่ {failed.size} วิชา</span>
        )}
      </div>

      {showOnboarding && (
        <div className="onboarding-banner">
          <div>
            <h4>👋 เริ่มต้นใช้งานใน 3 ขั้นตอน</h4>
            <ol className="onboarding-steps">
              <li>บอกเป้าหมายสายอาชีพและเวลาว่างของคุณในแท็บ <strong>Chat</strong></li>
              <li>ดูแผนการเรียนที่คำนวณให้ที่แท็บ <strong>Dashboard</strong> (ลองสลับโหมด Official / GA Optimized)</li>
              <li>อัปเดตผลการเรียนที่แท็บ <strong>Transcript</strong> เมื่อผลสอบออก — ระบบจะจัดวิชาที่ตกไปลงใหม่ให้อัตโนมัติ</li>
            </ol>
          </div>
          <button className="onboarding-dismiss" onClick={dismissOnboarding}>ปิด</button>
        </div>
      )}

      <main className="app-main">
        {tab === 'chat' && (
          <div className="two-col">
            <ChatBot onIntent={handleIntent} constraints={constraints} />
            <ConstraintsPanel constraints={constraints} setConstraints={setConstraints} />
          </div>
        )}
        {tab === 'dashboard' && (
          <RoadmapDashboard
            constraints={constraints}
            setConstraints={setConstraints}
            completed={completed}
            failed={failed}
            onNavigateToChat={() => setTab('chat')}
          />
        )}
        {tab === 'critical' && <CriticalPathPanel />}
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
        <span>Phase 1: Chat + Dashboard UI/UX prototype</span>
        <span>Phase 2: AI intent extraction (KKUIntelSphere) + Live System</span>
        <span>Phase 3: Scheduling Optimization Engine (Genetic Algorithm + Dynamic Re-planning)</span>
      </footer>
    </div>
  );
}
