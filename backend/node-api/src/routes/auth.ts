import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { firebaseAuth } from "../lib/firebase";

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(100).optional(),
  ageGroup: z.enum(["child", "teen", "adult", "senior"]).optional(),
  language: z.string().min(2).max(10).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

function signToken(user: { id: string; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  });
}

function publicUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash, ...safe } = user;
  return safe;
}

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { email, password, displayName, ageGroup, language } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, ageGroup, language: language || "en" },
  });

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    // Also covers Google-only accounts trying to log in with a password — same generic error
    // on purpose, so we don't leak which emails exist or how they signed up.
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Google Sign-In: the frontend (expo-auth-session / @react-native-google-signin) gets a Google
// ID token and hands it here. We verify it server-side (never trust a client-decoded token) and
// issue our own JWT — the frontend only ever needs to deal with one token type after this.
const googleClient = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID);

router.post("/oauth/google", async (req: Request, res: Response) => {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
    return res.status(501).json({ error: "Google OAuth is not configured on this server yet" });
  }
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.idToken,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: "Invalid Google token" });
  }
  if (!payload?.sub || !payload.email) {
    return res.status(401).json({ error: "Invalid Google token" });
  }

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (!user) {
    // If someone already registered with this email via password, link the Google account
    // to it instead of creating a duplicate user.
    user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (user) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
    } else {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          googleId: payload.sub,
          displayName: payload.name || undefined,
        },
      });
    }
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Firebase Authentication: the frontend signs up/in via the Firebase JS SDK (email+password),
// gets a Firebase ID token, and hands it here along with the profile details we need for our own
// User row. We verify the ID token server-side with firebase-admin (never trust a client-decoded
// token), then upsert a User keyed by firebaseUid and issue our own JWT — same pattern as Google
// OAuth above, so the rest of the API only ever deals with one token type.
const firebaseAuthSchema = z.object({
  idToken: z.string().min(1),
  displayName: z.string().min(1).max(100).optional(),
  ageGroup: z.enum(["child", "teen", "adult", "senior"]).optional(),
  language: z.string().min(2).max(10).optional(),
});

router.post("/firebase", async (req: Request, res: Response) => {
  const parsed = firebaseAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { idToken, displayName, ageGroup, language } = parsed.data;

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: "Invalid Firebase token" });
  }
  if (!decoded.uid || !decoded.email) {
    return res.status(401).json({ error: "Firebase token missing uid or email" });
  }

  let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  if (!user) {
    // Link to an existing password/Google account with the same email if one exists.
    user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: decoded.uid,
          displayName: user.displayName ?? displayName ?? decoded.name ?? undefined,
          ageGroup: user.ageGroup ?? ageGroup ?? undefined,
          language: language ?? user.language,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: decoded.email,
          firebaseUid: decoded.uid,
          displayName: displayName ?? decoded.name ?? undefined,
          ageGroup,
          language: language || "en",
        },
      });
    }
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

export default router;
