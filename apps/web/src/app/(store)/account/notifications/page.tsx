"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Card, EmptyState, Pagination, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";

interface Note {
  id: string;
  title: string | null;
  body: string | null;
  payload: { link?: string | null } | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications", page], queryFn: () => api.page<Note[]>("/account/notifications", { page, limit: 20 }) });
  const read = useMutation({ mutationFn: (id: string) => api.post(`/account/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <Card padded={false}>
        {q.isLoading ? (
          <Spinner />
        ) : !q.data?.data.length ? (
          <EmptyState title="You're all caught up" />
        ) : (
          <ul className="divide-y divide-black/5">
            {q.data.data.map((n) => {
              const content = (
                <>
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-ink")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={clsx("text-sm", !n.readAt && "font-semibold")}>{n.title}</p>
                    {n.body && <p className="text-sm text-ink/60">{n.body}</p>}
                    <p className="mt-1 text-xs text-ink/40">{dateTime(n.createdAt)}</p>
                  </div>
                </>
              );
              return (
                <li key={n.id}>
                  {n.payload?.link ? (
                    <Link href={n.payload.link} onClick={() => !n.readAt && read.mutate(n.id)} className="flex gap-3 px-5 py-4 hover:bg-black/[0.02]">
                      {content}
                    </Link>
                  ) : (
                    <button onClick={() => !n.readAt && read.mutate(n.id)} className="flex w-full gap-3 px-5 py-4 text-left hover:bg-black/[0.02]">
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}
