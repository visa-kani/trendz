import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold tracking-[0.25em] text-ink/40">404</p>
      <h1 className="text-3xl font-bold tracking-tight">This page drifted away</h1>
      <p className="max-w-sm text-sm text-ink/55">The page you are looking for does not exist or is no longer available.</p>
      <Link href="/products" className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
        Browse products
      </Link>
    </div>
  );
}
