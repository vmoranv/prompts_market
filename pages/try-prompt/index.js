import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import styles from '../../styles/TryPrompt.module.css';
import { MdArrowBack, MdSettings, MdSend, MdClose, MdChat, MdSave, MdDelete, MdDragHandle, MdAdd } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { SiOpenai, SiGooglegemini } from 'react-icons/si';
import { FaBrain } from 'react-icons/fa';

export default function TryPromptConversationPage() {
  const { data: session, status } = useSession();
  
  // 状态管理
  const [conversationHistory, setConversationHistory] = useState([]);
  const [promptQueue, setPromptQueue] = useState([]);
  const [availablePrompts, setAvailablePrompts] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  
  // API 设置
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('zhipu');
  const [model, setModel] = useState('glm-4-flash-250414');
  const [useDefaultKey, setUseDefaultKey] = useState(true);
  const [modelOptions, setModelOptions] = useState([]);
  const [isModelLoading, setIsModelLoading] = useState(false);
  
  // UI 状态
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isQueueCollapsed, setIsQueueCollapsed] = useState(false);
  const [isQueueAnimating, setIsQueueAnimating] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // 供应商选项
  const providerOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'zhipu', label: '智谱AI' },
    { value: 'gemini', label: 'Google Gemini' },
  ];

  // 登录检查
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      window.location.href = '/auth/signin?callbackUrl=' + encodeURIComponent(window.location.pathname);
      return;
    }
  }, [status]);

  // 初始化设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('aiSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setUseDefaultKey(parsed.useDefaultKey !== undefined ? parsed.useDefaultKey : true);
          if (!parsed.useDefaultKey) {
            setApiKey(parsed.apiKey || '');
          }
          setProvider(parsed.provider || 'zhipu');
          setModel(parsed.model || 'glm-4-flash-250414');
        } catch (e) {
          console.error('解析保存的设置时出错:', e);
        }
      }
      
      // 加载可用的 prompts
      fetchAvailablePrompts();
    }
  }, []);

  // 获取可用的 prompts
  const fetchAvailablePrompts = async () => {
    try {
      const response = await fetch('/api/prompts?status=published&limit=50');
      if (response.ok) {
        const data = await response.json();
        setAvailablePrompts(data.data || []);
      }
    } catch (error) {
      console.error('获取可用 prompts 失败:', error);
    }
  };

  // 自动滚动
  useEffect(() => {
    if (conversationHistory.length > 0 && isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [conversationHistory, isAtBottom]);

  // 滚动监听
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const isBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      setIsAtBottom(isBottom);
    };
    
    handleScroll();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 调整输入框高度
  useEffect(() => {
    const textarea = messageInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [currentInput]);

  // 冷却计时器
  useEffect(() => {
    let timer;
    if (cooldownRemaining > 0) {
      timer = setTimeout(() => {
        setCooldownRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // 处理用户发送消息 - 增强调试信息
  const handleSend = async () => {
    if (!currentInput.trim() || isLoading || promptQueue.length === 0) return;

    const now = Date.now();
    const timeElapsed = (now - lastMessageTime) / 1000;
    
    // 冷却检查
    if (useDefaultKey && timeElapsed < 60) {
      const remainingTime = Math.ceil(60 - timeElapsed);
      setCooldownRemaining(remainingTime);
      setError(`使用默认API密钥时，请等待 ${remainingTime} 秒后再发送消息`);
      return;
    }

    setError(null);
    setLastMessageTime(now);
    setIsLoading(true);

    console.log('=== 开始新的多 Prompt 会话 ===');
    console.log('用户输入:', currentInput);
    console.log('Prompt 队列:', promptQueue.map((p, i) => `${i+1}. ${p.title}`));
    console.log('当前对话历史长度:', conversationHistory.length);

    // 添加用户消息
    const userMessage = { type: 'user', content: currentInput, timestamp: Date.now() };
    setConversationHistory(prev => [...prev, userMessage]);
    setCurrentInput('');

    // 处理 prompt 队列
    await processPromptQueue(currentInput);
  };

  // 处理 prompt 队列 - 修复上下文传递逻辑
  const processPromptQueue = async (userInput) => {
    // 构建基础上下文：包含完整的历史对话
    const baseContext = [];
    
    // 首先添加所有历史对话（按时间顺序）
    for (const historyMsg of conversationHistory) {
      if (historyMsg.type === 'user') {
        baseContext.push({ role: 'user', content: historyMsg.content });
      } else if (historyMsg.type === 'prompt' && historyMsg.content && !historyMsg.isGenerating) {
        baseContext.push({ role: 'assistant', content: historyMsg.content });
      }
    }
    
    // 然后添加当前用户输入
    baseContext.push({ role: 'user', content: userInput });

    console.log('开始处理 Prompt 队列，基础上下文:', baseContext);

    // 用于累积本次对话的响应
    const currentSessionResponses = [];

    for (let i = 0; i < promptQueue.length; i++) {
      const prompt = promptQueue[i];
      const promptMessage = { 
        type: 'prompt', 
        content: '', 
        promptId: prompt._id, 
        promptName: prompt.title,
        timestamp: Date.now(),
        isGenerating: true
      };
      
      // 添加占位符消息到UI
      setConversationHistory(prev => [...prev, promptMessage]);

      try {
        // 为当前 prompt 构建完整的上下文
        // 系统消息 + 历史对话 + 当前用户输入 + 本次会话中前面的响应
        const promptContext = [
          { role: 'system', content: prompt.content },
          ...baseContext,
          ...currentSessionResponses
        ];

        console.log(`Prompt ${i + 1} (${prompt.title}) 完整上下文:`, {
          systemPrompt: prompt.content.substring(0, 100) + '...',
          totalMessages: promptContext.length,
          historyMessages: baseContext.length,
          sessionResponses: currentSessionResponses.length,
          contextPreview: promptContext.slice(-3).map((msg, idx) => ({
            role: msg.role,
            content: msg.content.substring(0, 50) + '...'
          }))
        });

        // 如果不是第一个 Prompt，添加短暂延迟避免并发问题
        if (i > 0) {
          console.log(`等待 ${i * 0.5} 秒后处理第 ${i + 1} 个 Prompt...`);
          await new Promise(resolve => setTimeout(resolve, i * 500));
        }

        // 独立的 API 调用，标记为队列请求
        let response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: promptContext,
            provider,
            model,
            apiKey: useDefaultKey ? null : apiKey,
            useDefaultKey,
            isQueueRequest: true,
          }),
        });


        if (!response.ok) {
          const errorData = await response.json();
          
          // 如果是速率限制错误，尝试等待后重试
          if (response.status === 429 && errorData.remainingTime) {
            console.log(`Prompt ${i + 1} 遇到速率限制，等待 ${errorData.remainingTime} 秒后重试...`);
            
            // 显示等待状态
            setConversationHistory(prev => {
              const newHistory = [...prev];
              const lastIndex = newHistory.length - 1;
              if (lastIndex >= 0 && newHistory[lastIndex].promptId === prompt._id) {
                newHistory[lastIndex] = {
                  ...newHistory[lastIndex],
                  content: `等待 ${errorData.remainingTime} 秒后重试...`,
                  isGenerating: true
                };
              }
              return newHistory;
            });
            
            // 等待指定时间
            await new Promise(resolve => setTimeout(resolve, errorData.remainingTime * 1000));
            
            // 重试请求
            const retryResponse = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: promptContext,
                provider,
                model,
                apiKey: useDefaultKey ? null : apiKey,
                useDefaultKey,
                isQueueRequest: true,
              }),
            });
            
            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json();
              throw new Error(retryErrorData.error || `重试失败: ${retryResponse.status}`);
            }
            
            // 使用重试的响应继续处理
            response = retryResponse;
          } else {
            throw new Error(errorData.error || `Prompt ${prompt.title} API请求失败: ${response.status}`);
          }
        }

        // 处理流式响应
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/event-stream')) {
          let promptResponse = '';
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
              
              const dataContent = trimmedLine.substring(6);
              if (dataContent === '[DONE]') break;

              try {
                const data = JSON.parse(dataContent);
                if (data.content) {
                  promptResponse += data.content;
                  
                  // 实时更新UI
                  setConversationHistory(prev => {
                    const newHistory = [...prev];
                    const lastIndex = newHistory.length - 1;
                    if (lastIndex >= 0 && newHistory[lastIndex].promptId === prompt._id) {
                      newHistory[lastIndex] = {
                        ...newHistory[lastIndex],
                        content: promptResponse,
                        isGenerating: true
                      };
                    }
                    return newHistory;
                  });
                }
              } catch (parseError) {
                console.error('解析流数据失败:', parseError);
              }
            }
          }

          // 完成当前 prompt 的响应
          const finalResponse = {
            type: 'prompt',
            content: promptResponse,
            promptId: prompt._id,
            promptName: prompt.title,
            timestamp: Date.now(),
            isGenerating: false
          };

          // 更新UI
          setConversationHistory(prev => {
            const newHistory = [...prev];
            const lastIndex = newHistory.length - 1;
            if (lastIndex >= 0 && newHistory[lastIndex].promptId === prompt._id) {
              newHistory[lastIndex] = finalResponse;
            }
            return newHistory;
          });

          // 将当前 prompt 的响应添加到本次会话的响应列表中
          currentSessionResponses.push({ 
            role: 'assistant', 
            content: promptResponse 
          });

          console.log(`Prompt ${i + 1} (${prompt.title}) 完成，响应长度: ${promptResponse.length}`);

        } else {
          // 处理非流式响应的逻辑保持不变
          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error || `Prompt ${prompt.title} 生成失败`);
          }

          const finalResponse = {
            type: 'prompt',
            content: data.result,
            promptId: prompt._id,
            promptName: prompt.title,
            timestamp: Date.now(),
            isGenerating: false
          };

          setConversationHistory(prev => {
            const newHistory = [...prev];
            const lastIndex = newHistory.length - 1;
            if (lastIndex >= 0 && newHistory[lastIndex].promptId === prompt._id) {
              newHistory[lastIndex] = finalResponse;
            }
            return newHistory;
          });

          currentSessionResponses.push({ 
            role: 'assistant', 
            content: data.result 
          });
        }

      } catch (error) {
        console.error(`处理 Prompt ${prompt.title} 时出错:`, error);
        
        // 错误处理
        const errorResponse = {
          type: 'prompt',
          content: `处理失败: ${error.message}`,
          promptId: prompt._id,
          promptName: prompt.title,
          timestamp: Date.now(),
          isGenerating: false,
          isError: true
        };

        setConversationHistory(prev => {
          const newHistory = [...prev];
          const lastIndex = newHistory.length - 1;
          if (lastIndex >= 0 && newHistory[lastIndex].promptId === prompt._id) {
            newHistory[lastIndex] = errorResponse;
          }
          return newHistory;
        });

        // 即使出错，也要添加到响应列表中，避免后续 prompt 丢失上下文
        currentSessionResponses.push({ 
          role: 'assistant', 
          content: `[${prompt.title} 处理失败: ${error.message}]` 
        });
      }
    }

    setIsLoading(false);
    console.log('所有 Prompt 处理完成，本次会话产生的响应数:', currentSessionResponses.length);
  };


  // 代码块组件
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

    return <code className={className} {...props}>{children}</code>;
  };

  // 保存设置
  const saveSettings = () => {
    const settings = { apiKey, provider, model, useDefaultKey };
    localStorage.setItem('aiSettings', JSON.stringify(settings));
    setShowSettings(false);
  };

  // 添加 prompt 到队列
  const addPromptToQueue = (prompt) => {
    if (!promptQueue.find(p => p._id === prompt._id)) {
      setPromptQueue(prev => [...prev, prompt]);
    }
  };

  // 从队列移除 prompt
  const removePromptFromQueue = (promptId) => {
    setPromptQueue(prev => prev.filter(p => p._id !== promptId));
  };

  // 渲染加载状态
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>
          {status === 'loading' ? '加载中...' : '正在跳转到登录页面...'}
        </p>
      </div>
    );
  }


  // 获取模型列表
  const fetchModels = async (providerValue, keyValue, useDefault = false) => {
    if ((!keyValue && !useDefault) || isModelLoading) return;
    
    try {
      setIsModelLoading(true);
      setError(null);
      
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // 处理队列折叠切换
  const handleQueueToggle = () => {
    if (isQueueAnimating) return; // 防止动画过程中重复触发
    
    setIsQueueAnimating(true);
    
    if (!isQueueCollapsed) {
      // 收起时：先播放收起动画，然后设置为收起状态
      setIsQueueCollapsed(true);
      // 动画完成后重置动画状态
      setTimeout(() => {
        setIsQueueAnimating(false);
      }, 300);
    } else {
      // 展开时：先设置为展开状态，然后播放展开动画
      setIsQueueCollapsed(false);
      setTimeout(() => {
        setIsQueueAnimating(false);
      }, 300);
    }
  };

    return (
    <>
      <Head>
        <title>多 Prompt 对话 - Promptopia</title>
        <meta name="description" content="与多个 Prompt 进行上下文对话" />
      </Head>
      
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/" className={styles.backButton}>
            <MdArrowBack size={24} />
            <span>返回主页</span>
          </Link>
          <h1 style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '1.25rem', fontWeight: '500' }}>
            多 Prompt 对话
          </h1>
          <button 
            className={styles.settingsButton} 
            onClick={() => {
              setShowSettings(true);
              if (modelOptions.length === 0) {
                fetchModels(provider, apiKey, useDefaultKey);
              }
            }}
            title="设置"
          >
            <MdSettings size={24} />
          </button>
        </div>
        
        {/* 对话主界面 */}
        <div className={styles.chatContainer}>
          {/* Prompt 队列显示 */}
          {promptQueue.length > 0 && (
            <div className={styles.systemPrompt}>
              <div 
                className={styles.systemPromptHeader}
                onClick={handleQueueToggle}
              >
                <h3>当前 Prompt 队列 ({promptQueue.length})</h3>
                <span className={`${styles.collapseIcon} ${isQueueCollapsed ? styles.collapsed : styles.expanded}`}>
                  {isQueueCollapsed ? '+' : '-'}
                </span>
              </div>
              {(!isQueueCollapsed || isQueueAnimating) && (
                <div 
                  className={`${styles.promptQueueList} ${
                    isQueueCollapsed && isQueueAnimating ? styles.queueSlideUp : styles.queueSlideDown
                  }`}
                  key={isQueueCollapsed ? "queue-collapsing" : "queue-expanded"}
                >
                  {promptQueue.map((prompt, index) => (
                    <div 
                      key={prompt._id} 
                      className={styles.promptQueueItem}
                      style={{
                        animationDelay: isQueueCollapsed ? `${(promptQueue.length - index - 1) * 0.03}s` : `${index * 0.05}s`
                      }}
                    >
                      <span className={styles.promptOrder}>{index + 1}</span>
                      <span className={styles.promptTitle}>{prompt.title}</span>
                      <button
                        className={styles.removePromptButton}
                        onClick={(e) => {
                          e.stopPropagation(); // 防止触发折叠
                          removePromptFromQueue(prompt._id);
                        }}
                        title="移除"
                      >
                        <MdDelete size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          
          {/* 消息列表 */}
          <div 
            className={styles.messagesContainer} 
            ref={messagesContainerRef}
          >
            {conversationHistory.length === 0 ? (
              <div className={styles.emptyState}>
                <MdChat size={48} />
                <p>配置 Prompt 队列并开始对话吧！</p>
                {promptQueue.length === 0 && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    请先在设置中添加 Prompt 到队列
                  </p>
                )}
              </div>
            ) : (
              conversationHistory.map((msg, index) => (
                <div 
                  key={index} 
                  className={`${styles.message} ${
                    msg.type === 'user' ? styles.userMessage : styles.aiMessage
                  } ${msg.isError ? styles.errorMessage : ''}`}
                >
                  <div className={styles.messageHeader}>
                    <span className={styles.roleBadge}>
                      {msg.type === 'user' ? '你' : msg.promptName || 'AI'}
                    </span>
                    {msg.timestamp && (
                      <span className={styles.messageTime}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className={`${styles.messageContent} ${msg.isGenerating ? styles.typing : ''}`}>
                    {msg.content ? (
                      msg.type === 'prompt' ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{ code: CodeBlock }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )
                    ) : (
                      msg.isGenerating && (
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
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={promptQueue.length === 0 ? "请先在设置中添加 Prompt..." : "输入你的消息..."}
              disabled={isLoading || promptQueue.length === 0}
              className={styles.messageInput}
              rows={1}
            />
            <button
              className={styles.sendButton}
              onClick={handleSend}
              disabled={!currentInput.trim() || isLoading || promptQueue.length === 0}
            >
              <MdSend size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {/* 设置面板 */}
      <div className={`${styles.settingsPanel} ${showSettings ? styles.settingsPanelVisible : ''}`}>
        <div className={styles.settingsHeader}>
          <h3>设置</h3>
          <button className={styles.closeButton} onClick={() => setShowSettings(false)}>
            <MdClose size={24} />
          </button>
        </div>
        
        {/* Prompt 队列管理 */}
        <div className={styles.settingItem}>
          <label>Prompt 队列管理</label>
          <div className={styles.promptManagement}>
            {/* 可用 Prompt 列表 */}
            <div className={styles.availablePrompts}>
              <h4>可用 Prompts</h4>
              <div className={styles.promptList}>
                {availablePrompts.map(prompt => (
                  <div 
                    key={prompt._id} 
                    className={`${styles.promptItem} ${
                      promptQueue.find(p => p._id === prompt._id) ? styles.promptItemSelected : ''
                    }`}
                  >
                    <div className={styles.promptInfo}>
                      <span className={styles.promptName}>{prompt.title}</span>
                      <span className={styles.promptDescription}>
                        {prompt.description || '暂无描述'}
                      </span>
                    </div>
                    <button
                      className={styles.addPromptButton}
                      onClick={() => addPromptToQueue(prompt)}
                      disabled={!!promptQueue.find(p => p._id === prompt._id)}
                    >
                      <MdAdd size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 当前队列 */}
            {promptQueue.length > 0 && (
              <div className={styles.currentQueue}>
                <h4>当前队列</h4>
                <div className={styles.queueList}>
                  {promptQueue.map((prompt, index) => (
                    <div key={prompt._id} className={styles.queueItem}>
                      <span className={styles.queueOrder}>{index + 1}</span>
                      <span className={styles.queuePromptName}>{prompt.title}</span>
                      <button
                        className={styles.removeQueueButton}
                        onClick={() => removePromptFromQueue(prompt._id)}
                      >
                        <MdDelete size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* API 设置部分 */}
        <div className={styles.settingItem}>
          <label>API密钥设置</label>
          <div className={styles.apiKeyOptions}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="apiKeyType"
                value="default"
                checked={useDefaultKey}
                onChange={() => setUseDefaultKey(true)}
              />
              使用默认密钥（限制频率）
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="apiKeyType"
                value="custom"
                checked={!useDefaultKey}
                onChange={() => setUseDefaultKey(false)}
              />
              使用自定义密钥
            </label>
          </div>
          <div className={styles.settingDescription}>
            默认密钥有使用频率限制，自定义密钥无限制但需要自行承担费用
          </div>
        </div>

        <div className={styles.settingItem}>
          <label>选择供应商</label>
          <div className={styles.providerGrid}>
            {providerOptions.map(option => (
              <label key={option.value} className={`${styles.providerCard} ${provider === option.value ? styles.providerCardSelected : ''}`}>
                <input
                  type="radio"
                  name="provider"
                  value={option.value}
                  checked={provider === option.value}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    const defaultModel = e.target.value === 'openai' ? 'gpt-3.5-turbo' : 
                                        e.target.value === 'gemini' ? 'gemini-2.0-flash' : 
                                        'glm-4-flash-250414';
                    setModel(defaultModel);
                    fetchModels(e.target.value, apiKey, useDefaultKey);
                  }}
                  className={styles.hiddenRadio}
                />
                <div className={styles.providerIcon}>
                  {option.value === 'openai' && <SiOpenai size={24} />}
                  {option.value === 'zhipu' && <FaBrain size={24} />}
                  {option.value === 'gemini' && <SiGooglegemini size={24} />}
                </div>
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {!useDefaultKey && (
          <div className={styles.settingItem}>
            <label>自定义API密钥</label>
            <div className={styles.inputWrapper}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`输入${
                  provider === 'openai' ? 'OpenAI' : 
                  provider === 'zhipu' ? '智谱AI' : 
                  provider === 'gemini' ? 'Google Gemini' : ''
                } API密钥`}
                className={styles.settingInput}
              />
              <div className={styles.inputIcon}>🔑</div>
            </div>
            <div className={styles.settingDescription}>
              请确保API密钥有效且有足够余额
            </div>
          </div>
        )}

        <div className={styles.settingItem}>
          <label>选择模型</label>
          <div className={styles.selectWrapper}>
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
            {isModelLoading && (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.settingButtons}>
          <button 
            className={styles.saveButton}
            onClick={saveSettings}
            disabled={isModelLoading || (!useDefaultKey && !apiKey)}
          >
            <MdSave size={20} />
            保存设置
          </button>
        </div>
      </div>
    </>
  );
}
