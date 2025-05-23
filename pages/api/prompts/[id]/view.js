// 记录提示浏览量的 API 路由
import { connectToDatabase } from '../../../../utils/database';
import Prompt from '../../../../models/Prompt';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { id } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: '无效的提示ID' });
  }

  try {
    await connectToDatabase();
    
    // 使用Mongoose模型增加浏览计数
    await Prompt.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    return res.status(200).json({ message: '浏览量已更新' });
  } catch (error) {
    console.error('更新浏览量错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 