import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["@napi-rs/canvas"],
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons", "dayjs"],
  },
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
