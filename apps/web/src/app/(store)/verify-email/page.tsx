"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Spinner className="py-32" />}>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const token = useSearchParams().get("token");
  const { reload } = useAuth();
  const [result, setState] = useState<"working" | "done" | "error">("working");
  const [error, setMessage] = useState("");
  // A link without a token is an error straight away; no request is made.
  const state = token ? result : "error";
  const message = token ? error : "This verification link is incomplete.";
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    api
      .post("/auth/verify-email/confirm", { token })
      .then(() => {
        setState("done");
        void reload();
      })
      .catch((err) => {
        setState("error");
        setMessage(errorMessage(err));
      });
  }, [token, reload]);

  return (
    <div className="container-x flex justify-center py-20">
      <div className="card w-full max-w-md p-7 text-center">
        {state === "working" && <Spinner label="Verifying your email" />}
        {state === "done" && (
          <>
            <h1 className="text-xl font-bold">Email verified</h1>
            <p className="mt-2 text-sm text-ink/60">Thanks — your email address is confirmed.</p>
            <Link href="/account" className="link mt-4 inline-block text-sm">
              Go to my account
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="text-xl font-bold">Could not verify</h1>
            <p className="mt-2 text-sm text-ink/60">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
