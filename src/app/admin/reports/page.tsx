"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Typography, Row, Col, Card, message, Skeleton } from "antd";
import dayjs from "dayjs";
import { MainLayout } from "@/components/main-layout";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { ReportPaymentPie } from "@/components/reports/report-payment-pie";
import { ReportShiftTable } from "@/components/reports/report-shift-table";
import { ReportTopItemsTable } from "@/components/reports/report-top-items-table";
import type { RevenueReportData } from "@/server/reports/report-types";

const { Title, Text } = Typography;

export default function AdminReportsPage() {
  const [fromDate, setFromDate] = useState<string>(() => dayjs().format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState<string>(() => dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<RevenueReportData | null>(null);

  const fetchReport = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/reports/revenue?fromDate=${start}&toDate=${end}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        message.error(json.error || "Không thể tải báo cáo doanh thu");
        return;
      }

      setReportData(json.data);
    } catch {
      message.error("Lỗi mạng khi kết nối tới máy chủ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(fromDate, toDate);
  }, [fromDate, toDate, fetchReport]);

  const handleFilterChange = (start: string, end: string) => {
    setFromDate(start);
    setToDate(end);
  };

  const defaultSummary = {
    totalRevenue: 0,
    orderCount: 0,
    averageOrderValue: 0,
    totalDiscount: 0,
  };

  return (
    <MainLayout>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          Báo cáo doanh thu & Thống kê (SCR-09)
        </Title>
        <Text type="secondary">
          FR-14: Thống kê doanh thu theo ca, phương thức thanh toán và top món bán chạy
        </Text>
      </div>

      <ReportFilterBar
        fromDate={fromDate}
        toDate={toDate}
        loading={loading}
        onChange={handleFilterChange}
      />

      <ReportSummaryCards
        summary={reportData?.summary || defaultSummary}
        loading={loading}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={10}>
          <ReportPaymentPie
            paymentMethods={reportData?.paymentMethods || []}
            loading={loading}
          />
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title="Top 5 món bán chạy nhất"
            variant="outlined"
            style={{ borderRadius: 8, height: "100%" }}
          >
            {loading && !reportData ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <ReportTopItemsTable
                topItems={reportData?.topItems || []}
                loading={loading}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="Bảng kê doanh thu theo ca làm việc"
        variant="outlined"
        style={{ borderRadius: 8, marginBottom: 24 }}
      >
        {loading && !reportData ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <ReportShiftTable
            shifts={reportData?.byShift || []}
            loading={loading}
          />
        )}
      </Card>
    </MainLayout>
  );
}
