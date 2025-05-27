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

  const userId = session.user.id;
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  // 在现有的 DELETE 方法处理中修改
  if (req.method === 'DELETE') {
    try {
      const session = await getServerSession(req, res, authOptions);
      if (!session) {
        return res.status(401).json({ success: false, error: '未授权访问' });
      }

      await dbConnect();

      const { notificationId } = req.body; // 新增：支持单个消息删除

      let result;
      if (notificationId) {
        // 删除单个通知
        result = await Notification.deleteOne({ 
          _id: notificationId,
          recipient: session.user.id 
        });
        
        if (result.deletedCount === 0) {
          return res.status(404).json({ 
            success: false, 
            error: '消息不存在或无权删除' 
          });
        }
      } else {
        // 删除当前用户的所有通知（原有功能）
        result = await Notification.deleteMany({ 
          recipient: session.user.id 
        });
      }

      res.status(200).json({ 
        success: true, 
        deletedCount: result.deletedCount,
        message: notificationId ? '消息已删除' : '所有消息已清理完成'
      });
    } catch (error) {
      console.error('清理消息失败:', error);
      res.status(500).json({ 
        success: false, 
        error: '清理消息失败' 
      });
    }
    return;
  }

  switch (method) {
    case 'GET':
      try {
        let query = { recipient: userId }; // 只获取当前用户的通知

        // 根据 readStatus 过滤
        if (readStatus !== 'all') {
          query.read = readStatus === 'read';
        }

        // 获取通知总数（用于分页）
        const totalNotifications = await Notification.countDocuments(query);

        // 获取通知列表，并填充 sender 和 relatedEntity
        const notifications = await Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .populate('sender', 'name image');

        // 手动填充 relatedEntity
        for (let notification of notifications) {
          if (notification.relatedEntity && notification.relatedEntityType) {
            try {
              if (notification.relatedEntityType === 'Comment') {
                await notification.populate({
                  path: 'relatedEntity',
                  model: 'Comment',
                  populate: {
                    path: 'prompt',
                    model: 'Prompt',
                    select: 'title',
                  },
                  select: 'content prompt',
                });
              } else if (notification.relatedEntityType === 'Prompt') {
                await notification.populate({
                  path: 'relatedEntity',
                  model: 'Prompt',
                  select: 'title',
                });
              }
            } catch (populateError) {
              // ✅ Populate 失败时，将 relatedEntity 设为 null
              console.warn(`通知 ${notification._id} 的关联实体已被删除:`, populateError.message);
              notification.relatedEntity = null;
            }
          }
        }

        // 根据通知类型处理 relatedEntity 的显示数据
        const formattedNotifications = notifications.map(notification => {
          let relatedEntityInfo = null;
          let link = '/';
          let icon = 'default'; // 添加图标字段

          // 根据通知类型设置相关实体信息和链接
          if (notification.relatedEntity) {
            switch (notification.type) {
              case 'new_comment':
                // 评论通知逻辑
                if (notification.relatedEntityType === 'Comment' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id,
                    content: notification.relatedEntity.content,
                    // 确保包含 prompt 信息
                    prompt: {
                      _id: notification.relatedEntity.prompt?._id || notification.relatedEntity.prompt,
                      title: notification.relatedEntity.prompt?.title || '未知提示'
                    }
                  };
                  // 链接应该使用 Comment 中的 prompt 字段
                  link = `/prompt/${notification.relatedEntity.prompt?._id || notification.relatedEntity.prompt}`;
                  icon = 'comment';
                }
                break;


              case 'new_prompt':
                if (notification.relatedEntityType === 'Prompt' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id, // ✅ 修正
                    title: notification.relatedEntity.title || '未知提示', // ✅ 修正
                  };
                  link = `/prompt/${notification.relatedEntity._id}`; // ✅ 修正
                  icon = 'prompt';
                }
                break;

              case 'prompt_approved':
                if (notification.relatedEntityType === 'Prompt' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id, // ✅ 直接访问
                    title: notification.relatedEntity.title || '未知提示', // ✅ 直接访问
                  };
                  link = `/prompt/${notification.relatedEntity._id}`; // ✅ 直接访问
                  icon = 'approved';
                }
                break;

              case 'prompt_rejected':
                if (notification.relatedEntityType === 'Prompt' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id, // ✅ 直接访问
                    title: notification.relatedEntity.title || '未知提示', // ✅ 直接访问
                  };
                  link = '/dashboard';
                  icon = 'rejected';
                }
                break;

              case 'follow':
                // 关注通知
                if (notification.relatedEntityType === 'User' && notification.relatedEntity) {
                   relatedEntityInfo = {
                     _id: notification.relatedEntity._id,
                     name: notification.relatedEntity.name,
                   };
                   link = `/user/${notification.relatedEntity._id}`; // 关注通知跳转到用户主页
                   icon = 'follow'; // 关注图标
                }
                break;

              // 添加其他通知类型...
              default:
                 icon = 'info'; // 默认图标
                 break;
            }
          } else if (notification.type.includes('prompt')) {
            // ✅ 如果是 Prompt 相关通知但 relatedEntity 为 null，标记为已删除
            relatedEntityInfo = {
              _id: null,
              title: '该提示已被删除',
              deleted: true
            };
            link = '/dashboard';
            icon = 'deleted';
          }

          return {
            ...notification.toObject(), // 使用 toObject() 获取纯 JavaScript 对象
            sender: notification.sender ? {
              _id: notification.sender._id,
              name: notification.sender.name || '未知用户',
              image: notification.sender.image,
            } : null,
            relatedEntity: relatedEntityInfo,
            link: link,
            icon: icon, // 添加图标字段到返回数据
          };
        });


        res.status(200).json({
          success: true,
          data: formattedNotifications,
          currentPage: pageNumber,
          totalPages: Math.ceil(totalNotifications / limitNumber),
          totalNotifications: totalNotifications,
        });

      } catch (error) {
        console.error('获取通知 API 错误:', error); // 记录详细错误
        res.status(500).json({ success: false, error: error.message || '服务器内部错误，无法获取通知' }); // 返回更详细的错误信息
      }
      break;

    case 'PUT': // 用于标记通知为已读/未读
      try {
        // 检查用户是否登录
        if (!session || !session.user || !session.user.id) {
          return res.status(401).json({ success: false, error: '未授权，请登录后操作' });
        }

        const { notificationIds, read } = req.body;

        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
          return res.status(400).json({ success: false, error: '请提供要更新的通知 ID 列表' });
        }

        // 确保用户只能更新自己的通知
        const updateResult = await Notification.updateMany(
          { _id: { $in: notificationIds }, recipient: userId },
          { $set: { read: read } }
        );

        if (updateResult.matchedCount === 0) {
             // 如果 matchedCount 为 0，可能是因为提供的 ID 不属于当前用户或 ID 无效
             // 但我们仍然返回成功，因为没有需要更新的通知符合条件
             return res.status(200).json({ success: true, message: '没有找到符合条件的通知进行更新' });
        }


        res.status(200).json({ success: true, message: '通知状态更新成功', updatedCount: updateResult.modifiedCount });
      } catch (error) {
        console.error('更新通知状态失败:', error);
        res.status(500).json({ success: false, error: error.message || '服务器错误' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']); // 允许 GET 和 PUT 方法
      res.status(405).json({ success: false, error: 'Method not allowed' });
      break;
  }
} 