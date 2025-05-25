import dbConnect from '../../../../lib/dbConnect'; // 导入 dbConnect
import User from '../../../../models/User'; // 导入 User 模型
import mongoose from 'mongoose'; // 导入 mongoose

export default async function handler(req, res) {
  // 确保只处理 GET 请求
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const { userId } = req.query; // 要获取关注列表的用户 ID

  // 验证 userId 是否是有效的 MongoDB ObjectId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, error: 'Invalid user ID format' });
  }

  try {
    await dbConnect(); // 连接数据库

    // 查找用户并填充其 'following' 字段
    // populate('following', 'name email image') 表示获取 following 数组中每个 ID 对应的 User 文档，并只选择 name, email, image 字段
    const user = await User.findById(userId)
      .select('following') // 只选择 following 字段
      .populate('following', 'name email image') // 填充 following 数组中的用户详情
      .lean(); // 使用 lean() 获取 plain JavaScript objects 以提高性能

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // user.following 现在是一个包含用户对象的数组
    const followingUsers = user.following || [];

    // 返回成功响应和关注用户列表
    res.status(200).json({ success: true, data: followingUsers });

  } catch (error) {
    console.error("获取关注用户列表失败:", error);
    // 返回 JSON 格式的错误响应
    res.status(500).json({ success: false, error: 'Failed to fetch following users', details: error.message });
  }
} 