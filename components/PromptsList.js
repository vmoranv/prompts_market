import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import PromptCard from './PromptCard';
import styles from '../styles/PromptsList.module.css'; // 我们将为列表添加一些样式
import Link from 'next/link';
import { MdInfo } from 'react-icons/md';

export default function PromptsList({ searchQuery = '', currentPage = 1, onPaginationChange, isAdmin }) {
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
    async function fetchPrompts() {
      setLoading(true);
      setError(null);
      
      try {
        let url = `/api/prompts?page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
        
        // 如果有搜索查询，添加到 URL 参数中
        if (searchQuery) {
          url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('获取提示列表失败');
        }
        
        const data = await response.json();
        console.log('API 响应数据:', data); // 添加日志
        
        if (data.success) {
          setPrompts(data.data);
          console.log('分页信息:', data.pagination); // 添加日志
          const newPagination = data.pagination || {
            totalPrompts: 0,
            totalPages: 0,
            currentPage: 1,
            pageSize: ITEMS_PER_PAGE,
            hasMore: false
          };
          setPagination(newPagination);
          if (onPaginationChange) {
            onPaginationChange(newPagination);
          }
        } else {
          throw new Error(data.message || '获取提示列表失败');
        }
      } catch (err) {
        console.error('获取提示列表错误:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchPrompts();
  }, [searchQuery, currentPage]);

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
        <MdInfo className={styles.emptyIcon} />
        <p>未找到匹配 "{searchQuery}" 的提示词</p>
        <p className={styles.emptySuggestion}>尝试使用不同的关键词或浏览我们的全部内容</p>
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