import Prompt from '../../../models/Prompt';
import dbConnect from '../../../lib/dbConnect';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ success: false, error: '未授权，请登录后创建 Prompt' });
  }

  if (req.method === 'POST') {
    try {
      const { title, content, tags } = req.body;

      if (!title || !content) {
        return res.status(400).json({ success: false, error: '标题和内容不能为空' });
      }

      const newPrompt = new Prompt({
        title,
        content,
        tags: tags || [],
        author: session.user.id,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await newPrompt.save();
      return res.status(201).json({ success: true, data: newPrompt });
    } catch (error) {
      console.error('Error creating prompt:', error);
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ success: false, error: messages.join(', ') });
      }
      return res.status(500).json({ success: false, error: 'Failed to create prompt' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 