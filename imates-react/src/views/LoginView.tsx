import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LoginView.css'

export const LoginView: React.FC = () => {
  const navigate = useNavigate()
  const [loginForm, setLoginForm] = useState({
    account: '',
    password: '',
  })
  const [errors, setErrors] = useState<{ account?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isFormValid = loginForm.account.trim() !== '' && loginForm.password.trim() !== ''

  const validateAccount = () => {
    if (!loginForm.account.trim()) {
      setErrors(prev => ({ ...prev, account: '请输入账号' }))
    } else {
      setErrors(prev => ({ ...prev, account: undefined }))
    }
  }

  const validatePassword = () => {
    if (!loginForm.password.trim()) {
      setErrors(prev => ({ ...prev, password: '请输入密码' }))
    } else {
      setErrors(prev => ({ ...prev, password: undefined }))
    }
  }

  const handleLogin = async () => {
    validateAccount()
    validatePassword()

    if (!isFormValid) return

    setIsLoading(true)
    setErrorMessage('')

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      navigate('/home')
    } catch (err) {
      setErrorMessage('登录失败，请检查账号密码')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-form-container">
        <div className="login-form-card">
          <div className="login-form-section">
            <form onSubmit={handleLogin} className="login-form">
              <div className="user-id-input-wrapper">
                <div className={`login-input-container ${errors.account ? 'has-error' : ''}`}>
                  <img src="/icons/user.svg" alt="username" className="username-icon" />
                  <input
                    type="text"
                    placeholder="请输入账号"
                    className="login-input"
                    value={loginForm.account}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, account: e.target.value }))}
                    onBlur={validateAccount}
                  />
                </div>
                {errors.account && <div className="input-error">{errors.account}</div>}
              </div>

              <div className="password-input-wrapper">
                <div className={`login-input-container ${errors.password ? 'has-error' : ''}`}>
                  <img src="/icons/lock.svg" alt="password" className="password-icon" />
                  <input
                    type="password"
                    placeholder="请输入密码"
                    className="login-input"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    onBlur={validatePassword}
                  />
                </div>
                {errors.password && <div className="input-error">{errors.password}</div>}
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <span className="button-loading">
                    <span className="spinner"></span>
                    <span>登录中...</span>
                  </span>
                ) : (
                  <span>登 录</span>
                )}
              </button>

              {errorMessage && <div className="error-banner">{errorMessage}</div>}
            </form>
          </div>
        </div>
      </div>

      <div className="version-info">
        <span>版本 1.0.0</span>
      </div>
    </div>
  )
}

export default LoginView
