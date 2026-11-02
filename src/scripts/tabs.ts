// Tabs for the small figures (the Signals card, the research figures): any [data-tabs] tablist
// whose tabs name their panels with aria-controls. Click, or arrow keys, Home and End.
/** Links that open a figure's view: [data-tab-target] names the tab to select. The link's own
 *  href (the figure's anchor) still works without script. */
function initTabLinks() {
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLAnchorElement>('[data-tab-target]');
    if (!link) return;
    const tab = document.getElementById(link.dataset.tabTarget!);
    if (!tab) return;
    e.preventDefault();
    tab.click();
    tab.closest<HTMLElement>('[data-fc], .mini, figure')?.scrollIntoView({ block: 'start' });
    tab.focus({ preventScroll: true });
  });
}

/** A hash that names a tab panel (/#rampage-drawing) opens that tab on load. */
function openFromHash() {
  const panel = location.hash && document.getElementById(location.hash.slice(1));
  if (!panel || panel.getAttribute('role') !== 'tabpanel') return;
  const tab = document.querySelector<HTMLElement>(`[role="tab"][aria-controls="${panel.id}"]`);
  if (!tab) return;
  tab.click();
  tab.closest<HTMLElement>('[data-fc], .mini, figure')?.scrollIntoView({ block: 'start' });
}

export function initTabs() {
  initTabLinks();
  addEventListener('load', openFromHash);
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
