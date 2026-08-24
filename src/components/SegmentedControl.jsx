/**
 * แทนที่ <select> ในจุดที่ตัวเลือกน้อย (2-3 ตัว) — เห็นตัวเลือกทั้งหมดพร้อมกัน ไม่ต้องเปิด dropdown
 * @param {{id, label, tone?: 'accent'|'warning'|'success'}[]} options
 */
export default function SegmentedControl({ options, value, onChange, size = 'md' }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={opt.disabled || undefined}
            disabled={opt.disabled}
            title={opt.title}
            className={`segmented-option ${active ? 'active' : ''} ${active && opt.tone ? `tone-${opt.tone}` : ''} ${opt.disabled ? 'disabled' : ''}`}
            onClick={() => !opt.disabled && onChange(opt.id)}
            style={size === 'sm' ? { fontSize: '0.72rem', padding: '0.25rem 0.55rem' } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
