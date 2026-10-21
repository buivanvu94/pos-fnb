import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@napi-rs/canvas"],
  transpilePackages: [
    "antd",
    "@ant-design/icons",
    "@ant-design/nextjs-registry",
    "rc-util",
    "rc-pagination",
    "rc-picker",
  ],
};

export default nextConfig;
