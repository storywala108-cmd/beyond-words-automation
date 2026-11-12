// Shorts (owner 2026-11-12: 4 Shorts EVERY day on YouTube, Facebook and Instagram). The workflow runs this 4 times a
// day (≈ 9 AM, 1 PM, 5 PM, 9 PM IST); each run posts the NEXT unposted Short of the newest PUBLIC long video:
// YouTube Short (description links the full video) → Facebook Reel → Instagram Reel; the day's first Short also goes
// out as a Facebook + Instagram Story. Every platform is marked in Drive right after it succeeds → never twice.
// Usage: node scripts/publish_shorts.js
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, env, log } from './lib.js';
import { folder, list, download, setProps, PUBLISHED } from './drive.js';
import { upload, api } from './yt.js';
import { publishFacebookReel, publishInstagramReel, publishFacebookStory, publishInstagramStory } from './social.js';

const on = k => String(env[k]).toLowerCase() === 'true';
if (!on('YT_ENABLED') && !on('FB_ENABLED') && !on('IG_ENABLED')) { log('no platform enabled → no Shorts'); process.exit(0); }

const pid = await folder(PUBLISHED);
const files = await list(pid);
const isShort = f => /^short\d\.mp4$/.test(f.appProperties?.kind || '');
// newest published long video that still has unposted Shorts
const runs = [...new Set(files.filter(f => isShort(f) && !f.appProperties?.postedShort).map(f => f.appProperties.run))]
  .map(run => ({ run, at: files.find(f => f.appProperties?.run === run)?.appProperties?.publishedAt || '' }))
  .sort((a, b) => b.at.localeCompare(a.at));
if (!runs.length) { log('no unposted Shorts in Drive'); process.exit(0); }
// the full video must already be public, otherwise the Short's link would lead to a private video
let mine, videoId;
for (const r of runs) {
  const m = files.filter(f => f.appProperties?.run === r.run);
  const vid = m.find(f => f.appProperties?.videoId)?.appProperties.videoId;
  const st = vid ? (await api(`videos?part=status&id=${vid}`)).items?.[0]?.status : null;
  if (st?.privacyStatus === 'public') { mine = m; videoId = vid; break; }
  log('skipping', r.run, '— its long video is not public yet');
}
if (!mine) { log('no Shorts whose full video is public yet'); process.exit(0); }

const tmp = path.join(ROOT, 'runs', '_shorts'); fs.mkdirSync(tmp, { recursive: true });
const metaF = mine.find(f => f.appProperties.kind === 'shorts.json');
await download(metaF.id, path.join(tmp, 'shorts.json'));
const shorts = JSON.parse(fs.readFileSync(path.join(tmp, 'shorts.json'), 'utf8'));
const f = mine.filter(x => isShort(x) && !x.appProperties.postedShort).sort((a, b) => a.appProperties.kind.localeCompare(b.appProperties.kind))[0];
const m = shorts.find(x => x.file === f.appProperties.kind) || { title: 'आगे क्या हुआ? पूरी कहानी देखिए', hook: '' };
const local = path.join(tmp, f.appProperties.kind);
await download(f.id, local);
const p = { ...f.appProperties };
const mark = async extra => { Object.assign(p, extra); await setProps(f.id, extra); };
const link = `https://youtu.be/${videoId}`;
const tags = '#shorts #hindikahani #familydrama #emotionalstory #beyondwords';
const caption = `${m.title}\n\nपूरी कहानी देखिए YouTube पर: Beyond Words (@beyondwordskahani)\n\n${tags}`;

if (on('YT_ENABLED') && !p.ytShort) {
  try {
    const v = await upload(local, { title: `${m.title} #shorts`.slice(0, 100), privacy: 'public', categoryId: '24',
      description: `${m.title}\n\nपूरी कहानी यहाँ देखिए: ${link}\n\n${tags}`, tags: ['hindi kahani', 'family drama', 'shorts', 'emotional story'],
      synthetic: String(env.YT_SYNTHETIC ?? 'true').toLowerCase() === 'true' });
    await mark({ ytShort: v.id }); log('YOUTUBE SHORT https://youtube.com/shorts/' + v.id);
  } catch (e) { log('youtube short failed:', e.message.slice(0, 200)); }
}
if (on('FB_ENABLED') && !p.fbReel) {
  try { const u = await publishFacebookReel(local, m.title, caption.replace('YouTube पर: Beyond Words (@beyondwordskahani)', link)); await mark({ fbReel: u }); log('FACEBOOK REEL', u); }
  catch (e) { log('facebook reel failed:', e.message.slice(0, 200)); if (e.maybePosted) await mark({ fbReel: 'maybe-posted' }); }
}
if (on('IG_ENABLED') && !p.igReel) {
  try { const u = await publishInstagramReel(local, caption); await mark({ igReel: u }); log('INSTAGRAM REEL', u); }
  catch (e) { log('instagram reel failed:', e.message.slice(0, 200)); if (e.maybePosted) await mark({ igReel: 'maybe-posted' }); }
}
// the day's first Short (short0) also goes out as Stories, only after its reel really posted on that platform
if (f.appProperties.kind === 'short0.mp4') {
  if (p.fbReel && p.fbReel !== 'maybe-posted' && !p.fbStory) {
    try { await mark({ fbStory: await publishFacebookStory(local) }); log('FACEBOOK STORY'); } catch (e) { log('facebook story failed:', e.message.slice(0, 160)); if (e.maybePosted) await mark({ fbStory: 'maybe-posted' }); }
  }
  if (p.igReel && p.igReel !== 'maybe-posted' && !p.igStory) {
    try { await mark({ igStory: await publishInstagramStory(local) }); log('INSTAGRAM STORY'); } catch (e) { log('instagram story failed:', e.message.slice(0, 160)); if (e.maybePosted) await mark({ igStory: 'maybe-posted' }); }
  }
}
// done once every enabled platform has it (a failed platform is retried by the next run, at most 3 runs)
const tries = Number(p.tries || 0) + 1;
const done = ['YT_ENABLED:ytShort', 'FB_ENABLED:fbReel', 'IG_ENABLED:igReel'].every(x => { const [k, v] = x.split(':'); return !on(k) || p[v]; });
await mark(done || tries >= 3 ? { postedShort: p.ytShort || p.fbReel || p.igReel || 'failed', postedAt: new Date().toISOString(), tries: String(tries) } : { tries: String(tries) });
fs.rmSync(tmp, { recursive: true, force: true });
