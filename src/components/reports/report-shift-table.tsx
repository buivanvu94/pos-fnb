"use client";

import React from "react";
import { Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { ShiftRevenueStat } from "@/server/reports/report-types";

const { Text } = Typography;

interface ReportShiftTableProps {
  shifts: ShiftRevenueStat[];
  loading?: boolean;
}

export function ReportShiftTable({ shifts, loading }: ReportShiftTableProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

  const columns: ColumnsType<ShiftRevenueStat> = [
    {
      title: "Mã ca",
      dataIndex: "shiftCode",
      key: "shiftCode",
      render: (code) => <Text strong>{code}</Text>,
    },
    {
      title: "Thu ngân",
      dataIndex: "cashierName",
      key: "cashierName",
    },
    {
      title: "Giờ mở",
      dataIndex: "openedAt",
      key: "openedAt",
      render: (d) => (d ? dayjs(d).format("HH:mm DD/MM") : "-"),
      sorter: (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
    },
    {
      title: "Giờ đóng",
      dataIndex: "closedAt",
      key: "closedAt",
      render: (d, record) =>
        d ? (
          dayjs(d).format("HH:mm DD/MM")
        ) : (
          <Tag color="processing">Đang mở</Tag>
        ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        if (status === "DANG_MO") return <Tag color="green">Đang mở</Tag>;
        if (status === "CHO_DUYET") return <Tag color="orange">Chờ duyệt</Tag>;
        return <Tag>Đã đóng</Tag>;
      },
    },
    {
      title: "Số đơn",
      dataIndex: "orderCount",
      key: "orderCount",
      align: "right",
      sorter: (a, b) => a.orderCount - b.orderCount,
    },
    {
      title: "Doanh thu",
      dataIndex: "revenue",
      key: "revenue",
      align: "right",
      render: (val) => <Text strong>{formatCurrency(val)}</Text>,
      sorter: (a, b) => a.revenue - b.revenue,
    },
    {
      title: "Lệch tiền",
      dataIndex: "difference",
      key: "difference",
      align: "right",
      render: (diff: number | null) => {
        if (diff === null || diff === undefined) {
          return <Text type="secondary">-</Text>;
        }
        if (diff === 0) {
          return <Text type="success">Khớp 0 đ</Text>;
        }
        if (diff > 0) {
          return (
            <Text type="success">
              +{formatCurrency(diff)} (Thừa)
            </Text>
          );
        }
        return (
          <Text type="danger">
            {formatCurrency(diff)} (Thiếu)
          </Text>
        );
      },
      sorter: (a, b) => (a.difference ?? 0) - (b.difference ?? 0),
    },
  ];

  return (
    <Table<ShiftRevenueStat>
      rowKey="shiftId"
      columns={columns}
      dataSource={shifts}
      loading={loading}
      pagination={{ pageSize: 8, showSizeChanger: true }}
      scroll={{ x: 750 }}
      size="middle"
    />
  );
}
