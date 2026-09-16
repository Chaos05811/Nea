// Crisis / risk detection — layer 1 (deterministic keyword screen) and the scripted
// crisis-bridge reply. Ported directly from ai-service/app/services/risk.py (Python)
// to Node — see backend/CLAUDE.md for the migration. Behavior is unchanged: this is
// the layer that can trigger the crisis-bridge reply by itself, runs before any LLM
// call, and always wins over the LLM self-report / ML classifier layers.
//
// This list is intentionally small and high-precision for the MVP demo. Before any
// real deployment this needs proper clinical review — it is NOT a substitute for a
// validated risk-detection model.

const CRISIS_KEYWORDS = [
  // English — direct
  "kill myself", "end my life", "want to die", "suicide", "suicidal",
  "self harm", "self-harm", "cut myself", "hurting myself", "no reason to live",
  "better off dead", "can't go on", "cant go on", "end it all",
  // Hindi / Hinglish (Latin script, as people actually type)
  "khudkushi", "khud ko khatam", "marna chahta hoon", "marna chahti hoon",
  "jeena nahi chahta", "jeena nahi chahti", "zindagi khatam", "mar jaunga", "mar jaungi",
];

export const TELE_MANAS = { name: "Tele-MANAS", phone: "14416", note: "Govt. of India 24x7 mental health helpline" };
export const ICALL = { name: "iCall", phone: "9152987821", note: "TISS psychosocial helpline, multiple Indian languages" };

export const CRISIS_RESOURCES = [TELE_MANAS, ICALL];

export function keywordScreen(text: string): string | null {
  const lowered = text.toLowerCase();
  for (const phrase of CRISIS_KEYWORDS) {
    if (lowered.includes(phrase)) return phrase;
  }
  return null;
}

export function crisisBridgeReply(userDisplayName?: string | null): string {
  const name = userDisplayName ? `, ${userDisplayName}` : "";
  return (
    `I hear you${name}, and I'm really glad you told me. What you're going through sounds ` +
    "incredibly heavy right now, and you don't have to carry it alone.\n\n" +
    "I'm an AI — I can stay here and listen, but for what you're describing, talking to a " +
    "trained person right now matters more than anything I can say. You can reach:\n\n" +
    `• ${TELE_MANAS.name}: ${TELE_MANAS.phone} (${TELE_MANAS.note})\n` +
    `• ${ICALL.name}: ${ICALL.phone} (${ICALL.note})\n\n` +
    "Both are free and confidential, right now. Would it help if I stayed on here with you " +
    "while you reach out, or is there someone you trust nearby you could call?"
  );
}
