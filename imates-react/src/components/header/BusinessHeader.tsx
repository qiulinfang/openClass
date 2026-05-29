import React from 'react'
import '@/components/header/BusinessHeader.css'

export interface BusinessHeaderProps {
  title?: React.ReactNode
  showBack?: boolean
  backIcon?: string
  backText?: string
  onBack?: () => void
  left?: React.ReactNode
  right?: React.ReactNode
}

export const BusinessHeader: React.FC<BusinessHeaderProps> = ({
  title = '',
  showBack = true,
  backIcon,
  backText,
  onBack,
  left,
  right,
}) => {
  return (
    <header className="business-header">
      <div className="toolbar-left">
        {left || (showBack && (
          <div className="back-btn" onClick={onBack}>
            <img src={backIcon || '/icons/goback.svg'} alt="返回" className="back-icon" />
            {backText && <span className="back-text">{backText}</span>}
          </div>
        ))}
      </div>
      <div className="header-title">
        {title}
      </div>
      <div className="toolbar-right">
        {right}
      </div>
    </header>
  )
}

export default BusinessHeader
