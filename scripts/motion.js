// Motion clips (owner 2026-11-15): a few key picture scenes per video become 5 s moving clips with MiniMax H3 Turbo
// (INT8, Wan2GP engine) on the owner's free Kaggle GPU (T4 x2, 30 GPU h/week shared by Beyond Words + Forgotten
// Gathas). Everything else stays a still picture with camera moves. Never blocks a video: any problem → stills.
// Flow: scene pictures + jobs.json → private Kaggle dataset version → push the headless kernel → poll → download clips.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, env, log } from './lib.js';

const USER = env.KAGGLE_USERNAME || 'storywala108';
const SLUG = env.MOTION_SLUG || 'bw';                       // bw = Beyond Words, fg = Forgotten Gathas
const DATASET = `${USER}/${SLUG}-motion-jobs`;
const KERNEL = `${USER}/${SLUG}-motion-clips`;
const OTHER = (env.MOTION_OTHER_KERNELS || '').split(',').map(s => s.trim()).filter(Boolean);
const N = Number(env.MOTION_CLIPS ?? 8);                     // clips per video (owner: only some scenes move)
const WEEK_MIN = Number(env.MOTION_WEEK_MIN ?? 600);         // this project's weekly GPU minutes (2 projects ≤ 20 h of 30)
const WAIT_MIN = Number(env.MOTION_WAIT_MIN ?? 80);          // how long one pipeline run waits for the kernel
const USAGE = path.join(ROOT, 'state', 'kaggle_usage.json');
const NOTEBOOK = path.join(ROOT, 'kaggle', 'motion_kernel.ipynb');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the kaggle CLI is installed on first use if the runner lacks it (no workflow change needed)
let cliReady = false;
function ensureCli() {
  if (cliReady) return;
  try { execFileSync('kaggle', ['--version'], { stdio: 'ignore' }); }
  catch { execFileSync('python', ['-m', 'pip', 'install', '-q', 'kaggle>=1.8'], { stdio: 'inherit', timeout: 600000 }); }
  cliReady = true;
}
const kaggle = (args, timeout = 600000) => (ensureCli(), execFileSync('kaggle', args, {
  encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, KAGGLE_API_TOKEN: env.KAGGLE_API_TOKEN || '', KAGGLE_USERNAME: USER },
}));
const readUsage = () => { try { return JSON.parse(fs.readFileSync(USAGE, 'utf8')); } catch { return []; } };
export function weekMinutes() {
  const since = Date.now() - 7 * 864e5;
  return readUsage().filter(u => Date.parse(u.at) > since).reduce((n, u) => n + u.minutes, 0);
}
function addUsage(minutes, run) {
  const list = readUsage().filter(u => Date.parse(u.at) > Date.now() - 30 * 864e5);
  list.push({ at: new Date().toISOString(), minutes: Math.round(minutes), run });
  fs.mkdirSync(path.dirname(USAGE), { recursive: true });
  fs.writeFileSync(USAGE, JSON.stringify(list, null, 1));
}
function kernelStatus(ref) {
  // e.g. 'user/slug has status "KernelWorkerStatus.COMPLETE"' → 'complete'
  try { const o = kaggle(['kernels', 'status', ref], 120000); return (o.match(/status "(?:[\w]+\.)?(\w+)"/i)?.[1] || o).toLowerCase(); }
  catch (e) { return /404|not found/i.test(String(e.stderr || e.message)) ? 'none' : 'unknown'; }
}

// evenly spread over the video: picture scenes that have their own picture (not a reused one)
export function pickScenes(scenes, src, imgOf) {
  const ok = scenes.map((x, i) => i).filter(i => scenes[i].visual === 'ink' && src[i] === i && fs.existsSync(imgOf(i)));
  if (!ok.length || N <= 0) return [];
  const n = Math.min(N, ok.length), picks = [];
  for (let k = 0; k < n; k++) picks.push(ok[Math.min(ok.length - 1, Math.round((k + 0.5) * ok.length / n))]);
  return [...new Set(picks)];
}

async function push(dir, picks, scenes, imgOf) {
  const jd = path.join(dir, 'motion_jobs'), kd = path.join(dir, 'motion_kernel');
  fs.rmSync(jd, { recursive: true, force: true }); fs.mkdirSync(jd, { recursive: true });
  fs.rmSync(kd, { recursive: true, force: true }); fs.mkdirSync(kd, { recursive: true });
  const clips = picks.map(i => {
    const name = `m${String(i).padStart(3, '0')}`;
    fs.copyFileSync(imgOf(i), path.join(jd, `${name}.jpg`));
    const what = String(scenes[i].prompt || scenes[i].text || '').replace(/\s+/g, ' ').slice(0, 600);
    return { name, image: `${name}.jpg`, sound: 'soft natural room ambience, no music, no speech',
      prompt: `${what}. Subtle natural movement of the people (breathing, blinking, small head turns), slow cinematic camera push-in, same faces, clothes and place as the image, no text, no new people.` };
  });
  fs.writeFileSync(path.join(jd, 'jobs.json'), JSON.stringify({ clips, max_minutes: Math.max(20, WAIT_MIN - 20),
    resolution: '480p (recommended)', aspect: '16:9 Landscape', duration: '5 s' }, null, 1));
  fs.writeFileSync(path.join(jd, 'dataset-metadata.json'), JSON.stringify({ title: `${SLUG}-motion-jobs`, id: DATASET,
    licenses: [{ name: 'CC0-1.0' }] }));
  // private dataset: first time create, then a new version each video
  let exists = true;
  try { kaggle(['datasets', 'status', DATASET], 120000); } catch { exists = false; }
  if (exists) kaggle(['datasets', 'version', '-p', jd, '-m', path.basename(dir), '-q']);
  else kaggle(['datasets', 'create', '-p', jd, '-q']);
  for (let k = 0; k < 40; k++) {                      // the kernel must see the new version
    await sleep(15000);
    let st = ''; try { st = kaggle(['datasets', 'status', DATASET], 120000).toLowerCase(); } catch {}
    if (st.includes('ready')) break;
  }
  fs.copyFileSync(NOTEBOOK, path.join(kd, 'motion_kernel.ipynb'));
  fs.writeFileSync(path.join(kd, 'kernel-metadata.json'), JSON.stringify({ id: KERNEL, title: `${SLUG}-motion-clips`,
    code_file: 'motion_kernel.ipynb', language: 'python', kernel_type: 'notebook', is_private: true, enable_gpu: true,
    enable_tpu: false, enable_internet: true, dataset_sources: [DATASET], kernel_sources: [], competition_sources: [],
    machine_shape: 'NvidiaTeslaT4' }, null, 1));
  kaggle(['kernels', 'push', '-p', kd]);
  log(`motion: ${clips.length} clips sent to Kaggle (${KERNEL})`);
}

function fetchClips(dir) {
  const od = path.join(dir, 'motion_out');
  fs.rmSync(od, { recursive: true, force: true }); fs.mkdirSync(od, { recursive: true });
  kaggle(['kernels', 'output', KERNEL, '-p', od, '-o', '-q'], 1800000);
  const files = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else if (/^m(\d{3})\.mp4$/.test(f) && fs.statSync(p).size > 20000) files[Number(f.slice(1, 4))] = p; } };
  walk(od);
  return files;
}

// returns 'next' (go on to the thumbnail/render, with or without clips) or 'waiting' (kernel still running)
export async function motionStage(s, dir, scenes, src, imgOf, save) {
  const m = s.motion || (s.motion = {});
  if (m.done) return 'next';
  const skip = why => { m.done = true; m.skipped = why; log('motion skipped:', why); save(); return 'next'; };
  if (!env.KAGGLE_API_TOKEN) return skip('no Kaggle token');
  if (N <= 0) return skip('MOTION_CLIPS=0');
  if (!fs.existsSync(NOTEBOOK)) return skip('kernel notebook missing');
  try {
    if (!m.pushedAt) {
      const used = weekMinutes();
      if (used + 60 > WEEK_MIN) return skip(`weekly Kaggle budget used (${used}/${WEEK_MIN} min)`);
      for (const o of OTHER) {                          // the other project's clips are rendering → try next run
        const st = kernelStatus(o);
        if (/running|queued/.test(st)) { log(`motion: ${o} is ${st} → wait for the next run`); return 'waiting'; }
      }
      const picks = pickScenes(scenes, src, imgOf);
      if (!picks.length) return skip('no picture scenes');
      await push(dir, picks, scenes, imgOf);
      Object.assign(m, { pushedAt: new Date().toISOString(), picks }); save();
    }
    const until = Date.now() + WAIT_MIN * 60e3;
    for (;;) {
      const st = kernelStatus(KERNEL);
      if (st === 'complete') break;
      if (/error|cancel/.test(st)) { addUsage((Date.now() - Date.parse(m.pushedAt)) / 60e3, s.id); return skip(`kernel ${st}`); }
      if (Date.now() - Date.parse(m.pushedAt) > 6 * 3600e3) return skip('kernel took over 6 h');
      if (Date.now() > until) { log(`motion: Kaggle still ${st} → continues next run`); return 'waiting'; }
      await sleep(60000);
    }
    const files = fetchClips(dir);
    let report = {};
    try { report = JSON.parse(fs.readFileSync(path.join(dir, 'motion_out', 'clips', 'report.json'), 'utf8')); } catch {}
    addUsage(Math.max(15, (report.total_seconds || 0) / 60 + 12), s.id);   // + engine setup (~10-12 min)
    m.clips = {};
    for (const [i, p] of Object.entries(files)) { const to = path.join(dir, `mot${String(i).padStart(3, '0')}.mp4`); fs.copyFileSync(p, to); m.clips[i] = to; }
    m.done = true; save();
    log(`motion: ${Object.keys(m.clips).length}/${m.picks.length} clips back | this week ${weekMinutes()}/${WEEK_MIN} GPU min`);
    return 'next';
  } catch (e) {
    return skip('error: ' + String(e.stderr || e.message).slice(0, 200));
  }
}
