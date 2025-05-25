import dbConnect from '../../lib/dbConnect';
import Notification from '../../models/Notification';
import Comment from '../../models/Comment';
import Prompt from '../../models/Prompt'; 
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  const { method } = req;
  // 可以添加分页参数，例如 ?page=1&limit=10
  const { page = 1, limit = 10, readStatus = 'all' } = req.query; // readStatus 可以是 'all', 'read', 'unread'

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  // 只有登录用户才能获取通知
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ success: false, error: '未授权，请登录后查看通知' });
  }

  const currentUserId = session.user.id;

  switch (method) {
    case 'GET':
      try {
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        let query = { recipient: currentUserId }; // 只获取当前用户的通知

        // 根据 readStatus 过滤
        if (readStatus === 'read') {
          query.read = true;
        } else if (readStatus === 'unread') {
          query.read = false;
        }

        // 获取总通知数
        const totalNotifications = await Notification.countDocuments(query);

        // 获取当前页的通知，并填充发送者和关联实体信息
        const notifications = await Notification.find(query)
          .populate({
            path: 'sender',
            select: 'name image', // 填充发送者的姓名和头像
          })
          .populate({
            path: 'relatedEntity',
            // 根据 relatedEntityType 动态填充 Prompt 或 Comment
            // 对于 Prompt，填充 title
            // 对于 Comment，可能需要填充 content 的一部分或 Prompt title
            // 这里我们先填充 Prompt 的 title 和 Comment 的 content
            populate: [
              { path: 'prompt', select: 'title' }, // 如果 relatedEntity 是 Comment，填充其 Prompt
            ],
          })
          .sort({ createdAt: -1 }) // 按创建时间倒序排列
          .skip(skip)
          .limit(limitNum)
          .lean(); // 使用 lean() 获取 plain JavaScript objects

        // 根据通知类型处理 relatedEntity 的显示数据
        const formattedNotifications = notifications.map(notification => {
          let relatedEntityInfo = null;
          let link = null;

          if (notification.relatedEntity) {
            if (notification.relatedEntityType === 'Prompt') {
              relatedEntityInfo = {
                _id: notification.relatedEntity._id,
                title: notification.relatedEntity.title || '无标题提示',
              };
              link = `/prompt/${notification.relatedEntity._id}`; // Prompt 详情页链接
            } else if (notification.relatedEntityType === 'Comment') {
              // 对于评论通知，我们可能需要显示评论内容的一部分以及所属 Prompt 的信息
              // 加强对嵌套 prompt 的检查
              relatedEntityInfo = {
                _id: notification.relatedEntity._id,
                // 评论内容可能很长，这里只显示一部分
                contentPreview: notification.relatedEntity.content ? notification.relatedEntity.content.substring(0, 50) + '...' : '无内容',
                // 确保 relatedEntity.prompt 存在再访问其属性
                prompt: notification.relatedEntity.prompt ? {
                  _id: notification.relatedEntity.prompt._id,
                  title: notification.relatedEntity.prompt.title || '无标题提示',
                } : null,
              };
              // 确保 relatedEntity.prompt 存在再生成链接
              link = notification.relatedEntity.prompt ? `/prompt/${notification.relatedEntity.prompt._id}` : null;
            }
          }

          return {
            ...notification,
            sender: notification.sender ? {
              _id: notification.sender._id,
              name: notification.sender.name || '未知用户',
              image: notification.sender.image,
            } : null,
            relatedEntity: relatedEntityInfo,
            link: link, // 添加跳转链接
          };
        });


        res.status(200).json({
          success: true,
          data: formattedNotifications,
          currentPage: pageNum,
          totalPages: Math.ceil(totalNotifications / limitNum),
          totalNotifications: totalNotifications,
        });

      } catch (error) {
        // 添加更详细的错误日志
        console.error('获取通知 API 错误:', error);
        // 返回更通用的错误信息给前端，避免暴露敏感信息
        res.status(500).json({ success: false, error: '服务器内部错误，无法获取通知' });
      }
      break;

    // 可以添加 PUT 方法来标记通知为已读
    case 'PUT':
        try {
            const { notificationIds, read } = req.body; // 接收要更新的通知 ID 数组和 read 状态

            if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
                return res.status(400).json({ success: false, error: '需要提供有效的通知 ID 数组' });
            }

            // 确保所有 ID 都是有效的 ObjectId
            const validNotificationIds = notificationIds.filter(id => mongoose.Types.ObjectId.isValid(id));

            if (validNotificationIds.length === 0) {
                 return res.status(400).json({ success: false, error: '提供的通知 ID 格式无效' });
            }

            // 更新通知的 read 状态，只更新属于当前用户的通知
            const updateResult = await Notification.updateMany(
                { _id: { $in: validNotificationIds }, recipient: currentUserId },
                { $set: { read: read === true } } // 确保 read 是布尔值
            );

            res.status(200).json({ success: true, message: `成功更新 ${updateResult.modifiedCount} 条通知`, modifiedCount: updateResult.modifiedCount });

        } catch (error) {
            console.error('更新通知状态失败:', error);
            res.status(500).json({ success: false, error: '服务器错误，更新通知状态失败', details: error.message });
        }
        break;


    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).json({ success: false, error: `方法 ${method} 不允许` });
      break;
  }
} 