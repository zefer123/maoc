// Preview-shell state only: no storage, API calls, or location access.
(() => {
  const byId = (id) => document.getElementById(id);
  const text = (id, value) => { byId(id).textContent = value; };
  const days = [
    { kind: 'cloud', label: 'Partly cloudy', celsius: 27 },
    { kind: 'sun', label: 'Sunny', celsius: 30 },
    { kind: 'rain', label: 'Showers', celsius: 25 },
    { kind: 'cloud', label: 'Partly cloudy', celsius: 28 },
    { kind: 'sun', label: 'Sunny', celsius: 29 },
  ];
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const clockFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let day = 0;
  let lastWorkspace = 'visualizer';

  const create = (tag, value) => Object.assign(document.createElement(tag), { textContent: value });
  const forecastButtons = days.map(({ label }, i) => {
    const button = create('button', '');
    button.type = 'button';
    button.append(create('span', `Day 0${i + 1}`), create('strong', ''), create('small', label));
    button.addEventListener('click', () => { day = i; paintForecast(); });
    return button;
  });
  byId('forecast-days').replaceChildren(...forecastButtons);

  function formatTemp(celsius) {
    return byId('units-setting').value === 'f' ? `${Math.round(celsius * 9 / 5 + 32)}°F` : `${celsius}°C`;
  }

  function paintForecast() {
    const sample = days[day];
    document.body.dataset.forecast = sample.kind;
    text('weather-temp', formatTemp(sample.celsius));
    text('weather-condition', sample.label);
    text('weather-meta', `Sample forecast · Day 0${day + 1}`);
    forecastButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === day));
      button.querySelector('strong').textContent = formatTemp(days[i].celsius);
    });
    requestDraw();
  }

  function chooseHome(event) {
    const realm = event.detail === 'realm';
    const page = byId(realm ? 'page-realm' : 'page-opening');
    const stage = byId('home-stage');
    if (stage.parentElement !== page) page.prepend(stage);
    text('stage-channel', realm ? 'HOME / REALM WORLD' : 'HOME / LIVE OPENING');
    text('stage-source', realm ? 'THE ETERNAL NEXUS / 001' : 'WEATHER VISUALIZER / DEMO');
    text('stage-eyebrow', realm ? 'EXPLORATION INTERFACE' : 'ATMOSPHERIC BRIEF');
    text('stage-title-first', realm ? 'The Realm' : 'Home');
    text('stage-title-second', realm ? 'World.' : 'Opening.');
    byId('viewer').setAttribute('aria-label', realm ? 'Interactive Realm model' : 'Interactive weather model');
    byId('weather-summary').hidden = realm;
    ['realm-intro', 'realm-cta'].forEach((id) => { byId(id).hidden = !realm; });
    selectRealmScene(realm ? lastWorkspace : 'weather');
  }

  addEventListener('realm:home-page', chooseHome);
  byId('realm-cta').addEventListener('click', () => {
    const target = document.querySelector('#modes [aria-pressed="true"]') ?? document.querySelector('#modes button');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
  });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { lastWorkspace = button.dataset.view; }));

  function paintTheme() {
    const choice = byId('theme-setting').value;
    const light = choice === 'light' || (choice === 'system' && !systemTheme.matches);
    document.body.dataset.theme = light ? 'light' : 'dark';
    text('theme-action', light ? 'Dark theme' : 'Light theme');
    requestDraw();
  }

  byId('theme-toggle').addEventListener('click', () => {
    byId('theme-setting').value = document.body.dataset.theme === 'light' ? 'dark' : 'light';
    paintTheme();
  });
  byId('theme-setting').addEventListener('change', paintTheme);
  byId('units-setting').addEventListener('change', paintForecast);
  byId('effects-setting').addEventListener('change', (event) => { document.body.dataset.effects = event.target.value; });
  systemTheme.addEventListener('change', paintTheme);

  function paintConnection() {
    byId('web-state').dataset.online = String(navigator.onLine);
    text('web-state', navigator.onLine ? 'WEB / ONLINE' : 'WEB / OFFLINE');
    text('status-dialog-network', navigator.onLine ? 'Online (browser reported)' : 'Offline (browser reported)');
  }
  function paintClock() {
    const now = new Date();
    byId('status-clock').dateTime = now.toISOString();
    text('status-clock', clockFormat.format(now));
  }
  addEventListener('online', paintConnection);
  addEventListener('offline', paintConnection);
  const statusTrigger = byId('status-trigger');
  const statusDialog = byId('status-dialog');
  statusTrigger.addEventListener('click', () => statusDialog.showModal());
  statusDialog.addEventListener('close', () => statusTrigger.focus());
  paintConnection();
  paintClock();
  setInterval(paintClock, 1000);
  paintForecast();
  paintTheme();
})();