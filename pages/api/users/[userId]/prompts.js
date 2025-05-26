import dbConnect from '../../../../lib/dbConnect';
import Prompt from '../../../../models/Prompt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import mongoose from 'mongoose'; // 导入 mongoose 以验证 ObjectId

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  // 检查用户是否已登录
  if (!session) {
    return res.status(401).json({ error: '需要登录' });
  }

  // 从 req.query 中获取 userId
  const { userId } = req.query;

  // 验证 userId 是否是有效的 MongoDB ObjectId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, error: 'Invalid user ID format' });
  }

  // 用户只能查看自己的提示词，管理员可以查看所有人的
  // 注意：这里假设 session.user.id 是字符串，userId 也是字符串
  // 如果它们是 ObjectId 类型，需要进行相应的比较
  const isOwnDashboard = session.user.id === userId;
  const isAdmin = session.user.role === 'admin'; // 假设用户对象中有 role 字段表示管理员

  if (!isOwnDashboard && !isAdmin) {
    return res.status(403).json({ error: '没有权限查看其他用户的提示词' });
  }

  await dbConnect();

  try {
    // 获取该用户的所有提示词
    const prompts = await Prompt.find({ author: userId })
      .populate('author', 'name image _id')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: prompts
    });
  } catch (error) {
    console.error('获取用户提示词失败:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 