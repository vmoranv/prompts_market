import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useTheme } from '../contexts/ThemeContext';
import styles from '../styles/SafeMarkdown.module.css';

// 自定义安全配置
const sanitizeConfig = {
  // 允许的标签
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 
    'strong', 'em', 'blockquote', 'hr', 'br', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'del'
  ],
  // 允许的属性
  allowedAttributes: {
    // 允许图片的 src 和 alt
    img: ['src', 'alt', 'width', 'height'],
    // 禁止链接的跳转功能
    a: [], // 不允许 href
    // 允许代码块语言
    code: ['className']
  },
  // 禁用所有 URL 协议
  allowedSchemes: [],
  // 禁用所有 URI 属性
  allowedSchemesByTag: {}
};

const SafeMarkdown = ({ content, className }) => {
  const { isDark } = useTheme();

  // 自定义链接组件 - 禁用跳转
  const DisabledLink = ({ node, ...props }) => {
    // 移除所有链接功能，仅显示为文本
    return <span className={styles.disabledLink}>{props.children}</span>;
  };

  // 自定义图片组件 - 限制大小和添加边框
  const SafeImage = ({ node, ...props }) => {
    return (
      <img
        src={props.src || ''}
        alt={props.alt || ''}
        className={styles.safeImage}
        loading="lazy"
      />
    );
  };

  return (
    <div className={`${styles.markdownContainer} ${isDark ? styles.dark : styles.light} ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // 支持 GitHub 风格 Markdown
        rehypePlugins={[
          rehypeRaw, // 允许原始 HTML (会被下面的 sanitize 过滤)
          [rehypeSanitize, sanitizeConfig] // 应用安全过滤
        ]}
        components={{
          a: DisabledLink, // 自定义链接处理
          img: SafeImage, // 自定义图片处理
          // 可以添加更多自定义组件处理
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default SafeMarkdown; 