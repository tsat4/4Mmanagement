/* ══ 📅 มุมมองสัปดาห์ของแผนล็อต — 1 คอลัมน์ = 1 วันทำงาน · แกนเวลาลงล่าง (2026-11-17 · คำสั่ง user) ══
   user ส่งคลิปหน้า Schedule (ปฏิทินสัปดาห์ ลากการ์ดย้ายเวลาได้) มาแล้วสั่ง: *"ขยับแผนงานได้เหมือนหน้า
   schedule แบบนี้"* ⇒ ทำ **มุมมอง** ให้เหมือน (เห็นทั้งสัปดาห์ทีเดียว) แต่ **กติกาการลากคงเดิม**

   🔴 **ลาก = สลับลำดับ ไม่ใช่วางเวลาไหนก็ได้** — เหตุผลเดียวกับ `PlanTimeline.jsx`:
      1 ไลน์ทำได้ทีละใบ ⇒ ลากอิสระ = เปิดช่องว่างกลางกะโดยไม่มีเหตุผล แล้วแผนจะโกหกว่าจบเร็วกว่าจริง
      (คลิปต้นแบบเป็นตารางนัดส่วนตัว ว่างตรงไหนก็วางได้ — คนละโจทย์ ห้ามลอกกติกามาด้วย)
   🔴 **ไม่มีสูตรเวลาในไฟล์นี้** — กล่องมาจาก `layoutLots()` → `sliceBySegments()` → `stackByDay()`
      (หมุนแกนเฉยๆ) ⇒ กล่องยาวเท่ากับแท่งในมุมมองราง **เสมอ** · ห้ามคำนวณ ms→% เองที่นี่
   🔴 **วันหยุดโรงงานต้องเป็นคอลัมน์ลายทแยง** — ข้ามเงียบ = อ่านเป็น "ทำงานรวดทั้งสัปดาห์"
   🔴 **กล่องที่ไม่มี CT = ลายทแยง + ป้ายบอก ห้ามซ่อน ห้ามสูง 0** (กฎเดียวกับมุมมองราง)
   ♿ ลากด้วยเมาส์ไม่ได้ (จอสัมผัส) → ปุ่ม ↑↓ ในตารางด้านล่างยังทำงานเหมือนเดิม **ห้ามถอด**
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
import { layoutLots, reorderTo, lotTone, PLAN_SURFACE } from '../utils/planTimeline';
import { sliceBySegments, stackByDay, dayTicks, SHIFT_LABEL } from '../utils/planHorizon';
import { qtyText, isTrialLot, lotKeyText } from '../utils/planLots';

import { tr } from '../utils/i18n';
const fmtHm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/* ข้ามวันเป็นเรื่องปกติในมุมมองนี้ ⇒ ป้ายลอยต้องบอกวันด้วย ("22:34" ของวันไหน?) */
const fmtDayHm = (ms) => { const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1} ${fmtHm(ms)}`; };
const fmtMin = (m) => m == null ? '—' : m < 60 ? `${Math.round(m)} น.` : `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')} ชม.`;
const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const dowOf = (d) => DOW[new Date(`${d}T00:00:00`).getDay()] || '';
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const COL_H = 320;          // สูงพอให้กล่อง 30 นาทีบนกะ 12 ชม. ยังเห็นเป็นแถบ (ไม่ใช่เส้น)
const AXIS_W = 46;
const MAX_DAYS = 7;         // "สัปดาห์" — ขอบเขตยาวกว่านี้ให้เลื่อนดูด้วยตัวกรองวันของหน้าแม่

export default function PlanWeek({
  lots = [], ctOf, pairOf, dieOf, rule, startMs, endMs, breaks = [], closed = [],
  segments = [], skipped = [], onReorder, editable = false,
}) {
  const [dragId, setDragId] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [cursor, setCursor] = useState(null);

  const lay = useMemo(() => layoutLots({ lots, ctOf, pairOf, dieOf, rule, startMs, endMs, breaks, closed }),
    [lots, ctOf, pairOf, dieOf, rule, startMs, endMs, breaks, closed]);

  /* 🔴 ไม่ผ่าน `visibleRows()` — มุมมองสัปดาห์ต้องเห็น **ทุกวันในขอบเขต** รวมวันที่ยังว่าง
     (ตัดวันว่างท้ายทิ้ง = อ่านเป็น "สัปดาห์นี้มีงานแค่ 3 วัน" ทั้งที่ยังวางงานเพิ่มได้) */
  const allCols = useMemo(
    () => stackByDay(sliceBySegments(lay.boxes, segments, breaks), skipped),
    [lay.boxes, segments, breaks, skipped]);
  const cols = useMemo(() => allCols.slice(0, MAX_DAYS), [allCols]);

  const drop = (idx) => {
    if (!editable || dragId == null) return;
    onReorder?.(reorderTo(lots, dragId, idx));
    setDragId(null); setOverIdx(null); setCursor(null);
  };

  /* "วางตรงนี้แล้วได้อะไร" — กติกาเดียวกับมุมมองราง (เรียงใหม่แล้วให้ `layoutLots` คิดให้ทั้งคิว) */
  const preview = useMemo(() => {
    if (!editable || !dragId || overIdx == null) return null;
    const next = reorderTo(lots, dragId, overIdx);
    const pv = layoutLots({ lots: next, ctOf, pairOf, dieOf, rule, startMs, endMs, breaks, closed });
    const box = pv.boxes.find(b => b.lot?.id === dragId) || null;
    return {
      box,
      endDeltaMin: (pv.unknownCount > 0 || lay.unknownCount > 0 || pv.endMs == null || lay.endMs == null)
        ? null : Math.round((pv.endMs - lay.endMs) / 60000),
      overflowMin: pv.overflowMin,
    };
  }, [editable, dragId, overIdx, lots, ctOf, pairOf, dieOf, rule, startMs, endMs, breaks, closed, lay.endMs, lay.unknownCount]);

  if (!cols.length) {
    return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{tr('ยังไม่มีขอบเขตเวลา — เลือกวันและกะก่อน')}</div>;
  }

  /* ป้ายชั่วโมงของแกนซ้าย = ของคอลัมน์ที่ "กะครบที่สุด" (คอลัมน์ขอบอาจมีกะเดียว เอามาเป็นสเกลกลางไม่ได้) */
  const axisCol = cols.reduce((best, c) => (c.segs.length > (best?.segs.length || 0) ? c : best), null);
  const axisTicks = dayTicks(axisCol, 4);
  const sameShape = cols.every(c => c.closedDay || c.segs.length === (axisCol?.segs.length || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        {/* ── แกนเวลาซ้ายมือ ── */}
        <div style={{ width: AXIS_W, flex: `0 0 ${AXIS_W}px`, position: 'relative', marginTop: 26 }}>
          <div style={{ position: 'relative', height: COL_H }}>
            {axisTicks.map(t => (
              <span key={t.ms} style={{ position: 'absolute', top: `${t.topPct}%`, right: 4, transform: 'translateY(-50%)',
                fontSize: 11, color: t.major ? 'var(--text2)' : 'var(--muted)', fontWeight: t.major ? 700 : 400, whiteSpace: 'nowrap' }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {cols.map((col) => (
          <div key={col.workDate} style={{ flex: 1, minWidth: 0 }}>
            {/* ── หัวคอลัมน์ ── */}
            <div style={{ height: 26, display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: col.closedDay ? 'var(--muted)' : 'var(--text)' }}>{tr(dowOf(col.workDate))}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{dm(col.workDate)}</span>
            </div>

            <div style={{ position: 'relative', height: COL_H, background: 'var(--bg2)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>

              {/* 🔴 วันโรงงานไม่เดิน — ต้องเห็นว่าเป็นวันหยุด ไม่ใช่ "วันว่างที่วางงานได้" */}
              {col.closedDay ? (
                <div title={col.reason || tr('โรงงานไม่เดินเครื่อง')} style={{ position: 'absolute', inset: 0,
                  background: PLAN_SURFACE.closedHatch,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textAlign: 'center', padding: 4 }}>
                    ⏸ {tr('หยุด')}{col.reason ? <><br />{col.reason}</> : null}
                  </span>
                </div>
              ) : (
                <>
                  {/* แถบกะ + เส้นแบ่งกะ */}
                  {col.segs.map((s, i) => (
                    <div key={s.seg.key}>
                      {s.shift === 'night' && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: `${s.topPct}%`, height: `${s.heightPct}%`,
                          background: PLAN_SURFACE.night, pointerEvents: 'none' }} />
                      )}
                      {i > 0 && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: `${s.topPct}%`, height: 1,
                          background: 'var(--border)', pointerEvents: 'none' }} />
                      )}
                      <span style={{ position: 'absolute', left: 3, top: `calc(${s.topPct}% + 2px)`, fontSize: 11,
                        color: 'var(--muted)', pointerEvents: 'none' }}>{tr(SHIFT_LABEL[s.shift])?.slice(0, 2)}</span>
                    </div>
                  ))}
                  {/* เวลาพัก */}
                  {col.breaks.map((b, i) => (
                    <div key={i} title={tr('เวลาพักตามนโยบาย')} style={{ position: 'absolute', left: 0, right: 0,
                      top: `${b.topPct}%`, height: `${b.heightPct}%`, background: PLAN_SURFACE.breakBand, pointerEvents: 'none' }} />
                  ))}
                  {/* เส้นชั่วโมง */}
                  {dayTicks(col, 4).map(t => (
                    <div key={t.ms} style={{ position: 'absolute', left: 0, right: 0, top: `${t.topPct}%`, height: 1,
                      background: 'var(--border)', opacity: t.major ? 0.9 : 0.4, pointerEvents: 'none' }} />
                  ))}

                  {/* ── กล่องล็อต ── */}
                  {col.pieces.map(({ box: b, boxIndex, run, setup }) => {
                    const isUnknown = b.noCt;
                    const isTrial = isTrialLot(b.lot);
                    /* 🔴 สีมาจาก `lotTone()` ที่เดียว (utils/planTimeline.js) — ชุดเดียวกับมุมมองราง ห้ามตั้งเองที่นี่ */
                    const color = lotTone(b, { isTrial });
                    return (
                      <div key={`${b.lot.id}-${run ? 'r' : 's'}`}>
                        {setup && (
                          <div title={`${tr('เปลี่ยนรุ่นก่อนเริ่มใบนี้')} ~${fmtMin(b.setupMs / 60000)}`}
                            style={{ position: 'absolute', left: 2, right: 2, top: `${setup.topPct}%`, height: `${setup.heightPct}%`,
                              background: PLAN_SURFACE.setupHatch,
                              border: PLAN_SURFACE.setupBorder, borderRadius: 'var(--r-xs)', pointerEvents: 'none' }} />
                        )}
                        {run && (
                          <div
                            draggable={editable}
                            onDragStart={() => setDragId(b.lot.id)}
                            onDragEnd={() => { setDragId(null); setOverIdx(null); setCursor(null); }}
                            onDragOver={(e) => { if (editable && dragId) { e.preventDefault(); setOverIdx(boxIndex); setCursor({ x: e.clientX, y: e.clientY }); } }}
                            onDrop={(e) => { e.preventDefault(); drop(boxIndex); }}
                            title={`#${b.seq} ${lotKeyText(b.lot)} · ${qtyText(b.lot.qty_plan)} ${tr('ชิ้น')}\n`
                              + (isUnknown ? tr('ยังไม่มี cycle time — คำนวณความยาวไม่ได้')
                                : `${fmtHm(b.startMs)}–${fmtHm(b.endMs)} (${fmtMin(b.runMin)})`)
                              + (run.cutLeft || run.cutRight ? `\n🔗 ${tr('งานใบนี้คร่อมกะ — ทำต่อเนื่องข้ามเส้นแบ่งกะ')}` : '')
                              + (b.pairedWithPrev ? `\n👯 ${tr('คู่ RH/LH กับใบก่อนหน้า — ปั๊มจังหวะเดียวกัน ไม่กินเวลาเพิ่ม')}` : '')
                              + (b.afterUnknown && !isUnknown ? `\n⚠️ ${tr('มีใบที่คำนวณไม่ได้อยู่ก่อนหน้า — เวลาของใบนี้เชื่อไม่ได้')}` : '')
                              + (editable ? `\n\n🧲 ${tr('ลากเพื่อสลับลำดับ')}` : '')}
                            style={{
                              position: 'absolute', left: 16, right: 3,
                              top: `${run.topPct}%`, height: `max(${run.heightPct}%, 9px)`,
                              cursor: editable ? 'grab' : 'default',
                              borderRadius: `${run.cutLeft ? 0 : 4}px ${run.cutLeft ? 0 : 4}px ${run.cutRight ? 0 : 4}px ${run.cutRight ? 0 : 4}px`,
                              border: `1px solid ${color}`,
                              borderTop: run.cutLeft ? `2px dashed ${color}` : `3px solid ${color}`,
                              borderBottom: run.cutRight ? `2px dashed ${color}` : `1px solid ${color}`,
                              background: isUnknown
                                ? `repeating-linear-gradient(135deg, ${color}33 0 6px, transparent 6px 12px)`
                                : `${color}22`,
                              opacity: dragId === b.lot.id ? 0.45 : 1,
                              boxShadow: overIdx === boxIndex && dragId && dragId !== b.lot.id ? 'inset 0 3px 0 0 var(--accent)' : 'none',
                              overflow: 'hidden', padding: '1px 3px', boxSizing: 'border-box',
                            }}>
                            {/* 🔴 ป้ายต้อง pointerEvents:none ไม่งั้นจับที่ตัวหนังสือแล้วลากไม่ติด
                                🔴 ท่อนเตี้ยมาก = ไม่พิมพ์ตัวหนังสือ (โดนตัดครึ่งตัว อ่านเป็นขยะ) — กล่อง+tooltip ยังอยู่ครบ */}
                            {run.heightPct >= 7 && (
                              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15, pointerEvents: 'none' }}>
                                {run.cutLeft && '↩ '}{isTrial && '🧪 '}{b.pairedWithPrev && '👯 '}#{b.seq} {lotKeyText(b.lot)}
                              </div>
                            )}
                            {run.heightPct >= 14 && (
                              <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                                {isUnknown ? `⚠ ${tr('ไม่มี CT')}` : `${qtyText(b.lot.qty_plan)} ${tr('ชิ้น')} · ${fmtMin(b.runMin)}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* พื้นที่วางท้ายคิว — อยู่คอลัมน์สุดท้ายที่เปิดทำงาน */}
                  {editable && dragId && col === cols.filter(c => !c.closedDay).slice(-1)[0] && (
                    <div onDragOver={(e) => { e.preventDefault(); setOverIdx(lay.boxes.length); setCursor({ x: e.clientX, y: e.clientY }); }}
                      onDrop={(e) => { e.preventDefault(); drop(lay.boxes.length); }}
                      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '16%',
                        background: overIdx === lay.boxes.length ? PLAN_SURFACE.dropZone : 'transparent' }} />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 🧲 ป้ายลอยตามมือ — กติกาเดียวกับมุมมองราง */}
      {preview?.box && cursor && (
        <div style={{ position: 'fixed', left: cursor.x + 16, top: cursor.y + 16, zIndex: 60, pointerEvents: 'none',
          background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-float)', padding: '6px 9px', maxWidth: 280 }}>
          <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            → {tr('ลำดับ')} #{preview.box.seq} · {lotKeyText(preview.box.lot)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
            {preview.box.noCt
              ? <span style={{ color: 'var(--amber)' }}>⚠ {tr('ไม่มี CT — คำนวณเวลาไม่ได้')}</span>
              : <>{fmtDayHm(preview.box.startMs)}–{fmtHm(preview.box.endMs)}
                {preview.box.afterUnknown && <span style={{ color: 'var(--amber)' }}> · {tr('เชื่อไม่ได้')}</span>}</>}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700,
            color: preview.endDeltaMin == null ? 'var(--muted)'
              : preview.endDeltaMin < 0 ? 'var(--green)' : preview.endDeltaMin > 0 ? 'var(--red)' : 'var(--muted)' }}>
            {preview.endDeltaMin == null ? `— ${tr('คิวจบ: ยังมีใบที่ไม่มี CT บอกไม่ได้')}`
              : preview.endDeltaMin === 0 ? tr('คิวจบเวลาเดิม')
              : preview.endDeltaMin < 0 ? `▼ ${tr('คิวจบเร็วขึ้น')} ${fmtMin(-preview.endDeltaMin)}`
              : `▲ ${tr('คิวจบช้าลง')} ${fmtMin(preview.endDeltaMin)}`}
          </div>
          {preview.overflowMin > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 700 }}>{tr('· ล้นเลยขอบเขต')} {fmtMin(preview.overflowMin)}</div>
          )}
        </div>
      )}

      {/* ── บรรทัดความจริงใต้ตาราง ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11.5, marginLeft: AXIS_W + 6 }}>
        {/* 🔴 ขอบเขตยาวเกิน 7 วัน = ตารางนี้ไม่ได้โชว์ทั้งหมด ต้องเขียนบอก ห้ามตัดเงียบ */}
        {allCols.length > MAX_DAYS && (
          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
            ⚠️ {tr('ขอบเขตยาวกว่า 7 วัน — ตารางนี้โชว์ 7 วันแรก')} ({tr('ที่เหลือดูในมุมมองราง')})
          </span>
        )}
        {/* 🔴 คอลัมน์ที่มีกะไม่เท่ากัน = แกนซ้ายตรงกับบางคอลัมน์เท่านั้น ต้องบอก */}
        {!sameShape && (
          <span style={{ color: 'var(--muted)' }}>
            {tr('บางวันมีกะเดียว — เวลาในคอลัมน์นั้นอ่านจากป้ายกะในคอลัมน์ ไม่ใช่แกนซ้าย')}
          </span>
        )}
        {lay.unknownCount > 0 && (
          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
            ⚠️ {lay.unknownCount} {tr('ล็อตไม่มี CT — คำนวณความยาวไม่ได้ (กล่องลายทแยง) · เวลาหลังจากนั้นเชื่อไม่ได้')}
          </span>
        )}
        {editable && <span style={{ color: 'var(--muted)' }}>{tr('ลากกล่องเพื่อสลับก่อนหลัง (จอสัมผัสใช้ปุ่ม ↑↓ ในตารางด้านล่าง)')}</span>}
      </div>
    </div>
  );
}
