import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // 如果需要部署在子目录，可以取消下面注释
  // basePath: '/webapp',
};

export default nextConfig;
