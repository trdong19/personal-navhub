import { onMounted, onUnmounted, watch, type Ref, nextTick } from 'vue'
import { waapi, stagger } from 'animejs'
import type { WAAPIAnimation } from 'animejs'

export function useCardEntrance(containerRef: Ref<HTMLElement | null>, selector = '.nav-card') {
  let observer: MutationObserver | null = null

  function animateCards() {
    const el = containerRef.value
    if (!el || !(el instanceof HTMLElement)) return
    const cards = el.querySelectorAll(selector)
    if (!cards.length) return

    waapi.animate(cards, {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 350,
      delay: stagger(40),
      ease: 'outQuad',
    })
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

  return { animateCards }
}

export function useCardHover(cardRef: Ref<HTMLElement | null>) {
  let enterAnim: WAAPIAnimation | null = null
  let leaveAnim: WAAPIAnimation | null = null

  function onEnter() {
    leaveAnim?.cancel()
    enterAnim = waapi.animate(cardRef.value!, {
      transform: ['translateY(0px) scale(1)', 'translateY(-3px) scale(1.01)'],
      duration: 200,
      ease: 'outQuad',
    })
  }

  function onLeave() {
    enterAnim?.cancel()
    leaveAnim = waapi.animate(cardRef.value!, {
      transform: ['translateY(-3px) scale(1.01)', 'translateY(0px) scale(1)'],
      duration: 250,
      ease: 'outQuad',
    })
  }

  onMounted(() => {
    const el = cardRef.value
    if (!el) return
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
  })

  onUnmounted(() => {
    const el = cardRef.value
    if (!el) return
    el.removeEventListener('mouseenter', onEnter)
    el.removeEventListener('mouseleave', onLeave)
    enterAnim?.cancel()
    leaveAnim?.cancel()
  })
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

export function animateModal(el: HTMLElement, show: boolean) {
  if (show) {
    return waapi.animate(el, {
      opacity: [0, 1],
      transform: ['translateY(24px) scale(0.97)', 'translateY(0px) scale(1)'],
      duration: 280,
      ease: 'outQuad',
    })
  } else {
    return waapi.animate(el, {
      opacity: [1, 0],
      transform: ['translateY(0px) scale(1)', 'translateY(12px) scale(0.98)'],
      duration: 150,
      ease: 'inQuad',
    })
  }
}

export function animateOverlay(el: HTMLElement, show: boolean) {
  if (show) {
    return waapi.animate(el, {
      opacity: [0, 1],
      duration: 200,
      ease: 'outQuad',
    })
  } else {
    return waapi.animate(el, {
      opacity: [1, 0],
      duration: 120,
      ease: 'inQuad',
    })
  }
}

export function animateCollapse(el: HTMLElement, show: boolean) {
  if (show) {
    const targetHeight = el.scrollHeight
    el.style.overflow = 'hidden'
    el.style.height = '0px'
    el.style.opacity = '0'
    waapi.animate(el, {
      height: ['0px', `${targetHeight}px`],
      opacity: [0, 1],
      duration: 250,
      ease: 'outQuad',
    }).then(() => {
      el.style.height = ''
      el.style.overflow = ''
      return undefined
    })
  } else {
    const currentHeight = el.scrollHeight
    el.style.overflow = 'hidden'
    waapi.animate(el, {
      height: [`${currentHeight}px`, '0px'],
      opacity: [1, 0],
      duration: 180,
      ease: 'inQuad',
    }).then(() => {
      el.style.height = '0px'
      return undefined
    })
  }
}

export function animateFadeIn(el: HTMLElement, duration = 200) {
  return waapi.animate(el, {
    opacity: [0, 1],
    duration,
    ease: 'outQuad',
  })
}

export function animateFadeOut(el: HTMLElement, duration = 120) {
  return waapi.animate(el, {
    opacity: [1, 0],
    duration,
    ease: 'inQuad',
  })
}

export function animateScaleIn(el: HTMLElement, duration = 220) {
  return waapi.animate(el, {
    opacity: [0, 1],
    transform: ['scale(0.9)', 'scale(1)'],
    duration,
    ease: 'outBack',
  })
}

export function animateScaleOut(el: HTMLElement, duration = 150) {
  return waapi.animate(el, {
    opacity: [1, 0],
    transform: ['scale(1)', 'scale(0.9)'],
    duration,
    ease: 'inQuad',
  })
}
