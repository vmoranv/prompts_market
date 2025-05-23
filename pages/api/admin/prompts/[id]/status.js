import dbConnect from '../../../../../lib/dbConnect';
import Prompt from '../../../../../models/Prompt';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  const token = await getToken({ req });

  if (!token || token.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权执行此操作' });
  }

  const {
    query: { id },
    method,
    body, 
  } = req;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: '无效的 Prompt ID' });
  }

  await dbConnect();

  switch (method) {
    case 'PUT':
      try {
        const { newStatus, rejectionReason } = body;

        if (!['published', 'rejected'].includes(newStatus)) {
          return res.status(400).json({ success: false, message: '无效的状态' });
        }

        const prompt = await Prompt.findById(id);
        if (!prompt) {
          return res.status(404).json({ success: false, message: 'Prompt 未找到' });
        }

        if (prompt.status !== 'pending') {
          return res.status(400).json({ success: false, message: `此 Prompt 当前状态为 ${prompt.status}，无法从此状态更新。` });
        }

        prompt.status = newStatus;
        if (newStatus === 'rejected' && rejectionReason) {
          prompt.rejectionReason = rejectionReason;
        } else {
          prompt.rejectionReason = null; 
        }

        await prompt.save();

        res.status(200).json({ success: true, data: prompt, message: `Prompt 已成功 ${newStatus === 'published' ? '发布' : '拒绝'}` });
      } catch (error) {
        console.error(`Error updating prompt ${id} status:`, error);
        res.status(500).json({ success: false, message: '更新 Prompt 状态失败' });
      }
      break;
    default:
      res.setHeader('Allow', ['PUT']);
      res.status(405).json({ success: false, message: `方法 ${method} 不允许` });
      break;
  }
} 