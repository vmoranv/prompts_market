import Prompt from '../../../models/Prompt';
import dbConnect from '../../../lib/dbConnect';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import User from '../../models/User';
import Notification from '../../models/Notification';

export default async function handler(req, res) {
  const { method } = req;

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ success: false, error: '未授权，请登录后操作' });
  }

  switch (method) {
    case 'POST':
      try {
        const { prompt, tag } = req.body;

        if (!prompt || !tag) {
          return res.status(400).json({ success: false, error: 'Prompt 和 Tag 不能为空' });
        }

        // 创建新的 Prompt
        const newPrompt = await Prompt.create({
          creator: session.user.id,
          prompt,
          tag,
        });

        // 查找所有关注此 Prompt 作者的用户
        const authorId = session.user.id;
        const followers = await User.find({ following: authorId }).select('_id').lean();

        // 为每个关注者创建新 Prompt 通知
        const notifications = followers.map(follower => ({
          recipient: follower._id, // 关注者收到通知
          sender: authorId, // Prompt 作者是发送者
          type: 'new_prompt',
          relatedEntity: newPrompt._id, // 关联新创建的 Prompt
          relatedEntityType: 'Prompt',
        }));

        // 批量创建通知
        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
          console.log(`为 ${notifications.length} 个关注者创建了新 Prompt 通知`);
        }


        res.status(201).json({ success: true, data: newPrompt });
      } catch (error) {
        console.error('创建 Prompt 失败:', error);
        if (error.name === 'ValidationError') {
          const messages = Object.values(error.errors).map(val => val.message);
          return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        res.status(500).json({ success: false, error: '服务器错误，创建 Prompt 失败' });
      }
      break;

    default:
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 