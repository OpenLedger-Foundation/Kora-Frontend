"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { ColumnDef, DataTableProps, TableSortDirection } from "@/types/table";
import { Pagination } from "./pagination";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const COLUMN_VISIBILITY_SCHEMA_VERSION = 1;
const COLUMN_VISIBILITY_STORAGE_PREFIX = "dataTable:columnVisibility";

interface PersistedColumnVisibility {
  schemaVersion: number;
  hidden: string[];
}

function getColumnVisibilityStorageKey(route: string) {
  return `${COLUMN_VISIBILITY_STORAGE_PREFIX}:${route}`;
}

function readPersistedColumnVisibility(route: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getColumnVisibilityStorageKey(route));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedColumnVisibility;
    if (!parsed || parsed.schemaVersion !== COLUMN_VISIBILITY_SCHEMA_VERSION) {
      window.localStorage.removeItem(getColumnVisibilityStorageKey(route));
      return null;
    }
    return Array.isArray(parsed.hidden) ? parsed.hidden : null;
  } catch {
    return null;
  }
}

function writePersistedColumnVisibility(route: string, hidden: string[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedColumnVisibility = {
      schemaVersion: COLUMN_VISIBILITY_SCHEMA_VERSION,
      hidden,
    };
    window.localStorage.setItem(getColumnVisibilityStorageKey(route), JSON.stringify(payload));
  } catch {
    // Ignore storage failures (quota, privacy mode, etc.)
  }
}

function getSortValue<T>(row: T, column: ColumnDef<T>): string | number {
  if (column.accessor) {
    if (typeof column.accessor === "function") {
      return column.accessor(row);
    }
    const value = row[column.accessor as keyof T];
    if (typeof value === "string" || typeof value === "number") return value;
    return String(value ?? "");
  }
  return "";
}

function compareValues(a: string | number, b: string | number, direction: TableSortDirection) {
  if (direction === null) return 0;
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * multiplier;
  }
  return String(a).localeCompare(String(b)) * multiplier;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 20],
  enableSelection = false,
  bulkActions,
  onSelectionChange,
  emptyState,
  getRowId = (row) => row.id,
  onRowClick,
  className,
  syncToUrl = false,
  pageParamName = "page",
  sortParamName = "sort",
  pageSizeParamName = "pageSize",
}: DataTableProps<T>) {
  const t = useTranslations("dataTable");
  const prefersReducedMotion = usePrefersReducedMotion();

  // Sticky header classes: keep the header sticky in both modes, but only
  // apply motion-related transitions when the user has not requested reduced
  // motion. The header remains static (no animated shadow/transition) when
  // prefers-reduced-motion is enabled.
  const stickyHeaderClasses = cn(
    "sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80",
    prefersReducedMotion
      ? "shadow-none"
      : "transition-shadow duration-200 shadow-sm"
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<TableSortDirection>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const { width } = useBreakpoint();
  const isMobileView = width < 640;

  const routeKey = pathname ?? "/";

  // Restore persisted column visibility for the current route
  useEffect(() => {
    const persisted = readPersistedColumnVisibility(routeKey);
    if (!persisted) {
      setHiddenColumns(new Set());
      return;
    }
    const validIds = new Set(columns.map((c) => c.id));
    setHiddenColumns(new Set(persisted.filter((id) => validIds.has(id))));
  }, [routeKey, columns]);

  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      setHiddenColumns((prev) => {
        const next = new Set(prev);
        if (next.has(columnId)) next.delete(columnId);
        else next.add(columnId);
        writePersistedColumnVisibility(routeKey, Array.from(next));
        return next;
      });
    },
    [routeKey]
  );

  const resetColumnVisibility = useCallback(() => {
    setHiddenColumns(new Set());
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(getColumnVisibilityStorageKey(routeKey));
      } catch {
        // Ignore storage failures
      }
    }
  }, [routeKey]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenColumns.has(c.id)),
    [columns, hiddenColumns]
  );

  // Sync state from URL parameters on mount and searchParams changes
  useEffect(() => {
    if (!syncToUrl) return;

    const urlPage = searchParams.get(pageParamName);
    const urlPageSize = searchParams.get(pageSizeParamName);
    const urlSort = searchParams.get(sortParamName);

    if (urlPage) {
      const parsedPage = parseInt(urlPage, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        setPage(parsedPage - 1);
      }
    }
    if (urlPageSize) {
      const parsedSize = parseInt(urlPageSize, 10);
      if (!isNaN(parsedSize) && parsedSize > 0) {
        setPageSize(parsedSize);
      }
    }
    if (urlSort) {
      const parts = urlSort.split(":");
      if (parts.length === 2 && (parts[1] === "asc" || parts[1] === "desc")) {
        const columnExists = columns.some((c) => c.id === parts[0]);
        if (columnExists) {
          setSortColumn(parts[0]);
          setSortDirection(parts[1] as TableSortDirection);
        }
      }
    }
  }, [searchParams, syncToUrl, pageParamName, pageSizeParamName, sortParamName, columns]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;
    const column = columns.find((c) => c.id === sortColumn);
    if (!column) return data;
    return [...data].sort((a, b) =>
      compareValues(getSortValue(a, column), getSortValue(b, column), sortDirection)
    );
  }, [data, columns, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = sortedData.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (columnId: string) => {
    let nextColumn: string | null = columnId;
    let nextDirection: TableSortDirection = "asc";

    if (sortColumn !== columnId) {
      nextColumn = columnId;
      nextDirection = "asc";
    } else if (sortDirection === "asc") {
      nextColumn = columnId;
      nextDirection = "desc";
    } else {
      nextColumn = null;
      nextDirection = null;
    }

    setSortColumn(nextColumn);
    setSortDirection(nextDirection);

    if (syncToUrl) {
      const params = new URLSearchParams(searchParams.toString());
      if (nextColumn && nextDirection) {
        params.set(sortParamName, `${nextColumn}:${nextDirection}`);
      } else {
        params.delete(sortParamName);
      }
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = pageData.map(getRowId);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const getRowProps = (row: T) => {
    if (!onRowClick) return {};
    return {
      role: "row",
      tabIndex: 0,
      "aria-label": t("openDetailsAria", { id: getRowId(row) }),
      className: "cursor-pointer",
      onClick: () => onRowClick(row),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(row);
        }
      },
    } as const;
  };

  const renderCellValue = (row: T, column: ColumnDef<T>) => {
    if (column.cell) return column.cell(row);
    if (column.accessor) {
      if (typeof column.accessor === "function") {
        return column.accessor(row);
      }
      return String(row[column.accessor as keyof T] ?? "");
    }
    return null;
  };

  const SortIcon = ({ columnId }: { columnId: string }) => {
    if (sortColumn !== columnId || !sortDirection) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden />
    );
  };

  const ColumnVisibilityMenu = () => (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="true"
        aria-expanded={columnMenuOpen}
        aria-label={t("columnsAria")}
        onClick={() => setColumnMenuOpen((open) => !open)}
      >
        <Columns3 className="h-4 w-4" aria-hidden />
        <span className="ml-2 hidden sm:inline">{t("columns")}</span>
      </Button>
      {columnMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-lg"
        >
          <div className="max-h-64 overflow-y-auto">
            {columns.map((column) => {
              const isHidden = hiddenColumns.has(column.id);
              return (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={!isHidden}
                    onChange={() => toggleColumnVisibility(column.id)}
                  />
                  <span className="truncate">{column.header}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={resetColumnVisibility}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              <span className="ml-2">{t("resetColumns")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (!isLoading && data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center",
          className
        )}
      >
        {emptyState?.illustration}
        {emptyState?.title && (
          <p className="mt-4 text-base font-semibold text-foreground">{emptyState.title}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyState?.message ?? t("noData")}
        </p>
        {emptyState?.action && <div className="mt-4">{emptyState.action}</div>}
      </div>
    );
  }

  const skeletonRowCount = Math.min(pageSize, 5);

  if (isMobileView) {
    return (
      <div className={cn("space-y-4", className)}>
        <div
          className={cn(
            "flex items-center justify-between gap-4 flex-wrap border-b border-border/50 pb-4",
            stickyHeaderClasses
          )}
        >
          {enableSelection && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-input"
                checked={
                  pageData.length > 0 && pageData.every((row) => selected.has(getRowId(row)))
                }
                onChange={toggleAll}
                aria-label={t("selectAllAria")}
              />
              {t("selectAllOnPage")}
            </label>
          )}
          <ColumnVisibilityMenu />
        </div>
        {isLoading
          ? Array.from({ length: skeletonRowCount }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-3/4" />
              </div>
            ))
          : pageData.map((row) => (
              <div
                key={getRowId(row)}
                className="rounded-xl border border-border bg-card p-4"
                {...getRowProps(row)}
              >
                {visibleColumns.map((column) => (
                  <div key={column.id} className="flex justify-between gap-4 py-1 text-sm">
                    <span className="text-muted-foreground">{column.header}</span>
                    <span className="text-right text-foreground">{renderCellValue(row, column)}</span>
                  </div>
                ))}
              </div>
            ))}
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {enableSelection && bulkActions && selected.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("selectedCount", { count: selected.size })}
            {bulkActions}
          </div>
        )}
        <div className="ml-auto">
          <ColumnVisibilityMenu />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className={stickyHeaderClasses}>
            <tr>
              {enableSelection && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={
                      pageData.length > 0 && pageData.every((row) => selected.has(getRowId(row)))
                    }
                    onChange={toggleAll}
                    aria-label={t("selectAllAria")}
                  />
                </th>
              )}
              {visibleColumns.map((column) => (
                <th key={column.id} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(column.id)}
                    >
                      {column.header}
                      <SortIcon columnId={column.id} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    {enableSelection && (
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-3 py-2">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : pageData.map((row) => (
                  <tr key={getRowId(row)} className="border-t border-border" {...getRowProps(row)}>
                    {enableSelection && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={selected.has(getRowId(row))}
                          onChange={() => toggleRow(getRowId(row))}
                          aria-label={t("selectRowAria", { id: getRowId(row) })}
                        />
                      </td>
                    )}
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-3 py-2 text-foreground">
                        {renderCellValue(row, column)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
      />
    </div>
  );
}