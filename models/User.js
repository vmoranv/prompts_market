import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请提供用户名'],
    maxlength: [50, '用户名不能超过50个字符']
  },
  email: {
    type: String,
    required: [true, '请提供邮箱'],
    unique: true
  },
  image: {
    type: String
  },
  // provider, providerAccountId 等字段会由 NextAuth 的 Adapter 自动处理和填充
  // 我们主要关注自定义的 role 字段
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // NextAuth MongoDBAdapter 会自动添加 emailVerified, accounts, sessions 等字段
  // 我们不需要在这里显式定义它们，除非有特殊需求
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt 字段
});

// 防止在热重载时重复编译模型
export default mongoose.models.User || mongoose.model('User', UserSchema);