import mongoose, { Schema } from 'mongoose';

const PromptSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // 关联到 User 模型
    required: [true, "Prompt 必须有一个作者!"],
  },
  title: {
    type: String,
    required: [true, "请填写标题"],
    trim: true,
    maxlength: [100, "标题不能超过100个字符"],
  },
  content: {
    type: String,
    required: [true, "请填写内容"],
    trim: true,
  },
  tag: {
    type: String,
    required: [true, "请选择至少一个标签"],
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    required: true,
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

// 移除Schema定义中的索引属性，统一在这里定义所有索引
// 删除tag字段上的index:true属性，改为在这里定义

// 增加复合索引来提高常见查询性能
PromptSchema.index({ status: 1, createdAt: -1 }); // 状态和创建时间的复合索引
PromptSchema.index({ author: 1, status: 1 }); // 作者和状态的复合索引
PromptSchema.index({ tags: 1 }); // 标签索引 (这是之前重复的索引)
PromptSchema.index({ title: "text", content: "text" }); // 全文索引用于搜索
PromptSchema.index({ viewCount: -1 }); // 浏览量索引，用于热门排序
PromptSchema.index({ likesCount: -1 }); // 点赞数索引，用于热门排序

// 添加索引
PromptSchema.index({ status: 1, createdAt: -1 });
PromptSchema.index({ status: 1, likesCount: -1 });
PromptSchema.index({ status: 1, viewCount: -1 });

// 自动更新updatedAt字段
PromptSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.Prompt || mongoose.model('Prompt', PromptSchema); 