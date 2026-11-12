// YouTube thumbnail 1280x720: bright AI scene + big bold Hindi hook text, rendered by headless Chrome
// (PIL/FFmpeg can't shape Devanagari). Thumbnail rules: heavy bold text (Noto Sans Devanagari 900, white with
// shadow + one accent line in yellow on a dark brush box), always inside the frame, layout varied per video.
// Usage: node scripts/thumb.js <bg.jpg> <out.jpg> "<text>" [left|right]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.js';

const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
  .find(p => p && fs.existsSync(p));

export function makeThumb(bg, out, text, side = 'right', opts = {}) {
  const words = String(text).replace(/\s+/g, ' ').trim();
  // split into a white line + an accent line (the last 1-2 words, or what follows "…")
  let [l1, l2] = words.includes('…') ? words.split('…').map((x, i) => i ? x : x + '…') : [null, null];
  if (!l2) { const w = words.split(' '); const k = Math.max(1, w.length - (w.length > 3 ? 2 : 1)); l1 = w.slice(0, k).join(' '); l2 = w.slice(k).join(' '); }
  const font = pathToFileURL(path.join(ROOT, 'fonts', 'NotoSansDevanagari-Variable.ttf')).href;
  const logo = pathToFileURL(path.join(ROOT, 'brand', 'logo_C.png')).href;
  const tag = String(opts.tag || '').trim();               // small red label on top (category / episode)
  const L = side === 'left';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:N;src:url(${font});font-weight:100 900}
*{margin:0;box-sizing:border-box}html,body{width:1280px;height:720px;overflow:hidden;background:#000}
.bg{position:absolute;inset:0;background:url(${pathToFileURL(bg).href}) center/cover;filter:saturate(1.4) contrast(1.15) brightness(1.06)}
.shade{position:absolute;inset:0;background:linear-gradient(${L ? '90deg' : '270deg'},rgba(0,0,0,.82) 0%,rgba(0,0,0,.55) 38%,rgba(0,0,0,0) 62%)}
.vig{position:absolute;inset:0;box-shadow:inset 0 0 160px 40px rgba(0,0,0,.75)}
.frame{position:absolute;inset:10px;border:6px solid #f2c14e;border-radius:18px}
.logo{position:absolute;top:26px;${L ? 'right' : 'left'}:26px;width:104px;height:104px;border-radius:50%;
  background:url(${logo}) center/cover;box-shadow:0 0 0 4px #f2c14e,0 6px 18px rgba(0,0,0,.7)}
.box{position:absolute;${L ? 'left' : 'right'}:46px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;
  justify-content:center;align-items:${L ? 'flex-start' : 'flex-end'};text-align:${L ? 'left' : 'right'};font-family:N;font-weight:900}
.tag{background:#e3262e;color:#fff;font-size:34px;font-weight:800;padding:4px 22px 10px;border-radius:10px;margin-bottom:18px;
  box-shadow:0 6px 16px rgba(0,0,0,.6)}
.l1{color:#fff;font-size:100px;line-height:1.1;-webkit-text-stroke:12px #000;paint-order:stroke fill;
  text-shadow:0 8px 18px rgba(0,0,0,.9)}
.l2{margin-top:12px;color:#ffd21f;font-size:124px;line-height:1.05;-webkit-text-stroke:14px #000;paint-order:stroke fill;
  text-shadow:0 0 30px rgba(255,190,0,.45),0 10px 20px rgba(0,0,0,.95);transform:rotate(-2deg)}
.bar{margin-top:14px;width:260px;height:12px;border-radius:6px;background:#e3262e}
</style></head><body><div class="bg"></div><div class="shade"></div><div class="vig"></div>
<div class="box" id="b">${tag ? `<div class="tag">${tag}</div>` : ''}<div class="l1">${l1}</div><div class="l2">${l2}</div><div class="bar"></div></div>
<div class="frame"></div><div class="logo"></div>
<script>
// shrink until every line fits inside the frame with margins
const b=document.getElementById('b'),a=b.querySelector('.l1'),c=b.querySelector('.l2');let s=1;
const over=()=>a.scrollWidth>640||c.scrollWidth>640||b.scrollHeight>620;
while(over()&&s>0.4){s-=0.04;a.style.fontSize=100*s+'px';c.style.fontSize=124*s+'px';}
</script></body></html>`;
  const f = out + '.html';
  fs.writeFileSync(f, html);
  const png = out.replace(/\.\w+$/, '') + '_raw.png';
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--no-sandbox',
    '--window-size=1280,720', `--screenshot=${png}`, '--virtual-time-budget=3000', pathToFileURL(f).href], { stdio: 'ignore' });
  fs.unlinkSync(f);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '2', out]);
  fs.unlinkSync(png);
  return out;
}

if (process.argv[1]?.endsWith('thumb.js')) {
  const [bg, out, text, side, tag] = process.argv.slice(2);
  makeThumb(bg, out, text, side, { tag });
  console.log('thumb', out);
}
