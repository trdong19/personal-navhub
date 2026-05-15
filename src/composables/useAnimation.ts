import { onMounted, onUnmounted, type Ref, nextTick } from 'vue'
import { waapi, stagger } from 'animejs'

export function useCardEntrance(containerRef: Ref<HTMLElement | null>, selector = '.nav-card') {
  let observer: MutationObserver | null = null
  let paused = false

  function animateCards() {
    if (paused) return
    const el = containerRef.value
    if (!el || !(el instanceof HTMLElement)) return
    const allCards = el.querySelectorAll(selector)
    if (!allCards.length) return

    const cards = Array.from(allCards, c => c as HTMLElement).filter(c => !c.classList.contains('no-url'))
    const noUrlCards = Array.from(allCards, c => c as HTMLElement).filter(c => c.classList.contains('no-url'))

    if (cards.length) {
      waapi.animate(cards, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 350,
        delay: stagger(40),
        ease: 'outQuad',
      })
    }

    if (noUrlCards.length) {
      waapi.animate(noUrlCards, {
        translateY: [16, 0],
        duration: 350,
        delay: stagger(40),
        ease: 'outQuad',
      })
    }
  }

  function setupObserver() {
    observer?.disconnect()
    const el = containerRef.value
    if (!el || !(el instanceof HTMLElement)) return
    observer = new MutationObserver(() => {
      nextTick(animateCards)
    })
    observer.observe(el, { childList: true, subtree: true })
  }

  onMounted(() => {
    nextTick(() => {
      animateCards()
      setupObserver()
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  function pause() { paused = true }
  function resume() {
    paused = false
    observer?.disconnect()
    setupObserver()
  }

  return { animateCards, pause, resume }
}

export function animateDropdown(el: HTMLElement, show: boolean) {
  if (show) {
    return waapi.animate(el, {
      opacity: [0, 1],
      transform: ['translateY(-8px) scale(0.96)', 'translateY(0px) scale(1)'],
      duration: 200,
      ease: 'outQuad',
    })
  } else {
    return waapi.animate(el, {
      opacity: [1, 0],
      transform: ['translateY(0px) scale(1)', 'translateY(-4px) scale(0.98)'],
      duration: 120,
      ease: 'inQuad',
    })
  }
}
