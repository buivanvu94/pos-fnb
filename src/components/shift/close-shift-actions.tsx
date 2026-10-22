"use client";

import React from "react";
import { Button, Alert, Result } from "antd";
import { CheckCircleOutlined, SafetyCertificateOutlined, PrinterOutlined } from "@ant-design/icons";

export interface CloseShiftActionsProps {
  currentStep: number;
  shiftCode: string;
  submittingClose: boolean;
  onCloseSubmit: () => void;
  onOpenApprovalModal: () => void;
  onGoToLogin: () => void;
}

export function CloseShiftActions({
  currentStep,
  shiftCode,
  submittingClose,
  onCloseSubmit,
  onOpenApprovalModal,
  onGoToLogin,
}: CloseShiftActionsProps) {
  if (currentStep === 2) {
    return (
      <Result
        status="success"
        title="Ca làm việc đã được đóng hoàn tất!"
        subTitle={`Mã ca: ${shiftCode}. Biên bản Z-Report đã được chuyển tới máy in hóa đơn.`}
        extra={[
          <Button
            key="login"
            type="primary"
            size="large"
            icon={<PrinterOutlined />}
            onClick={onGoToLogin}
          >
            Đăng nhập tài khoản mới
          </Button>,
        ]}
      />
    );
  }

  if (currentStep === 1) {
    return (
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Alert
          type="info"
          showIcon
          message="Ca đang ở trạng thái Chờ Quản lý duyệt"
          description="Vui lòng yêu cầu Quản lý kiểm tra số tiền thực tế trong két và nhập mã PIN phê duyệt để đóng ca."
          style={{ marginBottom: 16 }}
        />
        <Button
          type="primary"
          danger
          size="large"
          icon={<SafetyCertificateOutlined />}
          onClick={onOpenApprovalModal}
          style={{ height: 48, fontWeight: 600, fontSize: 16, minWidth: 260 }}
        >
          Quản lý nhập PIN ký duyệt
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="primary"
      danger
      size="large"
      block
      icon={<CheckCircleOutlined />}
      loading={submittingClose}
      onClick={onCloseSubmit}
      style={{ height: 48, fontWeight: 600, fontSize: 16 }}
    >
      Xác nhận kiểm đếm & Chuyển duyệt
    </Button>
  );
}
