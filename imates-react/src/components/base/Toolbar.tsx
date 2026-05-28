import React from 'react'
import './Toolbar.css'

export interface NavItem {
  key: string
  label: string
  icon?: string
  disabled?: boolean
}

export interface ToolbarProps {
  navItems?: NavItem[]
  value?: string
  onNavClick?: (navKey: string) => void
  onChange?: (navKey: string) => void
  left?: React.ReactNode
  right?: React.ReactNode
  children?: React.ReactNode
}

export const Toolbar: React.FC<ToolbarProps> = ({
  navItems = [],
  value = '',
  onNavClick,
  onChange,
  left,
  right,
  children,
}) => {
  const handleNavClick = (navKey: string) => {
    onNavClick?.(navKey)
    onChange?.(navKey)
  }

  return (
    <div className="app-header">
      <div className="toolbar-left">{left}</div>

      <div className="app-toolbar">
        <div className="toolbar-center">
          <div className="function-nav">
            {navItems.map((navItem) => (
              <div
                key={navItem.key}
                className={`nav-item ${navItem.key === value ? 'active' : ''} ${navItem.disabled ? 'disabled' : ''}`}
                onClick={() => !navItem.disabled && handleNavClick(navItem.key)}
              >
                {navItem.icon && navItem.key === value && (
                  <img src={navItem.icon} alt={navItem.label} className="nav-icon" />
                )}
                <span>{navItem.label}</span>
              </div>
            ))}
          </div>

          <div className="toolbar-right">{right}</div>
        </div>
      </div>

      {children}
    </div>
  )
}

export default Toolbar
