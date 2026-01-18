import { useCallback, useMemo, useRef, useState } from 'react';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export type RovingListKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'Enter' | ' ' | 'Escape';

export function useRovingListNavigation({
  itemCount,
  isOpen,
  getIsItemDisabled,
  onSelectIndex,
  onClose,
  initialActiveIndex = 0,
  loop = true,
}: {
  itemCount: number;
  isOpen: boolean;
  getIsItemDisabled?: (index: number) => boolean;
  onSelectIndex?: (index: number) => void;
  onClose?: () => void;
  initialActiveIndex?: number;
  loop?: boolean;
}) {
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(() =>
    clamp(initialActiveIndex, 0, Math.max(0, itemCount - 1))
  );

  const isDisabled = useCallback(
    (idx: number) => (getIsItemDisabled ? getIsItemDisabled(idx) : false),
    [getIsItemDisabled]
  );

  const firstEnabledIndex = useCallback(() => {
    for (let i = 0; i < itemCount; i++) if (!isDisabled(i)) return i;
    return -1;
  }, [itemCount, isDisabled]);

  const lastEnabledIndex = useCallback(() => {
    for (let i = itemCount - 1; i >= 0; i--) if (!isDisabled(i)) return i;
    return -1;
  }, [itemCount, isDisabled]);

  const nextEnabledIndex = useCallback(
    (from: number, dir: 1 | -1) => {
      if (itemCount <= 0) return -1;

      // Walk at most itemCount steps to avoid infinite loops.
      let steps = 0;
      let i = from;
      while (steps < itemCount) {
        if (loop) {
          i = (i + dir + itemCount) % itemCount;
        } else {
          i = clamp(i + dir, 0, itemCount - 1);
        }
        if (!isDisabled(i)) return i;
        steps++;
        if (!loop && (i === 0 || i === itemCount - 1)) break;
      }
      return -1;
    },
    [itemCount, isDisabled, loop]
  );

  const focusItem = useCallback((idx: number) => {
    const el = itemRefs.current[idx];
    (el as HTMLElement | null)?.focus?.();
  }, []);

  const ensureValidActive = useCallback(() => {
    if (itemCount <= 0) return;
    const clamped = clamp(activeIndex, 0, itemCount - 1);
    if (!isDisabled(clamped)) {
      if (clamped !== activeIndex) setActiveIndex(clamped);
      return;
    }
    const first = firstEnabledIndex();
    if (first >= 0) setActiveIndex(first);
  }, [activeIndex, firstEnabledIndex, isDisabled, itemCount]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      if (itemCount <= 0) return;

      const k = e.key as RovingListKey;
      if (
        k !== 'ArrowDown' &&
        k !== 'ArrowUp' &&
        k !== 'Home' &&
        k !== 'End' &&
        k !== 'Enter' &&
        k !== ' ' &&
        k !== 'Escape'
      ) {
        return;
      }

      if (k === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (k === 'Home') {
        e.preventDefault();
        const idx = firstEnabledIndex();
        if (idx >= 0) {
          setActiveIndex(idx);
          focusItem(idx);
        }
        return;
      }

      if (k === 'End') {
        e.preventDefault();
        const idx = lastEnabledIndex();
        if (idx >= 0) {
          setActiveIndex(idx);
          focusItem(idx);
        }
        return;
      }

      if (k === 'ArrowDown') {
        e.preventDefault();
        const idx = nextEnabledIndex(activeIndex, 1);
        if (idx >= 0) {
          setActiveIndex(idx);
          focusItem(idx);
        }
        return;
      }

      if (k === 'ArrowUp') {
        e.preventDefault();
        const idx = nextEnabledIndex(activeIndex, -1);
        if (idx >= 0) {
          setActiveIndex(idx);
          focusItem(idx);
        }
        return;
      }

      if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        const idx = clamp(activeIndex, 0, itemCount - 1);
        if (idx >= 0 && !isDisabled(idx)) onSelectIndex?.(idx);
      }
    },
    [
      activeIndex,
      firstEnabledIndex,
      focusItem,
      isDisabled,
      isOpen,
      itemCount,
      lastEnabledIndex,
      nextEnabledIndex,
      onClose,
      onSelectIndex,
    ]
  );

  const api = useMemo(
    () => ({
      itemRefs,
      activeIndex,
      setActiveIndex,
      focusItem,
      ensureValidActive,
      onKeyDown,
      firstEnabledIndex,
    }),
    [activeIndex, ensureValidActive, firstEnabledIndex, focusItem, onKeyDown]
  );

  return api;
}

