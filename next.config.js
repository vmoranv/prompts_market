/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 确保 API 路由正常工作
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  // 如果您使用了自定义服务器配置，检查这里
  images: {
    domains: ['avatars.githubusercontent.com'], // 添加 GitHub 头像域名
  },
};

module.exports = nextConfig; 