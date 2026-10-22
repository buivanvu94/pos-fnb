"use client";

import React, { useState, useEffect } from "react";
import { Layout, Menu, Button, Space, Tag, Dropdown, Typography, App } from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined,
  ShoppingOutlined,
  BarChartOutlined,
  CoffeeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useRouter, usePathname } from "next/navigation";
import dayjs from "dayjs";
import type { Role } from "@/lib/permissions";
import { ShiftToolbar } from "@/components/shift/shift-toolbar";
import { SyncStatusBadge } from "@/components/sync/sync-status-badge";

const { Header, Content } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

interface CurrentUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
}

export function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    // Fetch logged in user
    fetch("/api/v1/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    // Clock update
    const updateClock = () => setCurrentTime(dayjs().format("HH:mm - DD/MM/YYYY"));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      message.success("Đã đăng xuất");
      router.push("/login");
    } catch {
      message.error("Lỗi khi đăng xuất");
    }
  };

  const roleLabelMap: Record<Role, { label: string; color: string }> = {
    QUAN_LY: { label: "Quản lý", color: "blue" },
    THU_NGAN: { label: "Thu ngân", color: "green" },
    PHUC_VU: { label: "Phục vụ", color: "orange" },
  };

  const navMenuItems: MenuProps["items"] = [
    {
      key: "/tables",
      icon: <AppstoreOutlined />,
      label: "Sơ đồ bàn",
      onClick: () => router.push("/tables"),
    },
    {
      key: "/counter",
      icon: <ShoppingOutlined />,
      label: "Bán tại quầy",
      onClick: () => router.push("/counter"),
    },
    ...(currentUser?.role === "QUAN_LY"
      ? [
          {
            key: "admin-group",
            label: "Quản trị",
            icon: <BarChartOutlined />,
            children: [
              {
                key: "/admin/reports",
                icon: <BarChartOutlined />,
                label: "Báo cáo doanh thu",
                onClick: () => router.push("/admin/reports"),
              },
              {
                key: "/admin/menu",
                icon: <CoffeeOutlined />,
                label: "Quản lý thực đơn",
                onClick: () => router.push("/admin/menu"),
              },
              {
                key: "/admin/settings",
                icon: <SettingOutlined />,
                label: "Cài đặt máy in",
                onClick: () => router.push("/admin/settings"),
              },
            ],
          },
        ]
      : []),
  ];

  const userDropdownItems: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
          padding: "0 24px",
          borderBottom: "1px solid #f0f0f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <Space size="middle">
          <Text strong style={{ fontSize: 18, color: "#1677ff", cursor: "pointer" }} onClick={() => router.push("/tables")}>
            <CoffeeOutlined /> POS F&B
          </Text>
          <Menu
            mode="horizontal"
            selectedKeys={[pathname]}
            items={navMenuItems}
            style={{ borderBottom: "none", minWidth: 350 }}
          />
        </Space>

        <Space size="large">
          <Tag color="cyan" style={{ fontSize: 13, padding: "4px 8px" }}>
            <ClockCircleOutlined /> {currentTime}
          </Tag>

          {currentUser && (
            <Dropdown menu={{ items: userDropdownItems }} trigger={["click"]}>
              <Button type="text" style={{ height: 44 }}>
                <Space>
                  <UserOutlined />
                  <Text strong>{currentUser.fullName}</Text>
                  <Tag color={roleLabelMap[currentUser.role]?.color || "default"}>
                    {roleLabelMap[currentUser.role]?.label || currentUser.role}
                  </Tag>
                </Space>
              </Button>
            </Dropdown>
          )}

          <SyncStatusBadge />
          <ShiftToolbar />
        </Space>
      </Header>

      <Content style={{ padding: "24px", background: "#f5f5f5" }}>
        {children}
      </Content>
    </Layout>
  );
}
