/**
 * แทนที่ <select> ในจุดที่ตัวเลือกน้อย (2-3 ตัว) — เห็นตัวเลือกทั้งหมดพร้อมกัน ไม่ต้องเปิด dropdown
 * @param {{id, label, tone?: 'accent'|'warning'|'success', disabled?: boolean, title?: string}[]} options
 */
export default function SegmentedControl({ options, value, onChange, size = 'md', label }) {
  return (
    <div className={`segmented ${size === 'sm' ? 'sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            title={opt.title}
            className={`segmented-option ${active ? 'active' : ''} ${active && opt.tone ? `tone-${opt.tone}` : ''}`}
            onClick={() => !opt.disabled && onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
