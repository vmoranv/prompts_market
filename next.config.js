/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 如果您使用了自定义服务器配置，检查这里
  images: {
    domains: ['avatars.githubusercontent.com'], // 添加 GitHub 头像域名
  },
};

module.exports = nextConfig; 