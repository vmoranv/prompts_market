import { getProviders, signIn } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]"; 
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/SignIn.module.css';


export default function SignInPage({ providers }) {
  const router = useRouter();
  const { error } = router.query; 

  return (
    <div className={styles.container}>
      <Head>
        <title>登录 - Prompt 市场</title>
        <meta name="description" content="登录到 Prompt 市场，发现和分享高质量的 AI Prompt" />
      </Head>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>登录到 Prompt 市场</h1>

          {error && (
            <div className={styles.error}>
              登录失败: {getErrorMessage(error)}
            </div>
          )}

          <div className={styles.buttonContainer}>
            {Object.values(providers).map((provider) => (
              <button
                key={provider.name}
                onClick={() => signIn(provider.id, { callbackUrl: router.query.callbackUrl || '/' })}
                className={`${styles.button} ${getProviderButtonClass(provider.id)}`}
              >
                {getProviderIcon(provider.id)}
                使用 {provider.name} 登录
              </button>
            ))}
          </div>
          
          <p className={styles.footer}>
            通过登录，您同意我们的 <a href="https://github.com/vmoranv/prompt_market/blob/master/LICENSE" className={styles.link}>许可协议</a>。
          </p>
        </div>
      </main>
    </div>
  );
}

function getProviderButtonClass(providerId) {
  switch (providerId) {
    case 'github':
      return styles.githubButton;
    case 'google':
      return styles.googleButton;
    case 'qq':
      return styles.qqButton;
    default:
      return styles.githubButton;
  }
}

function getProviderIcon(providerId) {
  switch (providerId) {
    case 'github':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" className={styles.providerIcon}>
          <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      );
    case 'google':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" className={styles.providerIcon}>
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      );
    default:
      return null;
  }
}


function getErrorMessage(error) {
  switch (error) {
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
    case "EmailCreateAccount":
    case "Callback":
    case "OAuthAccountNotLinked":
      return "尝试使用 OAuth 提供商登录时出错。可能是您的账户已通过其他方式链接，或者提供商配置有误。";
    case "EmailSignin":
      return "发送登录邮件时出错。";
    case "CredentialsSignin":
      return "登录凭据无效，请检查您的用户名和密码。";
    case "SessionRequired":
        return "访问此页面需要登录。";
    default:
      return "发生未知错误，请稍后再试。";
  }
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const providers = await getProviders();
  return {
    props: { providers: providers ?? [] },
  };
} 