import dbConnect from '../../../../lib/dbConnect';
import Prompt from '../../../../models/Prompt'; // 确保导入 Prompt 模型
import Comment from '../../../../models/Comment'; // 导入 Comment 模型
import User from '../../../../models/User'; // 确保导入 User 模型
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

  switch (method) {
    case 'GET':
      try {
        let query = { prompt: id };
        // 如果不是管理员，只获取已通过的评论
        if (!isAdmin) {
          query.status = 'approved';
        }

        // 获取特定 Prompt 的评论，并填充作者信息
        const comments = await Comment.find(query)
          .populate({
            path: 'author',
            select: 'name image', // 只选择作者的 name 和 image 字段
          })
          .sort({ createdAt: -1 }); // 按时间倒序排列

        res.status(200).json({ success: true, data: comments });
      } catch (error) {
        console.error('获取评论失败:', error);
        res.status(500).json({ success: false, error: '服务器错误，获取评论失败' });
      }
      break;

    case 'POST':
      if (!session) {
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

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 