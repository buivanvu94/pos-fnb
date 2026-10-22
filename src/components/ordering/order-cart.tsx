import React from "react";
import { Card, Table, Button, Space, Typography, Statistic, Tooltip, Tag, Popconfirm } from "antd";
import {
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined,
  SendOutlined,
  SwapOutlined,
  PrinterOutlined,
  PercentageOutlined,
  CreditCardOutlined,
} from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";

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
  const hasUnprintedItems = items.some((i) => !i.isPrintedKitchen);
  const canDiscountOrCancel = userRole === "QUAN_LY" || userRole === "THU_NGAN";

  const columns = [
    {
      title: "Món ăn / Khẩu vị",
      key: "name",
      render: (_: any, record: OrderItemDetail) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Text strong>{record.menuItemName}</Text>
            {record.isPrintedKitchen ? (
              <Tag color="cyan">Đã gửi bếp</Tag>
            ) : (
              <Tag color="orange">Chưa gửi</Tag>
            )}
          </Space>
          {record.toppings.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Topping: {record.toppings.map((t) => t.toppingName).join(", ")}
            </Text>
          )}
          {record.notes && (
            <Text type="secondary" italic style={{ fontSize: 12 }}>
              Ghi chú: {record.notes}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "SL",
      key: "quantity",
      width: 150,
      render: (_: any, record: OrderItemDetail) => (
        <Space size={4}>
          <Button
            size="small"
            aria-label={`Giảm số lượng ${record.menuItemName}`}
            icon={<MinusOutlined />}
            disabled={record.isPrintedKitchen || loading}
            onClick={() => onQuantityChange(record, record.quantity - 1)}
          />
          <Text strong style={{ minWidth: 20, textAlign: "center", display: "inline-block" }}>
            {record.quantity}
          </Text>
          <Button
            size="small"
            aria-label={`Tăng số lượng ${record.menuItemName}`}
            icon={<PlusOutlined />}
            disabled={record.isPrintedKitchen || loading}
            onClick={() => onQuantityChange(record, record.quantity + 1)}
          />
        </Space>
      ),
    },
    {
      title: "Tiền",
      key: "total",
      width: 95,
      align: "right" as const,
      render: (_: any, record: OrderItemDetail) => (
        <Text strong style={{ color: "#d4380d" }}>
          {formatVnd(record.totalItemPrice)}
        </Text>
      ),
    },
    {
      title: "",
      key: "action",
      width: 56,
      render: (_: any, record: OrderItemDetail) =>
        record.isPrintedKitchen ? (
          <Tooltip title="Hủy món đã gửi bếp">
            <Button
              size="small"
              type="text"
              danger
              aria-label={`Hủy món đã gửi bếp ${record.menuItemName}`}
              icon={<DeleteOutlined />}
              onClick={() => onCancelKitchenItem?.(record)}
            />
          </Tooltip>
        ) : (
          <Popconfirm
            title="Xóa món này khỏi đơn?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => onDeleteItem(record)}
          >
            <Button
              size="small"
              type="text"
              danger
              aria-label={`Xóa ${record.menuItemName} khỏi đơn`}
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        ),
    },
  ];

  return (
    <Card
      style={{ borderRadius: 8, display: "flex", flexDirection: "column", height: "100%" }}
      bodyStyle={{ display: "flex", flexDirection: "column", height: "100%", padding: 16 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {tableName || (order?.tableId ? `Bàn ${order.tableId}` : "Chi tiết đơn hàng")}
          </Title>
          {order?.orderCode && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              Mã: {order.orderCode} (v{order.version})
            </Text>
          )}
        </div>
        <Button icon={<SwapOutlined />} onClick={onOpenTransferModal}>
          Chuyển / Gộp
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: "Chưa có món nào được chọn" }}
        />
      </div>

      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <Text>Tổng tiền:</Text>
            <Text strong>{formatVnd(order?.totalAmount ?? 0)}</Text>
          </div>
          {(order?.discountAmount ?? 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <Text type="danger">Giảm giá:</Text>
              <Text strong type="danger">-{formatVnd(order?.discountAmount ?? 0)}</Text>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontSize: 16, fontWeight: 600 }}>Khách cần trả:</Text>
            <Statistic
              value={order?.finalAmount ?? order?.totalAmount ?? 0}
              formatter={(val) => formatVnd(Number(val))}
              valueStyle={{ color: "#cf1322", fontWeight: 700, fontSize: 22 }}
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
            disabled={!hasUnprintedItems || loading}
            onClick={onSendKitchen}
          >
            Gửi Bếp
          </Button>

          {canDiscountOrCancel && (
            <Button
              block
              icon={<PercentageOutlined />}
              disabled={!order || order.totalAmount === 0 || loading}
              onClick={onOpenDiscountModal}
            >
              Giảm giá
            </Button>
          )}

          {items.length === 0 && onCancelOrder && (
            <Popconfirm title="Hủy đơn hàng trống này?" okText="Hủy đơn" cancelText="Không" onConfirm={onCancelOrder}>
              <Button danger block disabled={loading}>Hủy đơn hàng trống</Button>
            </Popconfirm>
          )}

          {items.length > 0 && canDiscountOrCancel && onCancelOrderWithItems && (
            <Button danger block disabled={loading} onClick={onCancelOrderWithItems}>
              Hủy đơn hàng
            </Button>
          )}

          <Button
            size="large"
            block
            icon={<PrinterOutlined />}
            loading={provisionalLoading}
            disabled={!order || items.length === 0 || loading}
            onClick={onPrintProvisional}
          >
            In tạm tính
          </Button>

          {canDiscountOrCancel && (
            <Button
              type="primary"
              size="large"
              block
              style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
              icon={<CreditCardOutlined />}
              disabled={!order || items.length === 0 || order.finalAmount <= 0 || loading}
              onClick={onNavigatePayment}
            >
              Thanh toán
            </Button>
          )}
        </Space>
      </div>
    </Card>
  );
}
