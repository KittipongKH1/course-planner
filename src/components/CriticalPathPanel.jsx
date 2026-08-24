import { useMemo } from 'react';
import { COURSE_MAP } from '../data/curriculum.js';
import { computeCriticalPath, computeDownstreamCounts } from '../utils/graph.js';

export default function CriticalPathPanel() {
  const criticalPath = useMemo(() => computeCriticalPath(), []);
  const downstreamCounts = useMemo(() => computeDownstreamCounts(), []);

  const topBottlenecks = useMemo(() => {
    return Object.entries(downstreamCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .filter(([, count]) => count > 0);
  }, [downstreamCounts]);

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
            <span className="chain-node">{code}</span>
            {i < criticalPath.length - 1 && <span className="chain-arrow">→</span>}
          </span>
        ))}
      </div>
      <div className="hint">ความยาวเส้นทางวิกฤต: {criticalPath.length} วิชาต่อเนื่องกัน</div>

      <h4 style={{ marginTop: '1.25rem' }}>วิชา "คอขวด" อันดับต้น ๆ (ปลดล็อกวิชาอื่นมากที่สุด)</h4>
      <table className="bottleneck-table">
        <thead>
          <tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ปลดล็อก</th></tr>
        </thead>
        <tbody>
          {topBottlenecks.map(([code, count]) => (
            <tr key={code}>
              <td>{code}</td>
              <td>{COURSE_MAP[code]?.nameEn}</td>
              <td>{count} วิชา</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
