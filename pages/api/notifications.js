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
            select: 'title content', 
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean();

        // 根据通知类型处理 relatedEntity 的显示数据
        const formattedNotifications = notifications.map(notification => {
          let relatedEntityInfo = null;
          let link = '/';
          
          // 根据通知类型设置相关实体信息和链接
          if (notification.relatedEntity) {
            switch (notification.type) {
              case 'new_comment':
                // 现有的评论通知逻辑
                if (notification.relatedEntityType === 'Comment' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id,
                    content: notification.relatedEntity.content,
                    // 注意：这里需要获取评论关联的 Prompt ID 来生成链接
                    // 由于我们不再填充 relatedEntity.prompt，我们需要另一种方式获取 Prompt ID
                    // 可以在 Comment 模型中直接存储 prompt 字段，或者在 Notification 模型中存储 relatedPromptId
                    // 目前的代码结构下，如果 relatedEntity 是 Comment，relatedEntity.prompt 应该已经被填充了（如果 Comment 模型定义了 populate）
                    // 但为了避免 StrictPopulateError，我们移除了嵌套填充。
                    // 如果 Comment 模型本身没有填充 prompt，这里 relatedEntity.prompt 会是 ObjectId
                    // 假设 Comment 模型在其他地方被 populate 了 prompt 字段，或者 relatedEntity.prompt 已经是 ObjectId
                    // 如果 relatedEntity.prompt 是 ObjectId，我们需要单独获取 Prompt 信息
                    // 更好的做法是在 Notification 模型中存储 relatedPromptId 字段，或者在 Comment 模型中确保 prompt 字段被填充
                    // 暂时保留获取 promptId 的逻辑，但需要确保 relatedEntity.prompt 是有效的 ObjectId 或已填充对象
                    promptId: notification.relatedEntity.prompt, 
                  };
                  // 如果 relatedEntity.prompt 是 ObjectId，这里需要调整链接生成逻辑
                  link = `/prompts/${notification.relatedEntity.prompt}`;
                }
                break;
                
              case 'new_prompt':
                // 现有的新 Prompt 通知逻辑
                if (notification.relatedEntityType === 'Prompt' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id,
                    title: notification.relatedEntity.title,
                  };
                  link = `/prompts/${notification.relatedEntity._id}`;
                }
                break;
                
              case 'prompt_approved':
                // 新增: Prompt 审核通过通知
                if (notification.relatedEntityType === 'Prompt' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id,
                    title: notification.relatedEntity.title,
                  };
                  link = `/prompt/${notification.relatedEntity._id}`; // 审核通过跳转到 Prompt 详情页
                }
                break;
                
              case 'prompt_rejected':
                // 新增: Prompt 审核拒绝通知
                if (notification.relatedEntityType === 'Prompt' && notification.relatedEntity) {
                  relatedEntityInfo = {
                    _id: notification.relatedEntity._id,
                    title: notification.relatedEntity.title,
                  };
                  // 拒绝通知不提供链接跳转
                  link = '/dashboard'; // 拒绝通知跳转到用户仪表盘
                }
                break;
              
              // 现有的其他通知类型...
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
            link: link,
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
        console.error('获取通知 API 错误:', error);
        res.status(500).json({ success: false, error: '服务器内部错误，无法获取通知' });
      }
      break;

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