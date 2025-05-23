import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { MdArrowBack } from 'react-icons/md';
import { useSession } from 'next-auth/react';
import styles from '../../styles/EditPrompt.module.css';

export default function EditPrompt() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();

  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
  const isAdmin = adminEmails.includes(session?.user?.email);

  console.log('EditPrompt debug:', {
    isAdmin,
    sessionEmail: session?.user?.email,
    adminEmailsConfig: process.env.NEXT_PUBLIC_ADMIN_EMAILS // 检查环境变量是否正确读取
  });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [promptData, setPromptData] = useState(null);
  
  useEffect(() => {
    if (!id) return;
    
    const fetchPrompt = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/prompts/${id}`);
        
        if (!response.ok) {
          throw new Error('获取提示信息失败');
        }
        
        const data = await response.json();
        const promptData = data.data;
        
        setTitle(promptData.title);
        setContent(promptData.content);
        setTags(promptData.tags ? promptData.tags.join(', ') : '');
        setPromptData(promptData);
        
      } catch (err) {
        console.error('加载提示错误:', err);
        setError('无法加载提示信息');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrompt();
  }, [id]);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=' + encodeURIComponent(`/edit-prompt/${id}`));
    }
  }, [status, router, id]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/prompts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '更新失败');
      }
      
      setSuccessMsg('提示更新成功！');
      
      setTimeout(() => {
        router.push(`/prompt/${id}`);
      }, 1500);
      
    } catch (err) {
      console.error('更新错误:', err);
      setError(err.message || '更新过程中发生错误');
    } finally {
      setSubmitting(false);
    }
  };
  
  useEffect(() => {
    if (status === 'authenticated' && promptData) {
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
      const isUserAdmin = adminEmails.includes(session.user.email);

      if (!isUserAdmin && session.user.email !== promptData.author?.email) {
        console.warn('用户无权编辑此 Prompt，重定向到主页');
        router.push('/');
      }
    }
  }, [status, session, router, promptData]);
  
  if (status === 'loading' || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>加载中...</p>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>编辑Prompt - Prompt 市场</title>
        <meta name="description" content="编辑您的Prompt" />
      </Head>
      
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href={`/prompt/${id}`} className={styles.backButton}>
            <MdArrowBack />
            <span>返回</span>
          </Link>
          <h1 className={styles.title}>编辑Prompt</h1>
        </header>
        
        {error && (
          <div className={styles.errorMessage}>
            <p>{error}</p>
          </div>
        )}
        
        {successMsg && (
          <div className={styles.successMessage}>
            <p>{successMsg}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="title" className={styles.label}>标题</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入提示标题"
              className={styles.input}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="content" className={styles.label}>内容</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入提示内容"
              className={styles.textarea}
              rows={8}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="tags" className={styles.label}>标签 (用逗号分隔)</label>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如: AI, 写作, 创意"
              className={styles.input}
            />
          </div>
          
          <div className={styles.actions}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={() => router.push(`/prompt/${id}`)}
            >
              取消
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={submitting}
            >
              {submitting ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export const dynamic = 'force-dynamic'; 