const TTL = 5 * 60 * 1000; // 默认缓存时间为5分钟

// 简单的LRU缓存实现
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // 重新插入以更新访问顺序
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最老的项
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

const cache = new LRUCache(200); // 限制最多200个缓存项

// 缓存统计
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0
};

// 针对不同数据类型的缓存时间和优先级
const CACHE_CONFIG = {
  prompts: { 
    ttl: 3 * 60 * 1000,    // 3分钟
    priority: 'high',
    maxAge: 10 * 60 * 1000  // 最大存活时间10分钟
  },
  user_prompts: { 
    ttl: 1 * 60 * 1000,    // 1分钟
    priority: 'medium',
    maxAge: 5 * 60 * 1000
  },
  search: { 
    ttl: 5 * 60 * 1000,    // 5分钟
    priority: 'low',
    maxAge: 15 * 60 * 1000
  },
  metadata: {
    ttl: 10 * 60 * 1000,   // 10分钟（标签、分类等元数据）
    priority: 'high',
    maxAge: 30 * 60 * 1000
  }
};

export function getCached(key) {
  const item = cache.get(key);
  if (!item) {
    cacheStats.misses++;
    return null;
  }
  
  const now = Date.now();
  
  // 检查是否过期
  if (now > item.expiry) {
    cache.delete(key);
    cacheStats.misses++;
    return null;
  }
  
  // 检查最大存活时间
  if (item.maxExpiry && now > item.maxExpiry) {
    cache.delete(key);
    cacheStats.evictions++;
    return null;
  }
  
  cacheStats.hits++;
  return item.value;
}

export function setCache(key, value, ttl, type = 'default') {
  const config = CACHE_CONFIG[type] || { ttl: TTL, maxAge: TTL * 2 };
  const finalTtl = ttl || config.ttl;
  
  cache.set(key, {
    value,
    expiry: Date.now() + finalTtl,
    maxExpiry: Date.now() + (config.maxAge || finalTtl * 2),
    type,
    priority: config.priority || 'medium',
    createdAt: Date.now()
  });
  
  cacheStats.sets++;
}

export function setCacheByType(key, value, type = 'default') {
  const config = CACHE_CONFIG[type] || { ttl: TTL };
  setCache(key, value, config.ttl, type);
}

// 主动清理过期缓存
export function cleanupExpiredCache() {
  const now = Date.now();
  let cleanedCount = 0;
  
  // 由于LRU缓存使用迭代器，需要收集要删除的键
  const keysToDelete = [];
  
  for (const [key, item] of cache.cache.entries()) {
    if (now > item.expiry || (item.maxExpiry && now > item.maxExpiry)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => {
    cache.delete(key);
    cleanedCount++;
  });
  
  cacheStats.evictions += cleanedCount;
  return cleanedCount;
}

// 获取缓存统计信息
export function getCacheStats() {
  const hitRate = cacheStats.hits + cacheStats.misses > 0 
    ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2)
    : 0;
    
  return {
    ...cacheStats,
    hitRate: `${hitRate}%`,
    size: cache.size(),
    maxSize: cache.maxSize
  };
}

// 清空特定类型的缓存
export function clearCacheByType(type) {
  const keysToDelete = [];
  
  for (const [key, item] of cache.cache.entries()) {
    if (item.type === type) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => cache.delete(key));
  return keysToDelete.length;
}

// 预热缓存（可在应用启动时调用）
export function warmupCache(warmupData) {
  if (Array.isArray(warmupData)) {
    warmupData.forEach(({ key, value, type }) => {
      setCacheByType(key, value, type);
    });
  }
}

// 定期清理任务（建议在应用启动时启动）
let cleanupInterval = null;

export function startCacheCleanup(intervalMs = 2 * 60 * 1000) { // 每2分钟清理一次
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  cleanupInterval = setInterval(() => {
    const cleaned = cleanupExpiredCache();
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache entries`);
    }
  }, intervalMs);
}

export function stopCacheCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
