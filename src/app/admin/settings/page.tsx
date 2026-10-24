"use client";

import React, { useState, useEffect } from "react";
import { Typography, Spin, Alert, App } from "antd";
import { MainLayout } from "@/components/main-layout";
import { PrinterSettingsForm } from "@/components/printing/printer-settings-form";
import type { PrinterSettings } from "@/server/printing/settings-service";

const { Title, Paragraph } = Typography;

export default function AdminSettingsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/v1/settings/printers")
      .then(async (res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        if (!res.ok) throw new Error("Không thể tải cấu hình máy in");
        return res.json();
      })
      .then((data) => {
        if (data?.data) {
          setSettings(data.data);
        }
      })
      .catch((err) => {
        message.error(err.message || "Lỗi khi tải cấu hình");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [message]);

  return (
    <MainLayout>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            Cài đặt máy in nhiệt & Quán
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Quản lý địa chỉ IP máy in Bếp, Bar, Hóa đơn (ESC/POS cổng LAN 9100), khổ giấy 80mm/58mm, logo và mã QR Wi-Fi.
          </Paragraph>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: "#8c8c8c" }}>Đang tải cấu hình...</div>
          </div>
        ) : forbidden ? (
          <Alert
            type="error"
            message="Không có quyền truy cập"
            description="Chức năng cài đặt máy in chỉ dành riêng cho Quản lý quán."
            showIcon
          />
        ) : settings ? (
          <PrinterSettingsForm
            initialSettings={settings}
            onSaved={(updated) => setSettings(updated)}
          />
        ) : null}
      </div>
    </MainLayout>
  );
}
