import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import LikeButton from '../../components/LikeButton'; 

export default function PromptDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: session } = useSession();
  const currentUserId = session?.user?.id; 

  useEffect(() => {
    if (!id) return; 

    async function fetchPrompt() {
      try {
        setLoading(true);
        const res = await fetch(`/api/prompts/${id}`); 
        if (!res.ok) {
          throw new Error(`Failed to fetch prompt: ${res.statusText}`);
        }
        const data = await res.json();
        if (data.success) {
          setPrompt(data.data);
        } else {
          throw new Error(data.message || 'Could not fetch prompt');
        }
      } catch (err) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPrompt();
  }, [id]);

  if (loading) return <p style={{ textAlign: 'center', marginTop: '20px' }}>加载 Prompt 详情中...</p>;
  if (error) return <p style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>错误: {error}</p>;
  if (!prompt) return <p style={{ textAlign: 'center', marginTop: '20px' }}>未找到 Prompt。</p>;

  const isAuthor = session?.user?.id === prompt.author?._id;
  const isAdmin = session?.user?.role === 'admin';

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '20px auto', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h1>{prompt.title}</h1>
      <div style={{ marginBottom: '15px', color: '#555' }}>
        <p>
          作者: {prompt.author?.name || '未知作者'}
          {prompt.author?.image && (
            <img src={prompt.author.image} alt={prompt.author.name || ''} style={{ width: '25px', height: '25px', borderRadius: '50%', marginLeft: '8px', verticalAlign: 'middle' }} />
          )}
        </p>
        <p>发布于: {new Date(prompt.publishedAt || prompt.createdAt).toLocaleDateString()}</p>
        <p>状态: {prompt.status}</p>
      </div>
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
        <h3>内容:</h3>
        <p>{prompt.content}</p>
      </div>
      {prompt.tags && prompt.tags.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <strong>标签:</strong> {prompt.tags.join(', ')}
        </div>
      )}
      <p>点赞数: {prompt.likesCount || 0}</p>
      <LikeButton
        promptId={prompt._id}
        initialLikesCount={prompt.likesCount || 0}
        initialLikedByCurrentUser={prompt.likedBy?.includes(currentUserId)}
      />

      {(isAuthor || isAdmin) && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          <Link href={`/prompts/edit/${prompt._id}`} style={{ marginRight: '10px', color: 'orange', textDecoration: 'underline' }}>
            编辑
          </Link>
        </div>
      )}

      <br />
      <Link href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
        返回 Prompts 列表
      </Link>
    </div>
  );
} 