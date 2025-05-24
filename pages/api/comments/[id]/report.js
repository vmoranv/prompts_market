import dbConnect from '../../../../lib/dbConnect';
import Comment from '../../../../models/Comment';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; 
import mongoose from 'mongoose'; // 导入 mongoose 以使用 ObjectId

// 定义举报阈值
const REPORT_THRESHOLD = 3; 

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  // 只有登录用户才能举报
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ success: false, error: '未授权，请登录后举报评论' });
  }

  const userId = new mongoose.Types.ObjectId(session.user.id); // 获取当前用户 ID

  switch (method) {
    case 'POST':
      try {
        // 查找评论
        const comment = await Comment.findById(id);

        if (!comment) {
          return res.status(404).json({ success: false, error: '评论未找到' });
        }

        // 检查用户是否已举报过
        if (comment.reportedBy.includes(userId)) {
          return res.status(400).json({ success: false, error: '您已举报过此评论' });
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
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 