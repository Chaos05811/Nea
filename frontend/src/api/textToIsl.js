// English → ISL gloss tokens, matching text_to_isl-main/main.py:
// strip punctuation, drop auxiliary stop-words, use SignFiles vocab, else fingerspell.
import { islVocabUrl } from './config';

// Same list as main.py (not extra articles — those have their own .sigml files).
const STOP_WORDS = new Set([
  'am', 'are', 'is', 'was', 'were', 'be', 'being', 'been', 'have', 'has', 'had',
  'does', 'did', 'could', 'should', 'would', 'can', 'shall', 'will', 'may', 'might',
  'must', 'let',
]);

let vocabMap = null; // lowercase token → SignFiles stem (hello, A, 1month, …)
let vocabPromise = null;

function addStem(map, stem) {
  const trimmed = String(stem || '').trim();
  if (!trimmed) return;
  map.set(trimmed.toLowerCase(), trimmed);
}

async function loadVocab() {
  const map = new Map();
  try {
    const res = await fetch(islVocabUrl());
    if (res.ok) {
      const text = await res.text();
      text.split(/\r?\n/).forEach((line) => addStem(map, line));
    }
  } catch {
    // keep whatever we have
  }
  if (map.size === 0) {
    ['hello', 'hi', 'you', 'me', 'i', 'good', 'bad', 'yes', 'no', 'please', 'sorry',
      'help', 'sad', 'happy', 'thankyou', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
      'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    ].forEach((w) => addStem(map, w));
  }
  return map;
}

export async function ensureIslVocabulary() {
  if (!vocabPromise) {
    vocabPromise = loadVocab().then((map) => {
      vocabMap = map;
      return map;
    });
  }
  return vocabPromise;
}

function tokenize(text) {
  return String(text || '')
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

function lemmaish(word) {
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function lookup(word, vocab) {
  const raw = word.toLowerCase();
  if (vocab.has(raw)) return vocab.get(raw);
  const compact = raw.replace(/[^a-z0-9]/g, '');
  if (vocab.has(compact)) return vocab.get(compact);
  const lem = lemmaish(raw);
  if (vocab.has(lem)) return vocab.get(lem);
  return null;
}

function expandToken(word, vocab) {
  const raw = word.toLowerCase();
  if (STOP_WORDS.has(raw)) return [];
  if (raw === 'thanks' || raw === 'thank' || raw === 'thankyou') {
    if (vocab.has('thankyou')) return [vocab.get('thankyou')];
  }
  const hit = lookup(word, vocab);
  if (hit) return [hit];
  return raw.replace(/[^a-z0-9]/g, '').split('').map((ch) => {
    if (/[a-z]/.test(ch)) return ch.toUpperCase();
    return vocab.has(ch) ? vocab.get(ch) : ch;
  });
}

export async function englishToIslTokens(text) {
  const vocab = await ensureIslVocabulary();
  const out = [];
  for (const word of tokenize(text)) {
    for (const token of expandToken(word, vocab)) {
      if (token) out.push(token);
    }
  }
  return out;
}
