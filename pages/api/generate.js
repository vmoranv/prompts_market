export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  const { prompt, apiKey, provider, model, messages } = req.body;

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
    // let result; // 不再需要存储完整结果，直接流式输出

    // 根据不同的供应商调用不同的API
    if (provider === 'openai') {
      // OpenAI API 也支持流式输出
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages || [{ role: 'user', content: prompt }],
          temperature: 0.7,
          stream: true, // 启用流式输出
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '调用OpenAI API失败');
      }

      // 设置流式响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 处理OpenAI流式响应（格式与智谱AI类似）
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        // 持续读取流
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // 流结束，发送结束事件
            res.write(`data: [DONE]\n\n`);
            res.end();
            break;
          }
          
          // 解码二进制数据为文本
          const text = decoder.decode(value, { stream: true });
          buffer += text;
          
          // 按行分割处理
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一行（可能不完整）
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // 检查是否是数据行
            if (trimmedLine.startsWith('data: ')) {
              const jsonString = trimmedLine.substring(6);
              
              if (jsonString === '[DONE]') {
                res.write(`data: [DONE]\n\n`);
                continue;
              }
              
              try {
                // 解析智谱AI返回的JSON
                const data = JSON.parse(jsonString);
                
                // 提取内容 - 智谱AI格式
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  // 立即发送给前端，确保流式效果
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                  // 强制刷新缓冲区
                  if (res.flush) res.flush();
                }
              } catch (parseError) {
                console.error('解析智谱AI流数据失败:', parseError, '原始数据:', jsonString);
                // 继续处理，不中断流
              }
            }
          }
        }
      } catch (streamError) {
        console.error('流处理错误:', streamError);
        res.write(`data: [DONE]\n\n`);
        res.end();
      }

    } else if (provider === 'zhipu') {
      // 智谱AI API (流式输出)
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
          // 使用完整的消息历史，如果提供了
          messages: messages || [{ role: 'user', content: prompt }],
          temperature: 0.7,
          // 开启流式输出
          stream: true,
          // request_id 参数在 v4 API 中是可选的，可以保留或移除
          request_id: Date.now().toString(),
        }),
      });

      // 检查初始响应是否成功
      if (!response.ok) {
         const errorData = await response.json();
         console.error('智谱AI聊天完成 API 初始响应错误:', errorData);
         throw new Error(errorData.error?.message || `智谱AI API HTTP错误 ${response.status}`);
      }

      // 设置响应头，开启流式输出
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 获取读取器和解码器
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let buffer = ''; // 用于存储未完成的数据
      
      try {
        // 持续读取流
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // 流结束，发送结束事件
            res.write(`data: [DONE]\n\n`);
            res.end();
            break;
          }
          
          // 解码二进制数据为文本
          const text = decoder.decode(value, { stream: true });
          buffer += text;
          
          // 按行分割处理
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一行（可能不完整）
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // 检查是否是数据行
            if (trimmedLine.startsWith('data: ')) {
              const jsonString = trimmedLine.substring(6);
              
              if (jsonString === '[DONE]') {
                res.write(`data: [DONE]\n\n`);
                continue;
              }
              
              try {
                // 解析智谱AI返回的JSON
                const data = JSON.parse(jsonString);
                
                // 提取内容 - 智谱AI格式
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  // 立即发送给前端，确保流式效果
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                  // 强制刷新缓冲区
                  if (res.flush) res.flush();
                }
              } catch (parseError) {
                console.error('解析智谱AI流数据失败:', parseError, '原始数据:', jsonString);
                // 继续处理，不中断流
              }
            }
          }
        }
      } catch (streamError) {
        console.error('流处理错误:', streamError);
        res.write(`data: [DONE]\n\n`);
        res.end();
      }

    } else {
      throw new Error('不支持的AI供应商');
    }

    // 对于流式输出，响应已经在上面的 while 循环中结束，这里不再需要返回
    // return res.status(200).json({ success: true, result });

  } catch (error) {
    console.error('生成失败:', error);
    // 在发生错误时，确保响应被关闭
    if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: `生成失败: ${error.message}`
        });
    } else {
        // 如果头部已发送（流已开始），发送一个错误事件并结束流
        res.write(`event: error\ndata: ${JSON.stringify({ message: `生成失败: ${error.message}` })}\n\n`);
        res.end();
    }
  }
} 