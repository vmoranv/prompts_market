import Prompt from '../../../models/Prompt'; 
import { connectToDatabase } from '../../../utils/database';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      await connectToDatabase();
      
      const pendingPrompts = await Prompt.find({ status: 'pending' })
        .populate('author', 'name email') 
        .sort({ createdAt: -1 }); 

      return res.status(200).json({ success: true, data: pendingPrompts });
    } catch (error) {
      console.error('Error fetching pending prompts:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch pending prompts' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 