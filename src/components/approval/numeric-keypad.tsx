"use client";

import React from "react";
import { Row, Col, Button } from "antd";
import { DeleteOutlined, ClearOutlined } from "@ant-design/icons";

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}

/**
 * Custom numeric keypad grid for touch-friendly PIN entry (SCR-05).
 */
export function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  disabled = false,
}: NumericKeypadProps) {
  const digits = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  const buttonStyle: React.CSSProperties = {
    height: 48,
    fontSize: 18,
    fontWeight: 600,
  };

  return (
    <div style={{ maxWidth: 280, margin: "0 auto" }}>
      {digits.map((row, rowIndex) => (
        <Row key={rowIndex} gutter={[8, 8]} style={{ marginBottom: 8 }}>
          {row.map((d) => (
            <Col span={8} key={d}>
              <Button
                block
                style={buttonStyle}
                disabled={disabled}
                onClick={() => onDigit(d)}
              >
                {d}
              </Button>
            </Col>
          ))}
        </Row>
      ))}

      <Row gutter={[8, 8]}>
        <Col span={8}>
          <Button
            block
            danger
            style={buttonStyle}
            disabled={disabled}
            icon={<ClearOutlined />}
            onClick={onClear}
          />
        </Col>
        <Col span={8}>
          <Button
            block
            style={buttonStyle}
            disabled={disabled}
            onClick={() => onDigit("0")}
          >
            0
          </Button>
        </Col>
        <Col span={8}>
          <Button
            block
            style={buttonStyle}
            disabled={disabled}
            icon={<DeleteOutlined />}
            onClick={onBackspace}
          />
        </Col>
      </Row>
    </div>
  );
}
