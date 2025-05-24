import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  const { method } = req;
  const { userId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, error: '无效的用户 ID 格式' });
  }

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const user = await User.findById(userId).select('name email image role');

        if (!user) {
          return res.status(404).json({ success: false, error: '用户未找到' });
        }

        const publicUserInfo = {
          _id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
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