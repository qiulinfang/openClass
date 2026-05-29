import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getXuebanToken } from '@/services'
import '@/pages/LoginPage.css'
import { LoginForm } from '@/pages/LoginForm'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 检查是否已登录
  useEffect(() => {
    if (getXuebanToken()) {
      navigate('/chat')
    }
  }, [navigate])

  useEffect(() => {
    const savedAccount = localStorage.getItem('savedAccount')
    if (savedAccount) {
      setAccount(savedAccount)
    }
  }, [])

  const handleLogin = useCallback(async (e: React.FormEvent) => {
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
      await authService.loginXueban(account, password)
      localStorage.setItem('savedAccount', account)
      navigate('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setIsLoading(false)
    }
  }, [account, password, navigate])

  return (
    <div className="login-page">
      <div className="login-form-container">
        <div className="login-form-card">
          <div className="login-header">
            <h1>学伴 AI</h1>
            <p>智能学习助手</p>
          </div>

          <LoginForm
            account={account}
            password={password}
            isLoading={isLoading}
            error={error}
            onAccountChange={setAccount}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
          />
        </div>
      </div>

      <div className="version-text">
        v1.0.0
      </div>
    </div>
  )
}

export default LoginPage
