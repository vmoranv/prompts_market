import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { MdArrowBack, MdContentCopy, MdCheck, MdFavorite, MdVisibility, MdEdit } from 'react-icons/md';
import styles from '../../styles/PromptDetail.module.css';
import { useSession } from 'next-auth/react';

export default function PromptDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!id) return; 
    
    const fetchPromptDetail = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/prompts/${id}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '提示获取失败');
        }
        
        const data = await response.json();
        setPrompt(data);
        
        try {
          await fetch(`/api/prompts/${id}/view`, { method: 'POST' });
        } catch (viewError) {
          console.error('记录浏览量失败:', viewError);
        }
      } catch (err) {
        console.error('加载详情错误:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPromptDetail();
  }, [id]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '未知时间';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '未知时间';
      
      const now = new Date();
      const diff = now - date;
      
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (seconds < 60) {
        return '刚刚';
      } else if (minutes < 60) {
        return `${minutes}分钟前`;
      } else if (hours < 24) {
        return `${hours}小时前`;
      } else if (days < 7) {
        return `${days}天前`;
      } else {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
      }
    } catch (error) {
      console.error('日期格式化错误:', error);
      return '未知时间';
    }
  };
  
  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingSpinner}></div>
      <p>加载中...</p>
    </div>
  );
  
  if (error) return (
    <div className={styles.errorContainer}>
      <div className={styles.errorIcon}>!</div>
      <p>错误: {error}</p>
      <button className={styles.retryButton} onClick={() => router.reload()}>
        重试
      </button>
    </div>
  );
  
  if (!prompt) return (
    <div className={styles.notFoundContainer}>
      <p>未找到提示</p>
      <Link href="/" className={styles.homeButton}>
        返回首页
      </Link>
    </div>
  );
  
  const isAuthor = session?.user?.id === prompt.author?._id;
  const isAdmin = session?.user?.role === 'admin';
  const canEdit = isAuthor || isAdmin;
  
  return (
    <>
      <Head>
        <title>{prompt.title} | AI提示库</title>
        <meta name="description" content={`${prompt.title} - ${prompt.content.substring(0, 160)}...`} />
      </Head>
      
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/" className={styles.backButton}>
            <MdArrowBack />
            <span>返回</span>
          </Link>
          <h1 className={styles.title}>{prompt.title}</h1>
        </div>
        
        <div className={styles.promptCard}>
          <div className={styles.authorSection}>
            <div className={styles.authorInfo}>
              {prompt.author?.image ? (
                <img src={prompt.author.image} alt={prompt.author.name} className={styles.authorAvatar} />
              ) : (
                <div className={styles.authorAvatar}>{prompt.author?.name?.[0] || '?'}</div>
              )}
              <div>
                <p className={styles.authorName}>{prompt.author?.name || '未知作者'}</p>
                <p className={styles.publishDate}>{formatDate(prompt.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* 只有作者或管理员才能看到编辑按钮 - 现在直接放在 promptCard 内 */}
          {canEdit && (
            <Link href={`/edit-prompt/${prompt._id || id}`} className={styles.editButton}>
              <MdEdit style={{ marginRight: '0.5rem' }} />
              编辑提示
            </Link>
          )}
          <div className={styles.contentSection}>
            <button 
              className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
              onClick={handleCopy}
              aria-label="复制内容"
              >
                {copied ? <MdCheck /> : <MdContentCopy />}
                <span>{copied ? '已复制' : '复制'}</span>
              </button>
            <div className={styles.contentWrapper}>
              <pre className={styles.content}>{prompt.content}</pre>
            </div>
          </div>
          
          {prompt.tags && prompt.tags.length > 0 && (
            <div className={styles.tagsSection}>
              <h3 className={styles.sectionTitle}>标签</h3>
              <div className={styles.tagsContainer}>
                {prompt.tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>{tag}</span>
                ))}
              </div>
            </div>
          )}
          
          <div className={styles.statsSection}>
            <div className={styles.statItem}>
              <MdFavorite className={styles.statIcon} />
              <span>{prompt.likesCount || 0}</span>
            </div>
            <div className={styles.statItem}>
              <MdVisibility className={styles.statIcon} />
              <span>{prompt.viewCount || 0}</span>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}

export const dynamic = 'force-dynamic'; 