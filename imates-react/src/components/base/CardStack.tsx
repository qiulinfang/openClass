import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import '@/components/base/CardStack.css'

export interface CardStackCard {
  id: string | number
  title: string
  [key: string]: any
}

export interface CardStackProps {
  value?: CardStackCard[]
  emptyText?: string
  swipeToDelete?: boolean
  onCardClick?: (card: CardStackCard) => void
  onCardRemove?: (id: string | number) => void
  onCardRemoveRequest?: (id: string | number) => void
  onCardAdd?: (card: CardStackCard) => void
  renderCardBody?: (card: CardStackCard) => React.ReactNode
  renderTitle?: (card: CardStackCard) => React.ReactNode
  bottomActions?: React.ReactNode
}

export interface CardStackRef {
  scrollToBottom: () => void
  handleRemove: (id: string | number, skipAnimation?: boolean) => void
  addCard: (cardData?: Partial<CardStackCard>) => CardStackCard
  handleReset: () => void
}

const CARD_HEIGHT = 400
const HEADER_VISIBLE_HEIGHT = 160

export const CardStack = forwardRef<CardStackRef, CardStackProps>(({
  value = [],
  emptyText = '无打开的标签页',
  swipeToDelete = true,
  onCardClick,
  onCardRemove,
  onCardRemoveRequest,
  onCardAdd,
  renderCardBody,
  renderTitle,
  bottomActions,
}, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string | number, HTMLDivElement>>(new Map())
  const [cards, setCards] = useState<CardStackCard[]>(value)
  const [removingIds, setRemovingIds] = useState<Set<string | number>>(new Set())
  const [rubberBandOffset, setRubberBandOffset] = useState(0)
  const [isRubberBandAnimating, setIsRubberBandAnimating] = useState(false)

  const rubberBandStartY = useRef(0)
  const rubberBandDragging = useRef(false)
  const rubberBandLocked = useRef(false)
  const rubberBandActive = useRef(false)

  const MAX_RUBBER_BAND_OFFSET = 120
  const RUBBER_BAND_DAMPING = 0.55

  useEffect(() => {
    if (value.length > 0) {
      setCards(value)
    }
  }, [value])

  const scrollToBottom = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  const handleReset = useCallback(() => {
    setCards(value)
  }, [value])

  const addCard = useCallback((cardData: Partial<CardStackCard> = {}) => {
    const newId = Date.now()
    const newCard: CardStackCard = {
      id: newId,
      title: cardData.title || `新会话 ${cards.length + 1}`,
      ...cardData,
    }
    const newCards = [newCard, ...cards]
    setCards(newCards)
    onCardAdd?.(newCard)
    scrollToBottom()
    return newCard
  }, [cards, onCardAdd, scrollToBottom])

  const requestRemove = useCallback((id: string | number) => {
    onCardRemoveRequest?.(id)
  }, [onCardRemoveRequest])

  const handleRemove = useCallback((id: string | number, skipAnimation = false) => {
    if (removingIds.has(id)) return

    const removeCard = () => {
      const newCards = cards.filter(c => c.id !== id)
      setCards(newCards)
      onCardRemove?.(id)
    }

    if (skipAnimation) {
      removeCard()
      return
    }

    const cardEl = cardRefs.current.get(id)
    if (cardEl) {
      setRemovingIds(prev => new Set(prev).add(id))
      cardEl.style.transition = 'all 0.3s ease-out'
      cardEl.style.transform = 'scale(0.9)'
      cardEl.style.opacity = '0'

      setTimeout(() => {
        removeCard()
        setRemovingIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        cardRefs.current.delete(id)
      }, 300)
    } else {
      removeCard()
    }
  }, [cards, removingIds, onCardRemove])

  useImperativeHandle(ref, () => ({
    scrollToBottom,
    handleRemove,
    addCard,
    handleReset,
  }))

  const calculateRubberBandOffset = (distance: number) => {
    const absDistance = Math.abs(distance)
    const dampedDistance = absDistance * RUBBER_BAND_DAMPING
    const normalized = (dampedDistance * MAX_RUBBER_BAND_OFFSET) / (dampedDistance + MAX_RUBBER_BAND_OFFSET)
    return normalized * Math.sign(distance)
  }

  const resetRubberBand = (withAnimation = true) => {
    if (rubberBandOffset === 0 && !isRubberBandAnimating) {
      rubberBandActive.current = false
      return
    }

    if (withAnimation) {
      setIsRubberBandAnimating(true)
    } else {
      setIsRubberBandAnimating(false)
    }

    setRubberBandOffset(0)
    rubberBandActive.current = false
  }

  const handleContainerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    rubberBandStartY.current = e.touches[0].clientY
    rubberBandDragging.current = true
    rubberBandLocked.current = false
    rubberBandActive.current = false
    setIsRubberBandAnimating(false)
  }

  const handleContainerTouchMove = (e: React.TouchEvent) => {
    if (!rubberBandDragging.current) return

    const container = scrollContainerRef.current
    if (!container) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - rubberBandStartY.current

    if (!rubberBandLocked.current) {
      if (Math.abs(deltaY) <= 6) return
      rubberBandLocked.current = true
    }

    const { scrollTop, scrollHeight, clientHeight } = container
    const isAtTop = scrollTop <= 0
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1
    const shouldPullDown = isAtTop && deltaY > 0
    const shouldPullUp = isAtBottom && deltaY < 0

    if (!shouldPullDown && !shouldPullUp) {
      if (rubberBandActive.current) {
        resetRubberBand(true)
      }
      return
    }

    rubberBandActive.current = true
    if (e.cancelable) e.preventDefault()
    setRubberBandOffset(calculateRubberBandOffset(deltaY))
  }

  const handleContainerTouchEnd = () => {
    rubberBandDragging.current = false
    rubberBandLocked.current = false
    resetRubberBand(true)
  }

  const onTouchStart = (e: React.TouchEvent, id: string | number) => {
    if (!swipeToDelete) return

    const cardEl = cardRefs.current.get(id)
    if (!cardEl) return

    const startX = e.touches[0].clientX
    const startY = e.touches[0].clientY
    let currentX = 0

    let isDirectionLocked = false
    let isHorizontalSwipe = false

    cardEl.style.transition = 'none'

    const onTouchMove = (moveEvent: TouchEvent) => {
      const moveX = moveEvent.touches[0].clientX
      const moveY = moveEvent.touches[0].clientY
      const deltaX = moveX - startX
      const deltaY = moveY - startY

      if (!isDirectionLocked) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
        if (distance > 6) {
          isDirectionLocked = true
          isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)
        } else {
          return
        }
      }

      if (!isHorizontalSwipe) return

      if (moveEvent.cancelable) moveEvent.preventDefault()

      currentX = deltaX
      const opacity = 1 - Math.min(Math.abs(currentX) / 250, 1)
      cardEl.style.transform = `translateX(${currentX}px)`
      cardEl.style.opacity = String(opacity)

      if (Math.abs(currentX) > 40) {
        cardEl.classList.add('is-dragging')
      } else {
        cardEl.classList.remove('is-dragging')
      }
    }

    const onTouchEnd = () => {
      cardEl.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      cardEl.classList.remove('is-dragging')

      if (isHorizontalSwipe && Math.abs(currentX) > 0) {
        if (Math.abs(currentX) > 100) {
          const direction = currentX > 0 ? 1 : -1
          cardEl.style.transform = `translateX(${direction * 500}px)`
          cardEl.style.opacity = '0'
          setTimeout(() => {
            handleRemove(id, true)
          }, 300)
        } else {
          cardEl.style.transform = 'translateX(0)'
          cardEl.style.opacity = '1'
        }
      }

      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }

    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
  }

  const getCardStyle = (index: number): React.CSSProperties => {
    return {
      position: 'sticky',
      top: `${index * 6}px`,
      zIndex: index,
      marginTop: index === 0 ? '0px' : `-${CARD_HEIGHT - HEADER_VISIBLE_HEIGHT + 8}px`,
      height: `${CARD_HEIGHT}px`,
      marginBottom: '28px',
      touchAction: 'pan-y'
    }
  }

  const cardsWrapperStyle: React.CSSProperties = {
    transform: `translate3d(0, ${rubberBandOffset}px, 0)`,
  }

  const setCardRef = (el: HTMLDivElement | null, id: string | number) => {
    if (el) {
      cardRefs.current.set(id, el)
    } else {
      cardRefs.current.delete(id)
    }
  }

  return (
    <div className="app-container">
      <div 
        ref={scrollContainerRef} 
        className="scroll-container"
        onTouchStart={handleContainerTouchStart}
        onTouchMove={handleContainerTouchMove}
        onTouchEnd={handleContainerTouchEnd}
      >
        {cards.length === 0 ? (
          <div className="empty-state">
            <p>{emptyText}</p>
          </div>
        ) : (
          <div 
            className={`cards-wrapper ${isRubberBandAnimating ? 'is-bouncing' : ''}`} 
            style={cardsWrapperStyle}
            onTransitionEnd={() => isRubberBandAnimating && setIsRubberBandAnimating(false)}
          >
            {cards.map((card, index) => (
              <div
                key={card.id}
                ref={(el) => el && setCardRef(el, card.id)}
                className="card-item-wrapper"
                style={getCardStyle(index)}
                onClick={() => onCardClick?.(card)}
                onTouchStart={(e) => onTouchStart(e, card.id)}
              >
                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      {renderTitle ? (
                        renderTitle(card)
                      ) : (
                        <span className="card-title">{card.title}</span>
                      )}
                    </div>
                    <button 
                      className="close-btn" 
                      onClick={(e) => {
                        e.stopPropagation()
                        requestRemove(card.id)
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="card-body">
                    {renderCardBody ? renderCardBody(card) : null}
                  </div>

                  <div className="highlight-border"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bottomActions && (
        <div className="bottom-bar">
          {bottomActions}
        </div>
      )}
    </div>
  )
})

CardStack.displayName = 'CardStack'

export default CardStack
