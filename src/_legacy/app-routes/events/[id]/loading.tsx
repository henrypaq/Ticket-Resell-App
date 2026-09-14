import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main>
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="-mt-16 px-4">
        <Skeleton className="h-8 w-3/4 rounded" />
        <Skeleton className="mt-3 h-4 w-1/2 rounded" />
        <Skeleton className="mt-2 h-4 w-1/3 rounded" />
      </div>
      <div className="mt-8 px-4">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
      </div>
    </main>
  );
}
