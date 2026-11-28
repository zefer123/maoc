import { useCallback, useEffect, useRef, useState } from 'react';
import { HUD_DEFAULTS } from '../lib/hudPreferenceSchema.js';
import { cacheHud, requestHud, readHudCache, cacheOperatorName, readOperatorName } from '../lib/hudPreferences.js';

export default function useHudPreferences() {
  const [data, setData] = useState(() => readHudCache() || HUD_DEFAULTS);
  const [remote, setRemote] = useState(null);
  const [status, setStatus] = useState('checking');
  const [operatorName, setName] = useState(readOperatorName);
  const transport = useRef(null);
  const latestRead = useRef(0);
  const writing = useRef(false);
  const refresh = useCallback(async () => {
    const signal = transport.current?.signal;
    if (!signal || signal.aborted || writing.current) return;
    const ticket = ++latestRead.current;
    try {
      const next = await requestHud(null, signal);
      if (signal.aborted || ticket !== latestRead.current) return;
      setRemote(next); setData(next.data); cacheHud(next.data); setStatus('synced');
    } catch {
      if (!signal.aborted && ticket === latestRead.current) { setRemote(null); setStatus('local'); }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController(); transport.current = controller;
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);

  const save = async (next, revision) => {
    const signal = transport.current?.signal;
    if (!signal || signal.aborted || writing.current) return 'busy';
    if (revision === null) { setData(next); cacheHud(next); return 'local'; }
    writing.current = true; ++latestRead.current;
    let result = 'unavailable';
    try {
      const saved = await requestHud({ revision, data: next }, signal);
      if (!signal.aborted) {
        if (saved.conflict) result = 'conflict';
        else { setData(saved.data); setRemote(saved); cacheHud(saved.data); setStatus('synced'); result = 'saved'; }
      }
    } catch {
      if (!signal.aborted) { setRemote(null); setStatus('local'); }
    } finally {
      writing.current = false;
      if (!signal.aborted) void refresh();
    }
    return result;
  };
  const saveName = (value) => { const name = value.trim().slice(0, 48); cacheOperatorName(name); setName(name); };
  return { data, remote, status, refresh, save, operatorName, saveName };
}