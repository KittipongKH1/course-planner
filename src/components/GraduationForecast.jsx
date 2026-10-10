import { termLabel } from '../data/curriculum.js';
import { DEFAULT_OPTIONS, TOTAL_DEGREE_CREDITS } from '../utils/scheduler.js';

/**
 * การ์ดสรุป "จะจบ 4 ปีไหม" — คำถามหลักของนักศึกษา จึงวางไว้บนสุดของ Dashboard
 * แสดงเทอมที่คาดว่าจบ, ความล่าช้า, หน่วยกิตที่ต้องลงต่อเทอม และวิธีกู้แผนเมื่อช้า
 */
export default function GraduationForecast({
  forecast,
  loading,
  constraints,
  isGa,
  onTryGa,
  onGoToTranscript,
  retakeRisks = [],
  unrecordedCount = 0,
}) {
  const {
    gradTerm,
    onTime,
    delaySemesters,
    earnedCredits,
    remainingCredits,
    semestersLeftOnTime,
    creditsPerTermNeeded,
    honorsEligible,
  } = forecast;
  const progressPct = Math.min(100, (earnedCredits / TOTAL_DEGREE_CREDITS) * 100);
  // ถ้ายังไม่ได้บันทึกผลวิชาในเทอมที่ผ่านมา หน่วยกิตสะสมจะต่ำกว่าจริง — อย่าเตือนว่าเกินเพดานจากข้อมูลที่ไม่ครบ
  const overCreditCap = unrecordedCount === 0
    && creditsPerTermNeeded !== null && creditsPerTermNeeded > DEFAULT_OPTIONS.maxCreditsPerTerm;

  const tone = loading ? '' : onTime && !overCreditCap ? 'success' : 'warning';
  let headline;
  if (loading) headline = '⏳ กำลังคำนวณแผน...';
  else if (!gradTerm) headline = '🎓 ไม่มีวิชาบังคับเหลือในแผนแล้ว';
  else if (onTime) headline = `🎓 คาดว่าจบ ${termLabel(gradTerm)} — ทันตามกำหนด 4 ปี`;
  else headline = `⏰ คาดว่าจบ ${termLabel(gradTerm)} — ช้ากว่ากำหนด ${delaySemesters} เทอม`;

  const tips = [];
  if (!loading && (!onTime || overCreditCap)) {
    if (!isGa) tips.push({ text: 'ลองโหมด GA Optimized ซึ่งจัดลำดับวิชาใหม่ทั้งแผน แทนการเลื่อนตามแผนทางการทีละทอด', action: onTryGa, actionLabel: 'เปิด GA' });
    if (constraints.hoursPerWeek < 25) tips.push({ text: `เพิ่มเวลาว่างต่อสัปดาห์ (ตอนนี้ ${constraints.hoursPerWeek} ชม.) เพื่อให้แต่ละเทอมรับภาระได้มากขึ้น` });
    if (constraints.yearPathPreference === 'coop_early') tips.push({ text: 'แผน "สหกิจ-เทอมต้น" บังคับให้เก็บวิชาให้ครบก่อนปี 4/1 ถ้าเปลี่ยนเป็นสหกิจเทอมปลายหรือแผนโครงงานจะมีเวลาเพิ่ม' });
    tips.push({ text: 'ลงวิชาที่ตกในภาคฤดูร้อน (ถ้าคณะเปิดสอน) ซึ่งระบบยังไม่ได้นำมาคำนวณ ควรสอบถามอาจารย์ที่ปรึกษา' });
  }

  return (
    <section className={`forecast-card ${tone}`} aria-live="polite">
      <div className="forecast-headline">{headline}</div>

      <div className="forecast-stats">
        <div className="forecast-stat">
          <span className="value">{earnedCredits}<small>/{TOTAL_DEGREE_CREDITS}</small></span>
          <span className="label">หน่วยกิตสะสม</span>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="forecast-stat">
          <span className="value">{semestersLeftOnTime}</span>
          <span className="label">เทอมที่เหลือถึงปี 4/2</span>
        </div>
        <div className="forecast-stat">
          <span className={`value ${overCreditCap ? 'warning' : ''}`}>{creditsPerTermNeeded ?? '-'}</span>
          <span className="label">หน่วยกิต/เทอม ที่ต้องลงเฉลี่ย (เพดาน {DEFAULT_OPTIONS.maxCreditsPerTerm})</span>
        </div>
        <div className="forecast-stat">
          <span className="value">{remainingCredits}</span>
          <span className="label">หน่วยกิตที่ยังขาด (รวมวิชาเลือกเสรี)</span>
        </div>
      </div>

      {unrecordedCount > 0 && (
        <div className="warning-item overload">
          มี {unrecordedCount} วิชาบังคับในเทอมก่อนหน้าที่ยังไม่ได้บันทึกผล ตัวเลขหน่วยกิตด้านบนจึงอาจต่ำกว่าความจริง
          {onGoToTranscript && (
            <button type="button" className="link-button" onClick={onGoToTranscript}>บันทึกผลการเรียน →</button>
          )}
        </div>
      )}

      {constraints.honors && !honorsEligible && (
        <div className="warning-item extended">
          🏅 ตั้งเป้าเกียรตินิยมไว้ แต่มีวิชาที่ตกหรือถอนแล้ว ซึ่งขัดกับเงื่อนไขในระบบ (ห้าม F/W) ควรตรวจสอบระเบียบ มข. อีกครั้ง
        </div>
      )}

      {overCreditCap && (
        <div className="warning-item bottleneck">
          ต้องลงเฉลี่ย {creditsPerTermNeeded} หน่วยกิต/เทอม ซึ่งเกินเพดาน {DEFAULT_OPTIONS.maxCreditsPerTerm} หน่วยกิต จึงจบใน 4 ปีไม่ได้ถ้าไม่ลงภาคฤดูร้อน
        </div>
      )}

      {retakeRisks.length > 0 && (
        <div className="forecast-risks">
          <span className="hint">วิชาที่ต้องลงใหม่ เรียงตามผลกระทบต่อเวลาจบ (cruciality):</span>
          {retakeRisks.map((r) => (
            <span key={r.code} className="status-chip warning" title={`blocking ${r.blocking} + delay ${r.delay}`}>
              {r.code} · {r.cruciality}
            </span>
          ))}
        </div>
      )}

      {tips.length > 0 && (
        <ul className="forecast-tips">
          {tips.map((tip) => (
            <li key={tip.text}>
              {tip.text}
              {tip.action && (
                <button type="button" className="link-button" onClick={tip.action}>{tip.actionLabel} →</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
