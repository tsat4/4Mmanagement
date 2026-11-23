/* 🔔 MinDemandPanel — "ของถึง min แล้ว · ต้องจัดแผนลง" (ที่เดียวทั้งระบบ · 2026-11-15)
 *
 * user 13/11: *"เมื่อ stock ลดลงถึง min จะแสดงความต้องการไปหาไลน์ผลิตเจ้าของงานนั้นเพื่อให้เตรียมตัว
 * และไปฝ่ายวางแผนเพื่อเห็นว่ามีงานตัวไหนต้องจัดแผนลง"*
 *
 * 🔴 ตัวตัดสินอยู่ `utils/replenish.js` (`minAlerts`) — คอมโพเนนต์นี้**วาดอย่างเดียว ห้ามคิดเอง**
 *    2 จอ (ผลิต/วางแผน) ต้องเห็นเลขเดียวกัน
 * 🔴 **"ติด min" ตอบได้ · "ต้องผลิตเท่าไหร่" ยังตอบไม่ได้** (ทะเบียนชิ้นส่วนไม่มี max เลยสักแถว)
 *    ⇒ `refillPcs == null` ต้องเขียนว่า "ยังไม่ตั้ง max" **ห้ามโชว์ 0 ห้ามเดา**
 * 🔴 โหลดไม่ครบ = เขียนบนจอ ห้ามแสดงเป็น "ไม่มีของติด min" (ลิสต์ว่าง 2 ความหมาย)
 */
import React from 'react';
import { tr } from '../utils/i18n';
import MatLabel from './MatLabel';
import { toneVar, toneDim, toneLine } from '../utils/statusTone';

const fmt = (n) => Number(n || 0).toLocaleString();

export default function MinDemandPanel({
  rows = [], summary = null, error = null, loading = false,
  title = 'ของถึง min แล้ว — ต้องจัดแผนลง',
  onAdd = null,            // (mat, qty) => void · ส่งมาเฉพาะจอวางแผน (จอผลิตดูอย่างเดียว)
  showOwnerLine = true,    // จอผลิตกรองไลน์ตัวเองแล้ว ไม่ต้องย้ำ
  emptyText = 'ยังไม่มีพาร์ทไหนถึง min',
  max = 24,
}) {
  const at = (rows || []).filter(r => r?.state === 'at_min');
  const unknown = summary?.unknown ?? (rows || []).filter(r => r?.state === 'unknown').length;
  const shown = at.slice(0, max);

  return (
    <div style={{
      border: `1px solid ${toneLine('warn')}`, background: toneDim('warn'),
      borderRadius: 'var(--r-md)', padding: '10px 12px', display: 'grid', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12.5, color: toneVar('warn') }}>🔔 {tr(title)}</b>
        <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>
          {loading ? tr('กำลังโหลด…') : `${at.length} ${tr('พาร์ท')}`}
          {!loading && summary?.lines ? ` · ${summary.lines} ${tr('ไลน์')}` : ''}
        </span>
        {/* 🔴 ตอบไม่ได้กี่รายการ ต้องขึ้นเสมอ — ซ่อน = จอโกหกว่าดูครบแล้ว */}
        {!loading && unknown > 0 && (
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            · {unknown} {tr('รายการยังตัดสินไม่ได้ (ไม่เคยนับ / ยังไม่ตั้ง min)')}
          </span>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 11.5, color: toneVar('bad') }}>
          ⚠ {tr('โหลดไม่ครบ —')} {error} · {tr('ตัวเลขบนจออาจขาด ห้ามอ่านว่า "ไม่มีของถึง min"')}
        </div>
      )}

      {!loading && !error && at.length === 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{tr(emptyText)}</div>
      )}

      {shown.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {shown.map(r => (
            <div key={`${r.line_name}|${r.mat_no}`}
              title={`${r.mat_no} · ${tr('คงเหลือ')} ${fmt(r.onHand)} / min ${fmt(r.min)}`
                + (r.ownerLine ? `\n${tr('ไลน์เจ้าของงาน')}: ${r.ownerLine}` : '')
                + (r.line_name !== r.ownerLine ? `\n${tr('ของกองอยู่ที่')}: ${r.line_name}` : '')
                + (r.refillPcs == null ? `\n${tr('ยังไม่ตั้ง max — บอกไม่ได้ว่าต้องผลิตเท่าไหร่')}` : '')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                border: '1px solid var(--border2)', borderRadius: 'var(--r-md)',
                background: 'var(--card-surf)', fontSize: 11.5,
              }}>
              <MatLabel mat={r.mat_no} name={r.part_name} size={11.5} style={{ flexWrap: 'nowrap' }} />
              <span style={{ color: toneVar('warn'), fontWeight: 800, whiteSpace: 'nowrap' }}>
                {fmt(r.onHand)}/{fmt(r.min)}
              </span>
              {showOwnerLine && r.ownerLine && (
                <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>· {r.ownerLine}</span>
              )}
              {/* 🔴 ไม่รู้ max = เขียนบอก ห้ามโชว์ 0 */}
              <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {r.refillPcs == null ? `· ${tr('ยังไม่ตั้ง max')}` : `· ${tr('เติมถึง max')} ${fmt(r.refillPcs)}`}
              </span>
              {onAdd && (
                <button type="button" style={{ fontSize: 11 }}
                  onClick={() => onAdd(r.mat_no, r.refillPcs || 0)}>{tr('+ เข้าแผน')}</button>
              )}
            </div>
          ))}
          {at.length > shown.length && (
            <span style={{ fontSize: 11.5, color: 'var(--muted)', alignSelf: 'center' }}>
              … {tr('อีก')} {at.length - shown.length} {tr('พาร์ท')}
            </span>
          )}
        </div>
      )}

      {/* 🔴 ทะเบียนเปื้อนต้องเห็น ไม่งั้นมันจะเปื้อนต่อไปเรื่อยๆ */}
      {!loading && summary?.fgRows > 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          ⚠ {tr('ทะเบียนยังมี FG ปนอยู่')} {summary.fgRows} {tr('แถว — FG ไม่ควรตั้ง min/max ที่ไลน์')}
        </div>
      )}
    </div>
  );
}
