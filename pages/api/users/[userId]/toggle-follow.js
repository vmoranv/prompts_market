import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // 确保路径正确
import dbConnect from '../../../../lib/dbConnect';
import User from '../../../../models/User';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  console.log('收到关注/取消关注请求:', req.method, req.query); // 添加日志
  const session = await getServerSession(req, res, authOptions);
  console.log('Session:', session ? '存在' : '不存在'); // 添加日志

  if (!session || !session.user || !session.user.id) {
    console.log('未授权请求'); // 添加日志
    return res.status(401).json({ success: false, error: '未授权，请登录后操作' });
  }

  const { method } = req;
  const { userId } = req.query; // 要关注/取消关注的目标用户 ID
  const currentUserId = session.user.id; // 当前登录用户的 ID

  console.log('当前用户 ID:', currentUserId); // 添加日志
  console.log('目标用户 ID:', userId); // 添加日志

  if (method !== 'POST') {
    console.log(`方法 ${method} 不允许`); // 添加日志
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
  }

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    console.log('无效的目标用户 ID'); // 添加日志
    return res.status(400).json({ success: false, error: '无效的目标用户 ID' });
  }

  if (currentUserId === userId) {
    console.log('尝试关注自己'); // 添加日志
    return res.status(400).json({ success: false, error: '不能关注自己' });
  }

  try {
    console.log('尝试连接数据库...'); // 添加日志
    await dbConnect();
    console.log('数据库连接成功'); // 添加日志

    console.log('尝试查找用户...'); // 添加日志
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);
    console.log('用户查找结果:', { currentUser: !!currentUser, targetUser: !!targetUser }); // 添加日志

    if (!currentUser || !targetUser) {
      console.log('用户未找到'); // 添加日志
      return res.status(404).json({ success: false, error: '用户未找到' });
    }

    const isFollowing = currentUser.following.some(id => id.equals(targetUser._id));
    console.log('当前是否正在关注:', isFollowing); // 添加日志

    let message;
    let updatedFollowingCount;
    let updatedFollowersCount;

    if (isFollowing) {
      console.log('执行取消关注操作'); // 添加日志
      currentUser.following.pull(targetUser._id);
      targetUser.followers.pull(currentUser._id);
      message = '取消关注成功';
    } else {
      console.log('执行关注操作'); // 添加日志
      currentUser.following.push(targetUser._id);
      targetUser.followers.push(currentUser._id);
      message = '关注成功';
    }

    console.log('尝试保存用户...'); // 添加日志
    await currentUser.save();
    await targetUser.save();
    console.log('用户保存成功'); // 添加日志

    updatedFollowingCount = currentUser.following.length; // 当前用户关注的人数
    updatedFollowersCount = targetUser.followers.length; // 目标用户的粉丝数

    console.log('操作成功，返回响应'); // 添加日志
    res.status(200).json({
      success: true,
      message,
      data: {
        isNowFollowing: !isFollowing, // 操作后是否正在关注
        currentUserFollowingCount: updatedFollowingCount,
        targetUserFollowersCount: updatedFollowersCount,
      }
    });

  } catch (error) {
    console.error('关注/取消关注操作失败:', error); // 确保错误被记录
    res.status(500).json({ success: false, error: '服务器错误，操作失败', details: error.message });
  }
}