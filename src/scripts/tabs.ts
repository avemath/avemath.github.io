// Tabs for the small figures (the Signals card, the research figures): any [data-tabs] tablist
// whose tabs name their panels with aria-controls. Click, or arrow keys, Home and End.
export function initTabs() {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((list) => {
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const select = (i: number, focus = false) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
    list.addEventListener('keydown', (e) => {
      const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined || at < 0) return;
      e.preventDefault();
      select((to + tabs.length) % tabs.length, true);
    });
  });
}
