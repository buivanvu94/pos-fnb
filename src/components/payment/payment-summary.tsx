import React from "react";
import { Card, Descriptions, Typography, Tag, Statistic } from "antd";
import { formatVnd } from "@/lib/money";
import type { OrderDetail } from "@/server/orders/order-service";

const { Text } = Typography;

interface PaymentSummaryProps {
  order: OrderDetail;
}

export function PaymentSummary({ order }: PaymentSummaryProps) {
  const isTakeaway = order.orderType === "MANG_VE";

  return (
    <Card title="Chi tiết đơn hàng" style={{ borderRadius: 8, height: "100%" }}>
      <Descriptions column={1} size="middle" bordered>
        <Descriptions.Item label="Mã hóa đơn">
          <Text strong copyable>{order.orderCode}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Hình thức phục vụ">
          {isTakeaway ? (
            <Tag color="purple">Mang về (Takeaway)</Tag>
          ) : (
            <Tag color="blue">Tại bàn: {order.tableName ?? `Bàn ${order.tableId}`}</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Số lượng món">
          <Text>{order.items.filter((i) => !i.isCancelled).length} món</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Tổng tiền hàng">
          <Text>{formatVnd(order.totalAmount)}</Text>
        </Descriptions.Item>
        {order.discountAmount > 0 && (
          <Descriptions.Item label="Giảm giá / Chiết khấu">
            <Text type="danger">-{formatVnd(order.discountAmount)}</Text>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Khách cần trả">
          <Statistic
            value={order.finalAmount}
            formatter={(val) => formatVnd(Number(val))}
            valueStyle={{ color: "#cf1322", fontWeight: 700, fontSize: 24 }}
          />
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
