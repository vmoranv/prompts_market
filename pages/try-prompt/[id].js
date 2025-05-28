import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import styles from '../../styles/TryPrompt.module.css';
import { MdArrowBack, MdPlayArrow, MdContentCopy, MdCheck, MdSettings, MdRefresh } from 'react-icons/md';

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

  // 处理生成结果
  const handleGenerate = async () => {
    if (!prompt || !userInput) return;
    
    try {
      setLoading(true);
      setResult('');
      setError(null);
      
      // 这里应该调用实际的AI API，例如OpenAI API
      // 以下是模拟的实现
      const fullPrompt = `${prompt.content}\n\n${userInput}`;
      
      if (!apiKey) {
        // 使用本地模拟功能
        setTimeout(() => {
          setResult(`这是基于以下提示的模拟生成结果：\n\n${fullPrompt}\n\n由于未提供API密钥，此为模拟输出。要获取真实AI响应，请在设置中添加您的API密钥。`);
          setLoading(false);
        }, 1500);
        return;
      }
      
      if (!model) {
        setError('请选择一个模型');
        setLoading(false);
        return;
      }
      
      // 使用实际API
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            apiKey,
            provider,
            model
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '生成失败');
        }
        
        const data = await response.json();
        setResult(data.result);
      } catch (error) {
        setError(`生成失败: ${error.message}`);
        setResult('');
      }
      
    } finally {
      setLoading(false);
    }
  };
  
  // 复制结果
  const handleCopy = () => {
    if (!result) return;
    
    navigator.clipboard.writeText(result)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
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
  
  // 处理供应商变更
  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    // 清空模型列表和选择
    setModelOptions([]);
    setModel('');
    // 如果有API密钥，尝试获取新供应商的模型列表
    if (apiKey) {
      fetchModels(newProvider, apiKey);
    }
  };
  
  // 处理API密钥变更
  const handleApiKeyChange = (e) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
  };
  
  // 刷新模型列表
  const refreshModels = () => {
    if (apiKey && provider) {
      fetchModels(provider, apiKey);
    }
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
    <div className={styles.container}>
      <Head>
        <title>试用 - {prompt.title}</title>
        <meta name="description" content={`试用 ${prompt.title} 提示词`} />
      </Head>
      
      <div className={styles.header}>
        <Link href={`/prompt/${id}`} className={styles.backLink}>
          <MdArrowBack /> 返回详情页
        </Link>
        <h1 className={styles.title}>{prompt.title}</h1>
        <button 
          className={styles.settingsButton}
          onClick={() => setShowSettings(!showSettings)}>
          <MdSettings /> 设置
        </button>
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {showSettings && (
        <div className={styles.settingsPanel}>
          <h2>API 设置</h2>
          <div className={styles.settingsForm}>
            <div className={styles.formGroup}>
              <label htmlFor="provider">AI 供应商</label>
              <select
                id="provider"
                className={styles.select}
                value={provider}
                onChange={handleProviderChange}
              >
                {providerOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="apiKey">API 密钥</label>
              <input
                type="password"
                id="apiKey"
                className={styles.input}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder={`输入${provider === 'openai' ? 'OpenAI' : '智谱AI'} API 密钥`}
              />
              <p className={styles.helperText}>
                {provider === 'openai' 
                  ? 'OpenAI API 密钥格式通常以 sk- 开头' 
                  : '智谱AI API 密钥在您的账户设置中获取'}
              </p>
            </div>
            
            <div className={styles.formGroup}>
              <div className={styles.labelWithAction}>
                <label htmlFor="model">AI 模型</label>
                <button 
                  className={styles.refreshButton} 
                  onClick={refreshModels}
                  disabled={isModelLoading || !apiKey}
                  title="刷新模型列表">
                  <MdRefresh className={isModelLoading ? styles.spinning : ''} />
                </button>
              </div>
              
              {isModelLoading ? (
                <div className={styles.modelLoading}>加载模型中...</div>
              ) : modelOptions.length > 0 ? (
                <select
                  id="model"
                  className={styles.select}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {modelOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={styles.noModels}>
                  {apiKey 
                    ? '未找到可用模型，请检查您的API密钥是否有效' 
                    : '请输入API密钥以加载可用模型'}
                </div>
              )}
            </div>
            
            <div className={styles.buttonGroup}>
              <button 
                className={styles.secondaryButton} 
                onClick={() => setShowSettings(false)}>
                取消
              </button>
              <button 
                className={styles.primaryButton} 
                onClick={saveSettings}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className={styles.content}>
        <div className={styles.promptSection}>
          <h2>Prompt 内容</h2>
          <div className={styles.promptContent}>
            {prompt.content}
          </div>
        </div>
        
        <div className={styles.inputSection}>
          <h2>您的输入</h2>
          <textarea
            className={styles.textArea}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="输入您想要处理的内容..."
            rows={8}
          />
          <button
            className={styles.generateButton}
            onClick={handleGenerate}
            disabled={loading || !userInput}
          >
            {loading ? (
              <>
                <div className={styles.smallSpinner}></div>
                生成中...
              </>
            ) : (
              <>
                <MdPlayArrow /> 生成结果
              </>
            )}
          </button>
        </div>
        
        {(result || loading) && (
          <div className={styles.resultSection}>
            <div className={styles.resultHeader}>
              <h2>生成结果</h2>
              {result && (
                <button 
                  className={styles.copyButton} 
                  onClick={handleCopy}>
                  {copied ? <><MdCheck /> 已复制</> : <><MdContentCopy /> 复制</>}
                </button>
              )}
            </div>
            <div className={styles.resultContent}>
              {loading ? (
                <div className={styles.loadingText}>生成中，请稍候...</div>
              ) : (
                <pre>{result}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 