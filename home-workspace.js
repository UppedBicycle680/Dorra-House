/** Filter the existing game buttons without replacing their action listeners. */
export function matchingHomeGames(games, {floor = '1', query = ''} = {}) {
  const term = query.trim().toLocaleLowerCase();
  return games.filter(game => (floor === 'all' || String(game.level) === floor)
    && game.name.toLocaleLowerCase().includes(term));
}

let homeFloor = '1';
export function refreshHomeLibrary(floor) {
  if (floor !== undefined) homeFloor = String(floor);
  const root = document.querySelector('#lobby');
  if (!root) return;
  const buttons = [...root.querySelectorAll('.dashboard-game[data-game]')];
  const games = buttons.map(button => ({id: button.dataset.game, level: Number(button.dataset.homeLevel), name: button.querySelector('strong').textContent}));
  const visible = new Set(matchingHomeGames(games, {floor: homeFloor, query: root.querySelector('#homeGameSearch').value}).map(game => game.id));
  buttons.forEach(button => { button.hidden = !visible.has(button.dataset.game); });
  root.querySelectorAll('[data-home-floor]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.homeFloor === homeFloor)));
  root.querySelector('#homeGameCount').textContent = `${visible.size} ${visible.size === 1 ? 'game' : 'games'}`;
  root.querySelector('#homeGamesEmpty').hidden = visible.size !== 0;
}

export function mountHomeWorkspace(openEstate) {
  const root = document.querySelector('#lobby');
  const grid = root.querySelector('.dashboard-games');
  const featured = ['blackjack', 'roulette', 'monte', 'memory'];
  const buttons = [...grid.querySelectorAll('[data-game]')];
  const symbols = {blackjack: 'A', roulette: '◉', monte: 'Q', memory: '◆'};
  buttons.forEach(button => { if (symbols[button.dataset.game]) button.querySelector('.game-symbol').textContent = symbols[button.dataset.game]; });
  grid.append(...featured.map(id => buttons.find(button => button.dataset.game === id)), ...buttons.filter(button => !featured.includes(button.dataset.game)));
  root.querySelector('#homeGameSearch').addEventListener('input', () => refreshHomeLibrary());
  root.querySelectorAll('[data-home-floor]').forEach(button => button.addEventListener('click', () => refreshHomeLibrary(button.dataset.homeFloor)));
  root.querySelector('#homeClearSearch').addEventListener('click', () => {
    root.querySelector('#homeGameSearch').value = '';
    refreshHomeLibrary('all');
    root.querySelector('#homeGameSearch').focus();
  });
  root.querySelectorAll('[data-home-estate]').forEach(button => button.addEventListener('click', () => openEstate(button.dataset.homeEstate)));
  refreshHomeLibrary();
}
