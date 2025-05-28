/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 如果您使用了自定义服务器配置，检查这里
  images: {
    domains: ['avatars.githubusercontent.com'], // 添加 GitHub 头像域名
  },
  // Stagewise 配置
  webpack: (config) => {
    // 只在开发环境中启用 Stagewise
    if (process.env.NODE_ENV === 'development') {
      // 可以添加 Stagewise 相关的 webpack 配置（如果需要）
    }
    return config;
  },
};

module.exports = nextConfig; 