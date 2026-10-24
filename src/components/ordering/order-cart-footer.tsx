import React from "react";
import { Button, Space, Typography, Statistic, Popconfirm } from "antd";
import {
  SendOutlined,
  PrinterOutlined,
  CreditCardOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";

const { Text } = Typography;

interface OrderCartFooterProps {
  order: OrderDetail | null;
  items: OrderItemDetail[];
  loading?: boolean;
  sendingKitchen?: boolean;
  provisionalLoading?: boolean;
  canDiscountOrCancel?: boolean;
  onSendKitchen: () => void;
  onOpenDiscountModal?: () => void;
  onCancelOrder?: () => void;
  onCancelOrderWithItems?: () => void;
  onPrintProvisional?: () => void;
  onNavigatePayment?: () => void;
}

export function OrderCartFooter({
  order,
  items,
  loading = false,
  sendingKitchen = false,
  provisionalLoading = false,
  canDiscountOrCancel = false,
  onSendKitchen,
  onOpenDiscountModal,
  onCancelOrder,
  onCancelOrderWithItems,
  onPrintProvisional,
  onNavigatePayment,
}: OrderCartFooterProps) {
  const unprintedItems = items.filter((i) => !i.isPrintedKitchen);
  const hasUnprinted = unprintedItems.length > 0;
  const finalAmount = order?.finalAmount ?? order?.totalAmount ?? 0;

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid #f0f0f0",
        paddingTop: 12,
        marginTop: "auto",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          background: "#fafafa",
          padding: "10px 14px",
          borderRadius: 8,
          marginBottom: 12,
          border: "1px solid #f0f0f0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>Tổng tiền hàng:</Text>
          <Text strong style={{ fontSize: 14 }}>{formatVnd(order?.totalAmount ?? 0)}</Text>
        </div>
        {(order?.discountAmount ?? 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <Text type="danger" style={{ fontSize: 13 }}>Giảm giá:</Text>
            <Text strong type="danger" style={{ fontSize: 14 }}>-{formatVnd(order?.discountAmount ?? 0)}</Text>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4, borderTop: "1px dashed #e8e8e8", paddingTop: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: 700, color: "#262626" }}>Khách cần trả:</Text>
          <Statistic
            value={finalAmount}
            formatter={(val) => formatVnd(Number(val))}
            valueStyle={{ color: "#cf1322", fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}
          />
        </div>
      </div>

      <Space direction="vertical" style={{ width: "100%" }} size={8}>
        <Button
          type="primary"
          size="large"
          block
          icon={<SendOutlined />}
          loading={sendingKitchen}
          disabled={!hasUnprinted || loading}
          onClick={onSendKitchen}
          style={{ height: 42, fontWeight: 600, fontSize: 15 }}
        >
          {hasUnprinted ? `Gửi Bếp (${unprintedItems.length} món)` : "Đã gửi hết bếp"}
        </Button>

        <div style={{ display: "grid", gridTemplateColumns: canDiscountOrCancel ? "1fr 1fr" : "1fr", gap: 8 }}>
          <Button
            size="middle"
            icon={<PrinterOutlined />}
            loading={provisionalLoading}
            disabled={!order || items.length === 0 || loading}
            onClick={onPrintProvisional}
            style={{ height: 38 }}
          >
            In tạm tính
          </Button>

          {canDiscountOrCancel && (
            <Button
              size="middle"
              icon={<PercentageOutlined />}
              disabled={!order || order.totalAmount === 0 || loading}
              onClick={onOpenDiscountModal}
              style={{ height: 38 }}
            >
              Giảm giá
            </Button>
          )}
        </div>

        {canDiscountOrCancel && (
          <Button
            type="primary"
            size="large"
            block
            icon={<CreditCardOutlined style={{ fontSize: 18 }} />}
            disabled={!order || items.length === 0 || finalAmount <= 0 || loading}
            onClick={onNavigatePayment}
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 700,
              backgroundColor: finalAmount > 0 ? "#52c41a" : undefined,
              borderColor: finalAmount > 0 ? "#52c41a" : undefined,
              boxShadow: finalAmount > 0 ? "0 4px 12px rgba(82, 196, 26, 0.3)" : undefined,
            }}
          >
            Thanh toán ({formatVnd(finalAmount)})
          </Button>
        )}

        {items.length === 0 && onCancelOrder && (
          <Popconfirm title="Hủy đơn hàng trống này?" okText="Hủy đơn" cancelText="Không" onConfirm={onCancelOrder}>
            <Button type="dashed" danger block size="small" disabled={loading} style={{ marginTop: 2 }}>
              Hủy đơn hàng trống
            </Button>
          </Popconfirm>
        )}

        {items.length > 0 && canDiscountOrCancel && onCancelOrderWithItems && (
          <Button type="text" danger block size="small" disabled={loading} onClick={onCancelOrderWithItems} style={{ marginTop: 2 }}>
            Hủy đơn hàng này
          </Button>
        )}
      </Space>
    </div>
  );
}
