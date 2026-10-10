import { useMemo } from 'react';
import { COURSE_MAP } from '../data/curriculum.js';
import { computeCriticalPath, computeCurricularComplexity } from '../utils/graph.js';

export default function CriticalPathPanel({ failed = new Set() }) {
  const criticalPath = useMemo(() => computeCriticalPath(), []);
  const { byCourse, structuralComplexity } = useMemo(() => computeCurricularComplexity(), []);

  const topCrucial = useMemo(() => {
    return Object.entries(byCourse)
      .filter(([, m]) => m.blocking > 0)
      .sort((a, b) => b[1].cruciality - a[1].cruciality || b[1].blocking - a[1].blocking)
      .slice(0, 10);
  }, [byCourse]);

  return (
    <div className="panel">
      <h3>🧭 Critical Path Analysis</h3>
      <p className="hint">
        ระบบสร้างหลักสูตรเป็นกราฟ (DAG: Node = วิชา, Edge = Prerequisite) แล้วหา
        "ห่วงโซ่วิชาที่ยาวที่สุด" (longest chain) ด้วย Topological Sort — ถ้านักศึกษาสอบตก/ถอน
        วิชาในเส้นทางนี้ จะกระทบเวลาจบการศึกษาโดยตรง
      </p>

      <div className="critical-path-chain">
        {criticalPath.map((code, i) => (
          <span key={code} className="chain-item">
            <span className="chain-node" title={COURSE_MAP[code]?.nameTh}>{code}</span>
            {i < criticalPath.length - 1 && <span className="chain-arrow">→</span>}
          </span>
        ))}
      </div>
      <div className="hint">ความยาวเส้นทางวิกฤต: {criticalPath.length} วิชาต่อเนื่องกัน</div>

      <h4 style={{ marginTop: '1.25rem' }}>วิชาที่สำคัญต่อการจบตามกำหนดที่สุด (Curricular Analytics)</h4>
      <p className="hint">
        วัดตามกรอบของ Heileman et al. (2018) — <strong>Blocking</strong> = จำนวนวิชาที่ลงไม่ได้ถ้าไม่ผ่านวิชานี้,{' '}
        <strong>Delay</strong> = จำนวนวิชาบนห่วงโซ่ที่ยาวที่สุดที่ผ่านวิชานี้ (ตกแล้วเลื่อนทั้งเส้น),{' '}
        <strong>Cruciality</strong> = Blocking + Delay · ความซับซ้อนเชิงโครงสร้างของหลักสูตรนี้ ={' '}
        <strong>{structuralComplexity}</strong>
      </p>
      <table className="bottleneck-table">
        <thead>
          <tr>
            <th>รหัสวิชา</th>
            <th>ชื่อวิชา</th>
            <th className="num">Blocking</th>
            <th className="num">Delay</th>
            <th className="num">Cruciality</th>
          </tr>
        </thead>
        <tbody>
          {topCrucial.map(([code, m]) => (
            <tr key={code}>
              <td>{code}{failed.has(code) && ' 🔁'}</td>
              <td>{COURSE_MAP[code]?.nameEn}</td>
              <td className="num">{m.blocking}</td>
              <td className="num">{m.delay}</td>
              <td className="num"><strong>{m.cruciality}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
