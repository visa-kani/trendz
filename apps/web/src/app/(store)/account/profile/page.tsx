"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Monitor, ShieldCheck } from "lucide-react";
import { AccountHeader, DetailSkeleton, Panel, StaggerList, StaggerRow } from "@/components/store/account-ui";
import { Badge, Checkbox, Field, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";

interface Profile {
  email: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  hasPassword: boolean;
  profile: { firstName: string | null; lastName: string | null; marketingOptIn: boolean } | null;
}
interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  current: boolean;
}

const primaryBtn =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 text-sm font-semibold text-white transition hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:bg-ink/40";
const outlineBtn =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/15 px-7 text-sm font-semibold transition hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";

export default function ProfilePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { reload, logout } = useAuth();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/account/profile") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api.get<Session[]>("/account/sessions") });
  const [form, setForm] = useState({ firstName: "", lastName: "", marketingOptIn: false });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  // Load the form from the server copy whenever it (re)loads, during render rather than in an effect.
  const [formFor, setFormFor] = useState<Profile | undefined>(undefined);
  if (profile.data && profile.data !== formFor) {
    setFormFor(profile.data);
    setForm({ firstName: profile.data.profile?.firstName ?? "", lastName: profile.data.profile?.lastName ?? "", marketingOptIn: profile.data.profile?.marketingOptIn ?? false });
  }

  const save = useMutation({
    mutationFn: () => api.patch("/account/profile", { firstName: form.firstName, lastName: form.lastName || null, marketingOptIn: form.marketingOptIn }),
    onSuccess: () => {
      toast("Profile updated");
      void reload();
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const change = useMutation({
    mutationFn: () => api.post("/auth/password/change", pw),
    onSuccess: () => {
      toast("Password changed. Other devices were signed out.");
      setPw({ currentPassword: "", newPassword: "" });
      void qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/account/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }) });

  if (profile.isLoading || !profile.data) return <DetailSkeleton label="Loading your profile" />;
  const p = profile.data;

  return (
    <div className="space-y-6">
      <AccountHeader eyebrow="Settings" title="Profile & security" description="Your personal details, password and the devices you're signed in on." />

      <Panel eyebrow="About you" title="Personal details">
        <form
          className="grid gap-x-4 gap-y-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="First name" htmlFor="fn">
            <Input id="fn" className="h-12" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </Field>
          <Field label="Last name" htmlFor="ln">
            <Input id="ln" className="h-12" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Email" className="sm:col-span-1">
            <div className="relative">
              <Input value={p.email ?? "—"} disabled className="h-12 pr-24" />
              {p.email && (
                <Badge tone={p.emailVerifiedAt ? "success" : "warning"} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {p.emailVerifiedAt ? "Verified" : "Unverified"}
                </Badge>
              )}
            </div>
          </Field>
          <Field label="Mobile">
            <div className="relative">
              <Input value={p.phone ?? "—"} disabled className="h-12 pr-24" />
              {p.phone && (
                <Badge tone={p.phoneVerifiedAt ? "success" : "warning"} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {p.phoneVerifiedAt ? "Verified" : "Unverified"}
                </Badge>
              )}
            </div>
          </Field>
          <div className="rounded-2xl bg-offwhite px-4 py-3.5 sm:col-span-2">
            <Checkbox label="Send me offers and new arrivals by email" checked={form.marketingOptIn} onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={save.isPending} className={primaryBtn}>
              {save.isPending && <Loader2 size={16} className="animate-spin" />}
              Save changes
            </button>
          </div>
        </form>
      </Panel>

      <Panel eyebrow="Security" title={p.hasPassword ? "Change password" : "Set a password"} delay={0.08}>
        <form
          className="grid gap-x-4 gap-y-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
        >
          {p.hasPassword && (
            <Field label="Current password" htmlFor="cur">
              <Input id="cur" type="password" autoComplete="current-password" className="h-12" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            </Field>
          )}
          <Field label="New password" htmlFor="new" hint="At least 8 characters with letters and numbers">
            <Input id="new" type="password" autoComplete="new-password" className="h-12" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={change.isPending} className={outlineBtn}>
              {change.isPending && <Loader2 size={16} className="animate-spin" />}
              Update password
            </button>
          </div>
        </form>
      </Panel>

      <Panel
        eyebrow="Sessions"
        title="Signed-in devices"
        delay={0.16}
        actions={
          <button
            type="button"
            onClick={async () => {
              await api.post("/auth/logout-all");
              await logout();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-ink/60 transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
          >
            <LogOut size={13} /> Sign out everywhere
          </button>
        }
      >
        {sessions.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-14 rounded-2xl" />
            <div className="skeleton h-14 rounded-2xl" />
          </div>
        ) : (
          <StaggerList className="space-y-2.5">
            {sessions.data?.map((s) => (
              <StaggerRow key={s.id}>
                <div className="flex items-center gap-3 rounded-2xl bg-offwhite px-4 py-3 text-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink/60 shadow-neu">
                    {s.current ? <ShieldCheck size={17} strokeWidth={1.75} className="text-success" /> : <Monitor size={17} strokeWidth={1.75} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{s.userAgent ?? "Unknown device"}</p>
                    <p className="text-xs text-ink/45">
                      {s.ipAddress ?? ""} · last active {dateTime(s.lastUsedAt)}
                    </p>
                  </div>
                  {s.current ? (
                    <Badge tone="success">This device</Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => revoke.mutate(s.id)}
                      disabled={revoke.isPending && revoke.variables === s.id}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold transition hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 disabled:opacity-50"
                    >
                      {revoke.isPending && revoke.variables === s.id && <Loader2 size={12} className="animate-spin" />}
                      Sign out
                    </button>
                  )}
                </div>
              </StaggerRow>
            ))}
          </StaggerList>
        )}
      </Panel>
    </div>
  );
}
