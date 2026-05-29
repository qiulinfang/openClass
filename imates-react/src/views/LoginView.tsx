import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getUserId, getPassword, httpClient } from '@/services'
import { AppEnvType, getCurrentEnvType, getEnvDisplayName, trySwitchEnv, getAppUpdateUrl } from '@/config/env-config'
import { Dialog } from '@/components/base/Dialog'
import { Loading } from '@/components/base/Loading'
import usernameIcon from '/icons/username_icon.svg'
import passwordIcon from '/icons/password_icon.svg'
import '@/views/LoginView.css'

export const LoginView: React.FC = () => {
  const navigate = useNavigate()
  
  // 表单状态
  const [loginForm, setLoginForm] = useState({
    account: '',
    password: '',
  })
  const [errors, setErrors] = useState<{ account?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // 版本号存储的 key
  const APP_VERSION_STORAGE_KEY = 'app_version'
  // 环境与版本状态
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [versionClickCount, setVersionClickCount] = useState(0)
  const [showEnvDialog, setShowEnvDialog] = useState(false)
  const [envPassword, setEnvPassword] = useState('')
  const versionClickTimerRef = useRef<number | null>(null)
  
  const currentEnv = getCurrentEnvType()

  // 计算显示的版本号
  const displayVersion = useMemo(() => {
    const envName = getEnvDisplayName()
    return envName ? `${appVersion}\n${envName}` : appVersion
  }, [appVersion])

  const isFormValid = loginForm.account.trim() !== '' && loginForm.password.trim() !== ''

  // 从 localStorage 读取版本号
  const loadAppVersion = (): string => {
    try {
      const savedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY)
      return savedVersion || '1.0.0'
    } catch (error) {
      console.error('[LoginView] 读取版本号失败:', error)
      return '1.0.0'
    }
  }

  // Web 端主动检查应用更新并同步服务器版本号
  const checkAppUpdate = async () => {
    try {
      const url = getAppUpdateUrl()
      const cacheBustedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
      const response = await httpClient.get<any>(cacheBustedUrl)
      const result = response?.data ?? response
      if (!result) {
        console.log("端主动检查应用更新无结果");
        return
      }
      console.log("端主动检查应用更新并同步服务器版本号",result)
      const serverVersion = (result as any).versionName || (result as any).VersionName || ''
      if (serverVersion && typeof serverVersion === 'string') {
        setAppVersion(serverVersion)
        saveAppVersion(serverVersion)
        console.log('[LoginView] Web 端检查更新成功，服务器版本号:', serverVersion)
      }
    } catch (error) {
      console.warn('[LoginView] Web 端检查更新失败:', error)
    }
  }

  // 保存版本号到 localStorage
  const saveAppVersion = (version: string): void => {
    try {
      localStorage.setItem(APP_VERSION_STORAGE_KEY, version)
      console.log('[LoginView] 版本号已保存到 localStorage:', version)
    } catch (error) {
      console.error('[LoginView] 保存版本号失败:', error)
    }
  }
  useEffect(() => {
    const init = async () => {
      // 获取保存的账号（从统一存储）
      const savedUserId = getUserId()
      // 获取保存的密码（从统一存储）
      const savedPassword = getPassword()

      // 如果账号密码都存在且有效，则自动填充表单
      if (savedUserId && savedPassword &&
        savedUserId !== 'undefined' && savedPassword !== 'undefined' &&
        savedUserId.trim() !== '' && savedPassword.trim() !== '') {
        setLoginForm({ account: savedUserId, password: savedPassword })
      }

      // 2. 加载版本号
      const version = loadAppVersion()
      setAppVersion(version)
      console.log('[LoginView] 从 localStorage 加载版本号:', version)

      // Web 端主动调用更新接口检查服务器版本号
      await checkAppUpdate()
    }

    init() // 调用异步逻辑

    // 监听Android原生日志
    const previousCallback = window.onAndroidLog
    window.onAndroidLog = (level: string, tag: string, message: string) => {
      if (previousCallback) {
        previousCallback(level, tag, message)
      }

      const logMessage = `[Android-${tag}] ${message}`

      switch (level.toUpperCase()) {
        case 'WARN':
          console.warn(`[LoginView] ⚠️ ${logMessage}`)
          break
        case 'ERROR':
          console.error(`[LoginView] ❌ ${logMessage}`)
          break
      }
    }

    return () => {
      window.onAndroidLog = previousCallback
      if (versionClickTimerRef.current) {
        window.clearTimeout(versionClickTimerRef.current)
      }
    }
  }, [])

  const validateAccount = () => {
    if (!loginForm.account.trim()) {
      setErrors(prev => ({ ...prev, account: '请输入账号' }))
      return false
    }
    setErrors(prev => ({ ...prev, account: undefined }))
    return true
  }

  const validatePassword = () => {
    if (!loginForm.password.trim()) {
      setErrors(prev => ({ ...prev, password: '请输入密码' }))
      return false
    }
    setErrors(prev => ({ ...prev, password: undefined }))
    return true
  }

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    // 清除之前的错误信息
    setErrorMessage('')

    // 验证表单
    const isAccountValid = validateAccount()
    const isPasswordValid = validatePassword()

    if (!isAccountValid || !isPasswordValid) {
      return
    }
    setIsLoading(true)

    try {
      const token = await authService.loginXueban(loginForm.account, loginForm.password)

      await authService.getUserInfo(token)

      navigate('/app', { replace: true })

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登录失败，请检查网络连接'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVersionClick = () => {
    const nextCount = versionClickCount + 1
    setVersionClickCount(nextCount)

    if (versionClickTimerRef.current) {
      window.clearTimeout(versionClickTimerRef.current)
    }

    versionClickTimerRef.current = window.setTimeout(() => {
      setVersionClickCount(0)
    }, 2000)

    if (nextCount >= 5) {
      setVersionClickCount(0)
      if (versionClickTimerRef.current) {
        window.clearTimeout(versionClickTimerRef.current)
      }
      setShowEnvDialog(true)
    }
  }

  // 环境切换确认逻辑 (我已为你实现)
  const handleEnvSwitchConfirm = () => {
    const targetEnv = currentEnv === AppEnvType.RELEASE ? AppEnvType.INTERNAL_TEST : AppEnvType.RELEASE
    if (targetEnv === AppEnvType.INTERNAL_TEST) {
      const success = trySwitchEnv(targetEnv, envPassword)
      if (success) {
        window.location.reload()
      } else {
        setErrorMessage('密码错误')
        setTimeout(() => setErrorMessage(''), 3000)
      }
    } else {
      trySwitchEnv(targetEnv)
      window.location.reload()
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
                  <img src={usernameIcon} alt="username" className="username-icon" />
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
                  <img src={passwordIcon} alt="password" className="password-icon" />
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
                  <Loading text="登录中..." size={16} theme="light" horizontal />
                ) : (
                  <span>登 录</span>
                )}
              </button>

              {errorMessage && <div className="error-banner">{errorMessage}</div>}
            </form>
          </div>
        </div>
      </div>

      <div className="version-info" onClick={handleVersionClick} style={{ whiteSpace: 'pre-line', cursor: 'pointer' }}>
        <span>{displayVersion}</span>
      </div>

      {/* 环境切换对话框 */}
      <Dialog 
        open={showEnvDialog} 
        title="环境切换" 
        onClose={() => setShowEnvDialog(false)}
        onConfirm={handleEnvSwitchConfirm}
      >
        <div className="env-switch-content" style={{ padding: '20px 0' }}>
          <p>确认切换到 {currentEnv === AppEnvType.RELEASE ? '测试环境' : '正式环境'}？</p>
          {currentEnv === AppEnvType.RELEASE && (
            <input
              type="password"
              placeholder="请输入切换密码"
              value={envPassword}
              onChange={(e) => setEnvPassword(e.target.value)}
              className="env-password-input"
              style={{ width: '100%', marginTop: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          )}
        </div>
      </Dialog>
    </div>
  )
}

export default LoginView
