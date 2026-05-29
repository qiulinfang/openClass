import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import '@/components/base/DatePicker.css'

export interface DatePickerProps {
  value?: string | null
  placeholder?: string
  onChange?: (value: string | null) => void
}

interface CalendarCell {
  key: string
  day: number
  date: Date
  inCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  placeholder = '请选择日期',
  onChange,
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())

  const parsedSelected = useMemo(() => {
    if (!value) return null
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value)
    if (!m) return null
    const y = Number(m[1])
    const mon = Number(m[2]) - 1
    const d = Number(m[3])
    const date = new Date(y, mon, d)
    return isNaN(date.getTime()) ? null : date
  }, [value])

  useEffect(() => {
    if (parsedSelected) {
      setCurrentYear(parsedSelected.getFullYear())
      setCurrentMonth(parsedSelected.getMonth())
    }
  }, [parsedSelected])

  const displayText = value || placeholder

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  const calendarCells = useMemo((): CalendarCell[] => {
    const year = currentYear
    const month = currentMonth

    const firstOfMonth = new Date(year, month, 1)
    const firstWeekday = firstOfMonth.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate()

    const cells: CalendarCell[] = []

    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const date = new Date(prevYear, prevMonth, day)
      cells.push(makeCell(date, false))
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      cells.push(makeCell(date, true))
    }

    const nextMonth = (month + 1) % 12
    const nextYear = month === 11 ? year + 1 : year
    while (cells.length < 42) {
      const day = cells.length - (firstWeekday + daysInMonth) + 1
      const date = new Date(nextYear, nextMonth, day)
      cells.push(makeCell(date, false))
    }

    return cells
  }, [currentYear, currentMonth])

  const makeCell = (date: Date, inCurrentMonth: boolean): CalendarCell => {
    const y = date.getFullYear()
    const m = date.getMonth()
    const d = date.getDate()

    const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate()

    const isSelected = !!(
      parsedSelected &&
      parsedSelected.getFullYear() === y &&
      parsedSelected.getMonth() === m &&
      parsedSelected.getDate() === d
    )

    return {
      key: `${y}-${m + 1}-${d}`,
      day: d,
      date,
      inCurrentMonth,
      isToday,
      isSelected,
    }
  }

  const togglePanel = () => setIsOpen(!isOpen)

  const selectDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const newValue = `${y}-${m}-${d}`
    onChange?.(newValue)
    setIsOpen(false)
  }

  const selectToday = () => selectDate(today)

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [handleClickOutside])

  return (
    <div className="common-date-picker" ref={rootRef}>
      <button className="date-trigger" type="button" onClick={togglePanel}>
        <span className={`date-text ${!value ? 'date-text--placeholder' : ''}`}>
          {displayText}
        </span>
        <span className={`date-icon-wrapper ${isOpen ? 'date-icon--open' : ''}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="date-panel">
          <div className="date-panel-header">
            <button className="nav-btn" type="button" onClick={prevMonth}>‹</button>
            <div className="month-year">
              <span className="month-btn">{currentMonth + 1}月</span>
              <span className="year-btn">{currentYear}</span>
            </div>
            <button className="nav-btn" type="button" onClick={nextMonth}>›</button>
          </div>
          <div className="date-panel-week">
            {weekDays.map((d) => (
              <span key={d} className="week-cell">{d}</span>
            ))}
          </div>
          <div className="date-panel-body">
            {calendarCells.map((cell) => (
              <button
                key={cell.key}
                className={`date-cell ${!cell.inCurrentMonth ? 'date-cell--other' : ''} ${cell.isToday ? 'date-cell--today' : ''} ${cell.isSelected ? 'date-cell--selected' : ''}`}
                type="button"
                onClick={() => selectDate(cell.date)}
              >
                {cell.day}
              </button>
            ))}
          </div>
          <div className="date-panel-footer">
            <button className="today-btn" type="button" onClick={selectToday}>今天</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
