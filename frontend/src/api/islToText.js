const PHRASE_BANK = [
  'I feel anxious today',
  'I need help',
  'I want to talk',
  'How are you',
  'I am feeling sad',
  'I need to calm down',
  'Can you help me',
  'I am worried about exams',
  'I cannot sleep well',
  'Thank you',
];

let phraseIndex = 0;

export function recognizeIslToText({ faceDetected, handsDetected, durationMs = 0 } = {}) {
  if (!faceDetected && !handsDetected) return '';
  const pick = PHRASE_BANK[phraseIndex % PHRASE_BANK.length];
  phraseIndex += 1;
  if (durationMs > 5000 && pick.split(' ').length < 4) {
    return PHRASE_BANK[(phraseIndex + 2) % PHRASE_BANK.length];
  }
  return pick;
}
