"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, m } from "motion/react";
import { clsx } from "clsx";
import { KeyRound, Smartphone } from "lucide-react";
import { AuthFallback, AuthShell, AuthSubmit, FormAlert } from "@/components/store/auth-shell";
import { EASE_OUT } from "@/components/store/motion";
import { Field, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { msg, type Message } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/** Only same-site relative paths are allowed as post-login redirects (no open redirect). */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Login />
    </Suspense>
  );
}

type Mode = "password" | "otp";
const MODES: { value: Mode; label: Message; icon: typeof KeyRound }[] = [
  { value: "password", label: msg("Password"), icon: KeyRound },
  { value: "otp", label: msg("Mobile OTP"), icon: Smartphone },
];

function Login() {
  const { t, tr } = useI18n();
  const { status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("password");

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(safeNext(params.get("next"), user.isStaff ? "/admin" : "/account"));
  }, [status, user, router, params]);

  return (
    <AuthShell
      eyebrow={t("Sign in")}
      title={t("Welcome back")}
      subtitle={t("Sign in to track orders, save addresses and check out faster.")}
      tagline={t("Good to see you again.")}
      footer={tr("New here? {link}", {
        link: (
          <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="link">
            {t("Create an account")}
          </Link>
        ),
      })}
    >
      <ModeTabs mode={mode} onChange={setMode} />
      <div className="mt-7">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={mode}
            id={`login-panel-${mode}`}
            role="tabpanel"
            aria-labelledby={`login-tab-${mode}`}
            initial={{ opacity: 0, x: mode === "password" ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "password" ? -24 : 24 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {mode === "password" ? <PasswordLogin /> : <OtpLogin />}
          </m.div>
        </AnimatePresence>
      </div>
    </AuthShell>
  );
}

/** Password / OTP switch with a sliding pill (arrow keys move between tabs). */
function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useI18n();
  const focusTab = (next: Mode) => {
    onChange(next);
    document.getElementById(`login-tab-${next}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={t("Sign-in method")} className="grid grid-cols-2 gap-1 rounded-full bg-offwhite p-1">
      {MODES.map(({ value, label, icon: Icon }) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            id={`login-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`login-panel-${value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                focusTab(value === "password" ? "otp" : "password");
              }
            }}
            className={clsx(
              "relative isolate flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25",
              selected ? "text-ink" : "text-ink/50 hover:text-ink",
            )}
          >
            {selected && <m.span layoutId="login-mode-pill" className="absolute inset-0 -z-10 rounded-full bg-white shadow-neu" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <Icon size={15} strokeWidth={1.9} />
            {t(label)}
          </button>
        );
      })}
    </div>
  );
}

const passwordSchema = z.object({ identifier: z.string().trim().min(3, msg("Enter your email or mobile number")), password: z.string().min(1, msg("Enter your password")) });

function PasswordLogin() {
  const { t, tx } = useI18n();
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const submit = handleSubmit(async (v) => {
    try {
      await login(v.identifier, v.password);
    } catch (err) {
      setError("root", { message: errorMessage(err) });
    }
  });
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label={t("Email or mobile number")} error={tx(errors.identifier?.message)} htmlFor="identifier">
        <Input id="identifier" autoComplete="username" className="h-12" invalid={!!errors.identifier} {...register("identifier")} />
      </Field>
      <Field label={t("Password")} error={tx(errors.password?.message)} htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" className="h-12" invalid={!!errors.password} {...register("password")} />
      </Field>
      <FormAlert message={errors.root?.message} />
      <AuthSubmit loading={isSubmitting}>{t("Sign in")}</AuthSubmit>
      <p className="text-center">
        <Link href="/forgot-password" className="link-draw text-sm text-ink/55 hover:text-ink">
          {t("Forgot password?")}
        </Link>
      </p>
    </form>
  );
}

function OtpLogin() {
  const { t } = useI18n();
  const { verifyOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/otp", { phone, purpose: "LOGIN" });
      setSent(true);
      setCooldown(30);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone, code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={sent ? verify : (e) => (e.preventDefault(), void request())} className="space-y-5" noValidate>
      <Field label={t("Mobile number")} htmlFor="phone" hint={t("We will send a 6-digit code by SMS.")}>
        <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel" className="h-12" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} placeholder="98765 43210" />
      </Field>
      <AnimatePresence initial={false}>
        {sent && (
          <m.div key="code" className="overflow-hidden" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.45, ease: EASE_OUT }}>
            <Field label={t("Verification code")} htmlFor="code">
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                className="h-14 text-center text-xl font-bold tracking-[0.6em] placeholder:tracking-[0.6em] placeholder:text-ink/20"
                placeholder="••••••"
              />
            </Field>
          </m.div>
        )}
      </AnimatePresence>
      <FormAlert message={error} />
      <AuthSubmit loading={busy} disabled={sent ? code.length !== 6 : phone.length < 10}>
        {sent ? t("Verify and sign in") : t("Send code")}
      </AuthSubmit>
      {sent && (
        <button
          type="button"
          onClick={request}
          disabled={cooldown > 0 || busy}
          className="block w-full rounded-full py-1 text-center text-sm text-ink/55 tabular-nums transition hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 disabled:opacity-50"
        >
          {cooldown > 0 ? t("Resend code in {seconds}s", { seconds: cooldown }) : t("Resend code")}
        </button>
      )}
    </form>
  );
}
