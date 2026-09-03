import { GridSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main>
      <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex gap-2">
          <Skeleton className="h-[42px] w-28 rounded-full" />
          <Skeleton className="h-[42px] w-[42px] rounded-full" />
          <Skeleton className="h-[42px] w-20 rounded-full" />
          <Skeleton className="h-[42px] w-20 rounded-full" />
        </div>
      </div>
      <div className="mt-8 px-4">
        <Skeleton className="h-4 w-24 rounded" />
        <div className="mt-3">
          <GridSkeleton />
        </div>
      </div>
    </main>
  );
}
