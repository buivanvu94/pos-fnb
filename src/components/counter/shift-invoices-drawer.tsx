import React, { useState, useEffect, useCallback } from "react";
import { Drawer, Table, Button, Space, Tag, Typography, App, Popconfirm } from "antd";
import { PrinterOutlined, StopOutlined, ReloadOutlined } from "@ant-design/icons";
import { formatVnd } from "@/lib/money";
import { ManagerApprovalModal, useManagerApproval, type ApprovalResultData } from "@/components/approval";
import type { InvoiceItem } from "@/server/payments/invoice-service";

const { Text } = Typography;

interface ShiftInvoicesDrawerProps {
  open: boolean;
  onClose: () => void;
  userRole?: string;
}

export function ShiftInvoicesDrawer({ open, onClose, userRole }: ShiftInvoicesDrawerProps) {
  const { message } = App.useApp();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    modalState,
    requestApproval,
    handleConfirm,
    handleCancel,
  } = useManagerApproval();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/invoices?scope=shift");
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setInvoices(data.data);
      } else {
        message.error(data.error || "Không thể tải danh sách hóa đơn");
      }
    } catch {
      message.error("Lỗi kết nối khi tải danh sách hóa đơn");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (open) {
      fetchInvoices();
    }
  }, [open, fetchInvoices]);

  const handleReprint = async (invoice: InvoiceItem) => {
    try {
      const res = await fetch(`/api/v1/orders/${invoice.id}/reprint`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        message.success(`Đã gửi lệnh in lại hóa đơn ${invoice.orderCode}`);
        if (data.printWarning) {
          message.warning(data.printWarning.message);
        }
      } else {
        message.error(data.error || "Không thể in lại hóa đơn");
      }
    } catch {
      message.error("Lỗi kết nối khi gửi lệnh in lại");
    }
  };

  const handleVoidClick = (invoice: InvoiceItem) => {
    requestApproval(
      {
        title: `Xác nhận hủy hóa đơn: ${invoice.orderCode}`,
        actionDescription: `Hủy hóa đơn đã thanh toán ${formatVnd(invoice.finalAmount)}. Hành động này yêu cầu Quản lý phê duyệt và sẽ ghi nhận vào nhật ký kiểm toán.`,
        isPinRequired: userRole !== "QUAN_LY",
      },
      async ({ pinCode, lyDo }: ApprovalResultData) => {
        const res = await fetch(`/api/v1/orders/${invoice.id}/void`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: invoice.version,
            lyDo,
            pinCode,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          message.success(`Đã hủy hóa đơn ${invoice.orderCode}`);
          fetchInvoices();
          return { ok: true };
        } else {
          return { ok: false, error: data.error || "Hủy hóa đơn thất bại" };
        }
      },
    );
  };

  const columns = [
    {
      title: "Mã hóa đơn",
      dataIndex: "orderCode",
      key: "orderCode",
      render: (code: string, row: InvoiceItem) => (
        <Space direction="vertical" size={2}>
          <Text strong>{code}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.orderType === "MANG_VE"
              ? `Mang về ${row.queueNumber ? `(#${row.queueNumber})` : ""}`
              : (row.tableName ?? "Tại bàn")}
          </Text>
        </Space>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "finalAmount",
      key: "finalAmount",
      render: (amt: number) => <Text strong>{formatVnd(amt)}</Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) =>
        status === "DA_THANH_TOAN" ? (
          <Tag color="success">Đã thanh toán</Tag>
        ) : (
          <Tag color="error">Đã hủy</Tag>
        ),
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_: any, record: InvoiceItem) => (
        <Space size={8}>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handleReprint(record)}
          >
            In lại
          </Button>
          {record.status === "DA_THANH_TOAN" && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleVoidClick(record)}
            >
              Hủy
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Drawer
        title="Danh sách hóa đơn trong ca làm việc"
        placement="right"
        width={720}
        open={open}
        onClose={onClose}
        extra={
          <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchInvoices}>
            Làm mới
          </Button>
        }
      >
        <Table
          dataSource={invoices}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: "Chưa có hóa đơn nào trong ca này." }}
        />
      </Drawer>

      <ManagerApprovalModal
        open={modalState.open}
        title={modalState.title}
        actionDescription={modalState.actionDescription}
        isPinRequired={modalState.isPinRequired}
        errorMessage={modalState.errorMessage}
        lockoutUntil={modalState.lockoutUntil}
        loading={modalState.loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
