import { chromium } from 'playwright';
const OUT = process.env.OUT; const SHEET = process.env.SHEET || 'Rework Rate';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
await pg.goto('http://localhost:5199/audit/index.html?p=Obeya&tab=kpi&role=admin', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${OUT}/cards.png`, clip: { x: 20, y: 255, width: 1460, height: 300 } });
const ok = await pg.evaluate((name) => {
  const btns = [...document.querySelectorAll('button[title*="กดเพื่อดูรายละเอียด"]')];
  for (const bt of btns) { let el = bt; while (el && !(el.style && /span/.test(el.style.gridColumn))) el = el.parentElement; if (el && el.textContent.includes(name)) { bt.click(); return true; } }
  return false;
}, SHEET);
console.log('clicked', ok);
await pg.waitForTimeout(1000);
await pg.screenshot({ path: `${OUT}/popup.png` });
await pg.screenshot({ path: `${OUT}/rail.png`, clip: { x: 1010, y: 290, width: 380, height: 420 } });
await b.close();
