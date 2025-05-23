import dbConnect from '../../../../lib/dbConnect';
import Prompt from '../../../../models/Prompt';
import User from '../../../../models/User'; // 虽然不直接用，但保持引入一致性
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  const {
    query: { id: promptId },
    method,
  } = req;

  await dbConnect();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.sub) {
    return res.status(401).json({ success: false, message: '未认证，请先登录' });
  }
  const userId = token.sub; // 从 JWT token 中获取用户 ID

  if (!mongoose.Types.ObjectId.isValid(promptId)) {
    return res.status(400).json({ success: false, message: '无效的 Prompt ID' });
  }

  if (method === 'POST') { // 用于点赞或取消点赞
    try {
      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        return res.status(404).json({ success: false, message: 'Prompt 未找到' });
      }

      // 检查用户是否已经点赞
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const alreadyLikedIndex = prompt.likedBy.findIndex(likerId => likerId.equals(userObjectId));

      if (alreadyLikedIndex > -1) {
        // 如果已点赞，则取消点赞
        prompt.likedBy.splice(alreadyLikedIndex, 1);
        prompt.likesCount = prompt.likedBy.length; // 或者 prompt.likesCount -= 1;
        console.log(`[Like API] User ${userId} unliked prompt ${promptId}`);
      } else {
        // 如果未点赞，则添加点赞
        prompt.likedBy.push(userObjectId);
        prompt.likesCount = prompt.likedBy.length; // 或者 prompt.likesCount += 1;
        console.log(`[Like API] User ${userId} liked prompt ${promptId}`);
      }

      await prompt.save();
      // 返回更新后的 prompt 或仅点赞数和状态
      res.status(200).json({
        success: true,
        data: {
          likesCount: prompt.likesCount,
          likedByCurrentUser: alreadyLikedIndex === -1, // true if now liked, false if now unliked
        },
        message: alreadyLikedIndex > -1 ? '取消点赞成功' : '点赞成功'
      });

    } catch (error) {
      console.error(`Error liking/unliking prompt ${promptId}:`, error);
      res.status(500).json({ success: false, message: '操作失败，请稍后再试' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ success: false, message: `方法 ${method} 不允许` });
  }
} 