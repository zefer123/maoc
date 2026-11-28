import { useEffect } from 'react';

export default function useRealmParallax(shellRef, layerRef, enabled) {
  useEffect(() => {
    if (!enabled) return;
    const shell = shellRef.current;
    const layer = layerRef.current;
    let frame = 0, point, x = 0, y = 0;
    const render = () => {
      frame = 0;
      const bounds = shell.getBoundingClientRect();
      const axis = (value, start, size) => size ? Math.max(-1, Math.min(1, (value - start) * 2 / size - 1)) : 0;
      const targetX = point ? 26 * axis(point.x, bounds.left, bounds.width) : 0;
      const targetY = point ? 18 * axis(point.y, bounds.top, bounds.height) : 0;
      const ease = (value, target) => Math.abs(target - value) < .08 ? target : value + (target - value) * .18;
      x = ease(x, targetX); y = ease(y, targetY);
      layer.style.setProperty('--px', `${x.toFixed(2)}px`);
      layer.style.setProperty('--py', `${y.toFixed(2)}px`);
      if (x !== targetX || y !== targetY) frame = requestAnimationFrame(render);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    const move = (event) => { if (event.pointerType === 'mouse' && !event.buttons) { point = { x: event.clientX, y: event.clientY }; schedule(); } };
    const reset = () => { point = null; schedule(); };
    shell.addEventListener('pointermove', move, { passive: true });
    shell.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    return () => {
      cancelAnimationFrame(frame);
      shell.removeEventListener('pointermove', move);
      shell.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      layer.style.removeProperty('--px'); layer.style.removeProperty('--py');
    };
  }, [shellRef, layerRef, enabled]);
}