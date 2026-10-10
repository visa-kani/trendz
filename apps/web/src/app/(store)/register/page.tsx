"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthFallback, AuthShell, AuthSubmit, FormAlert } from "@/components/store/auth-shell";
import { Field, Input } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name"),
    lastName: z.string().trim().optional(),
    email: z.email("Enter a valid email"),
    phone: z.string().trim().regex(/^$|^(\+?91[\s-]?)?[6-9]\d{9}$/, "Enter a valid mobile number").optional(),
    password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Register />
    </Suspense>
  );
}

function Register() {
  const { register: signUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (v) => {
    try {
      await signUp({ firstName: v.firstName, lastName: v.lastName || undefined, email: v.email, phone: v.phone || undefined, password: v.password });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) for (const e of err.errors) setError(e.path as "email", { message: e.message });
      else setError("root", { message: errorMessage(err) });
    }
  });

  return (
    <AuthShell
      eyebrow="Join Trendz"
      title="Create your account"
      subtitle="It takes less than a minute — then checkout, tracking and returns are a tap away."
      tagline="Join the crew."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-x-4 gap-y-5 sm:grid-cols-2" noValidate>
        <Field label="First name" error={errors.firstName?.message} htmlFor="firstName" required>
          <Input id="firstName" autoComplete="given-name" className="h-12" invalid={!!errors.firstName} {...register("firstName")} />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" autoComplete="family-name" className="h-12" {...register("lastName")} />
        </Field>
        <Field label="Email" error={errors.email?.message} htmlFor="email" className="sm:col-span-2" required>
          <Input id="email" type="email" autoComplete="email" className="h-12" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Mobile number" error={errors.phone?.message} htmlFor="phone" className="sm:col-span-2" hint="Optional — for delivery updates by SMS">
          <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel" className="h-12" invalid={!!errors.phone} {...register("phone")} />
        </Field>
        <Field label="Password" error={errors.password?.message} htmlFor="password" required>
          <Input id="password" type="password" autoComplete="new-password" className="h-12" invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message} htmlFor="confirm" required>
          <Input id="confirm" type="password" autoComplete="new-password" className="h-12" invalid={!!errors.confirm} {...register("confirm")} />
        </Field>
        <FormAlert message={errors.root?.message} className="sm:col-span-2" />
        <AuthSubmit loading={isSubmitting} className="sm:col-span-2">
          Create account
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
