"use client";

import React, { useState } from "react";
import { Form, Input, Button, Segmented, Switch, Space, Card, Divider, App } from "antd";
import { PrinterOutlined } from "@ant-design/icons";

export function PrinterLanCard() {
  const { message } = App.useApp();
  const [testingTarget, setTestingTarget] = useState<string | null>(null);

  const handleTestPrint = async (target: "kitchen" | "bar" | "receipt") => {
    setTestingTarget(target);
    try {
      const res = await fetch("/api/v1/print-jobs/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        message.success(data.message || "Đã gửi lệnh in thử thành công");
      } else {
        message.error(data.error || "Không thể kết nối máy in để in thử");
      }
    } catch {
      message.error("Lỗi khi gửi yêu cầu in thử");
    } finally {
      setTestingTarget(null);
    }
  };

  return (
    <Card
      title={
        <Space>
          <PrinterOutlined style={{ color: "#1677ff" }} />
          <span>Cấu hình máy in nhiệt LAN (ESC/POS)</span>
        </Space>
      }
    >
      <Form.Item
        name="kitchenIp"
        label="Địa chỉ IP máy in Bếp (Kitchen Printer)"
        rules={[{ required: true, message: "Vui lòng nhập IP máy in bếp" }]}
      >
        <Input
          placeholder="192.168.1.200"
          addonAfter={
            <Button
              type="link"
              size="small"
              loading={testingTarget === "kitchen"}
              onClick={() => handleTestPrint("kitchen")}
            >
              In thử Bếp
            </Button>
          }
        />
      </Form.Item>

      <Form.Item
        name="barIp"
        label="Địa chỉ IP máy in Pha chế (Bar Printer)"
        rules={[{ required: true, message: "Vui lòng nhập IP máy in bar" }]}
      >
        <Input
          placeholder="192.168.1.201"
          addonAfter={
            <Button
              type="link"
              size="small"
              loading={testingTarget === "bar"}
              onClick={() => handleTestPrint("bar")}
            >
              In thử Bar
            </Button>
          }
        />
      </Form.Item>

      <Form.Item
        name="receiptIp"
        label="Địa chỉ IP máy in Hóa đơn & Thu ngân"
        rules={[{ required: true, message: "Vui lòng nhập IP máy in hóa đơn" }]}
      >
        <Input
          placeholder="192.168.1.202"
          addonAfter={
            <Button
              type="link"
              size="small"
              loading={testingTarget === "receipt"}
              onClick={() => handleTestPrint("receipt")}
            >
              In thử Hóa đơn
            </Button>
          }
        />
      </Form.Item>

      <Form.Item
        name="paperWidth"
        label="Khổ giấy in nhiệt"
        rules={[{ required: true }]}
      >
        <Segmented
          options={[
            { label: "Khổ 80mm (Chuẩn 576 dots)", value: 80 },
            { label: "Khổ 58mm (Nhỏ 384 dots)", value: 58 },
          ]}
          block
        />
      </Form.Item>

      <Divider />

      <Form.Item
        name="drawerEnabled"
        label="Kích xung mở két tiền RJ12 khi thanh toán / thu chi (DEC-11)"
        valuePropName="checked"
      >
        <Switch checkedChildren="Bật mở két" unCheckedChildren="Tắt" />
      </Form.Item>
    </Card>
  );
}
