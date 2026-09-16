import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import prisma from "../lib/prisma";
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

  res.status(201).json({ user: publicUser(user) });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    // Same generic error as a wrong password — don't leak which emails exist or how they signed up.
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ user: publicUser(user) });
});

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
  } catch {
    return res.status(401).json({ error: "Invalid Google token" });
  }
  if (!payload?.sub || !payload.email) {
    return res.status(401).json({ error: "Invalid Google token" });
  }

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (!user) {
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

  res.json({ user: publicUser(user) });
});

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
    const message = (err as Error).message || "";
    if (message.includes("serviceAccountKey.json") || message.includes("Firebase is not configured")) {
      return res.status(501).json({ error: message });
    }
    return res.status(401).json({ error: "Invalid Firebase token" });
  }
  if (!decoded.uid || !decoded.email) {
    return res.status(401).json({ error: "Firebase token missing uid or email" });
  }

  let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  if (!user) {
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

  res.json({ user: publicUser(user) });
});

// Plain lookup by userId — no bearer token / JWT.
router.get("/me", async (req: Request, res: Response) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  if (!userId) {
    return res.status(400).json({ error: "userId query param is required" });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

const updateProfileSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(100).optional(),
  ageGroup: z.enum(["child", "teen", "adult", "senior"]).optional(),
  language: z.string().min(2).max(10).optional(),
});

// Update display name, age group, and/or language. Email stays managed by auth provider.
router.patch("/me", async (req: Request, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { userId, displayName, ageGroup, language } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return res.status(404).json({ error: "User not found" });

  const data: { displayName?: string; ageGroup?: string; language?: string } = {};
  if (displayName !== undefined) data.displayName = displayName.trim();
  if (ageGroup !== undefined) data.ageGroup = ageGroup;
  if (language !== undefined) data.language = language;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No profile fields to update" });
  }

  const user = await prisma.user.update({ where: { id: userId }, data });
  res.json({ user: publicUser(user) });
});

export default router;
