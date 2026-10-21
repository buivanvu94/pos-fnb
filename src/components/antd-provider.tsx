"use client";

import React, { useEffect } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { themeConfig } from "@/theme/theme-config";

dayjs.locale("vi");

interface AntdProviderProps {
  children: React.ReactNode;
}

/**
 * Root Ant Design client provider wrapping AntdRegistry, ConfigProvider with vi_VN locale,
 * touch-optimized theme tokens, and the Ant Design App container.
 */
export function AntdProvider({ children }: AntdProviderProps) {
  useEffect(() => {
    dayjs.locale("vi");
  }, []);

  return (
    <AntdRegistry>
      <ConfigProvider locale={viVN} theme={themeConfig}>
        <App>
          {children}
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
