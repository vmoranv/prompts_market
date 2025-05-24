import dbConnect from '../../../lib/dbConnect';
import Comment from '../../../models/Comment';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import mongoose from 'mongoose'; // 导入 mongoose 以使用 ObjectId

// 定义举报阈值
const REPORT_THRESHOLD = 3; 

export default async function handler(req, res) {
  const {
    query: { id }, // 获取评论 ID
    method,
  } = req;

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  // 检查用户是否登录且为管理员
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
  const isAdmin = session?.user?.email && adminEmails.includes(session.user.email);

  // 对于 PUT 和 DELETE 方法，只有管理员有权限
  if ((method === 'PUT' || method === 'DELETE') && (!session || !isAdmin)) {
    return res.status(403).json({ success: false, error: '未授权，只有管理员才能执行此操作' });
  }

  // 验证 ID 是否是有效的 MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, error: '无效的评论 ID' });
  }

  switch (method) {
    case 'GET':
      try {
        const comment = await Comment.findById(id).populate('author', 'name image');
        if (!comment) {
          return res.status(404).json({ success: false, error: '评论未找到' });
        }
        res.status(200).json({ success: true, data: comment });
      } catch (error) {
        console.error('获取评论详情失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，获取评论失败' });
      }
      break;

    case 'PUT':
      try {
        // 管理员更新评论状态等信息
        const updatedComment = await Comment.findByIdAndUpdate(id, req.body, {
          new: true,
          runValidators: true,
        }).populate('author', 'name image');

        if (!updatedComment) {
          return res.status(404).json({ success: false, error: '评论未找到或更新失败' });
        }

        res.status(200).json({ success: true, data: updatedComment });
      } catch (error) {
        console.error('更新评论失败:', error);
        res.status(400).json({ success: false, error: error.message });
      }
      break;

    case 'DELETE':
      try {
        const deletedComment = await Comment.deleteOne({ _id: id });

        if (deletedComment.deletedCount === 0) {
          return res.status(404).json({ success: false, error: '评论未找到或已删除' });
        }

        res.status(200).json({ success: true, data: {} }); 
      } catch (error) {
        console.error('删除评论失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，删除失败' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 