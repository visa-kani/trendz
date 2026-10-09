"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Address, StoreConfig } from "@/lib/types";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name"),
  phone: z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  line1: z.string().trim().min(3, "Enter the house / street"),
  line2: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  city: z.string().trim().min(2, "Enter the city"),
  state: z.string().min(2, "Select a state"),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
  isDefaultShipping: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const { data: config } = useQuery({ queryKey: ["store-config"], queryFn: () => api.get<StoreConfig>("/store/config"), staleTime: 300_000 });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: initial?.fullName ?? "",
      phone: initial?.phone?.replace(/^\+91/, "") ?? "",
      line1: initial?.line1 ?? "",
      line2: initial?.line2 ?? "",
      landmark: initial?.landmark ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      postalCode: initial?.postalCode ?? "",
      isDefaultShipping: initial?.isDefaultShipping ?? false,
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      const body = { ...values, line2: values.line2 || null, landmark: values.landmark || null };
      const saved = initial ? await api.patch<Address>(`/account/addresses/${initial.id}`, body) : await api.post<Address>("/account/addresses", body);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) {
        for (const e of err.errors) setError(e.path as keyof Values, { message: e.message });
      } else setError("root", { message: err instanceof Error ? err.message : "Could not save the address" });
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Full name" error={errors.fullName?.message} htmlFor="fullName" required>
        <Input id="fullName" autoComplete="name" invalid={!!errors.fullName} {...register("fullName")} />
      </Field>
      <Field label="Mobile number" error={errors.phone?.message} htmlFor="phone" required>
        <Input id="phone" type="tel" autoComplete="tel" inputMode="numeric" invalid={!!errors.phone} {...register("phone")} />
      </Field>
      <Field label="House / flat, street" error={errors.line1?.message} htmlFor="line1" className="sm:col-span-2" required>
        <Input id="line1" autoComplete="address-line1" invalid={!!errors.line1} {...register("line1")} />
      </Field>
      <Field label="Area / locality" htmlFor="line2">
        <Input id="line2" autoComplete="address-line2" {...register("line2")} />
      </Field>
      <Field label="Landmark" htmlFor="landmark">
        <Input id="landmark" {...register("landmark")} />
      </Field>
      <Field label="City" error={errors.city?.message} htmlFor="city" required>
        <Input id="city" autoComplete="address-level2" invalid={!!errors.city} {...register("city")} />
      </Field>
      <Field label="PIN code" error={errors.postalCode?.message} htmlFor="postalCode" required>
        <Input id="postalCode" autoComplete="postal-code" inputMode="numeric" maxLength={6} invalid={!!errors.postalCode} {...register("postalCode")} />
      </Field>
      <Field label="State" error={errors.state?.message} htmlFor="state" className="sm:col-span-2" required>
        <Select id="state" invalid={!!errors.state} {...register("state")}>
          <option value="">Select state</option>
          {config?.states.map((s) => (
            <option key={s.code} value={s.name}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox label="Use as my default delivery address" className="sm:col-span-2" {...register("isDefaultShipping")} />
      {errors.root && <p className="text-sm text-danger sm:col-span-2">{errors.root.message}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={isSubmitting}>
          Save address
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
