import React, { useState, useMemo } from "react";
import { Modal, Segmented, Descriptions, Select, Empty, Alert, Typography } from "antd";
import { formatVnd } from "@/lib/money";
import type { TableWithOrderInfo } from "@/server/tables/table-service";
import type { OrderDetail } from "@/server/orders/order-service";

const { Text } = Typography;

interface TransferMergeModalProps {
  open: boolean;
  sourceTable: TableWithOrderInfo | null;
  currentOrder: OrderDetail | null;
  allTables: TableWithOrderInfo[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    banNguonId: number;
    banDichId: number;
    loai: "CHUYEN" | "GOP";
  }) => void;
}

export function TransferMergeModal({
  open,
  sourceTable,
  currentOrder,
  allTables,
  loading = false,
  onClose,
  onConfirm,
}: TransferMergeModalProps) {
  const [mode, setMode] = useState<"CHUYEN" | "GOP">("CHUYEN");
  const [selectedDestId, setSelectedDestId] = useState<number | null>(null);

  // Eligible destination tables
  const eligibleTables = useMemo(() => {
    if (!sourceTable) return [];
    return allTables.filter((t) => {
      if (t.id === sourceTable.id) return false;
      if (mode === "CHUYEN") {
        return t.status === "TRONG";
      } else {
        return t.status === "DANG_DUNG" || t.status === "CHO_THANH_TOAN";
      }
    });
  }, [allTables, sourceTable, mode]);

  const handleModeChange = (val: string | number) => {
    setMode(val as "CHUYEN" | "GOP");
    setSelectedDestId(null);
  };

  const handleOk = () => {
    if (!sourceTable || !selectedDestId) return;
    onConfirm({
      banNguonId: sourceTable.id,
      banDichId: selectedDestId,
      loai: mode,
    });
  };

  if (!sourceTable) return null;

  return (
    <Modal
      title="Chuyển bàn hoặc Gộp bàn"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okButtonProps={{ disabled: !selectedDestId || eligibleTables.length === 0 }}
      okText={mode === "CHUYEN" ? "Xác nhận chuyển bàn" : "Xác nhận gộp bàn"}
      cancelText="Đóng"
      width={520}
    >
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <Segmented
          options={[
            { label: "Chuyển bàn", value: "CHUYEN" },
            { label: "Gộp bàn", value: "GOP" },
          ]}
          value={mode}
          onChange={handleModeChange}
          size="large"
          block
        />
      </div>

      <Descriptions
        title="Thông tin bàn hiện tại"
        bordered
        size="small"
        column={2}
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="Bàn nguồn">{sourceTable.name}</Descriptions.Item>
        <Descriptions.Item label="Khu vực">{sourceTable.areaName || "—"}</Descriptions.Item>
        <Descriptions.Item label="Số lượng món">
          {currentOrder?.items.length ?? sourceTable.activeOrderItemCount} món
        </Descriptions.Item>
        <Descriptions.Item label="Tổng tiền">
          <Text strong style={{ color: "#d4380d" }}>
            {formatVnd(currentOrder?.totalAmount ?? sourceTable.activeOrderTotal)}
          </Text>
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          {mode === "CHUYEN"
            ? "Chọn bàn trống nhận chuyển (bắt buộc trạng thái Trống):"
            : "Chọn bàn đang phục vụ để gộp vào:"}
        </Text>

        {eligibleTables.length === 0 ? (
          <Empty
            description={
              mode === "CHUYEN"
                ? "Không còn bàn trống nào trong quán để chuyển"
                : "Không có bàn đang phục vụ nào khác để gộp chung"
            }
          />
        ) : (
          <Select
            placeholder={mode === "CHUYEN" ? "Chọn bàn trống đích..." : "Chọn bàn phục vụ đích..."}
            style={{ width: "100%" }}
            size="large"
            value={selectedDestId}
            onChange={(val) => setSelectedDestId(val)}
            options={eligibleTables.map((t) => ({
              label: `${t.name} (${t.areaName || "Khu vực"} - ${
                t.status === "TRONG"
                  ? "Trống"
                  : `${t.activeOrderItemCount} món · ${formatVnd(t.activeOrderTotal)}`
              })`,
              value: t.id,
            }))}
          />
        )}
      </div>

      <Alert
        message={
          mode === "CHUYEN"
            ? "Chuyển toàn bộ món từ bàn nguồn sang bàn đích. Bàn nguồn sẽ trở về trạng thái Trống."
            : "Sáp nhập toàn bộ món của bàn nguồn vào bàn đích. Tổng tiền hóa đơn sẽ được cộng dồn chính xác."
        }
        type="info"
        showIcon
      />
    </Modal>
  );
}
