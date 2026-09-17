import path from "path";
import dotenv from "dotenv";

// Must be imported before any module that reads process.env at load time
// (e.g. lib/groq.ts). Static imports are hoisted, so dotenv.config() in
// server.ts body runs too late.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
