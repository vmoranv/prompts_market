import dbConnect from '../../../../lib/dbConnect';
import Prompt from '../../../../models/Prompt';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  const token = await getToken({ req });

  if (!token || token.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权执行此操作' });
  }

  const { method } = req;
  await dbConnect();

  if (method === 'POST') {
    try {
      const {
        action, 
        filter, 
        rejectionReason, 
      } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: '无效的操作类型' });
      }
      if (action === 'reject' && typeof rejectionReason !== 'string') {
        return res.status(400).json({ success: false, message: '拒绝操作必须提供原因' });
      }

      const query = { status: 'pending' };

      if (filter) {
        if (filter.titleRegex) {
          try {
            new RegExp(filter.titleRegex); 
            query.title = { $regex: filter.titleRegex, $options: 'i' }; 
          } catch (e) {
            return res.status(400).json({ success: false, message: '无效的标题正则表达式' });
          }
        }
        if (filter.contentRegex) {
          try {
            new RegExp(filter.contentRegex); 
            query.content = { $regex: filter.contentRegex, $options: 'i' };
          } catch (e) {
            return res.status(400).json({ success: false, message: '无效的内容正则表达式' });
          }
        }
        if (filter.authorId) {
          if (!mongoose.Types.ObjectId.isValid(filter.authorId)) {
            return res.status(400).json({ success: false, message: '无效的作者ID格式' });
          }
          query.author = filter.authorId;
        }
        if (filter.tags && Array.isArray(filter.tags) && filter.tags.length > 0) {
          const validTags = filter.tags.filter(tag => typeof tag === 'string' && tag.trim() !== '');
          if (validTags.length > 0) {
            query.tags = { $all: validTags }; 
          }
        }
      }

      const updateData = {
        status: action === 'approve' ? 'published' : 'rejected',
      };

      if (action === 'reject') {
        updateData.rejectionReason = rejectionReason || null; 
      } else {
        updateData.rejectionReason = null;
      }

      const result = await Prompt.updateMany(query, { $set: updateData });

      if (result.matchedCount === 0) {
        return res.status(200).json({ success: true, message: '没有找到符合条件的待审核 Prompts。', modifiedCount: 0, matchedCount: 0 });
      }


      res.status(200).json({
        success: true,
        message: `成功 ${action === 'approve' ? '批准' : '拒绝'} 了 ${result.modifiedCount} 个 Prompts。`,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
      });
    } catch (error) {
      console.error("Error in batch review:", error);
      res.status(500).json({ success: false, message: '批量审核操作失败', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ success: false, message: `方法 ${method} 不允许` });
  }
} 