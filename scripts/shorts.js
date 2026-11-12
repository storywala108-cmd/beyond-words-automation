// Shorts from a finished long video (owner 2026-11-12: 4 Shorts a day on YouTube, Facebook and Instagram).
// AI picks self-contained gripping moments (30-44 s, so the same file also works as an Instagram Reel — the IG API
// failed above ~45 s on every account so far); each is cut from final.mp4 and rebuilt vertically (1080x1920):
// blurred fill, the 16:9 picture in the middle, a big Hindi hook on top, big timed Hindi captions under it, and
// "पूरी कहानी YouTube पर — Beyond Words" at the bottom.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, aiJson, log } from './lib.js';

const MAX = 44, MIN = 25;
const assTime = t => { const cs = Math.max(0, Math.round(t * 100)); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const assEsc = s => String(s).replace(/[{}\\]/g, '').replace(/\n/g, ' ');

// scenes: [{text, start, vo}] on the final video's timeline
export async function makeShorts(dir, script, scenes, count = 4) {
  const list = scenes.map((s, i) => `[${i}] (${s.vo.toFixed(1)}s) ${s.text}`).join('\n');
  const { data } = await aiJson(
    `These are the narrated scenes of a Hindi family-drama story video "${script.pack.title}" (index, seconds, text):\n${list.slice(0, 14000)}\n\n` +
    `Pick ${count} Shorts. Each = a run of CONSECUTIVE scenes totalling ${MIN + 5}-${MAX} seconds that grips on its ` +
    `own: it starts on a strong line (a humiliation, a secret, a phone call, a reveal) and ends on a punch or an open ` +
    `question that makes people want the full story. Spread them across the story (beginning, middle, before the ` +
    `climax); never give away the final twist. No overlaps. For each give a hook for the top of the screen (Hindi in ` +
    `Devanagari, max 6 words, true to the clip) and a Shorts title (Hindi, max 70 chars, honest curiosity).\n` +
    `Return JSON {"shorts":[{"from":first index,"to":last index,"hook":"...","title":"..."}]}`,
    { check: d => { if (!d.shorts?.length) throw new Error('no shorts'); return d; }, temperature: 0.6 },
  );
  const clipText = sh => scenes.slice(Number(sh.from), Number(sh.to) + 1).map(s => s.text).join(' ');
  const fix = await aiJson(
    `Check each Short's title and hook against what its clip actually says. Keep curiosity, remove anything invented ` +
    `or exaggerated.\n` + JSON.stringify(data.shorts.map((sh, i) => ({ i, title: sh.title, hook: sh.hook, clip: clipText(sh).slice(0, 1500) }))) +
    `\nReturn JSON {"shorts":[{"i":0,"title":"honest Hindi title max 70 chars","hook":"honest Hindi hook max 6 words"}]}`,
    { check: d => { if (!d.shorts?.length) throw new Error('no fixes'); return d; }, temperature: 0.3 },
  ).catch(() => null);
  for (const f of fix?.data?.shorts || []) if (data.shorts[f.i] && f.title) Object.assign(data.shorts[f.i], { title: f.title, hook: f.hook || data.shorts[f.i].hook });

  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'fonts')).filter(f => f.endsWith('.ttf'))) fs.copyFileSync(path.join(ROOT, 'fonts', f), path.join(dir, 'fonts', f));
  const out = [];
  for (const [k, sh] of data.shorts.slice(0, count).entries()) {
    let a = Math.max(0, Math.min(scenes.length - 1, Number(sh.from))), b = Math.max(a, Math.min(scenes.length - 1, Number(sh.to)));
    // keep it ≤ MAX s (Instagram): drop scenes from the end; too short: add the next scene if it fits
    while (b > a && scenes[b].start + scenes[b].vo - scenes[a].start > MAX - 0.6) b--;
    while (b + 1 < scenes.length && scenes[b + 1].start + scenes[b + 1].vo - scenes[a].start <= MAX - 0.6 && scenes[b].start + scenes[b].vo - scenes[a].start < MIN + 5) b++;
    const start = scenes[a].start, dur = Math.min(MAX, scenes[b].start + scenes[b].vo + 0.6 - start);
    if (dur < MIN) { log(`short ${k + 1} skipped: only ${dur.toFixed(0)} s`); continue; }
    // captions: each scene's words in chunks of 4, spread over that scene's spoken time
    const ev = [], caps = [];
    for (let i = a; i <= b; i++) {
      const words = scenes[i].text.split(/\s+/).filter(Boolean), chunks = [];
      for (let w = 0; w < words.length; w += 4) chunks.push(words.slice(w, w + 4).join(' '));
      if (chunks.length > 1 && chunks.at(-1).split(' ').length < 2) chunks.splice(-2, 2, chunks.at(-2) + ' ' + chunks.at(-1));
      const t0 = scenes[i].start - start + 0.15, per = (scenes[i].vo - 0.2) / chunks.length;
      chunks.forEach((c, j) => caps.push({ s: t0 + j * per, e: Math.min(dur, t0 + (j + 1) * per), text: assEsc(c) }));
    }
    // owner 2026-11-13: never two captions at once
    caps.sort((x, y) => x.s - y.s);
    caps.forEach((x, k) => { if (caps[k + 1]) x.e = Math.min(x.e, caps[k + 1].s - 0.02); });
    for (const x of caps) if (x.e - x.s > 0.05) ev.push(`Dialogue: 0,${assTime(x.s)},${assTime(x.e)},Cap,,0,0,0,,${x.text}`);
    const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n\n[V4+ Styles]\n` +
      `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
      `Style: Hook,Mukta ExtraBold,110,&H0040D5FF,&H0040D5FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,8,3,8,70,70,280,1\n` +
      `Style: Cap,Mukta ExtraBold,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,7,2,8,70,70,1330,1\n` +
      `Style: Tag,Mukta ExtraBold,50,&H0090D8F0,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,5,1,2,60,60,240,1\n\n` +
      `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
      `Dialogue: 1,0:00:00.00,${assTime(dur)},Hook,,0,0,0,,${assEsc(sh.hook)}\n` + ev.join('\n') + '\n' +
      `Dialogue: 1,0:00:00.00,${assTime(dur)},Tag,,0,0,0,,पूरी कहानी YouTube पर — Beyond Words ▶\n`;
    fs.writeFileSync(path.join(dir, `short${k}.ass`), ass);
    const outF = `short${k}.mp4`;
    // run ffmpeg inside the run folder so the subtitles filter gets short relative paths (no drive-letter escaping)
    // owner 2026-11-13: cut from the picture WITHOUT the long video's burned-in subtitles (they doubled up with the captions)
    const clean = fs.existsSync(path.join(dir, 'video_raw.mp4')) && fs.existsSync(path.join(dir, 'mix.wav'));
    const src = clean ? ['-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', 'video_raw.mp4', '-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', 'mix.wav']
      : ['-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', 'final.mp4'];
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...src, '-filter_complex',
      `[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.25[bg];` +
      `[b]scale=1080:-2[fg];[bg][fg]overlay=0:(H-h)/2-60,subtitles=short${k}.ass:fontsdir=fonts,format=yuv420p,` +
      `setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`,
      '-map', '[v]', '-map', clean ? '1:a' : '0:a', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '160k',
      '-af', 'afade=t=out:st=' + (dur - 0.8).toFixed(2) + ':d=0.8', '-movflags', '+faststart', `short${k}.tmp.mp4`], { cwd: dir, stdio: 'inherit' });
    fs.renameSync(path.join(dir, `short${k}.tmp.mp4`), path.join(dir, outF));
    out.push({ file: outF, title: String(sh.title).slice(0, 90), hook: sh.hook, start, dur });
    log(`short ${k + 1}: ${dur.toFixed(0)} s — ${sh.title}`);
  }
  fs.writeFileSync(path.join(dir, 'shorts.json'), JSON.stringify(out, null, 2));
  return out;
}
