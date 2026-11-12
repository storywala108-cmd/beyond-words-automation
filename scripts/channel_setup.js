// One-time YouTube channel setup for reach (owner 2026-11-12: profiles set so videos get recommended to
// non-subscribers): description, keywords, country, default language, not made for kids, upload defaults.
import { api } from './yt.js';
import { env, log } from './lib.js';

const ch = (await api('channels?part=brandingSettings,status&mine=true')).items[0];
const b = ch.brandingSettings || {};
b.channel = {
  ...b.channel,
  description: 'Beyond Words — कुछ कहानियाँ शब्दों से आगे की होती हैं।\n\n' +
    'परिवार, पैसा, धोखा और इंसाफ़ की दिल छू लेने वाली कहानियाँ, किसी उपन्यास की तरह। जब वक़्त बुरा आता है, तब पता चलता है कौन ' +
    'अपना है और कौन सिर्फ़ नाम का। रिश्तों की अनकही कहानियाँ — हर बार एक नई, हर बार दिल के करीब।\n\n' +
    'रोज़ एक नई लंबी कहानी + Shorts।\nFacebook: Beyond Words · Instagram: @beyondwords.kahani\n\n' +
    'सभी कहानियाँ काल्पनिक हैं; किसी भी व्यक्ति या घटना से समानता संयोग मात्र है।',
  keywords: '"hindi kahani" "family drama" "emotional story" "hindi story" "रिश्तों की कहानी" "परिवार की कहानी" ' +
    '"moral story hindi" "hindi audio story" "kahaniyan" "beyond words"',
  country: 'IN',
  defaultLanguage: 'hi',
};
await api('channels?part=brandingSettings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ch.id, brandingSettings: b }) });
await api('channels?part=status', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ch.id, status: { selfDeclaredMadeForKids: false } }) }).catch(e => log('kids flag:', e.message.slice(0, 120)));
const after = (await api(`channels?part=brandingSettings,status&id=${ch.id}`)).items[0];
log('channel', ch.id, '| country', after.brandingSettings.channel.country, '| lang', after.brandingSettings.channel.defaultLanguage,
  '| keywords', (after.brandingSettings.channel.keywords || '').length, 'chars | madeForKids', after.status?.madeForKids);
