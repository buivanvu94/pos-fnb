"use client";

import React from "react";
import { Row, Col, Card, Statistic } from "antd";
import {
  DollarCircleOutlined,
  ShoppingOutlined,
  PieChartOutlined,
} from "@ant-design/icons";
import type { RevenueSummary } from "@/server/reports/report-types";

interface ReportSummaryCardsProps {
  summary: RevenueSummary;
  loading?: boolean;
}

export function ReportSummaryCards({ summary, loading }: ReportSummaryCardsProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={8}>
        <Card loading={loading} variant="outlined" style={{ borderRadius: 8 }}>
          <Statistic
            title="Tổng doanh thu thuần"
            value={summary.totalRevenue}
            formatter={(val) => formatCurrency(Number(val))}
            valueStyle={{ color: "#3f8600", fontWeight: "bold" }}
            prefix={<DollarCircleOutlined />}
          />
        </Card>
      </Col>

      <Col xs={24} sm={8}>
        <Card loading={loading} variant="outlined" style={{ borderRadius: 8 }}>
          <Statistic
            title="Tổng số đơn hoàn tất"
            value={summary.orderCount}
            valueStyle={{ color: "#1677ff", fontWeight: "bold" }}
            prefix={<ShoppingOutlined />}
            suffix="đơn"
          />
        </Card>
      </Col>

      <Col xs={24} sm={8}>
        <Card loading={loading} variant="outlined" style={{ borderRadius: 8 }}>
          <Statistic
            title="Giá trị đơn trung bình"
            value={summary.averageOrderValue}
            formatter={(val) => formatCurrency(Number(val))}
            valueStyle={{ color: "#d46b08", fontWeight: "bold" }}
            prefix={<PieChartOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
}
