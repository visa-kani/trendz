"use client";

import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";
import { Loader2, X, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { PageMeta } from "@/lib/api";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/85 disabled:bg-ink/40",
  secondary: "bg-white text-ink shadow-neu hover:shadow-neu-lg disabled:text-ink/40",
  outline: "border border-black/15 bg-transparent text-ink hover:bg-black/[0.03] disabled:text-ink/40",
  ghost: "bg-transparent text-ink/70 hover:bg-black/[0.04] hover:text-ink disabled:text-ink/30",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
}

export function Field({ label, error, hint, className, children, htmlFor, required }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-ink/50">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={clsx("input", invalid && "border-danger/60 focus:border-danger", className)} aria-invalid={invalid || undefined} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={clsx("input min-h-24", invalid && "border-danger/60", className)} aria-invalid={invalid || undefined} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx("input appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9", invalid && "border-danger/60", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23908a8e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={clsx("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-black/20 accent-accent" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Rupee amount input that stores paise. */
export function MoneyInput({ value, onChange, invalid, ...rest }: { value: number | null | undefined; onChange: (paise: number | null) => void; invalid?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink/40">₹</span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        className="pl-7"
        invalid={invalid}
        value={value == null ? "" : value / 100}
        onChange={(e) => onChange(e.target.value === "" ? null : Math.round(Number(e.target.value) * 100))}
        {...rest}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const tones = {
  neutral: "bg-black/[0.05] text-ink/70",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  dark: "bg-ink text-white",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "success", PAID: "success", DELIVERED: "success", PROCESSED: "success", SENT: "success", RECEIVED: "success", READY: "success", CONFIRMED: "info", COMPLETED: "success", IN_STOCK: "success", CLOSED: "neutral", APPROVED: "info",
  PENDING: "warning", CREATED: "warning", PROCESSING: "warning", PACKED: "info", SHIPPED: "info", IN_TRANSIT: "info", OUT_FOR_DELIVERY: "info", PICKUP_SCHEDULED: "info", PICKED_UP: "info", SUBMITTED: "warning", PARTIALLY_RECEIVED: "warning", IN_TRANSIT_TRANSFER: "info", REQUESTED: "warning", RETURN_REQUESTED: "warning", PARTIALLY_REFUNDED: "warning", LOW: "warning", DRAFT: "neutral",
  FAILED: "danger", CANCELLED: "danger", REJECTED: "danger", OUT: "danger", DISABLED: "danger", INACTIVE: "neutral", ARCHIVED: "neutral", DISCONTINUED: "danger", REFUNDED: "neutral", RETURNED: "neutral", EXPIRED: "neutral", LOCKED: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
          {typeof title === "string" ? <h2 className="text-sm font-semibold">{title}</h2> : title}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <div role="status" className={clsx("flex items-center justify-center gap-2 py-10 text-sm text-ink/50", className)}>
      <Loader2 className="animate-spin" size={18} />
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-ink/40">{icon ?? <Inbox size={22} />}</div>
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink/55">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-danger">Could not load this page</p>
      <p className="text-sm text-ink/60">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-1 pt-4 text-sm text-ink/60">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total.toLocaleString("en-IN")} results
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} icon={<ChevronLeft size={14} />}>
          Prev
        </Button>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/70 p-0 animate-fade backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx("flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-neu-lg animate-rise sm:rounded-3xl", width)}>
        <header className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink/50 hover:bg-black/5 hover:text-ink">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-black/5 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
  loading,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body && <div className="text-sm text-ink/70">{body}</div>}
      {children}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, loading }: { columns: Column<T>[]; rows: T[] | undefined; rowKey: (row: T) => string; onRowClick?: (row: T) => void; empty?: ReactNode; loading?: boolean }) {
  if (loading && !rows) return <Spinner />;
  if (!rows?.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
            {columns.map((c) => (
              <th key={c.key} className={clsx("whitespace-nowrap px-5 py-2.5 font-semibold", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx("border-b border-black/[0.04] last:border-0", onRowClick && "cursor-pointer hover:bg-black/[0.02]")}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx("px-5 py-3 align-middle", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-offwhite text-ink/70">{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink/50">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink/50">{hint}</p>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full bg-black/[0.04] p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx("whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition", value === t.value ? "bg-white text-ink shadow-neu" : "text-ink/55 hover:text-ink")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
