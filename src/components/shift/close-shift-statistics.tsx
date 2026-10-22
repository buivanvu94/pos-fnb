"use client";

import React from "react";
import { Descriptions, Card, Typography, Row, Col, Statistic } from "antd";
import {
  WalletOutlined,
  DollarCircleOutlined,
  QrcodeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  AccountBookOutlined,
} from "@ant-design/icons";
import { formatVndNumber } from "@/lib/money";

const { Text } = Typography;

export interface ShiftStatsData {
  shiftCode: string;
  openedAt: string;
  initialCash: number;
  cashSales: number;
  vietqrSales: number;
  totalSales: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  invoiceCount?: number;
}

interface CloseShiftStatisticsProps {
  stats: ShiftStatsData;
}

export function CloseShiftStatistics({ stats }: CloseShiftStatisticsProps) {
  return (
    <Card
      title={
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          <AccountBookOutlined style={{ marginRight: 8, color: "#1677ff" }} />
          Thống kê tài chính trong ca ({stats.shiftCode})
        </span>
      }
      bordered={false}
      style={{
        background: "#fafafa",
        border: "1px solid #f0f0f0",
        borderRadius: 8,
        marginBottom: 20,
      }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}>
          <Statistic
            title={<Text type="secondary"><WalletOutlined /> Tiền đầu ca</Text>}
            value={stats.initialCash}
            formatter={(val) => `${formatVndNumber(Number(val))} ₫`}
            valueStyle={{ fontSize: 16, fontWeight: 600 }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title={<Text type="secondary"><DollarCircleOutlined /> Doanh thu Tiền mặt</Text>}
            value={stats.cashSales}
            formatter={(val) => `${formatVndNumber(Number(val))} ₫`}
            valueStyle={{ fontSize: 16, fontWeight: 600, color: "#52c41a" }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title={<Text type="secondary"><QrcodeOutlined /> Doanh thu VietQR</Text>}
            value={stats.vietqrSales}
            formatter={(val) => `${formatVndNumber(Number(val))} ₫`}
            valueStyle={{ fontSize: 16, fontWeight: 600, color: "#1677ff" }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title={<Text type="secondary"><ArrowUpOutlined /> Thu vặt trong ca</Text>}
            value={stats.cashIn}
            formatter={(val) => `+${formatVndNumber(Number(val))} ₫`}
            valueStyle={{ fontSize: 15, fontWeight: 500, color: "#389e0d" }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title={<Text type="secondary"><ArrowDownOutlined /> Chi vặt trong ca</Text>}
            value={stats.cashOut}
            formatter={(val) => `-${formatVndNumber(Number(val))} ₫`}
            valueStyle={{ fontSize: 15, fontWeight: 500, color: "#cf1322" }}
          />
        </Col>
        <Col xs={12} sm={8}>
          <Statistic
            title={
              <Text strong style={{ color: "#0958d9" }}>
                Tiền mặt lý thuyết (BR-05)
              </Text>
            }
            value={stats.expectedCash}
            formatter={(val) => `${formatVndNumber(Number(val))} ₫`}
            valueStyle={{ fontSize: 18, fontWeight: 700, color: "#0958d9" }}
          />
        </Col>
      </Row>

      <Descriptions
        size="small"
        column={2}
        style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed #d9d9d9" }}
      >
        <Descriptions.Item label="Tổng doanh thu (Tiền mặt + QR)">
          <Text strong>{formatVndNumber(stats.totalSales)} ₫</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Số hóa đơn hoàn tất">
          <Text strong>{stats.invoiceCount ?? 0} hóa đơn</Text>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
