"use client";

import React, { useEffect, useState } from "react";
import { Badge, Tooltip, Space, Typography } from "antd";
import type { SyncStatusResult } from "@/server/sync/sync-types";

const { Text } = Typography;

/**
 * Top bar sync status badge (NFR-04, DEC-10).
 * Displays sync readiness and pending/failed items count with 30s polling.
 * Non-blocking, purely observational; does not block cashiers or provide manual confirm.
 */
export function SyncStatusBadge() {
  const [syncStatus, setSyncStatus] = useState<SyncStatusResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/v1/sync/status");
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.ok && json?.data) {
            setSyncStatus(json.data);
          }
        }
      } catch {
        // Observational badge: failures to poll should never interrupt user workflow
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!syncStatus) {
    return null;
  }

  const { pending, failed, configured } = syncStatus;

  if (failed > 0) {
    const tooltipText = `${failed} bản lỗi đồng bộ, ${pending} bản đang chờ`;
    return (
      <Tooltip title={tooltipText}>
        <Space size={6} style={{ cursor: "default", padding: "0 4px" }}>
          <Badge status="error" />
          <Text type="danger" style={{ fontSize: 13 }}>
            Lỗi đồng bộ ({failed})
          </Text>
        </Space>
      </Tooltip>
    );
  }

  if (pending > 0) {
    const tooltipText = configured
      ? `Còn ${pending} bản chờ đồng bộ`
      : `Chưa cấu hình máy chủ đám mây (Còn ${pending} bản chờ)`;
    return (
      <Tooltip title={tooltipText}>
        <Space size={6} style={{ cursor: "default", padding: "0 4px" }}>
          <Badge
            count={pending}
            overflowCount={99}
            style={{
              backgroundColor: configured ? "#faad14" : "#8c8c8c",
              color: "#fff",
            }}
          />
          <Text style={{ fontSize: 13, color: configured ? "#d48806" : "#595959" }}>
            Còn {pending} bản chờ đồng bộ
          </Text>
        </Space>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={configured ? "Đã đồng bộ lên đám mây" : "Hệ thống sẵn sàng (Chưa cấu hình đồng bộ)"}>
      <Space size={6} style={{ cursor: "default", padding: "0 4px" }}>
        <Badge status="success" />
        <Text type="secondary" style={{ fontSize: 13 }}>
          Đã đồng bộ
        </Text>
      </Space>
    </Tooltip>
  );
}
