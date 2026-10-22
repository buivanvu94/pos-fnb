"use client";

import { useState, useEffect, useCallback } from "react";
import { App } from "antd";
import type { OrderDetail } from "@/server/orders/order-service";

export function usePaymentOrder(orderId: number) {
  const { message } = App.useApp();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [printPickupTicket, setPrintPickupTicket] = useState(true);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`);
      const data = await res.json();
      if (data.ok && data.data) {
        setOrder(data.data);
        setCashGiven(data.data.finalAmount);
      } else {
        message.error(data.error || "Không thể tải thông tin đơn hàng");
      }
    } catch {
      message.error("Lỗi kết nối khi tải chi tiết hóa đơn");
    } finally {
      setLoading(false);
    }
  }, [orderId, message]);

  useEffect(() => {
    if (orderId > 0) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  const handleCashPayment = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/payments/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          tienKhachDua: cashGiven,
          expectedVersion: order.version,
          printPickupTicket,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        message.success("Thanh toán tiền mặt thành công!");
        setPaymentSuccessData(data);
      } else {
        message.error(data.error || "Thanh toán thất bại");
      }
    } catch {
      message.error("Lỗi kết nối khi gửi yêu cầu thanh toán");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    order,
    loading,
    cashGiven,
    setCashGiven,
    submitting,
    printPickupTicket,
    setPrintPickupTicket,
    paymentSuccessData,
    setPaymentSuccessData,
    fetchOrder,
    handleCashPayment,
  };
}
