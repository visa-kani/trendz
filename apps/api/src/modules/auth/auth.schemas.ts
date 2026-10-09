import { z } from "zod";
import { normalizePhone } from "../../common/utils/phone";
import { passwordSchema } from "./password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number" });
      return z.NEVER;
    }
    return p;
  });

const name = z.string().trim().min(1).max(60);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: name,
  lastName: z.string().trim().max(60).optional().default(""),
  phone: phoneSchema.optional(),
  marketingOptIn: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(["LOGIN", "VERIFY_PHONE"]).default("LOGIN"),
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  purpose: z.enum(["LOGIN", "VERIFY_PHONE"]).default("LOGIN"),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });
