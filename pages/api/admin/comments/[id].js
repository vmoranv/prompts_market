import dbConnect from '../../../../lib/dbConnect';
import Comment from '../../../../models/Comment';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // 确保路径正确
import mongoose from 'mongoose';

// 定义举报阈值
const REPORT_THRESHOLD = 3; // 例如，3 次举报触发状态变更

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query; // Comment ID

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  // 只有登录用户才能举报
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ success: false, error: '未授权，请登录后举报评论' });
  }

  const userId = new mongoose.Types.ObjectId(session.user.id); // 获取当前用户 ID

  switch (method) {
    case 'PUT': // 用于批准或拒绝评论
      // 只有管理员可以批准或拒绝评论
      if (session.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: '无权限，只有管理员可以执行此操作' });
      }

      const { status } = req.body; // 期望接收新的状态 ('approved' 或 'rejected')

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: '无效的状态值' });
      }

      try {
        const comment = await Comment.findById(id);

        if (!comment) {
          return res.status(404).json({ success: false, error: '评论未找到' });
        }

        // 更新评论状态
        comment.status = status;
        await comment.save();

        res.status(200).json({ success: true, data: comment });
      } catch (error) {
        console.error('更新评论状态失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，更新评论状态失败' });
      }
      break;

    case 'POST': // 用于举报评论
      try {
        const comment = await Comment.findById(id);

        if (!comment) {
          return res.status(404).json({ success: false, error: '评论未找到' });
        }

        // 检查用户是否已经举报过
        if (comment.reportedBy.includes(userId)) {
          return res.status(400).json({ success: false, error: '您已经举报过此评论' });
        }

        // 将当前用户 ID 添加到 reportedBy 数组，并增加 reportsCount
        comment.reportedBy.push(userId);
        comment.reportsCount = comment.reportedBy.length; // 确保 reportsCount 与 reportedBy 数组长度一致

        // 检查是否达到举报阈值，并更新状态
        if (comment.reportsCount >= REPORT_THRESHOLD && comment.status !== 'pending' && comment.status !== 'rejected') {
          comment.status = 'pending'; // 自动设置为待审核
          console.log(`评论 ${comment._id} 达到举报阈值，状态自动更新为 pending`);
        }

        await comment.save();

        res.status(200).json({ success: true, data: { reportsCount: comment.reportsCount, status: comment.status } });
      } catch (error) {
        console.error('举报评论失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，举报失败' });
      }
      break;

    default:
      res.setHeader('Allow', ['PUT', 'POST']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 