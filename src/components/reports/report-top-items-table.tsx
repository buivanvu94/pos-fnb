"use client";

import React from "react";
import { Table, Typography, Badge } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TopItemStat } from "@/server/reports/report-types";

const { Text } = Typography;

interface ReportTopItemsTableProps {
  topItems: TopItemStat[];
  loading?: boolean;
}

export function ReportTopItemsTable({ topItems, loading }: ReportTopItemsTableProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

  const columns: ColumnsType<TopItemStat> = [
    {
      title: "Hạng",
      key: "rank",
      width: 70,
      align: "center",
      render: (_value, _record, index) => {
        const colors = ["#f5222d", "#fa8c16", "#faad14"];
        const rankColor = colors[index] || "#8c8c8c";
        return (
          <Badge
            count={index + 1}
            style={{ backgroundColor: rankColor, fontWeight: "bold" }}
          />
        );
      },
    },
    {
      title: "Tên món",
      dataIndex: "menuItemName",
      key: "menuItemName",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "Số lượng bán",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      sorter: (a, b) => a.quantity - b.quantity,
      render: (q) => <Text>{q.toLocaleString("vi-VN")}</Text>,
    },
    {
      title: "Doanh thu món",
      dataIndex: "revenue",
      key: "revenue",
      align: "right",
      sorter: (a, b) => a.revenue - b.revenue,
      render: (val) => <Text strong>{formatCurrency(val)}</Text>,
    },
  ];

  return (
    <Table<TopItemStat>
      rowKey="menuItemId"
      columns={columns}
      dataSource={topItems}
      loading={loading}
      pagination={{ pageSize: 5 }}
      size="middle"
    />
  );
}
