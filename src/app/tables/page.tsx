"use client";

import React, { useEffect, useState } from "react";
import { Row, Col, Card, Badge, Typography, Tag, Space, Spin, Empty, Alert } from "antd";
import { MainLayout } from "@/components/main-layout";
import { TABLE_STATUS_COLORS } from "@/theme/theme-config";

const { Title, Text } = Typography;

interface TableItem {
  id: number;
  code: string;
  name: string;
  capacity: number;
  status: "TRONG" | "DANG_DUNG" | "CHO_THANH_TOAN";
  areaId: number;
  areaName: string | null;
}

export default function TablesPage() {
  const [tablesList, setTablesList] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/tables")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data?.ok && Array.isArray(data.data)) {
          setTablesList(data.data);
        } else {
          setTablesList([]);
        }
      })
      .catch((err) => {
        setFetchError("Không thể tải danh sách bàn từ máy chủ");
        console.error("Error loading tables:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const statusLabelMap: Record<
    "TRONG" | "DANG_DUNG" | "CHO_THANH_TOAN",
    { label: string; color: string }
  > = {
    TRONG: { label: "Bàn trống", color: TABLE_STATUS_COLORS.TRONG },
    DANG_DUNG: { label: "Đang phục vụ", color: TABLE_STATUS_COLORS.DANG_DUNG },
    CHO_THANH_TOAN: { label: "Chờ thanh toán", color: TABLE_STATUS_COLORS.CHO_THANH_TOAN },
  };

  return (
    <MainLayout>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Sơ đồ bàn & Trạng thái phòng
          </Title>
          <Text type="secondary">Màu sắc chuẩn FR-01: Bàn trống (Xanh), Đang phục vụ (Đỏ), Chờ thanh toán (Vàng)</Text>
        </div>

        <Space size="middle">
          <Tag color="success">🟢 Trống</Tag>
          <Tag color="error">🔴 Đang phục vụ</Tag>
          <Tag color="warning">🟡 Chờ thanh toán</Tag>
        </Space>
      </div>

      {fetchError && (
        <Alert
          message={fetchError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : tablesList.length === 0 ? (
        <Card style={{ borderRadius: 8, padding: 32 }}>
          <Empty description="Chưa có dữ liệu bàn nào trong hệ thống" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {tablesList.map((t) => {
            const statusConfig = statusLabelMap[t.status] ?? statusLabelMap.TRONG;
            return (
              <Col xs={12} sm={8} md={6} lg={4} key={t.id}>
                <Card
                  hoverable
                  style={{
                    borderTop: `4px solid ${statusConfig.color}`,
                    textAlign: "center",
                    borderRadius: 8,
                  }}
                >
                  <Title level={4} style={{ marginBottom: 4 }}>
                    {t.name}
                  </Title>
                  <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                    {t.areaName ?? "Chưa phân khu"}
                  </Text>
                  <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 13 }}>
                    Sức chứa: {t.capacity} người
                  </Text>
                  <Badge
                    color={statusConfig.color}
                    text={<span style={{ fontWeight: 600 }}>{statusConfig.label}</span>}
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </MainLayout>
  );
}
