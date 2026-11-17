import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Lightweight, zero-dependency pointer-event drag & drop reordering hook.
 * Works on both iOS/Android touchscreens (when handle has touchAction: 'none') and desktop mice.
 */
export function useDragReorder(itemCount, onReorder) {
  const [dragIndex, setDragIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const itemElsRef = useRef([]);
  const rectsRef = useRef([]);
  const startYRef = useRef(0);
  const dragIndexRef = useRef(null);
  const hoverIndexRef = useRef(null);
  const gapRef = useRef(12);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const setItemRef = useCallback((index) => (el) => {
    itemElsRef.current[index] = el;
  }, []);

  useEffect(() => {
    if (dragIndex === null) return;

    const handlePointerMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const dy = e.clientY - startYRef.current;
      setDragOffsetY(dy);

      const rects = rectsRef.current;
      const from = dragIndexRef.current;
      const fromRect = rects[from];
      if (!fromRect) return;

      const draggedCenterY = fromRect.top + fromRect.height / 2 + dy;
      let nextHover = from;

      if (dy > 0) {
        for (let i = from + 1; i < rects.length; i++) {
          const r = rects[i];
          if (r && draggedCenterY > r.top + r.height / 2) {
            nextHover = i;
          }
        }
      } else if (dy < 0) {
        for (let i = from - 1; i >= 0; i--) {
          const r = rects[i];
          if (r && draggedCenterY < r.top + r.height / 2) {
            nextHover = i;
          }
        }
      }

      if (nextHover !== hoverIndexRef.current) {
        hoverIndexRef.current = nextHover;
        setHoverIndex(nextHover);
      }
    };

    const finishDrag = () => {
      const from = dragIndexRef.current;
      const to = hoverIndexRef.current;

      dragIndexRef.current = null;
      hoverIndexRef.current = null;
      setDragIndex(null);
      setHoverIndex(null);
      setDragOffsetY(0);

      if (from !== null && to !== null && from !== to) {
        onReorderRef.current(from, to);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [dragIndex]);

  const getHandleProps = useCallback(
    (index) => ({
      onPointerDown: (e) => {
        if (itemCount < 2) return;
        e.stopPropagation();
        const rects = [];
        for (let i = 0; i < itemCount; i++) {
          const el = itemElsRef.current[i];
          rects.push(el ? el.getBoundingClientRect() : null);
        }
        rectsRef.current = rects;
        if (rects[0] && rects[1]) {
          gapRef.current = Math.max(0, rects[1].top - rects[0].bottom);
        } else {
          gapRef.current = 12;
        }

        startYRef.current = e.clientY;
        dragIndexRef.current = index;
        hoverIndexRef.current = index;
        setDragIndex(index);
        setHoverIndex(index);
        setDragOffsetY(0);
      },
      style: { touchAction: 'none' },
    }),
    [itemCount]
  );

  const getItemStyle = useCallback(
    (index) => {
      if (dragIndex === null) return undefined;

      if (index === dragIndex) {
        return {
          transform: `translateY(${dragOffsetY}px) scale(1.015)`,
          zIndex: 30,
          position: 'relative',
          boxShadow: '0 12px 30px -8px rgba(0, 0, 0, 0.22)',
        };
      }

      const fromRect = rectsRef.current[dragIndex];
      const shiftSize = (fromRect ? fromRect.height : 60) + gapRef.current;
      let shift = 0;

      if (dragIndex < hoverIndex && index > dragIndex && index <= hoverIndex) {
        shift = -shiftSize;
      } else if (dragIndex > hoverIndex && index >= hoverIndex && index < dragIndex) {
        shift = shiftSize;
      }

      return {
        transform: `translateY(${shift}px)`,
        transition: 'transform 180ms cubic-bezier(0.2, 0, 0, 1)',
      };
    },
    [dragIndex, hoverIndex, dragOffsetY]
  );

  return {
    dragIndex,
    setItemRef,
    getHandleProps,
    getItemStyle,
  };
}
