import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

// 创建一个内存缓存来跟踪用户请求
const userRequestCache = new Map();
// 在文件顶部添加清理机制
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟
const CACHE_EXPIRE_TIME = 60 * 60 * 1000; // 1小时

// 定期清理过期的缓存条目
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of userRequestCache.entries()) {
    // 只清理超过过期时间且不在活跃期的条目
    if (now - timestamp > CACHE_EXPIRE_TIME) {
      userRequestCache.delete(key);
      console.log(`清理过期缓存条目: ${key}`);
    }
  }
  
  // 防止缓存无限增长，如果条目过多也进行清理
  if (userRequestCache.size > 10000) {
    console.warn('缓存条目过多，进行强制清理');
    const entries = Array.from(userRequestCache.entries());
    entries.sort((a, b) => a[1] - b[1]); // 按时间排序
    // 保留最新的5000个条目
    for (let i = 0; i < entries.length - 5000; i++) {
      userRequestCache.delete(entries[i][0]);
    }
  }
}, CACHE_CLEANUP_INTERVAL);



export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '方法不允许' });
  }

  // 获取用户会话
  const session = await getServerSession(req, res, authOptions);
  
  // 检查用户是否已登录
  if (!session || !session.user) {
    return res.status(401).json({
      success: false,
      error: '请先登录后再使用此功能'
    });
  }

  // 获取用户标识符和IP地址
  const userId = session.user.email || session.user.id;
  const userIP = req.headers['x-forwarded-for'] || 
                req.headers['x-real-ip'] || 
                req.connection.remoteAddress || 
                req.socket.remoteAddress ||
                (req.connection.socket ? req.connection.socket.remoteAddress : null);
  
  // 创建复合标识符（用户ID + IP）
  const userIdentifier = `${userId}_${userIP}`;
  
  // 获取请求中的参数
  const { messages, provider, model, apiKey, useDefaultKey } = req.body;
  
  // 增强的速率限制检查
  if (useDefaultKey) {
    const now = Date.now();
    const lastRequest = userRequestCache.get(userIdentifier) || 0;
    const timeElapsed = (now - lastRequest) / 1000;
    
    // 对于默认密钥用户，限制更严格（60秒一次）
    if (timeElapsed < 60) {
      return res.status(429).json({
        success: false,
        error: `请求过于频繁，请在 ${Math.ceil(60 - timeElapsed)} 秒后再试`,
        remainingTime: Math.ceil(60 - timeElapsed)
      });
    }
    
    // 更新最后请求时间
    userRequestCache.set(userIdentifier, now);
    
    // 可选：添加日志记录用于监控
    console.log(`用户 ${userId} (IP: ${userIP}) 使用默认密钥发起请求`);
  } else {
    // 即使使用自定义密钥，也要有基本的速率限制防止滥用
    const now = Date.now();
    const lastRequest = userRequestCache.get(userIdentifier) || 0;
    const timeElapsed = (now - lastRequest) / 1000;
    
    // 自定义密钥用户限制较宽松（10秒一次）
    if (timeElapsed < 10) {
      return res.status(429).json({
        success: false,
        error: `请求过于频繁，请在 ${Math.ceil(10 - timeElapsed)} 秒后再试`,
        remainingTime: Math.ceil(10 - timeElapsed)
      });
    }
    
    userRequestCache.set(userIdentifier, now);
  }
  
  // 决定使用哪个API密钥
  let effectiveApiKey;
  if (useDefaultKey) {
    // 使用环境变量中的默认密钥
    if (provider === 'openai') {
      effectiveApiKey = process.env.OPENAI_DEFAULT_API_KEY;
    } else if (provider === 'zhipu') {
      effectiveApiKey = process.env.ZHIPU_DEFAULT_API_KEY;
    } else if (provider === 'gemini') {
      effectiveApiKey = process.env.GOOGLE_DEFAULT_API_KEY;
    }

    if (!effectiveApiKey) {
      return res.status(500).json({
        success: false,
        error: `未配置 ${provider} 的默认API密钥`,
      });
    }
  } else {
    // 使用用户提供的密钥
    effectiveApiKey = apiKey;
    
    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error: 'API密钥不能为空',
      });
    }
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
          'Authorization': `Bearer ${effectiveApiKey}`
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
          'Authorization': effectiveApiKey
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

      } else if (provider === 'gemini') {
            // 使用Gemini API进行流式输出
            const apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta';
            const modelName = model || 'gemini-2.0-flash';
            
            // 构建请求体，转换消息格式为Gemini格式
            const geminiMessages = messages.map(msg => {
              // Gemini使用"user"和"model"角色，而不是"user"和"assistant"
              const role = msg.role === 'assistant' ? 'model' : 
                          msg.role === 'system' ? 'user' : msg.role;
              return {
                role,
                parts: [{ text: msg.content }]
              };
            });
            
            // 处理system消息：如果第一条是system消息，将其合并到第二条中(如果存在)
            if (geminiMessages.length > 1 && messages[0].role === 'system') {
              const systemContent = geminiMessages.shift().parts[0].text;
              // 添加到第一条消息的前面（现在第一条是之前的第二条）
              if (geminiMessages[0]) {
                geminiMessages[0].parts[0].text = `${systemContent}\n\n${geminiMessages[0].parts[0].text}`;
              } else {
                // 如果只有一条系统消息，将其转为用户消息
                geminiMessages.push({
                  role: 'user',
                  parts: [{ text: systemContent }]
                });
              }
            }
            
            // 构建Gemini API请求URL
            const geminiUrl = `${apiEndpoint}/models/${modelName}:streamGenerateContent?key=${effectiveApiKey}`;
            
            response = await fetch(geminiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: geminiMessages,
                generationConfig: {
                  temperature: 0.7,
                }
              }),
            });

            if (!response.ok) {
              let errorText = await response.text();
              try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error?.message || `Gemini API错误 ${response.status}`);
              } catch (parseError) {
                throw new Error(`Gemini API响应错误: ${errorText || response.status}`);
              }
            }

            // 设置流式响应头
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // 处理Gemini流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = ''; // 用于存储未完成的JSON数据

            try {
              // 持续读取流
              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  // 处理缓冲区中剩余的数据
                  if (buffer.trim()) {
                    console.log('Gemini最终缓冲区内容:', buffer);
                    try {
                      const data = JSON.parse(buffer.trim());
                      if (data.candidates && data.candidates[0]?.content?.parts) {
                        const content = data.candidates[0].content.parts[0]?.text || '';
                        if (content) {
                          res.write(`data: ${JSON.stringify({ content })}\n\n`);
                          if (res.flush) res.flush();
                        }
                      }
                    } catch (finalParseError) {
                      console.error('解析最终Gemini数据失败:', finalParseError, '数据:', buffer);
                    }
                  }
                  // 流结束，发送结束事件
                  res.write(`data: [DONE]\n\n`);
                  res.end();
                  break;
                }
                
                // 解码二进制数据为文本
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                console.log('Gemini收到chunk:', chunk);
                console.log('当前buffer:', buffer);
                
                // 尝试解析缓冲区中的完整JSON对象
                let jsonStart = 0;
                while (jsonStart < buffer.length) {
                  // 寻找JSON对象的开始
                  const openBrace = buffer.indexOf('{', jsonStart);
                  if (openBrace === -1) break;
                  
                  // 寻找匹配的结束括号
                  let braceCount = 0;
                  let jsonEnd = -1;
                  
                  for (let i = openBrace; i < buffer.length; i++) {
                    if (buffer[i] === '{') {
                      braceCount++;
                    } else if (buffer[i] === '}') {
                      braceCount--;
                      if (braceCount === 0) {
                        jsonEnd = i + 1;
                        break;
                      }
                    }
                  }
                  
                  // 如果找到完整的JSON对象
                  if (jsonEnd > openBrace) {
                    const jsonStr = buffer.substring(openBrace, jsonEnd);
                    console.log('尝试解析JSON:', jsonStr);
                    
                    try {
                      const data = JSON.parse(jsonStr);
                      
                      // 提取内容 - Gemini格式
                      if (data.candidates && data.candidates[0]?.content?.parts) {
                        const content = data.candidates[0].content.parts[0]?.text || '';
                        if (content) {
                          console.log('Gemini提取到内容:', content);
                          // 转换为与其他AI提供商相同的格式发送给前端
                          res.write(`data: ${JSON.stringify({ content })}\n\n`);
                          // 强制刷新缓冲区
                          if (res.flush) res.flush();
                        }
                      }
                      
                      // 更新jsonStart位置
                      jsonStart = jsonEnd;
                    } catch (parseError) {
                      console.error('解析Gemini JSON失败:', parseError, '数据:', jsonStr);
                      // 如果解析失败，继续寻找下一个可能的JSON对象
                      jsonStart = openBrace + 1;
                    }
                  } else {
                    // 没有找到完整的JSON对象，等待更多数据
                    break;
                  }
                }
                
                // 保留未处理的数据
                if (jsonStart > 0) {
                  buffer = buffer.substring(jsonStart);
                }
              }
            } catch (streamError) {
              console.error('Gemini流处理错误:', streamError);
              res.write(`data: [DONE]\n\n`);
              res.end();
            }

    } else {
      return res.status(400).json({ success: false, error: '不支持的AI供应商' });
    }

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