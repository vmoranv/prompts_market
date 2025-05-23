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

  const { page = 1, limit = 12, search, sort, userId } = req.query; // 添加 userId
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  switch (method) {
    case 'GET':
      try {
        let query = {};

        // 添加 userId 过滤
        if (userId) {
          query.author = userId;
        }

        // 添加搜索过滤
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } },
            { tags: { $regex: search, $options: 'i' } },
          ];
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
          .sort(sortOption) // 应用排序
          .limit(limitNumber)
          .skip((pageNumber - 1) * limitNumber)
          .populate('author', 'name image'); // 关联作者信息

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
        res.status(400).json({ success: false, error: error.message });
      }
      break;
    case 'POST':
      try {
        const session = await getSession({ req });
        if (!session) {
          return res.status(401).json({ success: false, error: '需要登录才能创建 Prompt' });
        }

        const prompt = await Prompt.create({
          ...req.body,
          author: session.user.id, // 将当前登录用户的 ID 关联到 Prompt
        });
        res.status(201).json({ success: true, data: prompt });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;
    default:
      res.status(400).json({ success: false, error: 'Method not allowed' });
      break;
  }
} 