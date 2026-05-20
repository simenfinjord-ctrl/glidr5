import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Generic card placeholder — matches the fs-card rounded-2xl style */
export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("fs-card rounded-2xl p-4 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3 rounded", i === lines - 1 ? "w-1/2" : "w-full")} />
      ))}
    </div>
  );
}

/** Row of N skeleton cards in a grid */
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3 grid-cols-1", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={i % 2 === 0 ? 3 : 2} />
      ))}
    </div>
  );
}
