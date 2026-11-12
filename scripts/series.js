// Series / parts (owner 2026-11-12): SAHITYA stories are told complete in 1 or 2 parts; CITYLOVE is an episode-wise
// series (6-8 episodes). The series bible (title, world, characters with fixed looks, episode plan) is planned once
// and kept in state/series.json, so every episode keeps the same people, faces and story line.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, aiJson, log } from './lib.js';
import { narratorFor } from './script_writer.js';

const FILE = path.join(ROOT, 'state', 'series.json');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } };
const write = list => { fs.writeFileSync(FILE + '.tmp', JSON.stringify(list, null, 2)); fs.renameSync(FILE + '.tmp', FILE); };

// a series of this category with an episode not made yet (episodes are made strictly in order)
export function nextEpisode(cat) {
  for (const s of read()) {
    if (s.cat !== cat) continue;
    const ep = s.episodes.find(e => !e.run);
    if (ep) return { series: s, ep };
  }
  return null;
}

export async function createSeries(topic, cat) {
  const many = cat === 'citylove';
  const { data } = await aiJson(
    `${narratorFor(cat)}\n\nPlan ${many ? 'an episode-wise web SERIES of 6 to 8 episodes (about 12 minutes each)' :
      'a COMPLETE story; decide whether it needs 1 part or 2 parts (2 only if the story truly needs ~25 minutes; each part about 14 minutes)'}` +
    ` for this idea: ${topic.topic}\nHook: ${topic.angle || ''}\n` +
    `Return JSON {"title":"short Hindi series/story name in Devanagari (2-5 words)","world":"place, time, social world in ` +
    `2 lines","characters":[{"name":"Hindi name as used in the story","role":"who they are","look":"in ENGLISH, fixed ` +
    `look for every picture: age, face, hair, build, clothes, one detail"}],"episodes":[{"n":1,"title":"Hindi episode ` +
    `title","plan":"what happens in this ${many ? 'episode' : 'part'} (4-6 sentences)","cliffhanger":"how it ends"}],` +
    `"ending":"how the whole story ends (felt, not preached)"}`,
    { check: d => {
      if (!d.title || !d.characters?.length || !d.episodes?.length) throw new Error('no series plan');
      if (many && d.episodes.length < 5) throw new Error('too few episodes');
      if (!many && d.episodes.length > 2) d.episodes = d.episodes.slice(0, 2);
      return d;
    }, temperature: 1.0 },
  );
  const s = { id: `${cat}-${Date.now()}`, cat, format: topic.format, topic: topic.topic, title: String(data.title).trim(),
    world: data.world, characters: data.characters, ending: data.ending, createdAt: new Date().toISOString(),
    episodes: data.episodes.map((e, i) => ({ n: i + 1, title: e.title, plan: e.plan, cliffhanger: e.cliffhanger })) };
  const list = read(); list.push(s); write(list);
  log(`new ${cat} ${many ? 'series' : 'story'}: "${s.title}" — ${s.episodes.length} ${many ? 'episodes' : 'part(s)'}`);
  return s;
}

// remember which run made the episode (and a one-line summary for the next episode's recap)
export function markEpisode(seriesId, n, run, summary = '') {
  const list = read();
  const s = list.find(x => x.id === seriesId);
  const e = s?.episodes.find(x => x.n === n);
  if (!e) return;
  Object.assign(e, { run, summary: summary || e.summary || '', at: new Date().toISOString() });
  write(list);
}

export function getSeries(id) { return read().find(s => s.id === id) || null; }
export function setPlaylist(id, playlistId) { const l = read(); const s = l.find(x => x.id === id); if (s) { s.playlistId = playlistId; write(l); } }
