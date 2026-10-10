import { ProductGridSkeleton } from "./product-card";

/** Loading placeholder that mirrors the listing layout (header, toolbar, filter column, 3-up grid). */
export function ListingSkeleton({ breadcrumb = true, subcategories = false, description = false }: { breadcrumb?: boolean; subcategories?: boolean; description?: boolean }) {
  return (
    <div>
      <div className="container-x pb-8 pt-8 md:pb-12 md:pt-12">
        {breadcrumb && <div className="skeleton mb-8 h-3 w-44 rounded-full md:mb-12" />}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-2xl">
            <div className="skeleton h-2.5 w-24 rounded-full" />
            <div className="skeleton mt-4 h-[clamp(2.75rem,8vw,6.5rem)] w-4/5 rounded-3xl" />
          </div>
          {description && (
            <div className="w-full max-w-sm space-y-2">
              <div className="skeleton h-3 w-full rounded-full" />
              <div className="skeleton h-3 w-11/12 rounded-full" />
              <div className="skeleton h-3 w-2/3 rounded-full" />
            </div>
          )}
        </div>
        {subcategories && (
          <div className="mt-8 flex gap-2 overflow-hidden py-1">
            {[96, 120, 88, 132, 104].map((w, i) => (
              <div key={i} className="skeleton h-10 shrink-0 rounded-full" style={{ width: w }} />
            ))}
          </div>
        )}
      </div>

      <div className="container-x">
        <div className="flex items-center justify-between gap-3 border-y border-black/[0.07] py-3">
          <div className="skeleton h-10 w-28 rounded-full lg:w-44" />
          <div className="skeleton h-10 w-40 rounded-full sm:w-56" />
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-14">
          <div className="hidden lg:block">
            <div className="skeleton mb-6 h-2.5 w-20 rounded-full" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-b border-black/[0.07] py-5 first:pt-0">
                <div className="skeleton h-2.5 w-24 rounded-full" />
                <div className="mt-4 flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div key={j} className="skeleton h-9 w-12 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Same grid as the listing: three columns beside the filter column. */}
          <div className="min-w-0">
            <ProductGridSkeleton count={9} columns={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
