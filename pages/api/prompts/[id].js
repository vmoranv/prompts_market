import dbConnect from '../../../lib/dbConnect';
import Prompt from '../../../models/Prompt';
import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
  await dbConnect();

  const {
    query: { id },
    method,
  } = req;

  const session = await getSession({ req });

  switch (method) {
    case 'GET':
      try {
        const prompt = await Prompt.findById(id).populate('author', 'name image');
        if (!prompt) {
          return res.status(404).json({ success: false, error: 'Prompt not found' });
        }
        res.status(200).json({ success: true, data: prompt });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;

    case 'PUT':
      try {
        if (!session) {
          return res.status(401).json({ success: false, error: '需要登录才能编辑 Prompt' });
        }

        const prompt = await Prompt.findById(id);

        if (!prompt) {
            return res.status(404).json({ success: false, error: 'Prompt not found' });
        }

        // 检查是否是作者本人或管理员
        const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
        const isAdmin = session.user.email && adminEmails.includes(session.user.email);
        const isAuthor = prompt.author.toString() === session.user.id;

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ success: false, error: '您没有权限编辑此 Prompt' });
        }

        const updatedPrompt = await Prompt.findByIdAndUpdate(id, req.body, {
          new: true,
          runValidators: true,
        });

        if (!updatedPrompt) {
          return res.status(404).json({ success: false, error: 'Prompt not found after update attempt' });
        }
        res.status(200).json({ success: true, data: updatedPrompt });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;

      case 'DELETE':
        try {
          if (!session) {
            return res.status(401).json({ success: false, error: '需要登录才能删除 Prompt' });
          }

          const prompt = await Prompt.findById(id);
          if (!prompt) {
            return res.status(404).json({ success: false, error: 'Prompt not found' });
          }

          // 权限检查
          const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
          const isAdmin = session.user.email && adminEmails.includes(session.user.email);
          const isAuthor = prompt.author.toString() === session.user.id;

          if (!isAuthor && !isAdmin) {
            return res.status(403).json({ success: false, error: '您没有权限删除此 Prompt' });
          }

          // ✅ 删除 Prompt 前先删除相关通知
          await Notification.deleteMany({
            relatedEntity: id,
            relatedEntityType: 'Prompt'
          });

          // 删除 Prompt
          const deletedPrompt = await Prompt.deleteOne({ _id: id });
          if (deletedPrompt.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'Prompt not found or already deleted' });
          }

          console.log(`已删除 Prompt ${id} 及其相关通知`);
          res.status(200).json({ success: true, data: {} });
        } catch (error) {
          res.status(400).json({ success: false, error: error.message });
        }
        break;


    default:
      res.status(400).json({ success: false, error: 'Method not allowed' });
      break;
  }
} 