// Each Core owns its visible page and its disclosure. No app routes or storage.
(() => {
  const coreBar = document.getElementById('core-bar');
  const brandHome = document.getElementById('brand-home');
  const cores = new Map([...coreBar.querySelectorAll('[data-core]')].map((button) => {
    const menu = document.getElementById(button.getAttribute('aria-controls'));
    const workspace = menu.parentElement;
    const pages = new Map([...menu.querySelectorAll('[data-page]')].map((link) => [
      link.dataset.page, { link, panel: document.getElementById(`page-${link.dataset.page}`) },
    ]));
    return [button.dataset.core, { button, workspace, menu, pages, first: pages.keys().next().value }];
  }));
  const opening = { core: 'home', page: 'opening' };
  let current = null;
  let expanded = false;

  function readRoute(hash) {
    const match = /^#\/([a-z]+)\/([a-z]+)$/.exec(hash);
    if (!match || !cores.get(match[1])?.pages.has(match[2])) return null;
    return { core: match[1], page: match[2] };
  }

  function setExpanded(value) {
    expanded = value;
    for (const [key, core] of cores) {
      const open = key === current.core && value;
      core.button.setAttribute('aria-expanded', String(open));
      core.menu.hidden = !open;
    }
  }

  function paint(route, reveal, focusTitle = false) {
    const changed = route.core !== current?.core || route.page !== current?.page;
    const previousFocus = document.activeElement;
    const previous = current;
    current = route;
    for (const [key, core] of cores) {
      const active = key === route.core;
      if (active) core.button.setAttribute('aria-current', 'true');
      else core.button.removeAttribute('aria-current');
      core.workspace.hidden = !active;
      for (const [name, { link, panel }] of core.pages) {
        const selected = active && name === route.page;
        if (selected) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
        panel.hidden = !selected;
      }
    }
    setExpanded(reveal);
    if (route.core === 'home' && (previous?.core !== 'home' || previous.page !== route.page)) {
      dispatchEvent(new CustomEvent('realm:home-page', { detail: route.page }));
    }
    if (changed && (focusTitle || previousFocus?.closest('[hidden]'))) {
      const title = cores.get(route.core).pages.get(route.page).panel.querySelector('h1, h2');
      title.tabIndex = -1;
      title.focus();
    }
  }

  function go(route, reveal, focusTitle = false) {
    const hash = `#/${route.core}/${route.page}`;
    if (location.hash !== hash) history.pushState(null, '', hash);
    paint(route, reveal, focusTitle);
  }

  coreBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-core]');
    if (!button) return;
    const core = button.dataset.core;
    if (core === current.core) setExpanded(!expanded);
    else go({ core, page: cores.get(core).first }, true);
  });
  coreBar.addEventListener('keydown', (event) => {
    const buttons = [...coreBar.querySelectorAll('[data-core]')];
    const index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].focus();
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#/"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const route = readRoute(link.hash);
    if (!route || (link !== brandHome && route.core !== current.core)) return;
    event.preventDefault();
    go(route, link !== brandHome, link !== brandHome && !link.closest('.category-bar'));
  });
  document.addEventListener('keydown', (event) => {
    const core = cores.get(current.core);
    if (event.key !== 'Escape' || !expanded || (!core.menu.contains(event.target) && event.target !== core.button)) return;
    event.preventDefault();
    setExpanded(false);
    core.button.focus();
  });
  addEventListener('hashchange', () => {
    const route = readRoute(location.hash);
    paint(route ?? opening, Boolean(route));
  });
  const initial = readRoute(location.hash);
  paint(initial ?? opening, Boolean(initial));
})();