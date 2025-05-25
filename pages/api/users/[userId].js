import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import mongoose from 'mongoose';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const { method } = req;
  const { userId: targetUserId } = req.query;

  const session = await getServerSession(req, res, authOptions);
  const currentUserId = session?.user?.id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ success: false, error: '无效的用户 ID 格式' });
  }

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const targetUser = await User.findById(targetUserId).select('name email image role followers following').lean();

        if (!targetUser) {
          return res.status(404).json({ success: false, error: '用户未找到' });
        }

        let isFollowing = false;
        if (currentUserId && targetUser.followers) {
          isFollowing = targetUser.followers.some(followerId => followerId.toString() === currentUserId);
        }

        const publicUserInfo = {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          image: targetUser.image,
          isFollowing: currentUserId ? isFollowing : false,
          followersCount: targetUser.followers ? targetUser.followers.length : 0,
          followingCount: targetUser.following ? targetUser.following.length : 0,
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