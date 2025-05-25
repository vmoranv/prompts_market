import dbConnect from '../../../../../lib/dbConnect';
import Prompt from '../../../../../models/Prompt';
import Notification from '../../../../../models/Notification';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `方法 ${req.method} 不允许` });
  }

  const { id } = req.query;
  const { clearCache } = req.body || {};

  const session = await getServerSession(req, res, authOptions);
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
  
  if (!session || !session.user || !adminEmails.includes(session.user.email)) {
    return res.status(403).json({ error: '未授权，只有管理员才能拒绝提示' });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: '无效的提示ID' });
  }

  try {
    await dbConnect();
    
    const prompt = await Prompt.findByIdAndUpdate(
      id,
      { 
        $set: {
          status: 'rejected',
          updatedAt: new Date(),
        }
      },
      { new: true }
    ).populate('author', 'name image');

    if (!prompt) {
      return res.status(404).json({ error: '提示未找到' });
    }

    if (clearCache) {
      try {
        console.log(`清除提示ID ${id} 的缓存`);
        
        await mongoose.connection.db.collection('promptsCache').deleteMany({ promptId: id });
      } catch (cacheError) {
        console.error('清除缓存错误:', cacheError);
      }
    }

    const newNotification = await Notification.create({
      recipient: prompt.author._id,
      sender: session.user.id,
      type: 'prompt_rejected',
      relatedEntity: prompt._id,
      relatedEntityType: 'Prompt',
    });

    console.log(`为用户 ${prompt.author._id} 创建了提示被拒绝通知`);

    const maxNotifications = 300;
    const recipientId = prompt.author._id;
    const totalNotifications = await Notification.countDocuments({ recipient: recipientId });

    if (totalNotifications > maxNotifications) {
      const numToDelete = totalNotifications - maxNotifications;
      const notificationsToDelete = await Notification.find({ recipient: recipientId })
        .sort({ createdAt: 1 })
        .limit(numToDelete)
        .select('_id');

      const idsToDelete = notificationsToDelete.map(notif => notif._id);
      await Notification.deleteMany({ _id: { $in: idsToDelete } });

      console.log(`为用户 ${recipientId} 删除了 ${numToDelete} 条最旧的通知。`);
    }

    return res.status(200).json({ 
      success: true, 
      message: '提示已被成功拒绝',
      prompt 
    });
  } catch (error) {
    console.error('拒绝提示错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
} 