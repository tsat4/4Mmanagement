/* ══ 🎯 หน้ากิจกรรม (100P · 5S · Smart Factory · KYT · Kaizen · QCC · Lean · CFO · CFP) — 2026-11-25 ══
   หน้าเดียววาดทุกกิจกรรม (ตาม path) · ทะเบียน + เหตุผลโครง → `src/utils/activityPages.js`
   · ส่วน (Dashboard/Edit Data/Setting) เปลี่ยนที่ Sub Bar (`NAV_SUB_TABS`) — หัวเพจไม่วาดแถบแท็บ
   · Detail Bar = `useNavSubItems(..., { all:false })` · Tool Bar = `tools` ของ PageHeader (ตำแหน่งตายตัว)
   · 🔴 ยังไม่เชื่อมฐานข้อมูล ⇒ ไม่มีคิวรีใดๆ ในไฟล์นี้ · จอบอกตรงๆ ว่ายังไม่มีข้อมูล                         */
import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import Page from '../components/Page';
import PageHeader from '../components/PageHeader';
import { toast } from '../components/Toast';
import useTabParam from '../utils/useTabParam';
import { useNavSubItems } from '../utils/navSubItems';
import { ACTIVITY_TABS, ACTIVITY_SAMPLE_SECTIONS, activityByPath } from '../utils/activityPages';
import useLang from '../utils/useLang';

export default function Activity() {
  const { tr } = useLang();
  const { pathname } = useLocation();
  const act = activityByPath(pathname);
  const [tab, setTab] = useTabParam(ACTIVITY_TABS.map(t => t.key), ACTIVITY_TABS[0].key);
  const [sp] = useSearchParams();
  const sections = useMemo(() => ACTIVITY_SAMPLE_SECTIONS.map(s => ({ ...s })), []);
  useNavSubItems(pathname, tab, 'sec', sections, { all: false });
  const sec = sections.find(s => s.key === sp.get('sec')) || sections[0];
  const tabMeta = ACTIVITY_TABS.find(t => t.key === tab) || ACTIVITY_TABS[0];

  const notYet = (what) => () => toast.info(`${tr(what)} — ${tr('ยังไม่เชื่อมฐานข้อมูล (หน้ากิจกรรมยังเป็นโครง)')}`);
  const tools = [
    { key: 'search', label: 'ค้นหา', onClick: notYet('ค้นหา') },
    { key: 'add',    label: 'เพิ่ม',  onClick: notYet('เพิ่ม') },
    { key: 'edit',   label: 'แก้ไข', onClick: notYet('แก้ไข') },
    { key: 'delete', label: 'ลบ',    onClick: notYet('ลบ') },
  ];

  return (
    <Page>
      <PageHeader icon="🎯" title={act ? act.label : tr('กิจกรรม')}
        tabs={ACTIVITY_TABS} tab={tab} onTab={setTab} tools={tools} />
      {/* ③ Card Dashboard — ยังไม่มีข้อมูล: เขียนบนจอตรงๆ (กฎความซื่อสัตย์ของจอ · ห้ามโชว์ 0) */}
      <div data-activity-card="1" style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: 'var(--shadow-sm)', minHeight: '60vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {act ? act.label : ''} · {tr(tabMeta.label)} · {sec.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {tr('ยังไม่มีข้อมูล — หน้านี้เป็นโครงหน้าจอ ยังไม่เชื่อมฐานข้อมูล')}
        </div>
      </div>
    </Page>
  );
}
