"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Spinner className="py-32" />}>
      <Reset />
    </Suspense>
  );
}

function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password/reset", { token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x flex justify-center py-16">
      <div className="card w-full max-w-md p-7">
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        {done ? (
          <div className="mt-4 space-y-4 text-sm text-ink/70">
            <p>Your password has been changed and all other sessions were signed out.</p>
            <Link href="/login" className="link">
              Sign in
            </Link>
          </div>
        ) : !token ? (
          <p className="mt-4 text-sm text-danger">This reset link is incomplete. Request a new one.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="New password" htmlFor="password" hint="At least 8 characters with letters and numbers">
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </Field>
            <Field label="Confirm password" htmlFor="confirm">
              <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
