"use client";

import React from "react";
import { Typography, Card, Result } from "antd";
import { MainLayout } from "@/components/main-layout";
import { BarChartOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function AdminReportsPage() {
  return (
    <MainLayout>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          Báo cáo doanh thu tổng hợp (Chỉ Quản lý)
        </Title>
        <Text type="secondary">Nghiệp vụ FR-14: Thống kê doanh thu theo ca, phương thức và top món</Text>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Result
          icon={<BarChartOutlined style={{ color: "#52c41a" }} />}
          title="Khu vực báo cáo Quản lý"
          subTitle="Chỉ tài khoản vai trò QUAN_LY mới có quyền truy cập trang này. Nhân viên Phục vụ/Thu ngân bị chặn 403."
        />
      </Card>
    </MainLayout>
  );
}
