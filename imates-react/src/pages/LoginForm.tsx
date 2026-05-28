import React from 'react'
import './LoginForm.css'

interface LoginFormProps {
    account: string
    password: string
    isLoading: boolean
    error: string
    onAccountChange: (value: string) => void
    onPasswordChange: (value: string) => void
    onSubmit: (e: React.FormEvent) => void
}

export const LoginForm: React.FC<LoginFormProps> = ({
    account,
    password,
    isLoading,
    error,
    onAccountChange,
    onPasswordChange,
    onSubmit,
}) => {
    return (
        <form onSubmit={onSubmit} className="login-form">
            <div className="input-group">
                <div className="login-input-container">
                    <span className="input-icon">👤</span>
                    <input
                        type="text"
                        value={account}
                        onChange={(e) => onAccountChange(e.target.value)}
                        placeholder="请输入账号"
                        className="login-input"
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="input-group">
                <div className="login-input-container">
                    <span className="input-icon">🔒</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => onPasswordChange(e.target.value)}
                        placeholder="请输入密码"
                        className="login-input"
                        disabled={isLoading}
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
    )
}