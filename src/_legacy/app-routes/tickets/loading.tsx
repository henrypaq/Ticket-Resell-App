import { GridSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-4">
        <Skeleton className="h-[64px] w-[64px] rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="mt-2 h-3.5 w-20 rounded" />
        </div>
      </div>
      <Skeleton className="mt-6 h-4 w-full max-w-xs rounded" />
      <div className="mt-9">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="mt-3 h-24 w-full rounded-2xl" />
      </div>
      <div className="mt-9">
        <Skeleton className="h-4 w-20 rounded" />
        <div className="mt-3">
          <GridSkeleton count={2} />
        </div>
      </div>
    </main>
  );
}
