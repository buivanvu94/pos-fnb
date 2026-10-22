"use client";

import React, { useState } from "react";
import { Segmented, DatePicker, Space, message } from "antd";
import type { RangePickerProps } from "antd/es/date-picker";
import dayjs, { Dayjs } from "dayjs";
import { ERROR_CATALOG } from "@/lib/error-catalog";

const { RangePicker } = DatePicker;

export type PresetKey = "today" | "yesterday" | "last7days" | "custom";

interface ReportFilterBarProps {
  fromDate: string;
  toDate: string;
  loading?: boolean;
  onChange: (fromDate: string, toDate: string) => void;
}

export function ReportFilterBar({
  fromDate,
  toDate,
  loading,
  onChange,
}: ReportFilterBarProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>("today");

  const handleSegmentChange = (value: string | number) => {
    const key = String(value) as PresetKey;
    setActivePreset(key);

    const today = dayjs();
    let start: Dayjs;
    let end: Dayjs;

    switch (key) {
      case "today":
        start = today;
        end = today;
        break;
      case "yesterday":
        start = today.subtract(1, "day");
        end = today.subtract(1, "day");
        break;
      case "last7days":
        start = today.subtract(6, "day");
        end = today;
        break;
      default:
        return;
    }

    onChange(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  };

  const handleRangeChange: RangePickerProps["onChange"] = (dates) => {
    if (!dates || !dates[0] || !dates[1]) {
      return;
    }

    const [start, end] = dates;

    // Chặn chọn ngược ngày bắt đầu > ngày kết thúc (BR-13, ERR-11)
    if (start.isAfter(end, "day")) {
      message.error(ERROR_CATALOG.ERR_11.message);
      return;
    }

    setActivePreset("custom");
    onChange(start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD"));
  };

  const pickerValue: [Dayjs, Dayjs] = [
    dayjs(fromDate, "YYYY-MM-DD"),
    dayjs(toDate, "YYYY-MM-DD"),
  ];

  return (
    <Space direction="horizontal" size="middle" wrap style={{ marginBottom: 16 }}>
      <Segmented
        value={activePreset}
        onChange={handleSegmentChange}
        disabled={loading}
        options={[
          { label: "Hôm nay", value: "today" },
          { label: "Hôm qua", value: "yesterday" },
          { label: "7 ngày qua", value: "last7days" },
          { label: "Tùy chọn", value: "custom" },
        ]}
      />

      <RangePicker
        value={pickerValue}
        onChange={handleRangeChange}
        format="DD/MM/YYYY"
        allowClear={false}
        disabled={loading}
        disabledDate={(current) => current && current.isAfter(dayjs().endOf("day"))}
      />
    </Space>
  );
}
