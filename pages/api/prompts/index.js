import dbConnect from '../../../lib/dbConnect';
import Prompt from '../../../models/Prompt';
import User from '../../../models/User'; 
import { getToken } from 'next-auth/jwt'; 
import { getSession } from 'next-auth/react'; // 导入 getSession
import { getCached, setCacheByType } from '../../../utils/cache';

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

  switch (method) {
    case 'GET':
      try {
        // 构建缓存键
        const cacheKey = `prompts_${JSON.stringify({
          page,
          limit,
          search,
          sort,
          userId,
          status
        })}`;
        
        // 尝试从缓存获取数据
        const cachedData = getCached(cacheKey);
        if (cachedData) {
          return res.status(200).json(cachedData);
        }

        let query = {};

        // 构建查询条件
        if (userId && status === 'all') {
          // 分别查询已发布的和用户自己的未发布内容，然后合并
          const publishedQuery = { status: 'published' };
          const userQuery = { author: userId, status: { $in: ['pending', 'rejected'] } };
          
          if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            const searchCondition = {
              $or: [
                { title: searchRegex },
                { content: searchRegex },
                { tags: searchRegex },
              ]
            };
            publishedQuery.$and = [publishedQuery, searchCondition];
            userQuery.$and = [userQuery, searchCondition];
          }
          
          query = { $or: [publishedQuery, userQuery] };
        } else {
          // 简化其他查询条件
          if (userId) {
            query.author = userId;
            query.status = status;
          } else {
            query.status = status;
          }
          
          if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            query.$or = [
              { title: searchRegex },
              { content: searchRegex },
              { tags: searchRegex },
            ];
          }
        }

        // 添加搜索过滤
        if (search) {
          const searchRegex = { $regex: search, $options: 'i' };
          // 将搜索条件应用到 $or 子句中，或者直接应用到 query 中
          if (query.$or) {
             // 如果已经有 $or 条件（用户登录且 status=all），则将搜索条件添加到每个子句中
             query.$or = query.$or.map(orClause => ({
                 ...orClause,
                 $or: [
                     { title: searchRegex },
                     { content: searchRegex },
                     { tags: searchRegex },
                 ]
             }));
          } else {
             // 如果没有 $or 条件，直接将搜索条件添加到 query 中
             query.$or = [
                 { title: searchRegex },
                 { content: searchRegex },
                 { tags: searchRegex },
             ];
          }
        }

        // 添加排序
        let sortOption = { createdAt: -1 }; // 默认按创建时间降序
        if (sort) {
          const sortField = sort.startsWith('-') ?
            sort.substring(1) : sort;
          const sortOrder = sort.startsWith('-') ? -1 : 1;
          // 确保排序字段是 Prompt 模型中存在的字段
          if (['createdAt', 'likesCount', 'viewCount'].includes(sortField)) {
            sortOption = { [sortField]: sortOrder };
          }
        }

        const totalPrompts = await Prompt.countDocuments(query);
        const prompts = await Prompt.find(query)
          .select('title content tags likesCount viewCount author createdAt')
          .populate('author', 'name image')
          .sort(sortOption)
          .limit(limitNumber)
          .skip((pageNumber - 1) * limitNumber)
          .lean();

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

        // 缓存类型判断函数
        const getCacheType = (userId, search, status) => {
          if (search) {
            return 'search';
          }
          if (userId) {
            return 'user_prompts';
          }
          return 'prompts';
        };

        // 缓存设置函数
        const cacheType = getCacheType(userId, search, status);
        setCacheByType(cacheKey, responseData, cacheType);

        // 日志输出
        if (process.env.NODE_ENV === 'development') {
          console.log(`缓存已更新: ${cacheKey.substring(0, 50)}..., 类型: ${cacheType}`);
        }

        res.status(200).json(responseData);
      } catch (error) {
        console.error('Error fetching prompts:', error);
        res.status(500).json({ success: false, error: error.message || '服务器错误' });
      }
      break;
    case 'POST':
      try {
        const session = await getSession({ req });
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