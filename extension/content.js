// content.js — 运行在网页中，可以访问页面的 DOM 和 localStorage
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getToken') {
    const token = localStorage.getItem('nav_auth_token')
    sendResponse({ token: token || null })
  }
  if (msg.action === 'getFavicon') {
    // 在页面上下文里直接获取 favicon 并转 data URL（内网也能访问）
    ;(async () => {
      try {
        let faviconUrl = ''
        const link = document.querySelector(
          'link[rel="shortcut icon"], link[rel="icon"], link[rel="apple-touch-icon"]'
        )
        if (link?.href) {
          faviconUrl = link.href
        } else {
          faviconUrl = `${location.origin}/favicon.ico`
        }
        const resp = await fetch(faviconUrl)
        if (resp.ok) {
          const blob = await resp.blob()
          if (blob.size > 0 && blob.size < 200 * 1024) {
            const reader = new FileReader()
            reader.onload = () => sendResponse({ dataUrl: reader.result || '' })
            reader.readAsDataURL(blob)
            return
          }
        }
        sendResponse({ dataUrl: '' })
      } catch (e) {
        sendResponse({ dataUrl: '' })
      }
    })()
    return true
  }
  return true
})
