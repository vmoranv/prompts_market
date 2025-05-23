import { useState, useEffect } from 'react';
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "../contexts/ThemeContext";
import Nav from '../components/Nav'; 
import '../styles/globals.css'; 

export default function MyApp({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--text-primary)'
      }}>
        加载中...
      </div>
    );
  }
  
  return (
    <SessionProvider session={pageProps.session}>
      <ThemeProvider>
        <Nav /> {/* 添加导航栏组件 */}
        <main className="main-content">
          <Component {...pageProps} />
        </main>
      </ThemeProvider>
    </SessionProvider>
  );
} 