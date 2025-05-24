import dbConnect from '../../lib/dbConnect';
import Comment from '../../models/Comment';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]'; // 确保路径正确

export default async function handler(req, res) {
  const { method } = req;
  const { page = 1, limit = 10, status: filterStatus } = req.query; // 获取分页参数和状态过滤参数

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);
  // 检查是否为管理员
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;

  // 只有管理员才能访问此 API
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: '未授权，只有管理员才能访问此资源' });
  }

  switch (method) {
    case 'GET':
      try {
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        let query = {};
        // 如果提供了状态过滤参数，则添加到查询条件
        if (filterStatus && filterStatus !== 'all') {
          // 对于没有 status 字段的旧评论，它们在数据库中 status 是 undefined
          // 如果过滤 'pending', 'approved', 'rejected'，则只匹配有对应 status 的评论
          // 如果过滤 'unknown'，则匹配 status 不存在或为 null 的评论
          if (filterStatus === 'unknown') {
             query.status = { $exists: false }; // 匹配 status 字段不存在的文档
             // 或者如果您想匹配 status 为 null 或 undefined 的情况，可以使用 $in: [null, undefined]
             // query.$or = [{ status: { $exists: false } }, { status: null }];
          } else {
             query.status = filterStatus;
          }
        }


        // 获取总评论数 (根据状态过滤)
        const totalComments = await Comment.countDocuments(query);

        // 获取当前页的评论，并填充作者信息、所属 Prompt 的信息和举报用户
        const comments = await Comment.find(query)
          .populate({
            path: 'author',
            select: 'name image',
          })
          .populate({
            path: 'reportedBy',
            select: 'name image',
          })
          .populate({
            path: 'prompt',
            select: 'title', // 确保包含 prompt 的标题
          })
          .select('+prompt') // 确保 prompt 字段被选中
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum);

        res.status(200).json({
          success: true,
          data: comments,
          currentPage: pageNum,
          totalPages: Math.ceil(totalComments / limitNum),
          totalComments: totalComments,
        });
      } catch (error) {
        console.error('获取所有评论失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，获取评论失败' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 