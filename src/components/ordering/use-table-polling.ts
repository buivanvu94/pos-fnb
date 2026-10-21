import { useState, useEffect, useCallback, useRef } from "react";
import type { TableWithOrderInfo } from "@/server/tables/table-service";

export interface UseTablePollingResult {
  tables: TableWithOrderInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom polling hook to fetch real-time table status every 3 seconds.
 * Automatically halts polling when the browser tab is hidden to save battery and network bandwidth.
 */
export function useTablePolling(intervalMs: number = 3000): UseTablePollingResult {
  const [tables, setTables] = useState<TableWithOrderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchTables = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await fetch("/api/v1/tables");
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setTables(json.data);
        setError(null);
      } else {
        setError(json.error || "Không thể tải danh sách bàn");
      }
    } catch (err: any) {
      setError(err?.message || "Lỗi kết nối khi tải danh sách bàn");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchTables();

    // Setup 3s interval polling
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return; // Pause when tab is hidden
      }
      fetchTables();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchTables();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchTables, intervalMs]);

  return {
    tables,
    loading,
    error,
    refresh: fetchTables,
  };
}
