import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * 全局变量以在开发环境中缓存数据库连接
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// 添加连接状态监控
const connectionStates = {
  0: '已断开',
  1: '已连接',
  2: '正在连接',
  3: '正在断开',
};

async function dbConnect() {
  // 如果已有连接，检查连接状态
  if (cached.conn) {
    const state = cached.conn.connection.readyState;
    if (state === 1) {
      return cached.conn;
    }
    console.log(`[MongoDB] 当前连接状态: ${connectionStates[state] || '未知'}，尝试重新连接...`);
    cached.promise = null; // 重置连接Promise
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 20,         // 增加连接池大小到20
      minPoolSize: 5,          // 设置最小连接数
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,               // 强制使用IPv4
      autoIndex: process.env.NODE_ENV !== 'production', // 在生产环境禁用自动索引创建
      // 启用重试
      retryWrites: true,
      retryReads: true,
    };

    // 启动连接并增加监控
    const startTime = Date.now();
    console.log('[MongoDB] 开始连接数据库...');
    
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        const connectionTime = Date.now() - startTime;
        console.log(`[MongoDB] 已成功连接到MongoDB (耗时: ${connectionTime}ms)`);
        
        // 监听连接错误
        mongoose.connection.on('error', (err) => {
          console.error('[MongoDB] 连接错误:', err);
        });
        
        // 监听断开连接
        mongoose.connection.on('disconnected', () => {
          console.log('[MongoDB] 数据库连接已断开');
        });
        
        // 监听重新连接
        mongoose.connection.on('reconnected', () => {
          console.log('[MongoDB] 数据库已重新连接');
        });
        
        return mongoose;
      })
      .catch((err) => {
        console.error('[MongoDB] 连接失败:', err);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('[MongoDB] 连接出错，将在下次请求时重试:', e);
    throw e;
  }

  return cached.conn;
}

// 添加一个公共方法用于获取当前连接状态
dbConnect.getConnectionStatus = () => {
  if (!cached.conn) return { connected: false, state: '未连接' };
  
  const state = cached.conn.connection.readyState;
  return {
    connected: state === 1,
    state: connectionStates[state] || '未知',
    host: cached.conn.connection.host,
    db: cached.conn.connection.db?.databaseName
  };
};

export default dbConnect; 