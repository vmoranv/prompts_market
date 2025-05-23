import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { MdArrowBack, MdCheck, MdClose, MdSearch, MdFilterList, MdCheckCircle, MdCancel } from 'react-icons/md';
import styles from '../../styles/AdminReviewPage.module.css';
import SafeMarkdown from '../../components/SafeMarkdown';

// 单个待审核 Prompt 卡片组件
function PendingPromptCard({ prompt, onApprove, onReject }) {
  const handleRejectClick = () => {
    onReject(prompt._id);
  };

  const handleApproveClick = () => {
    onApprove(prompt._id);
  };

  return (
    <div className={styles.promptCard}>
      <div className={styles.promptHeader}>
        <h3 className={styles.promptTitle}>{prompt.title || '无标题'}</h3>
        <div className={styles.authorInfo}>
          {prompt.author?.image && 
            <img src={prompt.author.image} alt={prompt.author.name || '作者头像'} className={styles.authorImage} />
          }
          <div className={styles.authorDetails}>
            <span className={styles.authorName}>
              {prompt.author && (prompt.author.name || prompt.author.email)
                ? `${prompt.author.name || '未知名称'}`
                : '未知作者'}
            </span>
            <span className={styles.promptDate}>{new Date(prompt.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      <div className={styles.promptContentPreview}>
        <SafeMarkdown content={prompt.content} />
      </div>
      
      <div className={styles.tagsContainer}>
        {prompt.tags && prompt.tags.length > 0 ? (
          prompt.tags.map(tag => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))
        ) : (
          <span className={styles.noTags}>无标签</span>
        )}
      </div>

      <div className={styles.actions}>
        <button onClick={handleApproveClick} className={`${styles.button} ${styles.approveButton}`}>
          <MdCheck className={styles.buttonIcon} />
          批准
        </button>
        <button onClick={handleRejectClick} className={`${styles.button} ${styles.rejectButton}`}>
          <MdClose className={styles.buttonIcon} />
          拒绝
        </button>
      </div>
    </div>
  );
}


export default function AdminReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pendingPrompts, setPendingPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' }); // 用于显示操作结果
  const [showFilters, setShowFilters] = useState(false);

  // 批量操作状态
  const [batchFilter, setBatchFilter] = useState({
    titleRegex: '',
    contentRegex: '',
    authorId: '',
    tags: '', // 将以逗号分隔的字符串形式输入，然后转换
  });
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  useEffect(() => {
    if (status === 'loading') return; // 等待 session 加载完成
    if (!session || session.user?.role !== 'admin') {
      router.replace('/'); // 如果不是管理员，重定向到首页
      return;
    }

    async function fetchPendingPrompts() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/prompts/pending');
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || `Error: ${res.status}`);
        }
        const data = await res.json();
        if (data.success) {
          setPendingPrompts(data.prompts || []);
        } else {
          throw new Error(data.message || '获取待审核提示失败');
        }
      } catch (err) {
        console.error('获取待审核提示错误:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPendingPrompts();
  }, [session, status, router]);

  useEffect(() => {
    if (session && session.user) {
      console.log('当前用户会话:', {
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
      });
    }
  }, [session]);

  // 批准单个提示
  const handleApprove = async (promptId) => {
    try {
      const response = await fetch(`/api/admin/prompts/${promptId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clearCache: true }),
      });
      
      console.log('批准响应状态:', response.status);
      
      const text = await response.text();
      console.log('批准响应内容:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON 解析错误:', parseError);
        throw new Error('服务器响应格式错误');
      }
      
      if (data.success) {
        setPendingPrompts(prevPrompts => prevPrompts.filter(p => p._id !== promptId));
        setActionMessage({ type: 'success', text: '提示已批准' });
        setTimeout(() => setActionMessage({ type: '', text: '' }), 3000);
      } else {
        throw new Error(data.message || '批准操作失败');
      }
    } catch (error) {
      console.error('批准 prompt 错误:', error);
      setActionMessage({
        type: 'error',
        text: `批准失败: ${error.message}`
      });
    }
  };

  // 拒绝单个提示 - 已简化，无需理由
  const handleReject = async (promptId) => {
    try {
      const res = await fetch(`/api/admin/prompts/${promptId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          clearCache: true // 告诉API需要清除缓存
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Error: ${res.status}`);
      }
      
      // 更新界面
      setPendingPrompts(prevPrompts => prevPrompts.filter(p => p._id !== promptId));
      setActionMessage({ type: 'success', text: '提示已拒绝' });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('拒绝提示错误:', err);
      setActionMessage({ type: 'error', text: `拒绝失败: ${err.message}` });
      setTimeout(() => setActionMessage({ type: '', text: '' }), 3000);
    }
  };

  // 批量操作处理
  const handleBatchFilterChange = (e) => {
    const { name, value } = e.target;
    setBatchFilter(prev => ({ ...prev, [name]: value }));
  };

  // 批量批准
  const handleBatchApprove = async () => {
    if (!confirm('确定要批量批准符合条件的提示吗？')) return;
    setIsBatchProcessing(true);
    
    try {
      const res = await fetch('/api/admin/prompts/batch-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            titleRegex: batchFilter.titleRegex.trim() || undefined,
            contentRegex: batchFilter.contentRegex.trim() || undefined,
            authorId: batchFilter.authorId.trim() || undefined,
            tags: batchFilter.tags.trim() ? batchFilter.tags.split(',').map(tag => tag.trim()) : undefined,
          }
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Error: ${res.status}`);
      }
      
      const data = await res.json();
      
      // 更新界面 - 移除所有被批准的提示
      if (data.approvedCount > 0) {
        // 重新获取待审核提示
        const refreshRes = await fetch('/api/admin/prompts/pending');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.success) {
            setPendingPrompts(refreshData.prompts || []);
          }
        }
        
        setActionMessage({ type: 'success', text: `已批准 ${data.approvedCount} 个提示` });
      } else {
        setActionMessage({ type: 'info', text: '没有提示符合批准条件' });
      }
    } catch (err) {
      console.error("Batch action error:", err);
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsBatchProcessing(false);
      setTimeout(() => setActionMessage({ type: '', text: '' }), 3000);
    }
  };

  // 批量拒绝 - 简化，无需理由
  const handleBatchReject = async () => {
    if (!confirm('确定要批量拒绝符合条件的提示吗？')) return;
    setIsBatchProcessing(true);
    
    try {
      const res = await fetch('/api/admin/prompts/batch-reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            titleRegex: batchFilter.titleRegex.trim() || undefined,
            contentRegex: batchFilter.contentRegex.trim() || undefined,
            authorId: batchFilter.authorId.trim() || undefined,
            tags: batchFilter.tags.trim() ? batchFilter.tags.split(',').map(tag => tag.trim()) : undefined,
          },
          clearCache: true // 告诉API需要清除缓存
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Error: ${res.status}`);
      }
      
      const data = await res.json();
      
      // 更新界面 - 移除所有被拒绝的提示
      if (data.rejectedCount > 0) {
        // 重新获取待审核提示
        const refreshRes = await fetch('/api/admin/prompts/pending');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.success) {
            setPendingPrompts(refreshData.prompts || []);
          }
        }
        
        setActionMessage({ type: 'success', text: `已拒绝 ${data.rejectedCount} 个提示` });
      } else {
        setActionMessage({ type: 'info', text: '没有提示符合拒绝条件' });
      }
    } catch (err) {
      console.error("Batch action error:", err);
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsBatchProcessing(false);
      setTimeout(() => setActionMessage({ type: '', text: '' }), 3000);
    }
  };

  if (status === 'loading' || (status !== 'unauthenticated' && loading)) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session || session.user?.role !== 'admin') {
    // 这种情况下已经在 useEffect 中设置了重定向，这里可以返回 null 或者一个简单的加载界面
    return null;
  }

  return (
    <>
      <Head>
        <title>审核提示 - 管理员</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/" className={styles.backButton}>
            <MdArrowBack />
            <span>返回主页</span>
          </Link>
          <h1 className={styles.title}>审核提示</h1>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <p>{error}</p>
          </div>
        )}

        <div className={styles.statsBar}>
          <div className={styles.statsItem}>
            <span className={styles.statsLabel}>待审核:</span>
            <span className={styles.statsValue}>{pendingPrompts ? pendingPrompts.length : 0}</span>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`${styles.filterToggle} ${showFilters ? styles.filterActive : ''}`}
          >
            <MdFilterList className={styles.filterIcon} />
            <span>{showFilters ? '隐藏筛选' : '显示筛选'}</span>
          </button>
        </div>

        {showFilters && (
          <div className={styles.batchFilterSection}>
            <h3 className={styles.filterTitle}>批量操作筛选条件</h3>
            
            <div className={styles.filterFormGroup}>
              <label className={styles.filterLabel}>标题包含:</label>
              <input
                type="text"
                name="titleRegex"
                value={batchFilter.titleRegex}
                onChange={handleBatchFilterChange}
                className={styles.filterInput}
                placeholder="输入标题关键词..."
              />
            </div>
            
            <div className={styles.filterFormGroup}>
              <label className={styles.filterLabel}>内容包含:</label>
              <input
                type="text"
                name="contentRegex"
                value={batchFilter.contentRegex}
                onChange={handleBatchFilterChange}
                className={styles.filterInput}
                placeholder="输入内容关键词..."
              />
            </div>
            
            <div className={styles.filterFormGroup}>
              <label className={styles.filterLabel}>作者ID:</label>
              <input
                type="text"
                name="authorId"
                value={batchFilter.authorId}
                onChange={handleBatchFilterChange}
                className={styles.filterInput}
                placeholder="输入作者ID..."
              />
            </div>
            
            <div className={styles.filterFormGroup}>
              <label className={styles.filterLabel}>标签(逗号分隔):</label>
              <input
                type="text"
                name="tags"
                value={batchFilter.tags}
                onChange={handleBatchFilterChange}
                className={styles.filterInput}
                placeholder="输入标签，用逗号分隔..."
              />
            </div>
            
            <div className={styles.batchActions}>
              <button
                onClick={handleBatchApprove}
                disabled={isBatchProcessing}
                className={`${styles.button} ${styles.batchApproveButton}`}
              >
                <MdCheckCircle className={styles.buttonIcon} />
                批量批准
              </button>
              <button
                onClick={handleBatchReject}
                disabled={isBatchProcessing}
                className={`${styles.button} ${styles.batchRejectButton}`}
              >
                <MdCancel className={styles.buttonIcon} />
                批量拒绝
              </button>
            </div>
          </div>
        )}

        {actionMessage.text && (
          <div className={`${styles.actionMessage} ${styles[actionMessage.type]}`}>
            {actionMessage.text}
          </div>
        )}

        <div className={styles.promptsContainer}>
          {pendingPrompts && pendingPrompts.length > 0 ? (
            pendingPrompts.map(prompt => (
              <PendingPromptCard
                key={prompt._id}
                prompt={prompt}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>没有待审核的提示</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const dynamic = 'force-dynamic'; 