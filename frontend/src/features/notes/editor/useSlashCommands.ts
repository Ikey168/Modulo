import { useState, useCallback, RefObject } from 'react';

export interface SlashMenuState {
  open: boolean;
  query: string;
  position: { top: number; left: number };
  triggerStart: number;
}

const CLOSED: SlashMenuState = { open: false, query: '', position: { top: 0, left: 0 }, triggerStart: -1 };

export function useSlashCommands(textareaRef: RefObject<HTMLTextAreaElement>) {
  const [menuState, setMenuState] = useState<SlashMenuState>(CLOSED);

  const handleKeyUp = useCallback((_e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const textBefore = ta.value.slice(0, cursor);

    // Find last "/" that's at start of word
    const slashMatch = textBefore.match(/(^|[\s\n])\/(\S*)$/);
    if (slashMatch) {
      const query = slashMatch[2];
      const rect = getCaretCoordinates(ta, cursor - query.length - 1);
      setMenuState({ open: true, query, position: { top: rect.top + 24, left: rect.left }, triggerStart: cursor - query.length - 1 });
    } else if (menuState.open) {
      setMenuState(CLOSED);
    }
  }, [menuState.open, textareaRef]);

  const applyCommand = useCallback((insert: string) => {
    const ta = textareaRef.current;
    if (!ta || menuState.triggerStart < 0) { setMenuState(CLOSED); return; }

    const cursor = ta.selectionStart;
    const before = ta.value.slice(0, menuState.triggerStart);
    const after  = ta.value.slice(cursor);
    const newVal = before + insert + after;

    // Fire a native input event so React state stays in sync
    const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeInputSetter) {
      nativeInputSetter.call(ta, newVal);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const newCursor = menuState.triggerStart + insert.length;
    ta.setSelectionRange(newCursor, newCursor);
    ta.focus();
    setMenuState(CLOSED);
  }, [menuState, textareaRef]);

  const closeMenu = useCallback(() => setMenuState(CLOSED), []);

  return { menuState, handleKeyUp, applyCommand, closeMenu };
}

// Approximate caret position using a hidden mirror div
function getCaretCoordinates(element: HTMLTextAreaElement, position: number): { top: number; left: number } {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  const mirror = document.createElement('div');
  mirror.style.cssText = [
    'position:absolute', 'visibility:hidden', 'white-space:pre-wrap', 'word-wrap:break-word',
    `font:${style.font}`, `padding:${style.padding}`, `border:${style.border}`,
    `width:${element.offsetWidth}px`,
  ].join(';');

  const textBefore = element.value.slice(0, position);
  mirror.textContent = textBefore;
  const span = document.createElement('span');
  span.textContent = '|';
  mirror.appendChild(span);
  document.body.appendChild(mirror);

  const spanRect = span.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  document.body.removeChild(mirror);

  return {
    top: rect.top + (spanRect.top - mirrorRect.top) + element.scrollTop + window.scrollY,
    left: rect.left + (spanRect.left - mirrorRect.left),
  };
}
