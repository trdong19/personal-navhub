// content.js — 运行在网页中，可以访问页面的 localStorage
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getToken') {
    const token = localStorage.getItem('nav_auth_token')
    sendResponse({ token: token || null })
  }
  return true
})
