import dbConnect from '../../../lib/dbConnect';
import Prompt from '../../../models/Prompt';
import User from '../../../models/User'; 
import { getToken } from 'next-auth/jwt'; 
import { getSession } from 'next-auth/react'; // 导入 getSession
import { getCached, setCacheByType } from '../../../utils/cache';
import mongoose from 'mongoose';

// 定义与前端一致的字数限制常量
const MAX_TITLE_LENGTH = 50;
const MAX_TAG_LENGTH = 50;
const MAX_CONTENT_LENGTH = 300000;

// Helper function to count Unicode characters (与前端保持一致)
const countUnicodeCharacters = (str) => {
  return Array.from(str).length;
};

export default async function handler(req, res) {
  const { method } = req;
  await dbConnect();

  const { page = 1, limit = 12, search, sort, userId, status = 'published' } = req.query; // 添加 userId 和 status
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  if (method === 'POST' || (method === 'GET' && req.query.userId)) {
    const session = await getSession({ req });
  }

  switch (method) {
    case 'GET':
      try {
        // 修改缓存键生成逻辑，使其更有效
        const cacheKey = `prompts_${page}_${limit}_${sort || '-createdAt'}_${status || 'published'}_${search || ''}_${userId || ''}`;
        
        // 尝试从缓存获取数据
        const cachedData = getCached(cacheKey);
        if (cachedData) {
          console.log(`[MongoDB] 缓存命中: ${cacheKey}`);
          return res.status(200).json(cachedData);
        }

        let query = {};
        
        // 记录查询开始时间
        const queryStartTime = performance.now();

        // 只查询必要的字段状态条件
        if (status && status !== 'all') {
          query.status = status;
        }

        // 用户ID过滤
        if (userId) {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, error: '无效的用户ID' });
          }
          query.author = userId;
        }

        // 搜索条件优化：使用文本索引而不是正则表达式
        if (search) {
          // 使用文本索引而不是多字段正则匹配
          query.$text = { $search: search };
        }

        // 计算要跳过的文档数
        const skip = (pageNumber - 1) * limitNumber;
        
        // 排序选项
        const sortOption = {};
        if (sort) {
          // 处理排序字符串，如 "-createdAt" 转为 { createdAt: -1 }
          const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
          const sortOrder = sort.startsWith('-') ? -1 : 1;
          sortOption[sortField] = sortOrder;
        } else {
          // 默认排序
          sortOption.createdAt = -1;
        }
        
        // 使用更高效的查询方式：计数和查询并行执行
        const [totalPrompts, prompts] = await Promise.all([
          // 使用更高效的countDocuments替代estimatedDocumentCount
          Prompt.countDocuments(query),
          
          // 优化查询：仅选择需要的字段，减少数据传输
          Prompt.find(query)
            .select('title content tag likesCount viewCount author createdAt status')
            .populate('author', 'name image')
            .sort(sortOption)
            .limit(limitNumber)
            .skip(skip)
            .lean() // 使用lean()获取纯JavaScript对象，提高性能
        ]);

        const totalPages = Math.ceil(totalPrompts / limitNumber);
        const hasMore = pageNumber < totalPages;

        const responseData = {
          success: true,
          data: prompts,
          pagination: {
            totalPrompts,
            totalPages,
            currentPage: pageNumber,
            pageSize: limitNumber,
            hasMore,
          },
        };

        // 调整缓存时间
        const getCacheType = (userId, search, status) => {
          if (search) {
            return { type: 'search', ttl: 60 * 1000 }; // 搜索结果缓存1分钟
          }
          if (userId) {
            return { type: 'user_prompts', ttl: 2 * 60 * 1000 }; // 用户内容缓存2分钟
          }
          return { type: 'prompts', ttl: 5 * 60 * 1000 }; // 公共内容缓存5分钟
        };

        // 使用可配置的缓存时间
        const cacheConfig = getCacheType(userId, search, status);
        setCacheByType(cacheKey, responseData, cacheConfig.type, cacheConfig.ttl);

        // 在查询完成后添加性能日志
        const queryEndTime = performance.now();
        const queryTime = (queryEndTime - queryStartTime).toFixed(2);
        console.log(`[MongoDB] 查询完成，耗时: ${queryTime}ms，结果数: ${prompts.length}`);
        
        // 慢查询分析
        if (queryEndTime - queryStartTime > 500) { // 降低慢查询阈值到500ms
          console.warn(`[MongoDB] 检测到慢查询: ${cacheKey}，耗时: ${queryTime}ms`);
          
          // 添加详细的慢查询分析信息
          console.warn(`[MongoDB] 慢查询详情 - 查询条件: ${JSON.stringify(query)}, 排序: ${JSON.stringify(sortOption)}, 跳过: ${skip}, 限制: ${limitNumber}`);
          
          // 在开发环境中建议使用explain()分析查询
          if (process.env.NODE_ENV === 'development') {
            try {
              // 异步分析查询计划但不阻塞响应
              (async () => {
                const explainResult = await Prompt.find(query)
                  .select('_id') // 只选择ID以减少数据量
                  .sort(sortOption)
                  .limit(limitNumber)
                  .skip(skip)
                  .explain('executionStats');
                
                console.warn('[MongoDB] 查询执行计划:', 
                             '执行时间:', explainResult.executionStats.executionTimeMillis + 'ms',
                             '扫描文档数:', explainResult.executionStats.totalDocsExamined,
                             '返回文档数:', explainResult.executionStats.nReturned);
              })();
            } catch (explainError) {
              console.error('[MongoDB] 无法分析查询计划:', explainError);
            }
          }
        }

        res.status(200).json(responseData);
      } catch (error) {
        console.error('[MongoDB] 查询错误:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
      }
      break;
    case 'POST':
      try {
        if (!session) {
          return res.status(401).json({ success: false, error: '需要登录才能创建 Prompt' });
        }

        // 验证 Prompt 内容长度
        if (countUnicodeCharacters(req.body.title) > MAX_TITLE_LENGTH) {
            return res.status(400).json({ success: false, error: `标题不能超过 ${MAX_TITLE_LENGTH} 个字符` });
        }
        if (countUnicodeCharacters(req.body.tag) > MAX_TAG_LENGTH) {
            return res.status(400).json({ success: false, error: `标签不能超过 ${MAX_TAG_LENGTH} 个字符` });
        }
        if (countUnicodeCharacters(req.body.content) > MAX_CONTENT_LENGTH) {
            return res.status(400).json({ success: false, error: `内容不能超过 ${MAX_CONTENT_LENGTH} 个字符` });
        }

        const prompt = await Prompt.create({
          ...req.body,
          author: session.user.id, // 将当前登录用户的 ID 关联到 Prompt
          status: 'pending', // 新创建的 Prompt 默认为待审核状态
          likesCount: 0, // 初始化点赞数为 0
          viewCount: 0, // 初始化浏览量为 0
          likedBy: [], // 初始化点赞用户列表为空
        });
        res.status(201).json({ success: true, data: prompt });
      } catch (error) {
        console.error('Error creating prompt:', error); // 记录详细错误
        res.status(400).json({ success: false, error: error.message || '创建 Prompt 失败' }); // 返回更详细的错误信息
      }
      break;
    default:
      res.status(405).json({ success: false, error: 'Method not allowed' }); // 使用 405 Method Not Allowed
      break;
  }
} 