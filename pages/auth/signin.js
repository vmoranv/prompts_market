import { getProviders, signIn } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]"; 
import { useRouter } from 'next/router';

export default function SignInPage({ providers }) {
  const router = useRouter();
  const { error } = router.query; 

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f2f5',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        {/* 您可以在这里添加应用的 Logo */}
        {/* <img src="/logo.png" alt="Prompt 市场 Logo" style={{ maxWidth: '150px', marginBottom: '20px' }} /> */}
        <h2>登录到 Prompt 市场</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          选择一个服务提供商以继续。
        </p>

        {error && (
          <div style={{
            color: 'white',
            backgroundColor: '#ff4d4f',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            登录失败: {getErrorMessage(error)}
          </div>
        )}

        {Object.values(providers).map((provider) => (
          <div key={provider.name} style={{ marginBottom: '15px' }}>
            <button
              onClick={() => signIn(provider.id, { callbackUrl: router.query.callbackUrl || '/' })} 
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: provider.id === 'google' ? '#4285F4' : '#333',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* 可选：为不同提供商添加图标 */}
              {/* <img src={`/${provider.id}-icon.svg`} alt="" style={{ marginRight: '10px', height: '20px' }} /> */}
              使用 {provider.name} 登录
            </button>
          </div>
        ))}
        <p style={{ marginTop: '30px', fontSize: '12px', color: '#888' }}>
          通过登录，您同意我们的 <a href="https://github.com/vmoranv/prompt_market/blob/master/LICENSE" style={{color: '#555'}}>许可协议</a>。
        </p>
      </div>
    </div>
  );
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