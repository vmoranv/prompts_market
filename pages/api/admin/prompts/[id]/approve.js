import { connectToDatabase } from '../../../../../utils/database';
import Prompt from '../../../../../models/Prompt';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]';
import Notification from '../../../../../models/Notification';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  const { id } = req.query;
  const { clearCache } = req.body || {};

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: '没有权限执行此操作', session });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: '无效的提示 ID' });
  }

  try {
    await connectToDatabase();
    
    const prompt = await Prompt.findByIdAndUpdate(
      id,
      { 
        status: 'published',
        updatedAt: new Date()
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

    // 创建通知
    const newNotification = await Notification.create({
      recipient: prompt.author._id,
      sender: session.user.id,
      type: 'prompt_approved',
      relatedEntity: prompt._id,
      relatedEntityType: 'Prompt',
    });

    console.log(`为用户 ${prompt.author._id} 创建了提示审核通过通知`);

    // 检查并限制通知数量
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
      message: '提示已成功发布',
      prompt 
    });
  } catch (error) {
    console.error('发布提示错误:', error);
    return res.status(500).json({ error: '服务器错误', details: error.message });
  }
} 