import mongoose, { Schema } from 'mongoose';

const PromptSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // 关联到 User 模型
    required: [true, "Prompt 必须有一个作者!"],
  },
  title: {
    type: String,
    required: [true, "请提供 Prompt 标题!"],
    trim: true,
    maxlength: [100, "标题不能超过 100 个字符"],
  },
  content: {
    type: String,
    required: [true, "请提供 Prompt 内容!"],
    trim: true,
  },
  tags: {
    type: [String], // 字符串数组
    validate: [arrayLimit, '{PATH} 超出标签数量限制 (最多10个)'], // 自定义校验器
    default: [],
  },
  status: {
    type: String,
    enum: ['pending', 'published', 'rejected', 'archived'],
    default: 'pending', // 新创建的 Prompt 默认为待审核
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: null,
  },
  likesCount: {
    type: Number,
    default: 0,
  },
  likedBy: [{ // 存储点赞用户的 ID
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  publishedAt: { // 发布时间，由管理员操作时设置
    type: Date,
  },
  price: {
    type: Number,
    default: 0
  },
  likes: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },
  viewCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt 字段
});

// 自定义校验函数，限制标签数量
function arrayLimit(val) {
  return val.length <= 10;
}

// 为 title 和 content 创建文本索引，方便后续搜索 (如果需要更高级的搜索，考虑 Atlas Search)
// PromptSchema.index({ title: 'text', content: 'text', tags: 'text' }); // 如果用 MongoDB Atlas，可以直接在 Atlas UI 配置

// 自动更新updatedAt字段
PromptSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.Prompt || mongoose.model('Prompt', PromptSchema); 