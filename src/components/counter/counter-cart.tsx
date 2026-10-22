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
      width: 120,
      render: (_: any, record: OrderItemDetail) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<MinusOutlined />}
            disabled={loading}
            onClick={() => onQuantityChange(record, record.quantity - 1)}
          />
          <Text strong style={{ minWidth: 20, textAlign: "center", display: "inline-block" }}>
            {record.quantity}
          </Text>
          <Button
            size="small"
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
      width: 48,
      render: (_: any, record: OrderItemDetail) => (
        <Button
          type="text"
          danger
          size="small"
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
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 16px" }}
    >
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
          locale={{ emptyText: "Giỏ hàng mang về đang trống. Chọn món để bắt đầu." }}
        />
      </div>

      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: 600 }}>Khách cần trả:</Text>
          <Statistic
            value={finalAmount}
            formatter={(val) => formatVnd(Number(val))}
            valueStyle={{ color: "#cf1322", fontWeight: 700, fontSize: 24 }}
          />
        </div>

        <Button
          type="primary"
          size="large"
          block
          style={{ height: 48, fontSize: 16, backgroundColor: "#52c41a", borderColor: "#52c41a" }}
          icon={<CreditCardOutlined />}
          loading={loading}
          onClick={onCheckout}
        >
          Thanh toán nhanh
        </Button>
      </div>
    </Card>
  );
}
