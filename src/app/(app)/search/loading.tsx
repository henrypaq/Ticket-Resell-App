import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Skeleton className="h-8 w-24 rounded" />
      <Skeleton className="mt-5 h-[52px] w-full rounded-full" />
    </main>
  );
}
