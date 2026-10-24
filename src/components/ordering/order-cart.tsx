import React from "react";
import { Card, Button, Typography, Table } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";
import { OrderCartFooter } from "./order-cart-footer";
import { buildOrderCartColumns } from "./order-cart-columns";

const { Text, Title } = Typography;

interface OrderCartProps {
  order: OrderDetail | null;
  tableName?: string;
  loading?: boolean;
  sendingKitchen?: boolean;
  provisionalLoading?: boolean;
  userRole?: string;
  onQuantityChange: (item: OrderItemDetail, newQty: number) => void;
  onDeleteItem: (item: OrderItemDetail) => void;
  onCancelKitchenItem?: (item: OrderItemDetail) => void;
  onOpenDiscountModal?: () => void;
  onSendKitchen: () => void;
  onOpenTransferModal: () => void;
  onCancelOrder?: () => void;
  onCancelOrderWithItems?: () => void;
  onPrintProvisional?: () => void;
  onNavigatePayment?: () => void;
}

export function OrderCart({
  order,
  tableName,
  loading = false,
  sendingKitchen = false,
  provisionalLoading = false,
  userRole,
  onQuantityChange,
  onDeleteItem,
  onCancelKitchenItem,
  onOpenDiscountModal,
  onSendKitchen,
  onOpenTransferModal,
  onCancelOrder,
  onCancelOrderWithItems,
  onPrintProvisional,
  onNavigatePayment,
}: OrderCartProps) {
  const items = order?.items ?? [];
  const canDiscountOrCancel = userRole === "QUAN_LY" || userRole === "THU_NGAN";

  const columns = buildOrderCartColumns({
    loading,
    onQuantityChange,
    onDeleteItem,
    onCancelKitchenItem,
  });

  return (
    <Card
      style={{
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        maxHeight: "calc(100vh - 120px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        position: "sticky",
        top: 80,
      }}
      styles={{
        body: {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "16px 16px 12px 16px",
          overflow: "hidden",
        },
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 17, color: "#1677ff" }}>
            {tableName || (order?.tableId ? `Bàn ${order.tableId}` : "Chi tiết đơn hàng")}
          </Title>
          {order?.orderCode && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Mã: {order.orderCode} (v{order.version})
            </Text>
          )}
        </div>
        <Button size="small" icon={<SwapOutlined />} onClick={onOpenTransferModal}>
          Chuyển / Gộp
        </Button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", marginBottom: 8 }}>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ y: "calc(100vh - 460px)" }}
          locale={{ emptyText: "Chưa có món nào được chọn" }}
        />
      </div>

      <OrderCartFooter
        order={order}
        items={items}
        loading={loading}
        sendingKitchen={sendingKitchen}
        provisionalLoading={provisionalLoading}
        canDiscountOrCancel={canDiscountOrCancel}
        onSendKitchen={onSendKitchen}
        onOpenDiscountModal={onOpenDiscountModal}
        onCancelOrder={onCancelOrder}
        onCancelOrderWithItems={onCancelOrderWithItems}
        onPrintProvisional={onPrintProvisional}
        onNavigatePayment={onNavigatePayment}
      />
    </Card>
  );
}
