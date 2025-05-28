export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  const { provider, apiKey } = req.body;

  if (!provider) {
    return res.status(400).json({ success: false, error: '供应商不能为空' });
  }

  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'API密钥不能为空' });
  }

  try {
    let models = [];

    if (provider === 'openai') {
      // 获取OpenAI模型列表
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '获取OpenAI模型失败');
      }

      const data = await response.json();
      
      // 筛选聊天模型（GPT模型）
      const chatModels = data.data
        .filter(model => 
          model.id.includes('gpt') && 
          !model.id.includes('instruct') && 
          !model.id.includes('vision')
        )
        .sort((a, b) => {
          // 按版本从新到旧排序
          if (a.id.includes('gpt-4') && !b.id.includes('gpt-4')) return -1;
          if (!a.id.includes('gpt-4') && b.id.includes('gpt-4')) return 1;
          return b.created - a.created;
        })
        .map(model => ({
          value: model.id,
          label: model.id
        }));
        
      models = chatModels;
      
    } else if (provider === 'zhipu') {
      // 直接返回硬编码的智谱AI模型列表
      models = [
        { value: 'glm-4-flash-250414', label: 'GLM-4-Flash (250414)' }
      ];
      // 不再调用智谱AI的 /v4/models 接口
      // 也不再需要处理API返回的错误或数据格式
    }

    return res.status(200).json({ 
      success: true, 
      models: models.length > 0 ? models : [{ value: 'default', label: '默认模型' }]
    });
    
  } catch (error) {
    console.error('获取模型失败:', error);
    return res.status(500).json({ 
      success: false, 
      error: `获取模型失败: ${error.message}` 
    });
  }
} 