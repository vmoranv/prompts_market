import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  // 通知接收者 (当前用户)
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // 引用 User 模型
    required: true,
  },
  // 通知发送者 (触发通知的用户，例如关注者、Prompt 作者、评论作者)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // 引用 User 模型
    required: true,
  },
  // 通知类型
  type: {
    type: String,
    required: true,
    enum: ['follow', 'new_prompt', 'new_comment', 'prompt_approved', 'prompt_rejected'], // 添加两种新通知类型
  },
  // 关联的实体 (例如 Prompt ID 或 Comment ID)
  relatedEntity: {
    type: mongoose.Schema.Types.ObjectId,
    // 根据 type 字段动态引用不同的模型
    refPath: 'relatedEntityType',
    required: false, // 关注通知可能没有关联实体
  },
  // 关联实体的模型类型 (用于 refPath)
  relatedEntityType: {
    type: String,
    required: false,
    enum: ['Prompt', 'Comment'], // 定义可能的关联实体类型
  },
  // 通知是否已读
  read: {
    type: Boolean,
    default: false,
  },
  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 为 recipient 字段创建索引以提高查询效率
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// 如果模型已经存在，则使用现有模型，否则创建新模型
const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

export default Notification; 