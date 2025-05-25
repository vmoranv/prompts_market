import Prompt from '../../../models/Prompt';
import dbConnect from '../../../lib/dbConnect';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import User from '../../../models/User';
import Notification from '../../../models/Notification';
import Joi from 'joi';

// 定义请求体验证 Schema
const promptSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  content: Joi.string().min(10).required(),
  tags: Joi.array().items(Joi.string().max(50)).optional().default([]),
  isPublic: Joi.boolean().optional().default(true),
});

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
        // 验证请求体
        const { error, value } = promptSchema.validate(req.body);

        if (error) {
          // 返回验证错误信息
          return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const { title, content, tags, isPublic } = value;

        // 创建新的 Prompt
        const newPrompt = await Prompt.create({
          title,
          content,
          tags,
          isPublic,
          author: session.user.id,
        });

        // 获取作者的用户信息
        const author = await User.findById(session.user.id);

        // 通知作者的关注者有新 Prompt 发布
        if (author && author.followers && author.followers.length > 0) {
          const notifications = author.followers.map(followerId => ({
            recipient: followerId,
            sender: session.user.id,
            type: 'new_prompt',
            relatedEntity: newPrompt._id,
            read: false,
          }));

          // 这里是将通知直接插入数据库，后续 S3 将改为发送到队列
          await Notification.insertMany(notifications);
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