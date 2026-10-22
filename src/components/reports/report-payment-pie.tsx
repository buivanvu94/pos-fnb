"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Empty, Skeleton } from "antd";
import type { PaymentMethodStat } from "@/server/reports/report-types";

// Dynamically import Pie from @ant-design/plots with ssr: false for Next.js compatibility
const Pie = dynamic(
  () => import("@ant-design/plots").then((mod) => mod.Pie),
  {
    ssr: false,
    loading: () => <Skeleton.Node active style={{ width: "100%", height: 260 }} />,
  },
);

interface ReportPaymentPieProps {
  paymentMethods: PaymentMethodStat[];
  loading?: boolean;
}

export function ReportPaymentPie({ paymentMethods, loading }: ReportPaymentPieProps) {
  const chartData = paymentMethods
    .filter((item) => item.amount > 0)
    .map((item) => ({
      type: `${item.name} (${item.percentage}%)`,
      value: item.amount,
      rawMethod: item.method,
    }));

  const hasData = chartData.length > 0;

  const config = {
    data: chartData,
    angleField: "value",
    colorField: "type",
    radius: 0.8,
    innerRadius: 0.5,
    legend: {
      color: {
        position: "bottom" as const,
        layout: { justifyContent: "center" },
      },
    },
    tooltip: {
      items: [
        {
          channel: "y",
          valueFormatter: (val: number) =>
            new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val),
        },
      ],
    },
    annotations: [
      {
        type: "text",
        style: {
          text: "Tỷ trọng\nthanh toán",
          x: "50%",
          y: "50%",
          textAlign: "center" as const,
          fontSize: 14,
          fontStyle: "bold",
        },
      },
    ],
  };

  return (
    <Card
      title="Cơ cấu phương thức thanh toán"
      variant="outlined"
      style={{ borderRadius: 8, height: "100%" }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : hasData ? (
        <div style={{ height: 280 }}>
          <Pie {...config} />
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có dữ liệu thanh toán trong khoảng thời gian này"
          style={{ margin: "40px 0" }}
        />
      )}
    </Card>
  );
}
