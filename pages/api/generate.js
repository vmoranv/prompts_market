export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  const { prompt, apiKey, provider, model } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: '提示内容不能为空' });
  }

  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'API密钥不能为空' });
  }

  if (!provider) {
    return res.status(400).json({ success: false, error: '请选择AI供应商' });
  }

  if (!model) {
    return res.status(400).json({ success: false, error: '请选择AI模型' });
  }

  try {
    let response;
    let result;

    // 根据不同的供应商调用不同的API
    if (provider === 'openai') {
      // OpenAI API
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || '调用OpenAI API失败');
      }
      
      result = data.choices[0]?.message?.content || '';
      
    } else if (provider === 'zhipu') {
      // 智谱AI API
      // 根据智谱AI v4 文档调整 API 端点和请求体格式
      response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 根据智谱AI文档示例，API密钥直接放在Authorization头
          'Authorization': apiKey
        },
        body: JSON.stringify({
          model: model,
          // v4 API 使用 messages 数组，格式类似 OpenAI
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          // request_id 参数在 v4 API 中是可选的，可以保留或移除
          request_id: Date.now().toString(),
        }),
      });

      const data = await response.json();

      // 检查HTTP状态码和响应体中的code字段或error对象
      // 智谱AI在业务错误时可能返回 HTTP 200 但 code 非 200 或包含 error 对象
      // 如果 response.ok 为 true 但 data.code 不存在或非 200，或者存在 data.error，记录完整的响应体以便调试
      if (!response.ok || (data && data.code !== 200) || data?.error) {
        console.error('智谱AI聊天完成 API 返回非预期响应体或业务错误:', data); // 打印完整的响应体
        // 优先使用 data.error 中的信息，否则使用 data.code/message
        const errorCode = data?.error?.code || data?.code;
        const errorMessage = data?.error?.message || data?.message || '未知错误';
        throw new Error(`智谱AI API错误 - Code: ${errorCode}, Message: ${errorMessage}`);
      }

      // 根据智谱AI v4 文档，结果在 choices[0].message.content 中
      result = data.choices[0]?.message?.content || '';

    } else {
      throw new Error('不支持的AI供应商');
    }

    return res.status(200).json({ success: true, result });
    
  } catch (error) {
    console.error('生成失败:', error);
    return res.status(500).json({ 
      success: false, 
      error: `生成失败: ${error.message}` 
    });
  }
} 