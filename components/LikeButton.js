import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router'; // 用于未登录时跳转

export default function LikeButton({ promptId, initialLikesCount, initialLikedByCurrentUser }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    setLikesCount(initialLikesCount);
    if (status !== 'loading') {
      const currentUserId = session?.user?.id;
      if (currentUserId) {
        setIsLiked(initialLikedByCurrentUser);
      } else {
        setIsLiked(false);
      }
      setIsInitialCheckDone(true);
    }
  }, [initialLikesCount, initialLikedByCurrentUser, status, session]);

  const handleLike = async () => {
    if (status === 'unauthenticated') {
      // 可以提示用户登录或直接跳转到登录页
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (status === 'loading' || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/prompts/${promptId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || '点赞操作失败');
      }

      setLikesCount(data.data.likesCount);
      setIsLiked(data.data.likedByCurrentUser);

    } catch (err) {
      console.error("LikeButton error:", err);
      setError(err.message);
      // 可以选择性地回滚状态，或者提示用户重试
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialCheckDone && status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
        <button disabled style={{ padding: '8px 12px', marginRight: '8px' }}>加载中...</button>
        <span>{likesCount} 人点赞</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
      <button
        onClick={handleLike}
        disabled={isLoading || status === 'loading'}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          backgroundColor: isLiked ? '#007bff' : '#e0e0e0',
          color: isLiked ? 'white' : 'black',
          border: 'none',
          borderRadius: '4px',
          marginRight: '8px'
        }}
      >
        {isLoading ? '处理中...' : (isLiked ? '已点赞' : '点赞')}
      </button>
      <span>{likesCount} 人点赞</span>
      {error && <p style={{ color: 'red', marginLeft: '10px', fontSize: '0.9em' }}>{error}</p>}
    </div>
  );
} 