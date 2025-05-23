import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import LikeButton from '../../components/LikeButton';

function PromptCard({ prompt, currentUserId }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
      <h3>
        <Link href={`/prompts/${prompt._id}`} style={{ color: 'blue', textDecoration: 'underline' }}>
          {prompt.title}
        </Link>
      </h3>
      <p>作者: {prompt.author?.name || '未知作者'}</p>
      {prompt.author?.image && (
        <img src={prompt.author.image} alt={prompt.author.name} style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
      )}
      <p style={{ whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {prompt.content.substring(0, 150)}{prompt.content.length > 150 ? '...' : ''}
      </p>
      <div>
        标签: {prompt.tags && prompt.tags.length > 0 ? prompt.tags.join(', ') : '无'}
      </div>
      <p>点赞: {prompt.likesCount || 0}</p>
      <LikeButton
        promptId={prompt._id}
        initialLikesCount={prompt.likesCount || 0}
        initialLikedByCurrentUser={prompt.likedBy?.includes(currentUserId)}
      />
    </div>
  );
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  useEffect(() => {
    async function fetchPrompts() {
      try {
        setLoading(true);
        const res = await fetch('/api/prompts');
        if (!res.ok) {
          throw new Error(`Failed to fetch prompts: ${res.statusText}`);
        }
        const data = await res.json();
        if (data.success) {
          setPrompts(data.data);
        } else {
          throw new Error(data.message || 'Could not fetch prompts');
        }
      } catch (err) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPrompts();
  }, []);

  if (loading) return <p style={{ textAlign: 'center', marginTop: '20px' }}>加载 Prompts 中...</p>;
  if (error) return <p style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>错误: {error}</p>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>浏览 Prompts</h1>
        {session && (
          <Link href="/create-prompt" style={{ padding: '10px 15px', backgroundColor: 'green', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
            创建新 Prompt
          </Link>
        )}
      </div>

      {prompts.length === 0 ? (
        <p>目前还没有已发布的 Prompts。</p>
      ) : (
        <div>
          {prompts.map((prompt) => (
            <PromptCard key={prompt._id} prompt={prompt} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
} 