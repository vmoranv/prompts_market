import { connectToDatabase } from '../../../../utils/database';
import Prompt from '../../../../models/Prompt';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: '没有权限执行此操作' });
  }

  const { filter, clearCache } = req.body;
  
  if (!filter) {
    return res.status(400).json({ error: '缺少筛选条件' });
  }

  try {
    await connectToDatabase();
    
    const query = { status: 'pending' };
    
    if (filter.titleRegex) {
      query.title = { $regex: filter.titleRegex, $options: 'i' };
    }
    
    if (filter.contentRegex) {
      query.content = { $regex: filter.contentRegex, $options: 'i' };
    }
    
    if (filter.authorId) {
      query.author = mongoose.Types.ObjectId.isValid(filter.authorId) 
        ? new mongoose.Types.ObjectId(filter.authorId) 
        : filter.authorId;
    }
    
    if (filter.tags && Array.isArray(filter.tags) && filter.tags.length > 0) {
      query.tags = { $in: filter.tags };
    }
    
    const promptsToReject = await Prompt.find(query, '_id');
    const promptIds = promptsToReject.map(p => p._id);
    
    if (promptIds.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: '没有符合条件的提示', 
        rejectedCount: 0 
      });
    }
    
    const result = await Prompt.updateMany(
      { _id: { $in: promptIds } },
      { 
        $set: { 
          status: 'rejected',
          updatedAt: new Date()
        } 
      }
    );
    
    if (clearCache && promptIds.length > 0) {
      try {
        console.log(`清除 ${promptIds.length} 个提示的缓存`);
        
        await mongoose.connection.db.collection('promptsCache').deleteMany({ 
          promptId: { $in: promptIds.map(id => id.toString()) } 
        });
      } catch (cacheError) {
        console.error('批量清除缓存错误:', cacheError);
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: `已拒绝 ${result.modifiedCount} 个提示`, 
      rejectedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('批量拒绝提示错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 