"use client";

import React from "react";
import { Typography, Card, Result } from "antd";
import { MainLayout } from "@/components/main-layout";
import { ShoppingOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function CounterPage() {
  return (
    <MainLayout>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          Bán hàng tại quầy / Mang về (Takeaway)
        </Title>
        <Text type="secondary">Nghiệp vụ FR-05: Thu ngân bán nhanh, in số thứ tự và thanh toán ngay</Text>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Result
          icon={<ShoppingOutlined style={{ color: "#1677ff" }} />}
          title="Màn hình bán tại quầy (Sẽ kích hoạt tại Phase 07)"
          subTitle="Hạ tầng khung layout Ant Design và phân quyền đã hoàn tất."
        />
      </Card>
    </MainLayout>
  );
}
