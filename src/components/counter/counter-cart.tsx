import React from "react";
import { Card, Table, Button, Space, Typography, Statistic, Tag, Popconfirm } from "antd";
import {
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined,
  CreditCardOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";

const { Text } = Typography;

interface CounterCartProps {
  order: OrderDetail | null;
  loading: boolean;
  onQuantityChange: (item: OrderItemDetail, newQty: number) => void;
  onDeleteItem: (item: OrderItemDetail) => void;
  onCheckout: () => void;
  onClearCart: () => void;
}

export function CounterCart({
  order,
  loading,
  onQuantityChange,
  onDeleteItem,
  onCheckout,
  onClearCart,
}: CounterCartProps) {
  const items = order?.items?.filter((i) => !i.isCancelled) ?? [];
  const finalAmount = order?.finalAmount ?? 0;

  const columns = [
    {
      title: "Món ăn",
      key: "name",
      render: (_: any, record: OrderItemDetail) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.menuItemName}</Text>
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
      title: "Số lượng",
      key: "quantity",
      width: 150,
      render: (_: any, record: OrderItemDetail) => (
        <Space size={4}>
          <Button
            size="small"
            aria-label={`Giảm số lượng ${record.menuItemName}`}
            icon={<MinusOutlined />}
            disabled={loading}
            onClick={() => onQuantityChange(record, record.quantity - 1)}
          />
          <Text strong style={{ minWidth: 20, textAlign: "center", display: "inline-block" }}>
            {record.quantity}
          </Text>
          <Button
            size="small"
            aria-label={`Tăng số lượng ${record.menuItemName}`}
            icon={<PlusOutlined />}
            disabled={loading}
            onClick={() => onQuantityChange(record, record.quantity + 1)}
          />
        </Space>
      ),
    },
    {
      title: "Thành tiền",
      key: "totalPrice",
      width: 100,
      align: "right" as const,
      render: (_: any, record: OrderItemDetail) => (
        <Text strong>{formatVnd(record.totalItemPrice)}</Text>
      ),
    },
    {
      title: "",
      key: "action",
      width: 56,
      render: (_: any, record: OrderItemDetail) => (
        <Button
          type="text"
          danger
          size="small"
          aria-label={`Xóa ${record.menuItemName} khỏi giỏ`}
          icon={<DeleteOutlined />}
          disabled={loading}
          onClick={() => onDeleteItem(record)}
        />
      ),
    },
  ];

  return (
    <Card
      title={
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <span>Giỏ hàng mang về</span>
          {order && (
            <Tag color="purple">Đơn: {order.orderCode}</Tag>
          )}
        </Space>
      }
      extra={
        items.length > 0 && (
          <Popconfirm title="Xóa toàn bộ giỏ hàng?" onConfirm={onClearCart}>
            <Button type="text" danger size="small" icon={<ClearOutlined />}>
              Xóa hết
            </Button>
          </Popconfirm>
        )
      }
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
      styles={{ body: { flex: 1, display: "flex", flexDirection: "column", padding: "16px 16px 12px 16px", overflow: "hidden" } }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", marginBottom: 12 }}>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
          scroll={{ y: "calc(100vh - 380px)" }}
          locale={{ emptyText: "Giỏ hàng mang về đang trống. Chọn món để bắt đầu." }}
        />
      </div>

      <div style={{ flexShrink: 0, borderTop: "1px solid #f0f0f0", paddingTop: 12, marginTop: "auto" }}>
        <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: 8, marginBottom: 12, border: "1px solid #f0f0f0" }}>
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

        <Button
          type="primary"
          size="large"
          block
          style={{
            height: 48,
            fontSize: 16,
            fontWeight: 700,
            backgroundColor: finalAmount > 0 ? "#52c41a" : undefined,
            borderColor: finalAmount > 0 ? "#52c41a" : undefined,
            boxShadow: finalAmount > 0 ? "0 4px 12px rgba(82, 196, 26, 0.3)" : undefined,
          }}
          icon={<CreditCardOutlined style={{ fontSize: 18 }} />}
          loading={loading}
          disabled={!order || items.length === 0 || finalAmount <= 0}
          onClick={onCheckout}
        >
          Thanh toán nhanh ({formatVnd(finalAmount)})
        </Button>
      </div>
    </Card>
  );
}
