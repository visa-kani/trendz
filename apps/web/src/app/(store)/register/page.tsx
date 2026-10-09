"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Field, Input, Spinner } from "@/components/ui";
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
    <Suspense fallback={<Spinner className="py-32" />}>
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
    <div className="container-x flex justify-center py-16">
      <div className="card w-full max-w-md p-7">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="First name" error={errors.firstName?.message} htmlFor="firstName" required>
            <Input id="firstName" autoComplete="given-name" invalid={!!errors.firstName} {...register("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName">
            <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          </Field>
          <Field label="Email" error={errors.email?.message} htmlFor="email" className="sm:col-span-2" required>
            <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label="Mobile number" error={errors.phone?.message} htmlFor="phone" className="sm:col-span-2" hint="Optional — for delivery updates by SMS">
            <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel" invalid={!!errors.phone} {...register("phone")} />
          </Field>
          <Field label="Password" error={errors.password?.message} htmlFor="password" required>
            <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
          </Field>
          <Field label="Confirm password" error={errors.confirm?.message} htmlFor="confirm" required>
            <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
          </Field>
          {errors.root && <p role="alert" className="text-sm text-danger sm:col-span-2">{errors.root.message}</p>}
          <Button type="submit" size="lg" className="w-full sm:col-span-2" loading={isSubmitting}>
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
