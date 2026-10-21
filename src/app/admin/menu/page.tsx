"use client";

import React from "react";
import { Typography, Card, Result } from "antd";
import { MainLayout } from "@/components/main-layout";
import { CoffeeOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function AdminMenuPage() {
  return (
    <MainLayout>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          Quản lý thực đơn & Giá bán (Chỉ Quản lý)
        </Title>
        <Text type="secondary">Nghiệp vụ FR-15: Quản lý danh mục, đơn giá và trạng thái hết món</Text>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Result
          icon={<CoffeeOutlined style={{ color: "#fa8c16" }} />}
          title="Khu vực quản lý thực đơn"
          subTitle="Chỉ tài khoản vai trò QUAN_LY mới có quyền truy cập trang này. Phân quyền theo ma trận SRS 2.5."
        />
      </Card>
    </MainLayout>
  );
}
