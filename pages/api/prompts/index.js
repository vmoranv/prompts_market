import dbConnect from '../../../lib/dbConnect';
import Prompt from '../../../models/Prompt';
import User from '../../../models/User'; 
import { getToken } from 'next-auth/jwt'; 
import { getSession } from 'next-auth/react'; // 导入 getSession

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
        let query = {};

        // 构建查询条件
        if (userId && status === 'all') {
          // 如果用户已登录且请求状态为 'all'，则查询所有已发布的 Prompt
          // 以及该用户自己的待审核和已拒绝的 Prompt
          query.$or = [
            { status: 'published' },
            { author: userId, status: { $in: ['pending', 'rejected'] } }
          ];
        } else if (userId) {
          // 如果指定了 userId 但不是 'all' 状态，则只查询该用户的指定状态 Prompt
          query.author = userId;
          query.status = status;
        } else {
          // 如果没有指定 userId，则根据 status 参数查询（默认为 'published'）
          query.status = status;
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
          // 示例: sort=viewCount 或 sort=-viewCount
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
          .populate('author', 'name image _id')
          .sort(sortOption) // 应用排序
          .limit(limitNumber)
          .skip((pageNumber - 1) * limitNumber);

        const totalPages = Math.ceil(totalPrompts / limitNumber);
        const hasMore = pageNumber < totalPages;

        res.status(200).json({
          success: true,
          data: prompts,
          pagination: {
            totalPrompts,
            totalPages,
            currentPage: pageNumber,
            pageSize: limitNumber,
            hasMore,
          },
        });
      } catch (error) {
        console.error('Error fetching prompts:', error); // 记录详细错误
        res.status(500).json({ success: false, error: error.message || '服务器错误' }); // 返回更详细的错误信息
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