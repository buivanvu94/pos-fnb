import React from "react";
import { Space, Typography, Tag, Button, Tooltip, Popconfirm } from "antd";
import { MinusOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import type { OrderItemDetail } from "@/server/orders/order-service";

const { Text } = Typography;

interface CartColumnsParams {
  loading: boolean;
  onQuantityChange: (item: OrderItemDetail, newQty: number) => void;
  onDeleteItem: (item: OrderItemDetail) => void;
  onCancelKitchenItem?: (item: OrderItemDetail) => void;
}

export function buildOrderCartColumns({
  loading,
  onQuantityChange,
  onDeleteItem,
  onCancelKitchenItem,
}: CartColumnsParams) {
  return [
    {
      title: "Món ăn",
      key: "name",
      render: (_: any, record: OrderItemDetail) => (
        <Space direction="vertical" size={2} style={{ maxWidth: 170 }}>
          <Space size={4} wrap>
            <Text strong style={{ fontSize: 13 }}>{record.menuItemName}</Text>
            {record.isPrintedKitchen ? (
              <Tag color="cyan" style={{ fontSize: 10, padding: "0 4px", lineHeight: "16px" }}>Bếp</Tag>
            ) : (
              <Tag color="orange" style={{ fontSize: 10, padding: "0 4px", lineHeight: "16px" }}>Mới</Tag>
            )}
          </Space>
          {record.toppings.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              +{record.toppings.map((t) => t.toppingName).join(", ")}
            </Text>
          )}
          {record.notes && (
            <Text type="secondary" italic style={{ fontSize: 11, color: "#fa8c16", display: "block" }}>
              *{record.notes}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "SL",
      key: "quantity",
      width: 95,
      render: (_: any, record: OrderItemDetail) => (
        <Space size={3}>
          <Button
            size="small"
            aria-label={`Giảm số lượng ${record.menuItemName}`}
            icon={<MinusOutlined style={{ fontSize: 10 }} />}
            disabled={record.isPrintedKitchen || loading}
            onClick={() => onQuantityChange(record, record.quantity - 1)}
            style={{ width: 24, height: 24, minWidth: 24, padding: 0 }}
          />
          <Text strong style={{ minWidth: 20, textAlign: "center", display: "inline-block", fontSize: 13 }}>
            {record.quantity}
          </Text>
          <Button
            size="small"
            aria-label={`Tăng số lượng ${record.menuItemName}`}
            icon={<PlusOutlined style={{ fontSize: 10 }} />}
            disabled={record.isPrintedKitchen || loading}
            onClick={() => onQuantityChange(record, record.quantity + 1)}
            style={{ width: 24, height: 24, minWidth: 24, padding: 0 }}
          />
        </Space>
      ),
    },
    {
      title: "Tiền",
      key: "total",
      width: 80,
      align: "right" as const,
      render: (_: any, record: OrderItemDetail) => (
        <Text strong style={{ color: "#d4380d", fontSize: 13 }}>
          {formatVnd(record.totalItemPrice)}
        </Text>
      ),
    },
    {
      title: "",
      key: "action",
      width: 36,
      align: "center" as const,
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
            title="Xóa món này?"
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
}
