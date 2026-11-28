import { invalidateAccess, websocketCredential } from './accessClient.js';

export function createTelemetryClient(url, handlers = {}) {
  let socket = null;
  let manuallyClosed = false;
  let retryDelay = 1000;
  let retryTimer = null;

  function connect() {
    let collectionRealtime = false;
    const key = websocketCredential(url);
    socket = key ? new WebSocket(url, 'maoc-auth') : new WebSocket(url);

    socket.onopen = () => {
      retryDelay = 1000;
      if (key) socket.send(JSON.stringify({ type: 'AUTH', key }));
      handlers.onOpen?.();
    };

    socket.onclose = (event) => {
      if (manuallyClosed) return;
      handlers.onClose?.();
      if (event.code === 4401 && key) { invalidateAccess(event.reason, key); return; }
      retryTimer = setTimeout(() => {
        connect();
        retryDelay = Math.min(retryDelay * 2, 8000);
      }, retryDelay);
    };

    socket.onerror = () => socket.close();

    socket.onmessage = (message) => {
      let data;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }
      if (data.type === 'SNAPSHOT') {
        const enabled = data.collection_realtime === true;
        const becameReady = enabled && !collectionRealtime;
        collectionRealtime = enabled;
        handlers.onSnapshot?.(data);
        if (becameReady) handlers.onCollectionReady?.();
      }
      if (data.type === 'EVENT') handlers.onEvent?.(data.event);
      if (data.type === 'COLLECTION_CHANGED' && collectionRealtime) handlers.onCollectionChanged?.(data);
      if (data.type === 'HUD_PREFERENCES_UPDATED' && Number.isSafeInteger(data.revision) && data.revision > 0) handlers.onHudPreferencesUpdated?.();
      if (data.type === 'ERROR') handlers.onServerError?.(data);
    };
  }

  connect();

  return {
    send(payload) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    close() {
      manuallyClosed = true;
      clearTimeout(retryTimer);
      socket.onclose = null;
      socket.close();
    }
  };
}