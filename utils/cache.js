// 简单的内存缓存实现
const cache = new Map();
const TTL = 5 * 60 * 1000; // 5分钟缓存

// 针对不同数据类型的缓存时间
const CACHE_CONFIG = {
  prompts: 2 * 60 * 1000,    // 2分钟
  user_prompts: 1 * 60 * 1000, // 1分钟（用户数据更新频繁）
  search: 5 * 60 * 1000      // 5分钟（搜索结果相对稳定）
};

export function setCacheByType(key, value, type = 'default') {
  const ttl = CACHE_CONFIG[type] || TTL;
  setCache(key, value, ttl);
}

export function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
}

export function setCache(key, value, ttl = TTL) {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl
  });
} 