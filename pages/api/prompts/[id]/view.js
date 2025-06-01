// 记录提示浏览量的 API 路由
import dbConnect from '../../../../lib/dbConnect';
import Prompt from '../../../../models/Prompt';
import mongoose from 'mongoose';

// 使用内存缓存防止短时间内重复计数
const viewCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 定期清理缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of viewCache.entries()) {
    if (now - time > CACHE_TTL) {
      viewCache.delete(key);
    }
  }
}, 15 * 60 * 1000); // 每15分钟清理一次

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { id } = req.query;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // 创建唯一标识符(IP+ID组合)防止重复计数
  const cacheKey = `${clientIp}:${id}`;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: '无效的提示ID' });
  }
  
  // 检查是否已经在缓存中
  if (viewCache.has(cacheKey)) {
    return res.status(200).json({ message: '浏览量已更新（缓存）' });
  }

  try {
    await dbConnect();
    
    // 添加当前请求到缓存
    viewCache.set(cacheKey, Date.now());
    
    // 使用更高效的原子操作更新浏览计数
    await Prompt.findByIdAndUpdate(
      id, 
      { $inc: { viewCount: 1 } },
      { new: false, upsert: false } // 不返回更新后的文档，提高性能
    );

    return res.status(200).json({ message: '浏览量已更新' });
  } catch (error) {
    console.error('[MongoDB] 更新浏览量错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 