import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { MdArrowBack } from 'react-icons/md';
import { useSession } from 'next-auth/react';
import styles from '../styles/CreatePrompt.module.css';

// 定义最大字数限制常量
const MAX_TITLE_LENGTH = 50;
const MAX_TAG_LENGTH = 50;
const MAX_CONTENT_LENGTH = 300000;

// Helper function to count Unicode characters
const countUnicodeCharacters = (str) => {
  return Array.from(str).length;
};

export default function CreatePromptPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 新增状态：实时字数计数
  const [titleCharCount, setTitleCharCount] = useState(0);
  const [contentCharCount, setContentCharCount] = useState(0);
  const [tagsCharCount, setTagsCharCount] = useState(0);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/create-prompt');
    }
  }, [status, router]);
  
  // 更新实时字数计数
  useEffect(() => {
    setTitleCharCount(countUnicodeCharacters(title));
  }, [title]);

  useEffect(() => {
    setContentCharCount(countUnicodeCharacters(content));
  }, [content]);

  useEffect(() => {
    // 对于标签，我们计算整个输入框的字符数，而不是单个标签的
    setTagsCharCount(countUnicodeCharacters(tags));
  }, [tags]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage('');

    // 验证标题和内容是否为空
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空！');
      setIsSubmitting(false);
      return;
    }

    // 验证标题字数 (使用 Unicode 字符计数)
    if (countUnicodeCharacters(title) > MAX_TITLE_LENGTH) {
      setError(`标题字数不能超过 ${MAX_TITLE_LENGTH} 字！`);
      setIsSubmitting(false);
      return;
    }

    // 验证内容字数 (使用 Unicode 字符计数)
    if (countUnicodeCharacters(content) > MAX_CONTENT_LENGTH) {
      setError(`内容字数不能超过 ${MAX_CONTENT_LENGTH} 字！`);
      setIsSubmitting(false);
      return;
    }

    // 处理标签输入：使用正则表达式分割中英文逗号，去除空白，过滤空字符串
    const processedTags = tags
      ? tags.split(/[,，]/).map(tag => tag.trim()).filter(tag => tag !== '')
      .filter((tag, index, self) => self.indexOf(tag) === index) //去除重复的标签
      : []; // 如果 tags 为空字符串，直接得到空数组

    // 验证每个标签的字数 (使用 Unicode 字符计数)
    for (const tag of processedTags) {
      if (countUnicodeCharacters(tag) > MAX_TAG_LENGTH) {
        setError(`单个标签字数不能超过 ${MAX_TAG_LENGTH} 字！`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          tags: processedTags,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || '创建 Prompt 失败');
      }

      setTitle('');
      setContent('');
      setTags('');
      // 重置字数计数
      setTitleCharCount(0);
      setContentCharCount(0);
      setTagsCharCount(0);

      setSuccessMessage(data.message || 'Prompt 创建成功，等待审核！');
      setTimeout(() => {
        router.push('/'); 
      }, 2000); 

    } catch (err) {
      console.error("Create prompt error:", err);
      setError(err.message || '发生未知错误，请稍后再试。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (status === 'loading') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>加载中...</p>
      </div>
    );
  }
  
  if (status === 'unauthenticated') {
    return null; 
  }
  
  return (
    <>
      <Head>
        <title>创建新提示 | AI提示库</title>
        <meta name="description" content="创建新的AI聊天提示" />
      </Head>
      
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/" className={styles.backButton}>
            <MdArrowBack />
            <span>返回</span>
          </Link>
          <h1 className={styles.title}>创建新提示</h1>
        </div>
        
        {error && (
          <div className={styles.errorAlert}>
            <p>{error}</p>
          </div>
        )}
        
        {successMessage && (
          <div className={styles.successAlert}>
            <p>{successMessage}</p>
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
              placeholder={`输入提示标题 (最多 ${MAX_TITLE_LENGTH} 字)`}
              className={styles.input}
              required
            />
            {/* 显示实时标题字数 */}
            <p className={styles.charCount}>
              当前字数: {titleCharCount} / {MAX_TITLE_LENGTH}
            </p>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="content" className={styles.label}>内容</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`输入提示内容 (最多 ${MAX_CONTENT_LENGTH} 字)`}
              className={styles.textarea}
              rows={8}
              required
            />
            {/* 显示实时内容字数 */}
            <p className={styles.charCount}>
              当前字数: {contentCharCount} / {MAX_CONTENT_LENGTH}
            </p>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="tags" className={styles.label}>标签</label>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={`例如: AI, 写作, 创意 (单个标签最多 ${MAX_TAG_LENGTH} 字)`}
              className={styles.input}
            />
             {/* 显示实时标签输入框总字数 */}
            <p className={styles.charCount}>
              当前字数: {tagsCharCount} / {MAX_TAG_LENGTH}
            </p>
          </div>
          
          <div className={styles.actions}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={() => router.push('/')}
            >
              取消
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? '提交中...' : '创建提示'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export const dynamic = 'force-dynamic'; 