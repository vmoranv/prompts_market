/**
 * 数据库性能分析工具
 * 用于监控和分析MongoDB查询性能
 */
import mongoose from 'mongoose';

// 全局存储慢查询统计
const slowQueries = {
  queries: [],
  stats: {
    total: 0,
    avg: 0,
    max: 0,
    min: Infinity
  }
};

// 慢查询阈值（毫秒）
const SLOW_QUERY_THRESHOLD = 500; 

/**
 * 记录慢查询
 * @param {Object} queryInfo - 查询信息
 * @param {Object} queryInfo.query - 查询条件
 * @param {Object} queryInfo.options - 查询选项（排序、分页等）
 * @param {Number} queryInfo.time - 查询耗时（毫秒）
 * @param {String} queryInfo.collection - 集合名称
 */
export function recordSlowQuery(queryInfo) {
  // 只记录超过阈值的查询
  if (queryInfo.time < SLOW_QUERY_THRESHOLD) return;
  
  // 添加到慢查询列表
  slowQueries.queries.push({
    ...queryInfo,
    timestamp: new Date()
  });
  
  // 限制记录数量，避免内存泄漏
  if (slowQueries.queries.length > 100) {
    slowQueries.queries.shift();
  }
  
  // 更新统计信息
  slowQueries.stats.total++;
  slowQueries.stats.avg = slowQueries.queries.reduce((acc, q) => acc + q.time, 0) / slowQueries.queries.length;
  slowQueries.stats.max = Math.max(slowQueries.stats.max, queryInfo.time);
  slowQueries.stats.min = Math.min(slowQueries.stats.min, queryInfo.time);
}

/**
 * 获取慢查询统计
 * @returns {Object} 慢查询统计信息
 */
export function getSlowQueryStats() {
  return {
    ...slowQueries.stats,
    count: slowQueries.queries.length,
    recent: slowQueries.queries.slice(-10) // 最近10条慢查询
  };
}

/**
 * 分析集合索引使用情况
 * @param {String} collectionName - 集合名称
 * @returns {Promise<Object>} 索引使用情况
 */
export async function analyzeIndexes(collectionName) {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    // 获取索引信息
    const indexes = await collection.indexes();
    
    // 获取索引统计
    const stats = await db.command({
      aggregate: collectionName,
      pipeline: [{ $indexStats: {} }],
      cursor: {}
    });
    
    return {
      indexes,
      stats: stats.cursor.firstBatch,
      suggestedIndexes: suggestIndexes(slowQueries.queries, collectionName)
    };
  } catch (error) {
    console.error(`[MongoDB] 分析索引失败:`, error);
    return { error: error.message };
  }
}

/**
 * 基于慢查询建议创建索引
 * @param {Array} queries - 慢查询列表
 * @param {String} collectionName - 集合名称
 * @returns {Array} 建议的索引
 */
function suggestIndexes(queries, collectionName) {
  // 简单实现：统计查询中最常用的字段组合
  const fieldCombinations = {};
  
  queries
    .filter(q => q.collection === collectionName)
    .forEach(q => {
      const fields = Object.keys(q.query || {});
      if (fields.length > 0) {
        const key = fields.sort().join(',');
        fieldCombinations[key] = (fieldCombinations[key] || 0) + 1;
      }
      
      // 分析排序字段
      if (q.options?.sort) {
        const sortFields = Object.keys(q.options.sort);
        if (sortFields.length > 0) {
          const key = `sort:${sortFields.join(',')}`;
          fieldCombinations[key] = (fieldCombinations[key] || 0) + 1;
        }
      }
    });
  
  // 转换为建议索引列表
  return Object.entries(fieldCombinations)
    .filter(([_, count]) => count >= 3) // 只推荐出现3次以上的组合
    .map(([fields, count]) => {
      if (fields.startsWith('sort:')) {
        return {
          type: 'sort',
          fields: fields.replace('sort:', '').split(','),
          count
        };
      }
      return {
        type: 'query',
        fields: fields.split(','),
        count
      };
    });
}

/**
 * 创建建议的索引
 * @param {String} collectionName - 集合名称
 * @param {Object} indexSpec - 索引规格
 * @returns {Promise<Object>} 创建结果
 */
export async function createIndex(collectionName, indexSpec) {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    
    const result = await collection.createIndex(indexSpec.fields.reduce((acc, field) => {
      acc[field] = 1;
      return acc;
    }, {}), { background: true });
    
    return { success: true, result };
  } catch (error) {
    console.error(`[MongoDB] 创建索引失败:`, error);
    return { success: false, error: error.message };
  }
}

export default {
  recordSlowQuery,
  getSlowQueryStats,
  analyzeIndexes,
  createIndex
}; 