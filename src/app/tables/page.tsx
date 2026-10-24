"use client";

import React, { useState, useEffect } from "react";
import { Typography, Space, Tag, Alert, Spin, App, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { MainLayout } from "@/components/main-layout";
import { TableGrid } from "@/components/ordering/table-grid";
import { OrderingView } from "@/components/ordering/ordering-view";
import { useTablePolling } from "@/components/ordering/use-table-polling";
import type { TableWithOrderInfo } from "@/server/tables/table-service";

const { Title, Text } = Typography;

export default function TablesPage() {
  const { message } = App.useApp();

  // Active table in ordering mode
  const [selectedTable, setSelectedTable] = useState<TableWithOrderInfo | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [openingOrder, setOpeningOrder] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pause background table polling while actively taking orders in OrderingView
  const isTableGridView = !selectedTable || !activeOrderId;
  const { tables, loading, error, refresh } = useTablePolling(5000, isTableGridView);

  const handleSelectTable = async (table: TableWithOrderInfo) => {
    if (table.status === "TRONG") {
      // Empty table: open a new order
      setOpeningOrder(true);
      try {
        const res = await fetch("/api/v1/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: table.id }),
        });
        const data = await res.json();

        if (data.ok && data.data) {
          setSelectedTable(table);
          setActiveOrderId(data.data.id);
          refresh();
        } else {
          message.error(data.error || "Không thể tạo đơn hàng mới cho bàn");
        }
      } catch {
        message.error("Lỗi kết nối khi mở đơn hàng");
      } finally {
        setOpeningOrder(false);
      }
    } else {
      // Occupied or waiting payment table: open existing order
      if (table.activeOrderId) {
        setSelectedTable(table);
        setActiveOrderId(table.activeOrderId);
      } else {
        message.warning("Bàn đang được phục vụ nhưng chưa có đơn hàng liên kết");
      }
    }
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setActiveOrderId(null);
    refresh();
  };

  return (
    <MainLayout>
      {selectedTable && activeOrderId ? (
        <OrderingView
          table={selectedTable}
          orderId={activeOrderId}
          allTables={tables}
          onBackToTables={handleBackToTables}
          onTableStatusChanged={refresh}
        />
      ) : (
        <div>
          <div
            style={{
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Sơ đồ bàn & Trạng thái phòng
              </Title>
              <Text type="secondary">
                Bàn trống (Xanh lá), Đang phục vụ (Đỏ), Chờ thanh toán (Vàng)
              </Text>
            </div>

            <Space size="middle" wrap>
              <Tag color="success">🟢 Trống</Tag>
              <Tag color="error">🔴 Đang phục vụ</Tag>
              <Tag color="warning">🟡 Chờ thanh toán</Tag>
              <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
                Làm mới
              </Button>
            </Space>
          </div>

          {error && (
            <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
          )}

          {!mounted || loading || openingOrder ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: "#8c8c8c" }}>
                {openingOrder ? "Đang mở đơn hàng cho bàn..." : "Đang tải dữ liệu bàn..."}
              </div>
            </div>
          ) : (
            <TableGrid
              tables={tables}
              selectedTableId={selectedTable?.id}
              onSelectTable={handleSelectTable}
            />
          )}
        </div>
      )}
    </MainLayout>
  );
}
