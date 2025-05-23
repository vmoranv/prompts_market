import { connectToDatabase } from '../../../../utils/database';
import Prompt from '../../../../models/Prompt';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: '没有权限执行此操作' });
  }

  try {
    await connectToDatabase();
    
    const pendingPrompts = await Prompt.find({ status: 'pending' })
      .populate('author', 'name email image')
      .sort({ createdAt: -1 });
    
    console.log(`找到 ${pendingPrompts.length} 个待审核提示`); 
    
    return res.status(200).json({ 
      success: true, 
      prompts: pendingPrompts 
    });
  } catch (error) {
    console.error('获取待审核提示错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 