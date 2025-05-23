import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/SignIn.module.css';

export default function SignIn() {
  const router = useRouter();
  const { callbackUrl } = router.query;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOAuthSignIn = async (provider) => {
    try {
      setIsLoading(true);
      setError('');
      signIn(provider, { callbackUrl: callbackUrl || '/' });
    } catch (error) {
      console.error('登录错误:', error);
      setError('登录过程中发生错误，请稍后再试');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>登录 - Prompt 市场</title>
        <meta name="description" content="登录到 Prompt 市场，发现和分享高质量的 AI Prompt" />
      </Head>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>登录到 Prompt 市场</h1>
          
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.buttonContainer}>
            <button 
              className={`${styles.button} ${styles.githubButton}`}
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" className={styles.providerIcon}>
                <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              使用 GitHub 登录
            </button>
            
            {/* QQ登录按钮 */}
            {/* <button 
              className={`${styles.button} ${styles.qqButton}`}
              onClick={() => handleOAuthSignIn('qq')}
              disabled={isLoading}
            >
              <img 
                src="https://qzonestyle.gtimg.cn/qzone/vas/opensns/res/img/Connect_logo_1.png" 
                alt="QQ" 
                width="24" 
                height="24" 
                className={styles.providerIcon} 
              />
              使用 QQ 登录
            </button> */}
          </div>
          
          <p style={{ marginTop: '30px', fontSize: '12px', color: '#888' }}>
          通过登录，您同意我们的 <a href="https://github.com/vmoranv/prompt_market/blob/master/LICENSE" style={{color: '#555'}}>许可协议</a>。
          </p>
        </div>
      </main>
    </div>
  );
} 