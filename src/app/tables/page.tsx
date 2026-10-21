"use client";

import React, { useEffect, useState } from "react";
import { Row, Col, Card, Badge, Typography, Tag, Space, Spin } from "antd";
import { MainLayout } from "@/components/main-layout";
import { TABLE_STATUS_COLORS } from "@/theme/theme-config";

const { Title, Text } = Typography;

interface TableItem {
  id: number;
  code: string;
  name: string;
  capacity: number;
  status: "TRONG" | "DANG_DUNG" | "CHO_THANH_TOAN";
}

export default function TablesPage() {
  const [tablesList, setTablesList] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated table list for Phase 01 foundation verification
    const sampleTables: TableItem[] = [
      { id: 1, code: "BAN-01", name: "Bàn 01", capacity: 4, status: "TRONG" },
      { id: 2, code: "BAN-02", name: "Bàn 02", capacity: 4, status: "DANG_DUNG" },
      { id: 3, code: "BAN-03", name: "Bàn 03", capacity: 4, status: "CHO_THANH_TOAN" },
      { id: 4, code: "BAN-04", name: "Bàn 04", capacity: 4, status: "TRONG" },
      { id: 5, code: "BAN-05", name: "Bàn 05", capacity: 6, status: "TRONG" },
      { id: 6, code: "BAN-06", name: "Bàn 06", capacity: 6, status: "DANG_DUNG" },
    ];
    setTablesList(sampleTables);
    setLoading(false);
  }, []);

  const statusLabelMap = {
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

      {loading ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {tablesList.map((t) => (
            <Col xs={12} sm={8} md={6} lg={4} key={t.id}>
              <Card
                hoverable
                style={{
                  borderTop: `4px solid ${statusLabelMap[t.status].color}`,
                  textAlign: "center",
                  borderRadius: 8,
                }}
              >
                <Title level={4} style={{ marginBottom: 4 }}>
                  {t.name}
                </Title>
                <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                  Sức chứa: {t.capacity} người
                </Text>
                <Badge
                  color={statusLabelMap[t.status].color}
                  text={<span style={{ fontWeight: 600 }}>{statusLabelMap[t.status].label}</span>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </MainLayout>
  );
}
