import { useMemo } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
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
    <div className="stack">
      <section className="panel">
        <h2 className="panel-title">ห่วงโซ่วิชาที่ยาวที่สุด</h2>
        <p className="hint">
          ระบบสร้างหลักสูตรเป็นกราฟ (DAG: Node = วิชา, Edge = Prerequisite) แล้วหาห่วงโซ่วิชาที่ยาวที่สุดด้วย Topological Sort
          — ถ้าสอบตกหรือถอนวิชาในเส้นทางนี้ จะกระทบเวลาจบการศึกษาโดยตรง
        </p>
        <ol className="critical-path-chain">
          {criticalPath.map((code, i) => (
            <li key={code} className="chain-item">
              <span className={`chain-node ${failed.has(code) ? 'retake' : ''}`} title={COURSE_MAP[code]?.nameTh}>
                <strong>{code}</strong>
                <small>{COURSE_MAP[code]?.nameEn}</small>
              </span>
              {i < criticalPath.length - 1 && <ChevronRight className="chain-arrow" size={16} aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <p className="hint">ความยาวเส้นทางวิกฤต: {criticalPath.length} วิชาต่อเนื่องกัน</p>
      </section>

      <section className="panel">
        <h2 className="panel-title">วิชาที่สำคัญต่อการจบตามกำหนดที่สุด</h2>
        <p className="hint">
          วัดตามกรอบ Curricular Analytics ของ Heileman et al. (2018) — <strong>Blocking</strong> = จำนวนวิชาที่ลงไม่ได้ถ้าไม่ผ่านวิชานี้,{' '}
          <strong>Delay</strong> = จำนวนวิชาบนห่วงโซ่ที่ยาวที่สุดที่ผ่านวิชานี้, <strong>Cruciality</strong> = Blocking + Delay
          · ความซับซ้อนเชิงโครงสร้างของหลักสูตรนี้ = <strong>{structuralComplexity}</strong>
        </p>
        <div className="table-wrap">
          <table className="data-table">
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
                  <td className="mono-code">
                    {code}
                    {failed.has(code) && (
                      <span className="badge danger inline" title="ต้องลงใหม่"><RotateCcw size={12} aria-hidden="true" /> ลงใหม่</span>
                    )}
                  </td>
                  <td>{COURSE_MAP[code]?.nameEn}</td>
                  <td className="num">{m.blocking}</td>
                  <td className="num">{m.delay}</td>
                  <td className="num"><strong>{m.cruciality}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
