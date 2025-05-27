import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { cleanupOrphanedNotifications } from '../../../scripts/cleanup-notifications';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  // 只允许管理员执行清理操作
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(',') : [];
  const isAdmin = session?.user?.email && adminEmails.includes(session.user.email);
  
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: '需要管理员权限' });
  }

  try {
    console.log('开始清理孤立通知...');
    const result = await cleanupOrphanedNotifications();
    
    return res.status(200).json({ 
      success: true, 
      message: '清理完成',
      result 
    });
  } catch (error) {
    console.error('清理孤立通知失败:', error);
    return res.status(500).json({ 
      success: false, 
      error: '清理失败: ' + error.message 
    });
  }
}
