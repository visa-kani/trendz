"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Field, Input, Spinner, Tabs } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Only same-site relative paths are allowed as post-login redirects (no open redirect). */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner className="py-32" />}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const { status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"password" | "otp">("password");

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(safeNext(params.get("next"), user.isStaff ? "/admin" : "/account"));
  }, [status, user, router, params]);

  return (
    <div className="container-x flex justify-center py-16">
      <div className="card w-full max-w-md p-7">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-ink/55">Sign in to track orders, save addresses and check out faster.</p>
        <div className="mt-6">
          <Tabs
            value={mode}
            onChange={setMode}
            tabs={[
              { value: "password", label: "Password" },
              { value: "otp", label: "Mobile OTP" },
            ]}
          />
        </div>
        <div className="mt-6">{mode === "password" ? <PasswordLogin /> : <OtpLogin />}</div>
        <p className="mt-6 text-center text-sm text-ink/60">
          New here?{" "}
          <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="link">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

const passwordSchema = z.object({ identifier: z.string().trim().min(3, "Enter your email or mobile number"), password: z.string().min(1, "Enter your password") });

function PasswordLogin() {
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
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email or mobile number" error={errors.identifier?.message} htmlFor="identifier">
        <Input id="identifier" autoComplete="username" invalid={!!errors.identifier} {...register("identifier")} />
      </Field>
      <Field label="Password" error={errors.password?.message} htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register("password")} />
      </Field>
      {errors.root && <p role="alert" className="text-sm text-danger">{errors.root.message}</p>}
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
      <Link href="/forgot-password" className="block text-center text-sm text-ink/55 hover:text-ink">
        Forgot password?
      </Link>
    </form>
  );
}

function OtpLogin() {
  const { verifyOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
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
    <form onSubmit={sent ? verify : (e) => (e.preventDefault(), void request())} className="space-y-4" noValidate>
      <Field label="Mobile number" htmlFor="phone" hint="We will send a 6-digit code by SMS.">
        <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} placeholder="98765 43210" />
      </Field>
      {sent && (
        <Field label="Verification code" htmlFor="code">
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
        </Field>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={sent ? code.length !== 6 : phone.length < 10}>
        {sent ? "Verify and sign in" : "Send code"}
      </Button>
      {sent && (
        <button type="button" onClick={request} disabled={cooldown > 0 || busy} className="block w-full text-center text-sm text-ink/55 hover:text-ink disabled:opacity-50">
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      )}
    </form>
  );
}
