import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Dashboard.module.css';
import { MdAccountCircle, MdLightbulbOutline, MdDelete, MdEdit, MdArrowBack, MdSentimentDissatisfied, MdComment, MdPersonAdd, MdPersonRemove, MdPeople } from 'react-icons/md';
import Link from 'next/link';
import Image from 'next/image';

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
  const [activeTab, setActiveTab] = useState('prompts');
  const [userComments, setUserComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedCommentContent, setEditedCommentContent] = useState('');
  const [fetchFollowingError, setFetchFollowingError] = useState(null);
  const [isFollowProcessing, setIsFollowProcessing] = useState(false);
  const [isCurrentUserFollowingProfile, setIsCurrentUserFollowingProfile] = useState(false);
  const [followersUsers, setFollowersUsers] = useState([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [fetchFollowersError, setFetchFollowersError] = useState(null);
  const [isOwnDashboard, setIsOwnDashboard] = useState(false);
  const [fetchCommentsError, setFetchCommentsError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const loggedInUserId = session?.user?.id;
  const dashboardUserId = queryUserId || loggedInUserId;
  // 验证 userId 是否为有效的 MongoDB ObjectId
  const isValidObjectId = (id) => {
    // MongoDB ObjectId 是24位十六进制字符串
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  // 验证用户权限
  const hasPermissionToView = (currentUserId, targetUserId, isAdmin) => {
    return currentUserId === targetUserId || isAdmin;
  };

  useEffect(() => {
    const fetchProfileUser = async () => {
      setLoadingProfile(true);
      setFetchProfileError(null);
      setError(null);

      if (status === 'loading') return;

      let targetIdToFetch = queryUserId;
      if (!targetIdToFetch && status === 'authenticated') {
        targetIdToFetch = loggedInUserId;
      }

      if (targetIdToFetch) {
        try {
          const res = await fetch(`/api/users/${targetIdToFetch}`);
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `无法加载用户信息: ${res.status}`);
          }
          const data = await res.json();
          if (data.success) {
            setProfileUser(data.data);
            setIsCurrentUserFollowingProfile(data.data.isFollowing || false);
            setIsOwnDashboard(loggedInUserId === targetIdToFetch);

            if (activeTab === 'prompts') {
                fetchUserPrompts(targetIdToFetch);
            } else if (activeTab === 'comments') {
                fetchUserComments(targetIdToFetch);
            } else if (activeTab === 'following') {
                fetchFollowingUsers(targetIdToFetch);
            } else if (activeTab === 'followers') {
                fetchFollowersUsers(targetIdToFetch);
            }
          } else {
            throw new Error(data.error || '获取用户信息失败');
          }
        } catch (err) {
          console.error(`获取用户 ${targetIdToFetch} 信息失败:`, err);
          setFetchProfileError(err.message);
          setProfileUser(null);
          setIsCurrentUserFollowingProfile(false);
        } finally {
          setLoadingProfile(false);
        }
      } else if (status === 'unauthenticated' && queryUserId) {
        try {
          const res = await fetch(`/api/users/${queryUserId}`);
          if (!res.ok) throw new Error('Failed to fetch user');
          const data = await res.json();
          if (data.success) {
            setProfileUser(data.data);
            setIsCurrentUserFollowingProfile(false);
            setIsOwnDashboard(false);

            if (activeTab === 'prompts') {
                fetchUserPrompts(queryUserId);
            } else if (activeTab === 'comments') {
                fetchUserComments(queryUserId);
            } else if (activeTab === 'following') {
                fetchFollowingUsers(queryUserId);
            } else if (activeTab === 'followers') {
                fetchFollowersUsers(queryUserId);
            }

          } else {
            throw new Error(data.error || 'Failed to fetch user');
          }
        } catch (err) {
          console.error(`获取用户 ${queryUserId} 信息失败:`, err);
          setFetchProfileError(err.message);
        } finally {
          setLoadingProfile(false);
        }
      } else if (status === 'unauthenticated' && !queryUserId) {
        router.push('/auth/signin?callbackUrl=' + encodeURIComponent(router.asPath));
      } else {
        setLoadingProfile(false);
      }
    };

    fetchProfileUser();
  }, [queryUserId, session, status, router, loggedInUserId, activeTab]);

  const fetchUserPrompts = async (userId) => {
    // 1. 验证 userId 格式
    if (!userId || !isValidObjectId(userId)) {
      setError('无效的用户ID格式');
      setLoadingPrompts(false);
      return;
    }    // 2. 检查权限
    if (!hasPermissionToView(session?.user?.id, userId, session?.user?.role === 'admin')) {
      setError('没有权限查看此用户的提示词');
      setLoadingPrompts(false);
      return;
    }

    setLoadingPrompts(true);
    setError(null);
    
    try {
      // 3. 使用验证过的 userId 进行请求
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/prompts`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `无法加载用户 Prompt: ${res.status}`);
      }
      
      const data = await res.json();
      setUserPrompts(data.data || []);
    } catch (error) {
      console.error('获取用户 Prompt 失败:', error);
      setError(error.message || '获取用户 Prompt 失败');
    } finally {
      setLoadingPrompts(false);
    }
  };


  const fetchUserComments = async (userId) => {
    if (!userId) return;
    setLoadingComments(true);
    setFetchCommentsError(null);
    try {
      const res = await fetch(`/api/users/${userId}/comments`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `无法加载用户评论: ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setUserComments(data.data);
      } else {
        throw new Error(data.error || '获取用户评论失败');
      }
    } catch (err) {
      console.error(`获取用户 ${userId} 评论失败:`, err);
      setFetchCommentsError(err.message);
      setUserComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

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

  const handleDeleteComment = async (commentId) => {
    const commentToDelete = userComments.find(comment => comment._id === commentId);
    if (!commentToDelete || (commentToDelete.author._id !== loggedInUserId && session?.user?.role !== 'admin')) {
        alert('您没有权限删除此评论。');
        return;
    }

    if (window.confirm('确定要删除这条评论吗？')) {
      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `删除失败: ${res.status}`);
        }
        setUserComments(userComments.filter(comment => comment._id !== commentId));
        console.log(`评论 ${commentId} 已成功删除。`);
      } catch (err) {
        console.error("删除评论失败:", err);
        alert(`删除评论失败: ${err.message}`);
      }
    }
  };

  const handleEditComment = (comment) => {
    if (comment.author._id !== loggedInUserId) {
        alert('您没有权限编辑此评论。');
        return;
    }
    setEditingCommentId(comment._id);
    setEditedCommentContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditedCommentContent('');
  };

  const handleSaveComment = async (commentId) => {
    const commentToSave = userComments.find(comment => comment._id === commentId);
    if (!commentToSave || commentToSave.author._id !== loggedInUserId) {
        alert('您没有权限保存此评论。');
        handleCancelEdit();
        return;
    }

    if (!editedCommentContent.trim()) {
      alert('评论内容不能为空。');
      return;
    }

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editedCommentContent }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `保存评论失败: ${res.status}`);
      }

      const updatedComment = await res.json();

      setUserComments(userComments.map(comment =>
        comment._id === commentId ? { ...comment, content: updatedComment.data.content } : comment
      ));

      setEditingCommentId(null);
      setEditedCommentContent('');
      console.log(`评论 ${commentId} 已成功更新。`);

    } catch (err) {
      console.error("保存评论失败:", err);
      alert(`保存评论失败: ${err.message}`);
    }
  };

  useEffect(() => {
    if (status !== 'loading' && !loadingProfile) {
      fetchUserPrompts(profileUser._id);
      fetchUserComments(profileUser._id);
    }
  }, [profileUser, activeTab]);

  const fetchFollowingUsers = async (userId) => {
    if (!userId) return;
    setLoadingFollowing(true);
    setFetchFollowingError(null);
    try {
      const res = await fetch(`/api/users/${userId}/following`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '获取关注用户列表失败');
      }
      setFollowingUsers(data.data || []);
    } catch (err) {
      console.error("获取关注用户列表失败:", err);
      setFetchFollowingError(err.message);
      setFollowingUsers([]);
    } finally {
      setLoadingFollowing(false);
    }
  };

  const fetchFollowersUsers = async (userId) => {
    if (!userId) return;
    setLoadingFollowers(true);
    setFetchFollowersError(null);
    try {
      const res = await fetch(`/api/users/${userId}/followers`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '获取粉丝用户列表失败');
      }
      setFollowersUsers(data.data || []);
    } catch (err) {
      console.error("获取粉丝用户列表失败:", err);
      setFetchFollowersError(err.message);
      setFollowersUsers([]);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const handleToggleFollow = async (targetUserId) => {
    if (!loggedInUserId) {
      router.push('/auth/signin');
      return;
    }
    if (isFollowProcessing) return;
    setIsFollowProcessing(true);

    try {
      const res = await fetch(`/api/users/${targetUserId}/toggle-follow`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '操作失败');
      }

      setIsCurrentUserFollowingProfile(data.data.isNowFollowing);

      const { currentUserFollowingCount, targetUserFollowersCount } = data.data;

      setProfileUser(prev => {
        if (!prev) return null;
        const updatedProfile = {
          ...prev,
          followersCount: prev._id === targetUserId ? targetUserFollowersCount : prev.followersCount,
          followingCount: prev._id === loggedInUserId ? currentUserFollowingCount : prev.followingCount
        };
        if (prev._id === targetUserId && prev._id === loggedInUserId) {
             updatedProfile.followingCount = currentUserFollowingCount;
        }
        return updatedProfile;
      });

      if (isOwnDashboard && activeTab === 'following') {
         fetchFollowingUsers(loggedInUserId);
      }

      if (profileUser?._id === targetUserId && activeTab === 'followers') {
          fetchFollowersUsers(targetUserId);
      }
      if (profileUser?._id === targetUserId && activeTab === 'following') {
           fetchFollowingUsers(targetUserId);
      }

    } catch (err) {
      console.error("关注/取消关注失败:", err);
    } finally {
      setIsFollowProcessing(false);
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
  const canManageComments = isOwnDashboard;
  const canManageFollowing = isOwnDashboard;

  const filteredPrompts = userPrompts.filter(prompt => {
    if (filterStatus === 'all') {
      return true;
    }
    return prompt.status === filterStatus;
  });

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
              <div className={styles.followStats}>
                <span>关注: {profileUser?.followingCount ?? 0}</span>
                <span>粉丝: {profileUser?.followersCount ?? 0}</span>
              </div>
            </div>
            {!isOwnDashboard && loggedInUserId && (
                <button
                    onClick={() => handleToggleFollow(profileUser._id)}
                    className={`${styles.followButton} ${isCurrentUserFollowingProfile ? styles.unfollowButtonActive : ''}`}
                    disabled={isFollowProcessing}
                >
                    {isFollowProcessing ? '处理中...' : (isCurrentUserFollowingProfile ? <><MdPersonRemove /> 取消关注</> : <><MdPersonAdd /> 关注</>)}
                </button>
            )}
          </section>
        )}

        <div className={styles.tabNavigation}>
          <button
            className={`${styles.tabButton} ${activeTab === 'prompts' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            <MdLightbulbOutline /> 我的 Prompt
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'comments' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            <MdComment /> 我的评论
          </button>
          {isOwnDashboard && (
            <button
              className={`${styles.tabButton} ${activeTab === 'following' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('following')}
            >
              <MdPeople /> 关注
            </button>
          )}
          {isOwnDashboard && (
            <button
              className={`${styles.tabButton} ${activeTab === 'followers' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('followers')}
            >
              <MdPeople /> 粉丝
            </button>
          )}
        </div>

        {activeTab === 'prompts' && (
          <section className={styles.myPromptsSection}>
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
                <h2 className={styles.sectionTitle}>
                  <MdLightbulbOutline className={styles.sectionIcon} />
                  {isOwnDashboard ? '我的 Prompt' : `${profileUser?.name || '用户'}的 Prompt`} ({userPrompts.length})
                </h2>
                <div className={styles.sectionSeparator}></div>
                {filteredPrompts.map(prompt => (
                  <div key={prompt._id} className={styles.promptItem}>
                    <div className={styles.promptTitleContainer}>
                      <Link href={`/prompt/${prompt._id}`} className={styles.promptTitleLink}>
                        <span className={styles.promptTitleText} title={prompt.title}>
                          {prompt.title.length > 30 ? `${prompt.title.substring(0, 30)}...` : prompt.title}
                        </span>
                      </Link>
                      {isOwnDashboard && prompt.status && (
                        <span className={styles[prompt.status + 'Status']}>
                          {prompt.status === 'pending' && '待审核'}
                          {prompt.status === 'rejected' && '已拒绝'}
                          {prompt.status === 'published' && '已发布'}
                        </span>
                      )}
                    </div>
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

        {activeTab === 'comments' && (
          <div className={styles.commentsSection}>
            <h2 className={styles.sectionTitle}>
              <MdComment className={styles.sectionIcon} />
              {isOwnDashboard ? '我的评论' : `${profileUser?.name || '用户'}的评论`} ({userComments.length})
            </h2>
            <div className={styles.sectionSeparator}></div>

            {loadingComments ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>加载评论中...</p>
              </div>
            ) : fetchCommentsError ? (
              <div className={styles.errorContainer}>
                <MdSentimentDissatisfied size={48} />
                <p>加载评论失败: {fetchCommentsError}</p>
              </div>
            ) : userComments.length > 0 ? (
              <ul className={styles.commentsList}>
                {userComments.map(comment => (
                  <li key={comment._id} className={styles.commentItem}>
                    <div className={styles.commentContent}>
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
                      {editingCommentId === comment._id ? (
                        <div className={styles.editForm}>
                          <textarea
                            value={editedCommentContent}
                            onChange={(e) => setEditedCommentContent(e.target.value)}
                            rows="3"
                          />
                          <div className={styles.editFormButtons}>
                            <button onClick={() => handleSaveComment(comment._id)} className={styles.saveButton}><MdSave /> 保存</button>
                            <button onClick={handleCancelEdit} className={styles.cancelButton}><MdCancel /> 取消</button>
                          </div>
                        </div>
                      ) : (
                        <p>{comment.content}</p>
                      )}
                      <span className={styles.commentMeta}>
                        发布于 {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.commentActions}>
                       {comment.author._id === loggedInUserId && (
                         <>
                           {editingCommentId !== comment._id && (
                             <>
                               <button
                                 onClick={() => handleEditComment(comment)}
                                 className={styles.actionButton}
                                 title="编辑评论"
                               >
                                 <MdEdit />
                               </button>
                               <button
                                 onClick={() => handleDeleteComment(comment._id)}
                                 className={`${styles.actionButton} ${styles.deleteButton}`}
                                 title="删除评论"
                               >
                                 <MdDelete />
                               </button>
                             </>
                           )}
                         </>
                       )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <MdSentimentDissatisfied size={48} />
                <p>{isOwnDashboard ? '您还没有发表任何评论' : (profileUser?.name ? `${profileUser.name} 还没有发表任何评论` : '该用户还没有发表任何评论')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'following' && (
          <div className={styles.followingSection}>
            <h2 className={styles.sectionTitle}>
              <MdPeople className={styles.sectionIcon} />
              {isOwnDashboard ? '我关注的用户' : `${profileUser?.name || '用户'}关注的用户`} ({followingUsers.length})
            </h2>
            <div className={styles.sectionSeparator}></div>

            {loadingFollowing ? (
              <div className={styles.loading}>加载中...</div>
            ) : fetchFollowingError ? (
              <div className={styles.errorContainer}>
                <MdSentimentDissatisfied size={48} />
                <p>加载关注用户失败: {fetchFollowingError}</p>
              </div>
            ) : followingUsers.length > 0 ? (
              <ul className={styles.followingList}>
                {followingUsers.map(user => (
                  <li key={user._id} className={styles.followingItem}>
                    <Link href={`/dashboard?userId=${user._id}`} className={styles.userInfo}>
                      <img
                        src={user.image || '/default-avatar.png'}
                        alt={user.name}
                        className={styles.userAvatar}
                      />
                      <div>
                        <h4>{user.name}</h4>
                        <p>{user.email}</p>
                      </div>
                    </Link>
                    {isOwnDashboard && (
                      <button
                        onClick={() => handleToggleFollow(user._id)}
                        className={styles.unfollowButton}
                        disabled={isFollowProcessing}
                      >
                        {isFollowProcessing ? '处理中...' : <><MdPersonRemove /> 取消关注</>}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <MdSentimentDissatisfied size={48} />
                <p>{isOwnDashboard ? '您还没有关注任何用户' : (profileUser?.name ? `${profileUser.name} 还没有关注任何用户` : '该用户还没有关注任何用户')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'followers' && (
          <div className={styles.followersSection}>
            <h2 className={styles.sectionTitle}>
              <MdPeople className={styles.sectionIcon} />
              粉丝 ({followersUsers.length})
            </h2>
            <div className={styles.sectionSeparator}></div>

            {loadingFollowers ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>加载粉丝用户...</p>
              </div>
            ) : fetchFollowersError ? (
              <div className={styles.errorContainer}>
                <MdSentimentDissatisfied size={48} />
                <p>加载粉丝用户失败: {fetchFollowersError}</p>
              </div>
            ) : followersUsers.length > 0 ? (
              <ul className={styles.followersList}>
                {followersUsers.map(user => (
                  <li key={user._id} className={styles.followerItem}>
                    <Link href={`/dashboard?userId=${user._id}`} className={styles.followerUserInfo}>
                      <img
                        src={user.image || '/default-avatar.png'}
                        alt={user.name}
                        className={styles.userAvatar}
                      />
                      <div>
                        <h4 className={styles.followerName}>{user.name}</h4>
                        <p className={styles.followerEmail}>{user.email}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <MdSentimentDissatisfied size={48} />
                <p>{isOwnDashboard ? '您还没有任何粉丝' : (profileUser?.name ? `${profileUser.name} 还没有任何粉丝` : '该用户还没有任何粉丝')}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
} 