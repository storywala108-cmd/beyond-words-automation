// Trend research → one fresh story idea. Reads what Hindi story videos get the most views per day right now (India),
// what worked on our own channel (state/learnings.json), and skips every idea we already made.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, aiJson, log } from './lib.js';
import { topRecent, channelSubs, topComments } from './yt.js';

// Owner's genre (2026-11-12): ORIGINAL Hindi family-drama stories told like a novel. Each run focuses on the format
// used least recently, so the channel rotates through all of them.
export const FORMATS = [
  { id: 'test', name: 'A hero secretly tests his relatives (pretends to be broke / sick / jobless) and learns who really stood by him',
    queries: ['रिश्तेदारों की कहानी', 'emotional family story hindi', 'अपनों का असली चेहरा कहानी'] },
  { id: 'property', name: 'A property / inheritance betrayal: forged papers, a greedy brother or in-law, the truth proved in the end',
    queries: ['जमीन जायदाद की कहानी', 'property dispute story hindi', 'भाई ने धोखा दिया कहानी'] },
  { id: 'parents', name: 'Old parents neglected by their children, and how respect and justice return to them',
    queries: ['बूढ़े माँ बाप की कहानी', 'old parents emotional story hindi', 'बेटे ने माँ को घर से निकाला'] },
  { id: 'bahu', name: 'A daughter-in-law or wife humiliated by her in-laws, and the quiet truth that turns everything',
    queries: ['बहू की कहानी', 'saas bahu emotional story', 'ससुराल वालों ने अपमान किया कहानी'] },
  { id: 'wedding', name: 'A wedding / dowry / family function where a poor relative is insulted and the tables turn',
    queries: ['शादी में अपमान कहानी', 'garib rishtedar ki kahani', 'dahej story hindi emotional'] },
  { id: 'friend', name: 'A friend or business partner who cheated, and how the hero got back what was his — legally',
    queries: ['दोस्त ने धोखा दिया कहानी', 'business partner betrayal story hindi', 'emotional hindi kahani dhokha'] },
  { id: 'comeback', name: 'Someone everybody called a failure comes back years later — the family sees who they really are',
    queries: ['सबने मज़ाक उड़ाया कहानी', 'motivational family story hindi', 'गरीब लड़के की कहानी'] },
  // SAHITYA (owner 2026-11-12): original stories in the craft of classic Hindi literature (hindwi.org 50 best stories)
  { id: 'gaon', cat: 'sahitya', name: 'A village / qasba story of poverty, pride and dignity in the manner of classic Hindi literature',
    queries: ['प्रेमचंद की कहानी', 'हिंदी साहित्य कहानी', 'hindi kahani audio'] },
  { id: 'maa', cat: 'sahitya', name: 'A literary story of a mother / old parent / child — sacrifice, hunger, love, told with a quiet devastating ending',
    queries: ['मार्मिक हिंदी कहानी', 'emotional hindi kahani audio', 'माँ की कहानी'] },
  { id: 'samaj', cat: 'sahitya', name: 'A literary story of society: a clerk, a labourer, a widow, a teacher — irony, class, duty, a moral turn',
    queries: ['सामाजिक कहानी हिंदी', 'hindi sahitya kahaniyan', 'हिंदी कथा कहानी'] },
  { id: 'vyangya', cat: 'sahitya', name: 'A satirical / ironic literary story about bureaucracy, middle-class pretence or social hypocrisy',
    queries: ['व्यंग्य कहानी', 'हरिशंकर परसाई', 'hindi satire story'] },
  // CITY LOVE SERIES (owner 2026-11-12): small-town youth in a big city, love, then betrayal — episode-wise
  { id: 'itlove', cat: 'citylove', name: 'Series: a small-town boy/girl joins an IT company in Bangalore/Pune/Hyderabad/Noida, falls in love, is later cheated',
    queries: ['love story hindi web series', 'प्यार में धोखा कहानी', 'bangalore love story hindi'] },
  { id: 'factorylove', cat: 'citylove', name: 'Series: a small-town youth working in a factory / small company / call centre in a big city, love and betrayal',
    queries: ['emotional love story hindi', 'धोखा प्यार की कहानी', 'sad love story hindi'] },
];
export const CATEGORIES = ['family', 'sahitya', 'citylove'];
export const catOf = f => f.cat || 'family';
// Playlist names on YouTube (one per category; series get their own playlist too)
export const CATEGORY_NAMES = { family: 'परिवार की कहानियाँ', sahitya: 'साहित्यिक कहानियाँ', citylove: 'शहर, प्यार और धोखा' };

// the category used least recently (rotates family → sahitya → citylove)
export function nextCategory() {
  const used = readJson('topics.json', []);
  const fmt = Object.fromEntries(FORMATS.map(f => [f.id, catOf(f)]));
  const last = Object.fromEntries(CATEGORIES.map(c => [c, -1]));
  used.forEach((u, i) => { const c = u.cat || fmt[u.format]; if (c in last) last[c] = i; });
  return CATEGORIES.slice().sort((a, b) => last[a] - last[b])[0];
}
const STATE = path.join(ROOT, 'state');
// owner's sample story (2026-11-12) — we copy only the genre, never this plot
const AVOID = ['Mumbai flat बेचकर गाँव लौटा बेटा जिसने bankruptcy का नाटक किया, मौसी ने उधार नहीं दिया, cousin ने माँ से plot की power of attorney माँगी'];
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(STATE, f), 'utf8')); } catch { return d; } };

// the format (of the given category) we used least recently (never-used first)
export function nextFormat(cat = 'family') {
  const used = readJson('topics.json', []);
  const pool = FORMATS.filter(f => catOf(f) === cat);
  const last = Object.fromEntries(pool.map(f => [f.id, -1]));
  used.forEach((u, i) => { if (u.format in last) last[u.format] = i; });
  return pool.slice().sort((a, b) => last[a.id] - last[b.id])[0];
}

export async function researchTrends(format = nextFormat()) {
  const seen = new Map();
  // the format's 3 queries + 1 general one ≈ 400 quota units per run
  for (const q of [...format.queries, 'hindi kahani family drama']) {
    try { for (const v of await topRecent(q)) seen.set(v.id, v); } catch (e) { log('search failed', q, e.message.slice(0, 120)); }
  }
  // podcasts (> 75 min) and clips (< 6 min) are not our format
  const vids = [...seen.values()].filter(v => v.minutes >= 6 && v.minutes <= 75);
  // outlier = views ÷ subscribers: a small channel's hit shows topic demand, a giant channel's shows only its fame
  const subs = await channelSubs([...new Set(vids.map(v => v.channelId))]).catch(e => { log('subs failed', e.message.slice(0, 120)); return {}; });
  for (const v of vids) {
    v.subs = subs[v.channelId] || 0;
    v.outlier = +(v.views / Math.max(1000, v.subs)).toFixed(2);
    v.score = Math.round(v.perDay * Math.sqrt(Math.min(50, Math.max(0.1, v.outlier))));
  }
  const list = vids.sort((a, b) => b.score - a.score).slice(0, 40);
  const requests = await viewerRequests(list);
  fs.writeFileSync(path.join(STATE, 'trends.json'), JSON.stringify({ at: new Date().toISOString(), list, requests }, null, 2));
  log('trending videos', list.length, 'top', list[0]?.perDay, '/day, outlier', list[0]?.outlier, '| viewer requests', requests.length);
  return Object.assign(list, { requests });
}

// "make a story on X / part 2" comments under the top trend videos and our own uploads (1 quota unit per video)
const ASK = /(video|episode|part ?2|next|please|pls|bhi banao|banaiye|बनाओ|बनाइए|भाग 2|अगला|कहानी चाहिए)/i;
async function viewerRequests(list) {
  const ours = readJson('uploads.json', []).slice(-10).map(u => ({ id: u.id, title: u.title, own: true }));
  const out = [];
  for (const v of [...ours, ...list.slice(0, 8)]) {
    for (const c of await topComments(v.id)) {
      if (ASK.test(c.text) && c.text.length < 280) out.push({ on: v.title, own: !!v.own, likes: c.likes, text: c.text.replace(/\s+/g, ' ') });
    }
  }
  // our own viewers first, then the most liked
  return out.sort((a, b) => (b.own - a.own) || (b.likes - a.likes)).slice(0, 25);
}

// code-side guard: the reply must say which owner format it belongs to
const fits = t => FORMATS.some(f => f.id === t.format) && String(t.topic || '').length > 5;

export async function pickTopic(trending, format = nextFormat(), audience = null) {
  const used = readJson('topics.json', []);
  const learn = readJson('learnings.json', {});
  const BRIEF = {
    family: 'ORIGINAL family-drama stories told like a novel (about 15 min, first-person male narrator)',
    sahitya: 'ORIGINAL literary short stories in the craft of classic Hindi literature (Premchand, Guleri, Prasad, ' +
      'Amarkant, Bhisham Sahni, Renu) — never their plots — told complete, 1 or 2 parts of ~14 min',
    citylove: 'an episode-wise SERIES (6-8 episodes of ~12 min): a small-town youth in a big Indian city (IT company / ' +
      'small company / factory), love, then betrayal, then rising again',
  };
  const lines = [
    `You plan videos for "Beyond Words", a Hindi YouTube channel. This video's category: ${BRIEF[catOf(format)]} ` +
    `(Indian Hindi-belt audience).`,
    `This video's FORMAT: ${format.name} (format id "${format.id}").`,
    `Demand signal: these Hindi story videos get the most views per day right now (title | views/day | outlier = views ÷ ` +
    `the channel's subscribers; above 1 means the STORY pulled viewers, not the channel's fame):`,
    ...trending.map(v => `- ${v.title} | ${v.perDay} | ${v.outlier ?? '?'}x`),
  ];
  if (trending.requests?.length) {
    lines.push('', 'What viewers are asking for in comments (likes; "OUR" = our own channel, weigh these most):',
      ...trending.requests.map(r => `- ${r.own ? 'OUR ' : ''}(${r.likes}) ${r.text}`));
  }
  if (audience?.wants?.length) {
    lines.push('', 'Competitor analysis (what this audience demands; strength 1-10):',
      ...audience.wants.map(w => `- [${w.strength}] ${w.topic} — ${w.evidence}`));
    if (audience.gaps?.length) lines.push(`Gaps viewers say nobody covers well: ${audience.gaps.join('; ')}`);
    if (audience.saturated?.length) lines.push(`Saturated right now (avoid unless a truly new angle): ${audience.saturated.join('; ')}`);
  }
  lines.push('',
    `What worked / didn't on OUR channel so far: ${JSON.stringify(learn.summary || 'no data yet')}`,
    `Never copy these plots: ${AVOID.join('; ')}`,
    `Story ideas we already made (never repeat): ${used.map(u => u.topic).join('; ') || 'none'}`, '',
    `Propose 5 ORIGINAL ${catOf(format) === 'citylove' ? 'SERIES' : 'story'} ideas for THIS FORMAT with the highest ` +
    `demand right now: invented ordinary Indian people, a strong emotional core and an ending that stays; no ` +
    `caste/religion hatred, no violence, no sexual content. Never copy any title or plot above or any famous story. ` +
    `Rank them by expected views.`,
    `Return JSON {"topics":[{"topic":"the story idea in Hindi (Devanagari), 1-2 specific sentences","angle":"the hook in one Hindi line",` +
    `"why":"why it will get views","title":"YouTube title idea in Hindi","format":"${format.id}"}]}`);
  const { data, model } = await aiJson(lines.join('\n'),
    // a reply without any usable topic for the format counts as bad, so aiJson asks again / tries the next model
    { check: d => { (d.topics || []).forEach(t => { t.format ||= format.id; }); if (!d.topics?.some(fits)) throw new Error('no topics for the format'); return d; }, temperature: 1.0 },
  );
  const usedSet = new Set(used.map(u => u.topic.toLowerCase()));
  const pick = data.topics.find(t => fits(t) && !usedSet.has(String(t.topic).toLowerCase()));
  if (!pick) throw new Error('no fresh topic for the format in the AI reply');
  log('topic by', model, '→', pick.topic);
  return { ...pick, candidates: data.topics };
}

if (process.argv[1]?.endsWith('trends.js')) {
  const f = nextFormat();
  const t = await researchTrends(f);
  const p = await pickTopic(t, f);
  console.log(JSON.stringify(p, null, 2));
}
