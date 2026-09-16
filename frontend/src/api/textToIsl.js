// English → ISL gloss tokens (shoebham/text_to_isl style, client-side).
const STOP_WORDS = new Set([
  'am','are','is','was','were','be','being','been','have','has','had','does','did',
  'could','should','would','can','shall','will','may','might','must','let','a','an',
  'the','to','of','for','in','on','at','by','with','from','as','into','than','that',
  'this','these','those','it','its','and','or','but','if','so','do','not',"n't",
]);

const SEED_WORDS = [
  'hello','hi','how','you','your','name','my','me','i','we','they','good','bad','yes','no',
  'please','thankyou','sorry','help','help-me','help-you','feel','sad','happy','angry',
  'worry','fear','calm-down','need','want','talk','understand','donotunderstand','friend',
  'family','mother','father','home','school','work','today','tomorrow','yesterday','time',
  'day','night','morning','evening','eat','drink','water','food','sleep','go','come','see',
  'love','like','important','problem','plan','think','know','learn','doctor','what','when',
  'where','who','why','howareyou','ok','fine','thank','thanks',
];

let vocabSet = new Set(SEED_WORDS);
let vocabPromise = null;
const WORDS_CDN = 'https://cdn.jsdelivr.net/gh/shoebham/text_to_isl@main/words.txt';
export const SIGML_BASE = 'https://cdn.jsdelivr.net/gh/shoebham/text_to_isl@main/static/SignFiles';

export async function ensureIslVocabulary() {
  if (vocabPromise) return vocabPromise;
  vocabPromise = (async () => {
    try {
      const res = await fetch(WORDS_CDN);
      if (!res.ok) return vocabSet;
      const text = await res.text();
      const next = new Set(vocabSet);
      text.split(/\r?\n/).forEach((line) => { const w = line.trim().toLowerCase(); if (w) next.add(w); });
      vocabSet = next;
    } catch { /* keep seed */ }
    return vocabSet;
  })();
  return vocabPromise;
}

function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);
}

function lemmaish(word) {
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function expandToken(word, vocab) {
  const raw = word.toLowerCase();
  if (STOP_WORDS.has(raw)) return [];
  if (raw === 'thanks' || raw === 'thank') return vocab.has('thankyou') ? ['thankyou'] : ['t','h','a','n','k'];
  if (vocab.has(raw)) return [raw];
  const lem = lemmaish(raw);
  if (vocab.has(lem)) return [lem];
  return raw.replace(/[^a-z0-9]/g, '').split('');
}

export async function englishToIslTokens(text) {
  const vocab = await ensureIslVocabulary();
  const out = [];
  for (const word of tokenize(text)) {
    for (const t of expandToken(word, vocab)) {
      out.push(t.length === 1 ? t.toUpperCase() : t);
    }
  }
  return out;
}
