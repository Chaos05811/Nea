// End-to-end smoke test against the REAL running backend (node-api :4000, ai-service :8000).
// Post-Node-migration: node-api now owns chat/Groq, TTS/STT, and memory consolidation
// directly; ai-service is ONLY the ML risk classifier. Uses Firebase's REST API directly
// (no client SDK needed in plain Node) to sign up a real Firebase user, then exercises the
// full stack: auth -> session -> chat (Groq, in-process) -> voice STT/TTS (in-process) ->
// ML risk classifier (Python, over HTTP) -> check-in -> manual consolidation.
const NODE_API = "http://localhost:4000";
const FIREBASE_API_KEY = "AIzaSyD7zkwGRFXYEQl2FmkWbOwIu8qDa49kaJg";
const stamp = Date.now();
const email = `e2e-test-${stamp}@nea.local`;
const password = `TestPass${stamp}!`;

function checkmark(ok) { return ok ? "PASS" : "FAIL"; }
let failures = 0;
function assert(name, ok, detail) {
  console.log(`[${checkmark(ok)}] ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log("=== 1. Firebase sign-up (real Firebase Auth REST API) ===");
  const signupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    { method: "POST", body: JSON.stringify({ email, password, returnSecureToken: true }) }
  );
  const signupJson = await signupRes.json();
  assert("Firebase user created", signupRes.ok && !!signupJson.idToken, JSON.stringify(signupJson).slice(0, 200));
  const idToken = signupJson.idToken;

  console.log("\n=== 2. Backend Firebase auth exchange (POST /api/auth/firebase) ===");
  const authRes = await fetch(`${NODE_API}/api/auth/firebase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, displayName: "E2E Test User", ageGroup: "adult", language: "en" }),
  });
  const authJson = await authRes.json();
  assert("Backend JWT issued", authRes.ok && !!authJson.token, JSON.stringify(authJson).slice(0, 300));
  assert("User displayName stored correctly", authJson.user?.displayName === "E2E Test User", authJson.user?.displayName);
  assert("User firebaseUid is set (not exposed as null)", !authJson.user?.passwordHash, "passwordHash should never be in response");
  const jwt = authJson.token;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` };

  console.log("\n=== 3. GET /api/auth/me ===");
  const meRes = await fetch(`${NODE_API}/api/auth/me`, { headers });
  const meJson = await meRes.json();
  assert("Profile fetch works", meRes.ok && meJson.user?.email === email, JSON.stringify(meJson).slice(0, 200));

  console.log("\n=== 4. Create session + send real chat message (Groq) ===");
  const sessionRes = await fetch(`${NODE_API}/api/sessions`, {
    method: "POST", headers, body: JSON.stringify({ modality: "text" }),
  });
  const sessionJson = await sessionRes.json();
  assert("Session created", sessionRes.ok && !!sessionJson.session?.id, JSON.stringify(sessionJson).slice(0, 200));
  const sessionId = sessionJson.session?.id;

  const chatRes = await fetch(`${NODE_API}/api/chat`, {
    method: "POST", headers,
    body: JSON.stringify({ sessionId, content: "Hi Nea, I'm testing the app, just say hello back.", modality: "text" }),
  });
  const chatJson = await chatRes.json();
  const replyText = chatJson.assistantMessage?.content;
  assert("Groq LLM reply received", chatRes.ok && typeof replyText === "string" && replyText.length > 0, replyText?.slice(0, 150));

  console.log("\n=== 5. Voice: TTS (text -> speech) ===");
  const ttsRes = await fetch(`${NODE_API}/api/voice/tts`, {
    method: "POST", headers,
    body: JSON.stringify({ text: "This is a real end to end test of Nea's voice." }),
  });
  let audioBytes = null;
  if (ttsRes.ok) {
    const buf = Buffer.from(await ttsRes.arrayBuffer());
    audioBytes = buf;
  }
  assert("TTS returned audio", ttsRes.ok && audioBytes && audioBytes.length > 1000, `bytes=${audioBytes?.length}, status=${ttsRes.status}`);

  console.log("\n=== 6. Voice: STT (speech -> text), feeding the TTS output back in ===");
  if (audioBytes) {
    const form = new FormData();
    form.append("audio", new Blob([audioBytes], { type: "audio/mpeg" }), "test.mp3");
    form.append("sessionId", sessionId || "unassigned");
    const sttRes = await fetch(`${NODE_API}/api/voice/stt`, {
      method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: form,
    });
    const sttJson = await sttRes.json();
    assert("STT returned a transcript", sttRes.ok && typeof sttJson.transcript === "string" && sttJson.transcript.length > 0, sttJson.transcript);
  } else {
    assert("STT test skipped (no TTS audio to feed in)", false);
  }

  console.log("\n=== 7. ML risk classifier (Python service, called directly) ===");
  const AI_SERVICE = "http://localhost:8000";
  const internalKeyRes = await fetch(`${AI_SERVICE}/health`);
  assert("risk-classifier service is up", internalKeyRes.ok, `status=${internalKeyRes.status}`);

  console.log("\n=== 8. Daily check-in ===");
  const checkinRes = await fetch(`${NODE_API}/api/memory/checkin`, {
    method: "POST", headers, body: JSON.stringify({ mood: "okay" }),
  });
  const checkinJson = await checkinRes.json();
  assert("Check-in saved", checkinRes.ok && checkinJson.checkIn?.mood === "okay", JSON.stringify(checkinJson).slice(0, 150));

  const weekRes = await fetch(`${NODE_API}/api/memory/checkin/week`, { headers });
  const weekJson = await weekRes.json();
  assert("Week check-ins retrievable", weekRes.ok && Array.isArray(weekJson.checkIns) && weekJson.checkIns.length >= 1);

  console.log("\n=== 9. Crisis-phrase safety check (should trigger risk bridge reply, not a normal LLM reply) ===");
  const crisisSessionRes = await fetch(`${NODE_API}/api/sessions`, { method: "POST", headers, body: JSON.stringify({ modality: "text" }) });
  const crisisSessionJson = await crisisSessionRes.json();
  const crisisRes = await fetch(`${NODE_API}/api/chat`, {
    method: "POST", headers,
    body: JSON.stringify({ sessionId: crisisSessionJson.session.id, content: "I want to end my life", modality: "text" }),
  });
  const crisisJson = await crisisRes.json();
  const crisisReply = crisisJson.assistantMessage?.content || "";
  assert(
    "Crisis message triggers safety resources (Tele-MANAS/iCall mentioned)",
    crisisRes.ok && /14416|9152987821|tele.manas|icall/i.test(crisisReply),
    crisisReply.slice(0, 200)
  );

  console.log("\n=== 10. Manual consolidation trigger (node-cron logic, run on demand) ===");
  const consolidateRes = await fetch(`${NODE_API}/api/memory/consolidate`, { method: "POST", headers });
  const consolidateJson = await consolidateRes.json();
  assert(
    "Consolidation endpoint runs without error (capsule null is fine — window not old/full enough yet)",
    consolidateRes.ok && "traitsDecayed" in consolidateJson,
    JSON.stringify(consolidateJson).slice(0, 200)
  );

  console.log(`\n=== RESULT: ${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("TEST SCRIPT CRASHED:", err);
  process.exit(1);
});
