import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import './VirtualScroll.css'

export interface VirtualScrollProps {
  maxDrag?: number
  dampingFactor?: number
  enableRefresh?: boolean
  refreshThreshold?: number
  enableLoadMore?: boolean
  loadMoreThreshold?: number
  enableLoadTop?: boolean
  loadTopThreshold?: number
  loading?: boolean
  onRefresh?: () => void
  onLoadMore?: () => void
  onLoadTop?: () => void
  children?: React.ReactNode
  footer?: React.ReactNode
}

export interface VirtualScrollRef {
  finishRefresh: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement>
}

export const VirtualScroll = forwardRef<VirtualScrollRef, VirtualScrollProps>(({
  maxDrag = 200,
  dampingFactor = 0.6,
  enableRefresh = false,
  refreshThreshold = 100,
  enableLoadMore = false,
  loadMoreThreshold = 50,
  enableLoadTop = false,
  loadTopThreshold = 50,
  loading = false,
  onRefresh,
  onLoadMore,
  onLoadTop,
  children,
  footer,
}, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullProgress, setPullProgress] = useState(0)

  const startY = useRef(0)
  const currentTranslateY = useRef(0)
  const isDragging = useRef(false)
  const isRefreshingRef = useRef(false)

  const refreshText = enableRefresh
    ? isRefreshingRef.current
      ? '正在刷新...'
      : currentTranslateY.current > refreshThreshold
        ? '释放刷新'
        : '下拉刷新'
    : ''

  const calculateDamping = useCallback((distance: number) => {
    const screenHeight = window.innerHeight
    const damping = (1 - Math.exp(-Math.abs(distance) / (screenHeight * dampingFactor))) * maxDrag
    return damping * (distance > 0 ? 1 : -1)
  }, [dampingFactor, maxDrag])

  const finishRefresh = useCallback(() => {
    setIsRefreshing(false)
    isRefreshingRef.current = false
    currentTranslateY.current = 0
    setPullProgress(0)
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = 'translate3d(0, 0, 0)'
    }
  }, [])

  useImperativeHandle(ref, () => ({
    finishRefresh,
    scrollContainerRef,
  }))

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isRefreshingRef.current || loading) return

    const target = e.currentTarget
    const { scrollTop, clientHeight, scrollHeight } = target

    if (enableLoadTop && scrollTop <= loadTopThreshold) {
      onLoadTop?.()
    }

    if (enableLoadMore) {
      const distanceToBottom = scrollHeight - scrollTop - clientHeight
      if (distanceToBottom <= loadMoreThreshold + 1) {
        onLoadMore?.()
      }
    }
  }, [loading, enableLoadTop, loadTopThreshold, enableLoadMore, loadMoreThreshold, onLoadTop, onLoadMore])

  const startDrag = useCallback((y: number) => {
    if (isRefreshingRef.current) return
    isDragging.current = true
    startY.current = y
    if (wrapperRef.current) {
      wrapperRef.current.classList.remove('spring-back')
    }
  }, [])

  const moveDrag = useCallback((y: number, e: TouchEvent | MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current || !wrapperRef.current) return
    if (isRefreshingRef.current) return

    const container = scrollContainerRef.current
    const deltaY = y - startY.current
    const { scrollTop, scrollHeight, clientHeight } = container

    const isPullingDown = scrollTop <= 0 && deltaY > 0
    const isPullingUp = scrollTop + clientHeight >= scrollHeight - 1 && deltaY < 0 && !loading

    if (isPullingDown || isPullingUp) {
      if ('cancelable' in e && e.cancelable) e.preventDefault()
      currentTranslateY.current = calculateDamping(deltaY)
      wrapperRef.current.style.transform = `translate3d(0, ${currentTranslateY.current}px, 0)`

      if (enableRefresh && isPullingDown) {
        setPullProgress(Math.min(currentTranslateY.current / refreshThreshold, 1))
      }
    } else {
      currentTranslateY.current = 0
      setPullProgress(0)
      wrapperRef.current.style.transform = 'translate3d(0, 0, 0)'
      startY.current = y
    }
  }, [loading, enableRefresh, refreshThreshold, calculateDamping])

  const endDrag = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    setPullProgress(0)

    if (!wrapperRef.current) return

    if (enableRefresh && currentTranslateY.current > refreshThreshold && !isRefreshingRef.current) {
      setIsRefreshing(true)
      isRefreshingRef.current = true
      wrapperRef.current.classList.add('spring-back')
      wrapperRef.current.style.transform = `translate3d(0, ${refreshThreshold}px, 0)`
      onRefresh?.()
    } else if (currentTranslateY.current !== 0) {
      wrapperRef.current.classList.add('spring-back')
      wrapperRef.current.style.transform = 'translate3d(0, 0, 0)'
      currentTranslateY.current = 0
    }
  }, [enableRefresh, refreshThreshold, onRefresh])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startDrag(e.touches[0].clientY)
  }, [startDrag])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    moveDrag(e.touches[0].clientY, e.nativeEvent)
  }, [moveDrag])

  const handleTouchEnd = useCallback(() => {
    endDrag()
  }, [endDrag])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startDrag(e.clientY)
  }, [startDrag])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        moveDrag(e.clientY, e)
      }
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        endDrag()
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [moveDrag, endDrag])

  return (
    <div
      ref={scrollContainerRef}
      className="rubber-band-scroll-view no-scrollbar"
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      <div ref={wrapperRef} className="content-wrapper">
        {enableRefresh && (
          <div className="refresh-indicator">
            <div className="indicator-content">
              {isRefreshing ? (
                <svg className="icon spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg
                  className="icon arrow"
                  style={{ transform: `rotate(${pullProgress * 180}deg)` }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
              )}
              <span className="text">{refreshText}</span>
            </div>
          </div>
        )}

        {children}

        <div className="list-footer">
          {footer || (loading && (
            <div className="loading-more">
              <svg className="icon spin small" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>正在加载...</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

VirtualScroll.displayName = 'VirtualScroll'

export default VirtualScroll
