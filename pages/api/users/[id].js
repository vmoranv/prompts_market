import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User'; // 确保您有 User 模型
import mongoose from 'mongoose';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, error: '无效的用户 ID 格式' });
  }

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        // 查找用户，只选择公开的字段
        // 请根据您的 User 模型和隐私策略调整 select 中的字段
        const user = await User.findById(id).select('name email image role'); // 示例：只选择 name, email, image, role

        if (!user) {
          return res.status(404).json({ success: false, error: '用户未找到' });
        }

        // 确保只返回必要的、安全的公开信息
        const publicUserInfo = {
          _id: user._id,
          name: user.name,
          email: user.email, // 考虑是否所有用户的 email 都应该公开
          image: user.image,
          // role: user.role, // 根据需要决定是否返回角色信息
        };

        res.status(200).json({ success: true, data: publicUserInfo });
      } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，获取用户信息失败' });
      }
      break;
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 