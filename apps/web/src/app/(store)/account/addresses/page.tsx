"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AddressForm } from "@/components/store/address-form";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import type { Address } from "@/lib/types";

export default function AddressesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["addresses"], queryFn: () => api.get<Address[]>("/account/addresses") });
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/account/addresses/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["addresses"] });
      setDeleting(null);
      toast("Address removed");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const saved = () => {
    void qc.invalidateQueries({ queryKey: ["addresses"] });
    setEditing(null);
    toast("Address saved");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Addresses</h1>
        {!editing && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing("new")}>
            Add address
          </Button>
        )}
      </div>
      {editing && (
        <Card title={editing === "new" ? "New address" : "Edit address"}>
          <AddressForm initial={editing === "new" ? undefined : editing} onSaved={saved} onCancel={() => setEditing(null)} />
        </Card>
      )}
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        !editing && (
          <Card>
            <EmptyState title="No saved addresses" body="Add an address to check out faster." />
          </Card>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((a) => (
            <div key={a.id} className="card p-5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{a.fullName}</p>
                {a.isDefaultShipping && <Badge tone="dark">Default</Badge>}
              </div>
              <p className="mt-1 text-ink/65">
                {[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}
                <br />
                {a.city}, {a.state} {a.postalCode}
                <br />
                {a.phone}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(a)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleting(a)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!deleting} title="Remove this address?" confirmLabel="Remove" tone="danger" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />
    </div>
  );
}
