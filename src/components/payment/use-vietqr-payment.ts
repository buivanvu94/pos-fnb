"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { App } from "antd";

interface UseVietQrPaymentParams {
  orderId: number;
  expectedVersion: number;
  onPaymentSuccess: (data: any) => void;
}

export function useVietQrPayment({
  orderId,
  expectedVersion,
  onPaymentSuccess,
}: UseVietQrPaymentParams) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [qrContent, setQrContent] = useState<string>("");
  const [transferContent, setTransferContent] = useState<string>("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const createQr = useCallback(async () => {
    setLoading(true);
    setIsExpired(false);
    try {
      const res = await fetch("/api/v1/payments/vietqr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, expectedVersion }),
      });
      const resJson = await res.json();
      if (resJson.ok && resJson.data) {
        setPaymentId(resJson.data.paymentId);
        setQrContent(resJson.data.qrContent);
        setTransferContent(resJson.data.transferContent);
        setDeadline(Date.now() + resJson.data.remainingSeconds * 1000);
      } else {
        message.error(resJson.error || "Không thể tạo mã VietQR");
      }
    } catch {
      message.error("Lỗi kết nối khi tạo mã VietQR");
    } finally {
      setLoading(false);
    }
  }, [orderId, expectedVersion, message]);

  useEffect(() => {
    createQr();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [createQr]);

  // Polling payment status every 2 seconds
  useEffect(() => {
    if (!paymentId || isExpired) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/payments/${paymentId}`);
        const resJson = await res.json();
        if (resJson.ok && resJson.data) {
          if (resJson.data.status === "SUCCESS") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            message.success("Nhận thanh toán VietQR thành công!");
            onPaymentSuccess({ data: resJson.data });
          } else if (resJson.data.status === "EXPIRED" || resJson.data.isExpired) {
            setIsExpired(true);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [paymentId, isExpired, onPaymentSuccess, message]);

  return {
    loading,
    paymentId,
    qrContent,
    transferContent,
    deadline,
    isExpired,
    setIsExpired,
    createQr,
  };
}
