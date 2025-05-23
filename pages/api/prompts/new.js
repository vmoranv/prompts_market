import Prompt from '../../../models/Prompt'; 

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { title, content, tags } = req.body;

      const newPrompt = new Prompt({
        title,
        content,
        tags,
        author: session.user.id, 
        status: 'pending', 
        createdAt: new Date(), 
        updatedAt: new Date(),
      });

      await newPrompt.save();
      return res.status(201).json({ success: true, data: newPrompt });
    } catch (error) {
      console.error('Error creating prompt:', error);
      return res.status(500).json({ success: false, error: 'Failed to create prompt' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 