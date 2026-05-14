import { onUnmounted, type Ref } from 'vue'

interface UseTouchDragOptions {
  /** 卡片元素 ref */
  cardRef: Ref<HTMLElement | null>
  /** 手柄元素 ref */
  handleRef: Ref<HTMLElement | null>
  /** 拖拽开始的回调 */
  onDragStart: (id: string) => void
  /** 拖拽经过目标卡片的回调 */
  onDragOver: (targetId: string, categoryId: string) => void
  /** 拖拽离开目标卡片的回调 */
  onDragLeave?: () => void
  /** 拖拽结束的回调 */
  onDragEnd: (targetCategoryId?: string) => void
  /** 拖拽经过分类容器时的回调（用于跨分类拖拽） */
  onDragOverCategory?: (categoryId: string) => void
}

export function useTouchDrag(options: UseTouchDragOptions) {
  const { cardRef, handleRef, onDragStart, onDragOver, onDragEnd, onDragOverCategory, onDragLeave } = options

  let isDragging = false
  let clone: HTMLElement | null = null
  let currentId = ''
  let cardRect: DOMRect | null = null
  let lastOverCategoryId: string | null = null
  let wasOverCard = false

  function onTouchStart(e: TouchEvent) {
    const el = cardRef.value
    if (!el) return
    currentId = el.dataset.linkId || ''
    if (!currentId) return

    isDragging = true
    document.body.classList.add('is-dragging')

    // 触发事件通知其他组件取消长按
    window.dispatchEvent(new CustomEvent('touch-drag-start', { detail: { linkId: currentId } }))

    cardRect = el.getBoundingClientRect()
    clone = el.cloneNode(true) as HTMLElement
    clone.style.cssText = `
      position: fixed;
      left: ${cardRect.left}px;
      top: ${cardRect.top}px;
      width: ${cardRect.width}px;
      height: ${cardRect.height}px;
      z-index: 9999;
      opacity: 0.85;
      transform: rotate(2deg) scale(1.05);
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
      border-radius: 16px;
      pointer-events: none;
      transition: none;
    `
    document.body.appendChild(clone)
    el.classList.add('card-dragging')

    onDragStart(currentId)

    // 触觉反馈
    if (navigator.vibrate) navigator.vibrate(30)
  }

  function onTouchMove(e: TouchEvent) {
    if (!isDragging) return
    e.preventDefault()

    const touch = e.touches[0]
    if (clone && cardRect) {
      clone.style.left = (touch.clientX - cardRect.width / 2) + 'px'
      clone.style.top = (touch.clientY - 20) + 'px'
    }

    // 自动滚动页面
    const scrollThreshold = 80
    const scrollSpeed = 8
    if (touch.clientY < scrollThreshold) {
      window.scrollBy({ top: -scrollSpeed, behavior: 'auto' })
    } else if (touch.clientY > window.innerHeight - scrollThreshold) {
      window.scrollBy({ top: scrollSpeed, behavior: 'auto' })
    }

    // 检测手指下方的元素
    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY)
    let overCard = false
    if (elemBelow) {
      const card = elemBelow.closest<HTMLElement>('.nav-card')
      if (card && card.dataset.linkId && card.dataset.linkId !== currentId) {
        overCard = true
        const categoryEl = card.closest<HTMLElement>('[data-category-id]')
        const cardCategoryId = categoryEl?.dataset.categoryId || ''
        onDragOver(card.dataset.linkId, cardCategoryId)
      }

      // 检测分类容器（用于跨分类拖拽）
      if (onDragOverCategory) {
        const categoryEl = elemBelow.closest<HTMLElement>('[data-category-id]')
        if (categoryEl) {
          const catId = categoryEl.dataset.categoryId
          if (catId) {
            lastOverCategoryId = catId
            onDragOverCategory(catId)
          }
        }
      }
    }

    // 手指离开卡片时通知
    if (wasOverCard && !overCard && onDragLeave) {
      onDragLeave()
    }
    wasOverCard = overCard
  }

  function onTouchEnd() {
    if (!isDragging) return
    isDragging = false
    document.body.classList.remove('is-dragging')

    if (clone) {
      clone.remove()
      clone = null
    }
    cardRect = null
    cardRef.value?.classList.remove('card-dragging')

    onDragEnd(lastOverCategoryId ?? undefined)
    lastOverCategoryId = null
  }

  // 绑定到 document，这样即使手指滑出手柄也能继续拖拽
  function onDocTouchMove(e: TouchEvent) { onTouchMove(e) }
  function onDocTouchEnd() { onTouchEnd() }

  return {
    /** 手柄的 touchstart 处理，开始拖拽 */
    handleTouchStart: (e: TouchEvent) => {
      onTouchStart(e)
      document.addEventListener('touchmove', onDocTouchMove, { passive: false })
      document.addEventListener('touchend', onDocTouchEnd, { passive: true })
      document.addEventListener('touchcancel', onDocTouchEnd, { passive: true })
    },
    /** 清理所有事件监听和残留元素 */
    cleanup: () => {
      document.removeEventListener('touchmove', onDocTouchMove)
      document.removeEventListener('touchend', onDocTouchEnd)
      document.removeEventListener('touchcancel', onDocTouchEnd)
      if (clone) clone.remove()
      document.body.classList.remove('is-dragging')
    },
  }
}