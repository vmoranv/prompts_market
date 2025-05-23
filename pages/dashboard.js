import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Dashboard.module.css';
import { MdAccountCircle, MdLightbulbOutline, MdDelete, MdEdit, MdArrowBack, MdSentimentDissatisfied } from 'react-icons/md';
import Link from 'next/link';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { userId: queryUserId } = router.query;

  const [profileUser, setProfileUser] = useState(null);
  const [userPrompts, setUserPrompts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [error, setError] = useState(null);
  const [fetchProfileError, setFetchProfileError] = useState(null);

  const loggedInUserId = session?.user?.id;
  const isOwnDashboard = !queryUserId || queryUserId === loggedInUserId;

  useEffect(() => {
    const fetchProfileUser = async () => {
      setLoadingProfile(true);
      setFetchProfileError(null);
      setError(null);

      if (status === 'loading') return;

      if (queryUserId) {
        if (queryUserId === loggedInUserId && session?.user) {
          setProfileUser(session.user);
          setLoadingProfile(false);
        } else {
          try {
            const res = await fetch(`/api/users/${queryUserId}`);
            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || `无法加载用户信息: ${res.status}`);
            }
            const data = await res.json();
            if (data.success) {
              setProfileUser(data.data);
            } else {
              throw new Error(data.error || '获取用户信息失败');
            }
          } catch (err) {
            console.error(`获取用户 ${queryUserId} 信息失败:`, err);
            setFetchProfileError(err.message);
            setProfileUser(null);
          } finally {
            setLoadingProfile(false);
          }
        }
      } else if (session?.user) {
        setProfileUser(session.user);
        setLoadingProfile(false);
      } else if (status === 'unauthenticated') {
        router.push('/signin?callbackUrl=' + encodeURIComponent(router.asPath));
      } else {
        setLoadingProfile(false);
      }
    };

    fetchProfileUser();
  }, [queryUserId, session, status, router, loggedInUserId]);


  useEffect(() => {
    const fetchUserPrompts = async () => {
      const targetUserId = queryUserId || loggedInUserId;

      if (targetUserId && profileUser) {
        setLoadingPrompts(true);
        try {
          const res = await fetch(`/api/prompts?userId=${targetUserId}`);
          if (!res.ok) {
            throw new Error(`获取 Prompts 失败: ${res.status}`);
          }
          const data = await res.json();
          setUserPrompts(data.data || []);
        } catch (err) {
          console.error("获取用户 Prompts 失败:", err);
          setError(err.message);
        } finally {
          setLoadingPrompts(false);
        }
      } else if (!targetUserId && status === 'authenticated') {
        setLoadingPrompts(false);
        setUserPrompts([]);
      } else if (!profileUser && queryUserId && !loadingProfile) {
        setLoadingPrompts(false);
        setUserPrompts([]);
      }
    };

    if (status !== 'loading' && !loadingProfile) {
        fetchUserPrompts();
    }
  }, [queryUserId, loggedInUserId, status, loadingProfile, profileUser]);

  const handleDeletePrompt = async (promptId) => {
    if (!isOwnDashboard && session?.user?.role !== 'admin') {
        alert('您没有权限删除此 Prompt。');
        return;
    }
    if (window.confirm('确定要删除这个 Prompt 吗？')) {
      try {
        const res = await fetch(`/api/prompts/${promptId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `删除失败: ${res.status}`);
        }
        setUserPrompts(userPrompts.filter(prompt => prompt._id !== promptId));
        console.log(`Prompt ${promptId} 已成功删除。`);
      } catch (err) {
        console.error("删除 Prompt 失败:", err);
        alert(`删除 Prompt 失败: ${err.message}`);
      }
    }
  };

  if (status === 'loading' || (loadingProfile && !fetchProfileError) ) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' && !queryUserId) {
    return null;
  }

  if (queryUserId && fetchProfileError) {
    return (
        <div className={styles.container}>
            <Head>
                <title>错误 - Prompt 市场</title>
            </Head>
            <main className={styles.main}>
                <Link href="/" className={styles.backLink}>
                    <MdArrowBack /> 返回首页
                </Link>
                <div className={styles.errorContainer}>
                    <MdSentimentDissatisfied className={styles.errorIconLarge} />
                    <h2>无法加载用户信息</h2>
                    <p>{fetchProfileError}</p>
                </div>
            </main>
        </div>
    );
  }

  if (queryUserId && !profileUser && !loadingProfile) {
      return (
          <div className={styles.container}>
              <Head>
                  <title>用户未找到 - Prompt 市场</title>
              </Head>
              <main className={styles.main}>
                  <Link href="/" className={styles.backLink}>
                      <MdArrowBack /> 返回首页
                  </Link>
                  <div className={styles.emptyState}>
                      <MdSentimentDissatisfied className={styles.emptyIcon} />
                      <h3>用户未找到</h3>
                      <p>无法找到 ID 为 {queryUserId} 的用户信息。</p>
                  </div>
              </main>
          </div>
      );
  }

  const canManagePrompts = isOwnDashboard || session?.user?.role === 'admin';

  return (
    <div className={styles.container}>
      <Head>
        <title>{profileUser?.name || (queryUserId ? '用户' : '我的')}中心 - Prompt 市场</title>
        <meta name="description" content={`查看 ${profileUser?.name || '用户'} 的 Prompt 和资料`} />
      </Head>

      <main className={styles.main}>
        {!isOwnDashboard && profileUser && (
            <Link href="/" className={styles.backLink}>
                <MdArrowBack /> 返回首页
            </Link>
        )}
        <h1 className={styles.title}>
            {isOwnDashboard ? '我的用户中心' : (profileUser?.name ? `${profileUser.name}的资料` : '用户资料')}
        </h1>

        {profileUser && (
          <section className={styles.profileCard}>
            <div className={styles.profileAvatar}>
              {profileUser.image ? (
                <img src={profileUser.image} alt={profileUser.name || '用户头像'} className={styles.avatarImage} />
              ) : (
                <MdAccountCircle className={styles.defaultAvatarIcon} />
              )}
            </div>
            <div className={styles.profileInfo}>
              <h2 className={styles.profileName}>{profileUser.name || '用户'}</h2>
              {profileUser.email && <p className={styles.profileEmail}>{profileUser.email}</p>}
            </div>
          </section>
        )}

        {profileUser && (
            <section className={styles.myPromptsSection}>
            <h2 className={styles.sectionTitle}>
                <MdLightbulbOutline className={styles.sectionIcon} />
                {isOwnDashboard ? '我的 Prompt' : `${profileUser?.name || '用户'}的 Prompt`} ({userPrompts.length})
            </h2>

            {loadingPrompts && (
                <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>加载 Prompts...</p>
                </div>
            )}

            {error && !loadingPrompts && (
                <div className={styles.errorContainer}>
                <MdSentimentDissatisfied className={styles.errorIconLarge} />
                <h2>加载 Prompts 失败</h2>
                <p>{error}</p>
                </div>
            )}

            {!loadingPrompts && !error && userPrompts.length === 0 && (
                <div className={styles.emptyState}>
                <MdSentimentDissatisfied className={styles.emptyIcon} />
                <h3>{isOwnDashboard ? '您还没有发布任何 Prompt' : (profileUser?.name ? `${profileUser.name} 还没有发布任何 Prompt` : '该用户还没有发布任何 Prompt')}</h3>
                {isOwnDashboard && (
                    <p className={styles.emptySuggestion}>
                    快去 <Link href="/create-prompt" className={styles.emptyLink}>创建一个新的 Prompt</Link> 吧！
                    </p>
                )}
                </div>
            )}

            {!loadingPrompts && !error && userPrompts.length > 0 && (
                <div className={styles.promptsGrid}>
                {userPrompts.map(prompt => (
                    <div key={prompt._id} className={styles.promptItem}>
                    <Link href={`/prompt/${prompt._id}`} className={styles.promptTitleLink}>
                        <span className={styles.promptTitleText}>{prompt.title}</span>
                    </Link>
                    {canManagePrompts && (
                        <div className={styles.promptActions}>
                        <Link href={`/edit-prompt/${prompt._id}`} className={styles.actionButton} title="编辑">
                            <MdEdit />
                        </Link>
                        <button onClick={() => handleDeletePrompt(prompt._id)} className={`${styles.actionButton} ${styles.deleteButton}`} title="删除">
                            <MdDelete />
                        </button>
                        </div>
                    )}
                    </div>
                ))}
                </div>
            )}
            </section>
        )}
      </main>
    </div>
  );
} 