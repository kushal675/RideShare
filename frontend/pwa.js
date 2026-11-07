// Register only in secure contexts; the website remains usable if registration fails.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('Could not register offline support:', error);
    });
  });
}
