import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({
  prompt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prompt', // 引用 Prompt 模型
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // 引用 User 模型
    required: true,
  },
  content: {
    type: String,
    required: [true, '评论内容不能为空'],
    maxlength: [500, '评论内容不能超过500个字符'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    required: true,
  },
  reportsCount: { // 新增字段：举报次数
    type: Number,
    default: 0,
  },
  reportedBy: [{ // 新增字段：举报该评论的用户 ID 列表
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
});

// 确保 prompt 字段在查询时默认不被排除
CommentSchema.set('toJSON', { getters: true, virtuals: true });
CommentSchema.set('toObject', { getters: true, virtuals: true });

// 如果模型已经存在，则使用现有模型，否则创建新模型
const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);

export default Comment; 