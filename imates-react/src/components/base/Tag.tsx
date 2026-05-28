import React, { useMemo } from 'react'
import './Tag.css'

export interface TagProps {
  text: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  dot?: boolean
  variant?: 'solid' | 'text'
  type?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' | 'primary'
  color?: string
  bgColor?: string
  borderColor?: string
}

const colorMap: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  red: { color: '#ff6767', bgColor: '#fff3f3', borderColor: '#ffabab' },
  orange: { color: '#ff8c00', bgColor: '#fff2d4', borderColor: '#ffdd8d' },
  yellow: { color: '#eab308', bgColor: '#fefce8', borderColor: '#fef08a' },
  green: { color: '#00bc32', bgColor: '#e0f7e6', borderColor: '#b1ebc0' },
  blue: { color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
  purple: { color: '#8b5cf6', bgColor: '#f5f3ff', borderColor: '#ddd6fe' },
  gray: { color: '#6b7280', bgColor: '#f9fafb', borderColor: '#e5e7eb' },
  primary: { color: '#0f002e', bgColor: '#f0f0f5', borderColor: '#d1d1db' },
}

export const Tag: React.FC<TagProps> = ({
  text,
  size = 'md',
  dot = false,
  variant = 'solid',
  type = 'gray',
  color,
  bgColor,
  borderColor,
}) => {
  const tagStyle = useMemo(() => {
    const colorConfig = colorMap[type] || colorMap.gray
    const isText = variant === 'text'

    const finalBorderColor = borderColor || (isText ? '#e5e7eb' : colorConfig.borderColor)
    const finalBgColor = bgColor || (isText ? '#ffffff' : colorConfig.bgColor)

    return {
      color: color || colorConfig.color,
      backgroundColor: finalBgColor,
      border: `1px solid ${finalBorderColor}`,
    }
  }, [type, variant, color, bgColor, borderColor])

  const dotStyle = useMemo(() => {
    const colorConfig = colorMap[type] || colorMap.gray
    return {
      backgroundColor: color || colorConfig.color,
    }
  }, [type, color])

  return (
    <span className={`status-tag size-${size} variant-${variant}`} style={tagStyle}>
      {dot && <span className="status-dot" style={dotStyle} />}
      {text}
    </span>
  )
}

export default Tag
