"use client";

import React, { use } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { PaymentPanel } from "@/components/payment/payment-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Truy cập trực tiếp bằng URL (F5, liên kết); luồng bán hàng dùng PaymentModal. */
export default function PaymentPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = Number(resolvedParams.id);
  const router = useRouter();

  return (
    <MainLayout>
      <PaymentPanel
        orderId={orderId}
        onCancel={() => router.back()}
        onBack={(orderType) => router.push(orderType === "MANG_VE" ? "/counter" : "/tables")}
      />
    </MainLayout>
  );
}
