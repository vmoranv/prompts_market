import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import styles from '../../styles/TryPrompt.module.css';
import { MdArrowBack, MdPlayArrow, MdContentCopy, MdCheck, MdSettings, MdRefresh, MdSend, MdClose, MdChat } from 'react-icons/md';

export default function TryPrompt() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  // 状态管理
  const [prompt, setPrompt] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('');
  const [modelOptions, setModelOptions] = useState([]);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState('');
  const [messages, setMessages] = useState([]);
  const [isPromptCollapsed, setIsPromptCollapsed] = useState(true); // 默认折叠
  
  // Ref 用于自动滚动和输入框高度调整
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  
  // 添加一个状态来跟踪用户是否在聊天窗口底部
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesContainerRef = useRef(null);
  
  // 供应商选项
  const providerOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'zhipu', label: '智谱AI' },
  ];

  // 初始化本地存储的设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('aiSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setApiKey(parsed.apiKey || '');
          setProvider(parsed.provider || 'openai');
          
          // 如果有已保存的供应商和API密钥，尝试加载模型
          if (parsed.apiKey && parsed.provider) {
            fetchModels(parsed.provider, parsed.apiKey);
          }
          
          // 如果有已保存的模型且该模型在可用列表中，设置模型
          if (parsed.model) {
            setModel(parsed.model);
          }
        } catch (e) {
          console.error('解析保存的设置时出错:', e);
        }
      }
    }
  }, []);
  
  // 获取Prompt详情
  useEffect(() => {
    if (!id) return;
    
    const fetchPrompt = async () => {
      try {
        setIsLoadingPrompt(true);
        const response = await fetch(`/api/prompts/${id}`);
        
        if (!response.ok) {
          throw new Error('获取提示信息失败');
        }
        
        const data = await response.json();
        setPrompt(data.data);
        
        // 增加查看次数
        fetch(`/api/prompts/${id}/view`, { method: 'POST' }).catch(err => {
          console.error('更新查看次数失败:', err);
        });
        
      } catch (err) {
        console.error('加载提示错误:', err);
        setError('无法加载提示信息');
      } finally {
        setIsLoadingPrompt(false);
      }
    };
    
    fetchPrompt();
  }, [id]);
  
  // 获取可用模型
  const fetchModels = async (currentProvider, currentApiKey) => {
    if (!currentProvider || !currentApiKey) {
      setModelOptions([]);
      setModel(''); // 清空当前选中的模型
      return;
    }

    setIsModelLoading(true);
    setError(null); // 清除之前的错误信息

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: currentProvider, apiKey: currentApiKey }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '获取模型列表失败');
      }

      setModelOptions(data.models);

      // 如果成功获取到模型列表，并且是智谱AI，设置默认模型为 glm-4-flash-250414
      if (currentProvider === 'zhipu' && data.models.length > 0) {
          // 查找硬编码的 glm-4-flash-250414 模型并设置为默认
          const defaultZhipuModel = data.models.find(m => m.value === 'glm-4-flash-250414');
          if (defaultZhipuModel) {
              setModel(defaultZhipuModel.value);
          } else {
              // 如果硬编码的模型不在列表中（不应该发生），则默认选中第一个
              setModel(data.models[0].value);
          }
      } else if (data.models.length > 0) {
          // 对于其他供应商，默认选中第一个模型
          setModel(data.models[0].value);
      } else {
          setModel(''); // 没有可用模型
      }

    } catch (err) {
      console.error('获取模型列表失败:', err);
      setError(`获取模型列表失败: ${err.message}`);
      setModelOptions([]);
      setModel(''); // 清空当前选中的模型
    } finally {
      setIsModelLoading(false);
    }
  };
  
  // Effect 钩子：在 provider 或 apiKey 变化时获取模型列表
  useEffect(() => {
    fetchModels(provider, apiKey);
  }, [provider, apiKey]);

  // Effect 钩子：在 prompt 加载完成后，如果 apiKey 和 provider 已设置，再次尝试获取模型列表
  // 这解决了在 prompt 加载之前 apiKey 和 provider 可能为空的问题
  useEffect(() => {
      if (prompt && apiKey && provider) {
          fetchModels(provider, apiKey);
      }
  }, [prompt, apiKey, provider]); // 依赖项包括 prompt, apiKey, provider

  // 监听滚动事件
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      // 计算是否滚动到底部附近
      const isBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 10; 
      setIsAtBottom(isBottom);
    };
    
    // 初始加载时检查是否在底部
    handleScroll(); 
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []); // 依赖项为空数组，只在组件挂载和卸载时运行

  // 改进的自动滚动逻辑：确保DOM更新后再检测和滚动
  useEffect(() => {
    if (messages.length === 0) return;
    
    // 使用 setTimeout 确保 DOM 更新完成
    setTimeout(() => {
      // 获取当前最后一条消息
      const lastMessage = messages[messages.length - 1];
      
      // 判断是否为新消息（用户消息或新的AI消息）
      const isNewMessage = lastMessage.role === 'user' || 
        (lastMessage.role === 'assistant' && !lastMessage.content);
      
      // 实时检查用户是否在底部
      const container = messagesContainerRef.current;
      const isCurrentlyAtBottom = container ? 
        container.scrollHeight - container.scrollTop - container.clientHeight < 10 : true;
      
      // 简化的滚动条件：
      // 1. 是新消息（总是滚动）
      // 2. 用户在底部（跟随滚动）
      if (isNewMessage || isCurrentlyAtBottom) {
        const scrollBehavior = isCurrentlyAtBottom ? 'auto' : 'smooth';
        messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior });
      }
    }, 0); // 使用 0 延迟确保在下一个事件循环中执行
  }, [messages]);

  // Effect 钩子：根据输入内容调整 textarea 高度
  useEffect(() => {
    const textarea = messageInputRef.current;
    if (textarea) {
      // 重置高度，让 scrollHeight 计算正确的高度
      textarea.style.height = 'auto';
      // 设置新的高度，scrollHeight 包含内容和内边距
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [userInput]); // 依赖项是 userInput，当输入内容变化时触发

  // 处理消息发送
  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating) return;

    // 添加用户消息到对话历史
    const newUserMessage = { role: 'user', content: userInput };
    // 准备发送到API的完整消息历史（包括提示词作为系统消息）
    const fullMessages = prompt ?
      [{ role: 'system', content: prompt.content }, ...messages, newUserMessage] :
      [...messages, newUserMessage];

    // 先清空输入框并设置生成状态
    setUserInput('');
    setIsGenerating(true);
    setError(null);

    // 添加一个空的AI消息作为占位符，用于接收流式内容
    setMessages(prev => [...prev, newUserMessage, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // 发送完整的消息历史
          messages: fullMessages,
          apiKey,
          provider,
          model,
          // 这里的 prompt 字段其实可以移除，因为 messages 包含了所有历史
          // 但为了兼容之前的逻辑，暂时保留，后端会优先使用 messages
          prompt: userInput // 发送当前用户输入作为 prompt，尽管 messages 更完整
        }),
      });

      // 检查初始响应是否成功
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成请求失败');
      }

      // 检查响应是否为事件流
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              setIsGenerating(false);
              break;
            }

            // 解码新的数据块
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // 按行分割数据
            const lines = buffer.split('\n');
            // 保留最后一行，可能是不完整的
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              // 处理 SSE 格式的数据行
              if (trimmedLine.startsWith('data: ')) {
                const dataContent = trimmedLine.substring(6);
                
                if (dataContent === '[DONE]') {
                  setIsGenerating(false);
                  return;
                }

                try {
                  // 解析后端发送的数据
                  const data = JSON.parse(dataContent);
                  const content = data.content;
                  
                  if (content) {
                    // 立即更新UI，实现真正的流式效果
                    setMessages(prevMessages => {
                      const lastMessageIndex = prevMessages.length - 1;
                      if (lastMessageIndex >= 0 && prevMessages[lastMessageIndex].role === 'assistant') {
                        const updatedMessages = [...prevMessages];
                        updatedMessages[lastMessageIndex] = {
                          ...updatedMessages[lastMessageIndex],
                          content: (updatedMessages[lastMessageIndex].content || '') + content,
                        };
                        return updatedMessages;
                      }
                      return prevMessages;
                    });
                    
                    // 添加微小延迟，让用户能看到打字效果
                    await new Promise(resolve => setTimeout(resolve, 20));
                  }
                } catch (parseError) {
                  console.error('解析流数据失败:', parseError, '原始数据:', dataContent);
                  // 继续处理下一行，不中断整个流程
                }
              }
            }
          }
        } catch (streamError) {
          console.error('流处理错误:', streamError);
          setError(`流处理失败: ${streamError.message}`);
          setIsGenerating(false);
        }
      } else {
        // 处理非流式响应 (OpenAI 或其他)
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || '生成失败');
        }
        // 对于非流式响应，直接更新最后一个AI消息的内容
        setMessages(prevMessages => {
           const lastMessageIndex = prevMessages.length - 1;
           if (lastMessageIndex >= 0 && prevMessages[lastMessageIndex].role === 'assistant') {
             const updatedMessages = [...prevMessages];
             updatedMessages[lastMessageIndex] = {
               ...updatedMessages[lastMessageIndex],
               content: data.result,
             };
             return updatedMessages;
           }
           return prevMessages; // 如果最后一个不是AI消息，则不更新
        });
        setIsGenerating(false);
      }

    } catch (err) {
      console.error('生成过程中发生错误:', err);
      setError(`生成失败: ${err.message}`);
      setIsGenerating(false);
      // 如果发生错误，移除最后一个空的AI消息占位符
      setMessages(prevMessages => prevMessages.slice(0, -1));
    }
  };
  
  // 保存设置
  const saveSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aiSettings', JSON.stringify({
        apiKey,
        provider,
        model
      }));
    }
    setShowSettings(false);
  };
  
  // 加载状态
  if (isLoadingPrompt) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>加载中...</p>
      </div>
    );
  }
  
  // 错误状态
  if (error && !prompt) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/dashboard" className={styles.backLink}>
            <MdArrowBack /> 返回
          </Link>
        </div>
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>{error}</p>
          <button 
            className={styles.primaryButton}
            onClick={() => router.reload()}>
            重试
          </button>
        </div>
      </div>
    );
  }
  
  // 确保prompt已加载
  if (!prompt) {
    return null;
  }
  
  return (
    <>
      <Head>
        <title>试用 - {prompt.title}</title>
        <meta name="description" content={`试用 ${prompt.title} 提示词`} />
      </Head>
      
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href={`/prompt/${id}`} className={styles.backButton}>
            <MdArrowBack size={24} />
            <span>返回详情</span>
          </Link>
          <button 
            className={styles.settingsButton} 
            onClick={() => setShowSettings(!showSettings)}
            title="API设置"
          >
            <MdSettings size={24} />
          </button>
        </div>
        
        {/* 折叠式API设置面板 */}
        <div className={`${styles.settingsPanel} ${showSettings ? styles.settingsVisible : ''}`}>
          <div className={styles.settingsHeader}>
            <h3>API设置</h3>
            <button onClick={() => setShowSettings(false)} className={styles.closeButton}>
              <MdClose size={20} />
            </button>
          </div>
          
          {/* API设置表单 */}
          <div className={styles.settingsForm}>
            <div className={styles.formGroup}>
              <label htmlFor="provider">AI供应商</label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel(''); // 切换供应商时重置模型
                  if (e.target.value && apiKey) {
                    fetchModels(e.target.value, apiKey);
                  }
                }}
              >
                <option value="">选择供应商</option>
                <option value="openai">OpenAI</option>
                <option value="zhipu">智谱AI</option>
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="apiKey">API密钥</label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入您的API密钥"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="model">AI模型</label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isModelLoading || modelOptions.length === 0}
              >
                {isModelLoading ? (
                  <option value="">加载模型中...</option>
                ) : modelOptions.length > 0 ? (
                  modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                ) : (
                  <option value="">请先选择供应商并输入API密钥</option>
                )}
              </select>
            </div>
            
            <button
              className={styles.saveButton}
              onClick={saveSettings}
            >
              保存设置
            </button>
          </div>
        </div>
        
        {/* 对话主界面 */}
        <div className={styles.chatContainer}>
          {/* 系统提示词展示 - 可折叠 */}
          {prompt && (
            <div className={styles.systemPrompt}>
              <div 
                className={styles.systemPromptHeader} 
                onClick={() => setIsPromptCollapsed(!isPromptCollapsed)}
              >
                <h3>系统提示词</h3>
                <span className={styles.collapseIcon}>
                  {isPromptCollapsed ? '+' : '-'}
                </span>
              </div>
              {!isPromptCollapsed && (
                <div className={styles.systemPromptContent}>
                  {prompt.content}
                </div>
              )}
            </div>
          )}
          
          {/* 消息列表 */}
          <div 
            className={styles.messagesContainer} 
            ref={messagesContainerRef}
          >
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <MdChat size={48} />
                <p>开始你的对话吧！</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}
                >
                  <div className={styles.messageHeader}>
                    <span className={styles.roleBadge}>
                      {msg.role === 'user' ? '你' : 'AI'}
                    </span>
                  </div>
                  <div className={`${styles.messageContent} ${isGenerating && index === messages.length - 1 ? styles.typing : ''}`}>
                    {msg.content || (isGenerating && index === messages.length - 1 && (
                      <span className={styles.typingIndicator}>思考中...</span>
                    ))}
                  </div>
                  {msg.role === 'assistant' && msg.content && (
                    <button 
                      className={styles.copyButton} 
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      title="复制内容"
                    >
                      {copied ? <MdCheck size={18} /> : <MdContentCopy size={18} />}
                    </button>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* 错误提示 */}
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
          
          {/* 输入区域 */}
          <div className={styles.inputContainer}>
            <textarea
              ref={messageInputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="输入你的消息..."
              disabled={isGenerating}
              className={styles.messageInput}
              rows={1}
            />
            <button
              className={styles.sendButton}
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isGenerating}
            >
              <MdSend size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 