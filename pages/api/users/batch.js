// 批量获取用户信息API
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  const { userIds } = req.body;
  
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, error: '无效的用户ID列表' });
  }

  try {
    await dbConnect();
    
    // 批量获取用户信息
    const users = await User.find(
      { _id: { $in: userIds } },
      'name image' // 只选择需要的字段
    ).lean();
    
    // 将结果转换为以ID为键的对象，方便前端使用
    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id] = user;
    });
    
    res.status(200).json({ success: true, data: usersMap });
  } catch (error) {
    console.error('批量获取用户信息失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
} 