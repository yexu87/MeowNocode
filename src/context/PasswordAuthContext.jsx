import React, { createContext, useContext, useState, useEffect } from 'react';

const PasswordAuthContext = createContext();

export function usePasswordAuth() {
  const context = useContext(PasswordAuthContext);
  if (context === undefined) {
    throw new Error('usePasswordAuth must be used within a PasswordAuthProvider');
  }
  return context;
}

export function PasswordAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // 检查是否需要密码认证
  const checkAuthRequirement = async () => {
    try {
      // 检查后端是否配置了PASSWORD环境变量
      const response = await fetch('/api/auth-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequiresAuth(data.requiresAuth || false);
        
        // 如果不需要认证，直接设置为已认证
        if (!data.requiresAuth) {
          setIsAuthenticated(true);
          localStorage.setItem('passwordAuth', 'no-auth-required');
        } else {
          // 检查本地存储的认证状态
          const storedAuth = localStorage.getItem('passwordAuth');
          const storedPassword = localStorage.getItem('storedPassword');
          
          if (storedAuth && storedPassword) {
            // 验证存储的密码是否仍然有效
            const isValid = await verifyStoredPassword(storedPassword);
            setIsAuthenticated(isValid);
            
            if (!isValid) {
              // 密码无效，清除存储
              localStorage.removeItem('passwordAuth');
              localStorage.removeItem('storedPassword');
            }
          }
        }
      } else {
        // 如果无法获取认证状态，假设不需要认证
        setRequiresAuth(false);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('检查认证要求失败:', error);
      // 出错时假设不需要认证
      setRequiresAuth(false);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 验证存储的密码
  const verifyStoredPassword = async (password) => {
    try {
      const response = await fetch('/api/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.valid || false;
      }
      return false;
    } catch (error) {
      console.error('验证密码失败:', error);
      return false;
    }
  };

  // 登录
  const login = async (password) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsAuthenticated(true);
          // 存储认证状态和密码（用于会话持久化）
          localStorage.setItem('passwordAuth', 'authenticated');
          localStorage.setItem('storedPassword', password);
          return { success: true };
        } else {
          return { success: false, message: data.message || '密码错误' };
        }
      } else {
        return { success: false, message: '登录请求失败' };
      }
    } catch (error) {
      console.error('登录失败:', error);
      return { success: false, message: '登录时发生错误: ' + error.message };
    }
  };

  // 显示登录对话框
  const showLogin = () => {
    setShowLoginDialog(true);
  };

  // 隐藏登录对话框
  const hideLogin = () => {
    setShowLoginDialog(false);
  };

  // 退出登录
  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('passwordAuth');
    localStorage.removeItem('storedPassword');
    return { success: true };
  };

  // 初始化时检查认证要求
  useEffect(() => {
    checkAuthRequirement();
  }, []);

  const value = {
    isAuthenticated,
    isLoading,
    requiresAuth,
    login,
    logout,
    showLogin,
    hideLogin,
    showLoginDialog,
  };

  return (
    <PasswordAuthContext.Provider value={value}>
      {children}
    </PasswordAuthContext.Provider>
  );
}