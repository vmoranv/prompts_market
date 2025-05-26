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

项目运行需要配置以下环境变量。请参考 `.env.sample` 文件。

- `MONGODB_URI`: MongoDB 连接字符串。
- `NEXTAUTH_SECRET`: NextAuth.js 的会话加密密钥。**在生产环境中必须设置一个强密钥。**
- `NEXTAUTH_URL`: 应用的 URL。本地开发时通常是 `http://localhost:3000`，生产环境则是您的域名。
- `GITHUB_CLIENT_ID`: GitHub OAuth App Client ID。
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret。
- `GOOGLE_CLIENT_ID`: Google OAuth App Client ID。
- `GOOGLE_CLIENT_SECRET`: Google OAuth App Client Secret。
- `NEXT_PUBLIC_ADMIN_EMAILS`: 管理员邮箱列表，多个邮箱用逗号分隔。**这是前端可访问的环境变量，用于控制管理员功能的显示。**

## 运行项目

1.  **安装依赖:**
    ```bash
    npm install
    # 或者
    yarn install
    ```

2.  **配置 `.env.local` 文件。** 参考 `.env.sample`。

3.  **运行开发服务器:**
    ```bash
    npm run dev
    # 或者
    yarn dev
    ```

## 部署

将应用部署到生产环境需要额外的步骤和配置。

1.  **配置环境变量:**
    *   在您的部署平台 (例如 Vercel, Netlify, AWS 等) 上设置上述所有环境变量。**不要将 `.env.local` 文件上传到代码仓库。**
    *   `NEXTAUTH_SECRET` 必须设置为一个安全、随机的字符串。
    *   `NEXTAUTH_URL` 必须设置为您的生产环境 URL (例如 `https://your-app-name.com`)。
    *   `NEXT_PUBLIC_ADMIN_EMAILS` 用于指定哪些用户拥有管理员权限。

2.  **配置 OAuth 提供商的重定向 URI:**
    *   在您的 GitHub 和 Google OAuth App 设置中，将授权回调 URL (Authorization callback URL) 添加为 `[您的生产环境 URL]/api/auth/callback/[provider]`。
    *   例如，如果您的生产 URL 是 `https://your-app-name.com`：
        *   GitHub Redirect URI: `https://your-app-name.com/api/auth/callback/github`
        *   Google Redirect URI: `https://your-app-name.com/api/auth/callback/google`

3.  **构建和启动应用:**
    *   大多数现代部署平台 (如 Vercel, Netlify) 会自动处理构建和启动过程。
    *   如果您手动部署，需要先构建项目：
        ```bash
        npm run build
        # 或者
        yarn build
        ```
    *   然后启动生产服务器：
        ```bash
        npm start
        # 或者
        yarn start
        ```

4.  **数据库连接:**
    *   确保您的生产环境可以访问 `MONGODB_URI` 指定的 MongoDB 数据库。对于 MongoDB Atlas，您可能需要在网络访问设置中允许您的部署平台的 IP 地址范围。

## 后续步骤

- [x] 实现用户登录/注册 UI。
- [x] 实现 Prompt 创建表单和 API。
- [x] 实现 Prompt 展示列表和详情页。
- [x] 实现管理员审核和管理界面。
- [x] 实现搜索、筛选和点赞功能。