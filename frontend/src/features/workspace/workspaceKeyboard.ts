/** Global shortcuts must not steal input, native control behavior, or IME composition. */
export function isWorkspaceShortcut(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return false;
  return !(
    event.target instanceof Element &&
    event.target.closest(
      'input, textarea, select, button, a, [contenteditable], [role="dialog"], [role="alertdialog"], [role="combobox"], [role="listbox"], [role="menu"], [role="slider"], [role="spinbutton"], [role="checkbox"], [role="switch"]',
    )
  );
}
