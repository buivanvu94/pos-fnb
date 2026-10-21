import React from "react";
import { Card, Table, Button, Space, Typography, Statistic, Tooltip, Tag, Popconfirm } from "antd";
import { PlusOutlined, MinusOutlined, DeleteOutlined, SendOutlined, SwapOutlined, PrinterOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import type { OrderDetail, OrderItemDetail } from "@/server/orders/order-service";

const { Text, Title } = Typography;

interface OrderCartProps {
  order: OrderDetail | null;
  tableName?: string;
  loading?: boolean;
  sendingKitchen?: boolean;
  onQuantityChange: (item: OrderItemDetail, newQty: number) => void;
  onDeleteItem: (item: OrderItemDetail) => void;
  onSendKitchen: () => void;
  onOpenTransferModal: () => void;
  onCancelOrder?: () => void;
}

export function OrderCart({
  order,
  tableName,
  loading = false,
  sendingKitchen = false,
  onQuantityChange,
  onDeleteItem,
  onSendKitchen,
  onOpenTransferModal,
  onCancelOrder,
}: OrderCartProps) {
  const items = order?.items ?? [];
  const hasUnprintedItems = items.some((i) => !i.isPrintedKitchen);

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
      width: 105,
      render: (_: any, record: OrderItemDetail) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<MinusOutlined />}
            disabled={record.isPrintedKitchen || loading}
            onClick={() => onQuantityChange(record, record.quantity - 1)}
          />
          <Text strong style={{ minWidth: 20, textAlign: "center", display: "inline-block" }}>
            {record.quantity}
          </Text>
          <Button
            size="small"
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
      width: 45,
      render: (_: any, record: OrderItemDetail) =>
        record.isPrintedKitchen ? null : (
          <Popconfirm
            title="Xóa món này khỏi đơn?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => onDeleteItem(record)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
    },
  ];

  return (
    <Card
      style={{
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      bodyStyle={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: 16,
      }}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <Text style={{ fontSize: 16 }}>Tổng thanh toán:</Text>
          <Statistic
            value={order?.totalAmount ?? 0}
            formatter={(val) => formatVnd(Number(val))}
            valueStyle={{ color: "#cf1322", fontWeight: 700, fontSize: 24 }}
          />
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

          {items.length === 0 && onCancelOrder && (
            <Popconfirm
              title="Hủy đơn hàng trống này?"
              okText="Hủy đơn"
              cancelText="Không"
              onConfirm={onCancelOrder}
            >
              <Button danger block disabled={loading}>
                Hủy đơn hàng trống
              </Button>
            </Popconfirm>
          )}

          <Tooltip title="Chức năng thanh toán và in tạm tính sẽ mở ở Phase 07">
            <Button
              size="large"
              block
              disabled
              icon={<PrinterOutlined />}
            >
              In tạm tính
            </Button>
          </Tooltip>
        </Space>
      </div>
    </Card>
  );
}
