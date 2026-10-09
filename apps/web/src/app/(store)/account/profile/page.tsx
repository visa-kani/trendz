"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor } from "lucide-react";
import { Badge, Button, Card, Checkbox, Field, Input, Spinner } from "@/components/ui";
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

  if (profile.isLoading || !profile.data) return <Spinner />;
  const p = profile.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile &amp; security</h1>
      <Card title="Personal details">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="First name" htmlFor="fn">
            <Input id="fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </Field>
          <Field label="Last name" htmlFor="ln">
            <Input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Email" className="sm:col-span-1">
            <div className="flex items-center gap-2">
              <Input value={p.email ?? "—"} disabled />
              {p.email && <Badge tone={p.emailVerifiedAt ? "success" : "warning"}>{p.emailVerifiedAt ? "Verified" : "Unverified"}</Badge>}
            </div>
          </Field>
          <Field label="Mobile">
            <div className="flex items-center gap-2">
              <Input value={p.phone ?? "—"} disabled />
              {p.phone && <Badge tone={p.phoneVerifiedAt ? "success" : "warning"}>{p.phoneVerifiedAt ? "Verified" : "Unverified"}</Badge>}
            </div>
          </Field>
          <Checkbox className="sm:col-span-2" label="Send me offers and new arrivals by email" checked={form.marketingOptIn} onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })} />
          <div className="sm:col-span-2">
            <Button type="submit" loading={save.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card title={p.hasPassword ? "Change password" : "Set a password"}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
        >
          {p.hasPassword && (
            <Field label="Current password" htmlFor="cur">
              <Input id="cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            </Field>
          )}
          <Field label="New password" htmlFor="new" hint="At least 8 characters with letters and numbers">
            <Input id="new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" loading={change.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Signed-in devices" actions={<Button variant="ghost" size="sm" onClick={async () => { await api.post("/auth/logout-all"); await logout(); }}>Sign out everywhere</Button>}>
        <ul className="space-y-3">
          {sessions.data?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-sm">
              <Monitor size={16} className="shrink-0 text-ink/40" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{s.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-ink/45">
                  {s.ipAddress ?? ""} · last active {dateTime(s.lastUsedAt)}
                </p>
              </div>
              {s.current ? (
                <Badge tone="success">This device</Badge>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
