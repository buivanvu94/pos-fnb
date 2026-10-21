"use client";

import React, { useState } from "react";
import { Form, Input, Button, Upload, Space, Card, Row, Col, Typography, Divider, App } from "antd";
import { ShopOutlined, WifiOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";

const { Title } = Typography;

interface StoreWifiCardProps {
  initialLogo?: string;
  onLogoUploaded?: (filePath: string) => void;
}

export function StoreWifiCard({ initialLogo, onLogoUploaded }: StoreWifiCardProps) {
  const { message } = App.useApp();
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>(
    initialLogo
      ? [
          {
            uid: "-1",
            name: "logo.png",
            status: "done",
            url: initialLogo,
          },
        ]
      : [],
  );

  return (
    <Card
      title={
        <Space>
          <ShopOutlined style={{ color: "#52c41a" }} />
          <span>Thông tin quán & QR Wi-Fi (DEC-13)</span>
        </Space>
      }
    >
      <Form.Item
        name="storeName"
        label="Tên quán ăn / Cafe"
        rules={[{ required: true, message: "Vui lòng nhập tên quán" }]}
      >
        <Input placeholder="POS Cafe & Restaurant" />
      </Form.Item>

      <Form.Item name="storeAddress" label="Địa chỉ">
        <Input placeholder="123 Đường Nguyễn Huệ, Quận 1, TP.HCM" />
      </Form.Item>

      <Form.Item name="storePhone" label="Số điện thoại / Hotline">
        <Input placeholder="0901234567" />
      </Form.Item>

      <Form.Item label="Logo in đầu hóa đơn (PNG/JPG <= 1MB)">
        <Upload
          name="file"
          action="/api/v1/settings/logo"
          maxCount={1}
          fileList={logoFileList}
          beforeUpload={(file) => {
            const isImage = file.type === "image/png" || file.type === "image/jpeg";
            if (!isImage) {
              message.error("Chỉ chấp nhận file ảnh PNG hoặc JPG");
              return Upload.LIST_IGNORE;
            }
            const isLt1M = file.size / 1024 / 1024 <= 1;
            if (!isLt1M) {
              message.error("Dung lượng logo không được vượt quá 1MB");
              return Upload.LIST_IGNORE;
            }
            return true;
          }}
          onChange={(info) => {
            setLogoFileList(info.fileList);
            if (info.file.status === "done" && info.file.response?.ok) {
              message.success("Tải lên logo thành công");
              if (onLogoUploaded) {
                onLogoUploaded(info.file.response.data.path);
              }
            }
          }}
        >
          <Button icon={<UploadOutlined />}>Tải lên Logo quán</Button>
        </Upload>
      </Form.Item>

      <Form.Item name="storeLogo" hidden>
        <Input />
      </Form.Item>

      <Divider />

      <Title level={5}>
        <Space>
          <WifiOutlined />
          <span>Mã QR Wi-Fi in cuối hóa đơn</span>
        </Space>
      </Title>

      <Row gutter={16}>
        <Col span={14}>
          <Form.Item name="wifiSsid" label="Tên mạng Wi-Fi (SSID)">
            <Input placeholder="POS_FREE_WIFI" />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item name="wifiPassword" label="Mật khẩu Wi-Fi">
            <Input.Password placeholder="12345678" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
}
