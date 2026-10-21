"use client";

import React, { useState } from "react";
import { Form, Button, Row, Col, App } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import type { PrinterSettings } from "@/server/printing/settings-service";
import { PrinterLanCard } from "./printer-lan-card";
import { StoreWifiCard } from "./store-wifi-card";

interface PrinterSettingsFormProps {
  initialSettings: PrinterSettings;
  onSaved?: (newSettings: PrinterSettings) => void;
}

export function PrinterSettingsForm({
  initialSettings,
  onSaved,
}: PrinterSettingsFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings/printers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        message.success("Đã lưu cấu hình máy in và thông tin quán thành công");
        if (onSaved) onSaved(data.data);
      } else {
        message.error(data.error || "Không thể lưu cấu hình");
      }
    } catch {
      message.error("Lỗi khi lưu cấu hình");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialSettings}
      onFinish={onFinish}
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <PrinterLanCard />
        </Col>

        <Col xs={24} lg={12}>
          <StoreWifiCard
            initialLogo={initialSettings.storeLogo}
            onLogoUploaded={(path) => form.setFieldsValue({ storeLogo: path })}
          />
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: "right" }}>
        <Button
          type="primary"
          htmlType="submit"
          icon={<CheckOutlined />}
          size="large"
          loading={saving}
          style={{ minWidth: 160 }}
        >
          Lưu cấu hình
        </Button>
      </div>
    </Form>
  );
}
