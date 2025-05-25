import dbConnect from '../../../../lib/dbConnect'; // 导入 dbConnect
import Comment from '../../../../models/Comment'; // 导入 Comment 模型
import Prompt from '../../../../models/Prompt'; // 导入 Prompt 模型，用于填充 prompt 字段
import User from '../../../../models/User'; // 导入 User 模型，用于填充 author 字段 (可选，但推荐)
import mongoose from 'mongoose'; // 导入 mongoose

export default async function handler(req, res) {
  // 确保只处理 GET 请求
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const { userId } = req.query; // 从 URL 参数中获取用户 ID，这是评论的作者 ID

  // 验证 userId 是否是有效的 MongoDB ObjectId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, error: 'Invalid user ID format' });
  }

  try {
    await dbConnect(); // 连接数据库

    // 查找指定用户发表的所有评论
    // 过滤条件: { author: userId }
    // populate('prompt', 'title') 用于获取评论所属 Prompt 的标题
    // populate('author', 'name image') 用于获取评论作者的姓名和头像 (虽然已知作者是 userId，但填充可以提供一致的数据结构)
    const comments = await Comment.find({ author: userId })
      .populate('prompt', 'title') // 填充 prompt 字段，只获取 title
      .populate('author', 'name image') // 填充 author 字段，只获取 name 和 image
      .sort({ createdAt: -1 }) // 按创建时间倒序排列，最新的评论在前
      .lean(); // 使用 lean() 获取 plain JavaScript objects

    // 返回成功响应和评论列表
    res.status(200).json({ success: true, data: comments });

  } catch (error) {
    console.error(`获取用户 ${userId} 的评论失败:`, error);
    // 返回 JSON 格式的错误响应
    res.status(500).json({ success: false, error: 'Failed to fetch user comments', details: error.message });
  }
} 