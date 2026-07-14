import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "text" | "card";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

function Skeleton({
  className,
  variant = "default",
  width,
  height,
  lines = 1,
  ...props
}: SkeletonProps) {
  const baseClasses = "relative overflow-hidden animate-pulse bg-muted rounded after:absolute after:inset-0 after:animate-shimmer";

  const variantClasses = {
    default: "rounded-md",
    circular: "rounded-full",
    text: "rounded h-4",
    card: "rounded-lg",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  if (variant === "text" && lines > 1) {
    return (
      <div className="space-y-2" {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              variantClasses.text,
              i === lines - 1 && "w-3/4",
              className
            )}
            style={i === lines - 1 ? { ...style, width: "75%" } : style}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
      {...props}
    />
  );
}

// Compound components for common patterns
function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3",
        className
      )}
      {...props}
    >
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function SkeletonPrice({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3",
        className
      )}
      {...props}
    >
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

function SkeletonRadar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3",
        className
      )}
      {...props}
    >
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

function SkeletonBiasGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-4",
        className
      )}
      {...props}
    >
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonChart({ className, height = 300, ...props }: React.HTMLAttributes<HTMLDivElement> & { height?: number }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3",
        className
      )}
      {...props}
    >
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

function SkeletonTable({ rows = 5, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { rows?: number }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20 ml-auto" />
        </div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-b last:border-0">
          <div className="flex gap-4 items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonSentimentBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/80 p-2",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-10 hidden sm:block" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonPrice,
  SkeletonRadar,
  SkeletonBiasGrid,
  SkeletonChart,
  SkeletonTable,
  SkeletonSentimentBar,
};
