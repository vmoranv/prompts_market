import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';
import PromptsList from '../components/PromptsList';
import Head from 'next/head';
import { useTheme } from '../contexts/ThemeContext';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { MdLightbulb, MdShare, MdSync, MdSearch, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdTrendingUp, MdFavorite, MdAccessTime, MdVisibility } from 'react-icons/md';
import { useSession } from 'next-auth/react';

export default function Home() {
  const { data: session, status } = useSession();
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [paginationInfo, setPaginationInfo] = useState({
    totalPages: 1,
    hasMore: false,
    currentPage: 1,
  });
  const [allPrompts, setAllPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTag, setFilterTag] = useState('');
  
  // 判断当前用户是否为管理员
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;
  
  // 排序选项配置
  const sortOptions = [
    { value: 'createdAt', label: '最新', icon: MdAccessTime },
    { value: 'likesCount', label: '最受欢迎', icon: MdFavorite },
    { value: 'viewCount', label: '最多浏览', icon: MdVisibility },
  ];
  
  // 搜索处理函数
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // 搜索时重置到第一页
    setIsSearching(true);
  };
  
  // 清除搜索
  const clearSearch = () => {
    setSearch('');
    setIsSearching(false);
    setCurrentPage(1);
  };
  
  // 处理排序改变
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      // 如果点击同一个排序字段，切换排序顺序
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      // 如果是新的排序字段，默认使用降序
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    setCurrentPage(1); // 排序改变时重置到第一页
  };
  
  // 分页处理函数
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= (paginationInfo.totalPages || 1)) {
      setCurrentPage(newPage);
    }
  };
  
  // 回调函数，用于接收 PromptsList 传递的分页信息
  const handlePaginationUpdate = (newPagination) => {
    setPaginationInfo(newPagination);
    if (newPagination.currentPage !== currentPage) {
        setCurrentPage(newPagination.currentPage);
    }
  };
  
  // 构建排序字符串用于API调用
  const getSortString = () => {
    const prefix = sortOrder === 'desc' ? '-' : '';
    return `${prefix}${sortBy}`;
  };
  
  // 获取所有 Prompt 的函数
  const fetchPrompts = async () => {
    setLoading(true);
    setError(null);
    try {
      // 构建排序字符串用于API调用
      const sortString = getSortString();

      let apiUrl = `/api/prompts?sort=${sortString}&page=${currentPage}`;

      // 如果用户已登录，获取该用户的所有提示词（包括未审核和被拒绝的）
      // 否则，只获取已发布的公共提示词
      if (session?.user?.id) {
        // 获取当前用户的所有 Prompt，并应用排序
        apiUrl += `&userId=${session.user.id}&status=all`; // status=all 获取所有状态
      } else {
        // 获取所有已发布的 Prompt，并应用排序
        apiUrl += `&status=published`;
      }

      const res = await fetch(apiUrl);

      if (!res.ok) {
        throw new Error(`Failed to fetch prompts: ${res.status}`);
      }
      const data = await res.json();

      // 直接使用从 API 获取的数据，因为 API 已经处理了过滤和排序
      setAllPrompts(data.data || []);
      // 更新分页信息（如果 API 返回了分页信息）
      if (data.pagination) {
          setPaginationInfo(data.pagination);
      }


    } catch (err) {
      console.error('Error fetching prompts:', err);
      setError(err.message);
      setAllPrompts([]); // 出错时清空列表
      setPaginationInfo({ // 出错时重置分页信息
          totalPages: 1,
          hasMore: false,
          currentPage: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 添加currentPage作为依赖项，确保页面变化时重新获取数据
    fetchPrompts();
  }, [sortBy, sortOrder, filterTag, session, currentPage]); // 添加currentPage作为依赖项

  // 处理标签点击，更新过滤标签
  const handleTagClick = (tag) => {
    setFilterTag(tag);
    setSearch(''); // 清空搜索框
  };

  // 处理搜索输入
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setIsSearching(true);
  };
  
  // 过滤 Prompt 的辅助函数
  const filterPrompts = (searchText) => {
    const regex = new RegExp(searchText, 'i'); // 'i' for case-insensitive
    return allPrompts.filter(
      (item) =>
        regex.test(item.author?.name) ||
        regex.test(item.tag) ||
        regex.test(item.title) ||
        regex.test(item.content)
    );
  };

  // 根据过滤标签过滤 Prompt
  const filterPromptsByTag = (tag) => {
    if (!tag) return allPrompts;
    const regex = new RegExp(`^${tag}$`, 'i'); // 精确匹配标签
    return allPrompts.filter(item =>
      item.tag.split(',').some(t => regex.test(t.trim()))
    );
  };

  // 根据搜索文本或过滤标签显示 Prompt
  const displayedPrompts = search
    ? filterPrompts(search)
    : filterPromptsByTag(filterTag);
  
  // 处理点赞成功后的 Prompt 列表更新
  const handleLikeSuccess = (promptId, newLikesCount, likedByCurrentUser) => {
    setAllPrompts(prevPrompts =>
      prevPrompts.map(prompt =>
        prompt._id === promptId
          ? { ...prompt, likesCount: newLikesCount, likedBy: likedByCurrentUser ? [...prompt.likedBy, session.user.id] : prompt.likedBy.filter(id => id !== session.user.id) }
          : prompt
      )
    );
  };

  // 处理 Prompt 删除成功
  const handlePromptDeleted = (deletedPromptId) => {
    // 从 allPrompts 状态中移除被删除的 Prompt
    setAllPrompts(prevPrompts =>
      prevPrompts.filter(prompt => prompt._id !== deletedPromptId)
    );
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Prompt Market - 发现高质量的 Prompts</title>
        <meta name="description" content="探索、分享和使用高质量的 AI Prompts" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={`${styles.hero} ${isDark ? styles.heroDark : ''}`}>
        <h1 className={styles.title}>欢迎来到 Prompt 市场</h1>
        <p className={styles.description}>发现、分享和使用高质量的 Prompts</p>
        
        <div className={styles.features}>
          <div className={styles.featureItem}>
            <MdLightbulb className={styles.featureIcon} />
            <h3>发现灵感</h3>
            <p>浏览高质量的提示词，激发创意思维</p>
          </div>
          
          <div className={styles.featureItem}>
            <MdShare className={styles.featureIcon} />
            <h3>分享知识</h3>
            <p>分享您的专业提示词，帮助他人提高效率</p>
          </div>
          
          <div className={styles.featureItem}>
            <MdSync className={styles.featureIcon} />
            <h3>持续更新</h3>
            <p>定期更新最新、最有效的 AI 提示词</p>
          </div>
        </div>
      </div>

      <main className={styles.mainContent}>
        {/* 搜索和排序区域 */}
        <div className={styles.searchAndSortContainer}>
          {/* 搜索栏 */}
          <div className={styles.searchContainer}>
            <form onSubmit={handleSearch} className={styles.searchForm}>
              <div className={styles.searchInputWrapper}>
                <MdSearch className={styles.searchIcon} />
                <input
                  type="text"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="搜索提示词或标签..."
                  className={styles.searchInput}
                />
              </div>
              {search && (
                <button type="button" onClick={clearSearch} className={styles.clearButton}>
                  清除
                </button>
              )}
            </form>
          </div>
          
          {/* 排序按钮组 */}
          <div className={styles.sortContainer}>
            <div className={styles.sortButtonGroup}>
              {sortOptions.map((option) => {
                const IconComponent = option.icon;
                const isActive = sortBy === option.value;
                const isDescending = sortOrder === 'desc';
                
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                    className={`${styles.sortButton} ${isActive ? styles.sortButtonActive : ''}`}
                    title={`按${option.label}${isActive ? (isDescending ? '降序' : '升序') : '排序'}`}
                  >
                    <IconComponent className={styles.sortButtonIcon} />
                    <span className={styles.sortButtonText}>{option.label}</span>
                    {isActive && (
                      <span className={`${styles.sortOrder} ${isDescending ? styles.sortDesc : styles.sortAsc}`}>
                        {isDescending ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* 提示列表组件，传递搜索和分页参数，以及回调 */}
        {loading ? (
          <p>加载中...</p>
        ) : error ? (
          <p className={styles.error}>加载 Prompt 失败: {error}</p>
        ) : (
          <PromptsList 
            data={displayedPrompts}
            currentPage={currentPage}
            onPaginationChange={handlePaginationUpdate}
            isAdmin={isAdmin}
            sortBy={getSortString()}
            onLikeSuccess={handleLikeSuccess}
            onDeleteSuccess={handlePromptDeleted}
          />
        )}
        
        {/* 分页控件 */}
        {(paginationInfo.totalPages > 1 || paginationInfo.totalPrompts > 0) && (
          <div className={styles.pagination}>
            {/* 首页按钮 */}
            <button
              onClick={() => handlePageChange(1)} // 点击跳转到第一页
              disabled={currentPage === 1} // 当前页是第一页时禁用
              className={styles.pageButton}
            >
              首页
            </button>
            {/* 上一页按钮 */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={styles.pageButton}
            >
              <MdKeyboardArrowLeft />
              上一页
            </button>
            <span className={styles.pageInfo}>
              第 {currentPage} 页 {paginationInfo.totalPages > 0 ? `/ 共 ${paginationInfo.totalPages} 页` : ''}
            </span>
            {/* 下一页按钮 */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!paginationInfo.hasMore || currentPage >= paginationInfo.totalPages}
              className={styles.pageButton}
            >
              下一页
              <MdKeyboardArrowRight />
            </button>
            {/* 尾页按钮 */}
            <button
              onClick={() => handlePageChange(paginationInfo.totalPages)} // 点击跳转到最后一页
              disabled={currentPage === paginationInfo.totalPages} // 当前页是最后一页时禁用
              className={styles.pageButton}
            >
              尾页
            </button>
          </div>
        )}

        {/* 添加 Vercel Speed Insights */}
        <SpeedInsights />
      </main>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} <a href="https://github.com/vmoranv/prompts_market" >Prompt 市场</a>. 保留所有权利.</p>
      </footer>
    </div>
  );
} 