import React, { useState, useEffect } from "react";
import { Drawer, Form, Input, Checkbox, Button, Typography, Space, Divider } from "antd";
import { formatVnd } from "@/lib/money";

const { Text, Title } = Typography;

export interface ToppingOption {
  id: number;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface ItemCustomizerProps {
  open: boolean;
  menuItem: {
    id: number;
    name: string;
    price: number;
  } | null;
  initialQuantity?: number;
  initialNotes?: string;
  initialToppingIds?: number[];
  availableToppings: ToppingOption[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    menuItemId: number;
    quantity: number;
    notes: string;
    toppingIds: number[];
  }) => void;
}

export function ItemCustomizerDrawer({
  open,
  menuItem,
  initialQuantity = 1,
  initialNotes = "",
  initialToppingIds = [],
  availableToppings,
  loading = false,
  onClose,
  onConfirm,
}: ItemCustomizerProps) {
  const [selectedToppingIds, setSelectedToppingIds] = useState<number[]>(initialToppingIds);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [quantity, setQuantity] = useState<number>(initialQuantity);

  useEffect(() => {
    if (open) {
      setSelectedToppingIds(initialToppingIds);
      setNotes(initialNotes);
      setQuantity(initialQuantity > 0 ? initialQuantity : 1);
    }
  }, [open, initialNotes, initialQuantity, initialToppingIds]);

  if (!menuItem) return null;

  const toppingTotal = availableToppings
    .filter((t) => selectedToppingIds.includes(t.id))
    .reduce((sum, t) => sum + t.price, 0);

  const unitTotal = menuItem.price + toppingTotal;
  const grandTotal = unitTotal * quantity;

  const handleConfirm = () => {
    onConfirm({
      menuItemId: menuItem.id,
      quantity,
      notes: notes.trim(),
      toppingIds: selectedToppingIds,
    });
  };

  return (
    <Drawer
      title="Tùy chọn món ăn & khẩu vị"
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Tạm tính:
            </Text>
            <br />
            <Text strong style={{ fontSize: 18, color: "#d4380d" }}>
              {formatVnd(grandTotal)}
            </Text>
          </div>
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" loading={loading} onClick={handleConfirm}>
              Thêm vào đơn
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {menuItem.name}
        </Title>
        <Text strong style={{ fontSize: 16, color: "#1677ff" }}>
          Đơn giá gốc: {formatVnd(menuItem.price)}
        </Text>
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <div style={{ marginBottom: 20 }}>
        <Title level={5} style={{ marginBottom: 12 }}>
          Món ăn kèm (Topping)
        </Title>
        {availableToppings.length === 0 ? (
          <Text type="secondary">Chưa có topping khả dụng</Text>
        ) : (
          <Checkbox.Group
            value={selectedToppingIds}
            onChange={(values) => setSelectedToppingIds(values as number[])}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              {availableToppings.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#fafafa",
                    borderRadius: 6,
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <Checkbox value={t.id} disabled={!t.isAvailable}>
                    {t.name}
                  </Checkbox>
                  <Text type="secondary">+{formatVnd(t.price)}</Text>
                </div>
              ))}
            </Space>
          </Checkbox.Group>
        )}
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <Form layout="vertical">
        <Form.Item
          label="Ghi chú chế biến (tối đa 100 ký tự)"
          extra="Ví dụ: Ít ngọt, nhiều đá, không hành..."
        >
          <Input.TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={100}
            showCount
            rows={3}
            placeholder="Nhập yêu cầu đặc biệt của khách hàng..."
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
