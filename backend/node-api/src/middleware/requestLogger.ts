import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

function requestPath(req: Request): string {
  // Prefer originalUrl so query strings show up (useful for ?userId=…).
  return req.originalUrl || req.url;
}

function pickUserId(req: Request): string | undefined {
  const fromBody = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const fromQuery = typeof req.query?.userId === "string" ? req.query.userId : undefined;
  return fromBody || fromQuery;
}

/**
 * Logs every finished HTTP request: success (2xx/3xx) at info, client/server
 * errors at warn/error. Does not log bodies (passwords / crisis text).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - started;
    const status = res.statusCode;
    const meta: Record<string, unknown> = {
      method: req.method,
      path: requestPath(req),
      status,
      ms,
    };
    const userId = pickUserId(req);
    if (userId) meta.userId = userId;

    const summary = `${req.method} ${requestPath(req)} → ${status} (${ms}ms)`;

    if (status >= 500) {
      logger.error(`api fail  ${summary}`, meta);
    } else if (status >= 400) {
      logger.warn(`api fail  ${summary}`, meta);
    } else {
      logger.info(`api ok    ${summary}`, meta);
    }
  });

  next();
}

/** Express error middleware — logs the stack, returns a safe JSON body. */
export function errorLogger(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error("unhandled error", {
    method: req.method,
    path: requestPath(req),
    message,
    stack,
  });
  if (res.headersSent) {
    return _next(err);
  }
  res.status(500).json({ error: "Internal server error" });
}
