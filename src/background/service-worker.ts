// Background Service Worker for Reels Master
console.log('Reels Master: Background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Reels Master: Extension installed');
});
