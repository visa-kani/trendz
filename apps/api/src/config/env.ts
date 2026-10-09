import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4100),
  WEB_URL: z.url().default("http://localhost:3100"),
  CORS_ORIGINS: optionalString,
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  OTP_SECRET: z.string().min(32, "OTP_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: bool,
  COOKIE_DOMAIN: optionalString,

  PAYMENT_PROVIDER: z.enum(["razorpay", "mock"]).default("mock"),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,

  R2_ACCOUNT_ID: optionalString,
  R2_ENDPOINT: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_PUBLIC_URL: optionalString,
  R2_FORCE_PATH_STYLE: bool,

  SMS_PROVIDER: z.enum(["msg91", "console"]).default("console"),
  SMS_API_KEY: optionalString,
  SMS_SENDER_ID: optionalString,
  SMS_TEMPLATE_OTP: optionalString,
  SMS_TEMPLATE_ORDER: optionalString,
  SMS_TEMPLATE_SHIPPING: optionalString,

  EMAIL_PROVIDER: z.enum(["brevo", "ses", "smtp"]).default("smtp"),
  EMAIL_API_KEY: optionalString,
  EMAIL_FROM_ADDRESS: z.string().default("orders@drift.local"),
  EMAIL_FROM_NAME: z.string().default("Drift"),
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1125),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_SECURE: bool,

  SHIPPING_PROVIDER: z.enum(["shiprocket", "mock"]).default("mock"),
  SHIPPING_API_KEY: optionalString,
  SHIPPING_API_SECRET: optionalString,
  SHIPPING_PICKUP_LOCATION: z.string().default("Primary"),
  SHIPPING_WEBHOOK_TOKEN: optionalString,

  SEED_ADMIN_EMAIL: optionalString,
  SEED_ADMIN_PASSWORD: optionalString,
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  const env = parsed.data;

  // Production guard rails: development adapters and insecure cookies are refused.
  if (env.NODE_ENV === "production") {
    const problems: string[] = [];
    if (env.PAYMENT_PROVIDER === "mock") problems.push("PAYMENT_PROVIDER=mock is not allowed in production");
    if (env.SMS_PROVIDER === "console") problems.push("SMS_PROVIDER=console is not allowed in production");
    if (env.SHIPPING_PROVIDER === "mock") problems.push("SHIPPING_PROVIDER=mock is not allowed in production");
    if (!env.COOKIE_SECURE) problems.push("COOKIE_SECURE must be true in production");
    if (env.PAYMENT_PROVIDER === "razorpay" && !env.RAZORPAY_WEBHOOK_SECRET) problems.push("RAZORPAY_WEBHOOK_SECRET is required (payment webhooks would be rejected)");
    if (env.SHIPPING_PROVIDER === "shiprocket" && !env.SHIPPING_WEBHOOK_TOKEN) problems.push("SHIPPING_WEBHOOK_TOKEN is required (tracking webhooks would be rejected)");
    if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) problems.push("R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL are required");
    if (/change-me/i.test(env.JWT_SECRET) || /change-me/i.test(env.OTP_SECRET)) problems.push("Replace the placeholder JWT_SECRET / OTP_SECRET with random values");
    if (env.JWT_SECRET === env.OTP_SECRET) problems.push("JWT_SECRET and OTP_SECRET must be different");
    if (problems.length) throw new Error(`Unsafe production configuration:\n  - ${problems.join("\n  - ")}`);
  }
  if (env.PAYMENT_PROVIDER === "razorpay" && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)) {
    throw new Error("PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  return env;
}

export const env = load();
export type Env = typeof env;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
