"use client";

import React from "react";
import { Space } from "antd";

interface PinDotsDisplayProps {
  length: number;
  maxLength?: number;
}

/**
 * Visual masked dots display for 4-6 digit PIN entry.
 * Never displays plaintext digits.
 */
export function PinDotsDisplay({ length, maxLength = 6 }: PinDotsDisplayProps) {
  const dots = Array.from({ length: maxLength }, (_, i) => i < length);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "12px 0",
      }}
    >
      <Space size={14}>
        {dots.map((filled, index) => (
          <div
            key={index}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: filled ? "#1677ff" : "#f0f0f0",
              border: filled ? "2px solid #1677ff" : "2px solid #d9d9d9",
              transition: "all 0.15s ease-in-out",
            }}
          />
        ))}
      </Space>
    </div>
  );
}
