import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { MdArrowBack, MdContentCopy, MdCheck, MdFavorite, MdVisibility, MdEdit, MdFlag, MdFavoriteBorder, MdCode, MdTextFormat, MdPlayArrow } from 'react-icons/md';
import styles from '../../styles/PromptDetail.module.css';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import SafeMarkdown from '../../components/SafeMarkdown';

export default function PromptDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // 评论相关的状态
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentError, setCommentError] = useState(null);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentPendingApproval, setCommentPendingApproval] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState(null);

  // 点赞相关的状态
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Markdown 渲染切换状态
  const [isMarkdownEnabled, setIsMarkdownEnabled] = useState(true);

  // 获取评论 - 移到组件顶层
  const fetchComments = async () => {
    if (!id) return; // 确保 id 存在
    setLoadingComments(true);
    setCommentError(null);
    try {
      const response = await fetch(`/api/prompts/${id}/comments`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取评论失败');
      }
      const data = await response.json();
      if (data.success) {
        setComments(data.data.filter(comment => comment.status === 'approved'));
      } else {
        throw new Error(data.message || '获取评论数据失败');
      }
    } catch (err) {
      console.error('加载评论错误:', err);
      setCommentError(err.message);
    } finally {
      setLoadingComments(false);
    }
  };

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
        if (data.success) {
          setPrompt(data.data);
          // 初始化点赞状态和数量
          if (session?.user) {
            setIsLiked(Array.isArray(data.data.likes) && data.data.likes.includes(session.user.id));
          }
          setLikesCount(Array.isArray(data.data.likes) ? data.data.likes.length : 0);
        } else {
          setError(data.error || '无法加载提示详情');
        }
        
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
    fetchComments(); // 在加载 Prompt 详情后获取评论
  }, [id, session]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    
    setTimeout(() => {
      setCopied(false);
    }, 200);
  };
  
  // 格式化日期函数 (使用原生 JS Date 方法)
  const formatPromptDate = (dateString) => {
    if (!dateString) return '未知日期';
    try {
      const date = new Date(dateString);
      // 使用 toLocaleString 提供更本地化的格式
      const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return date.toLocaleString(undefined, options); // undefined 使用用户默认语言环境
    } catch (e) {
      console.error("格式化日期错误:", e);
      return '无效日期';
    }
  };
  
  // 处理评论提交
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newCommentContent.trim()) {
      alert('评论内容不能为空');
      return;
    }
    if (!session) {
      alert('请登录后发表评论');
      return;
    }

    setIsSubmittingComment(true);
    setCommentError(null);
    setCommentPendingApproval(false);

    try {
      const response = await fetch(`/api/prompts/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newCommentContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `发表评论失败: ${response.status}`);
      }

      if (data.success) {
        setNewCommentContent('');
        if (data.data.status === 'pending') {
          setCommentPendingApproval(true);
        } else {
          fetchComments();
        }
      } else {
         throw new Error(data.error || '发表评论失败');
      }

    } catch (err) {
      console.error("发表评论失败:", err);
      setCommentError(err.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  // 处理举报评论
  const handleReportComment = async (commentId) => {
    if (status === 'loading') {
      alert('会话加载中，请稍候...');
      return;
    }
    if (!session) {
      alert('请登录后举报评论');
      return;
    }
    if (!confirm('确定要举报此评论吗？')) {
      return;
    }

    setReportingCommentId(commentId); // 设置正在举报的评论 ID

    try {
      const response = await fetch(`/api/comments/${commentId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // 检查是否是"已举报"的特定错误
        if (response.status === 400 && data.error === '您已举报过此评论') {
          alert('您已举报过此评论，无需重复举报。');
        } else {
          // 处理其他类型的错误
          throw new Error(data.error || `举报评论失败: ${response.status}`);
        }
      } else {
        if (data.success) {
          alert('评论举报成功！感谢您的反馈。');
          // 可选：更新本地评论列表中的 reportsCount，或者重新获取评论
          // 重新获取评论可以确保看到最新的 reportsCount
          fetchComments();
        } else {
           // 理论上 response.ok 为 true 时 success 应该为 true，但为了健壮性保留
           throw new Error(data.error || '举报评论失败');
        }
      }

    } catch (err) {
      console.error("举报评论失败:", err);
      // 对于非特定错误，显示通用错误信息
      if (!['您已举报过此评论'].includes(err.message)) {
         alert(`举报评论失败: ${err.message}`);
      }
    } finally {
      setReportingCommentId(null); // 重置正在举报的评论 ID
    }
  };
  
  // 切换 Markdown 渲染模式
  const toggleMarkdown = () => {
    setIsMarkdownEnabled(!isMarkdownEnabled);
  };
  
  // 处理点赞/取消点赞
  const handleLike = async () => {
    if (!session) {
      // 如果用户未登录，可以提示登录或跳转到登录页
      alert('请先登录才能点赞！');
      router.push('/signin'); // 或者根据需要跳转到登录页
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 根据当前点赞状态决定使用 POST (点赞/取消点赞)
      // 后端 /api/prompts/[id]/like 路由的 POST 方法已经处理了点赞和取消点赞的逻辑
      const method = 'POST'; // 始终使用 POST 方法

      const res = await fetch(`/api/prompts/${id}/like`, {
        method: method, // 使用上面确定的方法
        headers: {
          'Content-Type': 'application/json',
        },
        // 对于 POST 请求，如果需要发送 body，可以在这里添加
        // body: JSON.stringify({ userId: session.user.id }), // 后端从 token 获取 userId，这里不需要显式发送
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `点赞操作失败: ${res.status}`);
      }

      const data = await res.json();

      // 根据后端返回的数据更新点赞状态和数量
      setIsLiked(data.data.likedByCurrentUser);
      setLikesCount(data.data.likesCount);

    } catch (err) {
      console.error('点赞操作错误:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
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
        <meta 
          name="description" 
          content={`${prompt.title} - ${prompt.content ? prompt.content.substring(0, 160) : ''}...`} 
        />
        <meta property="og:title" content={prompt.title} />
        <meta property="og:description" content={prompt.description} />
        <meta property="og:type" content="article" />
      </Head>
      
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/" className={styles.backButton} aria-label="返回主页">
            <MdArrowBack size={24} />
            <span>返回</span>
          </Link>
          <h1 className={styles.title}>{prompt.title}</h1>
        </div>
        
        <div className={styles.promptCard}>
          <div className={styles.headerRow}>
            <Link href={`/dashboard?userId=${prompt.author?._id}`} className={styles.authorLink}>
              <div className={styles.authorInfo}>
                {prompt.author?.image ? (
                  <Image
                    src={prompt.author.image}
                    alt={prompt.author.name || '作者头像'}
                    className={styles.authorAvatar}
                    width={40}
                    height={40}
                    objectFit="cover"
                  />
                ) : (
                  <div className={styles.authorAvatar}>{prompt.author?.name?.[0] || '?'}</div>
                )}
                <div className={styles.authorMeta}>
                  <p className={styles.authorName}>{prompt.author?.name || '未知作者'}</p>
                  <p className={styles.publishDate}>{formatPromptDate(prompt.createdAt)}</p>
                </div>
              </div>
            </Link>

            <div className={styles.buttonContainer}>
              <Link href={`/try-prompt/${id}`} className={styles.tryButton}>
                <MdPlayArrow size={18} />
                试用此Prompt
              </Link>
              {canEdit && (
                <button
                  onClick={() => setEditing(!editing)}
                  className={styles.editButton}
                >
                  <MdEdit size={18} />
                  编辑
                </button>
              )}
              <button
                onClick={handleCopy}
                className={styles.copyButton}
              >
                {copied ? <MdCheck size={18} /> : <MdContentCopy size={18} />}
                {copied ? '已复制' : '复制'}
              </button>
              <button
                className={`${styles.actionButton} ${isMarkdownEnabled ? styles.active : ''}`}
                onClick={toggleMarkdown}
                aria-label={isMarkdownEnabled ? '切换到纯文本' : '切换到 Markdown 渲染'}
              >
                {isMarkdownEnabled ? <MdTextFormat /> : <MdCode />}
              </button>
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.contentWrapper}>
              {isMarkdownEnabled ? (
                <SafeMarkdown content={prompt.content} />
              ) : (
                <pre className={styles.plainTextContent}>{prompt.content || '内容加载失败或为空'}</pre>
              )}
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

        {/* 评论模块 */}
        <div className={styles.commentsSection}>
          <h2>评论 ({comments.length})</h2>

          {/* 评论表单 */}
          {session ? ( // 只有登录用户才能看到评论表单
            <form onSubmit={handleCommentSubmit} className={styles.commentForm}>
              <textarea
                className={styles.commentInput}
                placeholder="留下您的评论..."
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                rows="4"
                disabled={isSubmittingComment}
              ></textarea>
              <button
                type="submit"
                className={styles.submitCommentButton}
                disabled={isSubmittingComment || !newCommentContent.trim()}
              >
                {isSubmittingComment ? '提交中...' : '发表评论'}
              </button>
              {commentError && <p className={styles.commentError}>{commentError}</p>}
            </form>
          ) : (
            <p className={styles.loginPrompt}>请 <Link href="/api/auth/signin" className={styles.loginLink}>登录</Link> 后发表评论。</p>
          )}

          {/* 评论待审核提示 */}
          {commentPendingApproval && (
            <p className={styles.pendingApprovalMessage}>您的评论已提交，正在等待管理员审核。</p>
          )}

          {/* 评论列表 */}
          {loadingComments ? (
            <p>加载评论中...</p>
          ) : commentError && !comments.length ? (
             <p className={styles.commentError}>加载评论失败: {commentError}</p>
          ) : comments.length === 0 ? (
            <p>还没有评论，快来发表第一条评论吧！</p>
          ) : (
            <ul className={styles.commentList}>
              {comments.map(comment => (
                <li key={comment._id} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <div className={styles.commentAuthorInfo}>
                      {comment.author?.image ? (
                        <Link href={`/dashboard?userId=${comment.author._id}`} className={styles.authorLink}>
                          <Image
                            src={comment.author.image}
                            alt={comment.author.name || '评论者头像'}
                            className={styles.commentAvatar}
                            width={30}
                            height={30}
                            objectFit="cover"
                          />
                        </Link>
                      ) : (
                        <div className={styles.commentAvatar}>{comment.author?.name?.[0] || '?'}</div>
                      )}
                      <div className={styles.commentAuthorMeta}>
                        <p className={styles.commentAuthorName}>{comment.author?.name || '未知用户'}</p>
                        <p className={styles.commentDate}>{formatPromptDate(comment.createdAt)}</p>
                      </div>
                    </div>
                    {comment.status === 'pending' && (
                       <span className={styles.commentStatusPending}>待审核</span>
                    )}
                    {comment.status === 'approved' && (
                       <span className={styles.commentStatusApproved}>已通过</span>
                    )}
                  </div>
                  <p className={styles.commentContent}>{comment.content}</p>
                  {session && (
                     <button
                       onClick={() => handleReportComment(comment._id)}
                       disabled={reportingCommentId === comment._id}
                       className={styles.reportButton}
                       title="举报此评论"
                     >
                       <MdFlag size={18} />
                       {reportingCommentId === comment._id ? '举报中...' : '举报'}
                     </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export const dynamic = 'force-dynamic'; 