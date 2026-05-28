import React, { useMemo } from 'react'
import './DropdownMenu.css'

export interface ActionItem {
  key: string
  label: string
  icon?: string
  iconClass?: string
  iconName?: string
  iconColor?: string
  iconSize?: string
  iconSvgType?: 'multi-select'
  loading?: boolean
  disabled?: boolean
  visible?: boolean
  onClick?: () => void
}

export interface DropdownMenuProps {
  items: ActionItem[]
  extra?: React.ReactNode
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  items,
  extra,
}) => {
  const itemsToShow = useMemo(() => 
    items.filter((item) => item.visible ?? true), 
    [items]
  )

  const handleItemClick = (item: ActionItem) => {
    if (item.disabled || item.loading) return
    item.onClick?.()
  }

  const renderIcon = (item: ActionItem) => {
    if (item.icon) {
      return (
        <img
          src={item.icon}
          alt={item.label}
          width={20}
          height={20}
          className={item.iconClass}
        />
      )
    }

    if (item.iconName) {
      return (
        <span 
          className="quasar-icon" 
          style={{ fontSize: item.iconSize || '20px', color: item.iconColor || '#666' }}
        >
          {item.iconName}
        </span>
      )
    }

    if (item.iconSvgType === 'multi-select') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            fill="#9792ac"
          />
        </svg>
      )
    }

    return null
  }

  return (
    <div>
      {itemsToShow.map((item) => (
        <div
          key={item.key}
          className={`more-menu-item-row ${item.loading ? 'is-loading' : ''} ${item.disabled ? 'is-disabled' : ''}`}
          onClick={() => handleItemClick(item)}
        >
          {renderIcon(item)}
          <div>{item.label}</div>
        </div>
      ))}
      {extra}
    </div>
  )
}

export default DropdownMenu
