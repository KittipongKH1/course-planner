import { TRACKS } from '../data/curriculum.js';

export default function ConstraintsPanel({ constraints, setConstraints }) {
  return (
    <div className="panel">
      <h3>⚙️ ปรับเงื่อนไขแบบละเอียด</h3>
      <label>
        สายอาชีพเป้าหมาย
        <select
          value={constraints.track ?? ''}
          onChange={(e) => setConstraints((c) => ({ ...c, track: e.target.value || null }))}
        >
          <option value="">-- เลือกสายอาชีพ --</option>
          {Object.values(TRACKS).map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>

      <label>
        เวลาว่างสำหรับเรียน (ชม./สัปดาห์): <strong>{constraints.hoursPerWeek}</strong>
        <input
          type="range"
          min="4"
          max="45"
          value={constraints.hoursPerWeek}
          onChange={(e) => setConstraints((c) => ({ ...c, hoursPerWeek: parseInt(e.target.value, 10) }))}
        />
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={constraints.honors}
          onChange={(e) => setConstraints((c) => ({ ...c, honors: e.target.checked }))}
        />
        เงื่อนไขเกียรตินิยม (ห้ามได้ F/W — ลดภาระต่อเทอมเพื่อความปลอดภัย)
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={constraints.gradSchool}
          onChange={(e) => setConstraints((c) => ({ ...c, gradSchool: e.target.checked }))}
        />
        ต้องการเรียนต่อ (เน้นวิชาทฤษฎี/วิจัย)
      </label>
    </div>
  );
}
