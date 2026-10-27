import { useEffect, useRef } from 'react';
import { GripVertical } from 'lucide-react';

export function QueueDragHandle({ id, title, onMove }: { id: string; title: string; onMove: (id: string, delta: number) => void }) {
  const drag = useRef<{ row: HTMLElement; scroll: HTMLElement; rows: HTMLElement[]; centers: number[]; from: number; to: number; y: number; scrollTop: number } | null>(null);
  const announcement = useRef<HTMLSpanElement>(null);
  function reset() {
    const state = drag.current;
    if (!state) return;
    state.row.style.transform = '';
    delete state.row.dataset.queueDragging;
    state.rows.forEach(row => delete row.dataset.queueDrop);
    drag.current = null;
  }
  useEffect(() => () => reset(), []);
  return <><button type="button" className="queue-drag-handle" aria-label={`Reorder ${title}`} aria-description="Drag to reorder, or use Up and Down arrow keys" title="Drag to reorder, or use Up and Down arrow keys"
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      const row = event.currentTarget.closest<HTMLElement>('[data-queue-entry]');
      const scroll = row?.closest<HTMLElement>('[data-queue-list]');
      if (!row || !scroll) return;
      event.preventDefault(); event.stopPropagation();
      const rows = [...scroll.querySelectorAll<HTMLElement>('[data-queue-entry]')];
      const from = rows.indexOf(row);
      drag.current = { row, scroll, rows, centers: rows.map(item => { const r = item.getBoundingClientRect(); return r.y + r.height / 2; }), from, to: from, y: event.clientY, scrollTop: scroll.scrollTop };
      row.dataset.queueDragging = 'true';
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const state = drag.current;
      if (!state) return;
      event.stopPropagation();
      const bounds = state.scroll.getBoundingClientRect();
      if (event.clientY < bounds.top + 48) state.scroll.scrollTop -= 16;
      else if (event.clientY > bounds.bottom - 48) state.scroll.scrollTop += 16;
      const scrollDelta = state.scroll.scrollTop - state.scrollTop;
      state.row.style.transform = `translateY(${event.clientY - state.y + scrollDelta}px)`;
      const y = event.clientY + scrollDelta;
      const to = state.centers.reduce((best, center, index) => Math.abs(center - y) < Math.abs(state.centers[best] - y) ? index : best, 0);
      if (to !== state.to) {
        delete state.rows[state.to].dataset.queueDrop;
        state.to = to;
        if (to !== state.from) state.rows[to].dataset.queueDrop = 'true';
      }
    }}
    onPointerUp={event => {
      const state = drag.current;
      if (!state) return;
      event.stopPropagation();
      reset();
      if (state.to !== state.from) {
        onMove(id, state.to - state.from);
        if (announcement.current) announcement.current.textContent = `${title} moved to position ${state.to + 1} in Up next`;
      }
    }}
    onPointerCancel={reset} onLostPointerCapture={reset}
    onClick={event => event.stopPropagation()}
    onKeyDown={event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      onMove(id, event.key === 'ArrowUp' ? -1 : 1);
      if (announcement.current) announcement.current.textContent = `${title} moved ${event.key === 'ArrowUp' ? 'up' : 'down'}`;
    }}><GripVertical size={20} /></button><span ref={announcement} className="sr-only" role="status" /></>;
}
