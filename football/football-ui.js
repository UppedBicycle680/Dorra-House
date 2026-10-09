import * as FootballEngine from './football-engine.js';
import { createVaultClient } from '../vault-client.js';
import { MAX_BALANCE } from '../game-limits.js';
import {
  ACADEMY_FEE_BANDS,
  ACADEMY_RANKINGS_2026,
  ACADEMY_RATING_ORDER,
  FACILITY_UPGRADES,
  FOOTBALL_DATA_SOURCES,
  FOOTBALL_GAME_ASSUMPTIONS,
  FORMATION_PROFILES,
  PLAYING_STYLES,
  SENIOR_DIVISIONS,
  SENIOR_LEAGUE_ROSTERS_2026,
  SITE_REGIONS,
  STAFF_ROLES,
  START_SITES,
  TRAINING_INTENSITIES,
  getSeniorDivision,
  getStartSite
} from './football-data.js';
import { clubMonogram, crestForClub } from './crest-assets.js';
import { createFootballLocationGlobe } from './football-location-globe.js';
const FORMATIONS = Object.keys(FORMATION_PROFILES);

const VIEW_META = Object.freeze({
  overview: ['Home', 'Overview', 'home'],
  inbox: ['Home', 'Inbox', 'home'],
  'first-team': ['Team', 'Squads', 'team'],
  people: ['Team', 'People', 'team'],
  recruitment: ['Team', 'Recruitment', 'team'],
  scouting: ['Team', 'Scouting', 'team'],
  competitions: ['Matchday', 'Competitions', 'matchday'],
  calendar: ['Matchday', 'Calendar', 'matchday'],
  'match-centre': ['Matchday', 'Match Centre', 'matchday'],
  'matchday-operations': ['Matchday', 'Operations', 'matchday'],
  fixtures: ['Matchday', 'Fixtures', 'matchday'],
  training: ['Matchday', 'Training', 'matchday'],
  'coach-desk': ['Matchday', 'Coach Desk', 'matchday'],
  academy: ['Academy', 'Academy', 'academy'],
  'fq-assessment': ['Academy', 'FQ Assessment', 'academy'],
  'club-vision': ['Club', 'Club Vision', 'club'],
  commercial: ['Club', 'Commercial', 'club'],
  facilities: ['Club', 'Facilities', 'club'],
  finances: ['Club', 'Finances', 'club'],
  world: ['Club', 'Football World', 'club'],
  history: ['Club', 'History', 'club'],
  settings: ['Utilities', 'Settings', 'utility']
});

const DOMAIN_DEFAULT_VIEW = Object.freeze({
  home: 'overview',
  team: 'first-team',
  matchday: 'match-centre',
  academy: 'academy',
  club: 'facilities'
});

const DAY_NAMES = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
const SESSION_OPTIONS = Object.freeze([
  ['rest', 'Rest'],
  ['recovery', 'Recovery'],
  ['technical', 'Technical'],
  ['tactical', 'Tactical'],
  ['fitness', 'Fitness'],
  ['match-prep', 'Match preparation'],
  ['academy-development', 'Academy development']
]);
const CREST_SHAPES = Object.freeze(['classic', 'round', 'hex', 'diamond', 'pennant', 'fortress', 'oval', 'modern']);
const CREST_SYMBOLS = Object.freeze({
  initials: '', ball: '⚽', star: '★', crown: '♛', bolt: 'ϟ', mountain: '▲', wave: '≋', sun: '☀', wings: '◆', torch: '♠', anchor: '⚓', qld: 'Q'
});
const CREST_COLOURS = Object.freeze({
  maroon: ['#8f1f3d', '#071f3b'],
  blue: ['#0d4e91', '#d6ebf4'],
  green: ['#0c6f43', '#f2c14e'],
  orange: ['#c45718', '#071f3b'],
  purple: ['#65328f', '#f1ddff'],
  'black-gold': ['#111820', '#f2bd3d'],
  'sky-navy': ['#53b6e8', '#082b54'],
  'red-black': ['#c52233', '#14171c'],
  teal: ['#087b79', '#d3f5ed'],
  pink: ['#d43f78', '#ffe0eb'],
  'white-black': ['#f5f4ef', '#17191d'],
  'yellow-blue': ['#f3c622', '#164c96']
});
const CREST_CLASSES = Object.freeze([...Object.keys(CREST_COLOURS).map(id => `crest-${id}`), 'crest-custom']);
const CLUB_SEASON_START = new Date('2026-02-02T12:00:00+10:00');
const LIVE_HALF_MS = 20_000;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const dom = {
  app: $('#footballApp'),
  loading: $('#footballLoading'),
  fatal: $('#footballFatal'),
  fatalCopy: $('#footballFatalCopy'),
  onboarding: $('#clubOnboarding'),
  setupForm: $('#clubSetupForm'),
  setupBack: $('#setupBackBtn'),
  setupNext: $('#setupNextBtn'),
  createClub: $('#createClubBtn'),
  setupValidation: $('#setupValidation'),
  clubName: $('#clubNameInput'),
  shortName: $('#clubShortNameInput'),
  initials: $('#clubInitialsInput'),
  crestPrimary: $('#crestPrimaryColour'),
  crestSecondary: $('#crestSecondaryColour'),
  crestPrimaryHex: $('#crestPrimaryHex'),
  crestSecondaryHex: $('#crestSecondaryHex'),
  logoInput: $('#clubLogoInput'),
  removeLogo: $('#removeClubLogo'),
  namePreview: $('#setupNamePreview'),
  crestPreview: $('#setupCrestPreview'),
  region: $('#regionSelect'),
  locationList: $('#locationList'),
  locationDetail: $('#locationDetail'),
  locationGlobe: $('#locationGlobe'),
  locationGlobeStatus: $('#locationGlobeStatus'),
  academyFee: $('#academyFeeInput'),
  academyFeeOutput: $('#academyFeeOutput'),
  wageBudget: $('#wageBudgetInput'),
  wageBudgetOutput: $('#wageBudgetOutput'),
  dorraInvestment: $('#dorraInvestmentInput'),
  startupLoan: $('#startupLoanInput'),
  dorraBalanceHint: $('#dorraBalanceHint'),
  startupFundingCheck: $('#startupFundingCheck'),
  startupSiteCost: $('#startupSiteCost'),
  startupFunds: $('#startupFunds'),
  startupFundingGap: $('#startupFundingGap'),
  summaryCrest: $('#summaryCrest'),
  summaryClubName: $('#summaryClubName'),
  summaryLocation: $('#summaryLocation'),
  workspace: $('#clubWorkspace'),
  sidebar: $('#clubSidebar'),
  mobileScrim: $('#mobileNavScrim'),
  sidebarCrest: $('#sidebarCrest'),
  sidebarClubName: $('#sidebarClubName'),
  sidebarWeek: $('#sidebarWeek'),
  sidebarProgress: $('#sidebarSeasonProgress'),
  activeViewLabel: $('#activeViewLabel'),
  activeViewTitle: $('#activeViewTitle'),
  topbarSeason: $('.topbar-season b'),
  topbarWeek: $('#topbarWeek'),
  topbarDate: $('#topbarDate'),
  mastheadSave: $('.masthead-save'),
  simulateWeek: $('#simulateWeekBtn'),
  content: $('#footballContent'),
  dialog: $('#footballDialog'),
  dialogLabel: $('#footballDialogLabel'),
  dialogTitle: $('#footballDialogTitle'),
  dialogBody: $('#footballDialogBody'),
  toast: $('#footballToast'),
  saveStatus: $('#footballSaveStatus')
};

let vault = null;
let snapshot = null;
let footballState = null;
let locationGlobe = null;
let locationGlobeMountPromise = null;
let inspectedLocationId = '';
let setupStep = 1;
let activeView = 'overview';
const viewScrollPositions = new Map();
let activeTeamTab = 'senior';
let activeCoachSquad = 'first';
let fixtureFilter = 'all';
let academyTableGroup = 'u18';
let inboxFilter = 'all';
let scoutingFilter = 'all';
let worldFilter = 'all';
let historySeasonFilter = 'all';
let matchSpeed = '';
let busy = false;
let toastTimer = 0;
let lastDialogFocus = null;
let liveMatchFrame = 0;
let liveMatchResolve = null;
let liveMatchRunId = 0;
let liveMatchState = null;
let liveMatchCleanup = null;

const setup = {
  name: dom.clubName?.value || 'River City FC',
  shortName: dom.shortName?.value || 'River City',
  initials: dom.initials?.value || 'RC',
  palette: 'maroon',
  primary: CREST_COLOURS.maroon[0],
  secondary: CREST_COLOURS.maroon[1],
  shapeId: 'classic',
  symbolId: 'initials',
  logoData: '',
  region: SITE_REGIONS[0] || '',
  locationId: '',
  academyFee: Number(dom.academyFee?.value) || 1800,
  wageBudget: Number(dom.wageBudget?.value) || 2500,
  ownerInvestment: 0,
  startupLoan: 0,
  playingStyle: 'balanced'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function wholeAud(value, { min = 0, max = MAX_BALANCE, label = 'Amount' } = {}) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be a whole-dollar amount.`);
  const amount = Number(text);
  if (!Number.isSafeInteger(amount) || amount < min || amount > max) {
    throw new Error(`${label} must be between ${formatMoney(min)} and ${formatMoney(max)}.`);
  }
  return amount;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatMoney(value, compact = false) {
  const amount = number(value);
  if (compact && Math.abs(amount) >= 1_000_000) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  }
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value) {
  return `${Math.round(number(value))}%`;
}

function formatDuration(value) {
  const milliseconds = Math.max(0, number(value));
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.ceil(hours / 24)} days`;
}

function titleCase(value) {
  return String(value || '').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function initials(value) {
  return clubMonogram(value).slice(0, 3);
}

function validCrestColour(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

function crestInk(colour) {
  const hex = validCrestColour(colour, '#8f1f3d').slice(1);
  const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const luminance = channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > .68 ? '#071f3b' : '#ffffff';
}

function crestStyle(identity = {}) {
  const palette = CREST_COLOURS[identity.palette] || CREST_COLOURS.maroon;
  const primary = validCrestColour(identity.primary, palette[0]);
  const secondary = validCrestColour(identity.secondary, palette[1]);
  return `--crest-main:${primary};--crest-second:${secondary};--crest-ink:${crestInk(primary)}`;
}

function pick(object, paths, fallback) {
  for (const path of paths) {
    let current = object;
    let found = true;
    for (const part of path.split('.')) {
      if (current == null || !(part in Object(current))) {
        found = false;
        break;
      }
      current = current[part];
    }
    if (found && current != null) return current;
  }
  return fallback;
}

function careerWorldModel() {
  return pick(footballState, ['careerWorld', 'career', 'world'], {}) || {};
}

function peopleModel() {
  try { return typeof FootballEngine.getPeopleView === 'function' ? FootballEngine.getPeopleView(footballState) : {}; } catch { return {}; }
}

function commercialModel() {
  try { return typeof FootballEngine.getCommercialView === 'function' ? FootballEngine.getCommercialView(footballState) : {}; } catch { return {}; }
}

function objectValues(value) {
  if (Array.isArray(value)) return value;
  return value && typeof value === 'object' ? Object.values(value) : [];
}

function careerPlayers() {
  return objectValues(pick(careerWorldModel(), ['players'], []));
}

function careerPlayerFor(player = {}) {
  const id = pick(player, ['id', 'playerId'], '');
  const name = pick(player, ['name', 'fullName'], '');
  if (id) return careerPlayers().find(item => pick(item, ['id', 'playerId'], '') === id) || {};
  return careerPlayers().find(item => name && pick(item, ['name', 'fullName'], '') === name) || {};
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, number(value)));
}

function seasonWeekIndex(season = seasonYear(), week = weekNumber()) {
  return (number(season, seasonYear()) * 40) + Math.max(1, number(week, 1));
}

function weeksUntil(season, week) {
  if (season == null || week == null) return null;
  return Math.max(0, seasonWeekIndex(season, week) - seasonWeekIndex());
}

function formatDecimal(value, digits = 1, fallback = '—') {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : fallback;
}

function managerRoleProfile(role = pick(footballState, ['managerRole', 'role'], 'club-manager')) {
  const profiles = {
    'club-manager': {
      title: 'Club manager',
      summary: 'You own the whole weekly agenda: board direction, budgets, recruitment, facilities and senior football.',
      direct: ['Board and supporter decisions', 'Recruitment and contracts', 'Budgets and facilities'],
      delegated: ['Routine training delivery', 'Reserve and academy match selection'],
      focus: 'Whole-club control'
    },
    'first-team-coach': {
      title: 'First-team coach',
      summary: 'You control the senior match plan and training load while club departments handle routine commercial work.',
      direct: ['Senior tactics and formation', 'Starting XI and substitutions', 'First-team training'],
      delegated: ['Routine finance controls', 'Facilities scheduling', 'Academy selection'],
      focus: 'Senior performance'
    },
    'u23-coach': {
      title: 'U23 coach',
      summary: 'You are responsible for reserve development, minutes and readiness for the senior pathway.',
      direct: ['U23 tactics and selection', 'Individual development minutes', 'Reserve training load'],
      delegated: ['Senior match plan', 'Board and commercial work', 'Academy selection'],
      focus: 'Pathway readiness'
    },
    'academy-coach': {
      title: 'Academy coach',
      summary: 'You shape academy development and player progression while the board and senior staff run their departments.',
      direct: ['Academy sessions', 'Youth selection and development', 'Pathway recommendations'],
      delegated: ['Senior match plan', 'Finance and facilities', 'Senior recruitment'],
      focus: 'Player development'
    }
  };
  const base = profiles[role] || profiles['club-manager'];
  const stored = pick(careerWorldModel(), ['roleConsequences', `roles.${role}`], {}) || {};
  return {
    ...base,
    ...stored,
    direct: asArray(stored.directResponsibilities || stored.direct).length ? asArray(stored.directResponsibilities || stored.direct) : base.direct,
    delegated: asArray(stored.delegatedResponsibilities || stored.delegated).length ? asArray(stored.delegatedResponsibilities || stored.delegated) : base.delegated
  };
}

function clubModel() {
  const club = pick(footballState, ['club', 'identity'], {});
  const siteId = pick(footballState, ['club.siteId', 'club.locationId', 'siteId', 'locationId', 'site.id', 'location.id'], 'caboolture');
  const site = getStartSite(siteId) || pick(footballState, ['site', 'location'], {}) || START_SITES[0];
  return {
    id: pick(club, ['id', 'clubId'], 'player-club'),
    name: pick(club, ['name', 'clubName'], pick(footballState, ['clubName'], 'Queensland United FC')),
    shortName: pick(club, ['shortName'], pick(footballState, ['shortName'], 'Queensland United')),
    initials: pick(club, ['initials', 'monogram'], pick(footballState, ['initials'], 'QU')),
    palette: pick(club, ['palette', 'crest.palette'], 'maroon'),
    primary: pick(club, ['badge.primary', 'crest.primary'], CREST_COLOURS.maroon[0]),
    secondary: pick(club, ['badge.secondary', 'crest.secondary'], CREST_COLOURS.maroon[1]),
    shapeId: pick(club, ['badge.shapeId', 'badge.crestId', 'crest.shapeId'], 'classic'),
    symbolId: pick(club, ['badge.symbolId', 'crest.symbolId'], 'initials'),
    logoData: pick(club, ['logoData', 'crest.logoData', 'crest.imageData'], ''),
    site
  };
}

function siteAcquisitionCost(site) {
  return number(pick(site, ['acquisitionCostAud', 'purchaseCostAud', 'landCostAud', 'priceAud'], 0));
}

function siteClearanceCost(site) {
  return number(pick(site, ['initialClearanceCostAud', 'demolitionCostAud', 'clearanceCostAud', 'siteClearanceAud'], 0));
}

function siteOpeningCost(site) {
  return site ? siteAcquisitionCost(site) + siteClearanceCost(site) : 0;
}

function maximumStartupFunds() {
  return Math.min(MAX_BALANCE, number(snapshot?.balance, 0) + FOOTBALL_GAME_ASSUMPTIONS.startupLoanMaxAud);
}

function siteIsAffordable(site) {
  return Boolean(site) && siteOpeningCost(site) <= maximumStartupFunds();
}

function siteClearanceLabel(site) {
  const units = number(site?.clearanceUnits, 0);
  const unitName = String(site?.clearanceUnitName || 'structure');
  if (!units) return 'Initial site preparation';
  return `${units} ${unitName}${units === 1 ? '' : 's'} removed`;
}

function siteImage(site) {
  if (!site) return 'assets/football/sites/caboolture.webp';
  const supplied = site.imageSrc || site.image || site.imagePath || site.visualAsset;
  if (supplied) return String(supplied).replace(/^\.\//, '');
  return `assets/football/sites/${site.id || 'caboolture'}.webp`;
}

function seniorModel() {
  return pick(footballState, ['first', 'senior', 'firstTeam', 'teams.firstTeam', 'teams.senior'], {}) || {};
}

function academyModel() {
  return pick(footballState, ['academy', 'teams.academy'], {}) || {};
}

function weekNumber() {
  return Math.max(1, number(pick(footballState, ['week', 'clock.week', 'season.week'], 1), 1));
}

function seasonYear() {
  const directSeason = Number(footballState?.season);
  return number(Number.isFinite(directSeason) ? directSeason : pick(footballState, ['year', 'seasonYear', 'clock.year', 'season.year'], 2026), 2026);
}

function currentDate() {
  const clockMs = Number(footballState?.clockMs);
  if (Number.isFinite(clockMs) && clockMs > 0) return new Date(clockMs);
  const raw = pick(footballState, ['date', 'clock.date', 'currentDate'], '');
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const date = new Date(CLUB_SEASON_START);
  date.setDate(date.getDate() + ((weekNumber() - 1) * 7));
  return date;
}

function weekDateLabel() {
  const start = currentDate();
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startMonth = start.toLocaleDateString('en-AU', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-AU', { month: 'short' });
  if (startMonth === endMonth) return `${start.getDate()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

function seniorDivisionId() {
  return pick(seniorModel(), ['divisionId', 'leagueId', 'division.id', 'league.id'], pick(footballState, ['seniorDivisionId'], 'fqpl-6'));
}

function seniorDivision() {
  return getSeniorDivision(seniorDivisionId()) || SENIOR_DIVISIONS[0];
}

function competitionDisplayName(divisionId = seniorDivisionId()) {
  try {
    if (typeof FootballEngine.getCompetitionDisplayName === 'function') return FootballEngine.getCompetitionDisplayName(divisionId, seasonYear());
  } catch {}
  const division = getSeniorDivision(divisionId);
  return seasonYear() >= 2027 && division?.id?.startsWith('fqpl-') ? division.name.replace(/^FQPL\b/, 'QPL') : division?.name || '';
}

function seniorDivisionName() {
  return competitionDisplayName(seniorDivisionId()) || seniorDivision().name;
}

function academyLeagueId() {
  return pick(academyModel(), ['leagueId', 'divisionId', 'league.id'], pick(footballState, ['academyLeagueId'], 'fqa-4'));
}

function academyLeagueName() {
  return ACADEMY_FEE_BANDS[academyLeagueId()]?.league || titleCase(academyLeagueId()).replace('Fqa', 'FQA');
}

function academyRatingId() {
  return pick(academyModel(), ['shield', 'rating', 'ratingId', 'assessment.rating'], pick(footballState, ['academyRating'], 'development-committed'));
}

function academyRatingName() {
  return ACADEMY_RATING_ORDER.find(item => item.id === academyRatingId())?.name || titleCase(academyRatingId());
}

function activeStyleId() {
  return pick(footballState, ['first.styleId', 'playingStyle', 'playingStyleId', 'tactics.style', 'senior.playingStyle'], 'balanced');
}

function financeModel() {
  let calculated = {};
  try {
    if (typeof FootballEngine.financeSnapshot === 'function') calculated = FootballEngine.financeSnapshot(footballState) || {};
  } catch {
    calculated = {};
  }
  const raw = pick(footballState, ['finances', 'finance'], {}) || {};
  return {
    cash: number(pick(calculated, ['cash', 'balance'], pick(raw, ['cash', 'balance', 'bankBalance'], 8_000_000))),
    income: number(pick(calculated, ['weeklyIncome', 'income'], pick(raw, ['weeklyIncome', 'income'], 34_500))),
    expenses: number(pick(calculated, ['weeklyExpenses', 'expenses'], pick(raw, ['weeklyExpenses', 'expenses'], 21_800))),
    wageBudget: number(pick(seniorModel(), ['weeklyBudget', 'wageBudget'], pick(raw, ['weeklyFirstTeamBudget'], 2500))),
    academyFee: number(pick(academyModel(), ['feeAud', 'fee', 'seasonFee', 'academyFee'], pick(raw, ['academyFee'], 1800))),
    debt: number(pick(calculated, ['debt'], pick(raw, ['debt', 'startupLoanBalance'], 0))),
    assetValue: number(pick(calculated, ['assetValue'], pick(raw, ['assetValue'], 0))),
    debtToAssets: number(pick(calculated, ['debtToAssets'], pick(raw, ['debtToAssets'], 0))),
    temporaryVenue: number(pick(calculated, ['breakdown.temporaryVenue'], 0)),
    loanPrincipal: number(pick(calculated, ['breakdown.loanPrincipal'], 0)),
    runwayWeeks: number(pick(calculated, ['runwayWeeks'], pick(raw, ['runwayWeeks'], 999))),
    ledger: asArray(pick(raw, ['ledger', 'transactions'], pick(footballState, ['ledger'], []))),
    history: asArray(pick(raw, ['history', 'weeklyHistory'], []))
  };
}

function userCrestMarkup(sizeClass = 'mini-crest') {
  const club = clubModel();
  if (club.logoData) return `<span class="${escapeHtml(sizeClass)} user-designed-crest crest-shape-${escapeHtml(club.shapeId)}" style="${crestStyle(club)}"><img src="${escapeHtml(club.logoData)}" alt=""></span>`;
  const symbol = CREST_SYMBOLS[club.symbolId] || '';
  const mark = club.symbolId === 'initials' ? escapeHtml(club.initials || initials(club.name)) : `<b aria-hidden="true">${escapeHtml(symbol)}</b><em>${escapeHtml(club.initials || initials(club.name))}</em>`;
  return `<span class="${escapeHtml(sizeClass)} user-designed-crest crest-${escapeHtml(club.palette)} crest-shape-${escapeHtml(club.shapeId)}" style="${crestStyle(club)}">${mark}</span>`;
}

function opponentCrestMarkup(team, sizeClass = 'table-crest') {
  const name = team?.name || team?.teamName || 'Club';
  const clubId = team?.clubId || team?.id || name;
  const src = team?.logo || team?.logoPath || team?.crest || crestForClub(clubId) || crestForClub(name);
  if (src) {
    const artworkClass = /leichhardt-fc\.png(?:$|\?)/.test(src) ? ' white-crest-source' : '';
    const imageClass = /westside-grovely\.png(?:$|\?)/.test(src) ? ' class="left-crest-art"' : '';
    return `<span class="${escapeHtml(sizeClass)}${artworkClass}"><img${imageClass} src="${escapeHtml(src)}" alt="" data-crest-fallback="${escapeHtml(initials(name))}"></span>`;
  }
  return `<span class="${escapeHtml(sizeClass)}">${escapeHtml(initials(name))}</span>`;
}

function wireCrestFallbacks(root = document) {
  root.querySelectorAll?.('img[data-crest-fallback]').forEach(image => {
    const fitArtwork = () => {
      const ratio = image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
      image.classList.toggle('wide-crest-art', ratio > 1.6);
      image.classList.toggle('square-crest-art', image.naturalWidth >= 800 && ratio >= 0.9 && ratio <= 1.1);
    };
    const fail = () => {
      const parent = image.parentElement;
      if (parent) parent.textContent = image.dataset.crestFallback || 'FC';
    };
    if (image.complete) {
      if (image.naturalWidth === 0) fail();
      else fitArtwork();
    } else {
      image.addEventListener('load', fitArtwork, { once: true });
      image.addEventListener('error', fail, { once: true });
    }
  });
}

function normalizedTableRows(kind = 'senior') {
  const source = kind === 'academy' ? academyModel() : kind === 'u23' ? footballState?.u23 || {} : seniorModel();
  const direct = asArray(pick(source, ['table', 'standings', 'leagueTable'], []));
  const globalTable = asArray(pick(footballState, [`tables.${kind}`, `standings.${kind}`], []));
  let engineTable = [];
  if (kind === 'academy' && typeof FootballEngine.getAcademyAgeGroupTable === 'function') {
    try { engineTable = asArray(FootballEngine.getAcademyAgeGroupTable(footballState, academyTableGroup)); } catch {}
  } else if (typeof FootballEngine.getDivisionTable === 'function') {
    try { engineTable = asArray(FootballEngine.getDivisionTable(footballState, kind === 'senior' ? 'first' : kind)); } catch {}
  }
  const rows = direct.length ? direct : globalTable.length ? globalTable : engineTable;
  if (rows.length) {
    return rows.map((row, index) => {
      const team = row.team || row.club || row;
      const played = number(pick(row, ['played', 'p', 'matches'], 0));
      const wins = number(pick(row, ['wins', 'won', 'w'], 0));
      const draws = number(pick(row, ['draws', 'drawn', 'd'], 0));
      const losses = number(pick(row, ['losses', 'lost', 'l'], Math.max(0, played - wins - draws)));
      const gf = number(pick(row, ['goalsFor', 'gf'], 0));
      const ga = number(pick(row, ['goalsAgainst', 'ga'], 0));
      return {
        position: number(pick(row, ['position', 'pos', 'rank'], index + 1), index + 1),
        id: pick(team, ['id', 'teamId', 'clubId'], `team-${index}`),
        clubId: pick(team, ['clubId', 'badgeKey', 'id', 'teamId'], ''),
        name: pick(team, ['name', 'teamName', 'clubName'], `Team ${index + 1}`),
        played, wins, draws, losses, gf, ga,
        gd: number(pick(row, ['goalDifference', 'gd'], gf - ga)),
        points: number(pick(row, ['points', 'pts'], (wins * 3) + draws)),
        isPlayer: Boolean(row.isPlayer || team.isPlayer || pick(team, ['id'], '') === clubModel().id || pick(team, ['name'], '') === clubModel().name)
      };
    }).sort((a, b) => a.position - b.position);
  }

  const club = clubModel();
  const week = Math.min(18, weekNumber() - 1);
  const roster = kind === 'academy'
    ? ACADEMY_RANKINGS_2026.slice(24, 34).map((entry, index) => ({ id: entry.clubId, clubId: entry.clubId, name: entry.name, gameStrength: 45 - index }))
    : asArray(SENIOR_LEAGUE_ROSTERS_2026[seniorDivisionId()]);
  const teams = [{ id: club.id, name: club.name, clubId: club.id, gameStrength: 39, isPlayer: true }, ...roster];
  return teams.map((team, index) => {
    const played = week;
    const seed = Math.max(0, number(team.gameStrength, 40) - 34 + ((index * 3) % 7));
    const wins = Math.min(played, Math.floor((played * Math.min(70, 28 + seed)) / 100));
    const draws = Math.min(played - wins, Math.floor(played * (0.17 + ((index % 3) * .02))));
    const losses = Math.max(0, played - wins - draws);
    const gd = (wins * 2) - losses + (index % 3) - 1;
    return { ...team, position: 0, played, wins, draws, losses, gf: wins * 2 + draws, ga: Math.max(0, wins + (losses * 2)), gd, points: wins * 3 + draws };
  }).sort((a, b) => b.points - a.points || b.gd - a.gd).map((row, index) => ({ ...row, position: index + 1 }));
}

function leagueTableMarkup(rows, limit = rows.length) {
  const club = clubModel();
  return `<div class="table-scroll"><table class="league-table">
    <thead><tr><th>Pos</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
    <tbody>${rows.slice(0, limit).map(row => {
      const isPlayer = row.isPlayer || row.id === club.id || row.name === club.name;
      return `<tr${isPlayer ? ' class="player-club"' : ''}>
        <td>${row.position}</td>
        <td><div class="club-cell">${isPlayer ? userCrestMarkup('table-crest') : opponentCrestMarkup(row)}<span>${escapeHtml(row.name)}</span></div></td>
        <td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.gd > 0 ? '+' : ''}${row.gd}</td><td>${row.points}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function academyTableGroupLabel(group = academyTableGroup) {
  return group === 'all' ? 'All age groups' : String(group).toUpperCase();
}

function academyTableSelectorMarkup() {
  const groups = [...(FootballEngine.ACADEMY_AGE_GROUPS || ['u13', 'u14', 'u15', 'u16', 'u18']), 'all'];
  return `<div class="academy-table-selector" role="group" aria-label="Academy table age group">${groups.map(group => `<button type="button" class="${academyTableGroup === group ? 'active' : ''}" data-academy-table-group="${group}" aria-pressed="${academyTableGroup === group}">${group === 'all' ? 'All age groups' : group.toUpperCase()}</button>`).join('')}</div>`;
}

function normalizePlayer(rawPlayer = {}, kind = 'senior', index = 0, directSquad = null) {
  const career = careerPlayerFor(rawPlayer);
  const player = { ...rawPlayer, ...career };
  const id = pick(player, ['id', 'playerId'], `${kind}-${index}`);
  const careerStats = pick(player, ['careerStats', 'stats.career'], {}) || {};
  const seasonStats = pick(player, ['seasonStats', 'stats.currentSeason', 'stats.season'], {}) || {};
  const contract = pick(player, ['contract'], {}) || {};
  const development = pick(player, ['development'], {}) ?? {};
  const primaryPosition = pick(player, ['position', 'primaryPosition', 'pos'], ['GK', 'DF', 'MF', 'FW'][index % 4]);
  const allPositions = asArray(pick(player, ['positions'], []));
  const expirySeason = pick(contract, ['endSeason', 'expiresSeason', 'expirySeason'], pick(player, ['contractEndSeason'], null));
  const expiryWeek = pick(contract, ['endWeek', 'expiresWeek', 'expiryWeek'], pick(player, ['contractEndWeek'], null));
  const remainingWeeks = pick(contract, ['weeksRemaining'], pick(player, ['contractWeeksRemaining'], weeksUntil(expirySeason, expiryWeek)));
  const storedFitness = pick(player, ['fitness'], null);
  const storedFatigue = pick(player, ['fatigue'], null);
  return {
    id,
    name: pick(player, ['name', 'fullName'], `Player ${index + 1}`),
    position: primaryPosition,
    secondaryPositions: asArray(pick(player, ['secondaryPositions'], allPositions)).filter(position => position !== primaryPosition),
    age: number(pick(player, ['age'], kind === 'academy' ? 15 + (index % 3) : kind === 'u23' || kind === 'b-u23' ? 18 + (index % 5) : 19 + (index % 13))),
    rating: number(pick(player, ['rating', 'overall', 'ability'], kind === 'academy' ? 43 + (index % 12) : 48 + (index % 15))),
    potential: number(pick(player, ['potential', 'potentialRating', 'development.potential'], pick(player, ['rating', 'overall', 'ability'], 50))),
    fitness: storedFitness == null ? 100 - number(storedFatigue, 8) : number(storedFitness, 100),
    fatigue: storedFatigue == null ? 100 - number(storedFitness, 88) : number(storedFatigue),
    injuryWeeks: number(pick(player, ['injuryWeeks', 'injury.weeksRemaining'], 0)),
    injury: pick(player, ['injury.name', 'injury.type'], ''),
    wage: number(pick(player, ['weeklyWage', 'wage', 'contract.weeklyWage'], kind === 'academy' ? 0 : 150 + (index * 30))),
    marketValue: number(pick(player, ['marketValue', 'valueAud', 'valuation'], 0)),
    morale: number(pick(player, ['morale'], 70), 70),
    form: number(pick(player, ['form', 'formRating'], 0)),
    nationality: pick(player, ['nationality', 'nation'], 'Australia'),
    traits: asArray(pick(player, ['traits', 'playerTraits'], [])),
    status: player.selected || directSquad?.lineup?.includes(id) ? 'Starting XI' : player.onBench || directSquad?.bench?.includes(id) ? 'Bench' : pick(player, ['status', 'role'], 'Squad'),
    contract: {
      status: pick(contract, ['status'], pick(player, ['contractStatus'], kind === 'academy' ? 'Academy registration' : 'Contracted')),
      endSeason: expirySeason,
      endWeek: expiryWeek,
      weeksRemaining: remainingWeeks,
      squadRole: pick(contract, ['squadRole', 'role'], pick(player, ['squadRole'], 'Squad player')),
      weeklyWage: number(pick(contract, ['weeklyWage', 'wage'], pick(player, ['weeklyWage', 'wage'], kind === 'academy' ? 0 : 150 + (index * 30))))
    },
    seasonStats: {
      appearances: number(pick(seasonStats, ['appearances', 'apps'], pick(player, ['appearances'], 0))),
      starts: number(pick(seasonStats, ['starts'], 0)),
      goals: number(pick(seasonStats, ['goals'], pick(player, ['goals'], 0))),
      assists: number(pick(seasonStats, ['assists'], pick(player, ['assists'], 0))),
      cleanSheets: number(pick(seasonStats, ['cleanSheets'], 0)),
      averageRating: number(pick(seasonStats, ['averageRating', 'rating'], 0))
    },
    careerStats: {
      appearances: number(pick(careerStats, ['appearances', 'apps'], 0)),
      goals: number(pick(careerStats, ['goals'], 0)),
      assists: number(pick(careerStats, ['assists'], 0)),
      cleanSheets: number(pick(careerStats, ['cleanSheets'], 0))
    },
    development: {
      focus: pick(development, ['focus'], pick(player, ['developmentFocus'], 'balanced')),
      progress: typeof development === 'number' ? clamp(50 + (development * 5)) : number(pick(development, ['progress', 'seasonGrowth'], pick(player, ['developmentProgress'], 0))),
      change: typeof development === 'number' ? number(development) : number(pick(development, ['change', 'seasonGrowth'], 0)),
      trend: pick(development, ['trend'], pick(player, ['developmentTrend'], typeof development === 'number' ? development > .5 ? 'improving' : development < -.5 ? 'declining' : 'steady' : 'steady')),
      coachNote: pick(development, ['coachNote', 'note'], pick(player, ['developmentNote'], ''))
    },
    raw: player
  };
}

function squadPlayers(kind = 'senior') {
  const squadKey = kind === 'academy' ? 'academy' : kind === 'u23' ? 'u23' : kind === 'b' ? 'b' : kind === 'b-u23' ? 'bU23' : 'first';
  const engineSquadKey = kind === 'b-u23' ? 'b-u23' : kind === 'senior' ? 'first' : kind;
  const team = kind === 'academy' ? academyModel() : kind === 'u23' ? footballState?.u23 || {} : kind === 'b' || kind === 'b-u23' ? footballState?.b || {} : seniorModel();
  let engineSquad = null;
  try { if (typeof FootballEngine.getSquad === 'function') engineSquad = FootballEngine.getSquad(footballState, engineSquadKey); } catch {}
  const directSquad = pick(footballState, [`squads.${squadKey}`], null);
  const actual = asArray(engineSquad?.players || pick(team, ['players', 'squad', 'roster'], directSquad?.players || []));
  if (actual.length) {
    return actual.map((player, index) => normalizePlayer(player, kind, index, directSquad));
  }
  const names = kind === 'academy'
    ? ['Liam Nguyen', 'Eli Walker', 'Noah Patel', 'Jack Williams', 'Lucas Chen', 'Kai Thompson', 'Oliver Singh', 'Leo Harris', 'Mason Brown', 'Finn Wilson', 'Archie Martin', 'Hugo Taylor', 'Jude Evans', 'Oscar Lee']
    : ['Thomas Kelly', 'Mitch Fraser', 'Sam Okafor', 'Ben Murphy', 'Connor Reid', 'Jai Wilson', 'Lachlan King', 'Harry Costa', 'Dylan Tran', 'Bailey Jones', 'Riley Scott', 'Nathan Park', 'Ethan Ward', 'Max Roberts', 'Cooper Hall', 'Luke Young', 'Will Evans', 'Josh Baker'];
  return names.map((name, index) => normalizePlayer({
    id: `${kind}-${index + 1}`,
    name,
    position: index === 0 || index === 11 ? 'GK' : index < 6 ? 'DF' : index < 12 ? 'MF' : 'FW',
    age: kind === 'academy' ? 14 + (index % 4) : 18 + (index % 14),
    rating: (kind === 'academy' ? 43 : 49) + ((index * 3) % 15),
    fitness: 91 - ((index * 4) % 18),
    fatigue: 9 + ((index * 4) % 18),
    wage: kind === 'academy' ? 0 : 180 + (index * 35),
    status: index < 11 ? 'Starting XI' : 'Squad'
  }, kind, index, directSquad));
}

function fixtures() {
  const senior = seniorModel();
  const academy = academyModel();
  const actualSenior = asArray(pick(senior, ['fixtures', 'schedule'], []));
  const actualAcademy = asArray(pick(academy, ['fixtures', 'schedule'], []));
  const global = asArray(pick(footballState, ['fixtures'], []));
  const raw = global.length ? global : [
    ...actualSenior.map(item => ({ ...item, team: 'senior' })),
    ...actualAcademy.map(item => ({ ...item, team: 'academy' }))
  ];
  if (raw.length) return raw.map(normalizeFixture).sort((a, b) => a.week - b.week);

  if (typeof FootballEngine.getCurrentFixture === 'function' && footballState?.competitions?.first) {
    try {
      const resultRows = [];
      const competitionSpecs = [
        ['first', 'senior', seniorDivisionName()],
        ['u23', 'u23', `${seniorDivisionName()} U23`],
        ['academy', 'academy', academyLeagueName()],
        ...(footballState.b ? [['b', 'b', getSeniorDivision(footballState.b.divisionId)?.name || 'B team']] : [])
      ];
      for (const [squad, team, competition] of competitionSpecs) {
        const table = asArray(FootballEngine.getDivisionTable?.(footballState, squad));
        const names = new Map(table.map(row => [row.teamId || row.id, row.name]));
        asArray(footballState.competitions?.[squad]?.results).forEach((result, index) => resultRows.push(normalizeFixture({
          ...result,
          id: result.id || `${squad}-result-${index}`,
          team,
          squad,
          competition,
          homeName: names.get(result.home) || result.home,
          awayName: names.get(result.away) || result.away,
          played: true
        }, resultRows.length)));
        const current = FootballEngine.getCurrentFixture(footballState, squad);
        if (current && !current.bye && !current.played) resultRows.push(normalizeFixture({ ...current, team, squad, competition }, resultRows.length));
      }
      if (resultRows.length) return resultRows.sort((a, b) => a.week - b.week || a.team.localeCompare(b.team));
    } catch {}
  }

  const club = clubModel();
  const roster = asArray(SENIOR_LEAGUE_ROSTERS_2026[seniorDivisionId()]);
  const week = weekNumber();
  return [-2, -1, 0, 1, 2, 3].flatMap((offset, index) => {
    const opponent = roster[(week + index) % Math.max(1, roster.length)] || { id: 'opponent', name: 'Brisbane Community FC' };
    const played = offset < 0;
    return ['senior', 'academy'].map((teamKind, teamIndex) => ({
      id: `${teamKind}-${week + offset}`,
      team: teamKind,
      competition: teamKind === 'senior' ? seniorDivisionName() : academyLeagueName(),
      week: week + offset,
      date: new Date(currentDate().getTime() + ((offset * 7) + 5 + teamIndex) * 86400000).toISOString(),
      home: (index + teamIndex) % 2 === 0 ? { id: club.id, name: club.name, isPlayer: true } : opponent,
      away: (index + teamIndex) % 2 === 0 ? opponent : { id: club.id, name: club.name, isPlayer: true },
      played,
      homeScore: played ? (index + teamIndex) % 4 : null,
      awayScore: played ? (index * 2 + teamIndex) % 3 : null,
      canSimulate: offset === 0 && teamKind === 'senior'
    }));
  });
}

function normalizeFixture(item, index = 0) {
  const club = clubModel();
  const homeRaw = item.home || item.homeTeam || {};
  const awayRaw = item.away || item.awayTeam || {};
  const homeName = pick(item, ['homeName', 'homeTeamName'], typeof homeRaw === 'string' ? homeRaw : pick(homeRaw, ['name', 'teamName'], 'Home'));
  const awayName = pick(item, ['awayName', 'awayTeamName'], typeof awayRaw === 'string' ? awayRaw : pick(awayRaw, ['name', 'teamName'], 'Away'));
  const result = item.result || {};
  const homeScore = pick(item, ['homeScore', 'homeGoals', 'score.home'], pick(result, ['homeGoals', 'home', 'homeScore'], null));
  const awayScore = pick(item, ['awayScore', 'awayGoals', 'score.away'], pick(result, ['awayGoals', 'away', 'awayScore'], null));
  const played = Boolean(item.played || item.complete || item.status === 'played' || (homeScore != null && awayScore != null));
  const hasExplicitCanSimulate = Object.prototype.hasOwnProperty.call(item, 'canSimulate');
  const scheduledWeek = number(pick(item, ['week', 'scheduledWeek'], index + 1), index + 1);
  return {
    id: item.id || item.fixtureId || `fixture-${index}`,
    team: item.team || item.teamType || item.squad || 'senior',
    squad: item.squad || (item.team === 'senior' ? 'first' : item.team) || 'first',
    competition: item.competition || item.leagueName || (item.team === 'academy' ? academyLeagueName() : seniorDivisionName()),
    week: scheduledWeek,
    date: item.date || item.kickoff || '',
    scheduledDay: item.scheduledDay || '',
    rescheduled: Boolean(item.rescheduled),
    venue: item.venue || item.ground || '',
    home: { ...(typeof homeRaw === 'object' ? homeRaw : {}), id: typeof homeRaw === 'string' ? homeRaw : pick(homeRaw, ['id', 'teamId', 'clubId'], ''), name: homeName, isPlayer: Boolean(homeRaw?.isPlayer || homeName === club.name) },
    away: { ...(typeof awayRaw === 'object' ? awayRaw : {}), id: typeof awayRaw === 'string' ? awayRaw : pick(awayRaw, ['id', 'teamId', 'clubId'], ''), name: awayName, isPlayer: Boolean(awayRaw?.isPlayer || awayName === club.name) },
    stats: item.stats || item.statistics || result.stats || {},
    tactics: item.tactics || result.tactics || {},
    matchday: item.matchday || result.matchday || {},
    incidents: asArray(item.incidents || item.events || item.timeline || result.incidents),
    played,
    homeScore: homeScore == null ? null : number(homeScore),
    awayScore: awayScore == null ? null : number(awayScore),
    canSimulate: !played && (hasExplicitCanSimulate ? Boolean(item.canSimulate) : Boolean(item.current || scheduledWeek <= weekNumber())),
    raw: item
  };
}

function nextFixture(team = 'senior') {
  return fixtures().find(fixture => fixture.team === team && !fixture.played) || null;
}

function trainingSchedule() {
  const raw = pick(footballState, ['training.schedule', 'trainingSchedule'], {}) || {};
  const seniorRaw = raw.senior || raw.firstTeam || pick(seniorModel(), ['training', 'trainingSchedule'], []);
  const u23Raw = raw.u23 || pick(footballState, ['u23.training', 'u23.trainingSchedule'], []);
  const academyRaw = raw.academy || pick(academyModel(), ['training', 'trainingSchedule'], []);
  const fallbackSenior = ['recovery', 'technical', 'tactical', 'rest', 'match-prep', 'rest', 'rest'];
  const fallbackU23 = ['recovery', 'technical', 'tactical', 'rest', 'match-prep', 'rest', 'rest'];
  const fallbackAcademy = ['rest', 'technical', 'rest', 'academy-development', 'rest', 'rest', 'rest'];
  const fromEngineSchedule = (schedule, fallback, kind) => {
    if (Array.isArray(schedule)) return DAY_NAMES.map((_, index) => typeof schedule[index] === 'string' ? schedule[index] : schedule[index]?.type || fallback[index]);
    if (schedule && typeof schedule === 'object' && schedule.activities && typeof schedule.activities === 'object') {
      const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      return dayIds.map((day, index) => SESSION_OPTIONS.some(([id]) => id === schedule.activities[day]) ? schedule.activities[day] : fallback[index]);
    }
    if (schedule && typeof schedule === 'object' && Array.isArray(schedule.days)) {
      const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const focusType = { balanced: 'match-prep', technical: 'technical', tactical: 'tactical', physical: 'fitness', recovery: 'recovery', youth: 'academy-development' }[schedule.focus] || (kind === 'academy' ? 'academy-development' : 'technical');
      return dayIds.map(day => schedule.days.includes(day) ? focusType : 'rest');
    }
    return fallback;
  };
  return {
    senior: fromEngineSchedule(seniorRaw, fallbackSenior, 'first'),
    u23: fromEngineSchedule(u23Raw, fallbackU23, 'u23'),
    academy: fromEngineSchedule(academyRaw, fallbackAcademy, 'academy')
  };
}

function activityItems() {
  const raw = asArray(pick(footballState, ['activity', 'news', 'events'], []));
  if (raw.length) return raw.slice(-6).reverse().map((item, index) => ({
    text: typeof item === 'string' ? item : item.message || item.title || item.type || 'Club update',
    when: typeof item === 'object' ? (item.week ? `W${item.week}` : item.date || 'Now') : `W${Math.max(1, weekNumber() - index)}`
  }));
  return [
    { text: 'Registration opened for academy trial groups.', when: 'Today' },
    { text: 'First-team coaches published the weekly training load.', when: 'Today' },
    { text: 'Facilities review confirms the opening pitch is available.', when: 'W1' }
  ];
}

function showToast(message, tone = '') {
  if (!dom.toast) return;
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.dataset.tone = tone;
  dom.toast.classList.add('show');
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 3300);
}

function updateSaveStatus(status, error) {
  if (!dom.saveStatus) return;
  dom.saveStatus.dataset.state = status;
  dom.saveStatus.textContent = status === 'saving' ? 'Saving to cloud…' : status === 'error' ? 'Save needs attention' : 'Saved to cloud';
  if (dom.mastheadSave) {
    dom.mastheadSave.dataset.state = status;
    dom.mastheadSave.innerHTML = `<i class="ti ${status === 'saving' ? 'ti-cloud-upload' : status === 'error' ? 'ti-cloud-exclamation' : 'ti-cloud-check'}" aria-hidden="true"></i> <b>${status === 'saving' ? 'Saving' : status === 'error' ? 'Save issue' : 'Saved'}</b>`;
  }
  if (status === 'error' && error) showToast(error.message || 'Cloud save failed.', 'error');
}

function setBusy(value, label = 'Working…') {
  busy = Boolean(value);
  dom.simulateWeek.disabled = busy;
  dom.simulateWeek.dataset.label = dom.simulateWeek.dataset.label || dom.simulateWeek.textContent.trim();
  const buttonLabel = dom.simulateWeek.querySelector('span') || dom.simulateWeek.firstChild;
  if (buttonLabel) buttonLabel.textContent = busy ? label : 'Continue week';
  dom.content.classList.toggle('is-changing', busy);
  dom.content.setAttribute('aria-busy', String(busy));
}

function normalizeState(value, options = {}) {
  if (typeof FootballEngine.normalizeFootballState !== 'function') return value;
  return FootballEngine.normalizeFootballState(value, options);
}

async function dispatchFootball(action, args = []) {
  const response = await vault.dispatch('football', action, { args });
  snapshot = clone(response.snapshot);
  const saved = snapshot?.progress?.footballManager;
  footballState = saved ? normalizeState(saved) : null;
  return response.result;
}

async function runEngine(action, args = [], options = {}) {
  if (busy) return null;
  const fn = FootballEngine[action];
  if (typeof fn !== 'function') {
    showToast(`${options.label || titleCase(action)} is not available in this build.`, 'error');
    return null;
  }
  setBusy(true, options.busyLabel || 'Updating…');
  try {
    const result = await dispatchFootball(action, args);
    if (result?.ok === false) throw new Error(result.message || result.error || result.event?.message || `${options.label || titleCase(action)} could not be completed.`);
    syncWorkspaceHeader();
    renderActiveView(false);
    if (options.success) showToast(options.success, 'success');
    queueMicrotask(showBankruptcyIfNeeded);
    return result;
  } catch (error) {
    console.error(`Football action ${action} failed`, error);
    showToast(error?.message || `${options.label || titleCase(action)} could not be completed.`, 'error');
    return null;
  } finally {
    setBusy(false);
  }
}

async function runOptionalEngine(actions, args = [], options = {}) {
  const action = actions.find(name => typeof FootballEngine[name] === 'function');
  if (!action) {
    showToast(options.unavailable || 'That football operation is not available yet.', 'error');
    return null;
  }
  return runEngine(action, args, options);
}

function bankruptcyStatus() {
  const fn = FootballEngine.getBankruptcyStatus || FootballEngine.checkBankruptcy;
  if (typeof fn !== 'function' || !footballState) return { bankrupt: false };
  try {
    const result = fn(footballState);
    if (result === true) return { bankrupt: true, message: 'The club can no longer meet its obligations.' };
    if (!result || typeof result !== 'object') return { bankrupt: false };
    const projection = result.projection && typeof result.projection === 'object' ? result.projection : result;
    return { ...projection, bankrupt: Boolean(projection.bankrupt || projection.isBankrupt || projection.status === 'bankrupt') };
  } catch {
    return { bankrupt: false };
  }
}

function showBankruptcyIfNeeded() {
  const status = bankruptcyStatus();
  if (!status.bankrupt || !dom.dialog.hidden) return;
  openDialog({
    label: 'Board emergency',
    title: 'Club insolvent',
    body: `<div class="empty-state"><strong>Bankruptcy threshold reached</strong><p>${escapeHtml(status.message || status.reason || 'The club cannot continue without a solvent operating plan.')}</p><button type="button" class="fm-button danger" data-declare-bankruptcy>Declare bankruptcy and close this club</button><small>Your Dorra balance and every other Dorra progression field remain untouched.</small></div>`
  });
}

function openBankruptcyConfirmation() {
  const status = bankruptcyStatus();
  if (!status.danger && !status.bankrupt) {
    showToast('The club is solvent; bankruptcy cannot be declared.', 'error');
    return;
  }
  openDialog({
    label: 'Irreversible club decision',
    title: 'Declare bankruptcy?',
    body: `<div class="empty-state"><strong>This football club will close</strong><p>Confirming will remove only this football-manager save. Your Dorra balance, history, statistics and all other progression remain intact.</p><button type="button" class="fm-button danger" data-declare-bankruptcy>Confirm bankruptcy and delete club</button><button type="button" class="fm-button" data-close-football-dialog>Keep managing</button></div>`
  });
}

async function transferOwnerFunds(direction) {
  if (busy) return;
  const input = $('[data-owner-transfer-amount]');
  let amount;
  try {
    amount = wholeAud(input?.value, { min: 1, max: MAX_BALANCE, label: 'Transfer' });
  } catch (error) {
    showToast(error.message, 'error');
    return;
  }
  const isInvestment = direction === 'invest';
  const operation = isInvestment ? FootballEngine.investOwnerFunds : FootballEngine.withdrawOwnerFunds;
  if (typeof operation !== 'function') {
    showToast('Owner-funding transfers are unavailable in this engine build.', 'error');
    return;
  }
  const oldBalance = number(snapshot?.balance, 0);
  if (isInvestment && amount > oldBalance) {
    showToast(`Only ${formatMoney(oldBalance)} is available in your Dorra balance.`, 'error');
    return;
  }
  if (!isInvestment && amount > MAX_BALANCE - oldBalance) {
    showToast('That withdrawal would exceed the supported Dorra balance.', 'error');
    return;
  }
  setBusy(true, 'Transferring…');
  try {
    const result = await dispatchFootball(isInvestment ? 'investOwnerFunds' : 'withdrawOwnerFunds', [amount]);
    if (result?.ok === false) throw new Error(result.message || result.error || result.event?.message || 'The club rejected that transfer.');
    const expectedDelta = isInvestment ? -amount : amount;
    if (Number.isSafeInteger(result?.walletDeltaAud) && result.walletDeltaAud !== expectedDelta) {
      throw new Error('The engine returned an unexpected Dorra wallet movement.');
    }
    syncWorkspaceHeader();
    renderActiveView(false);
    showToast(isInvestment ? `${formatMoney(amount)} invested in the club.` : `${formatMoney(amount)} returned to Dorra.`, 'success');
    showBankruptcyIfNeeded();
  } catch (error) {
    showToast(error?.message || 'The owner-funding transfer failed.', 'error');
  } finally {
    setBusy(false);
  }
}

async function declareBankruptcy() {
  if (busy || !footballState) return;
  const status = bankruptcyStatus();
  if (!status.danger && !status.bankrupt) {
    showToast('The engine no longer permits a bankruptcy declaration.', 'error');
    return;
  }
  setBusy(true, 'Closing club…');
  try {
    await dispatchFootball('declareBankruptcy');
    closeDialog();
    showOnboarding();
    showToast('The bankrupt club was closed. Other Dorra progress was preserved.', 'success');
  } catch (error) {
    showToast(error?.message || 'The club could not be closed.', 'error');
  } finally {
    setBusy(false);
  }
}

function openResetFootballConfirmation() {
  openDialog({
    label: 'Reset football progress',
    title: 'Start this football game again?',
    body: `<div class="empty-state"><strong>This cannot be undone</strong><p>The current club, seasons, squads, facilities, construction and all club money will be deleted. Your Dorra wallet and every non-football save field will stay exactly as they are.</p><button type="button" class="fm-button danger" data-confirm-reset-football>Delete club and reset</button><button type="button" class="fm-button" data-close-football-dialog>Cancel</button></div>`
  });
}

async function resetFootballProgress() {
  if (busy || !footballState) return;
  setBusy(true, 'Resetting…');
  try {
    await dispatchFootball('resetFootballProgress');
    activeView = 'overview';
    closeDialog();
    showOnboarding();
    showToast('Football progress reset. Your Dorra balance was preserved.', 'success');
  } catch (error) {
    showToast(error?.message || 'Football progress could not be reset.', 'error');
  } finally {
    setBusy(false);
  }
}

function openDialog({ label = 'Club operations', title = 'Update', body = '' }) {
  const opening = dom.dialog.hidden;
  if (opening) lastDialogFocus = document.activeElement;
  dom.dialogLabel.textContent = label;
  dom.dialogTitle.textContent = title;
  dom.dialogBody.innerHTML = body;
  dom.dialog.classList.toggle('live-match-mode', Boolean(dom.dialogBody.querySelector('.live-match-visual')));
  dom.dialog.hidden = false;
  document.body.classList.add('dialog-open');
  if (opening) {
    if (dom.workspace) dom.workspace.inert = true;
    if (dom.onboarding) dom.onboarding.inert = true;
  }
  dom.dialog.querySelector('button[data-close-football-dialog]')?.focus();
  wireCrestFallbacks(dom.dialog);
}

function closeDialog() {
  if (dom.dialog.hidden) return;
  cancelLiveMatchVisual();
  liveMatchState = null;
  dom.dialog.hidden = true;
  dom.dialog.classList.remove('live-match-mode');
  document.body.classList.remove('dialog-open');
  if (dom.workspace) dom.workspace.inert = false;
  if (dom.onboarding) dom.onboarding.inert = false;
  lastDialogFocus?.focus?.();
}

function trapDialogFocus(event) {
  if (event.key !== 'Tab' || dom.dialog.hidden) return false;
  const controls = [...dom.dialog.querySelectorAll('.football-dialog-card button:not([disabled]), .football-dialog-card select:not([disabled]), .football-dialog-card input:not([disabled]), .football-dialog-card textarea:not([disabled]), .football-dialog-card a[href], .football-dialog-card [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  if (!controls.length) return false;
  const first = controls[0], last = controls.at(-1), active = document.activeElement;
  if (event.shiftKey && (active === first || !dom.dialog.contains(active))) { event.preventDefault(); last.focus(); return true; }
  if (!event.shiftKey && (active === last || !dom.dialog.contains(active))) { event.preventDefault(); first.focus(); return true; }
  return false;
}

function openSitePreview(siteId) {
  const site = getStartSite(siteId) || clubModel().site;
  if (!site) return;
  const stages = asArray(site.expansionStages);
  const plannedFunds = footballState ? siteOpeningCost(site) : number(setup.ownerInvestment, 0) + number(setup.startupLoan, 0);
  const fundingGap = Math.max(0, siteOpeningCost(site) - plannedFunds);
  const expansion = stages.length
    ? `<ul class="construction-list">${stages.map(stage => `<li><span><strong>Field ${number(stage.fieldNumber)}</strong><small>${number(stage.unlockedHectares).toFixed(2)} ha unlocked · ${number(stage.clearanceUnits)} ${escapeHtml(stage.clearanceUnitName || 'clearance unit')}${number(stage.clearanceUnits) === 1 ? '' : 's'} · one-hour build</small></span><b>${formatMoney(stage.buildCostAud, true)}</b></li>`).join('')}</ul>`
    : '<div class="empty-state"><strong>Full parcel available</strong><p>No adjacent expansion phase remains at this location.</p></div>';
  openDialog({
    label: `${site.region} location comparison`,
    title: site.name,
    body: `<figure class="site-preview-dialog"><img src="${escapeHtml(siteImage(site))}" alt="Simulated oblique aerial concept of the fictional ${escapeHtml(site.name)} football site"><figcaption>Simulated site concept — not an actual parcel.</figcaption></figure><dl class="metric-list"><div><dt>Acquisition</dt><dd>${formatMoney(siteAcquisitionCost(site))}</dd></div><div><dt>Initial clearance</dt><dd>${formatMoney(siteClearanceCost(site))} · ${escapeHtml(siteClearanceLabel(site))}</dd></div><div><dt>Lot size</dt><dd>${number(site.lotHectares, 0).toFixed(1)} hectares</dd></div><div><dt>Field capacity</dt><dd>${number(site.readyFields, 1)} ready / ${number(site.maxFields, 1)} maximum</dd></div><div><dt>Talent / wealth</dt><dd>${number(site.talent, 0)} / ${number(site.wealth, 0)}</dd></div><div><dt>Travel burden</dt><dd>${number(site.travelBurden, 0)}/100</dd></div><div><dt>${footballState ? 'Founding cost' : 'Current funding gap'}</dt><dd>${footballState || !fundingGap ? (footballState ? 'Paid at founding' : 'Fully funded') : formatMoney(fundingGap)}</dd></div></dl><section class="site-expansion-summary"><header class="section-head"><h3>Adjacent parcel and field phases</h3><small>${stages.length} staged project${stages.length === 1 ? '' : 's'}</small></header>${expansion}</section><p class="concept-disclaimer">All parcel, cost, clearance, capacity, talent and wealth values are fictional gameplay assumptions. They are not a property appraisal.</p>`
  });
}

function setCrestElement(element, identity) {
  if (!element) return;
  CREST_CLASSES.forEach(className => element.classList.remove(className));
  CREST_SHAPES.forEach(shape => element.classList.remove(`crest-shape-${shape}`));
  element.classList.add(`crest-${identity.palette || 'maroon'}`);
  const palette = CREST_COLOURS[identity.palette] || CREST_COLOURS.maroon;
  element.style.setProperty('--crest-main', validCrestColour(identity.primary, palette[0]));
  element.style.setProperty('--crest-second', validCrestColour(identity.secondary, palette[1]));
  element.style.setProperty('--crest-ink', crestInk(validCrestColour(identity.primary, palette[0])));
  element.classList.add(`crest-shape-${CREST_SHAPES.includes(identity.shapeId) ? identity.shapeId : 'classic'}`);
  element.classList.toggle('has-image', Boolean(identity.logoData));
  const span = element.querySelector('span');
  if (!span) return;
  element.querySelector(':scope > img')?.remove();
  const symbolId = CREST_SYMBOLS[identity.symbolId] != null ? identity.symbolId : 'initials';
  const crestInitials = (identity.initials || initials(identity.name)).slice(0, 3).toUpperCase();
  span.innerHTML = identity.logoData ? '' : symbolId === 'initials'
    ? `<em>${escapeHtml(crestInitials)}</em>`
    : `<b aria-hidden="true">${escapeHtml(CREST_SYMBOLS[symbolId])}</b><em>${escapeHtml(crestInitials)}</em>`;
  if (identity.logoData) {
    const image = document.createElement('img');
    image.src = identity.logoData;
    image.alt = `${identity.name || 'Club'} crest`;
    element.append(image);
  }
}

function syncIdentityPreview() {
  setup.name = dom.clubName.value.trim();
  setup.shortName = dom.shortName.value.trim();
  setup.initials = dom.initials.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (dom.initials.value !== setup.initials) dom.initials.value = setup.initials;
  dom.namePreview.textContent = setup.name || 'Your Football Club';
  dom.summaryClubName.textContent = setup.name || 'Your Football Club';
  const initialsChoice = $('[data-crest-symbol="initials"] b');
  if (initialsChoice) initialsChoice.textContent = setup.initials || 'FC';
  const identity = { ...setup };
  setCrestElement(dom.crestPreview, identity);
  setCrestElement(dom.summaryCrest, identity);
}

function renderRegionOptions() {
  dom.region.innerHTML = SITE_REGIONS.map(region => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');
  dom.region.value = setup.region;
}

function selectedSite() {
  return getStartSite(setup.locationId);
}

function renderLocationList() {
  const locations = START_SITES.filter(site => site.region === setup.region);
  dom.locationList.innerHTML = locations.map(site => { const affordable = siteIsAffordable(site); return `<button type="button" class="location-option${site.id === setup.locationId ? ' selected' : ''}${site.id === inspectedLocationId && site.id !== setup.locationId ? ' inspected' : ''}${affordable ? '' : ' unaffordable'}" data-location-id="${escapeHtml(site.id)}" data-purchase-available="${affordable}" ${affordable ? `role="radio" aria-checked="${site.id === setup.locationId}"` : `aria-label="Inspect ${escapeHtml(site.name)}; this site cannot be purchased with the current Dorra balance and maximum startup loan"`}>
    <i aria-hidden="true"></i><span><strong>${escapeHtml(site.name)}</strong><small>${number(site.lotHectares, 0).toFixed(1)} hectares · ${number(site.readyFields, 1)} ready / up to ${site.maxFields} fields${affordable ? '' : ' · inspect only; beyond current funds + loan'}</small></span><b>${formatMoney(siteOpeningCost(site), true)}</b>
  </button>`; }).join('');
  renderLocationDetail();
}

function renderLocationDetail() {
  const site = getStartSite(inspectedLocationId) || selectedSite();
  if (!site) {
    dom.locationDetail.innerHTML = '<div><span>Selection</span><strong>Choose a site</strong></div><div><span>Talent</span><strong>—</strong></div><div><span>Wealth</span><strong>—</strong></div>';
    dom.summaryLocation.textContent = 'Choose a home location';
    updateStartupFunding();
    return;
  }
  const plannedFunds = number(setup.ownerInvestment, 0) + number(setup.startupLoan, 0);
  const plannedGap = Math.max(0, siteOpeningCost(site) - plannedFunds);
  dom.locationDetail.innerHTML = `
    <button type="button" class="location-preview" data-site-preview="${escapeHtml(site.id)}"><img src="${escapeHtml(siteImage(site))}" alt="Concept view of ${escapeHtml(site.name)}"><span>Simulated site concept — not an actual parcel.</span></button>
    <div><span>Site + clearance</span><strong>${formatMoney(siteOpeningCost(site), true)}</strong></div>
    <div><span>Area / capacity</span><strong>${number(site.lotHectares).toFixed(1)} ha · ${number(site.readyFields)}/${number(site.maxFields)}</strong></div>
    <div><span>Talent pool</span><strong>${site.talent}/100</strong></div>
    <div><span>Local wealth</span><strong>${site.wealth}/100</strong></div>
    <div><span>Travel burden</span><strong>${number(site.travelBurden)}/100</strong></div>
    <div><span>Demolition</span><strong>${escapeHtml(siteClearanceLabel(site))}</strong></div>
    <div><span>Planned funding gap</span><strong>${plannedGap ? formatMoney(plannedGap, true) : 'Fully funded'}</strong></div>`;
  const chosen = selectedSite();
  dom.summaryLocation.textContent = chosen ? `${chosen.name}, ${chosen.region}` : 'Choose an affordable home location';
  updateStartupFunding();
}

function updateStartupFunding() {
  if (!dom.startupFundingCheck) return;
  const site = selectedSite();
  const available = number(snapshot?.balance, 0);
  let investment = 0;
  let loan = 0;
  try { investment = wholeAud(dom.dorraInvestment?.value || '0', { max: Math.min(MAX_BALANCE, available), label: 'Dorra investment' }); } catch {}
  try { loan = wholeAud(dom.startupLoan?.value || '0', { max: 2_000_000, label: 'Startup loan' }); } catch {}
  setup.ownerInvestment = investment;
  setup.startupLoan = loan;
  const cost = siteOpeningCost(site);
  const funds = investment + loan;
  const gap = Math.max(0, cost - funds);
  dom.startupSiteCost.textContent = site ? formatMoney(cost, true) : 'Choose a site';
  dom.startupFunds.textContent = formatMoney(funds, true);
  dom.startupFundingGap.textContent = site ? (gap ? formatMoney(gap, true) : 'Fully funded') : '—';
  dom.startupFundingCheck.classList.toggle('has-gap', Boolean(site && gap));
  dom.startupFundingCheck.classList.toggle('is-funded', Boolean(site && !gap));
}

function selectSite(id, focusGlobe = true) {
  const site = getStartSite(id);
  if (!site) return false;
  if (!siteIsAffordable(site)) {
    inspectedLocationId = site.id;
    renderLocationList();
    if (focusGlobe) locationGlobe?.selectLocation(id, true);
    showToast(`${site.name} costs ${formatMoney(siteOpeningCost(site), true)} and exceeds the Dorra balance plus the $2m startup-loan limit.`, 'error');
    return false;
  }
  inspectedLocationId = site.id;
  setup.locationId = id;
  if (site.region !== setup.region) {
    setup.region = site.region;
    dom.region.value = site.region;
  }
  renderLocationList();
  if (focusGlobe) locationGlobe?.selectLocation(id, true);
  return true;
}

function showSetupStep(step) {
  setupStep = Math.min(3, Math.max(1, step));
  $$('[data-setup-step]').forEach(section => { section.hidden = number(section.dataset.setupStep) !== setupStep; });
  $$('[data-step-indicator]').forEach(indicator => {
    const value = number(indicator.dataset.stepIndicator);
    indicator.classList.toggle('active', value === setupStep);
    indicator.classList.toggle('complete', value < setupStep);
  });
  $('#onboardingStepLabel').textContent = `Step ${setupStep} of 3`;
  const titles = ['Create your football club', 'Choose your home base', 'Set the football plan'];
  const leads = [
    'Choose the identity that will follow your senior and academy teams through Queensland football.',
    'City access improves talent and wealth, while land and demolition can reshape the club for decades.',
    'Balance academy access, first-team ambition and the physical demands of your football identity.'
  ];
  $('#onboardingTitle').textContent = titles[setupStep - 1];
  $('#onboardingLead').textContent = leads[setupStep - 1];
  dom.setupBack.hidden = setupStep === 1;
  dom.setupNext.hidden = setupStep === 3;
  dom.createClub.hidden = setupStep !== 3;
  dom.setupNext.firstChild.textContent = setupStep === 1 ? 'Choose location ' : 'Set football plan ';
  dom.setupValidation.textContent = '';
  if (setupStep === 2) {
    if (locationGlobe) {
      locationGlobe.setActive?.(true);
      requestAnimationFrame(() => locationGlobe?.resize());
    } else if (!locationGlobeMountPromise) {
      locationGlobeMountPromise = new Promise(resolve => setTimeout(resolve, 0))
        .then(() => mountOnboardingGlobe())
        .catch(() => { dom.locationGlobeStatus.textContent = 'Choose a site from the accessible location list.'; })
        .finally(() => { locationGlobeMountPromise = null; });
    }
  } else {
    locationGlobe?.setActive?.(false);
  }
  requestAnimationFrame(() => {
    globalThis.scrollTo?.({ top: 0, behavior: 'auto' });
    $('.setup-step:not([hidden]) h2, #onboardingTitle')?.focus?.({ preventScroll: true });
  });
}

function validateSetupStep(step) {
  if (step === 1) {
    if (setup.name.length < 3) return 'Enter a club name with at least three characters.';
    if (setup.shortName.length < 2) return 'Enter a short club name.';
    if (setup.initials.length < 2) return 'Use two or three crest initials.';
  }
  if (step === 2 && !selectedSite()) return 'Choose one home site before continuing.';
  return '';
}

async function compressLogo(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (file.size > 4_000_000) throw new Error('Choose an image smaller than 4 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', .82);
    if (dataUrl.length > 140_000) throw new Error('The resized crest is still too large. Choose a simpler image.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function mountOnboardingGlobe() {
  locationGlobe?.dispose?.();
  locationGlobe = await createFootballLocationGlobe(dom.locationGlobe, {
    locations: START_SITES,
    selectedId: setup.locationId,
    onSelect: site => {
      if (!selectSite(site.id, false) && setup.locationId) locationGlobe?.selectLocation(setup.locationId, false);
    },
    onRegionFocus: region => {
      const changedRegion = setup.region !== region;
      setup.region = region;
      dom.region.value = region;
      if (changedRegion) {
        setup.locationId = '';
        inspectedLocationId = '';
      }
      renderLocationList();
    },
    onModeChange: ({ message }) => { dom.locationGlobeStatus.textContent = message; }
  });
}

function showOnboarding() {
  applyVisualSettings(true);
  dom.loading.hidden = true;
  dom.fatal.hidden = true;
  dom.workspace.hidden = true;
  dom.onboarding.hidden = false;
  renderRegionOptions();
  const available = number(snapshot?.balance, 0);
  dom.dorraInvestment.max = String(available);
  dom.dorraBalanceHint.textContent = `${formatMoney(available)} available in your protected Dorra balance.`;
  dom.startupLoan.max = '2000000';
  renderLocationList();
  syncIdentityPreview();
  showSetupStep(1);
  dom.app.setAttribute('aria-busy', 'false');
}

function syncWorkspaceHeader() {
  const club = clubModel();
  dom.sidebarClubName.textContent = club.shortName || club.name;
  setCrestElement(dom.sidebarCrest, club);
  const week = weekNumber();
  const seasonWeeks = number(pick(footballState, ['seasonWeeks', 'season.totalWeeks'], FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks), FOOTBALL_GAME_ASSUMPTIONS.seasonWeeks);
  dom.sidebarWeek.textContent = `Week ${week} of ${seasonWeeks}`;
  dom.sidebarProgress.style.width = `${Math.min(100, (week / seasonWeeks) * 100)}%`;
  if (dom.topbarSeason) dom.topbarSeason.textContent = String(seasonYear());
  dom.topbarWeek.textContent = `Week ${week}`;
  dom.topbarDate.textContent = weekDateLabel();
  const meta = VIEW_META[activeView] || VIEW_META.overview;
  dom.activeViewLabel.textContent = meta[0];
  dom.activeViewTitle.textContent = meta[1];
  const activeDomain = meta[2];
  $$('[data-football-context]').forEach(context => {
    context.hidden = context.dataset.footballContext !== activeDomain;
  });
  $$('[data-football-domain]').forEach(button => {
    const selected = button.dataset.footballDomain === activeDomain;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('[data-football-view]').forEach(button => {
    const selected = button.dataset.footballView === activeView;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('.club-utility')?.removeAttribute('open');
}

function showWorkspace() {
  locationGlobe?.dispose?.();
  locationGlobe = null;
  dom.loading.hidden = true;
  dom.fatal.hidden = true;
  dom.onboarding.hidden = true;
  dom.workspace.hidden = false;
  dom.app.setAttribute('aria-busy', 'false');
  syncWorkspaceHeader();
  renderActiveView(false);
  queueMicrotask(showBankruptcyIfNeeded);
}

function viewHeading(title, description, actions = '') {
  return `<header class="view-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${actions ? `<div class="view-actions">${actions}</div>` : ''}</header>`;
}

function teamSnapshot(kind) {
  const senior = kind === 'senior';
  const rows = normalizedTableRows(kind);
  const club = clubModel();
  const playerRow = rows.find(row => row.isPlayer || row.name === club.name) || rows[0];
  const team = senior ? seniorModel() : academyModel();
  const form = pick(team, ['form'], 'W D W L W');
  return `<article class="team-snapshot${senior ? '' : ' academy'}">
    <div><span class="team-snapshot-icon">${senior ? '1' : 'A'}</span><span><small>${senior ? 'First team' : 'Academy'}</small><strong>${escapeHtml(senior ? seniorDivisionName() : academyLeagueName())}</strong></span></div>
    <span><small>Position</small><strong>${playerRow?.position || '—'}</strong></span>
    <span><small>Points</small><strong>${playerRow?.points || 0}</strong></span>
    <span><small>Form</small><strong>${escapeHtml(String(form).replaceAll(',', ' ').slice(0, 9))}</strong></span>
  </article>`;
}

function weekPlannerMarkup() {
  const schedule = trainingSchedule();
  const fixture = nextFixture('senior');
  const dueFixture = fixture?.canSimulate ? fixture : null;
  const weekStart = currentDate();
  const sessionIcon = type => ({
    rest: 'ti-moon',
    recovery: 'ti-heart-rate-monitor',
    technical: 'ti-ball-football',
    tactical: 'ti-chess',
    fitness: 'ti-barbell',
    'match-prep': 'ti-clipboard-check',
    'academy-development': 'ti-school'
  })[type] || 'ti-activity';
  return `<div class="week-scroll"><div class="week-grid">${DAY_NAMES.map((day, index) => {
    const type = schedule.senior[index];
    const matchDay = dueFixture && index === 5;
    const label = SESSION_OPTIONS.find(item => item[0] === type)?.[1] || titleCase(type);
    const load = ['rest', 'recovery'].includes(type) ? 1 : ['technical', 'tactical'].includes(type) ? 2 : 3;
    const date = new Date(weekStart.getTime() + (index * 86400000));
    return `<article class="week-day${matchDay ? ' match-day' : ''}"><header><strong>${day.slice(0, 3)}</strong><small>${date.getDate()}</small></header><div class="week-session"><span class="week-session-icon"><i class="ti ${matchDay ? 'ti-ball-football' : sessionIcon(type)}" aria-hidden="true"></i></span><strong>${escapeHtml(matchDay ? 'Match day' : label)}</strong><small>${matchDay ? escapeHtml(dueFixture.away.name === clubModel().name ? `at ${dueFixture.home.name}` : `v ${dueFixture.away.name}`) : 'First team'}</small></div><div class="week-load" aria-label="${load} of 3 training load">${[1, 2, 3].map(value => `<i class="${value <= load ? `on ${load === 1 ? 'low' : load === 2 ? 'medium' : 'high'}` : ''}"></i>`).join('')}</div></article>`;
  }).join('')}</div></div>`;
}

function nextFixtureMarkup() {
  const fixture = nextFixture('senior');
  if (!fixture) return '<div class="empty-state"><strong>No first-team fixture waiting</strong><p>Continue the week to progress training and the football calendar.</p></div>';
  const homePlayer = fixture.home.isPlayer;
  const kickoff = fixture.date ? new Date(fixture.date) : null;
  const kickoffLabel = kickoff && !Number.isNaN(kickoff.getTime())
    ? kickoff.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
    : `Week ${fixture.week}`;
  return `<div class="next-fixture journal-next-fixture">
    <div class="fixture-team">${homePlayer ? userCrestMarkup('fixture-crest') : opponentCrestMarkup(fixture.home, 'fixture-crest')}<strong>${escapeHtml(fixture.home.name)}</strong><small>${homePlayer ? 'Home' : 'Host'}</small></div>
    <div class="next-fixture-copy"><small>${escapeHtml(fixture.competition)}</small><strong>VS</strong><span>${escapeHtml(kickoffLabel)} · ${escapeHtml(fixture.venue || (homePlayer ? 'Home ground' : 'Away ground'))}</span><div><button type="button" class="fm-button" data-open-view="match-centre">Prepare team</button><button type="button" class="fm-button primary" data-watch-match data-simulate-match="${escapeHtml(fixture.id)}" ${fixture.canSimulate ? '' : 'disabled'}>${fixture.canSimulate ? 'Watch match' : `Available W${fixture.week}`}</button></div></div>
    <div class="fixture-team">${fixture.away.isPlayer ? userCrestMarkup('fixture-crest') : opponentCrestMarkup(fixture.away, 'fixture-crest')}<strong>${escapeHtml(fixture.away.name)}</strong><small>${fixture.away.isPlayer ? 'Away' : 'Visitor'}</small></div>
  </div>`;
}

function overviewPriorities() {
  const fixture = nextFixture('senior');
  const selection = squadSelection('first');
  const players = asArray(selection.players).length ? asArray(selection.players) : squadPlayers('senior');
  const selectedCount = asArray(selection.lineup).length || players.filter(player => player.status === 'Starting XI').length;
  const unavailable = players.filter(player => number(player.injuryWeeks) > 0 || number(player.fitness, 100) < 72).length;
  const averageFitness = Math.round(players.reduce((total, player) => total + number(player.fitness, 100 - number(player.fatigue)), 0) / Math.max(1, players.length));
  const schedule = trainingSchedule();
  const academySessions = schedule.academy.filter(type => !['rest', 'recovery'].includes(type)).length;
  const academyTarget = trainingCap();
  const finance = financeModel();
  const net = finance.income - finance.expenses;
  const first = fixture
    ? { icon: 'ti-clipboard-text', tone: selectedCount === 11 ? 'ready' : 'urgent', title: selectedCount === 11 ? 'Confirm the match plan' : `Choose the starting XI · ${selectedCount}/11`, copy: `${fixture.home.isPlayer ? 'Home' : 'Away'} to ${fixture.home.isPlayer ? fixture.away.name : fixture.home.name} in ${fixture.competition}.`, view: 'match-centre', action: selectedCount === 11 ? 'Review' : 'Select team' }
    : { icon: 'ti-calendar', tone: 'ready', title: 'Plan the next club week', copy: 'There is no first-team fixture waiting this week. Review the calendar before continuing.', view: 'calendar', action: 'Open calendar' };
  const second = unavailable
    ? { icon: 'ti-heart-rate-monitor', tone: 'warning', title: `${unavailable} player${unavailable === 1 ? '' : 's'} need load management`, copy: `Squad fitness is averaging ${averageFitness}%. Adjust recovery before match day.`, view: 'training', action: 'Adjust training' }
    : { icon: 'ti-heart-rate-monitor', tone: 'ready', title: 'Squad availability is healthy', copy: `${averageFitness}% average fitness with no urgent availability flags.`, view: 'first-team', action: 'Review squad' };
  const third = net < 0
    ? { icon: 'ti-cash-banknote', tone: 'warning', title: 'Weekly spending is above income', copy: `${formatMoney(Math.abs(net), true)} weekly deficit needs a budget review.`, view: 'finances', action: 'Review finances' }
    : { icon: 'ti-school', tone: academySessions < academyTarget ? 'warning' : 'ready', title: academySessions < academyTarget ? 'Academy sessions need attention' : 'Academy programme is on target', copy: `${academySessions} of ${academyTarget} expected development sessions are scheduled.`, view: 'academy', action: 'Open academy' };
  return [first, second, third];
}

function overviewView() {
  const finance = financeModel();
  const club = clubModel();
  const table = normalizedTableRows('senior');
  const activities = activityItems();
  const priorities = overviewPriorities();
  const players = squadPlayers('senior');
  const available = players.filter(player => number(player.fitness, 100) >= 72).length;
  const clubRow = table.find(row => row.isPlayer || row.name === club.name) || table[0] || {};
  const unreadInbox = decisionHubItems().filter(item => !item.read && !item.resolved).length;
  return `${viewHeading('Your week', `Here is what needs your attention at ${club.shortName || club.name}.`, `<button type="button" class="fm-button${unreadInbox ? ' primary' : ''}" data-open-view="inbox"><i class="ti ti-inbox" aria-hidden="true"></i>${unreadInbox ? `${unreadInbox} unread` : 'Open inbox'}</button>`)}
    <section class="journal-overview-grid">
      <article class="surface journal-fixture"><header class="section-head"><div><span>Next fixture</span><h2>${escapeHtml(nextFixture('senior')?.competition || seniorDivisionName())}</h2></div><button type="button" data-open-view="match-centre">Match Centre <i class="ti ti-arrow-right" aria-hidden="true"></i></button></header>${nextFixtureMarkup()}</article>
      <article class="surface journal-priorities"><header class="section-head"><div><span>Needs attention</span><h2>${priorities.length} priorities</h2></div></header><ol>${priorities.map(priority => `<li class="${priority.tone}"><span class="priority-icon"><i class="ti ${priority.icon}" aria-hidden="true"></i></span><span><strong>${escapeHtml(priority.title)}</strong><small>${escapeHtml(priority.copy)}</small></span><button type="button" data-open-view="${priority.view}" aria-label="${escapeHtml(priority.action)}">${escapeHtml(priority.action)} <i class="ti ti-chevron-right" aria-hidden="true"></i></button></li>`).join('')}</ol></article>
    </section>
    <article class="surface journal-week"><header class="section-head"><div><span>Weekly schedule</span><h2>This week</h2></div><button type="button" data-open-view="training">Edit schedule <i class="ti ti-arrow-right" aria-hidden="true"></i></button></header>${weekPlannerMarkup()}</article>
    <section class="journal-overview-lower">
      <article class="surface journal-table"><header class="section-head"><div><span>Senior competition</span><h2>${escapeHtml(seniorDivisionName())}</h2></div><p><strong>${clubRow.position || '—'}</strong><small>League position</small></p><button type="button" data-open-view="competitions">Full table <i class="ti ti-arrow-right" aria-hidden="true"></i></button></header>${leagueTableMarkup(table, 6)}</article>
      <article class="surface journal-health"><header class="section-head"><div><span>At a glance</span><h2>Club health</h2></div></header><div class="health-rows"><button type="button" data-open-view="first-team"><span class="health-icon"><i class="ti ti-users" aria-hidden="true"></i></span><span><strong>Squad availability</strong><small>${available} of ${players.length} players match ready</small></span><b>${players.length ? Math.round((available / players.length) * 100) : 0}%</b><i class="ti ti-chevron-right" aria-hidden="true"></i></button><button type="button" data-open-view="finances"><span class="health-icon"><i class="ti ti-wallet" aria-hidden="true"></i></span><span><strong>Finances</strong><small>${formatMoney(finance.cash, true)} cash available</small></span><b class="${finance.income - finance.expenses >= 0 ? 'good' : 'warning'}">${finance.income - finance.expenses >= 0 ? '+' : '−'}${formatMoney(Math.abs(finance.income - finance.expenses), true)}</b><i class="ti ti-chevron-right" aria-hidden="true"></i></button><button type="button" data-open-view="academy"><span class="health-icon"><i class="ti ti-school" aria-hidden="true"></i></span><span><strong>Academy status</strong><small>${escapeHtml(academyLeagueName())}</small></span><b>${escapeHtml(academyRatingName())}</b><i class="ti ti-chevron-right" aria-hidden="true"></i></button><button type="button" data-open-view="facilities"><span class="health-icon"><i class="ti ti-building-stadium" aria-hidden="true"></i></span><span><strong>Home base</strong><small>${escapeHtml(club.site?.name || 'Club site')}</small></span><b>${escapeHtml(club.site?.region || 'Queensland')}</b><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div></article>
    </section>
    <details class="surface journal-activity"><summary><span><i class="ti ti-bell" aria-hidden="true"></i> Latest club activity</span><small>${activities.length} updates</small></summary><ul class="news-list">${activities.map(item => `<li><span>${escapeHtml(item.text)}</span><time>${escapeHtml(item.when)}</time></li>`).join('')}</ul></details>`;
}

function decisionHubItems() {
  let hub = null;
  try { if (typeof FootballEngine.getDecisionHub === 'function') hub = FootballEngine.getDecisionHub(footballState); } catch {}
  const career = careerWorldModel();
  const transferOffers = asArray(pick(career, ['transferOffers'], []));
  const stored = asArray(pick(hub, ['items', 'recent', 'messages'], pick(career, ['inbox.items', 'inbox.messages', 'inbox', 'decisionHub.items'], [])));
  const items = stored.map((item, index) => {
    const rawActions = asArray(pick(item, ['actions', 'choices', 'options'], []));
    const id = String(pick(item, ['id', 'messageId', 'decisionId'], `inbox-${index}`));
    const category = pick(item, ['category', 'department', 'kind', 'type'], 'club');
    const relatedOffer = category === 'transfer'
      ? transferOffers.find(offer => id === `transfer-${offer.id}` || pick(item, ['offerId', 'relatedOfferId'], '') === offer.id)
      : null;
    return {
      id,
      title: pick(item, ['title', 'subject', 'heading'], 'Club update'),
      body: pick(item, ['body', 'message', 'description', 'copy'], ''),
      category,
      priority: pick(item, ['priority', 'severity'], item.blocking ? 'urgent' : 'normal'),
      sender: pick(item, ['sender', 'from', 'author'], titleCase(pick(item, ['category', 'department', 'kind'], 'Club'))),
      dueWeek: pick(item, ['dueWeek', 'deadlineWeek'], null),
      read: Boolean(item.read || item.readAt || item.status === 'read' || item.resolved),
      resolved: Boolean(item.resolved || item.resolvedAt || item.status === 'resolved'),
      view: pick(item, ['view', 'targetView', 'link.view'], ''),
      relatedOfferId: relatedOffer?.status === 'pending' ? relatedOffer.id : '',
      relatedPlayerId: relatedOffer?.playerId || '',
      actions: rawActions.map((action, actionIndex) => typeof action === 'string'
        ? { id: action, label: titleCase(action) }
        : { id: String(pick(action, ['id', 'value', 'action'], `choice-${actionIndex}`)), label: pick(action, ['label', 'title', 'name'], `Option ${actionIndex + 1}`), view: pick(action, ['view', 'targetView'], ''), tone: pick(action, ['tone'], '') })
    };
  });
  if (items.length) return items.sort((a, b) => Number(a.resolved) - Number(b.resolved) || Number(a.read) - Number(b.read) || (a.priority === 'urgent' ? -1 : 0));

  const derived = [];
  const fixture = nextFixture('senior');
  if (fixture) derived.push({ id: 'derived-match-plan', title: `Prepare for ${fixture.home.isPlayer ? fixture.away.name : fixture.home.name}`, body: `${fixture.competition} is scheduled for week ${fixture.week}. Confirm the XI, shape and opponent plan before kick-off.`, category: 'football', priority: 'normal', sender: 'First-team staff', dueWeek: fixture.week, read: false, resolved: false, view: 'match-centre', actions: [] });
  const unavailable = squadPlayers('senior').filter(player => player.injuryWeeks > 0 || player.fitness < 70);
  if (unavailable.length) derived.push({ id: 'derived-medical', title: `${unavailable.length} player${unavailable.length === 1 ? '' : 's'} need a load decision`, body: `${unavailable.slice(0, 3).map(player => player.name).join(', ')}${unavailable.length > 3 ? ` and ${unavailable.length - 3} more` : ''} are injured or below 70% fitness.`, category: 'medical', priority: 'urgent', sender: 'Medical team', dueWeek: weekNumber(), read: false, resolved: false, view: 'training', actions: [] });
  const expiring = squadPlayers('senior').filter(player => player.contract.weeksRemaining != null && number(player.contract.weeksRemaining) <= 8);
  if (expiring.length) derived.push({ id: 'derived-contracts', title: `${expiring.length} contract${expiring.length === 1 ? '' : 's'} nearing expiry`, body: 'Review player profiles and decide whether to renew, transfer or release before the contracts close.', category: 'recruitment', priority: 'normal', sender: 'Recruitment team', dueWeek: null, read: false, resolved: false, view: 'first-team', actions: [] });
  const calendar = pick(career, ['calendar'], {}) || {};
  if (pick(calendar, ['registration.isOpen', 'registrationOpen'], false)) derived.push({ id: 'derived-registration', title: 'Registration window is open', body: `The ${pick(calendar, ['registration.name', 'registrationWindow.name'], 'player registration')} window is accepting squad changes.`, category: 'competition', priority: 'normal', sender: 'Competition office', dueWeek: pick(calendar, ['registration.closesWeek', 'registrationWindow.closesWeek'], null), read: false, resolved: false, view: 'calendar', actions: [] });
  return derived;
}

function inboxView() {
  const all = decisionHubItems();
  const filtered = all.filter(item => inboxFilter === 'all' || (inboxFilter === 'unread' ? !item.read && !item.resolved : inboxFilter === 'decisions' ? item.actions.length && !item.resolved : item.category === inboxFilter));
  const unread = all.filter(item => !item.read && !item.resolved).length;
  const decisions = all.filter(item => item.actions.length && !item.resolved).length;
  const urgent = all.filter(item => item.priority === 'urgent' && !item.resolved).length;
  const categories = [...new Set(all.map(item => item.category))];
  return `${viewHeading('Inbox', 'Your weekly decision hub brings together board requests, match preparation, contracts, medical updates and competition deadlines.', `<button type="button" class="fm-button" data-open-view="overview">Back to overview</button>`)}
    <section class="stat-strip inbox-stats"><div><span>Unread</span><strong>${unread}</strong><small>Current messages</small></div><div><span>Decisions</span><strong>${decisions}</strong><small>Need your response</small></div><div><span>Urgent</span><strong>${urgent}</strong><small>Resolve before advancing</small></div><div><span>This week</span><strong>W${weekNumber()}</strong><small>${escapeHtml(weekDateLabel())}</small></div><div><span>Manager remit</span><strong>${escapeHtml(managerRoleProfile().focus)}</strong><small>${escapeHtml(managerRoleProfile().title)}</small></div></section>
    <div class="inbox-filters surface" role="group" aria-label="Filter inbox"><button type="button" class="${inboxFilter === 'all' ? 'active' : ''}" data-inbox-filter="all">All <span>${all.length}</span></button><button type="button" class="${inboxFilter === 'unread' ? 'active' : ''}" data-inbox-filter="unread">Unread <span>${unread}</span></button><button type="button" class="${inboxFilter === 'decisions' ? 'active' : ''}" data-inbox-filter="decisions">Decisions <span>${decisions}</span></button>${categories.map(category => `<button type="button" class="${inboxFilter === category ? 'active' : ''}" data-inbox-filter="${escapeHtml(category)}">${escapeHtml(titleCase(category))}</button>`).join('')}</div>
    <section class="inbox-layout"><div class="inbox-list">${filtered.length ? filtered.map(item => `<article class="surface inbox-item${item.read ? ' read' : ' unread'}${item.resolved ? ' resolved' : ''} priority-${escapeHtml(item.priority)}"><span class="inbox-department"><i class="ti ${item.category === 'medical' ? 'ti-heart-rate-monitor' : item.category === 'recruitment' || item.category === 'transfer' || item.category === 'loan' ? 'ti-user-search' : item.category === 'competition' || item.category === 'calendar' ? 'ti-trophy' : item.category === 'football' || item.category === 'matchday' ? 'ti-ball-football' : 'ti-building'}" aria-hidden="true"></i></span><div class="inbox-copy"><header><span>${escapeHtml(item.sender)} · ${escapeHtml(titleCase(item.category))}</span>${item.dueWeek != null ? `<time>Due W${number(item.dueWeek)}</time>` : ''}</header><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.body || 'Open the linked management area for more detail.')}</p><footer>${item.actions.length ? item.actions.map((action, index) => action.view ? `<button type="button" class="fm-button${index === 0 ? ' primary' : ''}" data-open-view="${escapeHtml(action.view)}">${escapeHtml(action.label)}</button>` : item.relatedOfferId && ['accept', 'reject', 'negotiate'].includes(action.id) ? `<button type="button" class="fm-button${index === 0 ? ' primary' : ''}" data-respond-transfer-offer="${escapeHtml(item.relatedOfferId)}" data-transfer-response="${escapeHtml(action.id)}" data-related-inbox="${escapeHtml(item.id)}">${escapeHtml(action.label)}</button>` : `<button type="button" class="fm-button${index === 0 ? ' primary' : ''}" data-resolve-inbox="${escapeHtml(item.id)}" data-inbox-choice="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join('') : item.view ? `<button type="button" class="fm-button primary" data-open-view="${escapeHtml(item.view)}">Open ${escapeHtml(VIEW_META[item.view]?.[1] || 'workspace')}</button>` : ''}${!item.read && !item.id.startsWith('derived-') ? `<button type="button" class="text-action" data-mark-inbox-read="${escapeHtml(item.id)}">Mark read</button>` : ''}${item.resolved ? '<span class="resolved-label"><i class="ti ti-check" aria-hidden="true"></i> Resolved</span>' : ''}</footer></div></article>`).join('') : '<article class="surface empty-state"><strong>No messages in this view</strong><p>New requests and decisions will arrive as the football week advances.</p></article>'}</div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Before continuing</h3></header><ul class="decision-checklist"><li class="${urgent ? 'warning' : 'complete'}"><i class="ti ${urgent ? 'ti-alert-triangle' : 'ti-check'}" aria-hidden="true"></i><span><strong>Urgent decisions</strong><small>${urgent ? `${urgent} still open` : 'Nothing blocking the week'}</small></span></li><li class="${nextFixture('senior') ? 'warning' : 'complete'}"><i class="ti ti-clipboard-check" aria-hidden="true"></i><span><strong>Match plan</strong><small>${nextFixture('senior') ? 'Fixture scheduled this week' : 'No senior fixture waiting'}</small></span></li><li class="${constructions().length ? 'warning' : 'complete'}"><i class="ti ti-building-stadium" aria-hidden="true"></i><span><strong>Club operations</strong><small>${constructions().length ? `${constructions().length} project${constructions().length === 1 ? '' : 's'} in progress` : 'No active capital project'}</small></span></li></ul></article><article class="surface"><header class="section-head"><h3>Your current remit</h3><small>${escapeHtml(managerRoleProfile().title)}</small></header><div class="role-remit-summary"><p>${escapeHtml(managerRoleProfile().summary)}</p><button type="button" class="fm-button" data-open-view="coach-desk">Review role and delegation</button></div></article></aside>
    </section>`;
}

function findPlayer(playerId, kind = 'senior') {
  const kinds = [kind, 'senior', 'u23', 'academy', 'b', 'b-u23'];
  for (const squadKind of [...new Set(kinds)]) {
    const player = squadPlayers(squadKind).find(item => item.id === playerId);
    if (player) return { player, kind: squadKind };
  }
  const career = careerPlayers().find(item => pick(item, ['id', 'playerId'], '') === playerId);
  return career ? { player: normalizePlayer(career, kind, 0), kind } : null;
}

function playerDetailBody(playerId, kind = 'senior') {
  const found = findPlayer(playerId, kind);
  if (!found) return '<div class="empty-state"><strong>Player record unavailable</strong><p>The squad changed before this profile could be opened.</p></div>';
  const { player } = found;
  const contractEnd = player.contract.weeksRemaining != null
    ? `${number(player.contract.weeksRemaining)} weeks remaining`
    : player.contract.endSeason ? `Season ${escapeHtml(player.contract.endSeason)}${player.contract.endWeek ? ` · W${number(player.contract.endWeek)}` : ''}` : 'No expiry recorded';
  const attributes = Object.entries(pick(player.raw, ['attributes'], {}) || {}).filter(([, value]) => Number.isFinite(Number(value))).slice(0, 10);
  const offers = asArray(pick(careerWorldModel(), ['transferOffers'], [])).filter(offer => pick(offer, ['playerId', 'player.id'], '') === player.id);
  const loan = asArray(pick(careerWorldModel(), ['loans'], [])).find(item => pick(item, ['playerId', 'player.id'], '') === player.id && !['completed', 'cancelled'].includes(pick(item, ['status'], 'active')));
  const playerHistory = asArray(pick(player.raw, ['history'], [])).slice().sort((a, b) => number(b.season) - number(a.season));
  const isAcademy = found.kind === 'academy', isU23 = found.kind === 'u23', isSenior = found.kind === 'senior', isPathway = isAcademy || isU23;
  const focusOptions = ['balanced', 'technical', 'physical', 'tactical', 'finishing', 'defending', 'goalkeeping'];
  return `<div class="player-profile">
    <section class="player-profile-hero"><span class="player-profile-avatar">${escapeHtml(initials(player.name))}</span><div><span>${escapeHtml(player.position)}${player.secondaryPositions.length ? ` · ${escapeHtml(player.secondaryPositions.join(', '))}` : ''}</span><h3>${escapeHtml(player.name)}</h3><p>Age ${player.age} · ${escapeHtml(player.nationality)} · ${escapeHtml(player.status)}</p></div><div class="player-overall"><strong>${player.rating}</strong><small>Overall</small><span>${player.potential > player.rating ? `${player.potential} potential` : 'At current ceiling'}</span></div></section>
    <section class="profile-stat-grid"><div><span>Apps</span><strong>${player.seasonStats.appearances}</strong><small>${player.seasonStats.starts} starts</small></div><div><span>Goals</span><strong>${player.seasonStats.goals}</strong><small>${player.careerStats.goals} career</small></div><div><span>Assists</span><strong>${player.seasonStats.assists}</strong><small>${player.careerStats.assists} career</small></div><div><span>Average</span><strong>${player.seasonStats.averageRating ? player.seasonStats.averageRating.toFixed(2) : '—'}</strong><small>${player.careerStats.appearances} career apps</small></div><div><span>Fitness</span><strong>${formatPercent(player.fitness)}</strong><small>${player.injuryWeeks ? `${player.injuryWeeks}w unavailable` : 'Available'}</small></div></section>
    <section class="profile-columns"><div class="detail-stack">
      <article class="profile-panel"><header><h4>Development</h4><span class="trend-${escapeHtml(player.development.trend)}">${escapeHtml(titleCase(player.development.trend))}</span></header><div class="development-line"><span><strong>${player.rating}</strong> current</span><i><b style="width:${clamp(player.development.progress)}%"></b></i><span><strong>${player.potential}</strong> potential</span></div>${player.development.coachNote ? `<p>${escapeHtml(player.development.coachNote)}</p>` : '<p>No individual coach note has been recorded yet.</p>'}<label class="profile-field">Individual focus<select data-player-development-focus>${focusOptions.map(option => `<option value="${option}"${option === player.development.focus ? ' selected' : ''}>${escapeHtml(titleCase(option))}</option>`).join('')}</select></label><button type="button" class="fm-button" data-save-player-development="${escapeHtml(player.id)}">Save development focus</button></article>
      <article class="profile-panel"><header><h4>Playing profile</h4><small>${attributes.length ? 'Scouted attributes' : 'Core status'}</small></header>${attributes.length ? `<div class="attribute-grid">${attributes.map(([label, value]) => `<div><span>${escapeHtml(titleCase(label))}</span><strong>${number(value)}</strong><i><b style="width:${clamp(value)}%"></b></i></div>`).join('')}</div>` : `<dl class="metric-list"><div><dt>Morale</dt><dd>${formatPercent(player.morale)}</dd></div><div><dt>Form</dt><dd>${Array.isArray(player.raw.form) && player.raw.form.length ? formatDecimal(player.raw.form.at(-1), 1) : player.form ? formatDecimal(player.form, 1) : 'Not rated'}</dd></div><div><dt>Traits</dt><dd>${player.traits.length ? escapeHtml(player.traits.join(' · ')) : 'None recorded'}</dd></div></dl>`}</article>
      ${playerHistory.length ? `<article class="profile-panel"><header><h4>Career by season</h4><small>${playerHistory.length} archived</small></header><div class="table-scroll"><table class="player-history-table"><thead><tr><th>Season</th><th>Club</th><th>Apps</th><th>Goals</th><th>Assists</th><th>Rating</th></tr></thead><tbody>${playerHistory.map(entry => `<tr><td>${number(entry.season)}</td><td>${escapeHtml(entry.club || clubModel().shortName)}</td><td>${number(entry.stats?.appearances)}</td><td>${number(entry.stats?.goals)}</td><td>${number(entry.stats?.assists)}</td><td>${number(entry.stats?.averageRating) ? formatDecimal(entry.stats.averageRating, 2) : '—'}</td></tr>`).join('')}</tbody></table></div></article>` : ''}
    </div><aside class="detail-stack">
      <article class="profile-panel"><header><h4>${isPathway ? 'Pathway status' : 'Contract'}</h4><small>${escapeHtml(player.contract.status)}</small></header><dl class="metric-list"><div><dt>Squad role</dt><dd>${escapeHtml(titleCase(player.contract.squadRole))}</dd></div><div><dt>Expiry</dt><dd>${contractEnd}</dd></div><div><dt>Weekly wage</dt><dd>${player.contract.weeklyWage ? formatMoney(player.contract.weeklyWage) : 'Unpaid registration'}</dd></div><div><dt>Market value</dt><dd>${player.marketValue ? formatMoney(player.marketValue, true) : 'Not valued'}</dd></div></dl>${isAcademy ? `<button type="button" class="fm-button primary" data-promote-player="${escapeHtml(player.id)}" data-promotion-destination="u23">Promote to U23 squad</button>` : isU23 ? `<button type="button" class="fm-button primary" data-promote-player="${escapeHtml(player.id)}" data-promotion-destination="first">Promote to first team</button>` : isSenior ? `<div class="profile-contract-form"><label>Offer wage<input type="number" min="0" step="25" value="${player.contract.weeklyWage}" data-player-contract-wage></label><label>Term<select data-player-contract-years><option value="1">1 season</option><option value="2" selected>2 seasons</option><option value="3">3 seasons</option></select></label><label>Role<select data-player-contract-role>${[['star', 'Key player'], ['important', 'Regular starter'], ['rotation', 'Squad player'], ['prospect', 'Development player'], ['fringe', 'Fringe player']].map(([value, label]) => `<option value="${value}"${value === player.contract.squadRole ? ' selected' : ''}>${label}</option>`).join('')}</select></label><button type="button" class="fm-button primary" data-renew-player-contract="${escapeHtml(player.id)}">Offer renewal</button></div>` : '<p class="profile-note">Contracts for this squad are managed by its delegated football department.</p>'}</article>
      ${loan ? `<article class="profile-panel"><header><h4>Loan</h4><small>${escapeHtml(titleCase(pick(loan, ['status'], 'active')))}</small></header><p>${escapeHtml(pick(loan, ['clubName', 'destination.name'], 'Loan club'))} · ${number(pick(loan, ['weeksRemaining'], weeksUntil(loan.endSeason, loan.endWeek)))} weeks remaining</p>${pick(loan, ['status'], '') === 'active' && pick(loan, ['direction'], 'out') === 'out' ? `<button type="button" class="fm-button" data-recall-player-loan="${escapeHtml(loan.id)}">Recall from loan</button>` : ''}</article>` : ''}
      ${offers.length ? `<article class="profile-panel"><header><h4>Transfer interest</h4><small>${offers.length} offer${offers.length === 1 ? '' : 's'}</small></header><ul class="compact-record-list transfer-offer-list">${offers.map(offer => `<li><span><strong>${escapeHtml(pick(offer, ['clubName', 'fromClub.name'], 'Interested club'))}</strong><small>${pick(offer, ['type'], 'permanent') === 'loan' ? `${formatMoney(pick(offer, ['loanFee'], 0), true)} loan fee · ${number(pick(offer, ['wageContribution'], 0))}% wages` : `${formatMoney(pick(offer, ['feeAud', 'amount'], 0), true)} transfer`} · ${escapeHtml(titleCase(pick(offer, ['status'], 'pending')))}</small></span>${pick(offer, ['status'], 'pending') === 'pending' ? `<div><button type="button" class="text-action good" data-respond-transfer-offer="${escapeHtml(offer.id)}" data-transfer-response="accept">Accept</button><button type="button" class="text-action" data-respond-transfer-offer="${escapeHtml(offer.id)}" data-transfer-response="negotiate">Negotiate</button><button type="button" class="text-action warning" data-respond-transfer-offer="${escapeHtml(offer.id)}" data-transfer-response="reject">Reject</button></div>` : ''}</li>`).join('')}</ul></article>` : ''}
      ${isSenior ? `<article class="profile-panel"><header><h4>Squad planning</h4></header><div class="stacked-actions"><button type="button" class="fm-button" data-offer-player-loan="${escapeHtml(player.id)}">Offer for loan</button><button type="button" class="fm-button" data-list-player="${escapeHtml(player.id)}">Transfer list</button><button type="button" class="fm-button danger" data-confirm-release-player="${escapeHtml(player.id)}">Release player</button></div></article>` : ''}
    </aside></section>
  </div>`;
}

function playerTableMarkup(kind) {
  const players = squadPlayers(kind);
  return `<div class="table-scroll"><table class="squad-table player-career-table"><thead><tr><th>Pos</th><th>Player</th><th>Age</th><th>OVR</th><th>Fitness</th><th>Apps</th><th>${kind === 'academy' ? 'Pathway' : 'Weekly'}</th></tr></thead><tbody>${players.map(player => `<tr><td><span class="position-mark">${escapeHtml(player.position)}</span></td><td><button type="button" class="player-name player-profile-link" data-player-detail="${escapeHtml(player.id)}" data-player-kind="${escapeHtml(kind)}"><span class="player-avatar">${escapeHtml(initials(player.name))}</span><span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.status)}${player.injuryWeeks ? ` · injured ${player.injuryWeeks}w` : ''}</small></span></button></td><td>${player.age}</td><td><strong>${player.rating}</strong>${player.potential > player.rating ? `<small class="table-potential">${player.potential} POT</small>` : ''}</td><td><div class="fitness-cell"><small>${formatPercent(player.fitness)}</small><span><i style="width:${clamp(player.fitness)}%"></i></span></div></td><td>${player.seasonStats.appearances}</td><td>${kind === 'academy' ? escapeHtml(player.development.focus === 'balanced' ? player.status : titleCase(player.development.focus)) : formatMoney(player.wage)}</td></tr>`).join('')}</tbody></table></div>`;
}

function firstTeamView() {
  const team = seniorModel();
  const players = squadPlayers('senior');
  const table = normalizedTableRows('senior');
  const clubRow = table.find(row => row.isPlayer || row.name === clubModel().name) || {};
  const fatigue = Math.round(players.reduce((sum, player) => sum + player.fatigue, 0) / Math.max(1, players.length));
  let weeklySquadCost = players.reduce((sum, player) => sum + player.wage, 0);
  try {
    if (typeof FootballEngine.getWeeklyPlayerWages === 'function') {
      weeklySquadCost = number(FootballEngine.getWeeklyPlayerWages(footballState)?.firstTeam, weeklySquadCost);
    }
  } catch {}
  const staffLevel = number(pick(footballState, ['staff.head-coach', 'staff.headCoach', 'staffLevels.head-coach'], 1), 1);
  const role = pick(footballState, ['managerRole', 'role'], 'club-manager');
  const squadPanelKind = footballState?.b && ['b', 'b-u23'].includes(activeTeamTab) ? activeTeamTab : activeTeamTab === 'u23' ? 'u23' : 'senior';
  const bidStatus = seniorDivisionId() === 'npl-qld' ? FootballEngine.getALeagueBidStatus(footballState) : null;
  const bidChecks = bidStatus ? [
    ['Two completed NPL seasons', bidStatus.checks.twoNplSeasons, `${number(footballState?.metrics?.nplSeasons)} completed`],
    ['NPL premiership', bidStatus.checks.nplPremiership, `${number(footballState?.metrics?.nplTitles)} won`],
    ['Gold academy rating', bidStatus.checks.goldAcademy, academyRatingName()],
    ['10,000-seat stadium', bidStatus.checks.stadiumCapacity, `${number(bidStatus.stadiumCapacity).toLocaleString('en-AU')} seats`],
    ['5,000 average attendance', bidStatus.checks.averageAttendance, `${number(bidStatus.averageAttendance).toLocaleString('en-AU')} average`],
    ['Governance of at least 85', bidStatus.checks.governance, `${Math.round(number(bidStatus.governance))}/100`],
    ['Debt below 50% of assets', bidStatus.checks.debtToAssets, `${Math.round(number(bidStatus.debtToAssets) * 100)}%`],
    ['$10m reserve after bid fee', bidStatus.checks.cashReserve, `${formatMoney(financeModel().cash - bidStatus.feeAud, true)} after fee`]
  ] : [];
  return `${viewHeading('Squads', `Manage recruitment, selection and the real promotion pathway from ${seniorDivisionName()} toward NPL Queensland.`, `<button type="button" class="fm-button primary" data-open-view="match-centre">Match centre</button>`)}
    <section class="stat-strip"><div><span>League position</span><strong>${clubRow.position || '—'}</strong><small>of ${table.length}</small></div><div><span>Points</span><strong>${clubRow.points || 0}</strong><small>${clubRow.played || 0} played</small></div><div><span>Squad</span><strong>${players.length}</strong><small>${players.filter(player => player.age <= 21).length} under 21</small></div><div><span>Weekly wages</span><strong>${formatMoney(weeklySquadCost, true)}</strong><small>budget ${formatMoney(financeModel().wageBudget, true)}</small></div><div><span>Fatigue</span><strong>${fatigue}%</strong><small>${fatigue > 35 ? 'Rotation advised' : 'Manageable load'}</small></div></section>
    <section class="squad-layout"><article class="surface"><div class="team-tabs"><button type="button" class="${activeTeamTab === 'senior' ? 'active' : ''}" data-team-tab="senior">Senior squad</button><button type="button" class="${activeTeamTab === 'u23' ? 'active' : ''}" data-team-tab="u23">U23</button>${footballState?.b ? `<button type="button" class="${activeTeamTab === 'b' ? 'active' : ''}" data-team-tab="b">B team</button><button type="button" class="${activeTeamTab === 'b-u23' ? 'active' : ''}" data-team-tab="b-u23">B U23</button>` : ''}</div>${playerTableMarkup(squadPanelKind)}<footer class="panel-footer"><span>${squadPanelKind === 'u23' ? 'The linked U23 squad plays in its first team’s division and cannot move independently.' : squadPanelKind === 'b-u23' ? 'This U23 group belongs exclusively to the licensed B-team pathway.' : squadPanelKind === 'b' ? `The B side inherited ${escapeHtml(getSeniorDivision(footballState.b.divisionId)?.name || 'the Queensland pathway')} and is capped at NPL.` : 'Set the starting XI in Match Centre before kick-off.'}</span>${activeTeamTab === 'u23' && !footballState?.b ? `<button type="button" data-request-b-team ${footballState?.club?.aLeagueMember ? '' : 'disabled'}>${footballState?.club?.aLeagueMember ? 'Apply for league side' : 'A-League required'}</button>` : '<button type="button" data-open-view="match-centre">Fixtures</button>'}</footer></article>
      <aside class="detail-stack">
        <article class="surface"><header class="section-head"><h3>Team controls</h3></header><div class="control-list"><label>Football style<select data-first-team-style>${PLAYING_STYLES.map(style => `<option value="${style.id}"${style.id === activeStyleId() ? ' selected' : ''}>${escapeHtml(style.name)}</option>`).join('')}</select></label><label>Weekly player budget<input type="number" min="500" max="${seniorDivision().weeklyBudgetMax}" step="250" value="${financeModel().wageBudget}" data-first-team-budget></label><button type="button" class="fm-button primary" data-save-first-team-controls>Save controls</button></div></article>
        <article class="surface coach-card"><div><span class="player-avatar">HC</span><span><strong>${escapeHtml(pick(team, ['coach.name', 'headCoach.name'], 'Football department'))}</strong><small>Coaching staff · Level ${staffLevel}</small></span></div><p>${role === 'first-team-coach' ? 'You are handling match preparation and tactical decisions for the first team.' : 'Remain club manager or step closer to the touchline as first-team coach.'}</p><button type="button" class="fm-button" data-set-manager-role="first-team-coach" ${role === 'first-team-coach' ? 'disabled' : ''}>${role === 'first-team-coach' ? 'Current role' : 'Coach this team'}</button></article>
        <article class="surface"><header class="section-head"><h3>Competition route</h3>${bidStatus ? `<span class="licence-score">${bidStatus.score}% ready</span>` : ''}</header><dl class="metric-list"><div><dt>Current</dt><dd>${escapeHtml(seniorDivisionName())}</dd></div><div><dt>Promotion</dt><dd>${escapeHtml(competitionDisplayName(seniorDivision().promoteTo) || (seniorDivisionId() === 'npl-qld' ? 'Licensing only' : 'Top level'))}</dd></div><div><dt>Relegation</dt><dd>${escapeHtml(competitionDisplayName(seniorDivision().relegateTo) || 'None')}</dd></div></dl>${bidStatus ? `<ul class="construction-list licence-checklist">${bidChecks.map(([label, passed, detail]) => `<li><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></span><b class="${passed ? 'good' : 'warning'}">${passed ? 'Ready' : 'Needed'}</b></li>`).join('')}</ul><div class="academy-actions"><button type="button" class="fm-button primary" data-submit-a-league-bid ${bidStatus.eligible ? '' : 'disabled'}>A-League licensing bid · ${formatMoney(FOOTBALL_GAME_ASSUMPTIONS.aLeagueBidFeeAud, true)}</button><p class="concept-disclaimer">Fictional expansion pathway. The fee is non-refundable once every requirement is met.</p></div>` : ''}</article>
      </aside>
    </section>`;
}

function competitionsView() {
  const seniorRows = normalizedTableRows('senior');
  const u23Rows = normalizedTableRows('u23');
  const academyRows = normalizedTableRows('academy');
  const division = seniorDivision();
  const seniorClub = seniorRows.find(row => row.isPlayer || row.name === clubModel().name) || {};
  const academyClub = academyRows.find(row => row.isPlayer || row.name === clubModel().name) || {};
  const academyGroupLabel = academyTableGroupLabel();
  return `${viewHeading('Competitions', 'Track the senior and U23 promotion pyramid separately from the service-based FQ Academy placement system.', `<button type="button" class="fm-button primary" data-open-view="match-centre">Open match centre</button>`)}
    <section class="stat-strip"><div><span>Senior level</span><strong>${escapeHtml(seniorDivisionName())}</strong><small>Tier ${division.tier}</small></div><div><span>Senior position</span><strong>${seniorClub.position || '—'}</strong><small>${seniorClub.points || 0} points</small></div><div><span>Promotion places</span><strong>${number(division.promotionPlaces, 0)}</strong><small>${escapeHtml(competitionDisplayName(division.promoteTo) || 'Licensing route')}</small></div><div><span>Academy league</span><strong>${escapeHtml(academyLeagueId().toUpperCase())}</strong><small>Services decide placement</small></div><div><span>Academy position</span><strong>${academyClub.position || '—'}</strong><small>${academyClub.points || 0} points</small></div></section>
    <section class="squad-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>${escapeHtml(seniorDivisionName())}</h2><small>First team standings</small></header>${leagueTableMarkup(seniorRows)}</article><article class="surface"><header class="section-head"><h2>${escapeHtml(seniorDivisionName())} U23</h2><small>Linked division · no independent promotion or relegation</small></header>${leagueTableMarkup(u23Rows)}</article><article class="surface academy-results-panel"><div class="academy-results-note"><strong>Match-results table only</strong><span>U13, U14, U15, U16 and U18 have independent results. Use “All age groups” only when you want the five records combined; academy placement still comes from the annual service assessment.</span></div><header class="section-head"><div><h2>${escapeHtml(academyLeagueName())} · ${escapeHtml(academyGroupLabel)}</h2><small>${academyTableGroup === 'all' ? 'Combined record across five age groups' : `${escapeHtml(academyGroupLabel)} playing-season standings`}</small></div></header>${academyTableSelectorMarkup()}${leagueTableMarkup(academyRows)}</article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Senior pyramid</h3></header><ul class="construction-list">${SENIOR_DIVISIONS.map(item => `<li><span><strong>${escapeHtml(competitionDisplayName(item.id))}</strong><small>${item.id === 'a-league' ? 'Fictional licensing bid' : `${item.promotionPlaces} up · ${item.relegationPlaces} down`}</small></span>${item.id === seniorDivisionId() ? '<b>Current</b>' : ''}</li>`).join('')}</ul></article><article class="surface"><header class="section-head"><h3>Rules distinction</h3></header><div class="control-list"><p>First-team and eligible U23 standings use promotion and relegation. Academy placement is reassessed from coaching, facilities, governance and player pathway services.</p><button type="button" class="fm-button" data-open-view="fq-assessment">Review FQ assessment</button>${managerSettings().showCrestNotice ? '<p class="concept-disclaimer">Club crests are shown for unofficial, non-commercial gameplay reference; rights remain with their owners. Missing assets use monograms.</p>' : ''}</div></article></aside>
    </section>`;
}

function competitionHubModel() {
  let direct = null;
  try { if (typeof FootballEngine.getCompetitionHub === 'function') direct = FootballEngine.getCompetitionHub(footballState); } catch {}
  const career = careerWorldModel();
  const competitions = pick(career, ['competitions'], {}) || {};
  return {
    calendar: direct?.calendar || pick(career, ['calendar.current'], {}) || {},
    registration: direct?.registration || competitions.registration || {},
    cup: direct?.cup || competitions.cup || {},
    friendlies: asArray(direct?.friendlies || competitions.friendlies)
  };
}

function calendarWeeks() {
  const totalWeeks = number(pick(careerWorldModel(), ['calendar.totalWeeks'], pick(footballState, ['seasonWeeks'], 40)), 40);
  const cupName = pick(careerWorldModel(), ['calendar.cupName'], 'Queensland Cup');
  const hub = competitionHubModel();
  const fixtureByWeek = new Map();
  const addDatedEvent = (week, event) => {
    const safeWeek = number(week);
    if (safeWeek < 1 || safeWeek > totalWeeks) return;
    if (!fixtureByWeek.has(safeWeek)) fixtureByWeek.set(safeWeek, []);
    fixtureByWeek.get(safeWeek).push(event);
  };
  fixtures().forEach(fixture => {
    addDatedEvent(fixture.week, { id: fixture.id, type: fixture.competition.toLowerCase().includes('cup') ? 'cup' : 'fixture', label: `${fixture.team === 'senior' ? 'First team' : titleCase(fixture.team)} · ${fixture.home.isPlayer ? `v ${fixture.away.name}` : `at ${fixture.home.name}`}` });
  });
  hub.friendlies.filter(fixture => number(fixture.season, seasonYear()) === seasonYear() && fixture.status !== 'cancelled').forEach(fixture => addDatedEvent(fixture.week, { id: fixture.id, type: 'friendly', label: `Friendly · ${fixture.venue === 'away' ? 'at' : 'v'} ${fixture.opponentName || 'Opponent'}` }));
  asArray(hub.cup?.matches).filter(match => number(match.season, seasonYear()) === seasonYear()).forEach(match => addDatedEvent(match.week, { id: match.id, type: 'cup', label: `${match.roundName || hub.cup?.name || cupName} · ${match.opponentName || 'Cup opponent'}` }));
  if (hub.cup?.status === 'active' && hub.cup?.nextRoundWeek) addDatedEvent(hub.cup.nextRoundWeek, { id: `${hub.cup.id || 'cup'}-next`, type: 'cup', label: `${hub.cup.roundName || 'Cup round'} · draw pending` });
  return Array.from({ length: totalWeeks }, (_, index) => {
    const week = index + 1;
    let engineWeek = null;
    try {
      const getCalendarWeek = FootballEngine.getCareerCalendarWeek || FootballEngine.getCalendarWeek;
      if (typeof getCalendarWeek === 'function') engineWeek = getCalendarWeek(footballState, week);
    } catch {}
    const phase = engineWeek?.phase || (week <= 4 ? 'preseason' : week <= 30 ? 'competitive' : week === 31 ? 'postseason' : 'offseason');
    const fallbackEvents = [];
    if (week === 1) fallbackEvents.push({ id: 'players-return', type: 'preseason', label: 'Players return' });
    if (week === 5) fallbackEvents.push({ id: 'league-opener', type: 'league', label: 'League season begins' });
    if ([7, 12, 18, 25, 29].includes(week)) fallbackEvents.push({ id: `cup-${week}`, type: 'cup', label: week === 29 ? `${cupName} final` : `${cupName} round` });
    if (week === 30) fallbackEvents.push({ id: 'league-finale', type: 'league', label: 'League season concludes' });
    if (week === 31) fallbackEvents.push({ id: 'season-review', type: 'assessment', label: 'Board and competition review' });
    const datedEvents = fixtureByWeek.get(week) || [];
    const calendarEvents = asArray(engineWeek?.events).length ? asArray(engineWeek.events) : fallbackEvents;
    const events = [...datedEvents, ...calendarEvents.filter(event => !(event.type === 'cup' && datedEvents.some(dated => dated.type === 'cup')))];
    return { week, phase, registrationOpen: engineWeek?.registrationOpen ?? (week <= 8 || (week >= 23 && week <= 26)), events };
  });
}

function calendarView() {
  const weeks = calendarWeeks();
  const current = weeks[Math.max(0, Math.min(weeks.length - 1, weekNumber() - 1))] || weeks[0];
  const nextEvents = weeks.filter(item => item.week >= weekNumber() && item.events.length).slice(0, 8);
  const hub = competitionHubModel();
  const registration = hub.registration || {};
  const registrationOpen = registration.windowOpen ?? current.registrationOpen;
  const registeredIds = new Set(asArray(registration.registeredPlayerIds).map(String));
  const explicitEligibleIds = asArray(registration.eligiblePlayerIds).map(String);
  const eligibleIds = new Set(explicitEligibleIds.length ? explicitEligibleIds : careerPlayers().filter(player => player.status === 'active' && player.ownership !== 'former').map(player => String(player.id || player.playerId)));
  const registrationPlayers = careerPlayers().filter(player => eligibleIds.has(String(player.id || player.playerId)));
  const cup = hub.cup || {};
  const cupName = cup.name || pick(careerWorldModel(), ['calendar.cupName'], 'Queensland Cup');
  const cupMatches = asArray(cup.matches);
  const cupDue = cup.status === 'active' && cup.nextRoundWeek && weekNumber() === number(cup.nextRoundWeek);
  const friendlies = hub.friendlies.filter(fixture => number(fixture.season, seasonYear()) === seasonYear()).slice().sort((a, b) => number(a.week) - number(b.week));
  const friendlyWindow = ['preseason', 'offseason'].includes(current.phase);
  const friendlyMinWeek = current.phase === 'preseason' ? Math.max(1, weekNumber()) : Math.max(32, weekNumber());
  const friendlyMaxWeek = current.phase === 'preseason' ? 4 : 40;
  const friendlyDefaultWeek = Math.min(friendlyMaxWeek, friendlyMinWeek + 1);
  const friendlyOpponents = aiClubs().filter(club => club.id && club.id !== clubModel().id);
  return `${viewHeading('Season calendar', 'A fixed 40-week football year separates pre-season, league and cup rounds, the season review and the off-season.', `<button type="button" class="fm-button primary" data-open-view="match-centre">Open match centre</button>`)}
    <section class="stat-strip"><div><span>Current phase</span><strong>${escapeHtml(titleCase(current.phase))}</strong><small>Week ${weekNumber()} of ${weeks.length}</small></div><div><span>Registration</span><strong class="${registrationOpen ? 'good' : ''}">${registrationOpen ? 'Open' : 'Closed'}</strong><small>${registeredIds.size}/${number(registration.maxSeniorPlayers, 25)} senior places used</small></div><div><span>League</span><strong>${escapeHtml(seniorDivisionName())}</strong><small>Weeks 5–30</small></div><div><span>Cup</span><strong>${escapeHtml(cupName)}</strong><small>${cup.status === 'active' && cup.nextRoundWeek ? `${escapeHtml(cup.roundName || 'Next round')} · W${cup.nextRoundWeek}` : escapeHtml(titleCase(cup.status || 'not-entered'))}</small></div><div><span>Season review</span><strong>W31</strong><small>Board and competition settlement</small></div></section>
    <section class="calendar-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>${seasonYear()} football calendar</h2><small>Registration windows: W1–8 and W23–26</small></header><div class="season-calendar" aria-label="Season calendar">${weeks.map(item => `<article class="calendar-week${item.week === weekNumber() ? ' current' : ''}${item.registrationOpen ? ' registration-open' : ''}${item.events.some(event => event.type === 'cup') ? ' cup-week' : ''}"><header><strong>W${item.week}</strong><small>${escapeHtml(titleCase(item.phase))}</small></header><div>${item.events.length ? item.events.slice(0, 2).map(event => `<span class="event-${escapeHtml(event.type)}">${escapeHtml(event.label)}</span>`).join('') : '<span class="quiet-week">Club programme</span>'}</div>${item.registrationOpen ? '<footer>Registration open</footer>' : ''}</article>`).join('')}</div></article>
      <article class="surface"><header class="section-head"><h2>Upcoming dates</h2><small>Next eight scheduled weeks</small></header>${nextEvents.length ? `<ol class="timeline-list">${nextEvents.map(item => `<li class="${item.week === weekNumber() ? 'current' : ''}"><time>Week ${item.week}</time><div>${item.events.map(event => `<span><strong>${escapeHtml(event.label)}</strong><small>${escapeHtml(titleCase(event.type))}</small></span>`).join('')}</div></li>`).join('')}</ol>` : '<div class="empty-state"><strong>No remaining dated events</strong><p>The next season calendar is created at rollover.</p></div>'}</article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Registration desk</h3><small>${registrationOpen ? 'Window open' : 'Window closed'} · ${number(registration.homegrownCount, 0)}/${number(registration.homegrownMinimum, 3)} homegrown</small></header>${registrationPlayers.length ? `<ul class="construction-list">${registrationPlayers.map(player => { const playerId = String(player.id || player.playerId); const registered = registeredIds.has(playerId); return `<li><span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.primaryPosition || player.position || asArray(player.positions)[0] || 'Player')} · ${registered ? 'registered' : 'place available'}</small></span><button type="button" class="fm-button${registered ? ' danger' : ''}" ${registered ? `data-unregister-player="${escapeHtml(playerId)}"` : `data-register-player="${escapeHtml(playerId)}"`} ${registrationOpen ? '' : 'disabled'}>${registered ? 'Unregister' : 'Register'}</button></li>`; }).join('')}</ul>` : '<div class="empty-state compact"><strong>No eligible contracted players</strong><p>Active senior players will appear here when they are available for competition registration.</p></div>'}</article>
        <article class="surface"><header class="section-head"><h3>${escapeHtml(cupName)}</h3><small>${escapeHtml(cup.roundName || titleCase(cup.status || 'not-entered'))}${number(cup.prizeMoney) ? ` · ${formatMoney(cup.prizeMoney, true)} earned` : ''}</small></header>${cup.status === 'not-entered' || !cup.status ? '<div class="empty-state compact"><strong>Not entered</strong><p>Enter the knockout competition to add cup rounds to the season.</p><button type="button" class="fm-button primary" data-enter-cup>Enter cup</button></div>' : `<div class="role-remit-summary"><p>${cup.status === 'active' ? `${escapeHtml(cup.roundName || 'Next round')}${cup.nextRoundWeek ? ` is scheduled for week ${number(cup.nextRoundWeek)}.` : ' draw is pending.'}` : cup.status === 'won' ? 'The club won this season’s cup.' : 'The club has been eliminated from this season’s cup.'}</p>${cup.status === 'active' ? `<button type="button" class="fm-button primary" data-simulate-cup ${cupDue ? '' : 'disabled'}>${cupDue ? `Play ${escapeHtml(cup.roundName || 'cup round')}` : number(cup.nextRoundWeek) < weekNumber() ? `Missed W${number(cup.nextRoundWeek)}` : `Available W${number(cup.nextRoundWeek)}`}</button>` : ''}</div>`}${cupMatches.length ? `<ul class="compact-record-list">${cupMatches.slice(-6).reverse().map(match => `<li><span><strong>W${number(match.week)} · ${escapeHtml(match.opponentName || 'Cup opponent')}</strong><small>${escapeHtml(match.roundName || 'Cup')} · ${number(match.goalsFor)}–${number(match.goalsAgainst)}${match.penaltiesWon ? ' (pens)' : ''}</small></span><button type="button" class="text-action" data-open-match-report="${escapeHtml(match.id)}">Report</button></li>`).join('')}</ul>` : ''}</article>
        <article class="surface"><header class="section-head"><h3>Friendlies</h3><small>${friendlyWindow ? `${escapeHtml(titleCase(current.phase))} scheduling open` : 'Pre-season and off-season only'}</small></header>${friendlyWindow ? `<div class="assignment-composer"><label>Opponent<select data-friendly-opponent>${friendlyOpponents.map(club => `<option value="${escapeHtml(club.id)}">${escapeHtml(club.name)}</option>`).join('')}</select></label><label>Week<input type="number" min="${friendlyMinWeek}" max="${friendlyMaxWeek}" value="${friendlyDefaultWeek}" data-friendly-week></label><label>Venue<select data-friendly-venue><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option></select></label><button type="button" class="fm-button primary" data-schedule-friendly ${friendlyOpponents.length ? '' : 'disabled'}>Arrange</button></div>` : '<div class="role-remit-summary"><p>Weeks 1–4 and 32–40 keep friendlies, recruitment and facilities active outside league competition.</p></div>'}${friendlies.length ? `<ul class="compact-record-list">${friendlies.slice().reverse().map(fixture => { const status = String(fixture.status || 'scheduled').toLowerCase(); const due = status === 'scheduled' && number(fixture.week) === weekNumber(); return `<li><span><strong>W${number(fixture.week)} · ${escapeHtml(fixture.opponentName || 'Friendly opponent')}</strong><small>${escapeHtml(titleCase(fixture.venue || 'home'))} · ${status === 'played' ? `${number(fixture.goalsFor)}–${number(fixture.goalsAgainst)}` : escapeHtml(titleCase(status))}</small></span><span class="construction-actions">${status === 'scheduled' ? `<button type="button" class="text-action" data-simulate-friendly="${escapeHtml(fixture.id)}" ${due ? '' : 'disabled'}>${due ? 'Play' : number(fixture.week) < weekNumber() ? 'Missed' : `W${number(fixture.week)}`}</button><button type="button" class="text-action" data-cancel-friendly="${escapeHtml(fixture.id)}">Cancel</button>` : status === 'played' ? `<button type="button" class="text-action" data-open-match-report="${escapeHtml(fixture.id)}">Report</button>` : ''}</span></li>`; }).join('')}</ul>` : '<div class="empty-state compact"><strong>No friendlies arranged</strong><p>Use an open scheduling window to add a non-competitive fixture.</p></div>'}</article></aside>
    </section>`;
}

function matchdayPlanModel() {
  const plan = pick(careerWorldModel(), ['matchday.plan'], {}) || {};
  return {
    ticketPrice: number(pick(plan, ['ticketPrice'], 22), 22),
    hospitalityPrice: number(pick(plan, ['hospitalityPrice'], 95), 95),
    concessionSpend: number(pick(plan, ['concessionSpend'], 14), 14),
    staffing: number(pick(plan, ['staffing'], 3), 3),
    security: number(pick(plan, ['security'], 3), 3),
    pitchPrep: number(pick(plan, ['pitchPrep'], 3), 3),
    transportSubsidy: number(pick(plan, ['transportSubsidy'], 0)),
    promotionSpend: number(pick(plan, ['promotionSpend'], 0))
  };
}

function matchdayFormPlan() {
  const fallback = matchdayPlanModel();
  return {
    ticketPrice: number($('[data-matchday-ticket]')?.value, fallback.ticketPrice),
    hospitalityPrice: number($('[data-matchday-hospitality]')?.value, fallback.hospitalityPrice),
    concessionSpend: number($('[data-matchday-concession]')?.value, fallback.concessionSpend),
    staffing: number($('[data-matchday-staffing]')?.value, fallback.staffing),
    security: number($('[data-matchday-security]')?.value, fallback.security),
    pitchPrep: number($('[data-matchday-pitch]')?.value, fallback.pitchPrep),
    transportSubsidy: number($('[data-matchday-transport]')?.value, fallback.transportSubsidy),
    promotionSpend: number($('[data-matchday-promotion]')?.value, fallback.promotionSpend)
  };
}

function matchdayFixtureContext(plan = matchdayPlanModel()) {
  const fixture = nextFixture('senior');
  const home = fixture ? fixture.home.isPlayer : true;
  const opponent = fixture ? (home ? fixture.away : fixture.home) : null;
  const aiClub = opponent ? aiClubs().find(club => club.id === (opponent.id || opponent.clubId) || club.name === opponent.name) : null;
  const rivalry = opponent ? clubIdentityModel().rivalries.find(item => item.clubId === (opponent.id || opponent.clubId) || item.clubName === opponent.name) : null;
  const importance = fixture?.competition?.toLowerCase().includes('cup') ? 1.3 : 1;
  let context = null;
  try {
    if (typeof FootballEngine.getMatchdayOperationsContext === 'function') context = FootballEngine.getMatchdayOperationsContext(footballState, { plan, importance });
  } catch {}
  if (!context) {
    let capacity = 600;
    let averageAttendance = 0;
    try { if (typeof FootballEngine.getStadiumCapacity === 'function') capacity = number(FootballEngine.getStadiumCapacity(footballState), capacity); } catch {}
    try { if (typeof FootballEngine.getAverageAttendance === 'function') averageAttendance = number(FootballEngine.getAverageAttendance(footballState)); } catch {}
    if (!fixture) context = { venue: 'home', planningOnly: true, venueId: clubModel().site?.id || 'home', capacity, baseAttendance: 0, hospitalityCapacity: Math.round(capacity * .035), travelKm: 0, travelParty: 32, climate: 'subtropical' };
    else {
      const travelKm = number(pick(fixture, ['travelKm', 'awayTravelKm'], pick(opponent, ['distanceKm', 'travelKm'], 0)));
      context = { opponentId: opponent.id || opponent.clubId || '', opponentName: opponent.name, opponentReputation: number(aiClub?.reputation, 50), venue: home ? 'home' : 'away', venueId: fixture.venue || clubModel().site?.id || 'home', capacity, baseAttendance: home ? (averageAttendance || Math.round(capacity * .55)) : 0, hospitalityCapacity: home ? Math.round(capacity * .035) : 0, importance, travelKm, travelParty: 32, climate: 'subtropical' };
    }
  }
  return { fixture, context: { ...context, plan, importance, isRival: Boolean(rivalry) } };
}

function matchdayPreview(plan = matchdayPlanModel()) {
  const { fixture, context } = matchdayFixtureContext(plan);
  if (context.planningOnly) return { fixture, context, preview: null };
  let preview = null;
  try { if (typeof FootballEngine.previewMatchdayOperations === 'function') preview = FootballEngine.previewMatchdayOperations(footballState, context); } catch {}
  if (!preview) {
    const reports = asArray(pick(careerWorldModel(), ['matchday.reports'], []));
    preview = reports.find(report => number(report.season) === seasonYear() && number(report.week) === weekNumber()) || null;
  }
  return { fixture, context, preview };
}

function weatherLabel(weather = {}) {
  const condition = titleCase(pick(weather, ['condition'], 'forecast unavailable'));
  const temperature = pick(weather, ['temperature'], null);
  return `${condition}${temperature == null ? '' : ` · ${formatDecimal(temperature, 0)}°C`}`;
}

function matchdayPreviewMarkup(preview, context) {
  if (!preview) return context?.planningOnly ? '<div class="empty-state"><strong>Home-event plan ready</strong><p>The attendance, weather and revenue forecast appears when a senior fixture is scheduled.</p></div>' : '<div class="empty-state"><strong>Operations preview unavailable</strong><p>Save the matchday plan or advance to a scheduled fixture to create a forecast.</p></div>';
  const home = context.venue === 'home';
  const capacity = Math.max(1, number(preview.capacity, context.capacity));
  const attendance = number(preview.attendance);
  const net = number(preview.netRevenue);
  const weather = preview.weather || {};
  return `<div class="operations-preview"><div class="forecast-banner"><span class="weather-icon"><i class="ti ${weather.condition === 'heavy-rain' || weather.condition === 'showers' ? 'ti-cloud-rain' : weather.condition === 'hot' ? 'ti-sun-high' : weather.condition === 'windy' ? 'ti-wind' : 'ti-cloud-sun'}" aria-hidden="true"></i></span><div><small>Matchday forecast</small><strong>${escapeHtml(weatherLabel(weather))}</strong><span>${number(weather.rainChance)}% rain · ${number(weather.windKph)} km/h wind</span></div><b>${home ? 'Home event' : 'Away travel'}</b></div><div class="attendance-forecast"><header><span><strong>${attendance.toLocaleString('en-AU')}</strong> expected</span><small>${home ? `${Math.round((attendance / capacity) * 100)}% of ${capacity.toLocaleString('en-AU')} capacity` : `${number(context.travelKm).toLocaleString('en-AU')} km journey`}</small></header><i><b style="width:${home ? clamp((attendance / capacity) * 100) : 0}%"></b></i></div><div class="revenue-breakdown"><div><span>Tickets</span><strong>${formatMoney(preview.ticketRevenue, true)}</strong></div><div><span>Hospitality</span><strong>${formatMoney(preview.hospitalityRevenue, true)}</strong></div><div><span>Concessions</span><strong>${formatMoney(preview.concessionRevenue, true)}</strong></div><div><span>Travel</span><strong class="negative">−${formatMoney(preview.travelCost, true)}</strong></div><div><span>Operations</span><strong class="negative">−${formatMoney(Math.max(0, number(preview.operatingCost) - number(preview.travelCost)), true)}</strong></div><div class="net"><span>Forecast net</span><strong class="${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : ''}${formatMoney(net, true)}</strong></div></div><div class="pitch-forecast"><span><small>Pitch before</small><strong>${number(preview.pitchConditionBefore)}%</strong></span><i><b style="width:${clamp(preview.pitchConditionAfter)}%"></b></i><span><small>After match</small><strong>${number(preview.pitchConditionAfter)}%</strong></span><span><small>Supporter satisfaction</small><strong>${number(preview.satisfaction)}%</strong></span></div></div>`;
}

function refreshMatchdayPreview() {
  const mount = $('[data-matchday-preview]');
  if (!mount) return;
  const { context, preview } = matchdayPreview(matchdayFormPlan());
  mount.innerHTML = matchdayPreviewMarkup(preview, context);
}

function matchdayOperationsView() {
  const plan = matchdayPlanModel();
  const { fixture, context, preview } = matchdayPreview(plan);
  const opponent = fixture ? (fixture.home.isPlayer ? fixture.away : fixture.home) : null;
  const planningOnly = Boolean(context.planningOnly || !fixture);
  const home = planningOnly || context.venue === 'home';
  const pitchCondition = number(pick(careerWorldModel(), ['matchday.pitchCondition'], 82), 82);
  const reports = asArray(pick(careerWorldModel(), ['matchday.reports'], [])).slice(-6).reverse();
  return `${viewHeading('Matchday operations', 'Set ticket value, hospitality, staffing, security, pitch preparation, promotion and supporter travel support.', fixture ? `<button type="button" class="fm-button primary" data-open-view="match-centre">Prepare football team</button>` : '')}
    <section class="operations-kickoff surface"><div>${fixture ? `${fixture.home.isPlayer ? userCrestMarkup('mini-crest') : opponentCrestMarkup(fixture.home, 'mini-crest')}<span><small>${escapeHtml(fixture.competition)} · W${fixture.week}</small><strong>${escapeHtml(fixture.home.name)} v ${escapeHtml(fixture.away.name)}</strong><p>${escapeHtml(fixture.venue || (home ? clubModel().site?.name || 'Home ground' : 'Away ground'))}</p></span>${fixture.away.isPlayer ? userCrestMarkup('mini-crest') : opponentCrestMarkup(fixture.away, 'mini-crest')}` : '<span><small>Club operations</small><strong>No senior fixture scheduled</strong><p>Your saved home-event plan carries to the next fixture.</p></span>'}</div><dl><div><dt>Venue</dt><dd>${planningOnly ? 'Planning only' : home ? 'Home' : 'Away'}</dd></div><div><dt>Pitch</dt><dd>${pitchCondition}%</dd></div><div><dt>Travel</dt><dd>${planningOnly ? 'Planning only' : number(context.travelKm) ? `${number(context.travelKm).toLocaleString('en-AU')} km` : home ? 'Home event' : 'Not recorded'}</dd></div><div><dt>Opponent</dt><dd>${escapeHtml(opponent?.name || '—')}</dd></div></dl></section>
    <section class="operations-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Event plan</h2><small>${planningOnly ? 'Default home-event settings' : home ? 'Home commercial and venue controls' : 'Away fixture · home settings carry forward'}</small></header><div class="operations-controls"><label><span><strong>Adult ticket</strong><output data-matchday-ticket-output>${formatMoney(plan.ticketPrice)}</output></span><input type="range" min="5" max="80" step="1" value="${plan.ticketPrice}" data-matchday-ticket ${home ? '' : 'disabled'}><small>Higher prices reduce demand and supporter satisfaction.</small></label><label><span><strong>Hospitality seat</strong><output data-matchday-hospitality-output>${formatMoney(plan.hospitalityPrice)}</output></span><input type="range" min="25" max="350" step="5" value="${plan.hospitalityPrice}" data-matchday-hospitality ${home ? '' : 'disabled'}><small>Clubhouse capacity turns premium demand into revenue.</small></label><label><span><strong>Concession spend per fan</strong><output data-matchday-concession-output>${formatMoney(plan.concessionSpend)}</output></span><input type="range" min="0" max="50" step="1" value="${plan.concessionSpend}" data-matchday-concession ${home ? '' : 'disabled'}><small>Estimated food, drink and merchandise basket.</small></label><label><span><strong>Promotion spend</strong><output data-matchday-promotion-output>${formatMoney(plan.promotionSpend)}</output></span><input type="range" min="0" max="10000" step="250" value="${plan.promotionSpend}" data-matchday-promotion ${home ? '' : 'disabled'}><small>Community promotion can lift expected attendance.</small></label><label><span><strong>Supporter transport subsidy</strong><output data-matchday-transport-output>${formatMoney(plan.transportSubsidy)}</output></span><input type="range" min="0" max="5000" step="100" value="${plan.transportSubsidy}" data-matchday-transport><small>Improves access and supporter sentiment for home and away travel.</small></label><label><span><strong>Event staffing</strong><output>${plan.staffing}/5</output></span><input type="range" min="1" max="5" step="1" value="${plan.staffing}" data-matchday-staffing></label><label><span><strong>Security</strong><output>${plan.security}/5</output></span><input type="range" min="1" max="5" step="1" value="${plan.security}" data-matchday-security></label><label><span><strong>Pitch preparation</strong><output>${plan.pitchPrep}/5</output></span><input type="range" min="1" max="5" step="1" value="${plan.pitchPrep}" data-matchday-pitch ${home ? '' : 'disabled'}></label></div><footer class="panel-footer"><span>The preview updates as controls move; save before continuing the week.</span><button type="button" class="fm-button primary" data-save-matchday-plan>Save matchday plan</button></footer></article>
      <article class="surface"><header class="section-head"><h2>Recent event reports</h2><small>Attendance, pitch wear and net return</small></header>${reports.length ? `<div class="table-scroll"><table class="operations-report-table"><thead><tr><th>Week</th><th>Opponent</th><th>Attendance</th><th>Weather</th><th>Pitch</th><th>Satisfaction</th><th>Net</th></tr></thead><tbody>${reports.map(report => `<tr><td>${report.season} · W${report.week}</td><td>${escapeHtml(report.opponentName)}</td><td>${number(report.attendance).toLocaleString('en-AU')} / ${number(report.capacity).toLocaleString('en-AU')}</td><td>${escapeHtml(weatherLabel(report.weather))}</td><td>${number(report.pitchConditionBefore)} → ${number(report.pitchConditionAfter)}%</td><td>${number(report.satisfaction)}%</td><td class="${number(report.netRevenue) >= 0 ? 'credit' : 'debit'}">${number(report.netRevenue) >= 0 ? '+' : ''}${formatMoney(report.netRevenue, true)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><strong>No completed event report</strong><p>Attendance, revenue, weather and pitch wear are recorded after each managed matchday.</p></div>'}</article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Live forecast</h3><small>${planningOnly ? 'Waiting for a scheduled fixture' : `${home ? 'Home' : 'Away'} v ${escapeHtml(opponent.name)}`}</small></header><div data-matchday-preview>${matchdayPreviewMarkup(preview, context)}</div></article><article class="surface"><header class="section-head"><h3>Operations trade-offs</h3></header><ul class="decision-checklist"><li><i class="ti ti-ticket" aria-hidden="true"></i><span><strong>Price versus reach</strong><small>Affordable tickets improve demand and trust.</small></span></li><li><i class="ti ti-tools-kitchen-2" aria-hidden="true"></i><span><strong>Hospitality and concessions</strong><small>Facility quality creates secondary revenue.</small></span></li><li><i class="ti ti-cloud-rain" aria-hidden="true"></i><span><strong>Weather and pitch</strong><small>Rain suppresses demand and increases pitch wear.</small></span></li><li><i class="ti ti-bus" aria-hidden="true"></i><span><strong>Travel</strong><small>Distance, party size and subsidies affect weekly cost.</small></span></li></ul></article></aside>
    </section>`;
}

function academyBenchmarkMarkup() {
  return `<div class="academy-table-explainer"><strong>Official 2026 assessment reference</strong><p>This is not a match table. “Official rank” and “2026 score” are Football Queensland's frozen published values; results in your save never change them.</p><div><span class="rating-pill gold">Gold</span><span class="rating-pill silver">Silver</span><span class="rating-pill bronze">Bronze</span><span class="rating-pill development-committed">Development Committed</span></div></div><div class="academy-benchmark-scroll"><table class="league-table academy-benchmark-table"><thead><tr><th>Official rank</th><th>2026 Queensland club</th><th>FQ rating</th><th>2026 score</th></tr></thead><tbody>${ACADEMY_RANKINGS_2026.map(row => `<tr><td><strong>#${row.rank}</strong></td><td><div class="club-cell">${opponentCrestMarkup({ id: row.clubId, clubId: row.clubId, name: row.name })}<span>${escapeHtml(row.name)}</span></div></td><td><span class="rating-pill ${escapeHtml(row.rating)}">${escapeHtml(titleCase(row.rating))}</span></td><td><strong>${row.rankScore.toFixed(1)}</strong></td></tr>`).join('')}</tbody></table></div>`;
}

function academyView() {
  const academy = academyModel();
  const academyRows = normalizedTableRows('academy');
  const academyClub = academyRows.find(row => row.isPlayer || row.name === clubModel().name) || {};
  const assessment = pick(academy, ['assessment', 'services'], {}) || {};
  const fee = financeModel().academyFee;
  const band = ACADEMY_FEE_BANDS[academyLeagueId()] || ACADEMY_FEE_BANDS['fqa-4'];
  const ratingIndex = Math.max(0, ACADEMY_RATING_ORDER.findIndex(item => item.id === academyRatingId()));
  const criteria = [
    ['Coaching', number(pick(assessment, ['coaching', 'coachingQuality'], 41)), 'Qualifications, staff coverage and player contact.'],
    ['Safeguarding', number(pick(assessment, ['safeguarding', 'governance', 'operations'], 46)), 'Player welfare, safeguarding and club administration.'],
    ['Facilities', number(pick(assessment, ['facilities', 'facilityQuality'], 35)), 'Safe pitches, equipment and development spaces.'],
    ['Equipment', number(pick(assessment, ['equipment'], 30)), 'Training equipment, analysis, gym and medical support.'],
    ['Player pathway', number(pick(assessment, ['pathway', 'playerPathway'], 38)), 'Movement between age groups and senior football.'],
    ['Affordability', number(pick(assessment, ['affordability'], 60)), 'Fees, scholarships and access for local families.'],
    ['Retention', number(pick(assessment, ['retention'], 55)), 'Player satisfaction and year-to-year continuity.'],
    ['Female participation', number(pick(assessment, ['femaleCompliance'], 30)), 'Abstract access and participation compliance for this simulation.']
  ];
  const feePosition = fee < band.minAud ? 'below the usual band' : fee > band.maxAud ? 'above the usual band' : 'inside the usual band';
  const role = pick(footballState, ['managerRole', 'role'], 'club-manager');
  const eligibleDual = academyLeagueId() === 'fqa-1';
  const academyGroupLabel = academyTableGroupLabel();
  const attendance = academy.lastTrainingAttendance || {};
  return `${viewHeading('Academy', `Follow the live ${academyLeagueName()} season and develop the players and services behind it.`, `<button type="button" class="fm-button primary" data-open-view="match-centre">Academy fixtures</button>`)}
    <section class="stat-strip"><div><span>${academyGroupLabel} position</span><strong>${academyClub.position || '—'}</strong><small>of ${academyRows.length}</small></div><div><span>Points</span><strong>${academyClub.points || 0}</strong><small>${academyClub.played || 0} of 27 played</small></div><div><span>Record</span><strong>${academyClub.wins || 0}-${academyClub.draws || 0}-${academyClub.losses || 0}</strong><small>W-D-L</small></div><div><span>Training attendance</span><strong>${attendance.total ? `${number(attendance.attended)}/${number(attendance.total)}` : '—'}</strong><small>${attendance.schoolBreak ? 'School-break programme' : 'Latest available squad'}</small></div><div><span>Competition</span><strong>${escapeHtml(academyLeagueId().toUpperCase())}</strong><small>${academyTableGroup === 'all' ? 'Five teams combined' : escapeHtml(academyGroupLabel)}</small></div></section>
    <section class="surface academy-results-panel"><header class="section-head"><div><h2>${escapeHtml(academyLeagueName())} · ${escapeHtml(academyGroupLabel)}</h2><small>${academyTableGroup === 'all' ? 'Combined record across U13, U14, U15, U16 and U18' : 'Independent 27-match playing-season standings'}</small></div><button type="button" data-open-view="match-centre">Fixtures & results</button></header>${academyTableSelectorMarkup()}${leagueTableMarkup(academyRows)}<footer class="league-footer"><span>${academyTableGroup === 'all' ? 'This combined view totals all five age-group records.' : `${escapeHtml(academyGroupLabel)} results are separate from every other academy age group.`} Weekend league matches pause during Queensland school breaks; training continues with variable attendance, and rain-outs return as midweek make-ups.</span><button type="button" data-open-view="fq-assessment">Assessment details</button></footer></section>
    <section class="surface"><header class="section-head"><h2>Academy player pathway</h2><small>Open a player profile to set an individual focus or promote them to the U23 squad</small></header>${playerTableMarkup('academy')}</section>
    <section class="academy-hero"><div class="academy-rating"><span>End-of-season service rating</span><strong>${escapeHtml(academyRatingName())}</strong><small>${escapeHtml(academyLeagueName())}</small></div><div class="rating-pathway">${ACADEMY_RATING_ORDER.map((rating, index) => `<div class="path-step${index < ratingIndex ? ' complete' : index === ratingIndex ? ' current' : ''}"><i>${index < ratingIndex ? '✓' : index + 1}</i><strong>${escapeHtml(rating.name)}</strong><small>${index === ratingIndex ? 'Current' : index < ratingIndex ? 'Achieved' : 'Service target'}</small></div>`).join('')}</div></section>
    <section class="academy-grid">
      <div class="detail-stack"><article class="surface"><header class="section-head"><h2>Service assessment</h2><span>Simulated FQ review</span></header><div class="assessment-grid">${criteria.map(([name, score, description]) => `<article class="assessment-item"><header><strong>${escapeHtml(name)}</strong><b>${score}/100</b></header><p>${escapeHtml(description)}</p><div class="status-meter"><i style="width:${Math.max(0, Math.min(100, score))}%"></i></div></article>`).join('')}</div></article>
        <details class="surface academy-season-reference"><summary><span><strong>End-of-season FQ assessment reference</strong><small>Optional published 2026 comparison · 44 clubs</small></span></summary>${academyBenchmarkMarkup()}<footer class="league-footer"><span>This reference does not affect the live league table. Your service assessment is applied at season end.</span><a href="${escapeHtml(FOOTBALL_DATA_SOURCES.academyRankScores.url)}" target="_blank" rel="noreferrer">Official source</a></footer></details></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Season pricing</h3><small>Allowed range $0–$15,000</small></header><div class="fee-control"><small>${escapeHtml(band.league)} suggested market band: ${formatMoney(band.minAud)}–${formatMoney(band.maxAud)}</small><output data-academy-fee-output>${formatMoney(fee)}</output><input type="range" min="0" max="15000" step="100" value="${fee}" data-academy-fee><p>Your fee is ${feePosition}. A $0 fee maximises access but earns no fee revenue; very high pricing narrows the pool toward wealthier families.</p></div><div class="academy-actions"><button type="button" class="fm-button primary" data-save-academy-fee>Set season fee</button></div></article>
        <article class="surface"><header class="section-head"><h3>Academy pathway</h3></header><dl class="metric-list"><div><dt>Boys age groups</dt><dd>U13, U14, U15, U16, U18</dd></div><div><dt>Weekend programme</dt><dd>27 term-time rounds</dd></div><div><dt>School breaks</dt><dd>Training only · variable attendance</dd></div>${academy.secondaryLeagueId ? `<div><dt>Dual second stream</dt><dd>${escapeHtml(ACADEMY_FEE_BANDS[academy.secondaryLeagueId]?.league || academy.secondaryLeagueId.toUpperCase())}</dd></div>` : ''}<div><dt>Trial interest</dt><dd>${pick(academy, ['trialInterest', 'trials.interest'], null) == null ? 'Not measured' : `${number(pick(academy, ['trialInterest', 'trials.interest'], 0))}/100`}</dd></div><div><dt>Talent reach</dt><dd>${pick(academy, ['talentReach', 'trials.talent'], null) == null ? 'Not assessed' : `${number(pick(academy, ['talentReach', 'trials.talent'], 0))}/100`}</dd></div></dl><div class="academy-actions">${eligibleDual ? `<button type="button" class="fm-button primary" data-purchase-dual-rating>Buy dual rating · ${formatMoney(FOOTBALL_GAME_ASSUMPTIONS.dualRatingFeeAud)}</button>` : '<button type="button" class="fm-button" disabled>Dual rating unlocks at FQA 1</button>'}${academy.femaleProgramme ? '<button type="button" class="fm-button" disabled>Participation programme active</button>' : '<button type="button" class="fm-button" data-fund-female-programme>Fund participation programme · $50k</button>'}</div></article>
        <article class="surface coach-card"><div><span class="player-avatar">AD</span><span><strong>Academy coaching</strong><small>Development programme</small></span></div><p>${role === 'academy-coach' ? 'You are directly responsible for academy sessions and player development.' : 'Take an academy coaching role while the board systems continue to run.'}</p><button type="button" class="fm-button" data-set-manager-role="academy-coach" ${role === 'academy-coach' ? 'disabled' : ''}>${role === 'academy-coach' ? 'Current role' : 'Coach academy'}</button></article></aside>
    </section>`;
}

function fqAssessmentView() {
  const academy = academyModel();
  const assessment = pick(academy, ['assessment', 'services'], {}) || {};
  const score = number(pick(academy, ['score'], pick(assessment, ['total', 'score', 'rankScore'], 40)));
  const ratingIndex = Math.max(0, ACADEMY_RATING_ORDER.findIndex(item => item.id === academyRatingId()));
  const criteria = [
    ['Coaching', number(pick(assessment, ['coaching', 'coachingQuality'], 41))],
    ['Safeguarding', number(pick(assessment, ['safeguarding', 'governance', 'operations'], 46))],
    ['Facilities', number(pick(assessment, ['facilities', 'facilityQuality'], 35))],
    ['Equipment', number(pick(assessment, ['equipment'], 30))],
    ['Player pathway', number(pick(assessment, ['pathway', 'playerPathway'], 38))],
    ['Affordability', number(pick(assessment, ['affordability'], 60))],
    ['Retention', number(pick(assessment, ['retention'], 55))],
    ['Female participation', number(pick(assessment, ['femaleCompliance'], 30))]
  ];
  return `${viewHeading('FQ assessment', 'Improve the services behind your academy, then submit the club for simulated annual placement. Published 2026 comparison scores are immutable.', `<button type="button" class="fm-button primary" data-assess-academy>Submit assessment</button>`)}
    <section class="academy-hero"><div class="academy-rating"><span>Simulated club score</span><strong>${score.toFixed(1)}</strong><small>${escapeHtml(academyRatingName())} · ${escapeHtml(academyLeagueName())}</small></div><div class="rating-pathway">${ACADEMY_RATING_ORDER.map((rating, index) => `<div class="path-step${index < ratingIndex ? ' complete' : index === ratingIndex ? ' current' : ''}"><i>${index < ratingIndex ? '✓' : index + 1}</i><strong>${escapeHtml(rating.name)}</strong><small>${index === ratingIndex ? 'Current' : index < ratingIndex ? 'Achieved' : 'Target'}</small></div>`).join('')}</div></section>
    <section class="squad-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Service evidence</h2><small>Fictional assessment model</small></header><div class="assessment-grid">${criteria.map(([name, value]) => `<article class="assessment-item"><header><strong>${escapeHtml(name)}</strong><b>${value}/100</b></header><p>Upgrade related staff, facilities and weekly delivery to strengthen this service area.</p><div class="status-meter"><i style="width:${Math.min(100, Math.max(0, value))}%"></i></div></article>`).join('')}</div></article><article class="surface"><header class="section-head"><h2>Published 2026 club scores</h2><small>Provisional v3 · source values unchanged</small></header>${academyBenchmarkMarkup(ACADEMY_RANKINGS_2026.length)}<footer class="league-footer"><span>Real club names and published scores are reference data.</span><a href="${escapeHtml(FOOTBALL_DATA_SOURCES.academyRankScores.url)}" target="_blank" rel="noreferrer">Football Queensland source</a></footer></article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Assessment rules</h3></header><dl class="metric-list"><div><dt>Current rating</dt><dd>${escapeHtml(academyRatingName())}</dd></div><div><dt>Current league</dt><dd>${escapeHtml(academyLeagueName())}</dd></div><div><dt>Placement basis</dt><dd>Club services</dd></div><div><dt>League results</dt><dd>Not promotion</dd></div></dl></article><article class="surface"><header class="section-head"><h3>Dual-rating route</h3></header><div class="control-list"><p>At FQA 1, a dual-rating fee opens an FQA 1 and FQA 4 structure. Long-term service growth can support FQA 1 and FQA 2 sides.</p><button type="button" class="fm-button primary" data-purchase-dual-rating ${academyLeagueId() === 'fqa-1' ? '' : 'disabled'}>Dual rating · ${formatMoney(FOOTBALL_GAME_ASSUMPTIONS.dualRatingFeeAud)}</button></div></article></aside>
    </section>`;
}

function fixtureRowMarkup(fixture) {
  const when = fixture.date ? new Date(fixture.date) : null;
  const dateText = when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : `Week ${fixture.week}`;
  const scheduleText = fixture.rescheduled ? 'Midweek make-up' : fixture.scheduledDay || '';
  const canSimulate = !fixture.played && fixture.canSimulate;
  const teamLabel = fixture.team === 'academy' ? 'Academy' : fixture.team === 'u23' ? 'U23' : fixture.team === 'b' ? 'B team' : 'First team';
  return `<li class="fixture-row${canSimulate ? ' next' : ''}"><time>${escapeHtml(dateText)}<br>${escapeHtml(scheduleText || teamLabel)}${scheduleText ? `<br>${escapeHtml(teamLabel)}` : ''}</time><div>${fixture.home.isPlayer ? userCrestMarkup('table-crest') : opponentCrestMarkup(fixture.home)}<strong>${escapeHtml(fixture.home.name)}<br><small>v</small><br>${escapeHtml(fixture.away.name)}</strong>${fixture.away.isPlayer ? userCrestMarkup('table-crest') : opponentCrestMarkup(fixture.away)}</div>${fixture.played ? `<span class="fixture-result"><b>${fixture.homeScore}–${fixture.awayScore}</b><button type="button" class="text-action" data-open-match-report="${escapeHtml(fixture.id)}">Report</button></span>` : canSimulate ? `<span class="fixture-result"><button type="button" data-watch-match data-simulate-match="${escapeHtml(fixture.id)}">Watch</button><button type="button" data-simulate-match="${escapeHtml(fixture.id)}" title="Use the selected Match view">Simulate</button></span>` : '<b>—</b>'}</li>`;
}

function squadSelection(squad = 'first') {
  try {
    if (typeof FootballEngine.getSquad === 'function') return FootballEngine.getSquad(footballState, squad);
  } catch {}
  return pick(footballState, [`squads.${squad}`], { formation: '4-3-3', lineup: [], bench: [], players: [] });
}

function preMatchPanelMarkup() {
  const selection = squadSelection('first');
  const selected = new Set(asArray(selection.lineup));
  const fixture = nextFixture('senior');
  return `<section class="pre-match-grid">
    <article class="surface"><header class="section-head"><h2>Team sheet</h2><small>Select exactly 11 · changes persist</small></header><div class="match-plan-controls"><label>Formation<select data-match-formation>${['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'].map(formation => `<option value="${formation}"${formation === selection.formation ? ' selected' : ''}>${formation}</option>`).join('')}</select></label><label>Tactical style<select data-match-style>${PLAYING_STYLES.filter(style => style.id !== 'youth-first').map(style => `<option value="${style.id}"${style.id === activeStyleId() ? ' selected' : ''}>${escapeHtml(style.name)}</option>`).join('')}</select></label><label>Match view<select data-match-speed><option value="visual"${matchSpeed === 'visual' ? ' selected' : ''}>Visual · 20-second halves</option><option value="instant"${matchSpeed === 'instant' ? ' selected' : ''}>Instant result</option></select></label><button type="button" class="fm-button primary" data-save-match-plan>Save match plan</button></div><div class="lineup-picker">${asArray(selection.players).map((player, index) => `<label class="lineup-player${selected.has(player.id) ? ' selected' : ''}"><input type="checkbox" value="${escapeHtml(player.id)}" data-lineup-player ${selected.has(player.id) ? 'checked' : ''}><span class="position-mark">#${number(player.squadNumber, index + 1)}<small>${escapeHtml(player.position)}</small></span><span><strong>${escapeHtml(player.name)}</strong><small>${selected.has(player.id) ? 'Starting XI' : asArray(selection.bench).includes(player.id) ? 'Bench' : 'Reserve'}</small></span><b>${number(player.rating)}</b></label>`).join('')}</div></article>
    <aside class="surface pre-match-summary"><header class="section-head"><h3>Next match</h3></header>${fixture ? `<div>${fixture.home.isPlayer ? userCrestMarkup() : opponentCrestMarkup(fixture.home, 'mini-crest')}<span><small>${escapeHtml(fixture.competition)}</small><strong>${escapeHtml(fixture.home.name)}<br>v<br>${escapeHtml(fixture.away.name)}</strong><small>${escapeHtml(fixture.home.isPlayer ? 'Home' : 'Away')} · Week ${fixture.week}</small></span>${fixture.away.isPlayer ? userCrestMarkup() : opponentCrestMarkup(fixture.away, 'mini-crest')}</div><button type="button" class="fm-button primary" data-watch-match data-simulate-match="${escapeHtml(fixture.id)}" ${fixture.canSimulate ? '' : 'disabled'}>${fixture.canSimulate ? 'Watch match · halftime decisions' : `Available in week ${fixture.week}`}</button>` : '<div class="empty-state"><strong>No fixture ready</strong><p>The season schedule is complete or the club has a bye.</p></div>'}</aside>
  </section>`;
}

function fixturesView() {
  const all = fixtures();
  const filtered = fixtureFilter === 'all' ? all : all.filter(item => item.team === fixtureFilter);
  const upcoming = filtered.filter(item => !item.played).slice(0, 8);
  const results = filtered.filter(item => item.played).slice(-8).reverse();
  return `${viewHeading('Match centre', 'Set the formation and XI, then watch 20-second halves on the pitch or choose an instant result.', `<button type="button" class="fm-button" data-settle-season>Season review</button>`)}
    ${preMatchPanelMarkup()}
    <div class="fixture-filters surface"><button type="button" class="${fixtureFilter === 'all' ? 'active' : ''}" data-fixture-filter="all">All teams</button><button type="button" class="${fixtureFilter === 'senior' ? 'active' : ''}" data-fixture-filter="senior">First team</button><button type="button" class="${fixtureFilter === 'u23' ? 'active' : ''}" data-fixture-filter="u23">U23</button><button type="button" class="${fixtureFilter === 'academy' ? 'active' : ''}" data-fixture-filter="academy">Academy</button>${footballState?.b ? `<button type="button" class="${fixtureFilter === 'b' ? 'active' : ''}" data-fixture-filter="b">B team</button>` : ''}</div>
    <section class="fixtures-layout"><article class="surface"><header class="section-head"><h2>Upcoming</h2><small>${upcoming.length} fixtures</small></header>${upcoming.length ? `<ul class="fixture-list">${upcoming.map(fixtureRowMarkup).join('')}</ul>` : '<div class="empty-state"><strong>No upcoming fixtures</strong><p>The selected team has completed its current schedule.</p></div>'}</article><article class="surface"><header class="section-head"><h2>Results</h2><small>Latest first</small></header>${results.length ? `<ul class="fixture-list">${results.map(fixtureRowMarkup).join('')}</ul>` : '<div class="empty-state"><strong>Opening round</strong><p>Results will appear here after your first match simulation.</p></div>'}</article></section>`;
}

function trainingCap() {
  if (typeof FootballEngine.academyTrainingRequirement === 'function') {
    try { return number(FootballEngine.academyTrainingRequirement(footballState), 2); } catch {}
  }
  const league = academyLeagueId();
  const years = number(pick(academyModel(), ['seasonsInLeague', 'yearsInLeague', 'yearsAtLevel'], 0));
  if (league === 'fqa-4') return 2;
  if (league === 'fqa-3') return years >= 2 ? 3 : 2;
  return 3;
}

function trainingView() {
  const schedule = trainingSchedule();
  const players = squadPlayers('senior');
  const avgFatigue = Math.round(players.reduce((sum, item) => sum + item.fatigue, 0) / Math.max(1, players.length));
  const academySessions = schedule.academy.filter(type => !['rest', 'recovery'].includes(type)).length;
  const targetSessions = trainingCap();
  const selectOptions = (team, index) => SESSION_OPTIONS.map(([id, label]) => `<option value="${id}"${schedule[team][index] === id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
  const intensityOptions = current => TRAINING_INTENSITIES.map(intensity => `<option value="${intensity.id}"${intensity.id === current ? ' selected' : ''}>${escapeHtml(intensity.name)} · development × ${intensity.development} · fatigue × ${intensity.fatigue}</option>`).join('');
  const firstIntensity = pick(seniorModel(), ['training.intensity'], 'normal');
  const u23Intensity = pick(footballState, ['u23.training.intensity'], 'normal');
  const academyIntensity = pick(academyModel(), ['training.intensity'], 'normal');
  return `${viewHeading('Training', 'Build the week around match preparation, player growth and recovery. Intensity creates gains but fatigue carries into match day.', `<button type="button" class="fm-button primary" data-save-training>Save weekly schedule</button>`)}
    <section class="training-layout"><article class="surface training-builder"><header class="section-head"><h2>Weekly programme</h2><small>Academy target: ${targetSessions} sessions · selected ${academySessions}${academySessions > targetSessions ? ' · overload risk' : ''}</small></header><div class="training-intensity-controls"><label>First-team intensity<select data-training-intensity="first">${intensityOptions(firstIntensity)}</select></label><label>U23 intensity<select data-training-intensity="u23">${intensityOptions(u23Intensity)}</select></label><label>Academy intensity<select data-training-intensity="academy">${intensityOptions(academyIntensity)}</select></label></div><div class="session-grid">${DAY_NAMES.map((day, index) => `<article class="day-session"><header><strong>${day.slice(0, 3)}</strong><small>Day ${index + 1}</small></header><label>First team<select data-training-team="senior" data-training-day="${index}">${selectOptions('senior', index)}</select></label><label>U23<select data-training-team="u23" data-training-day="${index}">${selectOptions('u23', index)}</select></label><label>Academy<select data-training-team="academy" data-training-day="${index}">${selectOptions('academy', index)}</select></label><p class="session-impact">${index >= 5 ? 'Protect recovery around weekend fixtures.' : 'Technical work develops players; fitness raises short-term fatigue.'}</p></article>`).join('')}</div><div class="fatigue-summary"><div><span>Senior fatigue</span><strong>${avgFatigue}% · ${avgFatigue < 30 ? 'Controlled' : 'Elevated'}</strong></div><div><span>Academy target</span><strong>${academySessions} selected / ${targetSessions} expected</strong></div><div><span>Load rule</span><strong>Extra sessions allowed · fatigue rises</strong></div></div></article>
      <article class="surface"><header class="section-head"><h2>Football identity</h2><small>Applies across first-team match preparation</small></header><div class="style-board">${PLAYING_STYLES.filter(style => style.id !== 'youth-first').map(style => `<button type="button" class="style-option${style.id === activeStyleId() ? ' active' : ''}" data-playing-style="${style.id}"><strong>${escapeHtml(style.name)}</strong><small>${escapeHtml(style.description)}</small><span>Fatigue × ${style.fatigue.toFixed(2)}</span></button>`).join('')}</div></article></section>`;
}

function coachDeskView() {
  const role = pick(footballState, ['managerRole', 'role'], 'club-manager');
  const roleProfile = managerRoleProfile(role);
  const seniorPlayers = squadPlayers('senior');
  const academyPlayers = squadPlayers('academy');
  const seniorFatigue = Math.round(seniorPlayers.reduce((sum, player) => sum + player.fatigue, 0) / Math.max(1, seniorPlayers.length));
  const academyFatigue = Math.round(academyPlayers.reduce((sum, player) => sum + player.fatigue, 0) / Math.max(1, academyPlayers.length));
  const fixture = nextFixture(activeCoachSquad === 'first' ? 'senior' : activeCoachSquad);
  const coachHolder = activeCoachSquad === 'academy' ? academyModel() : activeCoachSquad === 'u23' ? footballState?.u23 || {} : seniorModel();
  const coachStyleId = pick(coachHolder, ['styleId', 'playingStyle'], activeStyleId());
  const coachSelection = squadSelection(activeCoachSquad);
  const coachSelected = new Set(asArray(coachSelection.lineup));
  const coachLineup = `<article class="surface"><header class="section-head"><h2>Selection & roles</h2><small>Choose exactly 11 available players</small></header><div class="match-plan-controls coach-lineup-controls"><label>Formation<select data-coach-formation>${['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'].map(formation => `<option value="${formation}"${formation === coachSelection.formation ? ' selected' : ''}>${formation}</option>`).join('')}</select></label><button type="button" class="fm-button primary" data-save-coach-lineup>Save starting XI</button></div><div class="lineup-picker">${asArray(coachSelection.players).map(player => `<label class="lineup-player${coachSelected.has(player.id) ? ' selected' : ''}"><input type="checkbox" value="${escapeHtml(player.id)}" data-coach-lineup-player ${coachSelected.has(player.id) ? 'checked' : ''} ${player.injuryWeeks ? 'disabled' : ''}><span class="position-mark">${escapeHtml(player.position)}</span><span><strong>${escapeHtml(player.name)}</strong><small>${player.injuryWeeks ? `Injured · ${number(player.injuryWeeks)}w` : coachSelected.has(player.id) ? 'Starting XI' : asArray(coachSelection.bench).includes(player.id) ? 'Bench' : 'Reserve'}</small></span><b>${number(player.rating)}</b></label>`).join('')}</div></article>`;
  const targetRole = activeCoachSquad === 'academy' ? 'academy-coach' : activeCoachSquad === 'u23' ? 'u23-coach' : 'first-team-coach';
  return `${viewHeading('Coach desk', 'Choose which team to coach, set the football identity and balance performance boosts against the fatigue they create.', fixture ? `<button type="button" class="fm-button primary" data-watch-match data-simulate-match="${escapeHtml(fixture.id)}" ${fixture.canSimulate ? '' : 'disabled'}>${fixture.canSimulate ? 'Take team to match' : `Match in W${fixture.week}`}</button>` : '')}
    <div class="team-tabs surface"><button type="button" class="${activeCoachSquad === 'first' ? 'active' : ''}" data-coach-squad="first">First team</button><button type="button" class="${activeCoachSquad === 'u23' ? 'active' : ''}" data-coach-squad="u23">U23 / reserve</button><button type="button" class="${activeCoachSquad === 'academy' ? 'active' : ''}" data-coach-squad="academy">Academy</button></div>
    <section class="stat-strip"><div><span>Current role</span><strong>${escapeHtml(roleProfile.title)}</strong><small>${escapeHtml(roleProfile.focus)}</small></div><div><span>Senior fatigue</span><strong>${seniorFatigue}%</strong><small>${seniorFatigue > 35 ? 'Rotation advised' : 'Controlled'}</small></div><div><span>Academy fatigue</span><strong>${academyFatigue}%</strong><small>${trainingCap()} sessions expected</small></div><div><span>Style</span><strong>${escapeHtml(PLAYING_STYLES.find(style => style.id === activeStyleId())?.name || titleCase(activeStyleId()))}</strong><small>Club football identity</small></div><div><span>Next match</span><strong>${fixture ? `W${fixture.week}` : '—'}</strong><small>${escapeHtml(fixture ? `${fixture.home.name} v ${fixture.away.name}` : 'No fixture')}</small></div></section>
    <article class="surface role-impact-panel"><div><span class="role-impact-icon"><i class="ti ti-user-cog" aria-hidden="true"></i></span><span><small>Active responsibility model</small><strong>${escapeHtml(roleProfile.title)}</strong><p>${escapeHtml(roleProfile.summary)}</p></span></div><div><span><strong>You decide</strong><small>${escapeHtml(roleProfile.direct.join(' · '))}</small></span><span><strong>Delegated to staff</strong><small>${escapeHtml(roleProfile.delegated.join(' · '))}</small></span></div></article>
    <section class="squad-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Coaching assignment</h2><small>Changing role changes which departments advance automatically</small></header><div class="team-snapshots"><article class="team-snapshot"><div><span class="team-snapshot-icon">1</span><span><small>First-team role</small><strong>Senior coach</strong></span></div><span><small>Squad</small><strong>${seniorPlayers.length}</strong></span><span><small>Fatigue</small><strong>${seniorFatigue}%</strong></span><span><button type="button" class="fm-button" data-set-manager-role="first-team-coach" ${role === 'first-team-coach' ? 'disabled' : ''}>${role === 'first-team-coach' ? 'Active' : 'Take role'}</button></span></article><article class="team-snapshot academy"><div><span class="team-snapshot-icon">A</span><span><small>Academy role</small><strong>Academy coach</strong></span></div><span><small>Players</small><strong>${academyPlayers.length}</strong></span><span><small>Fatigue</small><strong>${academyFatigue}%</strong></span><span><button type="button" class="fm-button" data-set-manager-role="academy-coach" ${role === 'academy-coach' ? 'disabled' : ''}>${role === 'academy-coach' ? 'Active' : 'Take role'}</button></span></article></div><footer class="panel-footer"><span>Club-manager mode restores direct control of board, finance, recruitment and facilities.</span><button type="button" data-set-manager-role="club-manager" ${role === 'club-manager' ? 'disabled' : ''}>Manage whole club</button></footer></article>${coachLineup}<article class="surface"><header class="section-head"><h2>Weekly plan</h2><button type="button" data-open-view="training">Edit sessions</button></header>${weekPlannerMarkup()}</article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Playing style</h3></header><div class="control-list"><label>Football identity<select data-coach-style>${PLAYING_STYLES.map(style => `<option value="${style.id}"${style.id === coachStyleId ? ' selected' : ''}>${escapeHtml(style.name)}</option>`).join('')}</select></label><label>Training intensity<select data-coach-intensity>${TRAINING_INTENSITIES.map(intensity => `<option value="${intensity.id}"${intensity.id === pick(coachHolder, ['training.intensity'], 'normal') ? ' selected' : ''}>${escapeHtml(intensity.name)} · fatigue × ${intensity.fatigue}</option>`).join('')}</select></label><button type="button" class="fm-button primary" data-save-coach-plan>Apply ${escapeHtml(activeCoachSquad === 'academy' ? 'academy' : activeCoachSquad === 'u23' ? 'U23' : 'first-team')} plan</button><button type="button" class="fm-button" data-set-manager-role="${targetRole}" ${role === targetRole ? 'disabled' : ''}>${role === targetRole ? 'Current coaching role' : 'Take this coaching role'}</button></div></article><article class="surface"><header class="section-head"><h3>Match preparation</h3></header>${fixture ? `<dl class="metric-list"><div><dt>Opponent</dt><dd>${escapeHtml(fixture.home.isPlayer ? fixture.away.name : fixture.home.name)}</dd></div><div><dt>Venue</dt><dd>${escapeHtml(fixture.home.isPlayer ? 'Home' : 'Away')}</dd></div><div><dt>Competition</dt><dd>${escapeHtml(fixture.competition)}</dd></div></dl><div class="academy-actions"><button type="button" class="fm-button primary" data-simulate-match="${escapeHtml(fixture.id)}">Simulate match day</button></div>` : `<div class="empty-state"><strong>${activeCoachSquad === 'academy' ? 'Academy development week' : activeCoachSquad === 'u23' ? 'U23 development week' : 'No match queued'}</strong><p>${activeCoachSquad === 'academy' || activeCoachSquad === 'u23' ? 'Use the training plan to coach development and manage fatigue.' : 'Review competitions for the next scheduled fixture.'}</p></div>`}</article></aside>
    </section>`;
}

function trialPlayers() {
  const actual = asArray(pick(footballState, ['recruitment.trialists', 'trialists', 'academy.trialists'], []));
  return actual;
}

function recruitmentView() {
  const trials = trialPlayers();
  const academy = academyModel();
  const canRunTrials = ['refreshRecruitmentMarket', 'runAcademyTrials', 'generateTrialists', 'runTrials'].some(name => typeof FootballEngine[name] === 'function');
  const canSignTrialist = ['signTrialist', 'offerAcademyPlace', 'signAcademyPlayer'].some(name => typeof FootballEngine[name] === 'function');
  const funnelRaw = {
    enquiries: pick(academy, ['trials.enquiries', 'trialEnquiries'], null),
    attendees: pick(academy, ['trials.attendees', 'trialAttendees'], null),
    highPotential: pick(academy, ['trials.highPotential', 'highPotentialTrials'], null)
  };
  const hasFunnel = Object.values(funnelRaw).some(value => value != null);
  const funnel = Object.fromEntries(Object.entries(funnelRaw).map(([key, value]) => [key, number(value)]));
  return `${viewHeading('Recruitment', 'Scout the senior market and convert academy trial interest into a stronger local pathway.', `<button type="button" class="fm-button primary" data-run-trials ${canRunTrials ? '' : 'disabled'}>${canRunTrials ? 'Run trial intake' : 'Trial pool refreshes weekly'}</button>`)}
    <section class="recruit-layout"><article class="surface"><header class="section-head"><h2>Current trial group</h2><small>Only recorded applicants are shown</small></header>${trials.length ? `<div class="trial-list">${trials.map(player => `<article class="trial-card"><header><h3>${escapeHtml(player.name)}</h3><span>${number(player.rating || player.overall, 50)}</span></header><p>${escapeHtml(player.position || 'Youth player')} · age ${number(player.age, 16)} · projected ceiling ${number(player.potential, number(player.rating, 50) + 15)}</p><div class="player-traits">${asArray(player.traits).map(trait => `<span>${escapeHtml(trait)}</span>`).join('')}</div><footer><small>${number(player.potential, 60) >= 75 ? 'High potential' : 'Development prospect'}</small><button type="button" class="fm-button" data-sign-trialist="${escapeHtml(player.id)}" ${canSignTrialist ? '' : 'disabled'}>${canSignTrialist ? 'Offer place' : 'Projection only'}</button></footer></article>`).join('')}</div>` : '<div class="empty-state"><strong>No active trial intake</strong><p>Run an intake or advance the week. The game no longer fills this panel with placeholder prospects.</p></div>'}</article>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Talent funnel</h3><small>Latest recorded intake</small></header>${hasFunnel ? `<div class="talent-funnel"><div><span>Enquiries <strong>${funnel.enquiries}</strong></span><i><b style="width:100%"></b></i></div><div><span>Trial attendees <strong>${funnel.attendees}</strong></span><i><b style="width:${Math.min(100, (funnel.attendees / Math.max(1, funnel.enquiries)) * 100)}%"></b></i></div><div><span>High-potential players <strong>${funnel.highPotential}</strong></span><i><b style="width:${Math.min(100, (funnel.highPotential / Math.max(1, funnel.attendees)) * 100)}%"></b></i></div></div>` : '<div class="empty-state compact"><strong>No intake totals yet</strong><p>Enquiries, attendance and high-potential counts appear after a real trial intake.</p></div>'}</article>
        <article class="surface"><header class="section-head"><h3>Market controls</h3></header><dl class="metric-list"><div><dt>Local talent</dt><dd>${clubModel().site?.talent || 60}/100</dd></div><div><dt>Local wealth</dt><dd>${clubModel().site?.wealth || 60}/100</dd></div><div><dt>Academy price</dt><dd>${formatMoney(financeModel().academyFee)}</dd></div><div><dt>Scout level</dt><dd>${number(pick(footballState, ['staff.recruitment', 'staffLevels.recruitment'], 1))}</dd></div></dl></article>
        <article class="surface"><header class="section-head"><h3>Senior recruitment</h3></header><div class="academy-actions"><button type="button" class="fm-button primary" data-open-view="scouting">Open scouting desk</button><button type="button" class="fm-button" data-open-transfer-market>Known transfer market</button><button type="button" class="fm-button" data-open-view="first-team">Review senior squad</button></div></article></aside></section>`;
}

function scoutingModel() {
  let direct = null;
  try { if (typeof FootballEngine.getScoutingView === 'function') direct = FootballEngine.getScoutingView(footballState); } catch {}
  const stored = pick(careerWorldModel(), ['scouting'], {}) || {};
  return {
    assignments: asArray(pick(direct, ['assignments'], pick(stored, ['assignments'], []))),
    reports: asArray(pick(direct, ['reports'], pick(stored, ['reports'], []))),
    opponentReports: asArray(pick(direct, ['opponentReports'], pick(stored, ['opponentReports'], []))),
    knowledge: number(pick(direct, ['knowledge'], pick(stored, ['knowledge'], 0)))
  };
}

function normalizeScoutReport(report = {}, index = 0) {
  const player = pick(report, ['player'], {}) || {};
  const ratingRange = asArray(pick(report, ['ratingRange', 'abilityRange'], []));
  const potentialRange = asArray(pick(report, ['potentialRange'], []));
  const valueRange = asArray(pick(report, ['valueRange'], []));
  const min = pick(report, ['ratingRange.min', 'abilityRange.min', 'ratingMin', 'minRating'], ratingRange[0] ?? pick(player, ['ratingMin'], null));
  const max = pick(report, ['ratingRange.max', 'abilityRange.max', 'ratingMax', 'maxRating'], ratingRange[1] ?? pick(player, ['rating', 'overall'], null));
  return {
    id: String(pick(report, ['id', 'reportId'], `report-${index}`)),
    playerId: String(pick(report, ['playerId', 'targetId'], pick(player, ['id', 'playerId'], `scouted-${index}`))),
    name: pick(report, ['playerName', 'targetName', 'name'], pick(player, ['name', 'fullName'], 'Scouted player')),
    position: pick(report, ['position'], pick(player, ['position', 'pos'], '—')),
    age: number(pick(report, ['age'], pick(player, ['age'], 0))),
    clubName: pick(report, ['clubName', 'club.name'], pick(player, ['clubName'], 'Unattached')),
    min: min == null ? null : number(min),
    max: max == null ? null : number(max),
    potentialMin: pick(report, ['potentialRange.min', 'potentialMin'], potentialRange[0] ?? null),
    potentialMax: pick(report, ['potentialRange.max', 'potentialMax'], potentialRange[1] ?? null),
    confidence: clamp(pick(report, ['confidence', 'knowledge', 'completion'], 0)),
    wageAsk: number(pick(report, ['wageAsk', 'weeklyWage'], pick(player, ['weeklyWage', 'wage'], 0))),
    value: number(pick(report, ['marketValue', 'valueAud'], valueRange.length ? Math.round((number(valueRange[0]) + number(valueRange[1])) / 2) : pick(player, ['marketValue', 'valueAud'], 0))),
    recommendation: pick(report, ['summary', 'scoutNote'], pick(report, ['recommendation'], '')),
    strengths: asArray(pick(report, ['strengths'], [])),
    concerns: asArray(pick(report, ['concerns', 'weaknesses'], [])),
    status: pick(report, ['status', 'recommendation'], 'observed')
  };
}

function opponentReportForFixture(fixture = nextFixture('senior')) {
  if (!fixture) return null;
  const opponent = fixture.home.isPlayer ? fixture.away : fixture.home;
  const reports = scoutingModel().opponentReports;
  return reports.find(report => pick(report, ['clubId', 'opponentId', 'teamId'], '') === (opponent.id || opponent.clubId) || pick(report, ['clubName', 'opponentName', 'name'], '') === opponent.name) || null;
}

function scoutReportBody(reportId) {
  const report = scoutingModel().reports.map(normalizeScoutReport).find(item => item.id === reportId);
  if (!report) return '<div class="empty-state"><strong>Scouting report unavailable</strong><p>The report may have expired or been superseded.</p></div>';
  const ability = report.min == null && report.max == null ? 'Unknown' : report.min === report.max || report.min == null ? String(report.max ?? report.min) : `${report.min}–${report.max}`;
  const potential = report.potentialMin == null && report.potentialMax == null ? 'Not established' : `${number(report.potentialMin, report.potentialMax)}–${number(report.potentialMax, report.potentialMin)}`;
  const shortlisted = asArray(pick(careerWorldModel(), ['scouting.shortlist', 'shortlist'], [])).some(item => item.reportId === report.id || item.playerId === report.playerId);
  return `<div class="scout-report-detail"><section class="player-profile-hero"><span class="player-profile-avatar">${escapeHtml(initials(report.name))}</span><div><span>${escapeHtml(report.position)} · ${report.age ? `age ${report.age}` : 'age unknown'}</span><h3>${escapeHtml(report.name)}</h3><p>${escapeHtml(report.clubName)}</p></div><div class="player-overall"><strong>${escapeHtml(ability)}</strong><small>Ability range</small><span>${report.confidence}% confidence</span></div></section><section class="profile-columns"><article class="profile-panel"><header><h4>Scout recommendation</h4><small>${escapeHtml(titleCase(report.status))}</small></header><p>${escapeHtml(report.recommendation || 'The recruitment team has not added a written recommendation.')}</p><div class="report-traits"><div><strong>Strengths</strong><p>${report.strengths.length ? escapeHtml(report.strengths.join(' · ')) : 'Not confirmed'}</p></div><div><strong>Risks</strong><p>${report.concerns.length ? escapeHtml(report.concerns.join(' · ')) : 'No concerns recorded'}</p></div></div></article><aside class="profile-panel"><header><h4>Recruitment range</h4></header><dl class="metric-list"><div><dt>Potential</dt><dd>${escapeHtml(potential)}</dd></div><div><dt>Estimated value</dt><dd>${report.value ? formatMoney(report.value, true) : 'Unknown'}</dd></div><div><dt>Wage expectation</dt><dd>${report.wageAsk ? `${formatMoney(report.wageAsk)}/wk` : 'Unknown'}</dd></div></dl><div class="stacked-actions"><button type="button" class="fm-button" data-shortlist-player="${escapeHtml(report.id)}" ${shortlisted ? 'disabled' : ''}>${shortlisted ? 'Shortlisted' : 'Add to shortlist'}</button><button type="button" class="fm-button primary" data-approach-scouted-player="${escapeHtml(report.id)}">Approach player</button></div></aside></section></div>`;
}

function scoutingView() {
  const scouting = scoutingModel();
  const assignments = scouting.assignments;
  const reports = scouting.reports.map(normalizeScoutReport);
  const positionGroups = { gk: ['GK'], d: ['DF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'WB'], m: ['MF', 'CM', 'DM', 'AM', 'LM', 'RM'], f: ['FW', 'ST', 'LW', 'RW', 'CF'] };
  const filteredReports = scoutingFilter === 'all' ? reports : reports.filter(report => positionGroups[scoutingFilter]?.includes(String(report.position).toUpperCase()));
  const completeReports = reports.filter(report => report.confidence >= 75).length;
  const activeAssignments = assignments.filter(item => !item.complete && !['complete', 'completed', 'cancelled'].includes(String(item.status || '').toLowerCase())).length;
  const shortlist = asArray(pick(careerWorldModel(), ['scouting.shortlist', 'shortlist'], []));
  const fixture = nextFixture('senior');
  const opponent = fixture ? (fixture.home.isPlayer ? fixture.away : fixture.home) : null;
  const opponentReport = opponentReportForFixture(fixture);
  const regions = ['Brisbane', 'Moreton Bay', 'Gold Coast', 'Sunshine Coast', 'Regional Queensland', 'National'];
  const focuses = [['all', 'Any position'], ['gk', 'Goalkeepers'], ['df', 'Defenders'], ['mf', 'Midfielders'], ['fw', 'Forwards'], ['youth', 'High-potential youth']];
  return `${viewHeading('Scouting', 'Assign scouts, work with uncertain ability ranges and build opposition knowledge before committing club money.', `<button type="button" class="fm-button primary" data-open-transfer-market>Known transfer market</button>`)}
    <section class="stat-strip"><div><span>Assignments</span><strong>${assignments.length}</strong><small>${activeAssignments} active</small></div><div><span>Player reports</span><strong>${reports.length}</strong><small>${completeReports} high confidence</small></div><div><span>Shortlist</span><strong>${shortlist.length}</strong><small>Tracked targets</small></div><div><span>Network knowledge</span><strong>${formatPercent(scouting.knowledge)}</strong><small>Improves report precision</small></div><div><span>Next opponent</span><strong>${escapeHtml(opponent?.name || '—')}</strong><small>${opponentReport ? 'Report available' : 'Knowledge pending'}</small></div></section>
    <section class="scouting-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Scouting assignments</h2><small>Longer assignments narrow uncertainty</small></header><div class="assignment-composer"><label>Region<select data-scout-region>${regions.map(region => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('')}</select></label><label>Recruitment focus<select data-scout-focus>${focuses.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><label>Duration<select data-scout-duration><option value="2">2 weeks</option><option value="4" selected>4 weeks</option><option value="8">8 weeks</option></select></label><button type="button" class="fm-button primary" data-create-scouting-assignment>Assign scout</button></div>${assignments.length ? `<ul class="assignment-list">${assignments.map((assignment, index) => { const start = seasonWeekIndex(assignment.startedSeason, assignment.startedWeek); const due = seasonWeekIndex(assignment.dueSeason, assignment.dueWeek); const total = Math.max(1, due - start); const remaining = Math.max(0, due - seasonWeekIndex()); const status = String(pick(assignment, ['status'], 'active')).toLowerCase(); const progress = ['complete', 'completed'].includes(status) ? 100 : status === 'cancelled' ? 0 : clamp(((total - remaining) / total) * 100); const id = pick(assignment, ['id', 'assignmentId'], `assignment-${index}`); return `<li class="status-${escapeHtml(status)}"><div><span class="assignment-icon"><i class="ti ti-map-search" aria-hidden="true"></i></span><span><strong>${escapeHtml(pick(assignment, ['targetName', 'region', 'area', 'name'], 'Scouting assignment'))}</strong><small>${escapeHtml(pick(assignment, ['region'], 'Queensland'))} · ${escapeHtml(titleCase(status))} · ${status === 'active' ? `${remaining} weeks remaining` : `due ${assignment.dueSeason} · W${assignment.dueWeek}`}</small></span></div><div class="assignment-progress"><span>${Math.round(progress)}%</span><i><b style="width:${progress}%"></b></i></div><button type="button" class="text-action" data-cancel-scouting-assignment="${escapeHtml(id)}" ${status === 'active' ? '' : 'disabled'}>Cancel</button></li>`; }).join('')}</ul>` : '<div class="empty-state"><strong>No active assignment</strong><p>Choose a region, position focus and duration to begin building recruitment knowledge.</p></div>'}</article>
      <article class="surface"><header class="section-head"><h2>Player reports</h2><small>Ability is shown as a range until confidence improves</small></header><div class="scout-filters" role="group" aria-label="Filter scouting reports">${[['all', 'All'], ['gk', 'GK'], ['d', 'Defence'], ['m', 'Midfield'], ['f', 'Attack']].map(([id, label]) => `<button type="button" class="${scoutingFilter === id ? 'active' : ''}" data-scouting-filter="${id}">${label}</button>`).join('')}</div>${filteredReports.length ? `<div class="table-scroll"><table class="squad-table scouting-table"><thead><tr><th>Pos</th><th>Player</th><th>Club</th><th>Ability</th><th>Confidence</th><th>Value</th><th></th></tr></thead><tbody>${filteredReports.map(report => `<tr><td><span class="position-mark">${escapeHtml(report.position)}</span></td><td><div class="player-name"><span class="player-avatar">${escapeHtml(initials(report.name))}</span><span><strong>${escapeHtml(report.name)}</strong><small>${report.age ? `Age ${report.age}` : 'Age unknown'}</small></span></div></td><td>${escapeHtml(report.clubName)}</td><td><strong>${report.min == null && report.max == null ? '—' : report.min === report.max || report.min == null ? report.max : `${report.min}–${report.max}`}</strong></td><td><div class="confidence-cell"><span>${report.confidence}%</span><i><b style="width:${report.confidence}%"></b></i></div></td><td>${report.value ? formatMoney(report.value, true) : '—'}</td><td><button type="button" class="fm-button" data-open-scout-report="${escapeHtml(report.id)}">Report</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><strong>No reports match this filter</strong><p>Active assignments return named players as knowledge builds.</p></div>'}</article></div>
      <aside class="detail-stack"><article class="surface opponent-report"><header class="section-head"><h3>Opposition report</h3><small>${escapeHtml(opponent?.name || 'No fixture')}</small></header>${opponentReport ? `<dl class="metric-list"><div><dt>Likely shape</dt><dd>${escapeHtml(pick(opponentReport, ['formation', 'likelyFormation'], 'Unknown'))}</dd></div><div><dt>Playing style</dt><dd>${escapeHtml(titleCase(pick(opponentReport, ['styleId', 'style', 'playingStyle'], 'unknown')))}</dd></div><div><dt>Confidence</dt><dd>${formatPercent(pick(opponentReport, ['confidence', 'knowledge'], 0))}</dd></div></dl><div class="report-traits"><div><strong>Threats</strong><p>${escapeHtml(asArray(pick(opponentReport, ['threats', 'strengths'], [])).join(' · ') || 'No major threat confirmed')}</p></div><div><strong>Space to exploit</strong><p>${escapeHtml(asArray(pick(opponentReport, ['weaknesses', 'opportunities'], [])).join(' · ') || 'No clear weakness confirmed')}</p></div></div><button type="button" class="fm-button primary" data-open-view="match-centre">Use in match plan</button>` : opponent ? `<div class="empty-state compact"><strong>No report on ${escapeHtml(opponent.name)}</strong><p>Request an analyst report before the fixture.</p><button type="button" class="fm-button" data-request-opponent-report="${escapeHtml(opponent.id || opponent.clubId || opponent.name)}">Request report</button></div>` : '<div class="empty-state compact"><strong>No opponent scheduled</strong><p>An opposition report will attach to the next senior fixture.</p></div>'}</article><article class="surface"><header class="section-head"><h3>Scouting principles</h3></header><div class="role-remit-summary"><p>Low-confidence ratings are deliberately imprecise. Observe a player longer before treating the upper end of a range as certain.</p><p>Local knowledge and recruitment staff level shorten assignments and reduce the range.</p></div></article></aside>
    </section>`;
}

function facilityLevels() {
  const raw = pick(footballState, ['facilities', 'facilityLevels'], {}) || {};
  return Object.fromEntries(FACILITY_UPGRADES.map(facility => [facility.id, number(typeof raw[facility.id] === 'object' ? raw[facility.id].level : raw[facility.id], facility.levels[0]?.level || 0)]));
}

function constructions() {
  return asArray(pick(footballState, ['projects', 'construction', 'constructions', 'facilities.construction'], []));
}

function footballObjectives() {
  try {
    if (typeof FootballEngine.getFootballObjectives === 'function') return asArray(FootballEngine.getFootballObjectives(footballState));
  } catch {}
  return [];
}

function peopleView() {
  const model = peopleModel();
  const players = asArray(model.players);
  const dynamics = model.dynamics || {};
  const hierarchy = new Map(asArray(dynamics.hierarchy).map(item => [item.playerId, item]));
  const staff = model.staff || {};
  const staffMembers = asArray(staff.staff);
  const candidates = asArray(staff.candidates).slice(0, 8);
  const negotiations = asArray(model.negotiations).filter(item => ['awaiting-club', 'countered'].includes(item.status));
  const medicalCases = asArray(model.medicalCases);
  const playerById = new Map(players.map(player => [player.id, player]));
  const available = players.filter(player => player.availability?.available !== false && player.status === 'active').length;
  const optionMarkup = (selected = '') => players.map(player => `<option value="${escapeHtml(player.id)}"${player.id === selected ? ' selected' : ''}>${escapeHtml(player.name)} · ${escapeHtml(player.primaryPosition || player.position || 'Player')}</option>`).join('');
  const initialsFor = name => String(name || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const personRows = [...players].sort((a, b) => number(hierarchy.get(b.id)?.influence) - number(hierarchy.get(a.id)?.influence)).slice(0, 18).map(player => {
    const standing = hierarchy.get(player.id) || player.hierarchy || {};
    const profile = player.personalityProfile || {};
    const status = player.availability?.status || player.status || 'available';
    const statusClass = status === 'available' || status === 'active' ? '' : status === 'injured' || status === 'suspended' ? 'danger' : 'warning';
    return `<li><span class="person-avatar">${escapeHtml(initialsFor(player.name))}</span><span class="person-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.primaryPosition || 'Player')} · ${escapeHtml(titleCase(standing.tier || 'team'))} · morale ${number(player.morale)}%</small></span><span class="person-traits"><strong>${escapeHtml(profile.label || player.personality || 'Balanced')}</strong><small>Leadership ${number(profile.leadership, 50)} · Professionalism ${number(profile.professionalism, 50)}</small></span><span class="influence-meter"><i><b style="width:${clamp(standing.influence, 0, 100)}%"></b></i><span>${number(standing.influence, 50)}</span></span><button type="button" class="status-pill ${statusClass}" data-player-detail="${escapeHtml(player.id)}" data-player-kind="senior">${escapeHtml(titleCase(status))}</button></li>`;
  }).join('');
  const mentoring = asArray(dynamics.mentoringGroups);
  const mentoringMarkup = mentoring.length ? mentoring.map(group => `<li><span><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(playerById.get(group.mentorId)?.name || 'Mentor')} guiding ${group.menteeIds.length} player${group.menteeIds.length === 1 ? '' : 's'} · ${escapeHtml(titleCase(group.focus))}</small></span><button type="button" class="fm-button danger" data-remove-mentoring="${escapeHtml(group.id)}">Close</button></li>`).join('') : '<li><span><strong>No mentoring groups yet</strong><small>Pair an influential senior with a developing player.</small></span></li>';
  const activePromises = asArray(dynamics.promises).filter(item => item.status === 'active');
  const promiseMarkup = activePromises.length ? activePromises.map(item => {
    const player = playerById.get(item.playerId) || {};
    const targetMet = item.type !== 'other' && number(item.progress) >= number(item.target, 1);
    return `<li><div class="case-head"><span><strong>${escapeHtml(player.name || 'Player commitment')}</strong><small>${escapeHtml(titleCase(item.type))} · due S${number(item.dueSeason)} W${number(item.dueWeek)}</small></span><span class="status-pill warning">Active</span></div><p>${escapeHtml(item.detail)}</p><small>${item.type === 'other' ? 'Qualitative commitments can be cancelled or marked broken.' : targetMet ? 'The promised target has been achieved.' : 'Complete a new recorded game action to meet this commitment.'}</small><div class="promise-actions"><button type="button" class="fm-button primary" data-resolve-player-promise="${escapeHtml(item.id)}" data-promise-outcome="fulfilled" ${targetMet ? '' : 'disabled'}>Mark kept</button><button type="button" class="fm-button" data-resolve-player-promise="${escapeHtml(item.id)}" data-promise-outcome="cancelled">Cancel promise</button><button type="button" class="fm-button danger" data-resolve-player-promise="${escapeHtml(item.id)}" data-promise-outcome="broken">Mark broken</button></div></li>`;
  }).join('') : '<li><div class="case-head"><span><strong>No promises outstanding</strong><small>Only make commitments you are prepared to keep.</small></span></div></li>';
  const medicalMarkup = medicalCases.length ? medicalCases.map(player => {
    const injury = player.medical?.injury;
    const suspension = number(player.discipline?.suspensionMatchesRemaining);
    return `<li><div class="case-head"><span><strong>${escapeHtml(player.name)}</strong><small>${injury ? `${escapeHtml(injury.type)} · ${escapeHtml(injury.bodyArea)}` : escapeHtml(player.discipline?.reason || 'Disciplinary suspension')}</small></span><span class="status-pill danger">${injury ? `${number(injury.weeksRemaining)} wk` : `${suspension} match`}</span></div><div class="case-details">${injury ? `<span><small>Severity</small><strong>${escapeHtml(titleCase(injury.severity))}</strong></span><span><small>Recurrence</small><strong>${number(injury.recurrenceRisk)}%</strong></span><span><small>Rehab</small><strong>${escapeHtml(titleCase(injury.rehabPlan))}</strong></span>` : `<span><small>Yellow cards</small><strong>${number(player.discipline?.yellowCards)}</strong></span><span><small>Next threshold</small><strong>${number(player.discipline?.nextThreshold)}</strong></span><span><small>Unavailable</small><strong>${suspension} match${suspension === 1 ? '' : 'es'}</strong></span>`}</div>${injury ? `<div class="case-actions">${['conservative', 'standard', 'intensive'].map(plan => `<button type="button" class="fm-button${injury.rehabPlan === plan ? ' primary' : ''}" data-set-rehab="${escapeHtml(player.id)}" data-rehab-plan="${plan}">${titleCase(plan)}</button>`).join('')}</div>` : ''}</li>`;
  }).join('') : '<li><div class="case-head"><span><strong>Full squad available</strong><small>No active injury or suspension cases.</small></span><span class="status-pill">Clear</span></div></li>';
  const negotiationMarkup = negotiations.length ? negotiations.map(session => {
    const player = playerById.get(session.playerId) || {};
    const demand = session.demand || {};
    return `<li class="active-negotiation"><div class="case-head"><span><strong>${escapeHtml(player.name || 'Player contract')}</strong><small>${escapeHtml(session.agent?.name || 'Player representative')} · ${escapeHtml(titleCase(session.agent?.style || 'pragmatic'))} · round ${number(session.round)}</small></span><span class="status-pill warning">${escapeHtml(titleCase(session.status))}</span></div><p class="negotiation-summary">Demand: ${formatMoney(demand.weeklyWage)}/week, ${number(demand.seasons, 2)} seasons, ${escapeHtml(titleCase(demand.squadRole || 'rotation'))} role. Agent patience: ${number(session.agent?.patience, 3)} rounds.</p><div class="negotiation-form"><label>Weekly wage<input type="number" min="0" step="25" value="${number(demand.weeklyWage)}" data-contract-weekly></label><label>Term<select data-contract-seasons>${[1, 2, 3, 4, 5].map(value => `<option value="${value}"${value === number(demand.seasons) ? ' selected' : ''}>${value} season${value === 1 ? '' : 's'}</option>`).join('')}</select></label><label>Squad role<select data-contract-role>${['star', 'important', 'rotation', 'prospect', 'fringe'].map(role => `<option value="${role}"${role === demand.squadRole ? ' selected' : ''}>${titleCase(role)}</option>`).join('')}</select></label><label>Signing bonus<input type="number" min="0" step="100" value="${number(demand.signingBonus)}" data-contract-signing></label><label>Release clause<input type="number" min="0" step="1000" value="${number(demand.releaseClause)}" data-contract-release></label><label>Appearance bonus<input type="number" min="0" step="10" value="${number(demand.appearanceBonus)}" data-contract-appearance></label><div class="negotiation-actions"><button type="button" class="fm-button primary" data-submit-contract-offer="${escapeHtml(session.id)}">Submit offer</button><button type="button" class="fm-button danger" data-withdraw-contract="${escapeHtml(session.id)}">Withdraw</button></div></div></li>`;
  }).join('') : '<li><div class="case-head"><span><strong>No active negotiations</strong><small>Open talks with an expiring player below.</small></span></div></li>';
  const expiring = asArray(model.expiringContracts).filter(player => !negotiations.some(item => item.playerId === player.id)).slice(0, 8);
  const expiringMarkup = expiring.length ? `<div class="people-controls">${expiring.map(player => `<button type="button" class="fm-button" data-start-contract-talks="${escapeHtml(player.id)}">Open talks · ${escapeHtml(player.name)}</button>`).join('')}</div>` : '';
  const staffMarkup = staffMembers.length ? staffMembers.map(member => `<li><div class="staff-head"><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.roleName)} · ${escapeHtml(titleCase(member.personality))}</small></span><span class="status-pill">${number(member.departmentEffect?.quality)} quality</span></div><div class="staff-details"><span><small>Weekly wage</small><strong>${formatMoney(member.weeklyWageAud)}</strong></span><span><small>Trust</small><strong>${number(member.trust)}%</strong></span><span><small>Contract ends</small><strong>S${number(member.contract?.expiresSeason)} W${number(member.contract?.expiresWeek)}</strong></span></div><div class="staff-actions"><button type="button" class="fm-button" data-renew-named-staff="${escapeHtml(member.id)}" data-staff-wage="${number(member.weeklyWageAud)}">Renew</button><button type="button" class="fm-button danger" data-confirm-dismiss-staff="${escapeHtml(member.id)}" data-staff-name="${escapeHtml(member.name)}">Dismiss</button></div></li>`).join('') : '<li><div class="staff-head"><span><strong>No active staff</strong><small>The manager currently owns every department.</small></span></div></li>';
  const candidateMarkup = candidates.length ? candidates.map(member => `<li><div class="staff-head"><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.roleName)} · ${escapeHtml(titleCase(member.personality))}</small></span><span class="status-pill neutral">Candidate</span></div><div class="staff-details"><span><small>Quality</small><strong>${number(member.departmentEffect?.quality)}/100</strong></span><span><small>Weekly wage</small><strong>${formatMoney(member.weeklyWageAud)}</strong></span><span><small>Appointment fee</small><strong>${formatMoney(member.hiringFeeAud)}</strong></span></div><div class="staff-actions"><button type="button" class="fm-button primary" data-hire-named-staff="${escapeHtml(member.id)}" data-staff-wage="${number(member.weeklyWageAud)}">Appoint</button></div></li>`).join('') : '<li><div class="staff-head"><span><strong>No candidates available</strong><small>The search will refresh during the season.</small></span></div></li>';
  const compatibility = { 'training-plan': ['head-coach', 'assistant-coach', 'academy-director', 'sports-scientist', 'analyst'], 'team-selection': ['head-coach', 'assistant-coach'], 'academy-pathway': ['academy-director'], 'recruitment-shortlist': ['recruitment-director', 'chief-scout'], 'injury-return': ['sports-scientist', 'physio'], 'opposition-analysis': ['analyst', 'chief-scout', 'head-coach', 'assistant-coach'], 'matchday-operations': ['grounds-manager', 'finance-director'], 'sponsor-negotiation': ['commercial-director', 'finance-director', 'recruitment-director'], 'community-programme': ['community-manager', 'commercial-director'], 'ticket-strategy': ['commercial-director', 'community-manager', 'finance-director'] };
  const delegationMarkup = asArray(staff.delegations).map(item => { const eligible = staffMembers.filter(member => asArray(compatibility[item.id]).includes(member.roleId)); return `<label><span><strong>${escapeHtml(item.name)}</strong><small>${item.managerControlled ? 'Manager controlled' : `${escapeHtml(item.assignedStaffName)} · quality ${number(item.quality)} · risk ${number(item.risk)}`}</small></span><select data-delegation="${escapeHtml(item.id)}"><option value="">Manager</option>${eligible.map(member => `<option value="${escapeHtml(member.id)}"${member.id === item.assignedStaffId ? ' selected' : ''}>${escapeHtml(member.name)} · ${escapeHtml(member.roleName)}</option>`).join('')}</select></label>`; }).join('');
  return `${viewHeading('People', 'Lead the personalities, availability, contracts and staff relationships that shape the club every week.', `<button type="button" class="fm-button" data-open-view="first-team">Open squads</button>`)}
    <section class="people-scoreboard"><article class="surface"><i class="ti ti-users-group"></i><span><small>Squad cohesion</small><strong>${number(dynamics.cohesion, 68)}%</strong></span></article><article class="surface"><i class="ti ti-mood-smile"></i><span><small>Atmosphere</small><strong>${number(dynamics.atmosphere, 68)}%</strong></span></article><article class="surface"><i class="ti ti-heart-rate-monitor"></i><span><small>Available players</small><strong>${available}/${players.length}</strong></span></article><article class="surface"><i class="ti ti-cash-banknote"></i><span><small>Named staff payroll</small><strong>${formatMoney(staff.weeklyPayrollAud, true)}</strong></span></article></section>
    <section class="people-layout"><div class="people-briefing"><article class="surface"><header class="section-head"><h2>Squad hierarchy</h2><small>Influence, personality and availability</small></header><ul class="person-list">${personRows}</ul><div class="people-controls"><label>Captain<select data-captain-select>${optionMarkup(dynamics.captainId)}</select></label><label>Vice-captain<select data-vice-captain-select><option value="">None</option>${optionMarkup(dynamics.viceCaptainId)}</select></label><button type="button" class="fm-button primary" data-save-captaincy>Save leadership</button></div></article>
      <article class="surface"><header class="section-head"><h2>Contract room</h2><small>Agents remember every round</small></header><ul class="negotiation-list">${negotiationMarkup}</ul>${expiringMarkup}</article>
      <article class="surface"><header class="section-head"><h2>Football department</h2><small>${staffMembers.length} named staff · ${asArray(staff.vacantRoles).length} vacant roles</small></header><ul class="staff-list">${staffMarkup}</ul></article></div>
      <aside class="people-briefing"><article class="surface"><header class="section-head"><h3>Medical and discipline</h3><small>Availability forecast</small></header><ul class="medical-list">${medicalMarkup}</ul></article>
      <article class="surface"><header class="section-head"><h3>Mentoring</h3><small>${mentoring.length} active group${mentoring.length === 1 ? '' : 's'}</small></header><ul class="construction-list">${mentoringMarkup}</ul><div class="people-controls"><label>Mentor<select data-mentor-select>${optionMarkup()}</select></label><label>Mentee<select data-mentee-select>${optionMarkup()}</select></label><label>Focus<select data-mentoring-focus><option value="professionalism">Professionalism</option><option value="leadership">Leadership</option><option value="consistency">Consistency</option><option value="development">Development</option></select></label><button type="button" class="fm-button primary" data-create-mentoring>Create group</button></div></article>
      <article class="surface"><header class="section-head"><h3>Player promises</h3><small>${activePromises.length} commitment${activePromises.length === 1 ? '' : 's'} outstanding</small></header><ul class="promise-list">${promiseMarkup}</ul><div class="people-controls"><label>Player<select data-promise-player>${optionMarkup()}</select></label><label>Promise<select data-promise-type><option value="playing-time">Playing time</option><option value="squad-role">Squad role</option><option value="development">Development</option><option value="new-contract">New contract</option><option value="transfer">Transfer status</option><option value="captaincy">Captaincy</option><option value="silverware">Silverware</option><option value="other">Other</option></select></label><label>Commitment<input type="text" maxlength="180" placeholder="What have you committed to?" data-promise-detail></label><label>Due in weeks<input type="number" min="1" max="80" step="1" value="12" data-promise-weeks></label><button type="button" class="fm-button primary" data-create-player-promise>Record promise</button></div></article>
      <article class="surface"><header class="section-head"><h3>Delegation</h3><small>Assign qualified department owners</small></header><div class="delegation-list">${delegationMarkup}</div></article>
      <article class="surface"><header class="section-head"><h3>Staff candidates</h3><small>Appointments include a one-off fee</small></header><ul class="staff-list">${candidateMarkup}</ul></article></aside></section>`;
}

function commercialView() {
  const model = commercialModel();
  const metrics = model.metrics || {};
  const weekly = model.lastWeekly || {};
  const offers = asArray(model.offers);
  const contracts = asArray(model.contracts);
  const plan = model.plan || {};
  const sponsorMark = name => String(name || 'P').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const contractMarkup = contracts.length ? contracts.map(contract => `<li class="featured"><div class="sponsor-head"><div class="sponsor-brand"><span class="sponsor-mark">${escapeHtml(sponsorMark(contract.sponsorName))}</span><span><strong>${escapeHtml(contract.sponsorName)}</strong><small>${escapeHtml(titleCase(contract.category))} · ${escapeHtml(titleCase(contract.exclusivity))} exclusivity</small></span></div><span class="status-pill">Active</span></div><div class="sponsor-details"><span><small>Weekly fee</small><strong>${formatMoney(contract.weeklyFeeAud)}</strong></span><span><small>Term remaining</small><strong>${number(contract.weeksRemaining)} weeks</strong></span><span><small>Reputation fit</small><strong>${number(contract.reputationFit)}%</strong></span></div>${asArray(contract.objectives).map(objective => `<div class="department-score"><i><b style="width:${clamp(number(objective.progress) / Math.max(1, number(objective.target)) * 100)}%"></b></i><span>${escapeHtml(titleCase(objective.type))} ${number(objective.progress).toLocaleString('en-AU')} / ${number(objective.target).toLocaleString('en-AU')}</span></div>`).join('')}</li>`).join('') : '<li><div class="sponsor-head"><span><strong>No active club partner</strong><small>Review the offers below to unlock contracted income.</small></span></div></li>';
  const offerMarkup = offers.length ? offers.map(offer => `<li><div class="sponsor-head"><div class="sponsor-brand"><span class="sponsor-mark">${escapeHtml(sponsorMark(offer.sponsorName))}</span><span><strong>${escapeHtml(offer.sponsorName)}</strong><small>${escapeHtml(titleCase(offer.category))} · ${number(offer.durationWeeks)} weeks</small></span></div><span class="status-pill neutral">${number(offer.reputationFit)}% fit</span></div><div class="sponsor-details"><span><small>Weekly fee</small><strong>${formatMoney(offer.weeklyFeeAud)}</strong></span><span><small>Signing bonus</small><strong>${formatMoney(offer.signingBonusAud)}</strong></span><span><small>Exclusivity</small><strong>${escapeHtml(titleCase(offer.exclusivity))}</strong></span></div><div class="sponsor-actions"><button type="button" class="fm-button primary" data-sponsor-offer="${escapeHtml(offer.id)}" data-sponsor-response="accept">Accept partnership</button><button type="button" class="fm-button danger" data-sponsor-offer="${escapeHtml(offer.id)}" data-sponsor-response="reject">Decline</button></div></li>`).join('') : '<li><div class="sponsor-head"><span><strong>No open proposals</strong><small>The partnership book refreshes through the season.</small></span></div></li>';
  const merch = plan.merchandise || {}, community = plan.community || {}, digital = plan.digital || {}, tickets = plan.tickets || {};
  return `${viewHeading('Commercial', 'Build a supporter-powered football club through partnerships, merchandise, community work and a deliberate growth strategy.', `<button type="button" class="fm-button" data-open-view="finances">Open finances</button>`)}
    <section class="commercial-hero"><div><small>Club commercial department</small><h2>${contracts.length ? `${escapeHtml(contracts[0].sponsorName)} leads the partnership book` : 'Turn local attention into lasting support'}</h2><p>Every dollar has a football consequence: partnerships fund the squad, community investment grows the crowd and careless exclusivity can close better opportunities.</p></div></section>
    <section class="commercial-scoreboard"><article class="surface"><i class="ti ti-users"></i><span><small>Supporter base</small><strong>${number(metrics.supporters).toLocaleString('en-AU')}</strong></span></article><article class="surface"><i class="ti ti-device-mobile"></i><span><small>Digital following</small><strong>${number(metrics.digitalFollowers).toLocaleString('en-AU')}</strong></span></article><article class="surface"><i class="ti ti-chart-line"></i><span><small>Commercial reputation</small><strong>${number(metrics.commercialReputation)}%</strong></span></article><article class="surface"><i class="ti ti-cash"></i><span><small>Last weekly result</small><strong>${weekly.netAud >= 0 ? '+' : ''}${formatMoney(weekly.netAud, true)}</strong></span></article></section>
    <section class="commercial-layout"><div class="commercial-briefing"><article class="surface"><header class="section-head"><h2>Active partnerships</h2><small>${formatMoney(model.weeklyContractedIncomeAud)} contracted each week</small></header><ul class="sponsor-list">${contractMarkup}</ul></article><article class="surface"><header class="section-head"><h2>Partnership proposals</h2><small>Objectives and exclusivity are binding</small></header><ul class="sponsor-list">${offerMarkup}</ul></article></div>
      <aside class="commercial-briefing"><article class="surface"><header class="section-head"><h3>Growth plan</h3><small>${formatMoney(model.weeklyPlanSpendAud)} weekly investment</small></header><div class="commercial-plan"><label><span><strong>Merchandise strategy</strong><small>Balance demand, margin and supporter access.</small></span><select data-commercial-merch-strategy>${['value', 'balanced', 'premium', 'limited-drops'].map(value => `<option value="${value}"${value === merch.strategy ? ' selected' : ''}>${titleCase(value)}</option>`).join('')}</select></label><label><span><strong>Merchandise budget</strong><small>Product design, inventory and fulfilment.</small></span><input type="number" min="0" step="50" value="${number(merch.weeklyBudgetAud)}" data-commercial-merch-budget></label><label><span><strong>Community programme</strong><small>Choose how the club earns local trust.</small></span><select data-commercial-community-strategy>${['schools', 'grassroots', 'charity', 'open-club'].map(value => `<option value="${value}"${value === community.strategy ? ' selected' : ''}>${titleCase(value)}</option>`).join('')}</select></label><label><span><strong>Community budget</strong><small>Weekly delivery and participation costs.</small></span><input type="number" min="0" step="50" value="${number(community.weeklyBudgetAud)}" data-commercial-community-budget></label><label><span><strong>Digital strategy</strong><small>Grow reach without exhausting the team.</small></span><select data-commercial-digital-strategy>${['low-key', 'steady', 'matchday', 'always-on'].map(value => `<option value="${value}"${value === digital.strategy ? ' selected' : ''}>${titleCase(value)}</option>`).join('')}</select></label><label><span><strong>Digital budget</strong><small>Content, distribution and match coverage.</small></span><input type="number" min="0" step="50" value="${number(digital.weeklyBudgetAud)}" data-commercial-digital-budget></label><label><span><strong>Ticket strategy</strong><small>Set the commercial posture for matchday access.</small></span><select data-commercial-ticket-strategy>${['accessible', 'balanced', 'yield', 'membership-first'].map(value => `<option value="${value}"${value === tickets.strategy ? ' selected' : ''}>${titleCase(value)}</option>`).join('')}</select></label><label><span><strong>Family discount</strong><small>Percentage discount supporting family attendance.</small></span><input type="number" min="0" max="60" step="1" value="${number(tickets.familyDiscountPercent)}" data-commercial-family-discount></label><footer><small>The plan settles once when the football week advances.</small><button type="button" class="fm-button primary" data-save-commercial-plan>Save growth plan</button></footer></div></article>
      <article class="surface"><header class="section-head"><h3>Last weekly return</h3><small>S${number(weekly.season, seasonYear())} · W${number(weekly.week, weekNumber())}</small></header><div class="revenue-breakdown"><div><span>Sponsor fees</span><strong>${formatMoney(weekly.sponsorIncomeAud)}</strong></div><div><span>Merchandise</span><strong>${formatMoney(weekly.merchandiseIncomeAud)}</strong></div><div><span>Staff payroll</span><strong>−${formatMoney(weekly.staffWagesAud)}</strong></div><div><span>Growth investment</span><strong>−${formatMoney(weekly.planSpendAud)}</strong></div><div class="net"><span>Commercial net</span><strong>${weekly.netAud >= 0 ? '+' : ''}${formatMoney(weekly.netAud)}</strong></div></div></article></aside></section>`;
}

function facilitiesView() {
  const club = clubModel();
  const site = club.site || START_SITES[0];
  const levels = facilityLevels();
  const activeConstruction = constructions();
  const staff = pick(footballState, ['staff', 'staffLevels'], {}) || {};
  const tokens = number(footballState?.footballTokens, 0);
  const objectives = footballObjectives();
  const nowMs = Date.now();
  const constructionMarkup = activeConstruction.length ? `<ul class="construction-list">${activeConstruction.map(project => {
    let skipQuote = null;
    try { skipQuote = typeof FootballEngine.getConstructionSkipCost === 'function' ? FootballEngine.getConstructionSkipCost(footballState, project.id, nowMs) : null; } catch {}
    const tokenCost = number(skipQuote?.costTokens, Math.ceil(Math.max(0, number(project.completesAtMs) - nowMs) / 3_600_000));
    const facilityName = FACILITY_UPGRADES.find(item => item.id === project.facilityId)?.name || project.facilityId || project.id;
    return `<li><span><strong>${escapeHtml(facilityName)}</strong><small>${formatDuration(Math.max(0, number(project.completesAtMs) - nowMs))} remaining · skip ${tokenCost} token${tokenCost === 1 ? '' : 's'}</small></span><span class="construction-actions"><button type="button" class="fm-button" data-skip-construction="${escapeHtml(project.id)}" ${tokenCost > tokens ? 'disabled' : ''}>Skip</button><button type="button" class="fm-button danger" data-cancel-construction="${escapeHtml(project.id)}">Cancel</button></span></li>`;
  }).join('')}</ul>` : '<div class="empty-state"><strong>No active works</strong><p>Select an upgrade to begin a construction programme.</p></div>';
  const objectiveMarkup = objectives.length ? `<ul class="construction-list">${objectives.map(objective => `<li><span><strong>${escapeHtml(objective.name)}</strong><small>${escapeHtml(objective.description)} · ${number(objective.rewardTokens)} tokens</small></span><button type="button" class="fm-button" data-claim-objective="${escapeHtml(objective.id)}" ${objective.ready && !objective.claimed ? '' : 'disabled'}>${objective.claimed ? 'Claimed' : objective.ready ? 'Claim' : 'In progress'}</button></li>`).join('')}</ul>` : '<div class="empty-state"><strong>Objectives update weekly</strong><p>Win matches, run the academy sustainably and progress through the pyramid.</p></div>';
  return `${viewHeading('Facilities', 'Upgrade pitches, training equipment, staff and the physical footprint of your club. Dense city sites can make expansion extraordinarily expensive.')}
    <section class="facilities-hero"><button type="button" class="site-plan site-photo" data-site-preview="${escapeHtml(site.id || 'caboolture')}"><img src="${escapeHtml(siteImage(site))}" alt="Concept view of ${escapeHtml(site.name || 'club site')}" data-site-image><span class="site-label"><strong>${escapeHtml(site.region || 'Queensland')}</strong><small>${escapeHtml(site.name || 'Club home')}</small></span></button><div class="site-details"><h2>${escapeHtml(site.name || 'Club site')}</h2><p>This conceptual site is a gameplay assumption, not an actual parcel or property appraisal. It balances access to players and family wealth against land, clearance and long-term field capacity.</p><dl><div><dt>Lot size</dt><dd>${number(site.lotHectares, 0).toFixed(1)} ha</dd></div><div><dt>Ready fields</dt><dd>${number(site.readyFields, 1)} of ${number(site.maxFields, 1)} max</dd></div><div><dt>Acquisition</dt><dd>${formatMoney(siteAcquisitionCost(site), true)}</dd></div><div><dt>Clearance exposure</dt><dd>${formatMoney(siteClearanceCost(site), true)}</dd></div><div><dt>Expansion setting</dt><dd>${number(site.maxFields, 1) > number(site.readyFields, 1) ? `${number(site.maxFields) - number(site.readyFields, 1)} field phase${number(site.maxFields) - number(site.readyFields, 1) === 1 ? '' : 's'} available` : 'Current footprint complete'}</dd></div></dl></div></section>
    <section class="squad-layout"><article class="surface"><header class="section-head"><h2>Facility programme</h2><small>Only one major project should be started at a time</small></header><div class="facility-grid">${FACILITY_UPGRADES.map(facility => {
      const current = levels[facility.id] || 0;
      const next = facility.levels.find(level => level.level === current + 1) || null;
      const currentDef = facility.levels.find(level => level.level === current) || facility.levels[0];
      const siteBlocked = facility.siteLimited && next && next.level > number(site.maxFields, 1);
      let quote = null;
      try { quote = typeof FootballEngine.getConstructionQuote === 'function' ? FootballEngine.getConstructionQuote(footballState, facility.id) : null; } catch {}
      const quotedCost = quote?.ok ? quote.costAud : next?.costAud;
      const quotedDuration = quote?.ok ? quote.buildDurationMs : next?.buildDurationMs;
      return `<article class="facility-row"><div><h3>${escapeHtml(facility.name)}</h3><p>${escapeHtml(currentDef?.name || 'Not yet built')}${siteBlocked ? ' · current site capacity reached' : ''}${quote?.clearanceAllocationAud ? ` · ${formatMoney(quote.clearanceAllocationAud, true)} clearance allocated` : ''}</p><div class="facility-levels" aria-label="Level ${current} of ${facility.maxLevel}">${Array.from({ length: facility.maxLevel }, (_, index) => `<i class="${index < current ? 'complete' : ''}"></i>`).join('')}</div></div><div><strong>${next ? formatMoney(quotedCost, true) : 'Complete'}</strong><button type="button" class="fm-button" data-start-construction="${facility.id}" ${!next || siteBlocked || quote?.ok === false ? 'disabled' : ''}>${next ? `${formatDuration(quotedDuration)} upgrade` : 'Max level'}</button></div></article>`;
    }).join('')}</div></article>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Active construction</h3><small>${tokens} football token${tokens === 1 ? '' : 's'}</small></header>${constructionMarkup}</article>
        <article class="surface"><header class="section-head"><h3>Football objectives</h3><small>Tokens cannot be bought</small></header>${objectiveMarkup}</article>
        <article class="surface"><header class="section-head"><h3>Staff structure</h3></header><ul class="construction-list">${STAFF_ROLES.map(role => { const level = number(typeof staff[role.id] === 'object' ? staff[role.id].level : staff[role.id], 0); const next = Math.min(role.maxLevel, level + 1); return `<li><span><strong>${escapeHtml(role.name)}</strong><small>Level ${level} · next wages ${formatMoney(role.weeklyWages[next] || 0)}/wk</small></span><button type="button" class="fm-button" data-upgrade-staff="${role.id}" ${level >= role.maxLevel ? 'disabled' : ''}>${level >= role.maxLevel ? 'Max' : `Hire ${formatMoney(role.hireCosts[next] || 0, true)}`}</button></li>`; }).join('')}</ul></article></aside></section>`;
}

function financeHistory() {
  const actual = financeModel().history;
  if (actual.length) return actual.slice(-8).map((entry, index) => ({
    label: entry.label || `${entry.season ? String(entry.season).slice(-2) + '/' : ''}W${entry.week || index + 1}`,
    income: number(entry.income || entry.revenue),
    expenses: number(entry.expenses || entry.costs)
  }));
  return [];
}

function financesView() {
  const finance = financeModel();
  const risk = bankruptcyStatus();
  const net = finance.income - finance.expenses;
  const history = financeHistory();
  const maxBar = Math.max(1, ...history.flatMap(item => [item.income, item.expenses]));
  const suggestedLoanPayment = Math.max(1, Math.min(finance.debt || 1, finance.cash || 1, 100_000));
  const ledger = finance.ledger.slice(-10).reverse();
  return `${viewHeading('Finances', 'Keep the club solvent while deciding how much ambition to fund in players, academy access, staff and infrastructure.', risk.danger ? '<button type="button" class="fm-button danger" data-open-bankruptcy-confirm>Declare bankruptcy</button>' : '')}
    <section class="finance-kpis"><article><span>Cash balance</span><strong>${formatMoney(finance.cash, true)}</strong><small>Available club funds</small></article><article><span>Weekly income</span><strong class="positive">${formatMoney(finance.income, true)}</strong><small>Current run rate</small></article><article><span>Weekly expenses</span><strong class="negative">${formatMoney(finance.expenses, true)}</strong><small>Current run rate</small></article><article><span>Weekly net</span><strong class="${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : ''}${formatMoney(net, true)}</strong><small>${finance.runwayWeeks < 52 ? `${Math.round(finance.runwayWeeks)} weeks runway` : 'Sustainable at current rate'}</small></article></section>
    <section class="finance-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Recorded cash-flow movement</h2><small>Income / expense · up to eight latest weeks</small></header>${history.length ? `<div class="chart-scroll"><div class="finance-chart">${history.map(item => `<div class="finance-bar"><div><i style="height:${Math.max(3, (item.income / maxBar) * 100)}%" title="Income ${formatMoney(item.income)}"></i><b style="height:${Math.max(3, (item.expenses / maxBar) * 100)}%" title="Expenses ${formatMoney(item.expenses)}"></b></div><span>${escapeHtml(item.label)}</span></div>`).join('')}</div></div>` : '<div class="empty-state"><strong>No completed finance week</strong><p>The chart begins after the first simulated week; no placeholder transactions are shown.</p></div>'}</article><article class="surface"><header class="section-head"><h2>Recent ledger</h2></header>${ledger.length ? `<table class="ledger-table"><tbody>${ledger.map(entry => { const amount = number(entry.amount || entry.value); return `<tr><td>${escapeHtml(entry.description || entry.label || entry.type || 'Club transaction')}</td><td>${entry.season ? String(entry.season).slice(-2) + '/' : ''}W${number(entry.week, weekNumber())}</td><td class="${amount >= 0 ? 'credit' : 'debit'}">${amount >= 0 ? '+' : ''}${formatMoney(amount)}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty-state"><strong>No club transactions yet</strong><p>Owner transfers, construction and weekly settlement will appear here.</p></div>'}</article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Operating controls</h3></header><div class="budget-controls"><label class="range-field"><span><strong>First-team weekly budget</strong><output data-finance-wage-output>${formatMoney(finance.wageBudget)}</output></span><input type="range" min="500" max="${seniorDivision().weeklyBudgetMax}" step="250" value="${finance.wageBudget}" data-finance-wage><small>Sets the recruitment and squad-spend ceiling for ${escapeHtml(seniorDivisionName())}.</small></label><label class="range-field"><span><strong>Academy season fee</strong><output data-finance-fee-output>${formatMoney(finance.academyFee)}</output></span><input type="range" min="0" max="15000" step="100" value="${finance.academyFee}" data-finance-fee><small>Any fee from free to $15,000 is allowed in every academy division.</small></label><button type="button" class="fm-button primary" data-save-finance-controls>Save operating plan</button></div></article><article class="surface"><header class="section-head"><h3>Owner funding</h3><small>Dorra balance ${formatMoney(snapshot?.balance || 0, true)}</small></header><div class="budget-controls"><label class="field"><span>Whole AUD transfer</span><input type="number" min="1" max="${MAX_BALANCE}" step="1000" value="100000" inputmode="numeric" data-owner-transfer-amount><small>Club and Dorra balances are committed together in one protected save.</small></label><div class="view-actions"><button type="button" class="fm-button primary" data-invest-owner>Invest in club</button><button type="button" class="fm-button" data-withdraw-owner ${finance.debt > 0 ? 'disabled' : ''}>${finance.debt > 0 ? 'Repay debt before withdrawal' : 'Return to Dorra'}</button></div></div></article>${finance.debt > 0 ? `<article class="surface"><header class="section-head"><h3>Startup loan</h3><small>8% p.a. · five-season term</small></header><div class="budget-controls"><dl class="metric-list"><div><dt>Outstanding</dt><dd>${formatMoney(finance.debt)}</dd></div><div><dt>Automatic weekly principal</dt><dd>${formatMoney(finance.loanPrincipal)}</dd></div></dl><label class="field"><span>Extra repayment</span><input type="number" min="1" max="${Math.max(1, Math.min(finance.debt, finance.cash))}" step="1000" value="${suggestedLoanPayment}" inputmode="numeric" data-loan-repayment><small>Extra repayments use club cash and unlock owner withdrawals once debt reaches zero.</small></label><button type="button" class="fm-button primary" data-repay-startup-loan>Repay loan</button></div></article>` : ''}<article class="surface"><header class="section-head"><h3>Board risk</h3></header><dl class="metric-list"><div><dt>Runway</dt><dd class="${finance.runwayWeeks < 20 ? 'warning' : 'good'}">${finance.runwayWeeks > 900 ? 'Long-term' : `${Math.round(finance.runwayWeeks)} weeks`}</dd></div><div><dt>Debt / assets</dt><dd>${(finance.debtToAssets * 100).toFixed(1)}%</dd></div><div><dt>Temporary ground</dt><dd>${finance.temporaryVenue ? `${formatMoney(finance.temporaryVenue)}/wk` : 'Not required'}</dd></div><div><dt>Capital projects</dt><dd>${constructions().length}</dd></div><div><dt>Site exposure</dt><dd>${formatMoney(siteOpeningCost(clubModel().site), true)}</dd></div><div><dt>Dorra reserve</dt><dd>${formatMoney(snapshot?.balance || 0, true)}</dd></div></dl></article></aside></section>`;
}

function boardModel() {
  const board = pick(careerWorldModel(), ['board'], {}) || {};
  return {
    confidence: clamp(pick(board, ['confidence'], 50)),
    supporterTrust: clamp(pick(board, ['supporterTrust'], 50)),
    expectations: asArray(pick(board, ['expectations'], [])),
    lastReviewSeason: pick(board, ['lastReviewSeason'], seasonYear()),
    lastReviewWeek: pick(board, ['lastReviewWeek'], weekNumber())
  };
}

function clubIdentityModel() {
  const identity = pick(careerWorldModel(), ['identity'], {}) || {};
  return {
    nickname: pick(identity, ['nickname'], ''),
    motto: pick(identity, ['motto'], ''),
    values: asArray(pick(identity, ['values'], [])),
    rivalries: asArray(pick(identity, ['rivalries'], []))
  };
}

function clubVisionView() {
  const board = boardModel();
  const identity = clubIdentityModel();
  const roleProfile = managerRoleProfile();
  const aiClubs = asArray(pick(careerWorldModel(), ['aiClubs'], []));
  const rivalIds = new Set(identity.rivalries.map(rival => rival.clubId));
  const availableRivals = aiClubs.filter(club => !rivalIds.has(club.id) && club.id !== clubModel().id);
  const valueOptions = [['community', 'Community'], ['youth', 'Youth development'], ['ambition', 'Ambition'], ['entertainment', 'Entertaining football'], ['sustainability', 'Sustainability']];
  const statusTone = status => status === 'achieved' || status === 'on-track' ? 'good' : status === 'failed' ? 'danger' : 'warning';
  return `${viewHeading('Club vision', 'Set the club’s identity and expectations, then track how the board and supporters respond to your decisions.', `<button type="button" class="fm-button" data-open-view="inbox">Board inbox</button>`)}
    <section class="vision-scoreboard"><article class="surface sentiment-score"><div class="sentiment-ring" style="--score:${board.confidence}"><strong>${Math.round(board.confidence)}</strong><small>Board confidence</small></div><p>${board.confidence >= 70 ? 'The board strongly backs the current direction.' : board.confidence >= 45 ? 'The board expects progress against the agreed plan.' : 'Results against the plan need urgent attention.'}</p></article><article class="surface sentiment-score supporters"><div class="sentiment-ring" style="--score:${board.supporterTrust}"><strong>${Math.round(board.supporterTrust)}</strong><small>Supporter trust</small></div><p>${board.supporterTrust >= 70 ? 'Supporters feel connected to the club.' : board.supporterTrust >= 45 ? 'Matchday value and club identity will shape sentiment.' : 'Pricing, results and major player decisions have strained trust.'}</p></article><article class="surface role-score"><span>Your role</span><h2>${escapeHtml(roleProfile.title)}</h2><p>${escapeHtml(roleProfile.summary)}</p><button type="button" class="fm-button" data-open-view="coach-desk">Change role</button></article></section>
    <section class="vision-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Board expectations</h2><small>Last review: ${board.lastReviewSeason} · W${board.lastReviewWeek}</small></header>${board.expectations.length ? `<div class="expectation-list">${board.expectations.map((expectation, index) => { const progress = clamp(expectation.progress); return `<article><header><span><strong>${escapeHtml(expectation.label || titleCase(expectation.metric))}</strong><small>${escapeHtml(titleCase(expectation.status || 'on-track'))} · weight ${number(expectation.weight, 1)}%</small></span><b class="${statusTone(expectation.status)}">${Math.round(progress)}%</b></header><div class="expectation-progress"><i><b style="width:${progress}%"></b></i></div><label>Target<input type="number" step="1" value="${number(expectation.target)}" data-expectation-target data-expectation-index="${index}" aria-label="Target for ${escapeHtml(expectation.label || expectation.metric)}"></label></article>`; }).join('')}</div><footer class="panel-footer"><span>Targets are reviewed against league, finance and pathway metrics.</span><button type="button" class="fm-button primary" data-save-board-expectations>Save expectations</button></footer>` : '<div class="empty-state"><strong>No board plan recorded</strong><p>The board will publish league, financial and youth-pathway expectations at the next review.</p></div>'}</article>
      <article class="surface"><header class="section-head"><h2>Club identity</h2><small>Up to three values</small></header><div class="identity-form"><label>Supporter nickname<input type="text" maxlength="50" value="${escapeHtml(identity.nickname)}" placeholder="Optional" data-club-nickname></label><label>Club motto<input type="text" maxlength="100" value="${escapeHtml(identity.motto)}" placeholder="What should the club stand for?" data-club-motto></label><fieldset><legend>Club values</legend><div>${valueOptions.map(([id, label]) => `<label><input type="checkbox" value="${id}" data-club-value ${identity.values.includes(id) ? 'checked' : ''}><span><strong>${label}</strong><small>${id === 'community' ? 'Local access and supporter connection' : id === 'youth' ? 'Academy graduates and development minutes' : id === 'ambition' ? 'Promotion, facilities and competitive investment' : id === 'entertainment' ? 'Proactive football and matchday experience' : 'Stable finances and responsible growth'}</small></span></label>`).join('')}</div></fieldset><button type="button" class="fm-button primary" data-save-club-identity>Save club identity</button></div></article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Rivalries</h3><small>${identity.rivalries.length} registered</small></header>${identity.rivalries.length ? `<ul class="rivalry-list">${identity.rivalries.map(rivalry => `<li><div><strong>${escapeHtml(rivalry.clubName)}</strong><small>${escapeHtml(titleCase(rivalry.type))} · intensity ${number(rivalry.intensity)}/100</small></div><span>${number(rivalry.wins)}W · ${number(rivalry.draws)}D · ${number(rivalry.losses)}L</span>${rivalry.lastResult ? `<b>${escapeHtml(rivalry.lastResult)}</b>` : ''}<p>${escapeHtml(rivalry.story || 'A rivalry waiting for its next chapter.')}</p></li>`).join('')}</ul>` : '<div class="empty-state compact"><strong>No rivalry registered</strong><p>Add a local derby or sporting rival to give key fixtures extra meaning.</p></div>'}${availableRivals.length ? `<div class="rivalry-composer"><label>Rival club<select data-rivalry-club>${availableRivals.map(club => `<option value="${escapeHtml(club.id)}">${escapeHtml(club.name)}</option>`).join('')}</select></label><label>Type<select data-rivalry-type><option value="local-derby">Local derby</option><option value="rivalry">Sporting rivalry</option><option value="promotion-race">Promotion race</option><option value="historic">Historic</option></select></label><button type="button" class="fm-button" data-register-rivalry>Add rivalry</button></div>` : ''}</article>
        <article class="surface"><header class="section-head"><h3>Responsibility map</h3><small>${escapeHtml(roleProfile.focus)}</small></header><div class="responsibility-map"><div><strong>You decide</strong><ul>${roleProfile.direct.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div><strong>Staff delegate</strong><ul>${roleProfile.delegated.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div></article></aside>
    </section>`;
}

function aiClubs() {
  return asArray(pick(careerWorldModel(), ['aiClubs'], []));
}

function worldClubBody(clubId) {
  const club = aiClubs().find(item => item.id === clubId);
  if (!club) return '<div class="empty-state"><strong>Club profile unavailable</strong><p>The football world changed before this profile opened.</p></div>';
  const rivalry = clubIdentityModel().rivalries.find(item => item.clubId === club.id);
  return `<div class="world-club-profile"><section class="player-profile-hero"><span class="player-profile-avatar club-avatar">${escapeHtml(initials(club.name))}</span><div><span>${escapeHtml(competitionDisplayName(club.divisionId) || titleCase(club.divisionId))}</span><h3>${escapeHtml(club.name)}</h3><p>${escapeHtml(titleCase(club.style))} · ${escapeHtml(club.formation)}</p></div><div class="player-overall"><strong>${number(club.strength)}</strong><small>Club strength</small><span>${number(club.reputation)} reputation</span></div></section><section class="profile-columns"><article class="profile-panel"><header><h4>Football department</h4><small>${number(club.seasonStats?.points)} points</small></header><dl class="metric-list"><div><dt>Manager</dt><dd>${escapeHtml(club.manager?.name || 'Vacant')}</dd></div><div><dt>Manager security</dt><dd>${formatPercent(club.manager?.security)}</dd></div><div><dt>Facilities</dt><dd>${number(club.facilities)}/100</dd></div><div><dt>Youth development</dt><dd>${number(club.youth)}/100</dd></div><div><dt>Scouting</dt><dd>${number(club.scouting)}/100</dd></div></dl></article><aside class="profile-panel"><header><h4>Club outlook</h4><small>${number(club.trajectory) > 0 ? 'Improving' : number(club.trajectory) < 0 ? 'Declining' : 'Stable'}</small></header><dl class="metric-list"><div><dt>Finances</dt><dd class="${number(club.finances) < 0 ? 'warning' : 'good'}">${formatMoney(club.finances, true)}</dd></div><div><dt>Ambition</dt><dd>${number(club.ambition)}/100</dd></div><div><dt>Supporter trust</dt><dd>${number(club.supporterTrust)}/100</dd></div><div><dt>Recent form</dt><dd>${escapeHtml(asArray(club.form).join(' ') || 'No matches')}</dd></div></dl>${rivalry ? `<p class="rivalry-callout">${escapeHtml(titleCase(rivalry.type))} · intensity ${number(rivalry.intensity)}/100</p>` : `<button type="button" class="fm-button" data-register-rivalry-direct="${escapeHtml(club.id)}">Register as rival</button>`}</aside></section>${asArray(club.events).length ? `<article class="profile-panel"><header><h4>Recent club events</h4></header><ul class="compact-record-list">${asArray(club.events).slice(-6).reverse().map(event => `<li><span><strong>${escapeHtml(event.text)}</strong><small>${event.season} · W${event.week}</small></span></li>`).join('')}</ul></article>` : ''}</div>`;
}

function worldView() {
  const clubs = aiClubs();
  const rivalIds = new Set(clubIdentityModel().rivalries.map(rivalry => rivalry.clubId));
  const filtered = clubs.filter(club => {
    if (worldFilter === 'all') return true;
    if (worldFilter === 'rivals') return rivalIds.has(club.id);
    if (worldFilter === 'rising') return number(club.trajectory) > 0;
    if (worldFilter === 'risk') return number(club.finances) < 0 || number(club.manager?.security) < 35;
    return club.divisionId === worldFilter;
  });
  const events = clubs.flatMap(club => asArray(club.events).map(event => ({ ...event, clubName: club.name, clubId: club.id }))).sort((a, b) => number(b.season) - number(a.season) || number(b.week) - number(a.week)).slice(0, 10);
  const rising = clubs.filter(club => number(club.trajectory) > 0).length;
  const atRisk = clubs.filter(club => number(club.finances) < 0 || number(club.manager?.security) < 35).length;
  const divisions = [...new Set(clubs.map(club => club.divisionId).filter(Boolean))];
  return `${viewHeading('Football world', 'Rival clubs now develop, spend, change managers and move through seasons alongside your club.', `<button type="button" class="fm-button" data-open-view="club-vision">Rivalries and identity</button>`)}
    <section class="stat-strip"><div><span>Tracked clubs</span><strong>${clubs.length}</strong><small>Living football world</small></div><div><span>Rivals</span><strong>${rivalIds.size}</strong><small>Registered derbies</small></div><div><span>Rising clubs</span><strong>${rising}</strong><small>Positive trajectory</small></div><div><span>Under pressure</span><strong>${atRisk}</strong><small>Finance or manager risk</small></div><div><span>Your division</span><strong>${escapeHtml(seniorDivisionName())}</strong><small>${clubs.filter(club => club.divisionId === seniorDivisionId()).length} AI clubs tracked</small></div></section>
    <section class="world-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Club landscape</h2><small>Click a club for its full profile</small></header><div class="world-filters" role="group" aria-label="Filter football world"><button type="button" class="${worldFilter === 'all' ? 'active' : ''}" data-world-filter="all">All</button><button type="button" class="${worldFilter === 'rivals' ? 'active' : ''}" data-world-filter="rivals">Rivals</button><button type="button" class="${worldFilter === 'rising' ? 'active' : ''}" data-world-filter="rising">Rising</button><button type="button" class="${worldFilter === 'risk' ? 'active' : ''}" data-world-filter="risk">At risk</button>${divisions.map(division => `<button type="button" class="${worldFilter === division ? 'active' : ''}" data-world-filter="${escapeHtml(division)}">${escapeHtml(competitionDisplayName(division) || titleCase(division))}</button>`).join('')}</div>${filtered.length ? `<div class="table-scroll"><table class="world-table"><thead><tr><th>Club</th><th>Division</th><th>Strength</th><th>Manager</th><th>Finances</th><th>Form</th><th>Trend</th></tr></thead><tbody>${filtered.map(club => `<tr class="${rivalIds.has(club.id) ? 'rival-club' : ''}"><td><button type="button" class="world-club-link" data-open-world-club="${escapeHtml(club.id)}"><span class="table-crest">${escapeHtml(initials(club.name))}</span><span><strong>${escapeHtml(club.name)}</strong>${rivalIds.has(club.id) ? '<small>Rival</small>' : ''}</span></button></td><td>${escapeHtml(competitionDisplayName(club.divisionId) || titleCase(club.divisionId))}</td><td><strong>${number(club.strength)}</strong></td><td><span>${escapeHtml(club.manager?.name || 'Vacant')}</span><small>${number(club.manager?.security)}% secure</small></td><td class="${number(club.finances) < 0 ? 'warning' : ''}">${formatMoney(club.finances, true)}</td><td><span class="form-string">${asArray(club.form).map(result => `<i class="result-${result.toLowerCase()}">${result}</i>`).join('') || '—'}</span></td><td><strong class="${number(club.trajectory) > 0 ? 'good' : number(club.trajectory) < 0 ? 'warning' : ''}">${number(club.trajectory) > 0 ? '+' : ''}${formatDecimal(club.trajectory, 1)}</strong></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><strong>No clubs match this view</strong><p>Change the world filter to inspect another part of the pyramid.</p></div>'}</article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>World news</h3><small>Latest club events</small></header>${events.length ? `<ul class="world-news">${events.map(event => `<li><span class="news-type">${escapeHtml(titleCase(event.type))}</span><button type="button" data-open-world-club="${escapeHtml(event.clubId)}"><strong>${escapeHtml(event.clubName)}</strong><span>${escapeHtml(event.text)}</span></button><time>${event.season} · W${event.week}</time></li>`).join('')}</ul>` : '<div class="empty-state compact"><strong>The world is quiet</strong><p>Manager changes, investments and club trends will be recorded as weeks advance.</p></div>'}</article><article class="surface"><header class="section-head"><h3>World simulation</h3></header><div class="role-remit-summary"><p>AI clubs independently evolve strength, youth, facilities, finances, tactics and manager security. Results and off-season changes persist in this save.</p></div></article></aside>
    </section>`;
}

function historyMatchLabel(match) {
  return `${match.opponentName || 'Opponent'} · ${number(match.goalsFor)}–${number(match.goalsAgainst)}`;
}

function historyView() {
  const history = pick(careerWorldModel(), ['history'], {}) || {};
  const seasons = asArray(history.seasons).slice().sort((a, b) => number(b.season) - number(a.season));
  const trophies = asArray(history.trophies).slice().sort((a, b) => number(b.season) - number(a.season));
  const matches = asArray(history.matches).slice().sort((a, b) => number(b.season) - number(a.season) || number(b.week) - number(a.week));
  const records = history.records || {};
  const filteredMatches = historySeasonFilter === 'all' ? matches : matches.filter(match => String(match.season) === historySeasonFilter);
  const biggestWin = records.biggestWin;
  const biggestLoss = records.biggestLoss;
  const highestAttendance = records.highestAttendance;
  return `${viewHeading('Club history', 'Every season, honour, result and club record builds a permanent story around your Queensland club.', `<button type="button" class="fm-button" data-open-view="world">Football world</button>`)}
    <section class="history-hero surface"><div>${userCrestMarkup('history-crest')}<span><small>Founded ${pick(footballState, ['club.founded', 'founded'], 2026)}</small><h2>${escapeHtml(clubModel().name)}</h2><p>${escapeHtml(clubIdentityModel().motto || `${clubModel().site?.region || 'Queensland'} football, built week by week.`)}</p></span></div><dl><div><dt>Seasons</dt><dd>${seasons.length}</dd></div><div><dt>Trophies</dt><dd>${trophies.length}</dd></div><div><dt>Matches recorded</dt><dd>${matches.length}</dd></div><div><dt>Longest unbeaten run</dt><dd>${number(records.longestUnbeatenRun)}</dd></div></dl></section>
    <section class="record-grid"><article class="surface"><span class="record-icon"><i class="ti ti-trophy" aria-hidden="true"></i></span><small>Biggest win</small><strong>${biggestWin ? escapeHtml(historyMatchLabel(biggestWin)) : 'Not set'}</strong><p>${biggestWin ? `${biggestWin.season} · ${escapeHtml(biggestWin.competition)}` : 'A qualifying result has not been recorded.'}</p></article><article class="surface"><span class="record-icon"><i class="ti ti-shield-x" aria-hidden="true"></i></span><small>Biggest defeat</small><strong>${biggestLoss ? escapeHtml(historyMatchLabel(biggestLoss)) : 'Not set'}</strong><p>${biggestLoss ? `${biggestLoss.season} · ${escapeHtml(biggestLoss.competition)}` : 'A qualifying result has not been recorded.'}</p></article><article class="surface"><span class="record-icon"><i class="ti ti-users" aria-hidden="true"></i></span><small>Record attendance</small><strong>${highestAttendance ? number(highestAttendance.attendance).toLocaleString('en-AU') : 'Not set'}</strong><p>${highestAttendance ? escapeHtml(highestAttendance.opponentName) : 'Matchday records appear after home fixtures.'}</p></article><article class="surface"><span class="record-icon"><i class="ti ti-ball-football" aria-hidden="true"></i></span><small>All-time top scorer</small><strong>${escapeHtml(records.topScorer?.name || 'Not set')}</strong><p>${number(records.topScorer?.goals)} goals</p></article><article class="surface"><span class="record-icon"><i class="ti ti-transfer" aria-hidden="true"></i></span><small>Record sale</small><strong>${number(records.recordTransferFeeReceived) ? formatMoney(records.recordTransferFeeReceived, true) : 'Not set'}</strong><p>Record signing: ${number(records.recordTransferFeePaid) ? formatMoney(records.recordTransferFeePaid, true) : 'not set'}</p></article></section>
    <section class="history-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Season archive</h2><small>${seasons.length} completed</small></header>${seasons.length ? `<div class="table-scroll"><table class="history-table"><thead><tr><th>Season</th><th>Division</th><th>Pos</th><th>P</th><th>W-D-L</th><th>GF-GA</th><th>Cup</th><th>Academy</th><th>Closing cash</th></tr></thead><tbody>${seasons.map(season => `<tr><td><strong>${season.season}</strong></td><td>${escapeHtml(competitionDisplayName(season.divisionId) || titleCase(season.divisionId))}</td><td>${number(season.leaguePosition)}</td><td>${number(season.points)}</td><td>${number(season.wins)}-${number(season.draws)}-${number(season.losses)}</td><td>${number(season.goalsFor)}-${number(season.goalsAgainst)}</td><td>${escapeHtml(season.cupResult)}</td><td>${escapeHtml(season.academyRating || '—')}</td><td>${formatMoney(season.cashBalance, true)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><strong>First season in progress</strong><p>The complete league, cup, academy and finance summary is archived at season review.</p></div>'}</article>
      <article class="surface"><header class="section-head"><h2>Match archive</h2><small>${filteredMatches.length} results</small></header><div class="history-filters" role="group" aria-label="Filter match history"><button type="button" class="${historySeasonFilter === 'all' ? 'active' : ''}" data-history-season="all">All seasons</button>${[...new Set(matches.map(match => String(match.season)))].map(season => `<button type="button" class="${historySeasonFilter === season ? 'active' : ''}" data-history-season="${season}">${season}</button>`).join('')}</div>${filteredMatches.length ? `<ul class="history-match-list">${filteredMatches.slice(0, 40).map(match => `<li><span class="history-result result-${String(match.result || 'D').toLowerCase()}">${escapeHtml(match.result || 'D')}</span><span><strong>${escapeHtml(match.opponentName)}</strong><small>${match.season} · W${match.week} · ${escapeHtml(match.competition)} · ${escapeHtml(titleCase(match.venue))}</small></span><b>${number(match.goalsFor)}–${number(match.goalsAgainst)}</b><button type="button" class="text-action" data-open-match-report="${escapeHtml(match.id)}">Report</button></li>`).join('')}</ul>` : '<div class="empty-state"><strong>No matches in this filter</strong><p>Recorded results will build the club’s permanent match archive.</p></div>'}</article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Honours</h3><small>${trophies.length} trophies</small></header>${trophies.length ? `<div class="trophy-cabinet">${trophies.map(trophy => `<article><span><i class="ti ti-trophy" aria-hidden="true"></i></span><div><strong>${escapeHtml(trophy.name)}</strong><small>${trophy.season} · ${escapeHtml(trophy.level)}</small><p>${escapeHtml(trophy.competition)}</p></div></article>`).join('')}</div>` : '<div class="empty-state compact"><strong>The cabinet is waiting</strong><p>League, cup, playoff and academy honours will be preserved here.</p></div>'}</article><article class="surface"><header class="section-head"><h3>Current runs</h3></header><dl class="metric-list"><div><dt>Winning run</dt><dd>${number(records.currentWinningRun)}</dd></div><div><dt>Longest winning run</dt><dd>${number(records.longestWinningRun)}</dd></div><div><dt>Unbeaten run</dt><dd>${number(records.currentUnbeatenRun)}</dd></div><div><dt>Longest unbeaten run</dt><dd>${number(records.longestUnbeatenRun)}</dd></div></dl></article></aside>
    </section>`;
}

function managerSettings() {
  const source = footballState?.settings || {};
  const savedMatchSpeed = ['1', '2'].includes(String(source.matchSpeed)) ? 'visual' : String(source.matchSpeed);
  return {
    matchSpeed: ['instant', 'visual'].includes(savedMatchSpeed) ? savedMatchSpeed : 'visual',
    confirmWeek: source.confirmWeek !== false,
    reducedMotion: Boolean(source.reducedMotion),
    compactTables: Boolean(source.compactTables),
    showCrestNotice: source.showCrestNotice !== false
  };
}

function applyVisualSettings(syncMatchSpeed = false) {
  const settings = managerSettings();
  document.body.classList.toggle('force-reduced-motion', settings.reducedMotion);
  document.body.classList.toggle('compact-football-tables', settings.compactTables);
  if (syncMatchSpeed || !['instant', 'visual'].includes(matchSpeed)) matchSpeed = settings.matchSpeed;
}

function settingsView() {
  const settings = managerSettings();
  const crestCombinations = CREST_SHAPES.length * Object.keys(CREST_SYMBOLS).length * Object.keys(CREST_COLOURS).length;
  return `${viewHeading('Settings', 'Control simulation behaviour, accessibility and this football save. These choices do not alter other Dorra progress.')}
    <section class="settings-layout"><div class="detail-stack"><article class="surface"><header class="section-head"><h2>Simulation</h2><small>Saved with this club</small></header><div class="settings-list"><label><span><strong>Default match view</strong><small>Visual matches run for 20 seconds per half.</small></span><select data-setting-match-speed><option value="visual"${settings.matchSpeed === 'visual' ? ' selected' : ''}>Visual match</option><option value="instant"${settings.matchSpeed === 'instant' ? ' selected' : ''}>Instant result</option></select></label><label><span><strong>Confirm before simulating a week</strong><small>Prevents accidental time advancement.</small></span><input type="checkbox" data-setting-confirm-week ${settings.confirmWeek ? 'checked' : ''}></label></div></article>
      <article class="surface"><header class="section-head"><h2>Display and accessibility</h2></header><div class="settings-list"><label><span><strong>Reduce interface motion</strong><small>Turns off non-essential transitions and smooth scrolling.</small></span><input type="checkbox" data-setting-reduced-motion ${settings.reducedMotion ? 'checked' : ''}></label><label><span><strong>Compact tables</strong><small>Shows more rows at once on larger screens.</small></span><input type="checkbox" data-setting-compact-tables ${settings.compactTables ? 'checked' : ''}></label><label><span><strong>Show crest rights notice</strong><small>Keeps the unofficial-use reminder on comparison screens.</small></span><input type="checkbox" data-setting-crest-notice ${settings.showCrestNotice ? 'checked' : ''}></label></div><div class="settings-actions"><button type="button" class="fm-button primary" data-save-manager-settings>Save settings</button></div></article></div>
      <aside class="detail-stack"><article class="surface"><header class="section-head"><h3>Club identity system</h3></header><div class="settings-summary">${userCrestMarkup('settings-crest')}<div><strong>${escapeHtml(clubModel().name)}</strong><p>Your selected shape, emblem and colours create one of ${crestCombinations.toLocaleString('en-AU')} built-in combinations, plus unlimited custom two-colour palettes. Uploaded crests remain supported.</p></div></div></article><article class="surface danger-zone"><header class="section-head"><h3>Reset football progress</h3><small>Danger zone</small></header><div><p>Delete this club, its seasons, facilities, squads and invested club funds, then return to club creation.</p><p><strong>Your Dorra balance and all non-football Dorra progress are preserved.</strong></p><button type="button" class="fm-button danger" data-open-reset-football-confirm>Reset Queensland Club Manager</button></div></article></aside></section>`;
}

function renderActiveView(focus = true) {
  const renderer = {
    overview: overviewView,
    inbox: inboxView,
    'first-team': firstTeamView,
    scouting: scoutingView,
    competitions: competitionsView,
    calendar: calendarView,
    'match-centre': fixturesView,
    'matchday-operations': matchdayOperationsView,
    academy: academyView,
    'fq-assessment': fqAssessmentView,
    fixtures: fixturesView,
    training: trainingView,
    recruitment: recruitmentView,
    'coach-desk': coachDeskView,
    'club-vision': clubVisionView,
    people: peopleView,
    facilities: facilitiesView,
    finances: financesView,
    commercial: commercialView,
    world: worldView,
    history: historyView,
    settings: settingsView
  }[activeView] || overviewView;
  dom.content.innerHTML = renderer();
  const fixtureById = new Map(fixtures().map(fixture => [String(fixture.id), fixture]));
  dom.content.querySelectorAll('[data-simulate-match]').forEach(button => {
    const fixture = fixtureById.get(String(button.dataset.simulateMatch));
    if (fixture && !fixture.canSimulate) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.title = `Scheduled for week ${fixture.week}`;
    }
  });
  applyVisualSettings();
  syncWorkspaceHeader();
  wireCrestFallbacks(dom.content);
  if (focus) {
    dom.content.focus({ preventScroll: true });
  }
}

async function setView(view) {
  if (!VIEW_META[view]) {
    closeMobileNav();
    return;
  }
  if (activeView !== view) viewScrollPositions.set(activeView, globalThis.scrollY || 0);
  activeView = view;
  const dueConstruction = view === 'facilities' && asArray(footballState?.projects).some(project => number(project.completesAtMs) <= Date.now());
  if (dueConstruction && typeof FootballEngine.reconcileConstruction === 'function') {
    const result = await runEngine('reconcileConstruction', [], { reason: 'football-build' });
    closeMobileNav();
    if (result) return;
  }
  renderActiveView(true);
  closeMobileNav();
  requestAnimationFrame(() => globalThis.scrollTo?.({ top: viewScrollPositions.get(view) || 0, behavior: 'auto' }));
}

function setDomain(domain) {
  const view = DOMAIN_DEFAULT_VIEW[domain];
  if (view) setView(view);
}

function openMobileNav() {
  dom.sidebar.classList.add('context-open');
  dom.mobileScrim.hidden = false;
  $('[data-open-mobile-nav]')?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('mobile-context-opened');
}

function closeMobileNav() {
  dom.sidebar.classList.remove('context-open');
  dom.mobileScrim.hidden = true;
  $('[data-open-mobile-nav]')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('mobile-context-opened');
}

const LIVE_STYLE_MOTION = Object.freeze({
  balanced: { advance: 7, block: 5, compact: .24, support: .2, width: 1, pressers: 1 },
  possession: { advance: 8, block: 4, compact: .3, support: .34, width: 1.08, pressers: 1 },
  'high-press': { advance: 11, block: 2, compact: .4, support: .28, width: .88, pressers: 2 },
  counterattack: { advance: 15, block: 8, compact: .32, support: .17, width: 1.04, pressers: 1 },
  direct: { advance: 13, block: 6, compact: .2, support: .13, width: .96, pressers: 1 },
  'low-block': { advance: 5, block: 12, compact: .46, support: .12, width: .76, pressers: 1 },
  'youth-first': { advance: 8, block: 5, compact: .28, support: .29, width: 1.04, pressers: 1 }
});

const LIVE_STYLE_PHASES = Object.freeze({
  balanced: ['Build-up from the back', 'The midfield line advances', 'Support arrives around the ball', 'A chance opens at the edge of the area'],
  possession: ['Patient circulation across the back line', 'A passing triangle forms in midfield', 'The spare player receives between the lines', 'A cut-back lane opens in the box'],
  'high-press': ['The front line jumps to press', 'Possession is won high up the pitch', 'Runners swarm around the ball', 'The press creates an immediate chance'],
  counterattack: ['The compact block regains possession', 'A vertical pass launches the break', 'Two runners attack the open space', 'The counter reaches the penalty area'],
  direct: ['The goalkeeper looks long', 'The striker attacks the first ball', 'Midfielders contest the second ball', 'A direct run breaks the final line'],
  'low-block': ['The defensive block stays narrow', 'Possession is protected under pressure', 'The wide outlet carries the ball forward', 'Support arrives for a measured chance'],
  'youth-first': ['The young side builds with patience', 'A midfielder shows for the ball', 'Wide support stretches the opposition', 'A confident run reaches the final third']
});

function formationSlots(formation = '4-3-3', startsLeft = true) {
  let lines = String(formation).split('-').map(value => number(value)).filter(value => value > 0);
  if (lines.reduce((sum, value) => sum + value, 0) !== 10) lines = [4, 3, 3];
  const slots = [{ x: 8, y: 50, goalkeeper: true, lineIndex: -1, lineOrder: 0, position: 'GK', role: 'Goalkeeper' }];
  lines.forEach((count, lineIndex) => {
    const x = lines.length === 1 ? 50 : 27 + ((46 * lineIndex) / (lines.length - 1));
    const position = lineIndex === 0 ? 'DF' : lineIndex === lines.length - 1 ? 'FW' : 'MF';
    for (let index = 0; index < count; index += 1) {
      const role = position === 'DF' ? `Defender ${index + 1}` : position === 'FW' ? `Forward ${index + 1}` : `Midfielder ${index + 1}`;
      slots.push({ x, y: ((index + 1) * 100) / (count + 1), goalkeeper: false, lineIndex, lineOrder: index, position, role });
    }
  });
  return slots.map(slot => ({ ...slot, x: startsLeft ? slot.x : 100 - slot.x }));
}

function liveTacticProfile(fixture, phaseResult, side) {
  const team = fixture?.[side] || {};
  const squad = fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team);
  const selection = squadSelection(squad);
  const recorded = phaseResult?.tactics?.[side] || {};
  const formation = recorded.formation || recorded.formationId || (team.isPlayer ? selection.formation : '4-3-3');
  const styleId = recorded.styleId || (team.isPlayer ? pick(squad === 'academy' ? academyModel() : squad === 'u23' ? footballState?.u23 : seniorModel(), ['styleId'], 'balanced') : 'balanced');
  return { formation, styleId, motion: LIVE_STYLE_MOTION[styleId] || LIVE_STYLE_MOTION.balanced };
}

function liveTeamPlayers(fixture, team, phaseResult, slots, side) {
  if (!team?.isPlayer) return slots.map((slot, index) => ({ id: `opponent-${side}-${index + 1}`, name: `${team?.name || 'Opponent'} ${slot.role}`, position: slot.position, squadNumber: index + 1 }));
  const squad = fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team);
  const selection = squadSelection(squad);
  const players = asArray(selection.players);
  const lineupIds = asArray(phaseResult?.playerLineupIds).length === 11 ? phaseResult.playerLineupIds : selection.lineup;
  const starters = asArray(lineupIds).map(id => players.find(player => player.id === id)).filter(Boolean);
  while (starters.length < 11) {
    const slot = slots[starters.length];
    starters.push({ id: `player-${side}-${starters.length + 1}`, name: `${team.name} ${slot.role}`, position: slot.position, squadNumber: starters.length + 1 });
  }
  const remaining = starters.slice(0, 11);
  return slots.map(slot => {
    const index = remaining.findIndex(player => player.position === slot.position);
    return remaining.splice(index < 0 ? 0 : index, 1)[0];
  });
}

function livePitchPlayersMarkup(fixture, team, side, startsLeft, phaseResult, tactic) {
  const slots = formationSlots(tactic.formation, startsLeft);
  return liveTeamPlayers(fixture, team, phaseResult, slots, side).map((player, index) => {
    const slot = slots[index];
    const squadNumber = Math.max(1, number(player.squadNumber, index + 1));
    const shortName = String(player.name || slot.role).split(/\s+/).at(-1) || slot.role;
    const label = `#${squadNumber} ${player.name} · ${player.position || slot.position}`;
    return `<span class="pitch-player ${team?.isPlayer ? 'user-player' : 'opponent-player'} side-${side}${slot.goalkeeper ? ' goalkeeper' : ''}" style="left:${slot.x}%;top:${slot.y}%" data-base-x="${slot.x}" data-base-y="${slot.y}" data-line-index="${slot.lineIndex}" data-line-order="${slot.lineOrder}" data-player-id="${escapeHtml(player.id)}" data-player-name="${escapeHtml(player.name)}" data-position="${escapeHtml(player.position || slot.position)}" data-shirt-number="${squadNumber}" tabindex="0" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><b>${squadNumber}</b><em>${escapeHtml(shortName)}</em></span>`;
  }).join('');
}

function liveHalfDuration() {
  const qaDuration = Number(globalThis.__DORRA_QA_LIVE_HALF_MS);
  return Number.isFinite(qaDuration) ? Math.max(50, Math.min(LIVE_HALF_MS, qaDuration)) : LIVE_HALF_MS;
}

function liveIncidentKey(incident = {}) {
  return `${incident.type}-${incident.minute}-${incident.teamId}-${incident.playerId || ''}`;
}

function liveIncidentIdentity(incident = {}, knownPlayers = []) {
  const player = asArray(knownPlayers).find(candidate => (candidate?.dataset?.playerId || candidate?.id) === incident.playerId);
  const squadNumber = player?.dataset?.shirtNumber || player?.squadNumber;
  return `${squadNumber ? `#${squadNumber} ` : ''}${incident.playerName || 'Player'}`;
}

function liveIncidentCopy(incident = {}, knownPlayers = []) {
  const identity = liveIncidentIdentity(incident, knownPlayers);
  if (incident.type === 'goal') return `Goal — ${identity}${incident.assistPlayerName ? ` · Assist: ${incident.assistPlayerName}` : ''}`;
  if (incident.type === 'card') return `Yellow card — ${identity}`;
  return incident.text || titleCase(incident.type);
}

function liveIncidentItemMarkup(incident, knownPlayers = []) {
  return `<li class="event-${escapeHtml(incident.type)}"><b>${number(incident.minute)}′</b><span>${escapeHtml(liveIncidentCopy(incident, knownPlayers))}</span></li>`;
}

function liveMatchVisualMarkup(fixture, half, phaseResult = {}, firstHalfResult = null) {
  const secondHalf = half === 2;
  const club = clubModel();
  const clubPrimary = validCrestColour(club.primary, CREST_COLOURS.maroon[0]);
  const clubSecondary = validCrestColour(club.secondary, CREST_COLOURS.maroon[1]);
  const homeStartsLeft = !secondHalf;
  const startingHome = secondHalf ? number(firstHalfResult?.homeGoals, 0) : 0;
  const startingAway = secondHalf ? number(firstHalfResult?.awayGoals, 0) : 0;
  const durationSeconds = Math.max(1, Math.ceil(liveHalfDuration() / 1000));
  const homeTactic = liveTacticProfile(fixture, phaseResult, 'home');
  const awayTactic = liveTacticProfile(fixture, phaseResult, 'away');
  const squad = fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team);
  const knownPlayers = asArray(squadSelection(squad).players);
  const carriedIncidents = secondHalf ? asArray(firstHalfResult?.incidents).filter(incident => ['goal', 'card'].includes(incident.type)).sort((a, b) => number(a.minute) - number(b.minute)) : [];
  const carriedIncidentMarkup = carriedIncidents.slice(-5).reverse().map(incident => liveIncidentItemMarkup(incident, knownPlayers)).join('');
  return `<div class="live-match-visual" style="--user-kit:${clubPrimary};--user-kit-second:${clubSecondary};--user-kit-ink:${crestInk(clubPrimary)}">
    <div class="live-scorebar">
      <div class="live-team home" data-live-team="home"><i class="${fixture.home.isPlayer ? 'user-kit' : 'opponent-kit'}"></i><span><strong>${escapeHtml(fixture.home.name)}</strong><small>${escapeHtml(homeTactic.formation)} · ${escapeHtml(titleCase(homeTactic.styleId))}</small></span></div>
      <div class="live-clock"><span data-live-score aria-live="polite">${startingHome}–${startingAway}</span><small><b data-live-minute>${secondHalf ? '45′' : '0′'}</b> · <b data-live-countdown>${durationSeconds}</b>s left</small></div>
      <div class="live-team away" data-live-team="away"><span><strong>${escapeHtml(fixture.away.name)}</strong><small>${escapeHtml(awayTactic.formation)} · ${escapeHtml(titleCase(awayTactic.styleId))}</small></span><i class="${fixture.away.isPlayer ? 'user-kit' : 'opponent-kit'}"></i></div>
    </div>
    <div class="match-pitch" data-live-pitch role="group" aria-label="Live top-down football pitch showing eleven players from each team">
      <span class="pitch-halfway" aria-hidden="true"></span><span class="pitch-centre-circle" aria-hidden="true"></span><span class="pitch-centre-spot" aria-hidden="true"></span>
      <span class="pitch-penalty-area left" aria-hidden="true"></span><span class="pitch-penalty-area right" aria-hidden="true"></span>
      <span class="pitch-goal-area left" aria-hidden="true"></span><span class="pitch-goal-area right" aria-hidden="true"></span>
      <span class="pitch-goal left" aria-hidden="true"></span><span class="pitch-goal right" aria-hidden="true"></span>
      <span class="pitch-penalty-spot left" aria-hidden="true"></span><span class="pitch-penalty-spot right" aria-hidden="true"></span>
      <span class="pitch-corner top-left" aria-hidden="true"></span><span class="pitch-corner top-right" aria-hidden="true"></span><span class="pitch-corner bottom-left" aria-hidden="true"></span><span class="pitch-corner bottom-right" aria-hidden="true"></span>
      ${livePitchPlayersMarkup(fixture, fixture.home, 'home', homeStartsLeft, phaseResult, homeTactic)}
      ${livePitchPlayersMarkup(fixture, fixture.away, 'away', !homeStartsLeft, phaseResult, awayTactic)}
      <span class="match-ball" data-live-ball aria-hidden="true"></span>
      <div class="live-event-overlay" data-live-event-overlay hidden aria-live="assertive"><small data-live-event-kicker></small><strong data-live-event-title></strong><span data-live-event-detail></span></div>
      <details class="live-events-panel"><summary>Events <b data-live-event-count>${carriedIncidents.length}</b></summary><ol data-live-event-list>${carriedIncidentMarkup || '<li class="empty">No match incidents yet</li>'}</ol></details>
    </div>
    <div class="live-match-footer"><span data-live-status aria-live="polite">${secondHalf ? 'The second half is under way.' : 'Kick-off. Your shape is settling.'}</span><span class="live-possession-chip"><i></i><b data-live-possession>Home possession</b></span><div class="live-half-progress" aria-label="Half progress"><i data-live-progress></i></div><div class="live-controls" data-live-controls role="group" aria-label="Live match controls"><button type="button" data-live-toggle aria-pressed="false" title="Pause or resume (Space)">Pause</button><button type="button" data-live-speed title="Change playback speed">1×</button><button type="button" data-live-next title="Jump to next highlight">Next</button><button type="button" data-live-skip title="Skip to halftime or full time">Skip half</button></div></div>
  </div>`;
}

function cancelLiveMatchVisual() {
  liveMatchRunId += 1;
  if (liveMatchFrame) clearTimeout(liveMatchFrame);
  liveMatchFrame = 0;
  if (liveMatchCleanup) liveMatchCleanup();
  liveMatchCleanup = null;
  if (liveMatchResolve) {
    const resolve = liveMatchResolve;
    liveMatchResolve = null;
    resolve(false);
  }
}

function liveAttacksRight(side, half) {
  return side === 'home' ? half === 1 : half === 2;
}

function liveBallSequence(fixture, half, phaseResult, players) {
  const point = player => ({ x: number(player?.dataset.baseX, 50), y: number(player?.dataset.baseY, 50) });
  const teamPlayers = side => players.filter(player => player.classList.contains(`side-${side}`) && !player.classList.contains('goalkeeper'));
  const ordered = side => teamPlayers(side).slice().sort((a, b) => {
    const direction = liveAttacksRight(side, half) ? 1 : -1;
    return (number(a.dataset.baseX) - number(b.dataset.baseX)) * direction || number(a.dataset.baseY) - number(b.dataset.baseY);
  });
  const home = ordered('home'), away = ordered('away');
  const frames = [{ t: 0, x: 50, y: 50, label: 'Kick-off', side: 'home', type: 'kickoff', phase: 'restart' }];
  for (let index = 1; index <= 18; index += 1) {
    const side = Math.floor((index - 1) / 4) % 2 === 0 ? 'home' : 'away';
    const pool = side === 'home' ? home : away;
    const tactic = liveTacticProfile(fixture, phaseResult, side);
    const copy = LIVE_STYLE_PHASES[tactic.styleId] || LIVE_STYLE_PHASES.balanced;
    const step = (index - 1) % 4;
    const playerIndex = step === 0 ? 1 : step === 1 ? Math.floor(pool.length * .42) : step === 2 ? Math.floor(pool.length * .68) : pool.length - 1;
    const player = pool[Math.max(0, Math.min(pool.length - 1, playerIndex))];
    const base = point(player);
    const direction = liveAttacksRight(side, half) ? 1 : -1;
    const wideBias = step === 2 ? (index % 2 ? -16 : 16) : 0;
    const x = step === 3 ? (direction > 0 ? 86 : 14) : clamp(base.x + direction * [1, 5, 9, 13][step], 4, 96);
    const y = clamp(base.y + wideBias, 10, 90);
    const type = step === 0 ? 'build-up' : step === 1 ? 'pass' : step === 2 ? 'carry' : 'chance';
    frames.push({ t: index / 19, x, y, label: copy[step], side, type, phase: type, carrierId: player?.dataset.playerId || '' });
  }
  frames.push({ t: 1, x: 50, y: 50, label: half === 1 ? 'Half-time whistle' : 'The final whistle approaches', side: 'home', type: 'full-time', phase: 'restart' });
  const halfStart = half === 2 ? 45 : 0;
  const incidents = asArray(phaseResult?.incidents).filter(incident => ['goal', 'card'].includes(incident.type)).map(incident => ({ incident, t: clamp((number(incident.minute) - halfStart) / 45, .02, .98) }));
  for (const { incident, t } of incidents) {
    const homeId = phaseResult?.home || fixture.home?.id;
    const side = incident.teamId === homeId ? 'home' : 'away';
    const right = liveAttacksRight(side, half);
    const pool = side === 'home' ? home : away;
    const involved = pool.find(player => player.dataset.playerId === incident.playerId) || pool.at(-1);
    const origin = point(involved);
    const incidentKey = liveIncidentKey(incident);
    for (let index = frames.length - 1; index >= 0; index -= 1) {
      if (Math.abs(frames[index].t - t) < .085 && !frames[index].incidentKey) frames.splice(index, 1);
    }
    if (incident.type === 'card') {
      frames.push(
        { t: Math.max(.01, t - .035), x: origin.x, y: origin.y, label: 'A late challenge stops the move', side, type: 'foul', phase: 'duel', carrierId: involved?.dataset.playerId || '', incidentKey },
        { t, x: origin.x, y: origin.y, label: incident.text || 'Yellow card', side, type: 'card', phase: 'stoppage', carrierId: involved?.dataset.playerId || '', event: incident, incidentKey },
        { t: Math.min(.995, t + .04), x: origin.x, y: origin.y, label: 'Play restarts from the free kick', side: side === 'home' ? 'away' : 'home', type: 'restart', phase: 'restart', incidentKey }
      );
    } else {
      const shotY = clamp(origin.y * .48 + 26, 30, 70);
      frames.push(
        { t: Math.max(.01, t - .08), x: right ? Math.max(60, origin.x) : Math.min(40, origin.x), y: origin.y, label: 'The attack surges into the final third', side, type: 'carry', phase: 'attack', carrierId: involved?.dataset.playerId || '', incidentKey },
        { t: Math.max(.02, t - .045), x: right ? 83 : 17, y: shotY, label: 'A clear shooting lane opens', side, type: 'chance', phase: 'chance', carrierId: involved?.dataset.playerId || '', incidentKey },
        { t: Math.max(.03, t - .018), x: right ? 91 : 9, y: shotY, label: `${incident.playerName || 'The forward'} shoots`, side, type: 'shot', phase: 'shot', carrierId: involved?.dataset.playerId || '', incidentKey },
        { t, x: right ? 99.35 : .65, y: 50, label: incident.text || 'GOAL — the ball hits the net', side, type: 'goal', phase: 'goal', carrierId: involved?.dataset.playerId || '', event: incident, incidentKey },
        { t: Math.min(.993, t + .04), x: right ? 94 : 6, y: 50, label: `${incident.playerName || 'The scorer'} celebrates`, side, type: 'celebration', phase: 'celebration', carrierId: involved?.dataset.playerId || '', event: incident, incidentKey },
        { t: Math.min(.998, t + .085), x: 50, y: 50, label: 'Restart from the centre spot', side: side === 'home' ? 'away' : 'home', type: 'restart', phase: 'restart', incidentKey }
      );
    }
  }
  return frames.sort((a, b) => a.t - b.t);
}

function interpolateLiveBall(sequence, ratio) {
  let index = sequence.findIndex(frame => frame.t >= ratio);
  if (index < 0) index = sequence.length - 1;
  const next = sequence[index], previous = sequence[Math.max(0, index - 1)];
  const span = Math.max(.0001, next.t - previous.t), raw = clamp((ratio - previous.t) / span), eased = raw * raw * (3 - 2 * raw);
  const active = ratio >= next.t - .0001 ? next : previous;
  return { x: previous.x + (next.x - previous.x) * eased, y: previous.y + (next.y - previous.y) * eased, label: active.label, type: active.type, phase: active.phase || active.type, side: active.side, carrierId: active.carrierId || '', event: active.event || null };
}

function livePlayerTargets(players, ballState, half, phaseResult) {
  const sides = ['home', 'away'];
  const closest = Object.fromEntries(sides.map(side => {
    const ranked = players.filter(player => player.classList.contains(`side-${side}`) && !player.classList.contains('goalkeeper')).slice().sort((a, b) => {
      const distance = player => Math.hypot(number(player.dataset.baseX, 50) - ballState.x, number(player.dataset.baseY, 50) - ballState.y);
      return distance(a) - distance(b);
    });
    return [side, ranked];
  }));
  return players.map(player => {
    const side = player.classList.contains('side-home') ? 'home' : 'away';
    const direction = liveAttacksRight(side, half) ? 1 : -1;
    const baseX = number(player.dataset.baseX, 50), baseY = number(player.dataset.baseY, 50);
    const lineIndex = number(player.dataset.lineIndex, 0), goalkeeper = player.classList.contains('goalkeeper');
    const hasBall = player.dataset.playerId === ballState.carrierId;
    const inPossession = side === ballState.side;
    const profile = (LIVE_STYLE_MOTION[phaseResult?.tactics?.[side]?.styleId] || LIVE_STYLE_MOTION.balanced);
    let x = baseX, y = baseY, involved = hasBall;
    if (goalkeeper) {
      x = baseX + direction * (inPossession ? 2.1 : -.8);
      y = 50 + (ballState.y - 50) * .13;
    } else if (['goal', 'celebration'].includes(ballState.type) && inPossession) {
      const scorerX = clamp(ballState.x - direction * 8, 8, 92);
      const supportingPlayers = closest[side].filter(candidate => candidate.dataset.playerId !== ballState.carrierId);
      const order = hasBall ? 0 : supportingPlayers.indexOf(player) + 1;
      if (order >= 0 && order < 5) {
        x = scorerX - direction * (2 + (order % 4) * 2.2);
        y = clamp(50 + ((order % 5) - 2) * 5.3, 12, 88);
        involved = true;
      } else {
        x = baseX + direction * Math.min(4, profile.advance * .35);
        y = 50 + (baseY - 50) * .9;
      }
    } else if (inPossession) {
      const forwardBall = clamp((ballState.x - 50) * direction, -40, 40);
      const lineWeight = Math.max(.15, (lineIndex + 1) / 4);
      x = baseX + direction * (profile.advance * (.45 + lineWeight * .55) + forwardBall * (.1 + lineWeight * .08));
      const shapedY = 50 + (baseY - 50) * profile.width;
      y = shapedY + (ballState.y - shapedY) * profile.support;
      if (hasBall) {
        x = ballState.x - direction * .8;
        y = ballState.y;
      } else if (ballState.type === 'chance' && Math.abs(baseY - ballState.y) > 18 && lineIndex >= 1) {
        x += direction * 6;
        y += baseY < 50 ? -5 : 5;
        involved = true;
      }
    } else {
      const opponentDirection = -direction;
      const threat = clamp(((ballState.x - 50) * opponentDirection + 12) / 62, 0, 1);
      x = baseX - direction * (profile.block + threat * (5 + Math.max(0, lineIndex) * 1.4));
      y = baseY + (ballState.y - baseY) * profile.compact;
      const rank = closest[side].indexOf(player);
      if (rank >= 0 && rank < profile.pressers) {
        x = ballState.x + direction * (2.8 + rank * 3.2);
        y = ballState.y + (rank ? (baseY < ballState.y ? -5 : 5) : 0);
        involved = true;
      } else if (rank === profile.pressers) {
        x = (x + ballState.x + direction * 7) / 2;
        y = (y + ballState.y) / 2;
        involved = true;
      }
    }
    if (['foul', 'card'].includes(ballState.type) && Math.hypot(x - ballState.x, y - ballState.y) < 18) involved = true;
    return { x: clamp(x, 3, 97), y: clamp(y, 5, 95), hasBall, involved };
  });
}

function separateLivePlayerPositions(players, positions, minimumDistance = 5.2) {
  ['home', 'away'].forEach(side => {
    const indexes = players.map((player, index) => player.classList.contains(`side-${side}`) ? index : -1).filter(index => index >= 0);
    for (let pass = 0; pass < 3; pass += 1) {
      indexes.forEach((firstIndex, offset) => {
        indexes.slice(offset + 1).forEach(secondIndex => {
          const first = positions[firstIndex], second = positions[secondIndex];
          let dx = second.x - first.x, dy = second.y - first.y;
          let distance = Math.hypot(dx, dy);
          if (distance >= minimumDistance) return;
          if (distance < .05) {
            const firstLane = number(players[firstIndex].dataset.baseY, 50);
            const secondLane = number(players[secondIndex].dataset.baseY, 50);
            dx = Math.abs(firstLane - secondLane) > .1 ? 0 : (secondIndex % 2 ? 1 : -1);
            dy = Math.abs(firstLane - secondLane) > .1 ? Math.sign(secondLane - firstLane) : (secondIndex % 2 ? -1 : 1);
            distance = Math.hypot(dx, dy);
          }
          const correction = (minimumDistance - distance) / 2;
          const unitX = dx / distance, unitY = dy / distance;
          first.x = clamp(first.x - unitX * correction, 3, 97);
          first.y = clamp(first.y - unitY * correction, 5, 95);
          second.x = clamp(second.x + unitX * correction, 3, 97);
          second.y = clamp(second.y + unitY * correction, 5, 95);
        });
      });
    }
  });
}

function playVisualHalf(fixture, half, phaseResult, firstHalfResult = null) {
  cancelLiveMatchVisual();
  clearTimeout(toastTimer);
  dom.toast?.classList.remove('show');
  const runId = liveMatchRunId;
  openDialog({ label: fixture.competition, title: `${half === 2 ? 'Second' : 'First'} half · live`, body: liveMatchVisualMarkup(fixture, half, phaseResult, firstHalfResult) });
  const pitch = $('[data-live-pitch]');
  const players = pitch ? [...pitch.querySelectorAll('.pitch-player')] : [];
  const ball = pitch?.querySelector('[data-live-ball]');
  const score = $('[data-live-score]');
  const minute = $('[data-live-minute]');
  const countdown = $('[data-live-countdown]');
  const progress = $('[data-live-progress]');
  const status = $('[data-live-status]');
  const possession = $('[data-live-possession]');
  const homeTeam = $('[data-live-team="home"]');
  const awayTeam = $('[data-live-team="away"]');
  const controls = $('[data-live-controls]');
  const toggleButton = $('[data-live-toggle]');
  const speedButton = $('[data-live-speed]');
  const eventOverlay = $('[data-live-event-overlay]');
  const eventKicker = $('[data-live-event-kicker]');
  const eventTitle = $('[data-live-event-title]');
  const eventDetail = $('[data-live-event-detail]');
  const eventList = $('[data-live-event-list]');
  const eventCount = $('[data-live-event-count]');
  const eventsPanel = $('.live-events-panel');
  const visual = $('.live-match-visual');
  const portraitLayout = globalThis.matchMedia('(max-width: 760px) and (min-height: 600px)');
  const updateMatchLayout = () => {
    visual?.classList.toggle('mobile-match-layout', portraitLayout.matches);
    if (!eventsPanel) return;
    if (portraitLayout.matches) {
      controls?.closest('.live-match-footer')?.before(eventsPanel);
      eventsPanel.open = true;
    } else {
      pitch?.append(eventsPanel);
      eventsPanel.open = false;
    }
  };
  updateMatchLayout();
  portraitLayout.addEventListener('change', updateMatchLayout);
  const duration = liveHalfDuration();
  const reducedMotion = managerSettings().reducedMotion || Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const phaseIncidents = asArray(phaseResult?.incidents).filter(incident => ['goal', 'card'].includes(incident.type)).sort((a, b) => number(a.minute) - number(b.minute));
  const startingHome = half === 2 ? number(firstHalfResult?.homeGoals, 0) : 0;
  const startingAway = half === 2 ? number(firstHalfResult?.awayGoals, 0) : 0;
  const ballSequence = liveBallSequence(fixture, half, phaseResult, players);
  const visualPositions = players.map(player => ({ x: number(player.dataset.baseX, 50), y: number(player.dataset.baseY, 50) }));
  const carriedIncidents = half === 2 ? asArray(firstHalfResult?.incidents).filter(incident => ['goal', 'card'].includes(incident.type)) : [];
  // Track each occurrence: one player can score twice in the same minute.
  let recordedIncidentCount = 0;
  let elapsed = 0;
  let lastTick = Date.now();
  let paused = false;
  let playbackSpeed = 1;
  let lastEventKey = '';
  let lastDrawElapsed = -1;
  const setPaused = value => {
    paused = Boolean(value);
    pitch?.classList.toggle('match-paused', paused);
    if (toggleButton) {
      toggleButton.textContent = paused ? 'Resume' : 'Pause';
      toggleButton.setAttribute('aria-pressed', String(paused));
    }
    lastTick = Date.now();
  };
  const jumpToNextHighlight = () => {
    const ratio = elapsed / duration;
    const next = ballSequence.find(frame => frame.t > ratio + .018 && ['chance', 'shot', 'card', 'goal'].includes(frame.type));
    if (!next) return;
    const highlightTime = next.t * duration;
    const leadInTime = highlightTime - Math.min(900, duration * .035);
    elapsed = Math.max(elapsed, leadInTime > elapsed + 50 ? leadInTime : highlightTime);
    lastTick = Date.now();
  };
  const handleControls = event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-live-toggle')) setPaused(!paused);
    if (target.hasAttribute('data-live-speed')) {
      playbackSpeed = playbackSpeed === 1 ? 2 : 1;
      if (speedButton) speedButton.textContent = `${playbackSpeed}×`;
      lastTick = Date.now();
    }
    if (target.hasAttribute('data-live-next')) jumpToNextHighlight();
    if (target.hasAttribute('data-live-skip')) { elapsed = duration; setPaused(false); }
  };
  const handleLiveKeydown = event => {
    if (dom.dialog.hidden || !dom.dialog.classList.contains('live-match-mode')) return;
    if (event.target.closest('button,select,input,textarea,summary,a,[contenteditable="true"]')) return;
    if (event.code === 'Space') { event.preventDefault(); setPaused(!paused); }
    if (event.key === 'ArrowRight') { event.preventDefault(); jumpToNextHighlight(); }
  };
  const cleanup = () => {
    controls?.removeEventListener('click', handleControls);
    document.removeEventListener('keydown', handleLiveKeydown);
    portraitLayout.removeEventListener('change', updateMatchLayout);
  };
  controls?.addEventListener('click', handleControls);
  document.addEventListener('keydown', handleLiveKeydown);
  liveMatchCleanup = cleanup;
  return new Promise(resolve => {
    liveMatchResolve = resolve;
    const finish = completed => {
      if (liveMatchResolve === resolve) liveMatchResolve = null;
      liveMatchFrame = 0;
      if (liveMatchCleanup === cleanup) {
        cleanup();
        liveMatchCleanup = null;
      }
      resolve(completed);
    };
    const draw = () => {
      if (runId !== liveMatchRunId || dom.dialog.hidden) return finish(false);
      const now = Date.now();
      if (!paused) elapsed = Math.min(duration, elapsed + Math.max(0, now - lastTick) * playbackSpeed);
      lastTick = now;
      const ratio = elapsed / duration;
      const matchMinute = (half === 2 ? 45 : 0) + Math.min(45, Math.floor(ratio * 45));
      if (minute) minute.textContent = `${matchMinute}′`;
      if (countdown) countdown.textContent = Math.max(0, Math.ceil((duration - elapsed) / (1000 * playbackSpeed)));
      if (progress) progress.style.width = `${ratio * 100}%`;
      const elapsedIncidents = phaseIncidents.filter(incident => number(incident.minute) <= matchMinute);
      const phaseHomeGoals = elapsedIncidents.filter(incident => incident.type === 'goal' && incident.teamId === phaseResult?.home).length;
      const phaseAwayGoals = elapsedIncidents.filter(incident => incident.type === 'goal' && incident.teamId === phaseResult?.away).length;
      const scoreText = `${startingHome + phaseHomeGoals}–${startingAway + phaseAwayGoals}`;
      if (score && score.textContent !== scoreText) score.textContent = scoreText;
      const ballState = interpolateLiveBall(ballSequence, ratio);
      const liveBallEvent = ballState.event && number(ballState.event.minute) <= matchMinute ? ballState.event : null;
      const statusText = liveBallEvent?.text || ballState.label || 'The match shape resets.';
      if (status && status.textContent !== statusText) status.textContent = statusText;
      if (possession) possession.textContent = `${ballState.side === 'home' ? fixture.home.name : fixture.away.name} possession`;
      homeTeam?.classList.toggle('in-possession', ballState.side === 'home');
      awayTeam?.classList.toggle('in-possession', ballState.side === 'away');
      const newIncidents = elapsedIncidents.slice(recordedIncidentCount);
      newIncidents.forEach(incident => {
        eventList?.querySelector('.empty')?.remove();
        if (eventList) {
          const item = document.createElement('li');
          item.className = `event-${incident.type}`;
          const time = document.createElement('b');
          const copy = document.createElement('span');
          time.textContent = `${number(incident.minute)}′`;
          copy.textContent = liveIncidentCopy(incident, players);
          item.append(time, copy);
          eventList.prepend(item);
          while (eventList.children.length > 5) eventList.lastElementChild?.remove();
        }
      });
      recordedIncidentCount = elapsedIncidents.length;
      if (eventCount) eventCount.textContent = String(carriedIncidents.length + recordedIncidentCount);
      const eventKey = liveBallEvent ? `${liveBallEvent.type}-${liveBallEvent.minute}-${ballState.type}` : '';
      if (eventOverlay) {
        const visibleEvent = liveBallEvent && ['goal', 'celebration', 'card'].includes(ballState.type);
        eventOverlay.hidden = !visibleEvent;
        eventOverlay.classList.toggle('event-goal', ['goal', 'celebration'].includes(ballState.type));
        eventOverlay.classList.toggle('event-card', ballState.type === 'card');
        if (visibleEvent && eventKey !== lastEventKey) {
          const incident = liveBallEvent;
          const marker = players.find(player => player.dataset.playerId === incident.playerId);
          const playerIdentity = `${marker?.dataset.shirtNumber ? `#${marker.dataset.shirtNumber} ` : ''}${incident.playerName || (incident.type === 'goal' ? 'Goal confirmed' : 'Player booked')}`;
          if (eventKicker) eventKicker.textContent = incident.type === 'goal' ? 'GOAL' : 'YELLOW CARD';
          if (eventTitle) eventTitle.textContent = playerIdentity;
          if (eventDetail) eventDetail.textContent = incident.assistPlayerName ? `Assisted by ${incident.assistPlayerName}` : incident.type === 'goal' ? (incident.teamId === phaseResult?.home ? fixture.home.name : fixture.away.name) : 'Play will restart with a free kick';
        }
      }
      lastEventKey = eventKey;
      if (!reducedMotion && elapsed !== lastDrawElapsed) {
        const targets = livePlayerTargets(players, ballState, half, phaseResult);
        players.forEach((player, index) => {
          const response = targets[index].hasBall ? .32 : playbackSpeed === 2 ? .24 : .16;
          visualPositions[index].x += (targets[index].x - visualPositions[index].x) * response;
          visualPositions[index].y += (targets[index].y - visualPositions[index].y) * response;
        });
        separateLivePlayerPositions(players, visualPositions);
        players.forEach((player, index) => {
          player.style.left = `${visualPositions[index].x}%`;
          player.style.top = `${visualPositions[index].y}%`;
          player.classList.toggle('has-ball', targets[index].hasBall);
          player.classList.toggle('is-involved', targets[index].involved);
          player.classList.toggle('is-booked', ballState.type === 'card' && player.dataset.playerId === liveBallEvent?.playerId);
        });
        if (ball) {
          ball.style.left = `${ballState.x}%`;
          ball.style.top = `${ballState.y}%`;
          ball.dataset.state = ballState.type || 'pass';
        }
      }
      lastDrawElapsed = elapsed;
      if (pitch) pitch.dataset.phase = ballState.phase || ballState.type || 'open-play';
      pitch?.classList.toggle('goal-flash', ['goal', 'celebration'].includes(ballState.type));
      pitch?.classList.toggle('card-flash', ballState.type === 'card');
      if (elapsed >= duration) return finish(true);
      liveMatchFrame = setTimeout(draw, 50);
    };
    draw();
  });
}

function matchStatisticsMarkup(stats = {}, homeName = 'Home', awayName = 'Away') {
  const definitions = [
    ['possession', 'Possession', value => `${Math.round(number(value))}%`],
    ['shots', 'Shots', value => String(Math.round(number(value)))],
    ['shotsOnTarget', 'On target', value => String(Math.round(number(value)))],
    ['xG', 'Expected goals', value => formatDecimal(value, 2, '0.00')],
    ['corners', 'Corners', value => String(Math.round(number(value)))],
    ['fouls', 'Fouls', value => String(Math.round(number(value)))],
    ['yellowCards', 'Yellow cards', value => String(Math.round(number(value)))],
    ['redCards', 'Red cards', value => String(Math.round(number(value)))]
  ];
  const rows = definitions.map(([key, label, formatter]) => {
    const pair = pick(stats, [key], null);
    if (!pair || (pick(pair, ['home'], null) == null && pick(pair, ['away'], null) == null)) return null;
    const home = number(pair.home);
    const away = number(pair.away);
    const total = Math.max(.01, home + away);
    const homeShare = key === 'possession' ? clamp(home) : clamp((home / total) * 100);
    const awayShare = key === 'possession' ? 100 - homeShare : clamp((away / total) * 100);
    return `<div class="match-stat-row"><span><strong>${formatter(home)}</strong><i><b style="width:${homeShare}%"></b></i></span><small>${escapeHtml(label)}</small><span class="away"><i><b style="width:${awayShare}%"></b></i><strong>${formatter(away)}</strong></span></div>`;
  }).filter(Boolean);
  if (!rows.length) return '<div class="empty-state compact"><strong>Detailed statistics were not recorded</strong><p>This archived result keeps the score and incidents only.</p></div>';
  return `<div class="match-stats"><header><span>${escapeHtml(homeName)}</span><strong>Match statistics</strong><span>${escapeHtml(awayName)}</span></header>${rows.join('')}</div>`;
}

function matchReportBody(result, fixture) {
  const match = result?.result || result?.match || result?.event?.fixture || {};
  const event = result?.event || {};
  const normalized = normalizeFixture({ ...fixture, ...match, ...(match.score || {}), home: fixture.home, away: fixture.away, homeName: fixture.home?.name, awayName: fixture.away?.name });
  const homeScore = pick(match, ['homeGoals', 'homeScore', 'score.home'], normalized.homeScore ?? 0);
  const awayScore = pick(match, ['awayGoals', 'awayScore', 'score.away'], normalized.awayScore ?? 0);
  const incidents = asArray(match.incidents || match.events || match.timeline || result?.incidents);
  const stats = pick(match, ['stats', 'statistics'], pick(result, ['stats', 'statistics'], {})) || {};
  const tactics = pick(match, ['tactics'], pick(result, ['tactics'], {})) || {};
  const directMatchday = pick(match, ['matchday'], pick(result, ['matchday', 'event.matchday'], {})) || {};
  const reportFixtureIds = new Set([fixture?.id, fixture?.raw?.id, match?.id, match?.fixtureId].filter(Boolean).flatMap(value => [String(value), String(value).replace(/^career-/, '')]));
  const storedMatchday = asArray(pick(careerWorldModel(), ['matchday.reports'], [])).find(report => reportFixtureIds.has(String(report.fixtureId || '').replace(/^career-/, '')) || (number(report.season) === number(match.season, seasonYear()) && number(report.week) === number(match.week, fixture?.week) && (!report.opponentName || [fixture?.home?.name, fixture?.away?.name].includes(report.opponentName))));
  const matchday = { ...(storedMatchday || {}), ...directMatchday, weather: { ...(storedMatchday?.weather || {}), ...(directMatchday?.weather || {}) } };
  const playerOfMatch = pick(match, ['playerOfMatch.name', 'playerOfMatch'], pick(result, ['playerOfMatch.name', 'playerOfMatch'], ''));
  const commentary = incidents.length ? incidents : [
    { minute: 0, text: `Kick-off: ${normalized.home.name} against ${normalized.away.name}.` },
    { minute: 45, text: 'The coaching plan and selected XI are shaping the contest.' },
    { minute: 90, text: result?.event?.message || `Full time: ${normalized.home.name} ${number(homeScore)}–${number(awayScore)} ${normalized.away.name}.` }
  ];
  const homeTactics = pick(tactics, ['home'], {}) || {};
  const awayTactics = pick(tactics, ['away'], {}) || {};
  const hasTactics = Object.keys(homeTactics).length || Object.keys(awayTactics).length;
  const attendance = pick(matchday, ['attendance'], null);
  const weather = pick(matchday, ['weather'], {}) || {};
  const hasWeather = Object.keys(weather).length > 0 || pick(matchday, ['condition', 'temperature'], null) != null;
  const pitchBefore = pick(matchday, ['pitchConditionBefore'], null);
  const pitchAfter = pick(matchday, ['pitchConditionAfter'], null);
  const hasPitch = pitchBefore != null || pitchAfter != null;
  const matchdayNet = pick(matchday, ['netRevenue', 'netRevenueAud'], null);
  const matchdayCards = `${attendance == null ? '' : `<div><span><i class="ti ti-users" aria-hidden="true"></i></span><small>Attendance</small><strong>${number(attendance).toLocaleString('en-AU')}</strong></div>`}${hasWeather ? `<div><span><i class="ti ti-cloud-sun" aria-hidden="true"></i></span><small>Conditions</small><strong>${escapeHtml(weatherLabel(Object.keys(weather).length ? weather : matchday))}</strong></div>` : ''}${hasPitch ? `<div><span><i class="ti ti-building-stadium" aria-hidden="true"></i></span><small>Pitch</small><strong>${pitchBefore == null ? '—' : number(pitchBefore)} → ${pitchAfter == null ? '—' : number(pitchAfter)}%</strong></div>` : ''}${matchdayNet == null ? '' : `<div><span><i class="ti ti-cash" aria-hidden="true"></i></span><small>Matchday net</small><strong class="${number(matchdayNet) >= 0 ? 'positive' : 'negative'}">${formatMoney(matchdayNet, true)}</strong></div>`}`;
  return `<div class="match-scoreboard"><div>${normalized.home.isPlayer ? userCrestMarkup() : opponentCrestMarkup(normalized.home, 'mini-crest')}<strong>${escapeHtml(normalized.home.name)}</strong></div><span class="match-score">${number(homeScore)}–${number(awayScore)}</span><div>${normalized.away.isPlayer ? userCrestMarkup() : opponentCrestMarkup(normalized.away, 'mini-crest')}<strong>${escapeHtml(normalized.away.name)}</strong></div></div>
    <section class="match-report-summary">${playerOfMatch ? `<div><span><i class="ti ti-star" aria-hidden="true"></i></span><small>Player of the match</small><strong>${escapeHtml(typeof playerOfMatch === 'string' ? playerOfMatch : pick(playerOfMatch, ['name'], ''))}</strong></div>` : ''}${matchdayCards}</section>
    <section class="match-report-grid"><article>${matchStatisticsMarkup(stats, normalized.home.name, normalized.away.name)}</article><aside>${hasTactics ? `<div class="tactical-review"><header><strong>Tactical review</strong><small>Shape and identity</small></header><div><span><small>${escapeHtml(normalized.home.name)}</small><strong>${escapeHtml(pick(homeTactics, ['formation'], '—'))}</strong><p>${escapeHtml(titleCase(pick(homeTactics, ['styleId', 'style'], 'not recorded')))}</p></span><b>v</b><span><small>${escapeHtml(normalized.away.name)}</small><strong>${escapeHtml(pick(awayTactics, ['formation'], '—'))}</strong><p>${escapeHtml(titleCase(pick(awayTactics, ['styleId', 'style'], 'not recorded')))}</p></span></div>${pick(tactics, ['insight', 'summary'], '') ? `<p>${escapeHtml(pick(tactics, ['insight', 'summary'], ''))}</p>` : ''}</div>` : '<div class="empty-state compact"><strong>No tactical snapshot</strong><p>Older results may not include shapes and styles.</p></div>'}<div class="match-timeline"><header><strong>Match timeline</strong><small>${commentary.length} incident${commentary.length === 1 ? '' : 's'}</small></header><ul class="match-report">${commentary.map(item => `<li class="event-${escapeHtml(item.type || 'note')}"><strong>${number(item.minute, 0)}′</strong><span>${escapeHtml(item.text || item.message || item.type || 'Match incident')}</span></li>`).join('')}</ul></div></aside></section>`;
}

function halftimeBody(fixture, firstHalfResult = {}) {
  const squad = fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team);
  const selection = squadSelection(squad);
  const holder = squad === 'academy' ? academyModel() : squad === 'u23' ? footballState?.u23 : squad === 'b' ? footballState?.b : seniorModel();
  const starters = asArray(selection.lineup).map(id => asArray(selection.players).find(player => player.id === id)).filter(Boolean);
  const substitutes = asArray(selection.bench).map(id => asArray(selection.players).find(player => player.id === id)).filter(Boolean);
  const booked = new Set(asArray(firstHalfResult.incidents).filter(item => item.type === 'card').map(item => item.playerId));
  const condition = player => Math.round(clamp(100 - number(player.fatigue) - (starters.some(starter => starter.id === player.id) ? 5 * number(firstHalfResult.playerStyleFatigue, 1) : 0)));
  const averageCondition = Math.round(starters.reduce((total, player) => total + condition(player), 0) / Math.max(1, starters.length));
  const playerOption = (player, index) => `<option value="${escapeHtml(player.id)}">#${number(player.squadNumber, index + 1)} · ${escapeHtml(player.name)} · ${escapeHtml(player.position)} · ${condition(player)}% fitness${booked.has(player.id) ? ' · BOOKED' : ''}</option>`;
  const opponentSide = fixture.home.isPlayer ? 'away' : 'home';
  const opponentTactic = firstHalfResult.tactics?.[opponentSide] || {};
  return `<div class="live-match-phase"><div class="match-scoreboard"><div>${fixture.home.isPlayer ? userCrestMarkup() : opponentCrestMarkup(fixture.home, 'mini-crest')}<strong>${escapeHtml(fixture.home.name)}</strong></div><span class="match-score">${number(firstHalfResult.homeGoals)}–${number(firstHalfResult.awayGoals)}</span><div>${fixture.away.isPlayer ? userCrestMarkup() : opponentCrestMarkup(fixture.away, 'mini-crest')}<strong>${escapeHtml(fixture.away.name)}</strong></div></div>
    <div class="halftime-overview"><div><small>Estimated XI fitness</small><strong>${averageCondition}%</strong></div><div><small>Your booked players</small><strong>${starters.filter(player => booked.has(player.id)).length}</strong></div><div><small>Opposition setup</small><strong>${escapeHtml(opponentTactic.formation || '4-3-3')}</strong><span>${escapeHtml(titleCase(opponentTactic.styleId || 'balanced'))}</span></div></div>
    <p>Set your second-half shape and style, and make one substitution. These changes apply to this match only. Fitness includes estimated first-half exertion.</p>
    <div class="control-list substitution-control halftime-controls"><label>Second-half formation<select data-live-formation>${FORMATIONS.map(formation => `<option${formation === selection.formation ? ' selected' : ''}>${formation}</option>`).join('')}</select></label><label>Second-half style<select data-live-style>${PLAYING_STYLES.map(style => `<option value="${style.id}"${style.id === holder?.styleId ? ' selected' : ''}>${escapeHtml(style.name)}</option>`).join('')}</select></label><label>Starter out<select data-live-sub-out><option value="">No substitution</option>${starters.map(playerOption).join('')}</select></label><label>Bench player in<select data-live-sub-in><option value="">No substitution</option>${substitutes.map(playerOption).join('')}</select></label><div class="halftime-advice" data-halftime-advice role="status"></div><button type="button" class="fm-button primary" data-finish-live-match="${escapeHtml(fixture.id)}">Apply changes & start second half</button></div></div>`;
}

function refreshHalftimeAdvice(fixture) {
  const advice = $('[data-halftime-advice]');
  if (!advice) return;
  const squad = fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team);
  const selection = squadSelection(squad), outId = $('[data-live-sub-out]')?.value, inId = $('[data-live-sub-in]')?.value;
  const style = PLAYING_STYLES.find(item => item.id === $('[data-live-style]')?.value);
  const lineup = selection.lineup.map(id => id === outId && inId ? inId : id);
  const suitability = FootballEngine.getLineupSuitability(footballState, squad, { lineup, formation: $('[data-live-formation]')?.value });
  const incomplete = Boolean(outId) !== Boolean(inId), noKeeper = suitability?.actual.GK !== 1;
  const warning = incomplete ? 'Choose both players, or clear both substitution fields.' : noKeeper ? 'Keep exactly one goalkeeper on the pitch.' : suitability?.misplaced ? `${suitability.misplaced} player${suitability.misplaced === 1 ? '' : 's'} will cover a different unit, reducing team strength.` : 'Your players fit this shape.';
  advice.textContent = `${warning} ${style?.description || ''}`;
  advice.classList.toggle('has-warning', incomplete || noKeeper || Boolean(suitability?.misplaced));
  const button = $('[data-finish-live-match]');
  if (button) button.disabled = incomplete || noKeeper;
}

async function previewVisualHalf(fixture, half, halftime = null) {
  if (busy) return null;
  const squad = fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team);
  setBusy(true, 'Preparing match…');
  try {
    const result = await dispatchFootball('previewMatchHalf', [{ squad, half, ...(halftime ? { halftime } : {}) }]);
    if (!result?.ok) throw new Error(result?.message || 'The live match phase could not be prepared.');
    return half === 1 && result.halftime ? { ...result.result, savedHalftime: result.halftime } : result.result;
  } catch (error) {
    showToast(error?.message || 'The live match phase could not be prepared.', 'error');
    return null;
  } finally {
    setBusy(false);
  }
}

async function completeFixtureSimulation(fixture, liveOptions = {}) {
  const squad = fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team);
  const result = await runEngine('simulateMatch', [{ squad, visual: Boolean(liveOptions.firstHalf), ...(liveOptions.halftime ? { halftime: liveOptions.halftime } : {}) }], { busyLabel: 'Playing…', reason: 'football-match' });
  if (result) {
    liveMatchState = null;
    openDialog({ label: fixture.competition, title: 'Full time', body: matchReportBody(result, fixture) });
  }
  return result;
}

async function simulateFixture(id, forceVisual = false) {
  const fixture = fixtures().find(item => item.id === id) || nextFixture('senior');
  if (!fixture) return showToast('There is no match ready to simulate.', 'error');
  if (!fixture.canSimulate) return showToast(`This fixture is scheduled for week ${fixture.week}.`, 'error');
  matchSpeed = forceVisual || activeView === 'coach-desk' ? 'visual' : ($('[data-match-speed]')?.value || matchSpeed);
  if (matchSpeed === 'instant') return completeFixtureSimulation(fixture);
  const firstHalf = await previewVisualHalf(fixture, 1);
  if (!firstHalf) return null;
  liveMatchState = { fixtureId: fixture.id, squad: fixture.squad || (fixture.team === 'senior' ? 'first' : fixture.team), firstHalf, secondHalf: null, halftime: null };
  const completed = await playVisualHalf(fixture, 1, firstHalf);
  if (completed && !dom.dialog.hidden && liveMatchState?.fixtureId === fixture.id) {
    openDialog({ label: fixture.competition, title: 'Halftime decisions', body: halftimeBody(fixture, firstHalf) });
    if (firstHalf.savedHalftime) {
      const saved = firstHalf.savedHalftime;
      for (const [selector, value] of [['[data-live-style]', saved.styleId], ['[data-live-formation]', saved.formation], ['[data-live-sub-out]', saved.outId], ['[data-live-sub-in]', saved.inId]]) {
        const control = $(selector);
        if (control) { if (value !== undefined) control.value = value; control.disabled = true; }
      }
      const button = $('[data-finish-live-match]');
      if (button) button.textContent = 'Resume saved second half';
    }
    refreshHalftimeAdvice(fixture);
  }
}

async function completeWeekSimulation() {
  const result = await runEngine('advanceWeek', [], { busyLabel: 'Simulating…', reason: 'football-week', success: 'The week is complete.' });
  if (!result) return;
  const event = result.event || result.summary || {};
  const matches = asArray(event.matches || result.matches);
  openDialog({
    label: `Week ${Math.max(1, weekNumber() - 1)} review`,
    title: 'Week complete',
    body: `<div class="match-scoreboard"><div><strong>Club operations</strong><small>Finance and facilities advanced</small></div><span class="match-score">W${weekNumber()}</span><div><strong>Next week</strong><small>${escapeHtml(weekDateLabel())}</small></div></div><ul class="match-report">${matches.length ? matches.map(match => `<li><strong>${escapeHtml(match.team || 'FT')}</strong><span>${escapeHtml(match.summary || `${match.homeName || ''} ${match.homeScore ?? ''}–${match.awayScore ?? ''} ${match.awayName || ''}`)}</span></li>`).join('') : `<li><strong>Club</strong><span>${escapeHtml(event.message || 'Training, recruitment, construction and cash flow have been processed.')}</span></li>`}</ul>`
  });
}

async function simulateWeek() {
  const watchable = fixtures().find(fixture => !fixture.played && fixture.canSimulate && !fixture.bye);
  if (!managerSettings().confirmWeek && !watchable) return completeWeekSimulation();
  openDialog({
    label: `Week ${weekNumber()} decision`,
    title: 'Simulate the full week?',
    body: `<div class="empty-state"><strong>Advance training, matches and finances</strong><p>Simulating the week resolves matches instantly and skips live playback and halftime decisions.</p>${watchable ? `<p>${escapeHtml(watchable.home.name)} v ${escapeHtml(watchable.away.name)}</p><button type="button" class="fm-button primary" data-watch-match data-simulate-match="${escapeHtml(watchable.id)}">Watch match · includes halftime</button>` : ''}<button type="button" class="fm-button ${watchable ? '' : 'primary'}" data-confirm-simulate-week>Simulate week ${weekNumber()}${watchable ? ' · instant results' : ''}</button><button type="button" class="fm-button" data-close-football-dialog>Cancel</button></div>`
  });
}

function collectTrainingSchedule() {
  const schedule = { senior: Array(7).fill('rest'), u23: Array(7).fill('rest'), academy: Array(7).fill('rest') };
  $$('[data-training-team]').forEach(select => {
    const team = select.dataset.trainingTeam;
    const day = number(select.dataset.trainingDay);
    if (schedule[team] && day >= 0 && day < 7) schedule[team][day] = select.value;
  });
  return schedule;
}

function engineScheduleFromTypes(types, squad, intensityOverride = '') {
  const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const activities = Object.fromEntries(dayIds.map((day, index) => [day, SESSION_OPTIONS.some(([id]) => id === types[index]) ? types[index] : 'rest']));
  const days = dayIds.filter(day => !['rest', 'recovery'].includes(activities[day]));
  const focusMap = {
    technical: 'technical',
    tactical: 'tactical',
    fitness: 'physical',
    'match-prep': 'balanced',
    recovery: 'recovery',
    'academy-development': 'youth'
  };
  const counts = new Map();
  for (const type of types) {
    const focus = focusMap[type];
    if (focus) counts.set(focus, (counts.get(focus) || 0) + 1);
  }
  const fallbackFocus = squad === 'academy' ? 'technical' : 'balanced';
  const focus = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || fallbackFocus;
  const holder = squad === 'academy' ? academyModel() : squad === 'b' ? footballState?.b : squad === 'u23' ? footballState?.u23 : seniorModel();
  const intensity = intensityOverride || pick(holder, ['training.intensity'], 'normal');
  return { days, intensity, focus, activities };
}

function transferMarketBody() {
  const prospects = asArray(pick(footballState, ['recruitment.market', 'transferMarket', 'availablePlayers'], []));
  if (!prospects.length) return '<div class="empty-state"><strong>Scouting in progress</strong><p>Advance a week or improve recruitment staff to reveal senior players.</p></div>';
  return `<table class="squad-table"><thead><tr><th>Pos</th><th>Player</th><th>Age</th><th>OVR</th><th>Wage ask</th><th></th></tr></thead><tbody>${prospects.map((player, index) => `<tr><td><span class="position-mark">${escapeHtml(player.position || 'MF')}</span></td><td><div class="player-name"><span class="player-avatar">${escapeHtml(initials(player.name))}</span><strong>${escapeHtml(player.name)}</strong></div></td><td>${number(player.age, 23)}</td><td><strong>${number(player.rating || player.overall, 55)}</strong></td><td>${formatMoney(player.weeklyWage || player.wage || 500)}</td><td><button type="button" class="fm-button primary" data-sign-senior-player="${escapeHtml(player.id || index)}">Offer</button></td></tr>`).join('')}</tbody></table>`;
}

function openStoredMatchReport(matchId) {
  const requestedIds = new Set([String(matchId), String(matchId).replace(/^career-/, '')]);
  const fixture = fixtures().find(item => [item.id, item.raw?.id, item.raw?.fixtureId].filter(Boolean).some(value => requestedIds.has(String(value)) || requestedIds.has(String(value).replace(/^career-/, ''))));
  if (fixture) {
    const result = { result: { ...fixture.raw, ...fixture, homeGoals: fixture.homeScore, awayGoals: fixture.awayScore, stats: fixture.stats, tactics: fixture.tactics, matchday: fixture.matchday, incidents: fixture.incidents } };
    openDialog({ label: fixture.competition, title: 'Match report', body: matchReportBody(result, fixture) });
    return;
  }
  const archived = asArray(pick(careerWorldModel(), ['history.matches'], [])).find(match => requestedIds.has(String(match.id)) || requestedIds.has(String(match.id).replace(/^career-/, '')));
  if (!archived) return showToast('That archived match report is no longer available.', 'error');
  const home = archived.venue !== 'away';
  const opponent = { id: archived.opponentId, name: archived.opponentName, isPlayer: false };
  const user = { id: clubModel().id, name: clubModel().name, isPlayer: true };
  const storedMatchday = asArray(pick(careerWorldModel(), ['matchday.reports'], [])).find(report => number(report.season) === number(archived.season) && number(report.week) === number(archived.week) && (!archived.opponentId || report.opponentId === archived.opponentId));
  const currentResult = number(archived.season) === seasonYear() ? asArray(pick(footballState, ['competitions.first.results'], [])).find(result => {
    const ids = [result?.id, result?.fixtureId].filter(Boolean).map(String);
    const opponentId = result?.home === FootballEngine.PLAYER_FIRST_TEAM_ID ? result?.away : result?.away === FootballEngine.PLAYER_FIRST_TEAM_ID ? result?.home : '';
    return ids.some(value => requestedIds.has(value) || requestedIds.has(value.replace(/^career-/, ''))) || (number(result?.week) === number(archived.week) && opponentId === archived.opponentId);
  }) : null;
  const storedReport = archived.report || currentResult || {};
  const mergedMatchday = { ...(pick(storedReport, ['matchday'], {}) || {}), ...(storedMatchday || {}) };
  const archiveFixture = normalizeFixture({ id: archived.id, competition: archived.competition, week: archived.week, home: home ? user : opponent, away: home ? opponent : user, homeScore: home ? archived.goalsFor : archived.goalsAgainst, awayScore: home ? archived.goalsAgainst : archived.goalsFor, played: true, matchday: mergedMatchday });
  const archivedResult = { ...storedReport, homeGoals: archiveFixture.homeScore, awayGoals: archiveFixture.awayScore, matchday: mergedMatchday };
  openDialog({ label: archived.competition, title: `${archived.season} · Week ${archived.week}`, body: matchReportBody({ result: archivedResult }, archiveFixture) });
}

function openPlayerReleaseConfirmation(playerId) {
  const found = findPlayer(playerId, 'senior');
  if (!found) return showToast('The player is no longer in this squad.', 'error');
  openDialog({ label: 'Contract decision', title: `Release ${found.player.name}?`, body: `<div class="empty-state"><strong>This ends the player’s contract immediately</strong><p>${escapeHtml(found.player.name)} will leave the club and their weekly wage will be removed. This action cannot be reversed through the squad screen.</p><button type="button" class="fm-button danger" data-release-player="${escapeHtml(found.player.id)}">Confirm release</button><button type="button" class="fm-button" data-close-football-dialog>Keep player</button></div>` });
}

function boardExpectationsFromForm() {
  const expectations = boardModel().expectations;
  return expectations.map((expectation, index) => ({ ...expectation, target: number($(`[data-expectation-target][data-expectation-index="${index}"]`)?.value, expectation.target) }));
}

function rivalryPayload(clubId, type = 'rivalry') {
  const club = aiClubs().find(item => item.id === clubId);
  if (!club) return null;
  return { clubId: club.id, clubName: club.name, type, intensity: type === 'local-derby' ? 65 : 50, story: `${clubModel().shortName || clubModel().name} and ${club.name} are building a rivalry through Queensland football.` };
}

async function handleWorkspaceClick(event) {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.hasAttribute('data-close-football-dialog')) return closeDialog();
  if (target.hasAttribute('data-confirm-simulate-week')) {
    closeDialog();
    return completeWeekSimulation();
  }
  if (target.hasAttribute('data-open-reset-football-confirm')) return openResetFootballConfirmation();
  if (target.hasAttribute('data-confirm-reset-football')) return resetFootballProgress();
  if (target.dataset.sitePreview) return openSitePreview(target.dataset.sitePreview);
  if (target.hasAttribute('data-invest-owner')) return transferOwnerFunds('invest');
  if (target.hasAttribute('data-withdraw-owner')) return transferOwnerFunds('withdraw');
  if (target.hasAttribute('data-repay-startup-loan')) {
    const amount = number($('[data-loan-repayment]')?.value, 0);
    return runEngine('repayStartupLoan', [amount], { reason: 'football-loan', success: 'Startup-loan repayment completed.' });
  }
  if (target.hasAttribute('data-declare-bankruptcy')) return declareBankruptcy();
  if (target.hasAttribute('data-open-bankruptcy-confirm')) return openBankruptcyConfirmation();
  if (target.dataset.playerDetail) {
    const found = findPlayer(target.dataset.playerDetail, target.dataset.playerKind || 'senior');
    if (!found) return showToast('That player profile is no longer available.', 'error');
    return openDialog({ label: `${titleCase(found.kind)} squad`, title: found.player.name, body: playerDetailBody(found.player.id, found.kind) });
  }
  if (target.dataset.openScoutReport) {
    const report = scoutingModel().reports.map(normalizeScoutReport).find(item => item.id === target.dataset.openScoutReport);
    return openDialog({ label: 'Recruitment report', title: report?.name || 'Scouted player', body: scoutReportBody(target.dataset.openScoutReport) });
  }
  if (target.dataset.openWorldClub) {
    const club = aiClubs().find(item => item.id === target.dataset.openWorldClub);
    return openDialog({ label: 'Football world', title: club?.name || 'Club profile', body: worldClubBody(target.dataset.openWorldClub) });
  }
  if (target.dataset.openMatchReport) return openStoredMatchReport(target.dataset.openMatchReport);
  if (target.hasAttribute('data-save-captaincy')) {
    const captainId = $('[data-captain-select]')?.value || '';
    const viceCaptainId = $('[data-vice-captain-select]')?.value || '';
    if (!captainId) return showToast('Choose a captain.', 'error');
    if (captainId === viceCaptainId) return showToast('The captain and vice-captain must be different players.', 'error');
    return runOptionalEngine(['setCaptaincy'], [captainId, viceCaptainId], { reason: 'football-leadership', success: 'Leadership group saved.' });
  }
  if (target.hasAttribute('data-create-mentoring')) {
    const mentorId = $('[data-mentor-select]')?.value || '';
    const menteeId = $('[data-mentee-select]')?.value || '';
    const focus = $('[data-mentoring-focus]')?.value || 'professionalism';
    if (!mentorId || !menteeId) return showToast('Choose both a mentor and a mentee.', 'error');
    if (mentorId === menteeId) return showToast('A player cannot mentor themselves.', 'error');
    return runOptionalEngine(['createMentoringGroup'], [{ mentorId, menteeIds: [menteeId], focus }], { reason: 'football-mentoring', success: 'Mentoring group created.' });
  }
  if (target.dataset.removeMentoring) return runOptionalEngine(['removeMentoringGroup'], [target.dataset.removeMentoring], { reason: 'football-mentoring', success: 'Mentoring group closed.' });
  if (target.hasAttribute('data-create-player-promise')) {
    const playerId = $('[data-promise-player]')?.value || '';
    const type = $('[data-promise-type]')?.value || 'other';
    const detail = $('[data-promise-detail]')?.value?.trim() || '';
    const targetWeeks = number($('[data-promise-weeks]')?.value, 12);
    if (!playerId || !detail) return showToast('Choose a player and write a clear commitment.', 'error');
    return runOptionalEngine(['createPlayerPromise'], [playerId, { type, detail, targetWeeks, source: 'manager' }], { reason: 'football-player-promise', success: 'Player promise recorded.' });
  }
  if (target.dataset.resolvePlayerPromise) return runOptionalEngine(['resolvePlayerPromise'], [target.dataset.resolvePlayerPromise, target.dataset.promiseOutcome || 'fulfilled', 'Manager decision'], { reason: 'football-player-promise', success: target.dataset.promiseOutcome === 'broken' ? 'Promise marked as broken.' : target.dataset.promiseOutcome === 'cancelled' ? 'Promise cancelled.' : 'Promise marked as kept.' });
  if (target.dataset.setRehab) return runOptionalEngine(['setPlayerRehabilitation'], [target.dataset.setRehab, target.dataset.rehabPlan || 'standard'], { reason: 'football-medical', success: 'Rehabilitation plan updated.' });
  if (target.dataset.startContractTalks) return runOptionalEngine(['startContractNegotiation'], [target.dataset.startContractTalks], { reason: 'football-contract-talks', success: 'Formal contract talks opened.' });
  if (target.dataset.submitContractOffer) {
    const row = target.closest('.active-negotiation');
    const terms = {
      weeklyWage: number(row?.querySelector('[data-contract-weekly]')?.value, 0),
      seasons: number(row?.querySelector('[data-contract-seasons]')?.value, 2),
      squadRole: row?.querySelector('[data-contract-role]')?.value || 'rotation',
      signingBonus: number(row?.querySelector('[data-contract-signing]')?.value, 0),
      releaseClause: number(row?.querySelector('[data-contract-release]')?.value, 0),
      appearanceBonus: number(row?.querySelector('[data-contract-appearance]')?.value, 0)
    };
    const result = await runOptionalEngine(['submitContractOffer'], [target.dataset.submitContractOffer, terms], { reason: 'football-contract-talks' });
    if (result) showToast(result.message || 'The player’s representative responded.', 'success');
    return result;
  }
  if (target.dataset.withdrawContract) return runOptionalEngine(['withdrawContractNegotiation'], [target.dataset.withdrawContract], { reason: 'football-contract-talks', success: 'The club withdrew from contract talks.' });
  if (target.dataset.hireNamedStaff) return runOptionalEngine(['hireNamedStaff'], [target.dataset.hireNamedStaff, { weeklyWageAud: number(target.dataset.staffWage), durationWeeks: 80 }], { reason: 'football-staff-hire', success: 'Staff appointment completed.' });
  if (target.dataset.confirmDismissStaff) return openDialog({ label: 'Staff decision', title: `Dismiss ${target.dataset.staffName || 'staff member'}?`, body: `<div class="empty-state"><strong>Contract severance may be payable</strong><p>Delegated responsibilities will return to the manager immediately.</p><button type="button" class="fm-button danger" data-dismiss-named-staff="${escapeHtml(target.dataset.confirmDismissStaff)}">Confirm dismissal</button><button type="button" class="fm-button" data-close-football-dialog>Keep staff member</button></div>` });
  if (target.dataset.dismissNamedStaff) {
    const result = await runOptionalEngine(['dismissNamedStaff'], [target.dataset.dismissNamedStaff, { reason: 'Club restructuring' }], { reason: 'football-staff-dismissal', success: 'Staff dismissal completed.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.renewNamedStaff) return runOptionalEngine(['renewNamedStaff'], [target.dataset.renewNamedStaff, { weeklyWageAud: Math.ceil(number(target.dataset.staffWage) * 1.15 / 25) * 25, durationWeeks: 80 }], { reason: 'football-staff-renewal', success: 'Staff contract renewed.' });
  if (target.dataset.sponsorOffer) return runOptionalEngine(['respondToSponsorOffer'], [target.dataset.sponsorOffer, target.dataset.sponsorResponse || 'reject'], { reason: 'football-sponsor', success: target.dataset.sponsorResponse === 'accept' ? 'Partnership accepted.' : 'Sponsor proposal declined.' });
  if (target.hasAttribute('data-save-commercial-plan')) {
    const plan = {
      merchandise: { strategy: $('[data-commercial-merch-strategy]')?.value || 'balanced', weeklyBudgetAud: number($('[data-commercial-merch-budget]')?.value, 0) },
      community: { strategy: $('[data-commercial-community-strategy]')?.value || 'grassroots', weeklyBudgetAud: number($('[data-commercial-community-budget]')?.value, 0) },
      digital: { strategy: $('[data-commercial-digital-strategy]')?.value || 'steady', weeklyBudgetAud: number($('[data-commercial-digital-budget]')?.value, 0) },
      tickets: { strategy: $('[data-commercial-ticket-strategy]')?.value || 'balanced', familyDiscountPercent: number($('[data-commercial-family-discount]')?.value, 15) }
    };
    return runOptionalEngine(['setCommercialPlan'], [plan], { reason: 'football-commercial-plan', success: 'Commercial growth plan saved.' });
  }
  if (target.dataset.inboxFilter) {
    inboxFilter = target.dataset.inboxFilter;
    renderActiveView(false);
    return;
  }
  if (target.dataset.scoutingFilter) {
    scoutingFilter = target.dataset.scoutingFilter;
    renderActiveView(false);
    return;
  }
  if (target.dataset.worldFilter) {
    worldFilter = target.dataset.worldFilter;
    renderActiveView(false);
    return;
  }
  if (target.dataset.historySeason) {
    historySeasonFilter = target.dataset.historySeason;
    renderActiveView(false);
    return;
  }
  if (target.dataset.markInboxRead) return runOptionalEngine(['markInboxRead'], [target.dataset.markInboxRead, true], { reason: 'football-inbox', success: 'Message marked as read.' });
  if (target.dataset.resolveInbox) return runOptionalEngine(['resolveInboxDecision'], [target.dataset.resolveInbox, target.dataset.inboxChoice || ''], { reason: 'football-inbox', success: 'Decision recorded.' });
  if (target.hasAttribute('data-create-scouting-assignment')) {
    const region = $('[data-scout-region]')?.value || 'Queensland';
    const focus = $('[data-scout-focus]')?.value || 'all';
    const durationWeeks = number($('[data-scout-duration]')?.value, 4);
    const focusLabel = { all: 'all positions', gk: 'goalkeepers', df: 'defenders', mf: 'midfielders', fw: 'forwards', youth: 'high-potential youth' }[focus] || focus;
    return runOptionalEngine(['createScoutingAssignment', 'assignScout'], [{ type: 'region', targetName: `${region} · ${focusLabel}`, region, focus, durationWeeks }], { reason: 'football-scouting', success: 'Scouting assignment started.' });
  }
  if (target.dataset.cancelScoutingAssignment) return runOptionalEngine(['cancelScoutingAssignment'], [target.dataset.cancelScoutingAssignment], { reason: 'football-scouting', success: 'Scouting assignment cancelled.' });
  if (target.dataset.requestOpponentReport) {
    const fixture = nextFixture('senior');
    const opponent = fixture ? (fixture.home.isPlayer ? fixture.away : fixture.home) : null;
    if (!opponent) return showToast('There is no opponent ready to analyse.', 'error');
    return runOptionalEngine(['createOpponentReport', 'requestOpponentReport'], [{ clubId: opponent.clubId || opponent.id || target.dataset.requestOpponentReport }], { reason: 'football-opposition', success: 'Opponent report prepared.' });
  }
  if (target.dataset.renewPlayerContract) {
    const terms = { weeklyWage: number($('[data-player-contract-wage]')?.value, 0), seasons: number($('[data-player-contract-years]')?.value, 2), squadRole: $('[data-player-contract-role]')?.value || 'rotation' };
    const result = await runOptionalEngine(['renewPlayerContract'], [target.dataset.renewPlayerContract, terms], { reason: 'football-contract', success: 'Contract renewal completed.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.savePlayerDevelopment) {
    const focus = $('[data-player-development-focus]')?.value || 'balanced';
    const result = await runOptionalEngine(['setPlayerDevelopmentFocus', 'setIndividualTrainingFocus'], [target.dataset.savePlayerDevelopment, focus], { reason: 'football-development', success: 'Individual development focus saved.', unavailable: 'Individual focus is displayed, but this engine build cannot change it yet.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.promotePlayer) {
    const destination = target.dataset.promotionDestination === 'first' ? 'first' : 'u23';
    const result = await runOptionalEngine(['promoteAcademyPlayer', 'promoteYouthPlayer', 'promotePlayer'], [target.dataset.promotePlayer, destination], { reason: 'football-pathway', success: destination === 'first' ? 'Player promoted to the first team. Register them before a competitive appearance.' : 'Player promoted to the U23 pathway.', unavailable: 'This player is not currently eligible for that pathway move.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.confirmReleasePlayer) return openPlayerReleaseConfirmation(target.dataset.confirmReleasePlayer);
  if (target.dataset.releasePlayer) {
    const result = await runOptionalEngine(['releasePlayer'], [target.dataset.releasePlayer, 'Released by the club'], { reason: 'football-contract', success: 'Player released.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.listPlayer) {
    const result = await runOptionalEngine(['setPlayerTransferStatus'], [target.dataset.listPlayer, 'transfer-listed'], { reason: 'football-transfer', success: 'Player added to the transfer list.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.offerPlayerLoan) {
    const result = await runOptionalEngine(['setPlayerTransferStatus'], [target.dataset.offerPlayerLoan, 'loan-listed'], { reason: 'football-loan', success: 'Player made available for loan.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.recallPlayerLoan) {
    const result = await runOptionalEngine(['recallPlayerLoan'], [target.dataset.recallPlayerLoan], { reason: 'football-loan', success: 'Player recalled from loan.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.respondTransferOffer) {
    const result = await runOptionalEngine(['respondToTransferOffer'], [target.dataset.respondTransferOffer, target.dataset.transferResponse || 'reject'], { reason: 'football-transfer', success: `Transfer response recorded: ${target.dataset.transferResponse || 'reject'}.` });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.shortlistPlayer) {
    const result = await runOptionalEngine(['shortlistScoutedPlayer', 'shortlistPlayer'], [target.dataset.shortlistPlayer, true], { reason: 'football-scouting', success: 'Player added to the shortlist.', unavailable: 'The report remains available in Scouting; a persistent shortlist is not exposed by this engine build.' });
    if (result) closeDialog();
    return result;
  }
  if (target.dataset.approachScoutedPlayer) {
    const result = await runOptionalEngine(['approachScoutedPlayer', 'approachPlayer'], [target.dataset.approachScoutedPlayer], { reason: 'football-recruitment', success: 'Approach submitted.', unavailable: 'This player cannot be approached from the current report.' });
    if (result) closeDialog();
    return result;
  }
  if (target.hasAttribute('data-save-board-expectations')) return runOptionalEngine(['setBoardExpectations'], [boardExpectationsFromForm()], { reason: 'football-board', success: 'Board expectations updated.' });
  if (target.hasAttribute('data-save-club-identity')) {
    const values = $$('[data-club-value]:checked').map(input => input.value);
    if (values.length > 3) return showToast('Choose no more than three club values.', 'error');
    return runOptionalEngine(['setClubIdentity'], [{ nickname: $('[data-club-nickname]')?.value || '', motto: $('[data-club-motto]')?.value || '', values }], { reason: 'football-identity', success: 'Club identity saved.' });
  }
  if (target.hasAttribute('data-register-rivalry')) {
    const payload = rivalryPayload($('[data-rivalry-club]')?.value || '', $('[data-rivalry-type]')?.value || 'rivalry');
    if (!payload) return showToast('Choose a valid rival club.', 'error');
    return runOptionalEngine(['registerRivalry'], [payload], { reason: 'football-rivalry', success: 'Rivalry registered.' });
  }
  if (target.dataset.registerRivalryDirect) {
    const payload = rivalryPayload(target.dataset.registerRivalryDirect, 'rivalry');
    if (!payload) return showToast('That club is no longer available.', 'error');
    const result = await runOptionalEngine(['registerRivalry'], [payload], { reason: 'football-rivalry', success: 'Rivalry registered.' });
    if (result) closeDialog();
    return result;
  }
  if (target.hasAttribute('data-save-matchday-plan')) return runOptionalEngine(['setMatchdayPlan'], [matchdayFormPlan()], { reason: 'football-matchday', success: 'Matchday operations plan saved.' });
  if (target.dataset.registerPlayer) return runOptionalEngine(['registerPlayerForCompetition', 'registerPlayer'], [target.dataset.registerPlayer], { reason: 'football-registration', success: 'Player registered.', unavailable: 'Player registration is handled automatically in this engine build.' });
  if (target.dataset.unregisterPlayer) return runOptionalEngine(['unregisterPlayerFromCompetition', 'unregisterPlayer'], [target.dataset.unregisterPlayer], { reason: 'football-registration', success: 'Player unregistered.', unavailable: 'Player registration is handled automatically in this engine build.' });
  if (target.hasAttribute('data-enter-cup')) return runOptionalEngine(['enterCup'], [{}], { reason: 'football-cup', success: 'Cup entry confirmed.', unavailable: 'Cup entry is not available in this engine build.' });
  if (target.hasAttribute('data-simulate-cup')) return runOptionalEngine(['simulateCupMatch'], [], { reason: 'football-cup', success: 'Cup round completed.', unavailable: 'The cup round cannot be played in this engine build.' });
  if (target.hasAttribute('data-schedule-friendly')) {
    const opponentId = $('[data-friendly-opponent]')?.value || '';
    const opponent = aiClubs().find(club => club.id === opponentId);
    const week = number($('[data-friendly-week]')?.value, weekNumber());
    const venue = $('[data-friendly-venue]')?.value || 'home';
    if (!opponent) return showToast('Choose a friendly opponent.', 'error');
    return runOptionalEngine(['scheduleFriendly', 'arrangeFriendly'], [{ opponentId: opponent.id, opponentName: opponent.name, season: seasonYear(), week, venue }], { reason: 'football-friendly', success: 'Friendly added to the calendar.', unavailable: 'No friendly opponent is available in the current window.' });
  }
  if (target.dataset.cancelFriendly) return runOptionalEngine(['cancelFriendly'], [target.dataset.cancelFriendly], { reason: 'football-friendly', success: 'Friendly cancelled.' });
  if (target.dataset.simulateFriendly) return runOptionalEngine(['simulateFriendlyMatch'], [target.dataset.simulateFriendly], { reason: 'football-friendly', success: 'Friendly completed.' });
  if (target.dataset.openView) return setView(target.dataset.openView);
  if (target.dataset.teamTab) {
    activeTeamTab = target.dataset.teamTab;
    renderActiveView(false);
    return;
  }
  if (target.dataset.coachSquad) {
    if (target.dataset.coachSquad === 'b' && !footballState?.b) return;
    activeCoachSquad = target.dataset.coachSquad;
    renderActiveView(false);
    return;
  }
  if (target.dataset.fixtureFilter) {
    fixtureFilter = target.dataset.fixtureFilter;
    renderActiveView(false);
    return;
  }
  if (target.dataset.academyTableGroup) {
    const allowed = [...(FootballEngine.ACADEMY_AGE_GROUPS || []), 'all'];
    if (!allowed.includes(target.dataset.academyTableGroup)) return;
    academyTableGroup = target.dataset.academyTableGroup;
    renderActiveView(false);
    return;
  }
  if (target.dataset.finishLiveMatch) {
    const fixture = fixtures().find(item => item.id === target.dataset.finishLiveMatch);
    if (!fixture) return showToast('That live fixture is no longer available.', 'error');
    const style = $('[data-live-style]')?.value;
    const outId = $('[data-live-sub-out]')?.value;
    const inId = $('[data-live-sub-in]')?.value;
    if ((outId && !inId) || (!outId && inId)) return showToast('Choose both players for a halftime substitution, or leave both blank.', 'error');
    if (!liveMatchState || liveMatchState.fixtureId !== fixture.id) return showToast('The first-half state is no longer available. Restart the visual match.', 'error');
    const halftime = { styleId: style || '', formation: $('[data-live-formation]')?.value || '', outId: outId || '', inId: inId || '' };
    const secondHalf = await previewVisualHalf(fixture, 2, halftime);
    if (!secondHalf) return null;
    liveMatchState.halftime = halftime;
    liveMatchState.secondHalf = secondHalf;
    const completed = await playVisualHalf(fixture, 2, secondHalf, liveMatchState.firstHalf);
    if (!completed) return null;
    return completeFixtureSimulation(fixture, { firstHalf: liveMatchState.firstHalf, halftime });
  }
  if (target.dataset.simulateMatch) return simulateFixture(target.dataset.simulateMatch, target.hasAttribute('data-watch-match'));
  if (target.hasAttribute('data-save-match-plan')) {
    const lineup = $$('[data-lineup-player]:checked').map(input => input.value);
    if (lineup.length !== 11) return showToast(`Select exactly 11 starters; ${lineup.length} are selected.`, 'error');
    const selection = squadSelection('first');
    const bench = asArray(selection.players).map(player => player.id).filter(id => !lineup.includes(id)).slice(0, 9);
    const formation = $('[data-match-formation]')?.value || selection.formation || '4-3-3';
    const style = $('[data-match-style]')?.value || activeStyleId();
    const lineupResult = await runEngine('setLineup', ['first', { formation, lineup, bench }], { reason: 'football-lineup' });
    if (!lineupResult) return;
    if (style !== activeStyleId()) return runEngine('setPlayingStyle', ['first', style], { reason: 'football-style', success: 'Match plan and starting XI saved.' });
    showToast('Formation and starting XI saved.', 'success');
    return;
  }
  if (target.hasAttribute('data-save-coach-lineup')) {
    const lineup = $$('[data-coach-lineup-player]:checked').map(input => input.value);
    if (lineup.length !== 11) return showToast(`Select exactly 11 starters; ${lineup.length} are selected.`, 'error');
    const coachSquad = activeCoachSquad === 'academy' ? 'academy' : activeCoachSquad === 'u23' ? 'u23' : 'first';
    const selection = squadSelection(coachSquad);
    const bench = asArray(selection.players).map(player => player.id).filter(id => !lineup.includes(id) && !number(player.injuryWeeks)).slice(0, 9);
    const formation = $('[data-coach-formation]')?.value || selection.formation || '4-3-3';
    return runEngine('setLineup', [coachSquad, { formation, lineup, bench }], { reason: 'football-lineup', success: `${coachSquad === 'academy' ? 'Academy' : coachSquad === 'u23' ? 'U23' : 'First-team'} starting XI saved.` });
  }
  if (target.dataset.makeSubstitution) {
    const outId = $('[data-sub-out]')?.value;
    const inId = $('[data-sub-in]')?.value;
    if (!outId || !inId) return showToast('Choose a starter and a substitute.', 'error');
    const result = await runEngine('makeSubstitution', [target.dataset.makeSubstitution, outId, inId], { reason: 'football-lineup', success: 'The squad change was saved.' });
    if (result) closeDialog();
    return;
  }
  if (target.hasAttribute('data-assess-academy')) return runEngine('assessAcademy', [], { reason: 'academy-assessment', success: 'Academy services have been assessed.' });
  if (target.hasAttribute('data-fund-female-programme')) return runEngine('fundFemaleProgramme', [], { reason: 'academy-programme', success: 'The academy participation programme is active.' });
  if (target.hasAttribute('data-purchase-dual-rating')) return runEngine('purchaseDualRating', [], { reason: 'academy-dual', success: 'Dual-rating application completed.' });
  if (target.hasAttribute('data-request-b-team')) return runEngine('requestBTeam', [], { reason: 'football-b-team', success: 'Additional-team application submitted.' });
  if (target.hasAttribute('data-submit-a-league-bid')) return runEngine('submitALeagueBid', [], { reason: 'a-league-bid', success: 'A-League licensing bid submitted.' });
  if (target.hasAttribute('data-settle-season')) {
    const result = await runEngine('settleSeason', [], { reason: 'football-season', success: 'Season review completed.' });
    if (!result) return;
    const finals = result.aLeagueFinals;
    if (finals) {
      const names = new Map(asArray(finals.qualified).map(team => [team.teamId, team.name]));
      openDialog({ label: 'A-League finals series', title: `${finals.championName} champions`, body: `<ul class="match-report">${asArray(finals.matches).map(match => `<li><strong>${escapeHtml(titleCase(match.stage))}</strong><span>${escapeHtml(names.get(match.home) || match.home)} ${number(match.homeGoals)}–${number(match.awayGoals)} ${escapeHtml(names.get(match.away) || match.away)}${match.decidedBy === 'penalties' ? ` · ${escapeHtml(names.get(match.winnerId) || match.winnerId)} won on penalties` : ''}</span></li>`).join('')}</ul><p class="concept-disclaimer">The fictional 13-club league uses a 24-match regular season followed by this top-six finals series.</p>` });
    }
    return result;
  }
  if (target.hasAttribute('data-save-training')) {
    const schedule = collectTrainingSchedule();
    const firstIntensity = $('[data-training-intensity="first"]')?.value || pick(seniorModel(), ['training.intensity'], 'normal');
    const u23Intensity = $('[data-training-intensity="u23"]')?.value || pick(footballState, ['u23.training.intensity'], 'normal');
    const academyIntensity = $('[data-training-intensity="academy"]')?.value || pick(academyModel(), ['training.intensity'], 'normal');
    const firstResult = await runEngine('setTrainingSchedule', ['first', engineScheduleFromTypes(schedule.senior, 'first', firstIntensity)], { reason: 'football-training' });
    if (!firstResult) return;
    const u23Result = await runEngine('setTrainingSchedule', ['u23', engineScheduleFromTypes(schedule.u23, 'u23', u23Intensity)], { reason: 'football-training' });
    if (!u23Result) return;
    return runEngine('setTrainingSchedule', ['academy', engineScheduleFromTypes(schedule.academy, 'academy', academyIntensity)], { reason: 'football-training', success: 'First-team, U23 and academy training plans saved.' });
  }
  if (target.dataset.playingStyle) return runEngine('setPlayingStyle', ['first', target.dataset.playingStyle], { reason: 'football-style', success: 'Football identity updated.' });
  if (target.hasAttribute('data-save-coach-plan')) {
    const style = $('[data-coach-style]')?.value || activeStyleId();
    const intensity = $('[data-coach-intensity]')?.value || 'normal';
    const coachSquad = activeCoachSquad === 'academy' ? 'academy' : activeCoachSquad === 'u23' ? 'u23' : 'first';
    const styleResult = await runEngine('setPlayingStyle', [coachSquad, style], { reason: 'football-style' });
    if (!styleResult) return;
    const holder = coachSquad === 'academy' ? academyModel() : coachSquad === 'u23' ? footballState?.u23 : seniorModel();
    const types = trainingSchedule()[coachSquad === 'academy' ? 'academy' : coachSquad === 'u23' ? 'u23' : 'senior'];
    const currentSpec = holder?.training || engineScheduleFromTypes(types, coachSquad);
    return runEngine('setTrainingSchedule', [coachSquad, { days: asArray(currentSpec.days), focus: currentSpec.focus || (coachSquad === 'academy' ? 'technical' : 'balanced'), intensity }], { reason: 'football-training', success: 'Coaching plan applied.' });
  }
  if (target.hasAttribute('data-save-first-team-controls')) {
    const style = $('[data-first-team-style]')?.value || activeStyleId();
    const budget = number($('[data-first-team-budget]')?.value, financeModel().wageBudget);
    const styleResult = style === activeStyleId() ? true : await runEngine('setPlayingStyle', ['first', style], { reason: 'football-style' });
    if (!styleResult && style !== activeStyleId()) return;
    return runEngine('setWeeklyFirstTeamBudget', [budget], { reason: 'football-budget', success: 'First-team controls saved.' });
  }
  if (target.hasAttribute('data-save-academy-fee')) {
    const fee = number($('[data-academy-fee]')?.value, financeModel().academyFee);
    return runEngine('setAcademyFee', [fee], { reason: 'academy-fee', success: 'Academy season fee updated.' });
  }
  if (target.hasAttribute('data-save-finance-controls')) {
    const wage = number($('[data-finance-wage]')?.value, financeModel().wageBudget);
    const fee = number($('[data-finance-fee]')?.value, financeModel().academyFee);
    const wageResult = await runEngine('setWeeklyFirstTeamBudget', [wage], { reason: 'football-budget' });
    if (!wageResult) return;
    return runEngine('setAcademyFee', [fee], { reason: 'academy-fee', success: 'Operating plan saved.' });
  }
  if (target.hasAttribute('data-save-manager-settings')) {
    const settings = {
      matchSpeed: $('[data-setting-match-speed]')?.value || 'visual',
      confirmWeek: Boolean($('[data-setting-confirm-week]')?.checked),
      reducedMotion: Boolean($('[data-setting-reduced-motion]')?.checked),
      compactTables: Boolean($('[data-setting-compact-tables]')?.checked),
      showCrestNotice: Boolean($('[data-setting-crest-notice]')?.checked)
    };
    const result = await runEngine('setManagerSettings', [settings], { reason: 'football-settings', success: 'Settings saved.' });
    if (result) applyVisualSettings(true);
    return result;
  }
  if (target.dataset.startConstruction) return runEngine('startConstruction', [target.dataset.startConstruction], { reason: 'football-build', success: 'Construction project started.' });
  if (target.dataset.skipConstruction) return runEngine('skipConstruction', [target.dataset.skipConstruction], { reason: 'football-build', success: 'Football tokens completed the construction project.' });
  if (target.dataset.cancelConstruction) return runEngine('cancelConstruction', [target.dataset.cancelConstruction], { reason: 'football-build', success: 'Construction project cancelled.' });
  if (target.dataset.claimObjective) return runEngine('claimFootballObjective', [target.dataset.claimObjective], { reason: 'football-objective', success: 'Objective reward claimed.' });
  if (target.dataset.upgradeStaff) return runOptionalEngine(['upgradeStaff', 'hireStaff'], [target.dataset.upgradeStaff], { reason: 'football-staff', success: 'Staff structure upgraded.', unavailable: 'Staff hiring will unlock when the football engine exposes that operation.' });
  if (target.dataset.setManagerRole) {
    const roleName = target.dataset.setManagerRole;
    if (typeof FootballEngine.setManagerRole === 'function' || typeof FootballEngine.chooseCoachingRole === 'function' || typeof FootballEngine.setRole === 'function') {
      return runOptionalEngine(['setManagerRole', 'chooseCoachingRole', 'setRole'], [roleName], { reason: 'football-role', success: 'Your club role has changed.' });
    }
    activeCoachSquad = roleName === 'academy-coach' ? 'academy' : roleName === 'first-team-coach' ? 'first' : activeCoachSquad;
    activeView = 'coach-desk';
    renderActiveView(true);
    showToast('Coach Desk focus changed. Tactical and training decisions remain fully active.', 'success');
    return;
  }
  if (target.hasAttribute('data-run-trials')) return runOptionalEngine(['refreshRecruitmentMarket', 'runAcademyTrials', 'generateTrialists', 'runTrials'], [], { reason: 'academy-trials', success: 'The weekly recruitment and trial pools are ready.', unavailable: 'Advance a week to refresh academy trial interest.' });
  if (target.dataset.signTrialist) return runOptionalEngine(['signTrialist', 'offerAcademyPlace', 'signAcademyPlayer'], [target.dataset.signTrialist], { reason: 'academy-signing', success: 'Academy place offered.' });
  if (target.hasAttribute('data-open-transfer-market')) return openDialog({ label: 'Recruitment', title: 'Transfer market', body: transferMarketBody() });
  if (target.dataset.signSeniorPlayer) {
    const id = target.dataset.signSeniorPlayer;
    closeDialog();
    return runOptionalEngine(['signPlayer', 'offerPlayer', 'signSeniorPlayer'], [id], { reason: 'senior-signing', success: 'Contract offer completed.' });
  }
}

function bindStaticEvents() {
  $$('[data-reload-page]').forEach(button => button.addEventListener('click', () => location.reload()));
  [dom.clubName, dom.shortName, dom.initials].forEach(input => input.addEventListener('input', syncIdentityPreview));
  $$('[data-crest-palette]').forEach(button => button.addEventListener('click', () => {
    setup.palette = button.dataset.crestPalette;
    const colours = CREST_COLOURS[setup.palette] || CREST_COLOURS.maroon;
    setup.primary = colours[0];
    setup.secondary = colours[1];
    if (dom.crestPrimary) dom.crestPrimary.value = setup.primary;
    if (dom.crestSecondary) dom.crestSecondary.value = setup.secondary;
    if (dom.crestPrimaryHex) dom.crestPrimaryHex.textContent = setup.primary.toUpperCase();
    if (dom.crestSecondaryHex) dom.crestSecondaryHex.textContent = setup.secondary.toUpperCase();
    $$('[data-crest-palette]').forEach(choice => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
    syncIdentityPreview();
  }));
  [dom.crestPrimary, dom.crestSecondary].forEach(input => input?.addEventListener('input', () => {
    setup.primary = validCrestColour(dom.crestPrimary?.value, setup.primary);
    setup.secondary = validCrestColour(dom.crestSecondary?.value, setup.secondary);
    if (dom.crestPrimaryHex) dom.crestPrimaryHex.textContent = setup.primary.toUpperCase();
    if (dom.crestSecondaryHex) dom.crestSecondaryHex.textContent = setup.secondary.toUpperCase();
    setup.palette = 'custom';
    $$('[data-crest-palette]').forEach(choice => {
      choice.classList.remove('selected');
      choice.setAttribute('aria-pressed', 'false');
    });
    syncIdentityPreview();
  }));
  $('[data-use-custom-colours]')?.addEventListener('click', () => {
    setup.primary = validCrestColour(dom.crestPrimary?.value, setup.primary);
    setup.secondary = validCrestColour(dom.crestSecondary?.value, setup.secondary);
    setup.palette = 'custom';
    $$('[data-crest-palette]').forEach(choice => {
      choice.classList.remove('selected');
      choice.setAttribute('aria-pressed', 'false');
    });
    syncIdentityPreview();
  });
  $$('[data-crest-shape]').forEach(button => button.addEventListener('click', () => {
    setup.shapeId = button.dataset.crestShape;
    $$('[data-crest-shape]').forEach(choice => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
    syncIdentityPreview();
  }));
  $$('[data-crest-symbol]').forEach(button => button.addEventListener('click', () => {
    setup.symbolId = button.dataset.crestSymbol;
    $$('[data-crest-symbol]').forEach(choice => {
      const selected = choice === button;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
    syncIdentityPreview();
  }));
  dom.logoInput.addEventListener('change', async () => {
    try {
      setup.logoData = await compressLogo(dom.logoInput.files?.[0]);
      dom.removeLogo.hidden = false;
      syncIdentityPreview();
    } catch (error) {
      dom.logoInput.value = '';
      dom.setupValidation.textContent = error.message;
    }
  });
  dom.removeLogo.addEventListener('click', () => {
    setup.logoData = '';
    dom.logoInput.value = '';
    dom.removeLogo.hidden = true;
    syncIdentityPreview();
  });
  dom.region.addEventListener('change', () => {
    setup.region = dom.region.value;
    setup.locationId = '';
    inspectedLocationId = '';
    renderLocationList();
    locationGlobe?.focusRegion?.(setup.region);
  });
  dom.locationList.addEventListener('click', event => {
    const option = event.target.closest('[data-location-id]');
    if (option) selectSite(option.dataset.locationId, true);
  });
  dom.locationDetail.addEventListener('click', event => {
    const preview = event.target.closest('[data-site-preview]');
    if (preview) openSitePreview(preview.dataset.sitePreview);
  });
  dom.academyFee.addEventListener('input', () => {
    setup.academyFee = number(dom.academyFee.value, 1800);
    dom.academyFeeOutput.value = formatMoney(setup.academyFee);
  });
  dom.wageBudget.addEventListener('input', () => {
    setup.wageBudget = number(dom.wageBudget.value, 2500);
    dom.wageBudgetOutput.value = formatMoney(setup.wageBudget);
  });
  [dom.dorraInvestment, dom.startupLoan].forEach(input => input.addEventListener('input', updateStartupFunding));
  $$('input[name="playingStyle"]').forEach(input => input.addEventListener('change', () => {
    setup.playingStyle = input.value;
    $$('.style-choices label').forEach(label => label.classList.toggle('selected', label.contains(input)));
  }));
  dom.setupNext.addEventListener('click', () => {
    syncIdentityPreview();
    const message = validateSetupStep(setupStep);
    if (message) {
      dom.setupValidation.textContent = message;
      return;
    }
    showSetupStep(setupStep + 1);
  });
  dom.setupBack.addEventListener('click', () => showSetupStep(setupStep - 1));
  dom.setupForm.addEventListener('submit', createClub);
  dom.workspace.addEventListener('click', event => {
    const domainButton = event.target.closest('[data-football-domain]');
    if (domainButton) {
      event.preventDefault();
      setDomain(domainButton.dataset.footballDomain);
      return;
    }
    const viewButton = event.target.closest('[data-football-view]');
    if (viewButton && !dom.content.contains(viewButton)) {
      event.preventDefault();
      setView(viewButton.dataset.footballView);
    }
  });
  dom.content.addEventListener('click', handleWorkspaceClick);
  dom.content.addEventListener('change', event => {
    const control = event.target.closest('select[data-delegation]');
    if (!control) return;
    runOptionalEngine(['setDelegation'], [control.dataset.delegation, control.value || ''], { reason: 'football-delegation', success: control.value ? 'Responsibility delegated.' : 'The manager took back control.' });
  });
  dom.content.addEventListener('input', event => {
    if (event.target.matches('[data-academy-fee]')) $('[data-academy-fee-output]').value = formatMoney(event.target.value);
    if (event.target.matches('[data-finance-wage]')) $('[data-finance-wage-output]').value = formatMoney(event.target.value);
    if (event.target.matches('[data-finance-fee]')) $('[data-finance-fee-output]').value = formatMoney(event.target.value);
    if (event.target.matches('[data-match-speed]')) matchSpeed = event.target.value;
    if (event.target.matches('[data-lineup-player]')) event.target.closest('.lineup-player')?.classList.toggle('selected', event.target.checked);
    if (event.target.matches('[data-club-value]')) {
      const selected = $$('[data-club-value]:checked');
      if (selected.length > 3) {
        event.target.checked = false;
        showToast('Choose no more than three club values.', 'error');
      }
    }
    if (event.target.matches('[data-matchday-ticket], [data-matchday-hospitality], [data-matchday-concession], [data-matchday-promotion], [data-matchday-transport], [data-matchday-staffing], [data-matchday-security], [data-matchday-pitch]')) {
      const monetary = event.target.matches('[data-matchday-ticket], [data-matchday-hospitality], [data-matchday-concession], [data-matchday-promotion], [data-matchday-transport]');
      const output = event.target.closest('label')?.querySelector('output');
      if (output) output.value = monetary ? formatMoney(event.target.value) : `${number(event.target.value)}/5`;
      refreshMatchdayPreview();
    }
  });
  dom.simulateWeek.addEventListener('click', simulateWeek);
  $$('[data-open-mobile-nav]').forEach(button => button.addEventListener('click', openMobileNav));
  $$('[data-close-mobile-nav]').forEach(button => button.addEventListener('click', closeMobileNav));
  $$('[data-close-football-dialog]').forEach(button => button.addEventListener('click', closeDialog));
  dom.dialogBody.addEventListener('click', handleWorkspaceClick);
  dom.dialogBody.addEventListener('change', event => {
    if (!event.target.matches('[data-live-style],[data-live-formation],[data-live-sub-out],[data-live-sub-in]')) return;
    const fixture = fixtures().find(item => item.id === liveMatchState?.fixtureId);
    if (fixture) refreshHalftimeAdvice(fixture);
  });
  document.addEventListener('keydown', event => {
    if (trapDialogFocus(event)) return;
    if (event.key === 'Escape') {
      if (!dom.dialog.hidden) closeDialog();
      else closeMobileNav();
    }
  });
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || !['/index.html', '/idle-airport.html', '/war-simulation.html'].includes(destination.pathname)) return;
    event.preventDefault();
    if (busy) { showToast('Wait for the current club action to finish before leaving.', 'error'); return; }
    try { await vault?.flush?.(); locationGlobe?.dispose?.(); vault?.close?.(); location.href = destination.href; }
    catch (error) { showToast(error.message || 'The save could not finish.', 'error'); }
  });
  globalThis.addEventListener('beforeunload', () => {
    vault?.close?.();
    locationGlobe?.dispose?.();
  });
}

async function createClub(event) {
  event.preventDefault();
  syncIdentityPreview();
  setup.academyFee = number(dom.academyFee.value, 1800);
  setup.wageBudget = number(dom.wageBudget.value, 2500);
  setup.playingStyle = document.querySelector('input[name="playingStyle"]:checked')?.value || 'balanced';
  const message = validateSetupStep(1) || validateSetupStep(2);
  if (message) {
    dom.setupValidation.textContent = message;
    return;
  }
  if (typeof FootballEngine.startClub !== 'function') {
    dom.setupValidation.textContent = 'The football simulation engine is unavailable.';
    return;
  }
  try {
    setup.ownerInvestment = wholeAud(dom.dorraInvestment.value || '0', { max: number(snapshot?.balance, 0), label: 'Dorra investment' });
    setup.startupLoan = wholeAud(dom.startupLoan.value || '0', { max: 2_000_000, label: 'Startup loan' });
  } catch (error) {
    dom.setupValidation.textContent = error.message;
    return;
  }
  const openingCost = siteOpeningCost(selectedSite());
  const fundingGap = Math.max(0, openingCost - setup.ownerInvestment - setup.startupLoan);
  if (fundingGap > 0) {
    dom.setupValidation.textContent = `Add ${formatMoney(fundingGap)} more funding or choose a less expensive site.`;
    return;
  }
  dom.createClub.disabled = true;
  dom.createClub.firstChild.textContent = 'Building club ';
  try {
    const site = selectedSite();
    const payload = {
      name: setup.name,
      shortName: setup.shortName,
      colours: { primary: setup.primary, secondary: setup.secondary },
      crest: { kind: setup.logoData ? 'upload' : 'generated', initials: setup.initials, palette: setup.palette, crestId: setup.shapeId, shapeId: setup.shapeId, symbolId: setup.symbolId, logoData: setup.logoData, imageData: setup.logoData },
      siteId: site.id,
      ownerInvestmentAud: setup.ownerInvestment,
      startupLoanAud: setup.startupLoan,
      academyFeeAud: setup.academyFee,
      weeklyFirstTeamBudget: setup.wageBudget,
      playingStyle: setup.playingStyle
    };
    const result = await dispatchFootball('startClub', [payload]);
    if (result?.ok === false) throw new Error(result.message || result.error || result.event?.message || 'The club could not be created.');
    if (Number.isSafeInteger(result?.walletDeltaAud) && result.walletDeltaAud !== -setup.ownerInvestment) throw new Error('The engine returned an unexpected startup investment movement.');
    activeView = 'overview';
    showWorkspace();
    showToast(`${setup.name} is ready for its first week.`, 'success');
  } catch (error) {
    console.error('Football club creation failed', error);
    dom.setupValidation.textContent = error?.message || 'The club could not be created.';
  } finally {
    dom.createClub.disabled = false;
    dom.createClub.firstChild.textContent = 'Create club ';
  }
}

function showFatal(error) {
  console.error('Football manager initialization failed', error);
  dom.loading.hidden = true;
  dom.onboarding.hidden = true;
  dom.workspace.hidden = true;
  dom.fatal.hidden = false;
  dom.fatalCopy.textContent = error?.message || 'Close any other Dorra House tab, then reload this page.';
  dom.app.setAttribute('aria-busy', 'false');
}

async function initialize() {
  bindStaticEvents();
  vault = await createVaultClient({ onStatus: updateSaveStatus });
  snapshot = clone(vault.snapshot);
  const saved = snapshot?.progress?.footballManager;
  if (saved) {
    footballState = normalizeState(saved);
    showWorkspace();
  } else {
    showOnboarding();
  }
}

initialize().catch(showFatal);
