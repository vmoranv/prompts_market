import { connectToDatabase } from '../../../../lib/mongodb'; // 假设您的数据库连接函数在这里
import { ObjectId } from 'mongodb'; // 如果您使用 MongoDB ObjectId

export default async function handler(req, res) {
  // 确保只处理 GET 请求
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  const { userId } = req.query; // 从 URL 参数中获取 userId

  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  // 检查 userId 是否是有效的 ObjectId
  if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid User ID format' });
  }

  try {
    const { db } = await connectToDatabase(); // 连接到数据库

    // 查找指定用户，并获取其 following 字段中的用户 ID 列表
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { following: 1 } } // 只获取 following 字段
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const followingUserIds = user.following || []; // 获取关注的用户 ID 列表，如果不存在则为空数组

    // 如果 followingUserIds 为空，直接返回空数组，避免后续查询错误
    if (followingUserIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
    }

    // 确保 followingUserIds 中的每个 ID 都是有效的 ObjectId，并进行转换
    const validFollowingObjectIds = followingUserIds
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));

    // 如果没有有效的 ObjectId，也返回空数组
    if (validFollowingObjectIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
    }


    // 根据获取到的用户 ID 列表，查询这些用户的详细信息
    const followingUsers = await db.collection('users').find(
      { _id: { $in: validFollowingObjectIds } },
      { projection: { name: 1, email: 1, image: 1 } } // 只获取需要显示的用户信息字段
    ).toArray();

    // 返回成功响应和关注用户列表
    res.status(200).json({ success: true, data: followingUsers });

  } catch (error) {
    console.error("获取关注用户列表失败:", error);
    // 返回 JSON 格式的错误响应
    res.status(500).json({ success: false, error: 'Failed to fetch following users', details: error.message });
  }
} 