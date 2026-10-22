"use client";

import React, { useState } from "react";
import { Card, Steps, Button, Typography, Space, App, Spin, Result } from "antd";
import { AuditOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { CloseShiftStatistics, ShiftStatsData } from "@/components/shift/close-shift-statistics";
import { CloseShiftCashForm } from "@/components/shift/close-shift-cash-form";
import { CloseShiftActions } from "@/components/shift/close-shift-actions";
import { ManagerApprovalModal } from "@/components/approval/manager-approval-modal";
import { formatErr05 } from "@/lib/error-catalog";
import { useCloseShiftData } from "@/components/shift/use-close-shift-data";

const { Title, Text } = Typography;

export default function CloseShiftPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const {
    loading,
    shiftData,
    setShiftData,
    actualCash,
    setActualCash,
    explanation,
    setExplanation,
    fetchShift,
  } = useCloseShiftData();

  const [submittingClose, setSubmittingClose] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const currentStep =
    !shiftData || shiftData.status === "DANG_MO"
      ? 0
      : shiftData.status === "CHO_DUYET"
      ? 1
      : 2;

  const isReadOnly = currentStep > 0;

  const handleCloseSubmit = async () => {
    if (actualCash === null) {
      message.error("Vui lòng nhập số tiền thực tế kiểm đếm");
      return;
    }
    const discrepancy = actualCash - shiftData.expectedCash;
    if (discrepancy !== 0 && !explanation.trim()) {
      message.error(formatErr05(discrepancy));
      return;
    }

    setSubmittingClose(true);
    try {
      const res = await fetch("/api/v1/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shiftData.id,
          tienThucDem: actualCash,
          giaiTrinh: explanation.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Không thể gửi kết ca");
      }
      message.success("Đã ghi nhận kiểm đếm! Chuyển sang bước Quản lý duyệt.");
      await fetchShift();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setSubmittingClose(false);
    }
  };

  const handleApprovalConfirm = async ({ pinCode, lyDo }: { pinCode?: string; lyDo: string }) => {
    setApprovalLoading(true);
    setApprovalError(null);
    try {
      const res = await fetch("/api/v1/shifts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: shiftData.id, pinCode, lyDo }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setApprovalError(json.error || "Mã PIN không đúng hoặc duyệt thất bại");
        return;
      }
      setApprovalModalOpen(false);
      message.success("Ca làm việc đã được đóng và biên bản Z-Report đã được in!");
      setShiftData((prev: any) => ({ ...prev, status: "DA_DONG" }));
    } catch (err: unknown) {
      setApprovalError(err instanceof Error ? err.message : "Lỗi kết nối");
    } finally {
      setApprovalLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!shiftData) {
    return (
      <div style={{ padding: 40, maxWidth: 600, margin: "0 auto" }}>
        <Result
          status="warning"
          title="Không có ca làm việc"
          subTitle="Hiện tại không có ca làm việc nào đang mở hoặc chờ duyệt để kết ca."
          extra={<Button type="primary" onClick={() => router.push("/tables")}>Quay lại bàn bán hàng</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", padding: "24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/tables")}>
            Về bàn bán hàng
          </Button>
        </Space>

        <Card style={{ borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Title level={3} style={{ margin: 0 }}>
              <AuditOutlined style={{ marginRight: 8, color: "#ff4d4f" }} />
              Kết ca làm việc & Duyệt Z-Report
            </Title>
            <Text type="secondary">SCR-08: Kiểm đếm tiền mặt két, giải trình độ lệch và Quản lý ký duyệt</Text>
          </div>

          <Steps
            current={currentStep}
            style={{ marginBottom: 28 }}
            items={[{ title: "Kiểm đếm két" }, { title: "Chờ Quản lý duyệt" }, { title: "Đã đóng ca" }]}
          />

          <CloseShiftStatistics stats={shiftData as ShiftStatsData} />

          {currentStep !== 2 && (
            <CloseShiftCashForm
              expectedCash={shiftData.expectedCash}
              actualCash={actualCash}
              onActualCashChange={setActualCash}
              explanation={explanation}
              onExplanationChange={setExplanation}
              isReadOnly={isReadOnly}
            />
          )}

          <CloseShiftActions
            currentStep={currentStep}
            shiftCode={shiftData.shiftCode}
            submittingClose={submittingClose}
            onCloseSubmit={handleCloseSubmit}
            onOpenApprovalModal={() => {
              setApprovalError(null);
              setApprovalModalOpen(true);
            }}
            onGoToLogin={() => router.push("/login")}
          />
        </Card>
      </div>

      <ManagerApprovalModal
        open={approvalModalOpen}
        title="Quản lý ký duyệt đóng ca làm việc"
        actionDescription={`Duyệt chốt ca ${shiftData.shiftCode}. Hành động này sẽ khóa ca, in Z-Report và đăng xuất phiên làm việc.`}
        isPinRequired={true}
        isReasonRequired={false}
        defaultReason="Ký duyệt chốt ca làm việc"
        loading={approvalLoading}
        errorMessage={approvalError}
        onConfirm={handleApprovalConfirm}
        onCancel={() => setApprovalModalOpen(false)}
      />
    </div>
  );
}
