import { Skeleton } from "~/components/ui/skeleton"

export default function UserMasterSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Page header skeleton */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-72" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Tab navigation skeleton */}
      <div
        style={{
          padding: "0 28px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          height: 48,
        }}
      >
        <div style={{ display: "flex", gap: 16 }}>
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-8 w-44 rounded-md" />
        </div>
      </div>

      {/* Content skeleton */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filter toolbar */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Skeleton className="h-9 w-[280px] rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-4 w-32 ml-auto" />
        </div>

        {/* Table skeleton */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.2fr 1fr 1fr 0.8fr 80px", gap: 16, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1.2fr 1fr 1fr 0.8fr 80px",
                gap: 16,
                padding: "14px 16px",
                borderBottom: rowIdx < 4 ? "1px solid var(--border)" : "none",
                alignItems: "center",
              }}
            >
              {/* User cell */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-32" />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Lightweight table skeleton for deferred permissions tab
export function TableSkeleton() {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 80px", gap: 16, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 2fr 1.2fr 80px",
            gap: 16,
            padding: "14px 16px",
            borderBottom: rowIdx < 3 ? "1px solid var(--border)" : "none",
            alignItems: "center",
          }}
        >
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-full" />
          <div style={{ display: "flex", gap: 4 }}>
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
