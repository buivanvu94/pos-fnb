import React from "react";
import { Card, Badge, Typography, Space } from "antd";
import {
  CheckCircleOutlined,
  FireOutlined,
  DollarOutlined,
  TeamOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { TABLE_STATUS_COLORS } from "@/theme/theme-config";
import { formatVnd } from "@/lib/money";
import type { TableWithOrderInfo } from "@/server/tables/table-service";

const { Text, Title } = Typography;

interface TableCardProps {
  table: TableWithOrderInfo;
  isSelected?: boolean;
  onClick: (table: TableWithOrderInfo) => void;
}

const STATUS_CONFIG: Record<
  "TRONG" | "DANG_DUNG" | "CHO_THANH_TOAN",
  { label: string; color: string; ribbonText: string; icon: React.ReactNode; ribbonTextColor: string }
> = {
  TRONG: {
    label: "Trống",
    color: TABLE_STATUS_COLORS.TRONG,
    ribbonText: "Trống",
    icon: <CheckCircleOutlined />,
    ribbonTextColor: "#fff",
  },
  DANG_DUNG: {
    label: "Đang phục vụ",
    color: TABLE_STATUS_COLORS.DANG_DUNG,
    ribbonText: "Đang phục vụ",
    icon: <FireOutlined />,
    ribbonTextColor: "#fff",
  },
  CHO_THANH_TOAN: {
    label: "Chờ thanh toán",
    color: TABLE_STATUS_COLORS.CHO_THANH_TOAN,
    ribbonText: "Chờ thanh toán",
    icon: <DollarOutlined />,
    // Nền vàng cần chữ tối để đạt tương phản AA
    ribbonTextColor: "#262626",
  },
};

export function TableCard({ table, isSelected, onClick }: TableCardProps) {
  const statusInfo = STATUS_CONFIG[table.status] ?? STATUS_CONFIG.TRONG;

  return (
    <Badge.Ribbon
      text={
        <span style={{ color: statusInfo.ribbonTextColor }}>
          {statusInfo.icon} {statusInfo.ribbonText}
        </span>
      }
      color={statusInfo.color}
    >
      <Card
        hoverable
        onClick={() => onClick(table)}
        style={{
          borderRadius: 8,
          border: isSelected
            ? "2px solid #1677ff"
            : `1px solid ${statusInfo.color}40`,
          backgroundColor: isSelected ? "#f0f7ff" : "#ffffff",
          minHeight: 140,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        bodyStyle={{ padding: "16px 12px 12px 12px" }}
      >
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={5} style={{ margin: 0 }}>
            <span style={{ color: statusInfo.color, marginRight: 8 }}>{statusInfo.icon}</span>
            {table.name}
          </Title>

          <Text type="secondary" style={{ fontSize: 13 }}>
            <TeamOutlined /> Sức chứa: {table.capacity} khách
          </Text>

          {table.status !== "TRONG" && (
            <div style={{ marginTop: 8, borderTop: "1px dashed #f0f0f0", paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: "#666" }}>
                  <ShoppingCartOutlined /> {table.activeOrderItemCount} món
                </Text>
                <Text strong style={{ fontSize: 14, color: "#d4380d" }}>
                  {formatVnd(table.activeOrderTotal)}
                </Text>
              </div>
            </div>
          )}
        </Space>
      </Card>
    </Badge.Ribbon>
  );
}
