import { nextTick, type Ref } from 'vue'

export function useFlipSort(
  containerRef: Ref<HTMLElement | null>,
  selector = '.nav-card'
) {
  function recordPositions(draggingId?: string | null): Map<string, DOMRect> {
    const el = containerRef.value
    if (!el) return new Map()
    const positions = new Map<string, DOMRect>()
    const cards = el.querySelectorAll<HTMLElement>(selector)
    cards.forEach(card => {
      const id = card.dataset.linkId
      if (id && id !== draggingId) {
        positions.set(id, card.getBoundingClientRect())
      }
    })
    return positions
  }

  function animateFlip(before: Map<string, DOMRect>, draggingId?: string | null) {
    nextTick(() => {
      const el = containerRef.value
      if (!el) return
      const cards = el.querySelectorAll<HTMLElement>(selector)
      cards.forEach(card => {
        const id = card.dataset.linkId
        if (!id || id === draggingId) return
        const oldRect = before.get(id)
        if (!oldRect) return
        const newRect = card.getBoundingClientRect()
        const dx = oldRect.left - newRect.left
        const dy = oldRect.top - newRect.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        card.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 250, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }
        )
      })
    })
  }

  return { recordPositions, animateFlip }
}
