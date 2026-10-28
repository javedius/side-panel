// Runs in the page world before the site's scripts. Keeps the site's own Media Session
// callbacks available to explicit player actions; does not send data or change playback.
(() => {
  if (!navigator.mediaSession || globalThis.__spaceMediaSessionV1) return;
  const handlers = new Map();
  const original = navigator.mediaSession.setActionHandler;
  try {
    navigator.mediaSession.setActionHandler = function(action, handler) {
      const result = original.call(this, action, handler);
      if (this === navigator.mediaSession) {
        if (typeof handler === 'function') handlers.set(action, handler);
        else handlers.delete(action);
      }
      return result;
    };
    Object.defineProperty(globalThis, '__spaceMediaSessionV1', { value: handlers });
  } catch { /* Direct audio/video controls still work when the method is locked. */ }
})();
