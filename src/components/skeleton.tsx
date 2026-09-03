/** Shared shimmer block for loading.tsx skeletons — no layout shift once real content lands, since each usage matches its real counterpart's box size. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`} />;
}

export function PosterSkeleton({ aspect = "aspect-[3/4]" }: { aspect?: string }) {
  return <Skeleton className={`w-full ${aspect} rounded-2xl`} />;
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  );
}
