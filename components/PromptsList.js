import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import PromptCard from './PromptCard';
import styles from '../styles/PromptsList.module.css'; // 我们将为列表添加一些样式
import Link from 'next/link';
import { MdInfo, MdSentimentDissatisfied } from 'react-icons/md';

export default function PromptsList({ searchQuery = '', currentPage = 1, onPaginationUpdate, isAdmin, sortBy }) {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    totalPrompts: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 10,
    hasMore: false
  });
  const { data: session } = useSession(); // 获取 session 以传递 currentUserId
  const currentUserId = session?.user?.id;
  
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchPrompts = async () => {
      setLoading(true);
      setError(null);
      try {
        // 构建查询参数
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString()
        });
        
        if (searchQuery) {
          params.append('search', searchQuery);
        }
        
        if (sortBy) {
          params.append('sort', sortBy);
        }

        const res = await fetch(`/api/prompts?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Error: ${res.status}`);
        }
        const data = await res.json();
        console.log('API 响应数据:', data); // 添加日志
        setPrompts(data.data || []);
        
        // 调用回调函数更新父组件的分页信息
        setPagination({
          totalPrompts: data.pagination?.totalPrompts || 0,
          totalPages: data.pagination?.totalPages || 1,
          currentPage: data.pagination?.currentPage || currentPage,
          pageSize: ITEMS_PER_PAGE,
          hasMore: data.pagination?.hasMore || false
        });
        if (onPaginationUpdate) {
          onPaginationUpdate(pagination);
        }
      } catch (err) {
        console.error("Failed to fetch prompts:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, [searchQuery, currentPage, onPaginationUpdate, sortBy]); // 添加 sortBy 作为依赖项

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <MdInfo className={styles.errorIcon} />
        <p>出错了: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className={styles.retryButton}
        >
          重试
        </button>
      </div>
    );
  }

  // 无搜索结果的提示
  if (searchQuery && prompts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <MdSentimentDissatisfied className={styles.emptyIcon} />
        <h3>没有找到提示词</h3>
        <p className={styles.emptySuggestion}>
          尝试使用其他关键词搜索，或者
          <Link href="/create-prompt" className={styles.emptyLink}>创建一个新的提示词</Link>
        </p>
      </div>
    );
  }

  // 无内容提示
  if (prompts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <MdInfo className={styles.emptyIcon} />
        <p>暂无提示词</p>
        <p className={styles.emptySuggestion}>
          成为第一个 <Link href="/create-prompt" className={styles.emptyLink}>分享提示词</Link> 的用户
        </p>
      </div>
    );
  }

  return (
    <div className={styles.promptsListContainer}>
      {searchQuery && (
        <div className={styles.searchResultInfo}>
          <p>搜索 "{searchQuery}" 的结果 ({pagination?.totalPrompts || 0} 个)</p>
        </div>
      )}
      
      <div className={styles.promptsGrid}>
        {prompts.map(prompt => (
          <PromptCard key={prompt._id} prompt={prompt} currentUserId={currentUserId} isAdmin={isAdmin} />
        ))}
      </div>
      
      {pagination.totalPrompts > 0 && (
        <div className={styles.paginationInfo}>
          显示 {(pagination.currentPage - 1) * pagination.pageSize + 1}-
          {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalPrompts)} 
          / 共 {pagination.totalPrompts} 个提示词
        </div>
      )}
    </div>
  );
} 