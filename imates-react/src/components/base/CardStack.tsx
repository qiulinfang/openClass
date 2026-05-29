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
}

export interface CardStackRef {
  scrollToBottom: () => void
  handleRemove: (id: string | number, skipAnimation?: boolean) => void
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
  renderCardBody,
  renderTitle,
}, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string | number, HTMLDivElement>>(new Map())
  const [cards, setCards] = useState<CardStackCard[]>(value)
  const [removingIds, setRemovingIds] = useState<Set<string | number>>(new Set())
  const [rubberBandOffset, setRubberBandOffset] = useState(0)
  const [isRubberBandAnimating, setIsRubberBandAnimating] = useState(false)

  const rubberBandStartY = useRef(0)
  const rubberBandDragging = useRef(false)

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
  }))

  const getCardStyle = (index: number): React.CSSProperties => {
    return {
      zIndex: cards.length - index,
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
      <div ref={scrollContainerRef} className="scroll-container">
        {cards.length === 0 ? (
          <div className="empty-state">
            <p>{emptyText}</p>
          </div>
        ) : (
          <div 
            className={`cards-wrapper ${isRubberBandAnimating ? 'is-bouncing' : ''}`} 
            style={cardsWrapperStyle}
          >
            {cards.map((card, index) => (
              <div
                key={card.id}
                ref={(el) => el && setCardRef(el, card.id)}
                className="card-item-wrapper"
                style={getCardStyle(index)}
                onClick={() => onCardClick?.(card)}
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
    </div>
  )
})

CardStack.displayName = 'CardStack'

export default CardStack
