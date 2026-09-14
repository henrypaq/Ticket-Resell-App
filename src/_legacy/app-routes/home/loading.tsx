import { GridSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main>
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Skeleton className="h-[42px] w-32 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-[42px] w-[42px] rounded-full" />
          <Skeleton className="h-[42px] w-[42px] rounded-full" />
          <Skeleton className="h-[42px] w-[42px] rounded-full" />
        </div>
      </div>
      <div className="mt-7 px-4">
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="mt-4 aspect-[4/5] w-full rounded-[26px]" />
      </div>
      <div className="mt-10 px-4">
        <Skeleton className="h-4 w-28 rounded" />
        <div className="mt-3">
          <GridSkeleton />
        </div>
      </div>
    </main>
  );
}
