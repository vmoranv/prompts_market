import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    '请在环境变量中设置MONGODB_URI'
  );
}

/**
 * 全局变量来缓存数据库连接状态
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * 连接到数据库
 * @returns {Promise<{db: Db, client: MongoClient}>}
 */
export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        return {
          db: mongoose.connection.db,
          mongoose: mongoose
        };
      });
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
} 