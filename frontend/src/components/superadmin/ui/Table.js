"use client";

import { Skeleton, EmptyState } from "./Feedback";
import { cx } from "./cx";

/**
 * Data table with loading / error / empty states built in.
 * columns: [{ key, header, align?: "end", width?, cell: (row) => node, className? }]
 */
export default function DataTable({
  columns,
  rows,
  rowKey = (row) => row._id || row.id,
  loading = false,
  error,
  empty,
  onRowClick,
  skeletonRows = 5,
  className,
}) {
  const colSpan = columns.length;

  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="sa-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" style={col.width ? { width: col.width } : undefined} className={cx(col.align === "end" && "text-end", col.headerClassName)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, r) => (
              <tr key={`sk-${r}`}>
                {columns.map((col, c) => (
                  <td key={col.key}>
                    <Skeleton className={cx("h-3.5", c === 0 ? "w-40" : "w-24", col.align === "end" && "ms-auto")} />
                  </td>
                ))}
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={colSpan} className="!p-0">
                <EmptyState title={error.title || "Something went wrong"} description={error.description} action={error.action} />
              </td>
            </tr>
          ) : !rows?.length ? (
            <tr>
              <td colSpan={colSpan} className="!p-0">
                <EmptyState icon={empty?.icon} title={empty?.title || "Nothing here yet"} description={empty?.description} action={empty?.action} />
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const clickable = Boolean(onRowClick);
              return (
                <tr
                  key={rowKey(row)}
                  data-clickable={clickable || undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row); } : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cx(col.align === "end" && "text-end", col.className)} onClick={col.stopRowClick ? (e) => e.stopPropagation() : undefined}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Do-line cell: primary text + muted secondary line. */
export function CellText({ primary, secondary, className }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="truncate font-medium text-fg">{primary}</p>
      {secondary ? <p className="mt-0.5 truncate text-[12px] text-fg-muted">{secondary}</p> : null}
    </div>
  );
}

/** Avatar + two lines (seller / store cells). */
export function EntityCell({ avatar, primary, secondary, maxWidth = 260 }) {
  return (
    <div className="flex items-center gap-3" style={{ maxWidth }}>
      {avatar}
      <CellText primary={primary} secondary={secondary} />
    </div>
  );
}
