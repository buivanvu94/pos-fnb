"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Space, Statistic, Button, Tooltip, Typography, Spin } from "antd";
import {
  SwapOutlined,
  CheckCircleOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { formatVndNumber } from "@/lib/money";
import { CashTransactionModal } from "./cash-transaction-modal";

const { Text } = Typography;

interface ShiftData {
  id: number;
  shiftCode: string;
  initialCash: number;
  expectedCash: number;
  status: string;
}

export function ShiftToolbar() {
  const [shift, setShift] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchCurrentShift = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/shifts/current");
      if (res.ok) {
        const data = await res.json();
        if (data?.ok && data?.data) {
          setShift(data.data);
        } else {
          setShift(null);
        }
      }
    } catch (err) {
      console.error("Failed to load shift toolbar data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentShift();

    const handleUpdate = () => {
      fetchCurrentShift();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pos:shift-updated", handleUpdate);
      window.addEventListener("focus", handleUpdate);
    }

    const interval = setInterval(fetchCurrentShift, 10000);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pos:shift-updated", handleUpdate);
        window.removeEventListener("focus", handleUpdate);
      }
      clearInterval(interval);
    };
  }, [fetchCurrentShift]);

  const handleCashSuccess = (newExpectedCash: number) => {
    setShift((prev) => (prev ? { ...prev, expectedCash: newExpectedCash } : prev));
  };

  if (loading) {
    return <Spin size="small" />;
  }

  if (!shift) {
    return null;
  }

  return (
    <>
      <Space size="large" align="center">
        <div
          style={{
            background: "#f0f5ff",
            border: "1px solid #d6e4ff",
            borderRadius: 6,
            padding: "4px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <WalletOutlined style={{ color: "#1677ff", fontSize: 18 }} />
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: "block", lineHeight: 1 }}>
              Tiền mặt két (Lý thuyết)
            </Text>
            <Statistic
              value={shift.expectedCash}
              formatter={(val) => `${formatVndNumber(Number(val))} ₫`}
              valueStyle={{ fontSize: 15, fontWeight: 700, color: "#1677ff", lineHeight: 1.2 }}
            />
          </div>
        </div>

        <Button
          icon={<SwapOutlined />}
          style={{ height: 40, fontWeight: 600 }}
          onClick={() => setModalOpen(true)}
        >
          Thu / Chi
        </Button>

        <Button
          type="primary"
          danger
          icon={<CheckCircleOutlined />}
          style={{ height: 40, fontWeight: 600 }}
          onClick={() => {
            window.location.href = "/close-shift";
          }}
        >
          {shift.status === "CHO_DUYET" ? "Chờ duyệt ca" : "Kết ca"}
        </Button>
      </Space>

      <CashTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCashSuccess}
      />
    </>
  );
}
