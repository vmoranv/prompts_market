# Prompt 市场

一个使用 Next.js 和 MongoDB 构建的 Prompt 分享平台。

## 项目目标

- 用户可以通过 GitHub 或 Google 账户登录。
- 用户可以创建、分享 Prompt。
- 管理员可以审核和管理平台上的 Prompt。
- 用户可以搜索、筛选和点赞 Prompt。

## 技术栈

- **前端:** Next.js (React)
- **后端:** Next.js API Routes
- **数据库:** MongoDB (使用 Mongoose 作为 ODM)
- **认证:** NextAuth.js
- **主题管理:** React Context API (用于切换主题)
- **样式:** CSS Modules with CSS Variables (支持系统主题)
- **UI (计划):** (例如 Tailwind CSS, Chakra UI, Material UI - 待定)

## 环境变量

项目运行需要配置以下环境变量 (在 `.env.local` 文件中):

- `MONGODB_URI`: MongoDB 连接字符串。
- `NEXTAUTH_SECRET`: NextAuth.js 的会话加密密钥。
- `NEXTAUTH_URL`: 应用的 URL (例如 `http://localhost:3000`)。
- `GITHUB_CLIENT_ID`: GitHub OAuth App Client ID。
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret。
- `GOOGLE_CLIENT_ID`: Google OAuth App Client ID。
- `GOOGLE_CLIENT_SECRET`: Google OAuth App Client Secret。

## 运行项目

1.  **安装依赖:**
    ```bash
    npm install
    # 或者
    yarn install
    ```

2.  **配置 `.env.local` 文件。**

3.  **运行开发服务器:**
    ```bash
    npm run dev
    # 或者
    yarn dev
    ```

## 后续步骤

- [x] 实现用户登录/注册 UI。
- [x] 实现 Prompt 创建表单和 API。
- [x] 实现 Prompt 展示列表和详情页。
- [x] 实现管理员审核和管理界面。
- [x] 实现搜索、筛选和点赞功能。