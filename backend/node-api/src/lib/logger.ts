type LogLevel = "info" | "warn" | "error" | "debug";

function stamp(): string {
  return new Date().toISOString();
}

function line(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const base = `[${stamp()}] [${level.toUpperCase()}] ${message}`;
  if (!meta || Object.keys(meta).length === 0) return base;
  return `${base} ${JSON.stringify(meta)}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(line("info", message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(line("warn", message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(line("error", message, meta));
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    console.log(line("debug", message, meta));
  },
};
