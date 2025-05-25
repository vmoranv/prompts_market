import dbConnect from '../../../../lib/dbConnect';
import Prompt from '../../../../models/Prompt'; // 确保导入 Prompt 模型
import Comment from '../../../../models/Comment'; // 导入 Comment 模型
import User from '../../../../models/User'; // 确保导入 User 模型
import Notification from '../../../../models/Notification'; // 导入 Notification 模型
import { getServerSession } from 'next-auth/next'; // 用于获取服务器端 session
import { authOptions } from '../../auth/[...nextauth]'; // 确保路径正确

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query; // Prompt ID

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);
  // 复用管理员检查逻辑
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;

  // 只有管理员才能访问此 API 的 PUT/DELETE 方法
  if ((method === 'PUT' || method === 'DELETE') && !isAdmin) {
    return res.status(403).json({ success: false, error: '未授权，只有管理员才能执行此操作' });
  }

  switch (method) {
    case 'GET':
      try {
        // 获取 Prompt 的所有评论，并填充作者信息
        const comments = await Comment.find({ prompt: id })
          .populate({
            path: 'author',
            select: 'name image', // 只选择作者的 name 和 image 字段
          })
          .sort({ createdAt: -1 }) // 按创建时间倒序排列
          .lean(); // 使用 lean() 获取 plain JavaScript objects

        res.status(200).json({ success: true, data: comments });
      } catch (error) {
        console.error('获取评论失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，获取评论失败' });
      }
      break;

    case 'POST':
      // 只有登录用户才能发表评论
      if (!session || !session.user || !session.user.id) {
        return res.status(401).json({ success: false, error: '未授权，请登录后发表评论' });
      }
      try {
        const { content } = req.body;

        if (!content || content.trim() === '') {
          return res.status(400).json({ success: false, error: '评论内容不能为空' });
        }

        // 检查 Prompt 是否存在
        const prompt = await Prompt.findById(id);
        if (!prompt) {
          return res.status(404).json({ success: false, error: 'Prompt 未找到' });
        }

        // 创建新评论，默认状态为 'pending'
        const newComment = await Comment.create({
          prompt: id,
          author: session.user.id, // 使用当前登录用户的 ID 作为作者
          content: content.trim(),
          status: 'pending', // 新评论设置为待审核状态
        });

        // 填充作者信息以便立即返回给前端
        const populatedComment = await Comment.findById(newComment._id).populate({
          path: 'author',
          select: 'name image',
        });

        // 查找所有关注此评论作者的用户
        const commentAuthorId = session.user.id;
        const followers = await User.find({ following: commentAuthorId }).select('_id').lean();

        // 为每个关注者创建新评论通知
        const notifications = followers.map(follower => ({
          recipient: follower._id, // 关注者收到通知
          sender: commentAuthorId, // 评论作者是发送者
          type: 'new_comment',
          relatedEntity: newComment._id, // 关联新创建的评论
          relatedEntityType: 'Comment',
        }));

        // 批量创建通知
        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
          console.log(`为 ${notifications.length} 个关注者创建了新评论通知`);
        }


        res.status(201).json({ success: true, data: populatedComment });
      } catch (error) {
        console.error('发表评论失败:', error);
        if (error.name === 'ValidationError') {
          const messages = Object.values(error.errors).map(val => val.message);
          return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        res.status(500).json({ success: false, error: '服务器错误，发表评论失败' });
      }
      break;

    // PUT 和 DELETE 方法用于管理员审核评论，这里保持不变
    case 'PUT':
      try {
        const { status } = req.body;

        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
          return res.status(400).json({ success: false, error: '无效的评论状态' });
        }

        const updatedComment = await Comment.findByIdAndUpdate(
          id,
          { status },
          { new: true, runValidators: true }
        );

        if (!updatedComment) {
          return res.status(404).json({ success: false, error: '评论未找到' });
        }

        res.status(200).json({ success: true, data: updatedComment });
      } catch (error) {
        console.error('更新评论状态失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，更新评论状态失败' });
      }
      break;

    case 'DELETE':
      try {
        const deletedComment = await Comment.findByIdAndDelete(id);

        if (!deletedComment) {
          return res.status(404).json({ success: false, error: '评论未找到' });
        }

        res.status(200).json({ success: true, data: {} });
      } catch (error) {
        console.error('删除评论失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，删除评论失败' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 