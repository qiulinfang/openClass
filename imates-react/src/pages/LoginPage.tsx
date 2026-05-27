import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, isLoggedIn } from '../services/auth'
import './LoginPage.css'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 检查是否已登录
  React.useEffect(() => {
    if (isLoggedIn()) {
      navigate('/chat')
    }
  }, [navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!account.trim()) {
      setError('请输入账号')
      return
    }
    if (!password.trim()) {
      setError('请输入密码')
      return
    }

    setIsLoading(true)
    
    try {
      await login(account, password)
      navigate('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-form-container">
        <div className="login-form-card">
          <div className="login-header">
            <h1>学伴 AI</h1>
            <p>智能学习助手</p>
          </div>
          
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <div className="login-input-container">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="请输入账号"
                  className="login-input"
                />
              </div>
            </div>

            <div className="input-group">
              <div className="login-input-container">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="login-input"
                />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登 录'}
            </button>
          </form>
        </div>
      </div>
      
      <div className="version-text">
        v1.0.0
      </div>
    </div>
  )
}

export default LoginPage
