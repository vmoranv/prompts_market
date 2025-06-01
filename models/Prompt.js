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

// 添加索引以提高查询性能
// 1. 基本字段索引
PromptSchema.index({ status: 1 }); // 状态索引，用于查询已发布的prompts
PromptSchema.index({ author: 1 }); // 作者索引，用于查询用户的prompts
PromptSchema.index({ tags: 1 }); // 标签索引，用于按标签筛选
PromptSchema.index({ createdAt: -1 }); // 创建时间降序索引，用于排序
PromptSchema.index({ likesCount: -1 }); // 点赞数降序索引，用于热门排序

// 2. 复合索引 - 用于组合查询条件
PromptSchema.index({ status: 1, createdAt: -1 }); // 常用组合：状态+时间
PromptSchema.index({ status: 1, likesCount: -1 }); // 常用组合：状态+热度

// 3. 文本索引 - 如果已在Atlas UI配置则可省略
PromptSchema.index({ title: 'text', content: 'text', tags: 'text' });

// 自动更新updatedAt字段
PromptSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.Prompt || mongoose.model('Prompt', PromptSchema); 