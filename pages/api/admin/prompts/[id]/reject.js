import { connectToDatabase } from '../../../../../utils/database';
import Prompt from '../../../../../models/Prompt';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { id } = req.query;
  const { clearCache } = req.body || {};

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: '没有权限执行此操作' });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: '无效的提示ID' });
  }

  try {
    await connectToDatabase();
    
    const prompt = await Prompt.findByIdAndUpdate(
      id,
      { 
        $set: {
          status: 'rejected',
          updatedAt: new Date(),
        }
      },
      { new: true }
    );

    if (!prompt) {
      return res.status(404).json({ error: '提示未找到' });
    }

    if (clearCache) {
      try {
        console.log(`清除提示ID ${id} 的缓存`);
        
        await mongoose.connection.db.collection('promptsCache').deleteMany({ promptId: id });
      } catch (cacheError) {
        console.error('清除缓存错误:', cacheError);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: '提示已被成功拒绝',
      prompt 
    });
  } catch (error) {
    console.error('拒绝提示错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 