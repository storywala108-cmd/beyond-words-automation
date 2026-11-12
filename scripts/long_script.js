// Full Hindi story script, written like a novel: story bible (characters with fixed looks, the "हिसाब" device,
// planted evidence) → outline → chapter by chapter (draft + novelist-editor pass) → length + banned-phrase sweeps →
// packaging (title, description, tags, thumbnail) verified against the script.
import fs from 'node:fs';
import { aiJson, env, log } from './lib.js';
import { NARRATOR, bannedHits } from './script_writer.js';

const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;
// spoken Hindi from Gemini TTS ≈ 130-145 words/min → 2,000 words ≈ 14-15 min (one long video a day on free quotas)
const TARGET = Number(env.TARGET_WORDS || 2000);

// "ui" = an on-screen motion graphic instead of a picture (WhatsApp group, call, bank balance, the हिसाब note,
// a document, a big text line). They cost no image quota and are what makes the edit feel alive.
const SCENE_SHAPE = `"scenes":[{"text":"Hindi narration in Devanagari for this beat, 1-3 sentences, 18-32 words",
"prompt":"in ENGLISH, only when the scene shows a picture: one clear film-still moment; NAME the characters from the
story bible (e.g. 'Mohan', 'Maa'), what they do, where, light and mood; one main subject, medium or close shot,
faces clear; no text, no phone screens","ui":null OR one of
{"type":"whatsapp","title":"group or person name","messages":[{"from":"me" or a name,"text":"short Hindi message"}]} |
{"type":"call","name":"caller name","state":"incoming" or "ended","duration":"0:42"} |
{"type":"bank","label":"Balance" or "Credited" or "Debited","amount":"₹3,86,42,000","remark":"short remark"} |
{"type":"note","title":"हिसाब","lines":["every line written so far, the newest last"]} |
{"type":"doc","title":"document heading in English","lines":["2-5 short lines"],"highlight":"the key words"} |
{"type":"text","lines":["1-3 very short Hindi lines shown big, e.g. सत्रह साल।"]}}]`;

function normScenes(d) {
  const scenes = (d.scenes || []).map(s => {
    let ui = s.ui && typeof s.ui === 'object' && s.ui.type ? s.ui : null;
    if (ui && !['whatsapp', 'call', 'bank', 'note', 'doc', 'text'].includes(ui.type)) ui = null;
    return {
      text: String(s.text || s.narration || '').trim(),
      visual: ui ? 'ui' : 'ink',
      prompt: String(s.prompt || s.image_prompt || '').trim(),
      ui,
    };
  }).filter(s => s.text && (s.ui || s.prompt));
  if (scenes.length < 3) throw new Error('too few scenes');
  return { ...d, scenes };
}

export async function outline(topic) {
  const minutes = Math.round(TARGET / 135);
  const chapters = Math.max(5, Math.round(TARGET / 300));
  const { data } = await aiJson(
    `${NARRATOR}\n\nPlan an ORIGINAL ${minutes}-minute Hindi story for this idea: ${topic.topic}\nHook angle: ${topic.angle}\n` +
    `Build the story bible first, then ${chapters} chapters that escalate (setup + secret → first humiliation → ` +
    `money → property/the people he loves → the trap/proof → public climax with legal justice → quiet ending).\n` +
    `Return JSON {"title_idea":"...","narrator":"who 'मैं' is (name, age, job, city)","secret":"what only the narrator ` +
    `and the viewer know","characters":[{"name":"Hindi name as used in the story","role":"relation to the narrator",` +
    `"look":"in ENGLISH, fixed look for every picture: age, face, hair, build, clothes, one detail (e.g. 62-year-old ` +
    `woman, round face, grey hair in a bun, small red bindi, faded green cotton saree, thin gold bangles)"}],` +
    `"device":"the narrator's हिसाब note/diary and how he keeps it","plants":["objects/facts planted early that pay ` +
    `off as proof"],"cold_open":"the first 20 seconds","chapters":[{"name":"short Hindi chapter title","beats":["..."],` +
    `"cliffhanger":"how it ends"}],"climax":"where and how the truth comes out","ending":"final image + last line idea"}`,
    { check: d => { if (!d.chapters?.length || !d.characters?.length) throw new Error('no chapters'); return d; }, temperature: 1.0 },
  );
  return data;
}

async function writeChapter(topic, plan, i, prevTail) {
  const ch = i < 0 ? { name: 'Cold open', beats: [plan.cold_open], cliffhanger: '' } : plan.chapters[i];
  const target = i < 0 ? 80 : Math.round(TARGET / plan.chapters.length);
  const isLast = i === plan.chapters.length - 1;
  const what = i < 0
    ? 'the COLD OPEN: start inside the most gripping quiet moment with one concrete detail and the secret; no question ' +
      'as the first line; end on a line that makes the listener stay for the whole story'
    : `chapter "${ch.name}" (end it on: ${ch.cliffhanger || 'a turn that makes the listener stay'})`;
  const ask = `${NARRATOR}\n\nStory bible + plan: ${JSON.stringify(plan)}\n` +
    `Write ${what} in Hindi — about ${target} words, ${Math.max(3, Math.round(target / 25))} scenes. ` +
    `About one scene in three should be a "ui" motion graphic where the story naturally has a phone message, call, ` +
    `bank amount, the हिसाब note, a document or a line worth showing big (for those, "prompt" can be empty). Vary ` +
    `them: WhatsApp / call / bank / doc / text first; the "note" at most ONCE per chapter, only right after a ` +
    `betrayal, each note line under 12 words ("मौसी – माँ को दुकान के बाहर बीस मिनट खड़ा रखा।"). ` +
    `Picture scenes must name the characters exactly as in the bible. ` +
    (prevTail ? `It continues right after: "${prevTail}". Flow on naturally, don't recap. ` : '') +
    (isLast ? `This is the final chapter: land the ending (${plan.ending}), then one short warm line asking viewers ` +
      `to write in the comments whether they have seen such relatives / such a mother. ` : '') +
    `\nReturn JSON {${SCENE_SHAPE}}`;
  const draft = await aiJson(ask, { check: normScenes });
  const edited = await aiJson(
    `${NARRATOR}\n\nYou are the novelist's editor. Make this Hindi read like a page-turner told aloud: sharper hooks, ` +
    `more concrete sensory detail, natural dialogue lines, the narrator's inner voice, short lines at tense moments; cut ` +
    `filler and repeats; keep every plot fact, scene order, "ui" objects and picture prompts (fix names to match the bible). ` +
    `No banned phrases.\nBIBLE: ${JSON.stringify({ characters: plan.characters, device: plan.device })}\n` +
    `DRAFT: ${JSON.stringify(draft.data)}\nReturn JSON {${SCENE_SHAPE}}`,
    { check: normScenes, temperature: 0.8 },
  );
  return { name: ch.name, scenes: edited.data.scenes, model: edited.model };
}

// cacheFile: outline + finished chapters are saved as they're made, so a restart continues instead of starting over
export async function writeLongScript(topic, cacheFile) {
  const cache = (() => { try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { return {}; } })();
  const keep = () => cacheFile && fs.writeFileSync(cacheFile, JSON.stringify(cache));
  log('story bible + outline…');
  const plan = cache.plan || (cache.plan = await outline(topic));
  keep();
  const chapters = cache.chapters || (cache.chapters = []);
  let tail = chapters.at(-1)?.scenes.at(-1).text || '';
  for (let i = chapters.length - 1; i < plan.chapters.length; i++) {
    const c = await writeChapter(topic, plan, i, tail);
    chapters.push(c); keep();
    tail = c.scenes.at(-1).text;
    log(`chapter ${i + 1}/${plan.chapters.length}: ${c.name} (${words(c.scenes.map(s => s.text).join(' '))} words, ${c.scenes.filter(s => s.ui).length} ui, ${c.model})`);
  }
  // too short? add real scenes to the thinnest chapters
  for (let pass = 0; pass < 5; pass++) {
    const total = words(chapters.flatMap(c => c.scenes.map(s => s.text)).join(' '));
    if (total >= TARGET * 0.9) break;
    const ci = chapters.map((c, k) => [k, words(c.scenes.map(s => s.text).join(' '))]).filter(([k]) => k > 0)
      .sort((a, b) => a[1] - b[1])[0][0];
    const c = chapters[ci];
    log(`script ${total} words < ${Math.round(TARGET * 0.9)} → adding scenes to "${c.name}"`);
    const need = Math.min(6, Math.max(3, Math.round((TARGET - total) / 25 / 2)));
    const r = await aiJson(`${NARRATOR}\n\nStory bible: ${JSON.stringify({ characters: plan.characters, device: plan.device })}\n` +
      `This chapter is too thin:\n${JSON.stringify(c.scenes.map(s => s.text))}\nWrite ${need} NEW Hindi scenes ` +
      `(18-32 words each) with more of what the characters said, felt and noticed — a small humiliation, a memory, a ` +
      `detail of the house — that fit after one of these lines. Don't repeat anything. ` +
      `Return JSON {"after_scene": index of the existing scene they follow (0-based), ${SCENE_SHAPE}}`,
      { check: normScenes, temperature: 0.8 }).catch(() => null);
    if (!r) break;
    const at = Math.min(c.scenes.length - 1, Math.max(0, Number(r.data.after_scene ?? c.scenes.length - 1)));
    c.scenes.splice(at + 1, 0, ...r.data.scenes);
  }

  // banned phrases: rewrite only the offending scenes
  for (const c of chapters) {
    for (const s of c.scenes) {
      const hits = bannedHits(s.text);
      if (!hits.length) continue;
      const r = await aiJson(`Rewrite this Hindi narration line without the phrases ${hits.join(', ')}, same voice and facts. ` +
        `Line: "${s.text}"\nReturn JSON {"text":"..."}`, { check: d => { if (!d.text) throw new Error('empty'); return d; } });
      s.text = r.data.text;
    }
  }
  log('style sweeps (length, tics, banned phrases)…');
  for (const tic of ['दोस्तों', 'सच में', 'सोचिए', 'उस दिन']) {
    const hits = chapters.flatMap(c => c.scenes).filter(s => s.text.includes(tic));
    for (const s of hits.slice(2)) {
      const r = await aiJson(`${NARRATOR}\nRewrite this line without "${tic.trim()}", same meaning and voice: "${s.text}"\nReturn JSON {"text":"..."}`,
        { check: d => { if (!d.text) throw new Error('empty'); return d; } }).catch(() => null);
      if (r) s.text = r.data.text;
    }
  }

  const all = chapters.flatMap(c => c.scenes.map(s => s.text)).join(' ');
  const { data: pack } = await aiJson(
    `${NARRATOR}\n\nPackage this Hindi story video for YouTube India. Story bible: ${JSON.stringify(plan.characters)}\n` +
    `Script: ${all.slice(0, 7000)}\n` +
    `Return JSON {"title":"max 80 chars, Hindi in Devanagari with at most 2 English words, an honest emotional ` +
    `curiosity hook about what really happens (e.g. मैंने सबसे कहा मैं बर्बाद हो गया… फिर अपनों ने जो किया), one emoji at ` +
    `most","thumb_text":"2-5 big Hindi words for the thumbnail, different from the title, e.g. माँ ने चुप्पी तोड़ी!",` +
    `"thumb_prompt":"in ENGLISH: thumbnail picture: the most emotional moment, ONE character (named, with the bible ` +
    `look) large on the RIGHT half, face and strong emotion clear, warm dramatic light, the LEFT 40% simple and darker ` +
    `for big text, no text","description":"2 short paragraphs in ENGLISH about the story without spoiling the ending, ` +
    `then one line inviting viewers to share in the comments","tags":["12-15 tags, Hindi and English, e.g. hindi ` +
    `kahani, family drama, emotional story"]}`,
    { check: d => { if (!d.title || !d.description) throw new Error('no package'); return d; } },
  );
  await verifyPack(pack, all);
  return { topic, plan, chapters, pack, words: words(all), banned_left: bannedHits(all) };
}

// Misleading titles hurt trust and the channel, so title + thumbnail text must be literally supported by the script.
export async function verifyPack(pack, script) {
  const { data } = await aiJson(
    `Script of a Hindi family-drama story video:\n${script.slice(0, 9000)}\n\nProposed YouTube title: "${pack.title}"\nThumbnail text: "${pack.thumb_text}"\n` +
    `Check that the title and thumbnail text only promise what really happens in this script. Curiosity is fine, ` +
    `invented events are not. Return JSON {"title_ok":true/false,"thumb_ok":true/false,` +
    `"title":"the same title if ok, else an honest curiosity title in Hindi (Devanagari) max 80 chars","thumb_text":"same if ok, else 2-5 honest Hindi words","why":"short"}`,
    { check: d => { if (!d.title) throw new Error('no verdict'); return d; }, temperature: 0.3 },
  );
  if (!data.title_ok) { log('title fixed:', pack.title, '→', data.title, `(${data.why})`); pack.title = data.title; }
  if (!data.thumb_ok && data.thumb_text) { log('thumb text fixed:', pack.thumb_text, '→', data.thumb_text); pack.thumb_text = data.thumb_text; }
  return pack;
}
