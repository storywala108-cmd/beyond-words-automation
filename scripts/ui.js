// On-screen motion graphics for story scenes (Beyond Words, 2026-11-12): WhatsApp chat, phone call, bank balance,
// the "हिसाब" note, a legal document, big text lines. Each scene renders as a few transparent 1920x1080 PNG
// "states" (message 1, then 1+2, ...) by headless Chrome (Devanagari shaped by the browser); render.js overlays them
// over a blurred story picture with fades and a soft notification sound per new state.
// Usage (test): node scripts/ui.js '<json ui>' <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.js';

const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
  .find(p => p && fs.existsSync(p));

// fonts embedded as data: URLs (a file:// font once fell back to a thin system font in headless Chrome)
let FONTS = null;
const fontCss = () => FONTS ??= [['M', 'Mukta-ExtraBold.ttf'], ['N', 'NotoSansDevanagari-Variable.ttf'], ['T', 'TiroDevanagariHindi-Regular.ttf']]
  .map(([n, f]) => `@font-face{font-family:${n};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64')});font-weight:100 900}`).join('');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (a, n) => (Array.isArray(a) ? a : []).filter(Boolean).slice(-n);

const BASE = `*{margin:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden;background:transparent}
body{font-family:N,M,sans-serif;color:#111}
.phone{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) scale(0.86);width:560px;height:980px;border-radius:64px;
background:#0d0d0f;padding:18px;box-shadow:0 40px 120px rgba(0,0,0,.65),0 0 0 3px #2c2c30}
.scr{width:100%;height:100%;border-radius:48px;overflow:hidden;position:relative;display:flex;flex-direction:column}
.bar{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 34px;font:600 22px N;color:#fff}`;

function page(body, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}${BASE}${css}</style></head><body>${body}</body></html>`;
}

// each builder returns an array of HTML pages (one per state)
const BUILD = {
  whatsapp(u) {
    const msgs = clamp(u.messages, 6).map(m => ({ me: m.from === 'me' || m.from === 'मैं', from: m.from, text: m.text }));
    const css = `.scr{background:#0b141a}.hd{background:#1f2c34;color:#e9edef;padding:18px 26px;display:flex;gap:18px;align-items:center}
.av{width:58px;height:58px;border-radius:50%;background:#6a7175;display:grid;place-items:center;font:800 28px M;color:#fff}
.tt{font:700 28px N}.sub{font:400 19px N;color:#8696a0}
.chat{flex:1;padding:22px 20px;display:flex;flex-direction:column;gap:14px;justify-content:flex-end;
background:#0b141a radial-gradient(circle at 20% 30%,#10202a 0,transparent 40%)}
.m{max-width:82%;padding:12px 18px 10px;border-radius:16px;font:500 27px/1.35 N;color:#e9edef;position:relative}
.in{background:#202c33;align-self:flex-start;border-top-left-radius:4px}.out{background:#005c4b;align-self:flex-end;border-top-right-radius:4px}
.nm{font:700 20px N;color:#53bdeb;margin-bottom:4px}.tm{font:400 16px N;color:#8696a0;text-align:right;margin-top:4px}
.new{animation:none;box-shadow:0 0 0 3px rgba(37,211,102,.55)}`;
    const states = [];
    for (let k = 0; k < Math.max(1, msgs.length); k++) {
      const html = msgs.slice(0, k + 1).map((m, i) => `<div class="m ${m.me ? 'out' : 'in'} ${i === k ? 'new' : ''}">${!m.me ? `<div class="nm">${esc(m.from)}</div>` : ''}${esc(m.text)}<div class="tm">${9 + i}:4${i} PM${m.me ? ' ✓✓' : ''}</div></div>`).join('');
      states.push(page(`<div class="phone"><div class="scr"><div class="bar"><span>9:41</span><span>▮▮▮ 5G</span></div>
<div class="hd"><span style="font-size:30px;color:#e9edef">←</span><div class="av">${esc(String(u.title || 'F')[0])}</div><div><div class="tt">${esc(u.title || 'Family')}</div>
<div class="sub">${msgs.length > 2 ? 'group · ' + (msgs.length + 30) + ' members' : 'online'}</div></div></div><div class="chat">${html}</div></div></div>`, css));
    }
    return states;
  },
  call(u) {
    const css = `.scr{background:linear-gradient(180deg,#1b2735,#0c1118);color:#fff;align-items:center;text-align:center}
.av{margin-top:150px;width:200px;height:200px;border-radius:50%;background:#3a4a5c;display:grid;place-items:center;font:800 96px M;color:#dfe8f1}
.nm{margin-top:40px;font:800 54px M}.st{margin-top:14px;font:500 28px N;color:#9fb3c8}
.btns{position:absolute;bottom:110px;left:0;right:0;display:flex;justify-content:space-around}
.b{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;font:700 54px sans-serif}`;
    const ended = u.state === 'ended';
    const one = (st, btns) => page(`<div class="phone"><div class="scr"><div class="bar" style="width:100%"><span>9:41</span><span>▮▮▮</span></div>
<div class="av">${esc(String(u.name || '?')[0])}</div><div class="nm">${esc(u.name || 'Unknown')}</div><div class="st">${st}</div>
<div class="btns">${btns}</div></div></div>`, css);
    if (ended) return [one('Call ended · ' + esc(u.duration || '0:42'), '')];
    return [one('incoming call…', '<div class="b" style="background:#e53935">✕</div><div class="b" style="background:#2e7d32">✆</div>'),
      one('00:0' + (3 + Math.floor(Math.random() * 6)), '<div class="b" style="background:#e53935">✕</div>')];
  },
  bank(u) {
    const css = `.scr{background:#f4f6fb}.top{background:linear-gradient(135deg,#0b3d91,#1565c0);color:#fff;padding:40px 34px 60px}
.bk{font:800 30px M;letter-spacing:.5px}.lb{margin-top:60px;font:500 26px N;opacity:.85}.amt{margin-top:10px;font:800 66px M}
.card{margin:-34px 26px 0;background:#fff;border-radius:22px;padding:26px 28px;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.r{display:flex;justify-content:space-between;font:500 24px N;color:#444;padding:10px 0;border-bottom:1px solid #eee}
.ok{margin-top:22px;font:700 24px N;color:#2e7d32}`;
    const pageFor = shown => page(`<div class="phone"><div class="scr"><div class="bar" style="color:#fff;position:absolute;width:100%"><span>9:41</span><span>▮▮▮</span></div>
<div class="top"><div class="bk">◆ MyBank</div><div class="lb">${esc(u.label || 'Balance')}</div><div class="amt">${shown}</div></div>
<div class="card"><div class="r"><span>A/c</span><span>XXXX 4417</span></div><div class="r"><span>Remark</span><span>${esc(u.remark || '—')}</span></div>
<div class="ok">✔ ${u.label === 'Debited' ? 'Transaction successful' : 'Updated just now'}</div></div></div></div>`, css);
    return [pageFor('₹ • • • • • •'), pageFor(esc(u.amount || '₹0'))];
  },
  note(u) {
    // short, readable lines: the newest 4, each cut at ~70 characters on a word boundary
    const short = l => { const s = String(l).trim(); if (s.length <= 72) return s; const c = s.slice(0, 70); return c.slice(0, c.lastIndexOf(' ') > 40 ? c.lastIndexOf(' ') : 70) + '…'; };
    const lines = clamp(u.lines, 4).map(short);
    const css = `.scr{background:#fffdf4}.hd{padding:26px 30px 10px;font:800 50px T;color:#7a1f1f;border-bottom:2px solid #f0e2c0}
.ls{padding:18px 30px;display:flex;flex-direction:column;gap:20px}
.l{font:600 31px/1.4 N;color:#2b2b2b;padding-left:24px;position:relative}.l:before{content:'•';position:absolute;left:0;color:#b33}
.nw{background:#fff2b8;border-radius:8px;padding:6px 10px 6px 28px;font-weight:600}`;
    const pageFor = n => page(`<div class="phone"><div class="scr"><div class="bar" style="color:#555"><span>9:41</span><span>Notes</span></div>
<div class="hd">${esc(u.title || 'हिसाब')}</div><div class="ls">${lines.slice(0, n).map((l, i) => `<div class="l ${i === n - 1 && n === lines.length ? 'nw' : ''}">${esc(l)}</div>`).join('')}</div></div></div>`, css);
    return lines.length > 1 ? [pageFor(lines.length - 1), pageFor(lines.length)] : [pageFor(1)];
  },
  doc(u) {
    const lines = clamp(u.lines, 5), hl = String(u.highlight || '');
    const mark = t => hl && esc(t).includes(esc(hl)) ? esc(t).replace(esc(hl), `<mark>${esc(hl)}</mark>`) : esc(t);
    const css = `.sheet{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-1.5deg);width:900px;min-height:820px;
background:#fbf8ef;padding:70px 80px;box-shadow:0 30px 90px rgba(0,0,0,.6);font-family:T,N}
.h{text-align:center;font:700 40px Georgia,T;letter-spacing:2px;color:#222;border-bottom:3px double #444;padding-bottom:22px}
.p{margin-top:30px;font:400 30px/1.6 T,N;color:#333}mark{background:#ffe066;padding:0 6px}
.stamp{position:absolute;right:70px;bottom:60px;width:170px;height:170px;border:6px solid rgba(160,20,20,.55);border-radius:50%;
display:grid;place-items:center;color:rgba(160,20,20,.6);font:800 26px Georgia;transform:rotate(-14deg)}`;
    const pageFor = withHl => page(`<div class="sheet"><div class="h">${esc(u.title || 'AGREEMENT')}</div>
${lines.map(l => `<div class="p">${withHl ? mark(l) : esc(l)}</div>`).join('')}<div class="stamp">STAMP</div></div>`, css);
    return hl ? [pageFor(false), pageFor(true)] : [pageFor(false)];
  },
  text(u) {
    const lines = clamp(u.lines, 3);
    const css = `.w{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:26px}
.t{font:800 104px/1.2 M;color:#fff;text-shadow:0 6px 0 rgba(0,0,0,.55),0 0 40px rgba(0,0,0,.8);max-width:1600px;text-align:center}
.t:last-child{color:#ffd54a}`;
    return lines.map((_, k) => page(`<div class="w">${lines.slice(0, k + 1).map(l => `<div class="t">${esc(l)}</div>`).join('')}</div>`, css));
  },
};

// → [{png}] transparent states for one ui scene
export function renderUi(ui, outDir) {
  const build = BUILD[ui?.type];
  if (!build) throw new Error('unknown ui type ' + ui?.type);
  fs.mkdirSync(outDir, { recursive: true });
  const pages = build(ui);
  return pages.map((html, k) => {
    const png = path.join(outDir, `s${k}.png`);
    if (fs.existsSync(png)) return png;
    const f = path.join(outDir, `s${k}.html`);
    fs.writeFileSync(f, html);
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--default-background-color=00000000',
      '--window-size=1920,1080', `--screenshot=${png}`, '--virtual-time-budget=1500', pathToFileURL(f).href], { stdio: 'ignore' });
    fs.unlinkSync(f);
    if (!fs.existsSync(png)) throw new Error('ui screenshot failed');
    return png;
  });
}

if (process.argv[1]?.endsWith('ui.js')) {
  console.log(renderUi(JSON.parse(process.argv[2]), process.argv[3]));
}
