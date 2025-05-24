import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import styles from '../../styles/AdminComments.module.css'; // 需要创建这个 CSS 文件
import Link from 'next/link';
import { MdCheckCircle, MdCancel, MdDelete, MdVisibility, MdFlag, MdArrowBack } from 'react-icons/md';
import Image from 'next/image';
import Pagination from '../../components/Pagination'; // 请根据您的实际路径调整

// 导入 MUI 组件
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';

export default function AdminCommentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isClient, setIsClient] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalComments, setTotalComments] = useState(0); // 新增总评论数状态

  // 过滤状态
  const [filterStatus, setFilterStatus] = useState('all'); // 默认显示所有评论

  // 获取评论列表的函数
  const fetchComments = async (page, statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comments?page=${page}&status=${statusFilter}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Error: ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setComments(data.data || []);
        setCurrentPage(data.currentPage);
        setTotalPages(data.totalPages);
        setTotalComments(data.totalComments); // 更新总评论数
      } else {
        throw new Error(data.error || '获取评论失败');
      }
    } catch (err) {
      console.error('获取评论错误:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 处理分页变化
  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchComments(page, filterStatus); // 切换页面时重新获取评论
  };

  // 处理状态过滤变化
  const handleFilterChange = (event) => {
    const newStatus = event.target.value;
    setFilterStatus(newStatus);
    setCurrentPage(1); // 过滤时重置到第一页
    fetchComments(1, newStatus); // 过滤时重新获取评论
  };

  // 处理批准评论
  const handleApprove = async (commentId) => {
    if (status === 'loading') {
      alert('会话加载中，请稍候...');
      return;
    }
    if (!session) {
      alert('请登录后操作。');
      return;
    }
    if (!confirm('确定要批准此评论吗？')) {
      return;
    }

    // 乐观更新状态
    setComments(comments.map(comment =>
      comment._id === commentId ? { ...comment, status: 'approving' } : comment
    ));

    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'approved' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `批准评论失败: ${response.status}`);
      }

      if (data.success) {
        alert('评论批准成功！');
        // 重新获取评论以确保数据最新
        fetchComments(currentPage, filterStatus);
      } else {
         throw new Error(data.error || '批准评论失败');
      }

    } catch (err) {
      console.error("批准评论失败:", err);
      alert(`批准评论失败: ${err.message}`);
      // 如果失败，回滚乐观更新（或者简单地重新获取数据）
      fetchComments(currentPage, filterStatus);
    }
  };

  // 处理拒绝评论
  const handleReject = async (commentId) => {
    if (status === 'loading') {
      alert('会话加载中，请稍候...');
      return;
    }
    if (!session) {
      alert('请登录后操作。');
      return;
    }
    if (!confirm('确定要拒绝此评论吗？')) {
      return;
    }

    // 乐观更新状态
    setComments(comments.map(comment =>
      comment._id === commentId ? { ...comment, status: 'rejecting' } : comment
    ));

    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `拒绝评论失败: ${response.status}`);
      }

      if (data.success) {
        alert('评论拒绝成功！');
        // 重新获取评论以确保数据最新
        fetchComments(currentPage, filterStatus);
      } else {
         throw new Error(data.error || '拒绝评论失败');
      }

    } catch (err) {
      console.error("拒绝评论失败:", err);
      alert(`拒绝评论失败: ${err.message}`);
      // 如果失败，回滚乐观更新（或者简单地重新获取数据）
      fetchComments(currentPage, filterStatus);
    }
  };


  // 处理删除评论
  const deleteComment = async (commentId) => {
    if (status === 'loading') {
      alert('会话加载中，请稍候...');
      return;
    }
    if (!session) {
      alert('请登录后操作。');
      return;
    }
    if (!confirm('确定要删除此评论吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `删除评论失败: ${response.status}`);
      }

      if (data.success) {
        alert('评论删除成功！');
        // 从本地状态中移除已删除的评论
        setComments(comments.filter(comment => comment._id !== commentId));
        // 如果当前页没有评论了，并且不是第一页，则跳转到上一页
        if (comments.length === 1 && currentPage > 1) {
          handlePageChange(currentPage - 1);
        } else {
           // 否则，重新获取当前页数据（可能影响总页数和总评论数）
           fetchComments(currentPage, filterStatus);
        }
      } else {
         throw new Error(data.error || '删除评论失败');
      }

    } catch (err) {
      console.error("删除评论失败:", err);
      alert(`删除评论失败: ${err.message}`);
    }
  };


  // 组件挂载时获取评论列表
  useEffect(() => {
    setIsClient(true); // 标记组件已在客户端渲染
    if (status === 'authenticated') {
      fetchComments(currentPage, filterStatus);
    }
  }, [status, currentPage, filterStatus]); // 依赖项包括 status, currentPage 和 filterStatus

  // 如果会话加载中或未认证，显示加载或未授权信息
  if (status === 'loading') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>会话加载中...</p>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>!</div>
        <p>您没有权限访问此页面，请登录管理员账号。</p>
        <Link href="/api/auth/signin" className={styles.retryButton}>
          登录
        </Link>
      </div>
    );
  }

  // 如果数据加载中
  if (loading && comments.length === 0) {
     return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>加载评论中...</p>
      </div>
     );
  }

  // 如果加载出错
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>!</div>
        <p>加载评论失败: {error}</p>
        <button className={styles.retryButton} onClick={() => fetchComments(currentPage, filterStatus)}>
          重试
        </button>
      </div>
    );
  }

  // 根据评论状态返回对应的 CSS 类名
  const getStatusClassName = (status) => {
    switch (status) {
      case 'pending':
        return styles.statusPending;
      case 'approved':
        return styles.statusApproved;
      case 'rejected':
        return styles.statusRejected;
      default:
        return ''; // 或者一个默认样式
    }
  };


  return (
    <div className={styles.container}>
      <Head>
        <title>审核评论 - 管理员面板</title>
        <meta name="description" content="Promptopia 管理员面板 - 审核评论" />
      </Head>

      <div className={styles.header}>
        <Link href="/admin" className={styles.backButton}>
          <MdArrowBack />
          <span>返回管理员面板</span>
        </Link>
        <h1 className={styles.title}>审核评论</h1>
        <div className={styles.headerPlaceholder}></div>
      </div>

      {/* 状态过滤下拉框 */}
      <FormControl sx={{ minWidth: 120, marginBottom: '1.5rem' }}> {/* 添加一些底部外边距 */}
        <InputLabel id="comment-filter-status-label">状态</InputLabel>
        <Select
          labelId="comment-filter-status-label"
          id="comment-filter-status"
          value={filterStatus}
          label="状态"
          onChange={handleFilterChange}
          // 您可以在这里添加更多的 MUI Select props 来定制样式和行为
          // 例如：size="small", variant="outlined" 等
        >
          <MenuItem value="all">所有评论</MenuItem>
          <MenuItem value="pending">待审核</MenuItem>
          <MenuItem value="approved">已批准</MenuItem>
          <MenuItem value="rejected">已拒绝</MenuItem>
        </Select>
      </FormControl>


      {comments.length === 0 ? (
        <div className={styles.loadingContainer}> {/* 可以复用加载/错误容器的样式 */}
          <p>没有找到符合条件的评论。</p>
        </div>
      ) : (
        <>
            <ul className={styles.commentList}>
              {comments.map(comment => (
                <li key={comment._id} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <div className={styles.authorInfo}>
                      {comment.author ? (
                        <Link href={`/dashboard?userId=${comment.author._id}`} className={styles.authorLink}>
                          <Image
                            src={comment.author.image || '/default-avatar.png'}
                            alt={comment.author.name || '作者头像'}
                            width={32}
                            height={32}
                            className={styles.authorImage}
                            onError={(e) => { e.target.onerror = null; e.target.src='/default-avatar.png'; }}
                          />
                          <div className={styles.authorText}>
                            <span className={styles.authorName}>{comment.author.name || '匿名作者'}</span>
                            <span className={styles.commentDate}>{formatDate(comment.createdAt)}</span>
                          </div>
                        </Link>
                      ) : (
                         // 处理没有作者的情况
                        <div className={styles.authorInfo}>
                          <Image
                            src={'/default-avatar.png'}
                            alt={'匿名作者头像'}
                            width={32}
                            height={32}
                            className={styles.authorImage}
                          />
                          <div className={styles.authorText}>
                            <span className={styles.authorName}>匿名作者</span>
                            <span className={styles.commentDate}>{formatDate(comment.createdAt)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 举报计数和状态标签 */}
                    <div className={styles.commentStats}>
                       {comment.reportsCount > 0 && (
                          <span className={styles.reportCount} title={`${comment.reportsCount} 次举报`}>
                             <MdFlag size={14} /> {comment.reportsCount}
                          </span>
                       )}
                       {/* 应用状态样式类 */}
                       <span className={`${styles.commentStatus} ${getStatusClassName(comment.status)}`}>
                          {/* 检查举报次数是否超过阈值 */}
                          {comment.reportsCount > 10 ? (
                            <span className={styles.statusAbnormal}>异常评论 ({comment.reportsCount} 举报)</span>
                          ) : (
                            comment.status === 'pending' ? '待审核' :
                            comment.status === 'approved' ? '已批准' :
                            comment.status === 'rejected' ? '已拒绝' : '未知状态'
                          )}
                       </span>
                    </div>
                  </div>

                  {/* 添加 Prompt 标题区域 */}
                  {comment.prompt && (
                    <div className={styles.promptInfo}>
                      <span className={styles.promptLabel}>原Prompt:</span>
                      <Link 
                        href={`/prompt/${comment.prompt._id}`} 
                        className={styles.promptTitle}
                        title="查看原Prompt"
                      >
                        {comment.prompt.title || "无标题提示"}
                      </Link>
                    </div>
                  )}

                  <div className={styles.commentContent}>
                    <p>{comment.content}</p>
                  </div>

                  <div className={styles.commentModeration}>
                    {comment.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(comment._id)}
                          className={styles.approveButton} // 使用新的批准按钮样式
                          title="批准评论"
                          disabled={comment.status === 'approving'} // 防止重复点击
                        >
                          {comment.status === 'approving' ? '处理中...' : <><MdCheckCircle size={18} /> 批准</>}
                        </button>
                        <button
                          onClick={() => handleReject(comment._id)}
                          className={styles.rejectButton} // 使用新的拒绝按钮样式
                          title="拒绝评论"
                          disabled={comment.status === 'rejecting'} // 防止重复点击
                        >
                           {comment.status === 'rejecting' ? '处理中...' : <><MdCancel size={18} /> 拒绝</>}
                        </button>
                      </>
                    )}
                    {/* 删除按钮始终可见 */}
                    <button
                      onClick={() => deleteComment(comment._id)}
                      className={styles.deleteButton} // 使用新的删除按钮样式
                      title="删除评论"
                    >
                      <MdDelete size={18} /> 删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>

          {/* 分页组件 */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}

// 辅助函数：格式化日期
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
} 