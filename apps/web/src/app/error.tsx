"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-ink/55">Please try again. If the problem continues, contact support.</p>
      <button onClick={reset} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
