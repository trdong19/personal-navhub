import { nextTick, type Ref } from 'vue'

export function useFlipSort(
  containerRef: Ref<HTMLElement | null>,
  selector = '.nav-card',
  dataKey = 'linkId'
) {
  // 最大同时执行动画的卡片数量
  const MAX_ANIMATED_CARDS = 1
  
  function recordPositions(draggingId?: string | null): Map<string, DOMRect> {
    const el = containerRef.value
    if (!el) return new Map()
    const positions = new Map<string, DOMRect>()
    const cards = el.querySelectorAll<HTMLElement>(selector)
    cards.forEach(card => {
      const id = card.dataset[dataKey]
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
      
      // 收集所有需要动画的卡片，并计算距离
      const cardsToAnimate: Array<{
        card: HTMLElement
        dx: number
        dy: number
        distance: number
      }> = []
      
      cards.forEach(card => {
        const id = card.dataset[dataKey]
        if (!id || id === draggingId) return
        const oldRect = before.get(id)
        if (!oldRect) return
        const newRect = card.getBoundingClientRect()
        const dx = oldRect.left - newRect.left
        const dy = oldRect.top - newRect.top
        
        // 忽略移动距离太小的卡片（小于5px）
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        
        cardsToAnimate.push({
          card,
          dx,
          dy,
          distance: Math.abs(dx) + Math.abs(dy)
        })
      })
      
      // 如果卡片数量很多，只动画移动距离最大的卡片
      let filteredCards = cardsToAnimate
      if (cardsToAnimate.length > MAX_ANIMATED_CARDS) {
        filteredCards = cardsToAnimate
          .sort((a, b) => b.distance - a.distance)
          .slice(0, MAX_ANIMATED_CARDS)
      }
      
      filteredCards.forEach(({ card, dx, dy }) => {
        // 取消该卡片上正在进行的动画
        const existingAnimations = card.getAnimations()
        existingAnimations.forEach(anim => {
          // 取消所有 transform 动画
          const effect = anim.effect
          if (effect && 'getKeyframes' in effect) {
            const keyframes = (effect as any).getKeyframes()
            if (keyframes && keyframes.some((kf: any) => kf.transform && kf.transform.includes('translate'))) {
              anim.cancel()
            }
          }
        })
        
        // 创建新动画
        const animation = card.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0)`, offset: 0 },
            { transform: 'translate3d(0, 0, 0)', offset: 1 }
          ],
          { 
            duration: 150,
            easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)'
          }
        )
        
        animation.onfinish = () => {
          card.style.transform = ''
        }
      })
    })
  }

  return { recordPositions, animateFlip }
}
