import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 공공데이터 CSV를 서버 런타임에서 읽으므로 배포 번들에 포함
  outputFileTracingIncludes: { "/**/*": ["./data/**/*"] },
};

export default nextConfig;
