import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import styles from '../../styles/TryPrompt.module.css';
import { MdArrowBack, MdPlayArrow, MdContentCopy, MdCheck, MdSettings, MdRefresh, MdSend, MdClose, MdChat } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';


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
  const [provider, setProvider] = useState('zhipu');
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
  
  // 添加状态来跟踪上次发送消息的时间
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [useDefaultKey, setUseDefaultKey] = useState(true);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // 供应商选项
  const providerOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'zhipu', label: '智谱AI' },
  ];

  // 在组件开始处添加登录检查
  useEffect(() => {
    if (status === 'loading') return; // 还在加载中
    
    if (status === 'unauthenticated') {
      // 未登录，重定向到登录页面
      router.push('/auth/signin?callbackUrl=' + encodeURIComponent(router.asPath));
      return;
    }
  }, [status, router]);

  // 如果未登录或正在加载，显示加载状态
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>
          {status === 'loading' ? '加载中...' : '正在跳转到登录页面...'}
        </p>
      </div>
    );
  }

  // 初始化本地存储的设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('aiSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          // 只有当不使用默认密钥时才设置自定义API密钥
          setUseDefaultKey(parsed.useDefaultKey !== undefined ? parsed.useDefaultKey : true);
          
          if (!parsed.useDefaultKey) {
            setApiKey(parsed.apiKey || '');
          }
          
          // 设置供应商，默认为智谱AI
          setProvider(parsed.provider || 'zhipu');
          
          // 如果使用默认密钥或者有已保存的供应商和API密钥，尝试加载模型
          if (parsed.useDefaultKey || (parsed.apiKey && parsed.provider)) {
            fetchModels(parsed.provider, parsed.apiKey, parsed.useDefaultKey);
          }
          
          // 如果有已保存的模型且该模型在可用列表中，设置模型
          if (parsed.model) {
            setModel(parsed.model);
          }
        } catch (e) {
          console.error('解析保存的设置时出错:', e);
        }
      } else {
        // 如果没有保存的设置，使用默认值并尝试获取模型
        fetchModels('zhipu', null, true);
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
  const fetchModels = async (providerValue, keyValue, useDefault = false) => {
    if ((!keyValue && !useDefault) || isModelLoading) return;
    
    try {
      setIsModelLoading(true);
      setError(null);
      
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: providerValue,
          apiKey: keyValue,
          useDefaultKey: useDefault
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取模型失败');
      }
      
      const data = await response.json();
      
      if (data.success && data.models) {
        setModelOptions(data.models);
        
        // 如果当前没有选择模型或者模型不在新列表中，选择第一个模型
        if (!model || !data.models.find(m => m.value === model)) {
          setModel(data.models[0]?.value || '');
        }
      } else {
        throw new Error(data.error || '获取模型失败');
      }
    } catch (err) {
      console.error('获取模型列表时出错:', err);
      setError(`获取模型失败: ${err.message}`);
      setModelOptions([{ value: 'default', label: '默认模型' }]);
      setModel('default');
    } finally {
      setIsModelLoading(false);
    }
  };
  
  // Effect 钩子：在 provider 或 apiKey 变化时获取模型列表
  useEffect(() => {
    fetchModels(provider, apiKey, useDefaultKey);
  }, [provider, apiKey, useDefaultKey]);

  // Effect 钩子：在 prompt 加载完成后，获取模型列表
  useEffect(() => {
    if (prompt) {
      // 如果使用默认密钥或者有设置自定义API密钥，获取模型列表
      if (useDefaultKey || (provider && apiKey)) {
        fetchModels(provider, apiKey, useDefaultKey);
      }
    }
  }, [prompt, apiKey, provider, useDefaultKey]); // 依赖项增加 useDefaultKey

  // 改进的自动滚动逻辑：当用户在底部时使用自动滚动，不在底部时使用平滑滚动
  useEffect(() => {
    if (messages.length > 0) {
      if (isAtBottom) {
        // 用户在底部，立即滚动
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      } else if (isGenerating) {
        // 用户不在底部但正在生成内容，使用平滑滚动不打扰用户
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isAtBottom, isGenerating]);

  // 监听滚动事件
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      // 计算是否滚动到底部附近，增加容差到50px
      const isBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      setIsAtBottom(isBottom);
    };
    
    // 初始加载时检查是否在底部
    handleScroll(); 
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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

  // 在 useEffect 中添加倒计时逻辑
  useEffect(() => {
    let timer;
    if (cooldownRemaining > 0) {
      timer = setTimeout(() => {
        setCooldownRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    
    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // 修改 handleSendMessage 函数
  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating) return;
    
    const now = Date.now();
    const timeElapsed = (now - lastMessageTime) / 1000;
    
    // 如果使用默认密钥且距离上次发送不足60秒，则显示冷却时间
    if (useDefaultKey && timeElapsed < 60) {
      const remainingTime = Math.ceil(60 - timeElapsed);
      setCooldownRemaining(remainingTime);
      setError(`使用默认API密钥时，请等待 ${remainingTime} 秒后再发送消息`);
      return;
    }
    
    // 清除错误信息
    setError(null);
    
    // 记录发送时间
    setLastMessageTime(now);
    
    // 添加用户消息到对话历史
    const newUserMessage = { role: 'user', content: userInput };
    // 准备发送到API的完整消息历史（包括提示词作为系统消息）
    const fullMessages = prompt ?
      [{ role: 'system', content: prompt.content }, ...messages, newUserMessage] :
      [...messages, newUserMessage];

    // 先清空输入框并设置生成状态
    setUserInput('');
    setIsGenerating(true);

    // 添加一个空的AI消息作为占位符，用于接收流式内容
    setMessages(prev => [...prev, newUserMessage, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: fullMessages,
          provider,
          model,
          apiKey: useDefaultKey ? null : apiKey, // 如果使用默认密钥，则不发送API密钥
          useDefaultKey, // 告诉后端使用默认密钥
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
  // 自定义代码块组件
  const CodeBlock = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  if (!inline && match) {
    return (
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#2d3748',
          color: '#e2e8f0',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px'
        }}>
          <span>{language}</span>
          <button
            onClick={handleCopy}
            style={{
              background: 'none',
              border: 'none',
              color: '#e2e8f0',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <SyntaxHighlighter
          style={tomorrow}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '6px',
            borderBottomRightRadius: '6px'
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};
  
  // 保存设置到本地存储
  const saveSettings = () => {
    const settings = {
      apiKey,
      provider,
      model,
      useDefaultKey
    };
    
    localStorage.setItem('aiSettings', JSON.stringify(settings));
    setShowSettings(false);
    
    // 获取最新的模型列表
    fetchModels(provider, apiKey, useDefaultKey);
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
            onClick={() => setShowSettings(true)}
            title="API设置"
          >
            <MdSettings size={24} />
          </button>
        </div>
        
        {/* 设置面板 */}
        <div className={`${styles.settingsPanel} ${showSettings ? styles.settingsPanelVisible : ''}`}>
          <div className={styles.settingsHeader}>
            <h3>设置</h3>
            <button className={styles.closeButton} onClick={() => setShowSettings(false)}>
              <MdClose size={24} />
            </button>
          </div>
          
          {/* 默认API密钥选项 */}
          <div className={styles.settingItem}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={useDefaultKey}
                onChange={(e) => setUseDefaultKey(e.target.checked)}
              />
              使用系统提供的默认API密钥
            </label>
            <p className={styles.settingDescription}>
              每位用户限制每分钟发送一次消息
            </p>
          </div>
          
          {/* 供应商选择 */}
          <div className={styles.settingItem}>
            <label>选择供应商</label>
            <div className={styles.radioGroup}>
              {providerOptions.map(option => (
                <label key={option.value} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="provider"
                    value={option.value}
                    checked={provider === option.value}
                    onChange={(e) => {
                      setProvider(e.target.value);
                      setModel(''); // 清空模型选择，因为不同供应商的模型不同
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          
          {/* 自定义API密钥设置，当不使用默认密钥时显示 */}
          {!useDefaultKey && (
            <div className={styles.settingItem}>
              <label>API密钥</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`输入${
                  provider === 'openai' ? 'OpenAI' : provider === 'zhipu' ? '智谱AI' : ''
                } API密钥`}
                className={styles.settingInput}
              />
            </div>
          )}
          
          {/* 模型选择 */}
          <div className={styles.settingItem}>
            <label>选择模型</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={styles.settingSelect}
              disabled={isModelLoading}
            >
              {modelOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isModelLoading && <span className={styles.loadingText}>加载中...</span>}
          </div>
          
          <div className={styles.settingButtons}>
            <button 
              className={styles.refreshButton}
              onClick={() => fetchModels(provider, apiKey, useDefaultKey)}
              disabled={isModelLoading}
            >
              <MdRefresh size={20} />
              刷新模型
            </button>
            <button 
              className={styles.saveButton}
              onClick={saveSettings}
              disabled={isModelLoading || (!useDefaultKey && !apiKey)}
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
                    {msg.content ? (
                      msg.role === 'assistant' ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code: CodeBlock
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )
                    ) : (
                      isGenerating && index === messages.length - 1 && (
                        <span className={styles.typingIndicator}>思考中...</span>
                      )
                    )}
                  </div>
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
            {cooldownRemaining > 0 && (
              <div className={styles.cooldownMessage}>
                <span>冷却时间: {cooldownRemaining}秒</span>
                <progress 
                  value={60 - cooldownRemaining} 
                  max="60" 
                  className={styles.cooldownProgress}
                />
              </div>
            )}
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