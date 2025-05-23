// 获取单个提示的 API 路由处理程序
import { connectToDatabase } from '../../../../utils/database';
import Prompt from '../../../../models/Prompt';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: '无效的提示ID' });
  }

  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      // 使用Mongoose模型获取提示详情
      const prompt = await Prompt.findById(id)
        .populate('author', 'name image')
        .lean();

      if (!prompt) {
        return res.status(404).json({ error: '提示未找到' });
      }

      // 计算点赞数
      const likesCount = prompt.likes ? prompt.likes.length : 0;
      
      return res.status(200).json({
        ...prompt,
        likesCount
      });
    } 
    
    // 检查认证后才允许修改和删除操作
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: '未授权' });
    }

    if (req.method === 'DELETE') {
      // 删除提示
      const prompt = await Prompt.findById(id);

      if (!prompt) {
        return res.status(404).json({ error: '提示未找到' });
      }
      
      // 确保只有作者可以删除
      if (prompt.author.toString() !== session.user.id) {
        return res.status(403).json({ error: '没有权限删除此提示' });
      }

      await Prompt.findByIdAndDelete(id);
      return res.status(200).json({ message: '提示已成功删除' });
    }

    if (req.method === 'PUT') {
      // 获取提示
      const prompt = await Prompt.findById(id);
      
      if (!prompt) {
        return res.status(404).json({ error: '提示未找到' });
      }
      
      // 检查权限（作者或管理员）
      if (prompt.author.toString() !== session.user.id && session.user.role !== 'admin') {
        return res.status(403).json({ error: '没有权限编辑此提示' });
      }
      
      // 获取更新的字段
      const { title, content, tags } = req.body;
      
      // 更新提示
      const updatedPrompt = await Prompt.findByIdAndUpdate(
        id,
        { 
          title,
          content,
          tags,
          // 如果是管理员修改，可能需要重新审核
          status: session.user.role === 'admin' ? prompt.status : 'pending'
        },
        { new: true }
      );
      
      return res.status(200).json(updatedPrompt);
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (error) {
    console.error('提示API错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 