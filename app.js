import {
  BREATHS,
  SKILLS,
  TRIAGE,
  CRISIS_FIELDS,
  DEFAULT_CONTACTS,
  LEGACY_CONTACTS,
  KIDS_TITLE,
  KIDS_CONTACTS,
  MOOD_WORDS,
  MOOD_TAGS,
  SAFETY_NOTE,
  GROUNDING_STEPS,
  MESSAGES,
  MESSAGES_TITLE,
  MESSAGES_HINT,
  MESSAGES_COPIED,
  MESSAGES_FAILED,
  HELP_QUESTION,
  HELP_ANSWERS,
  WEAK_LABEL,
  TOPICS_BUTTON,
  TOPICS_TITLE,
  TOPICS_LEAD,
  TOPIC_EMPTY,
  TOPIC_COUNT,
  HELPED_FEW,
  HELPED_MANY,
  HELPED_LIST,
  LAST_HELPED,
  DRAFT_HELPED,
  DRAFT_HELPED_REMOVE,
  FILTER_ALL,
  FILTER_HINT,
  SHOWN_OF,
  CALM_BUTTON,
  CALM_LINE,
  CALM_EXIT,
  CALM_MINUTES,
  EXPORT_SEND_BUTTON,
  EXPORT_DOWNLOAD_BUTTON,
  EXPORT_SHARE_DONE,
  EXPORT_SHARE_FAILED,
  EXPORT_SHARE_UNAVAILABLE,
  EXPORT_SHARE_CANT,
  EXPORT_COPY_BUTTON,
  EXPORT_COPY_DONE,
  EXPORT_COPY_FAILED,
  COPY_NOTE,
  PASTE_BUTTON,
  PASTE_HINT,
  PASTE_PARSE_BUTTON,
  PASTE_EMPTY,
  PASTE_CLIPBOARD_EMPTY,
  PASTE_BAD,
  EXPORT_DONE,
  EXPORT_FAILED,
  EXPORT_DEBUG,
  DEBUG_ON,
  DEBUG_OFF,
  IMPORT_BUTTON,
  IMPORT_RESULT,
  IMPORT_ERR_JSON,
  IMPORT_ERR_APP,
  IMPORT_ERR_VERSION,
  IMPORT_ERR_DATA,
  IMPORT_ERR_NEWER,
  SAVE_FAILED_TITLE,
  SAVE_FAILED_TEXT,
  CORRUPT_TITLE,
  CORRUPT_TEXT,
  CORRUPT_LOCKED_TEXT,
  ABOUT_SCHEMA_NOTE,
  EMPTY_TITLE,
  EMPTY_TEXT,
  EMPTY_IMPORT,
  PERSIST_LABEL,
  PERSIST_YES,
  PERSIST_NO,
  PERSIST_NOTE,
} from './content.js';

import { rankSkills, bump } from './rank.js';
import {
  normalize,
  migrate,
  mergeData,
  isDataEmpty,
  buildExport,
  parseImport,
  importCounts,
  exportName,
  shareOutcome,
  refreshDefaultContacts,
  readStored,
  quarantineKey,
  saveOutcome,
  copyKind,
  SCHEMA_VERSION,
  STORAGE_BAD,
  STORAGE_EMPTY,
  SAVE_FAILED,
  COPY_TEXT_EMPTY,
  COPY_TEXT_BAD,
} from './store.js';
import { readData, writeData, clearData } from './db.js';
import { TAB_OF, transition, goBack, stateOf } from './nav.js';
import {
  tagsWithCounts,
  topicEntries,
  listEntries,
  pageOf,
  topicStats,
  lastHelped,
  timesWord,
  LIST_LIMIT,
} from './topics.js';

/* ------------------------------------------------------------------ */
/*  Состояние                                                          */
/* ------------------------------------------------------------------ */

// Единственный источник версии — <meta name="site-version"> в index.html.
const SITE_VERSION =
  document.querySelector('meta[name="site-version"]')?.content || '?';

const KEY = 'opora.v1';
// ВНИМАНИЕ: v1 здесь — имя хранилища, а не номер схемы данных.
// Схема живёт в data.schema и в конверте копии (см. docs/schema.md).
// Ключ не переименовывать: иначе телефон увидит пустоту и потеряет записи.
// отметка «приложением уже пользовались»: нужна, чтобы отличить
// «данные вычищены» от «первый запуск»
const SEEN = 'opora.seen';
// флаг диагностики: в установленном приложении адресной строки нет,
// поэтому ?debug=1 там недоступен — переключаем пятью тапами по версии
const DEBUG = 'opora.debug';

const defaults = () => ({
  ...normalize(null),
  schema: SCHEMA_VERSION,
  contacts: DEFAULT_CONTACTS.map((c) => ({ ...c })),
});

// сохранение не удалось ни в одно хранилище: человек должен это увидеть
let saveFail = false;
// повреждённая строка из localStorage: сырьё и ключ карантина
// (пустой ключ значит «отложить не удалось»)
let corrupt = null;
// карантин не снялся — поверх повреждённых данных не пишем вовсе
let keyLocked = false;

/** Снять копию сырья до того, как что-то поверх запишется. */
function quarantine(raw) {
  const key = quarantineKey();
  try {
    localStorage.setItem(key, raw);
    return key;
  } catch {
    return '';
  }
}

/**
 * Единственное место, где пишется KEY. Возвращает true/false, чтобы save()
 * мог честно сказать, записалось ли хоть куда-нибудь.
 */
function writeLocal(value) {
  if (keyLocked) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// была ли своя копия в localStorage: если нет — при равном времени
// главной считается копия из IndexedDB, иначе стандартные контакты
// перебили бы уже отредактированные
const hadLocal = (() => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
})();

function load() {
  try {
    const stored = readStored(localStorage.getItem(KEY));
    if (stored.kind === STORAGE_EMPTY) return defaults();

    if (stored.kind === STORAGE_BAD) {
      // Битый JSON — не «пусто». Сначала копия сырья, иначе первое же
      // сохранение затрёт то, что ещё можно разобрать.
      const key = quarantine(stored.raw);
      corrupt = { raw: stored.raw, key };
      keyLocked = !key;
      return defaults();
    }

    const data = migrate(stored.value).data;
    // совсем старые записи без списка контактов — стандартный список
    if (!Array.isArray(stored.value?.contacts)) {
      data.contacts = DEFAULT_CONTACTS.map((c) => ({ ...c }));
    }
    return data;
  } catch {
    return defaults();
  }
}

let data = load();

/**
 * Контакты, сохранённые старыми версиями: у 112 и линии МЧС подписи
 * были другие, в том числе «только если ты в Москве». Правим только
 * нетронутые заводские записи — то, что человек написал сам, остаётся.
 */
function migrateContacts() {
  const next = refreshDefaultContacts(data.contacts, DEFAULT_CONTACTS, LEGACY_CONTACTS);
  if (JSON.stringify(next) === JSON.stringify(data.contacts)) return false;
  data.contacts = next;
  return true;
}

/** Миграция подписей и запись в оба хранилища. true — если что-то поменялось. */
function migrateContactsAndSave() {
  if (!migrateContacts()) return false;
  data.ts = Date.now();
  writeLocal(data);
  writeData(data);
  return true;
}

function markUsed() {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    /* приватный режим — отметки не будет */
  }
}

// раньше пользовались — значит, если данные пропали, это стоит сказать
if (!isDataEmpty(data)) markUsed();

let persistAsked = false;

async function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* браузер отказал — покажем это в настройках как «нет» */
  }
}

/**
 * Сохранение с честным результатом. Оба хранилища могут отказать
 * (приватный режим, переполнение, запрет) — тогда на экране появляется
 * строка «не записалось» и кнопка выгрузки, а не тишина.
 */
function save() {
  data.ts = Date.now();
  const local = writeLocal(data);
  markUsed();
  askPersist();
  writeData(data).then((db) => {
    const failed = saveOutcome({ local, db }) === SAVE_FAILED;
    if (failed === saveFail) return;
    saveFail = failed;
    // только верхняя строка, не весь экран: save() зовут и на ввод в поле,
    // а полная перерисовка стёрла бы набранное и каретку
    renderAlerts();
  });
}

/**
 * Вторая копия при старте: читаем IndexedDB, сливаем с localStorage
 * и раскладываем результат обратно в оба места. Если localStorage
 * вычистили, данные поднимутся из IndexedDB.
 */
async function hydrate() {
  const second = await readData();

  if (!second) {
    if (!isDataEmpty(data)) writeData(data);
    if (migrateContactsAndSave()) render();
    return;
  }

  // localStorage пуст — значит своя копия «свежая» только по названию:
  // главной считаем вторую, чтобы не потерять отредактированные контакты
  const merged = hadLocal ? mergeData(data, second) : mergeData(second, data);
  if (JSON.stringify(merged) === JSON.stringify(data)) {
    // копии совпали, но старая подпись заводских контактов могла остаться
    if (migrateContactsAndSave()) render();
    return;
  }

  data = merged;
  writeLocal(data);
  writeData(data);
  migrateContactsAndSave();
  render();
}

let current = { name: 'home', id: null };
// внутренний стек возврата; в историю браузера пишет только go()
let nav = [];
let activeTab = 'home';
let stepIdx = 0;
let cardEdit = false;
let contactsEdit = false;
let draft = { mood: null, tags: new Set(), note: '', helped: [], helpedAt: {} };
// какие записи показать в списке: null — все, иначе метка. В данные не пишется.
let listFilter = null;
// «помогло» прицепляется к записи, только если ответ свежий: запись
// на следующее утро — это не «тогда помогло», а вчерашний вечер.
const HELP_LINK_MS = 30 * 60 * 1000;
const SKILL_ORDER = Object.keys(SKILLS);
let tick = null;
let wakeLock = null;
let deferredPrompt = null;
// какой навык сейчас выполняется: нужен, чтобы после него задать один вопрос
let skillCtx = null;
// что показать про копию и восстановление: пусто, пока ничего не делали
let notice = '';
// защищено ли хранилище от очистки: null — ещё не узнали
let persisted = null;
// восстановление текстом: поле вставки и текст в нём
let pasteOpen = false;
let pasteText = '';
// имя и текст ошибки share: их видно в строке диагностики
let shareError = '';
let shareMessage = '';
// пять тапов по версии в «О приложении»: включить или выключить диагностику
let versionTaps = 0;
let versionTapTimer = null;
// до какого времени идёт «побыть», если с экрана ушли: срок, а не счётчик,
// поэтому возвращение показывает оставшееся время, а не начинает заново
let calmUntil = 0;

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

/* ------------------------------------------------------------------ */
/*  Утилиты                                                            */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const fmtDate = (t) =>
  new Date(t).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Подстановка в шаблон из content.js: {name}, {n}, {m}, {names}. */
const fill = (tpl, vars) =>
  String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** Названия известных навыков через запятую; незнакомые id пропускаем. */
const namesOf = (ids) =>
  (Array.isArray(ids) ? ids : [])
    .filter((id) => SKILLS[id])
    .map((id) => SKILLS[id].title)
    .join(', ');

/**
 * Навыки черновика, которые ещё попадут в запись: известные и не старше
 * 30 минут. Время живёт только здесь — в хранилище и в копию не пишется.
 */
function draftHelped(now = Date.now()) {
  return draft.helped.filter((id) => {
    const ts = Number(draft.helpedAt[id]) || 0;
    return Boolean(SKILLS[id]) && ts > 0 && now - ts <= HELP_LINK_MS;
  });
}

/** Одна запись дневника: дата, слово настроения, метки, заметка. */
const entryBlock = (e) => `
  <div class="entry">
    <div class="entry__top">
      <span class="entry__date">${fmtDate(e.t)}</span>
      <span class="entry__mood">${esc(MOOD_WORDS[e.mood - 1] || '')}</span>
    </div>
    ${e.tags?.length ? `<div class="entry__tags">${esc(e.tags.join(' · '))}</div>` : ''}
    ${e.note ? `<div class="entry__note">${esc(e.note)}</div>` : ''}
  </div>`;

/**
 * Строка «в прошлый раз помогало» для развилки. Показывается только когда
 * выбрана ровно одна метка и настроение 1 или 2; нет данных — строки нет.
 */
function lastHelpedLine() {
  if (draft.tags.size !== 1) return '';
  if (draft.mood !== 1 && draft.mood !== 2) return '';
  const tag = [...draft.tags][0];
  const ids = lastHelped(data.entries, tag, SKILL_ORDER, 2);
  if (!ids.length) return '';
  return `<div class="helped helped--past">${esc(
    fill(LAST_HELPED, { names: namesOf(ids) }),
  )}</div>`;
}

const isStandalone =
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

const dialable = (p) => String(p).replace(/[^\d+]/g, '');

/**
 * Копирование в буфер. Ничего не отправляет и адресатов не знает.
 * Сначала Clipboard API, потом старый способ — он нужен там, где
 * асинхронный API запрещён (http, встроенный браузер, старые движки).
 */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* нет разрешения или не тот контекст — идём в фолбэк */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-2000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Навигация                                                          */
/* ------------------------------------------------------------------ */

/**
 * Переход на экран.
 *
 * Системная история — источник правды для жеста «назад»: экран внутри
 * добавляет запись, вкладка заменяет текущую, повторный тап по тому же
 * экрану не кладёт ничего. URL не меняется: приложение остаётся одной
 * страницей, поэтому переходы не перезагружают её.
 */
function go(name, id = null) {
  const step = transition(current, nav, { name, id });

  if (step.mode === 'none') {
    render();
    return;
  }

  const state = stateOf(step.current);
  if (step.mode === 'push') window.history.pushState(state, '');
  else if (nav.length) {
    // Возврат на вкладку из глубины: не заменяем запись, а проходим назад
    // по своим же записям. Если просто заменить текущую, за спиной останутся
    // записи пройденных экранов и первый жест «назад» на вкладке ничего
    // не сделает — ровно та ловушка, от которой уходим.
    window.history.go(-nav.length);
  } else window.history.replaceState(state, '');

  current = step.current;
  nav = step.stack;
  notice = '';
  render();
}

/**
 * Шаг назад. Идём системной историей, а не только своим стеком: иначе
 * записи браузера и экран разъедутся и жест «назад» начнёт открывать
 * то, чего на экране уже нет. Экран перерисует popstate.
 * Возвращаться некуда — не трогаем систему: на первом экране жест
 * закрывает приложение, и это правильно.
 */
function back() {
  if (!nav.length) return;
  window.history.back();
}

/** Вкладка: заменяет запись истории, стек возврата очищается. */
function switchTab(name) {
  cardEdit = false;
  contactsEdit = false;
  skillCtx = null;
  stepIdx = 0;
  // фильтр списка — про просмотр, а не про данные: на другой вкладке он
  // сбрасывается, чтобы старый фильтр не прятал записи молча
  if (name !== 'diary') listFilter = null;
  go(name);
}

/**
 * Системный «назад»: свайп от края в Safari, жест и кнопка на Android,
 * Alt+← на компьютере. Внутренний стек пуст — мы на первом экране,
 * не вмешиваемся: пусть система закрывает приложение.
 */
window.addEventListener('popstate', () => {
  const step = goBack(current, nav);
  if (!step.moved) return;

  current = step.current;
  nav = step.stack;
  cardEdit = false;
  contactsEdit = false;
  notice = '';
  render();
});

/* ------------------------------------------------------------------ */
/*  Рендер                                                            */
/* ------------------------------------------------------------------ */

function render() {
  clearInterval(tick);
  tick = null;
  releaseWake();

  if (TAB_OF[current.name]) activeTab = TAB_OF[current.name];

  document.body.classList.toggle(
    'immersive',
    (current.name === 'breath' && Boolean(current.id)) || current.name === 'calm',
  );

  view.innerHTML = `<div id="alerts">${alertsBlock()}</div>${
    SCREENS[current.name]?.(current.id) ?? SCREENS.home()
  }`;
  view.scrollTop = 0;

  for (const b of tabbar.querySelectorAll('[data-tab]')) {
    b.classList.toggle('is-active', b.dataset.tab === activeTab);
  }

  MOUNT[current.name]?.(current.id);
}

/* ------------------------------------------------------------------ */
/*  Экраны                                                            */
/* ------------------------------------------------------------------ */

const SCREENS = {
  home() {
    return `
      <div class="screen">
        <header class="head">
          <div class="toprow">
            <div class="eyebrow">сейчас</div>
            <button class="dots" data-act="go" data-screen="more" aria-label="Ещё">⋯</button>
          </div>
          <h1>Как ты?</h1>
        </header>

        <button class="hero" data-act="go" data-screen="triage">
          <span class="hero__t">Мне плохо сейчас</span>
          <span class="hero__s">Подскажу, что делать</span>
        </button>

        <div class="safety">${esc(SAFETY_NOTE)}</div>

        ${restoreBanner()}

        ${statusBlock()}

        <div class="quick">
          <button class="quick__item" data-act="go" data-screen="breath" data-id="sigh">
            Дыхание<span>20 секунд</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="skill" data-id="ground5">
            Заземление<span>3 минуты</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="skill" data-id="quiet">
            Пауза<span>1 минута</span>
          </button>
        </div>

        <button class="btn btn--calm" data-act="go" data-screen="calm">
          ${esc(CALM_BUTTON)}
        </button>

        <div class="note">Здесь можно ничего не делать и ничего не объяснять.</div>

        ${messagesBlock()}

        ${installBlock()}
      </div>`;
  },

  triage() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <h1>Что происходит?</h1>
        </header>
        <div class="grid">
          ${TRIAGE.map(
            (t) =>
              `<button class="grid__btn" data-act="go" data-screen="result" data-id="${t.id}">${esc(
                t.label,
              )}</button>`,
          ).join('')}
        </div>
      </div>`;
  },

  result(id) {
    const t = TRIAGE.find((x) => x.id === id) || TRIAGE[0];
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">${esc(t.label)}</div>
          <h1>Попробуй это</h1>
          <p class="lead">Сверху — то, что обычно помогает быстрее всего.</p>
        </header>
        ${rankSkills(t.skills, data.help)
          .map((r) => skillCard(r.id, r.weak))
          .join('')}
        <button class="btn btn--ghost" data-act="go" data-screen="triage">
          Это не то, что со мной
        </button>
      </div>`;
  },

  skill(id) {
    const s = SKILLS[id];
    if (!s) return SCREENS.home();

    const body = s.body ? `<p>${esc(s.body)}</p>` : '';

    if (s.steps) {
      const n = s.steps.length;
      const i = Math.min(stepIdx, n - 1);
      const dots = s.steps
        .map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`)
        .join('');
      return `
        <div class="screen">
          <button class="back" data-act="back">‹ назад</button>
          <div class="stepper">
            <div class="progress">${dots}</div>
            <div class="step__num">шаг ${i + 1} из ${n}</div>
            <div class="step__text">${esc(s.steps[i])}</div>
            <button class="btn btn--primary" data-act="step-next">
              ${i === n - 1 ? 'Готово' : 'Дальше'}
            </button>
            ${s.caution ? `<div class="caution">${esc(s.caution)}</div>` : ''}
          </div>
        </div>`;
    }

    const cta = s.start
      ? `<button class="btn btn--primary" data-act="start-skill" data-id="${id}">
           ${
             { breath: 'Начать дыхание', grounding: 'Начать', timer: 'Начать', write: 'Писать' }[
               s.start.type
             ] || 'Начать'
           }
         </button>`
      : '';

    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">${esc(s.meta)}</div>
          <h1>${esc(s.title)}</h1>
          <p class="lead">${esc(s.lead)}</p>
        </header>
        ${body}
        ${cta}
        ${s.caution ? `<div class="caution">${esc(s.caution)}</div>` : ''}
      </div>`;
  },

  breath(id) {
    if (!id) {
      return `
        <div class="screen">
          <header class="head">
            <div class="eyebrow">дыхание</div>
            <h1>Выбери ритм</h1>
            <p class="lead">Не важно, какой выберешь. Важен длинный выдох.</p>
          </header>
          ${Object.entries(BREATHS)
            .map(
              ([key, b]) => `
            <button class="card" data-act="go" data-screen="breath" data-id="${key}">
              <div class="card__title">${esc(b.name)}</div>
              <div class="card__meta">${b.cycles} цикла · ${b.phases
                .map((p) => p.sec)
                .join('–')}</div>
            </button>`,
            )
            .join('')}
        </div>`;
    }

    const b = BREATHS[id];
    if (!b) return SCREENS.breath();

    return `
      <div class="screen breath">
        <div class="breath-stage">
          <div class="breath-circle" id="b-circle"></div>
          <div class="breath-inner"></div>
        </div>
        <div class="breath-label" id="b-label">Приготовься</div>
        <div class="breath-count" id="b-count">3</div>
        <div class="breath-meta" id="b-meta">${esc(b.name)}</div>
        <div class="breath-actions">
          <button class="btn btn--ghost" data-act="breath-stop">Закончить</button>
        </div>
      </div>`;
  },

  grounding() {
    const i = Math.min(stepIdx, GROUNDING_STEPS.length - 1);
    const step = GROUNDING_STEPS[i];
    const dots = GROUNDING_STEPS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <div class="stepper">
          <div class="progress">${dots}</div>
          <div class="step__num">${i + 1} из ${GROUNDING_STEPS.length}</div>
          <div class="timer__num">${step.n}</div>
          <div class="step__text">${esc(step.verb)}</div>
          <p class="muted small">${esc(step.hint)}</p>
          <button class="btn btn--primary" data-act="ground-next">
            ${i === GROUNDING_STEPS.length - 1 ? 'Готово' : 'Нашла'}
          </button>
        </div>
      </div>`;
  },

  timer(id) {
    const s = SKILLS[id];
    const minutes = s?.start?.minutes ?? 1;
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <div class="timer">
          <div class="timer__num" id="t-num">${String(minutes).padStart(2, '0')}:00</div>
          <div class="timer__hint">
            ${
              s?.lead
                ? esc(s.lead)
                : 'Займи руки чем-нибудь. Вода, окно, пол.'
            }
          </div>
          <div class="timer__hint">Ничего не нужно решать прямо сейчас.</div>
          <button class="btn btn--ghost" data-act="timer-stop">Хватит</button>
        </div>
      </div>`;
  },

  write() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">только для тебя</div>
          <h1>Пиши как есть</h1>
          <p class="lead">Это никто не прочитает. Текст останется на этом телефоне.</p>
        </header>
        <textarea id="letter" rows="12" placeholder="Всё, что хочется сказать…">${esc(
          data.letter,
        )}</textarea>
        <div style="height:14px"></div>
        <button class="btn btn--primary" data-act="letter-done">Готово</button>
        <button class="btn btn--ghost btn--danger" data-act="letter-clear">Стереть текст</button>
      </div>`;
  },

  done(id) {
    const skill = id && SKILLS[id] ? id : null;
    return `
      <div class="screen">
        <header class="head">
          <div class="eyebrow">готово</div>
          <h1>Как сейчас?</h1>
        </header>
        <p class="lead">
          Не обязательно стало лучше. Достаточно, что ты не осталась с этим одна.
        </p>
        ${
          skill
            ? `<section class="ask">
                 <h2 class="ask__q">${esc(HELP_QUESTION)}</h2>
                 <div class="ask__opts">
                   ${HELP_ANSWERS.map(
                     (a) =>
                       `<button class="ask__opt" data-act="help" data-id="${skill}" data-v="${a.id}">${esc(
                         a.label,
                       )}</button>`,
                   ).join('')}
                 </div>
               </section>`
            : ''
        }
        <button class="btn btn--primary" data-act="go" data-screen="triage">Ещё что-нибудь</button>
        <button class="btn" data-act="go" data-screen="home">На главную</button>
      </div>`;
  },

  calm() {
    return `
      <div class="screen calm">
        <div class="calm__halo" aria-hidden="true"></div>
        <div class="calm__line">${esc(CALM_LINE)}</div>
        <div class="calm__time" id="c-num">${String(CALM_MINUTES).padStart(2, '0')}:00</div>
        <button class="btn btn--ghost calm__exit" data-act="calm-exit">${esc(CALM_EXIT)}</button>
      </div>`;
  },

  /* ------------------------------ карточка ------------------------ */

  card() {
    if (cardEdit) {
      return `
        <div class="screen">
          <button class="back" data-act="back">‹ назад</button>
          <header class="head">
            <h1>Моя карточка</h1>
            <p class="lead">Заполняй спокойно и по чуть-чуть. Можно вернуться позже.</p>
          </header>
          ${CRISIS_FIELDS.map(
            (f) => `
            <div class="field">
              <label class="field__label" for="f-${f.key}">${esc(f.label)}</label>
              <span class="field__hint">${esc(f.hint)}</span>
              <textarea id="f-${f.key}" rows="3" placeholder="${esc(f.placeholder)}">${esc(
                data.card[f.key] || '',
              )}</textarea>
            </div>`,
          ).join('')}
          <button class="btn btn--primary" data-act="card-save">Сохранить</button>
          <button class="btn btn--ghost" data-act="card-cancel">Отмена</button>
        </div>`;
    }

    const empty = CRISIS_FIELDS.every((f) => !(data.card[f.key] || '').trim());

    return `
      <div class="screen">
        <header class="head">
          <div class="eyebrow">на плохие минуты</div>
          <h1>Моя карточка</h1>
          <p class="lead">Твои собственные слова. Их не нужно придумывать заново в накате.</p>
        </header>

        ${
          empty
            ? `<div class="note" style="margin-bottom:18px">
                 Пока пусто. Заполни, когда будет ресурс — не сегодня, так завтра.
               </div>`
            : ''
        }

        ${CRISIS_FIELDS.map((f) => {
          const val = (data.card[f.key] || '').trim();
          return `
            <div class="field-block">
              <h2>${esc(f.label)}</h2>
              <div class="val ${val ? '' : 'empty'}">${val ? esc(val) : 'не заполнено'}</div>
            </div>`;
        }).join('')}

        <button class="btn" data-act="card-edit">${empty ? 'Заполнить' : 'Изменить'}</button>
        <button class="btn btn--ghost" data-act="go" data-screen="contacts">Контакты и звонки</button>
      </div>`;
  },

  contacts() {
    if (contactsEdit) {
      return `
        <div class="screen">
          <button class="back" data-act="back">‹ назад</button>
          <header class="head"><h1>Контакты</h1></header>
          ${data.contacts
            .map(
              (c, i) => `
            <div class="field-block">
              <div class="field">
                <label class="field__label">Название</label>
                <input type="text" data-c="label" data-i="${i}" value="${esc(c.label)}">
              </div>
              <div class="field">
                <label class="field__label">Телефон</label>
                <input type="tel" data-c="phone" data-i="${i}" value="${esc(c.phone)}">
              </div>
              <div class="field" style="margin-bottom:0">
                <label class="field__label">Заметка</label>
                <input type="text" data-c="note" data-i="${i}" value="${esc(c.note || '')}">
              </div>
              <div style="height:10px"></div>
              <button class="btn btn--ghost btn--danger" data-act="contact-del" data-id="${i}">
                Удалить
              </button>
            </div>`,
            )
            .join('')}
          <button class="btn" data-act="contact-add">+ Добавить контакт</button>
          <button class="btn btn--primary" data-act="contacts-save">Сохранить</button>
          <button class="btn btn--ghost" data-act="contacts-cancel">Отмена</button>
        </div>`;
    }

    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <h1>Контакты</h1>
        </header>
        ${data.contacts.map(contactLink).join('')}
        <h2 class="section">${esc(KIDS_TITLE)}</h2>
        ${KIDS_CONTACTS.map(contactLink).join('')}
        <button class="btn" data-act="contacts-edit">Изменить список</button>
        ${messagesBlock()}
      </div>`;
  },

  /* ------------------------------ дневник ------------------------- */

  diary() {
    const tagsPresent = tagsWithCounts(data.entries, MOOD_TAGS);
    const page = pageOf(listEntries(data.entries, listFilter), LIST_LIMIT);
    const helpedNames = draftHelped();
    const last = [...data.entries].sort((a, b) => a.t - b.t).slice(-14);

    return `
      <div class="screen">
        <header class="head">
          <div class="eyebrow">если хочется</div>
          <h1>Как я</h1>
          <p class="lead">Совсем не обязательно. Никаких серий и напоминаний здесь нет.</p>
        </header>

        <div class="mood">
          ${MOOD_WORDS.map(
            (w, i) => `
            <button class="mood__btn ${draft.mood === i + 1 ? 'on' : ''}"
              data-act="mood" data-v="${i + 1}">
              <i></i>${esc(w)}
            </button>`,
          ).join('')}
        </div>

        <div class="tags">
          ${MOOD_TAGS.map(
            (t) => `
            <button class="tag ${draft.tags.has(t) ? 'on' : ''}" data-act="tag" data-tag="${esc(t)}">
              ${esc(t)}
            </button>`,
          ).join('')}
        </div>

        ${lastHelpedLine()}

        ${
          helpedNames.length
            ? `<div class="helped helped--draft">
                 <span>${esc(DRAFT_HELPED)}:</span>
                 ${helpedNames
                   .map(
                     (id) =>
                       `<button class="chip" data-act="draft-unhelp" data-id="${esc(
                         id,
                       )}" aria-label="${esc(`${DRAFT_HELPED_REMOVE}: ${SKILLS[id].title}`)}">
                          ${esc(SKILLS[id].title)} ×
                        </button>`,
                   )
                   .join('')}
               </div>`
            : ''
        }

        <textarea id="note" rows="3" placeholder="Что-то ещё? Пара слов достаточно.">${esc(
          draft.note,
        )}</textarea>
        <div style="height:14px"></div>
        <button class="btn btn--primary" data-act="save-entry">Сохранить</button>

        ${
          last.length
            ? `<div class="spark">${last
                .map(
                  (e) =>
                    `<div class="spark__d" style="height:${6 + e.mood * 9}px;opacity:${
                      0.35 + e.mood * 0.13
                    }"></div>`,
                )
                .join('')}</div>`
            : ''
        }

        ${
          data.entries.length
            ? `<button class="btn btn--ghost" data-act="go" data-screen="topics">
                 ${esc(TOPICS_BUTTON)}
               </button>`
            : ''
        }

        ${
          tagsPresent.length
            ? `<div class="chips" role="group" aria-label="${esc(FILTER_HINT)}">
                 <button class="chip ${listFilter ? '' : 'on'}" data-act="filter" data-tag="">
                   ${esc(FILTER_ALL)}
                 </button>
                 ${tagsPresent
                   .map(
                     ({ tag }) => `
                   <button class="chip ${listFilter === tag ? 'on' : ''}" data-act="filter" data-tag="${esc(
                     tag,
                   )}">
                     ${esc(tag)}
                   </button>`,
                   )
                   .join('')}
               </div>`
            : ''
        }

        ${
          page.shown.length
            ? page.shown.map(entryBlock).join('') +
              (page.total > page.shown.length
                ? `<div class="shown">${esc(
                    fill(SHOWN_OF, { n: page.shown.length, m: page.total }),
                  )}</div>`
                : '')
            : data.entries.length
              ? `<div class="empty">${esc(TOPIC_EMPTY)}</div>`
              : `<div class="empty">Записей пока нет. Это нормально.</div>`
        }
      </div>`;
  },

  /* ------------------------------ темы --------------------------- */

  topics() {
    const list = tagsWithCounts(data.entries, MOOD_TAGS);

    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">дневник</div>
          <h1>${esc(TOPICS_TITLE)}</h1>
          <p class="lead">${esc(TOPICS_LEAD)}</p>
        </header>
        ${
          list.length
            ? list
                .map(
                  ({ tag, n }) => `
              <button class="card" data-act="go" data-screen="topic" data-id="${esc(tag)}">
                <div class="card__title">${esc(tag)}</div>
                <div class="card__meta">${esc(fill(TOPIC_COUNT, { n }))}</div>
              </button>`,
                )
                .join('')
            : `<div class="empty">${esc(TOPIC_EMPTY)}</div>`
        }
      </div>`;
  },

  topic(tag) {
    if (!tag || !MOOD_TAGS.includes(tag)) return SCREENS.topics();

    const items = topicEntries(data.entries, tag);
    const stats = topicStats(data.entries, tag, SKILL_ORDER);
    // не больше трёх строк: при M ≥ 2 это ещё не стена текста
    const top = stats.helped.slice(0, 3);

    const helpedBlock =
      stats.total >= 2
        ? top
            .map(({ id, n }) => {
              const word = timesWord(n);
              const tpl = word === 'раза' ? HELPED_FEW : HELPED_MANY;
              return `<div class="helped">${esc(
                fill(tpl, { name: SKILLS[id].title, n, m: stats.total }),
              )}</div>`;
            })
            .join('')
        : top.length
          ? `<div class="helped">${esc(
              fill(HELPED_LIST, { names: namesOf(top.map((x) => x.id)) }),
            )}</div>`
          : '';

    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">${esc(TOPICS_TITLE)}</div>
          <h1>${esc(tag)}</h1>
        </header>
        ${helpedBlock}
        ${
          items.length
            ? items.map(entryBlock).join('')
            : `<div class="empty">${esc(TOPIC_EMPTY)}</div>`
        }
      </div>`;
  },

  /* ------------------------------ прочее -------------------------- */

  more() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head"><h1>Ещё</h1></header>
        ${statusBlock()}
        <div class="grid">
          <button class="grid__btn" data-act="go" data-screen="contacts">Контакты и звонки</button>
          <button class="grid__btn" data-act="go" data-screen="about">О приложении</button>
          <button class="grid__btn" data-act="install">Установить на телефон</button>
        </div>

        <section class="copy">
          <h2 class="copy__title">Копия</h2>
          <button class="btn btn--primary" data-act="export-send">${esc(EXPORT_SEND_BUTTON)}</button>
          <button class="btn" data-act="export-download">${esc(EXPORT_DOWNLOAD_BUTTON)}</button>
          <button class="btn btn--ghost btn--small" data-act="export-copy-text">
            ${esc(EXPORT_COPY_BUTTON)}
          </button>
          <p class="hint">${esc(COPY_NOTE)}</p>
        </section>

        <section class="copy">
          <h2 class="copy__title">Восстановление</h2>
          <button class="btn" data-act="import">${esc(IMPORT_BUTTON)}</button>
          <button class="btn btn--ghost" data-act="paste">${esc(PASTE_BUTTON)}</button>
          ${pasteBlock()}
        </section>

        ${debugBlock()}
        <div class="persist">
          <div class="persist__row">
            <span>${esc(PERSIST_LABEL)}</span>
            <span id="persist-state">${
              persisted === null ? '—' : persisted ? esc(PERSIST_YES) : esc(PERSIST_NO)
            }</span>
          </div>
          <p class="hint">${esc(PERSIST_NOTE)}</p>
        </div>
        <button class="btn btn--ghost btn--danger" data-act="erase">Стереть всё</button>
        <div class="safety">${esc(SAFETY_NOTE)}</div>
      </div>`;
  },

  about() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">опора</div>
          <h1>О приложении</h1>
        </header>
        <p>
          Это набор техник, которые помогают пережить тяжёлые минуты, и место,
          где можно собрать свои собственные слова заранее.
        </p>
        <p class="muted small">
          Приложение не ставит диагнозов, ничего не считает и никуда не отправляет.
          Все записи хранятся в этом браузере на этом телефоне — в двух местах,
          чтобы пережить очистку одного из них.
        </p>
        <p class="muted small">
          Если телефон потеряется или данные браузера сотрут полностью — записи исчезнут.
          Поэтому есть копия: на телефоне кнопка пересылает файл в мессенджер,
          на компьютере — скачивает. Если файл не уходит, текст копии можно
          скопировать и вставить в переписку.
        </p>
        <p class="muted small">${esc(ABOUT_SCHEMA_NOTE)}</p>
        <div class="note">
          ${esc(SAFETY_NOTE)}
          Если есть угроза для жизни — это не к приложению, это в скорую.
        </div>
        <div class="safety version" data-act="about-version">
          Версия ${esc(SITE_VERSION)} · работает офлайн
        </div>
        ${debugBlock()}
      </div>`;
  },
};

/* ------------------------------------------------------------------ */
/*  Мелкие шаблоны                                                     */
/* ------------------------------------------------------------------ */

function skillCard(id, weak = false) {
  const s = SKILLS[id];
  if (!s) return '';
  return `
    <button class="card" data-act="go" data-screen="skill" data-id="${id}">
      <div class="card__title">${esc(s.title)}</div>
      <div class="card__meta">${esc(s.meta)}</div>
      ${s.lead ? `<div class="card__lead">${esc(s.lead)}</div>` : ''}
      ${weak ? `<div class="card__weak">${esc(WEAK_LABEL)}</div>` : ''}
    </button>`;
}

function contactLink(c) {
  return `
    <a class="contact" href="tel:${esc(dialable(c.phone))}">
      <div class="contact__body">
        <div class="contact__name">${esc(c.label)}</div>
        ${c.note ? `<div class="contact__note">${esc(c.note)}</div>` : ''}
      </div>
      <div class="contact__call">позвонить</div>
    </a>`;
}

function messagesBlock() {
  return `
    <section class="msgs">
      <h2 class="msgs__title">${esc(MESSAGES_TITLE)}</h2>
      <p class="msgs__hint">${esc(MESSAGES_HINT)}</p>
      <div class="msgs__list">
        ${MESSAGES.map(
          (m) => `
          <button class="msg" data-act="copy" data-id="${m.id}">
            <span class="msg__label">${esc(m.label)}</span>
            <span class="msg__text">${esc(m.text)}</span>
            <span class="msg__state" data-state="${m.id}"></span>
          </button>`,
        ).join('')}
      </div>
    </section>`;
}

function installBlock() {
  if (isStandalone) return '';
  return `
    <div style="height:14px"></div>
    <button class="btn" data-act="install" style="margin-top:14px">
      Поставить на главный экран
    </button>`;
}

/* ------------------------------------------------------------------ */
/*  Копия и восстановление                                            */
/* ------------------------------------------------------------------ */

function statusBlock() {
  if (!notice) return '';
  return `<p class="status" role="status">${esc(notice)}</p>`;
}

/**
 * Строка статуса внутри баннера. Баннер стоит на каждом экране, а на «Ещё»
 * тот же текст уже выведен в самом экране — второй раз он не нужен.
 */
function noticeInAlert() {
  if (current.name === 'more') return '';
  return statusBlock();
}

/**
 * То, что человек обязан увидеть на любом экране: сохранение не удалось
 * и повреждённое хранилище. Оба случая — про потерю записей, поэтому
 * строка стоит над экраном, а не в «Ещё».
 */
function alertsBlock() {
  const out = [];

  if (corrupt) {
    out.push(`
      <div class="alert" role="alert">
        <div class="alert__title">${esc(CORRUPT_TITLE)}</div>
        <p class="alert__text">${esc(corrupt.key ? CORRUPT_TEXT : CORRUPT_LOCKED_TEXT)}</p>
        <button class="btn btn--small" data-act="export-copy-raw">
          ${esc(EXPORT_COPY_BUTTON)}
        </button>
        ${noticeInAlert()}
      </div>`);
  }

  if (saveFail) {
    out.push(`
      <div class="alert" role="alert">
        <div class="alert__title">${esc(SAVE_FAILED_TITLE)}</div>
        <p class="alert__text">${esc(SAVE_FAILED_TEXT)}</p>
        <button class="btn btn--small" data-act="export-copy-text">
          ${esc(EXPORT_COPY_BUTTON)}
        </button>
        ${noticeInAlert()}
      </div>`);
  }

  return out.join('');
}

/**
 * Обновить только строку предупреждений, не перерисовывая экран.
 * Нужна там, где рендер разрушил бы ввод (сохранение на каждую букву).
 */
function renderAlerts() {
  const host = view.querySelector('#alerts');
  if (!host) return;
  host.innerHTML = alertsBlock();
}

/** Поле вставки: открывается, если буфер недоступен или пуст. */
function pasteBlock() {
  if (!pasteOpen) return '';
  return `
    <p class="hint">${esc(PASTE_HINT)}</p>
    <textarea id="paste-text" rows="4" spellcheck="false">${esc(pasteText)}</textarea>
    <button class="btn btn--small" data-act="paste-parse">${esc(PASTE_PARSE_BUTTON)}</button>`;
}

/** Выгрузка сырья повреждённого хранилища — то, что удалось прочитать. */
async function copyCorruptText() {
  try {
    const ok = await copyText(corrupt?.raw || '');
    notice = ok ? EXPORT_COPY_DONE : EXPORT_COPY_FAILED;
  } catch {
    notice = EXPORT_COPY_FAILED;
  }
  render();
}

/**
 * Data может пропасть целиком: localStorage вычистили, а IndexedDB
 * не пережила. Если приложением раньше пользовались — говорим прямо
 * и даём кнопку импорта, а не делаем вид, что всё в порядке.
 */
function restoreBanner() {
  if (!isDataEmpty(data)) return '';

  let seen = false;
  try {
    seen = localStorage.getItem(SEEN) === '1';
  } catch {
    seen = false;
  }
  if (!seen) return '';

  return `
    <section class="restore">
      <h2 class="restore__title">${esc(EMPTY_TITLE)}</h2>
      <p class="restore__text">${esc(EMPTY_TEXT)}</p>
      <button class="btn btn--primary" data-act="import">${esc(EMPTY_IMPORT)}</button>
    </section>`;
}

async function refreshPersist() {
  let value = false;
  try {
    if (navigator.storage?.persisted) value = await navigator.storage.persisted();
  } catch {
    value = false;
  }
  persisted = value;
  const el = document.getElementById('persist-state');
  if (el) el.textContent = value ? PERSIST_YES : PERSIST_NO;
}

/**
 * Восстановление из файла. Формат определяется по содержимому, а не по
 * расширению: тот же файл мог прийти из мессенджера под любым именем.
 */
async function applyImport(file) {
  let text = '';
  try {
    text = await file.text();
  } catch {
    notice = IMPORT_ERR_JSON;
    render();
    return;
  }
  await importText(text);
}

/**
 * Общий вход восстановления: одна строка, что бы ни пришло — файл,
 * буфер обмена или вставка руками. Формат решает содержимое.
 */
async function importText(raw) {
  const text = String(raw ?? '').trim();
  const kind = copyKind(text);

  if (kind === COPY_TEXT_EMPTY) {
    notice = PASTE_EMPTY;
    render();
    return;
  }
  if (kind === COPY_TEXT_BAD) {
    notice = PASTE_BAD;
    render();
    return;
  }

  applyPlainImport(text);
}

/** Импорт копии. Данные на устройстве не трогаются при отказе. */
function applyPlainImport(text) {
  const parsed = parseImport(text);
  if (!parsed.ok) {
    notice =
      {
        json: IMPORT_ERR_JSON,
        app: IMPORT_ERR_APP,
        version: IMPORT_ERR_VERSION,
        data: IMPORT_ERR_DATA,
        // копия из будущего: сливать нельзя — незнакомые поля потеряются
        newer: IMPORT_ERR_NEWER,
      }[parsed.error] || IMPORT_ERR_JSON;
    render();
    return;
  }

  const merged = mergeData(data, parsed.data);
  const { fresh, existed } = importCounts(data, merged);
  data = merged;
  save();
  // старая копия могла принести прежние подписи 112 и линии МЧС
  migrateContactsAndSave();
  pasteOpen = false;
  pasteText = '';
  notice = IMPORT_RESULT.replace('{n}', String(fresh)).replace('{m}', String(existed));
  render();
}

/** «Вставить текст»: сначала буфер, а если не дал — поле для вставки руками. */
async function pasteFromClipboard() {
  let text = '';
  try {
    if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();
  } catch {
    text = '';
  }

  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    pasteOpen = true;
    notice = PASTE_CLIPBOARD_EMPTY;
    render();
    document.getElementById('paste-text')?.focus();
    return;
  }

  await importText(trimmed);
}

/**
 * Текст копии. Один и тот же для всех трёх путей наружу: файл, лист
 * «Поделиться» и буфер. Копия не зашифрована — так и подписана на экране.
 */
function buildCopy() {
  return JSON.stringify(buildExport(data, SITE_VERSION));
}

/**
 * Файл копии: имя латиницей и дата, без русских слов — файл может уехать
 * в чужой чат, и имя должно открываться на любом устройстве.
 */
function makeCopyFile(text) {
  const name = exportName(new Date());
  const file = new File([text], name, { type: 'application/json' });
  return { name, file };
}

/**
 * canShare({ files }) для настоящего файла копии: true / false,
 * либо null — метода нет или он упал на проверке.
 */
function canShareFiles(file) {
  if (!file) return null;
  try {
    if (typeof navigator.canShare !== 'function') return null;
    return navigator.canShare({ files: [file] }) === true;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Диагностика: без неё причину на чужом телефоне не узнать           */
/* ------------------------------------------------------------------ */

/**
 * В установленном приложении адресной строки нет, поэтому ?debug=1
 * недоступен. Флаг живёт в localStorage и переключается пятью тапами
 * по строке версии в «О приложении»; параметр в адресе тоже работает.
 */
function debugEnabled() {
  try {
    if (localStorage.getItem(DEBUG) === '1') return true;
  } catch {
    /* приватный режим: остаётся адресный параметр */
  }
  try {
    return new URLSearchParams(location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

function toggleDebug() {
  const next = !debugEnabled();
  try {
    if (next) localStorage.setItem(DEBUG, '1');
    else localStorage.removeItem(DEBUG);
  } catch {
    /* не записалось — включится до перезагрузки */
  }
  notice = next ? DEBUG_ON : DEBUG_OFF;
  return next;
}

/** Файлы трёх типов: видно, что именно отвергает браузер телефона. */
function probeFiles() {
  const payload = JSON.stringify(buildExport(data, SITE_VERSION), null, 2);
  const name = exportName(new Date());
  return [
    ['application/json', new File([payload], name, { type: 'application/json' })],
    ['text/plain', new File([payload], name.replace(/\.json$/, '.txt'), { type: 'text/plain' })],
    [
      'application/octet-stream',
      new File([payload], name, { type: 'application/octet-stream' }),
    ],
  ];
}

function canShareProbe(file) {
  if (typeof navigator.canShare !== 'function') return 'метода нет';
  try {
    return navigator.canShare({ files: [file] }) ? 'true' : 'false';
  } catch (e) {
    return `ошибка ${e?.name || '?'}`;
  }
}

/**
 * Строка диагностики — построчно, без догадок: что есть в браузере,
 * что он отвечает про каждый тип файла и чем кончилась последняя попытка.
 */
function debugBlock() {
  if (!debugEnabled()) return '';
  const probes = probeFiles();
  const lines = [
    `share: ${typeof navigator.share}`,
    `canShare: ${typeof navigator.canShare}`,
    ...probes.map(([type, file]) => `canShare(${type}): ${canShareProbe(file)}`),
    `maxTouchPoints: ${navigator.maxTouchPoints ?? '?'}`,
    `ошибка: ${shareError || '—'}`,
  ];
  if (shareMessage) lines.push(`сообщение: ${shareMessage}`);
  return `
    <div class="debug">
      <div>${esc(EXPORT_DEBUG)}</div>
      ${lines.map((l) => `<div>${esc(l)}</div>`).join('')}
    </div>`;
}

/**
 * Доставка. У всех трёх путей одно общее: копия собирается из текущих
 * данных и уходит целиком. Обрезки и «почти отправили» нет.
 */

/**
 * «Отправить»: системный лист с файлом копии (там будет Telegram и всё
 * остальное). Ветку решает canShare({files}), а не наличие share:
 * «браузер не умеет» — не сбой, и текст у него другой.
 */
async function sendCopy() {
  const text = buildCopy();
  const { file } = makeCopyFile(text);
  shareError = '';
  shareMessage = '';

  if (typeof navigator.share !== 'function') {
    shareError = 'navigator.share отсутствует';
    notice = EXPORT_SHARE_UNAVAILABLE;
    render();
    return;
  }
  if (canShareFiles(file) === false) {
    shareError = 'canShare({files}) === false';
    notice = EXPORT_SHARE_CANT;
    render();
    return;
  }

  try {
    await navigator.share({ files: [file] });
  } catch (e) {
    // человек сам закрыл лист — это нормально, экран не трогаем
    if (shareOutcome(e) === 'silent') return;
    shareError = e?.name || 'без имени';
    shareMessage = e?.message || '';
    notice = EXPORT_SHARE_FAILED;
    render();
    return;
  }
  notice = EXPORT_SHARE_DONE;
  render();
}

/** Текст копии в буфер: работает и там, где файл не уходит. */
async function copyExportText() {
  const ok = await copyText(buildCopy());
  notice = ok ? EXPORT_COPY_DONE : EXPORT_COPY_FAILED;
  render();
}

/** «Скачать файл»: файл отдаётся браузеру; сохранение не подтверждается. */
function downloadCopy() {
  try {
    const { name, file } = makeCopyFile(buildCopy());
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    notice = EXPORT_DONE;
  } catch {
    notice = EXPORT_FAILED;
  }
  render();
}

/* ------------------------------------------------------------------ */
/*  Живые экраны                                                       */
/* ------------------------------------------------------------------ */

const MOUNT = {
  breath(id) {
    if (!id || !BREATHS[id]) return;
    startBreath(id);
  },

  timer(id) {
    const s = SKILLS[id];
    const total = (s?.start?.minutes ?? 1) * 60;
    startTimer(total);
  },

  calm() {
    startCalm(CALM_MINUTES * 60);
  },

  write() {
    const ta = document.getElementById('letter');
    if (!ta) return;
    ta.addEventListener('input', () => {
      data.letter = ta.value;
      data.letterTs = Date.now();
      save();
    });
    ta.focus();
  },

  diary() {
    const note = document.getElementById('note');
    if (!note) return;
    note.addEventListener('input', () => {
      draft.note = note.value;
    });
  },

  more() {
    refreshPersist();

    // значение поля живёт в переменной, а не в DOM: экран перерисовывается
    // после каждого действия, и без этого ввод бы пропадал
    const paste = document.getElementById('paste-text');
    if (paste) {
      paste.addEventListener('input', () => {
        pasteText = paste.value;
      });
    }
  },
};

/* ------------------------------------------------------------------ */
/*  Дыхание                                                           */
/* ------------------------------------------------------------------ */

function startBreath(id) {
  const b = BREATHS[id];
  const circle = document.getElementById('b-circle');
  const label = document.getElementById('b-label');
  const count = document.getElementById('b-count');
  const meta = document.getElementById('b-meta');
  if (!circle || !label || !count) return;

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  keepAwake();

  let phase = 0;
  let cycle = 0;
  let phaseEnd = 0;

  const apply = (p, dur) => {
    label.textContent = p.label;
    if (!calm) {
      circle.style.transitionDuration = dur + 's';
      circle.style.transform = `scale(${p.scale})`;
    }
    if (meta) meta.textContent = `${b.name} · круг ${cycle + 1} из ${b.cycles}`;
  };

  // подготовка
  let prep = 3;
  label.textContent = 'Приготовься';
  count.textContent = String(prep);
  tick = setInterval(() => {
    prep -= 1;
    if (prep > 0) {
      count.textContent = String(prep);
      return;
    }
    clearInterval(tick);
    phaseEnd = performance.now() + b.phases[0].sec * 1000;
    apply(b.phases[0], b.phases[0].sec);
    buzz();

    tick = setInterval(() => {
      const left = Math.max(0, (phaseEnd - performance.now()) / 1000);
      count.textContent = String(Math.ceil(left) || 0);

      if (left <= 0.02) {
        phase += 1;
        if (phase >= b.phases.length) {
          phase = 0;
          cycle += 1;
          if (cycle >= b.cycles) {
            clearInterval(tick);
            tick = null;
            buzz(80);
            go('done', skillCtx);
            return;
          }
        }
        const p = b.phases[phase];
        phaseEnd = performance.now() + p.sec * 1000;
        apply(p, p.sec);
        buzz();
      }
    }, 90);
  }, 1000);
}

function buzz(ms = 25) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* не поддерживается */
  }
}

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    wakeLock = null;
  }
}

function releaseWake() {
  try {
    wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

/* ------------------------------------------------------------------ */
/*  Таймер                                                            */
/* ------------------------------------------------------------------ */

function startTimer(seconds) {
  const out = document.getElementById('t-num');
  if (!out) return;
  keepAwake();

  let left = seconds;
  const draw = () => {
    const m = Math.floor(left / 60);
    const s = left % 60;
    out.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  draw();

  tick = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(tick);
      tick = null;
      buzz(90);
      go('done', skillCtx);
      return;
    }
    draw();
  }, 1000);
}

/**
 * «Просто побыть»: только время. Ни шагов, ни вопросов, ни оценок —
 * по истечении ничего не происходит, экран просто остаётся.
 *
 * Время считается по сроку `calmUntil`, а не по тикающему счётчику:
 * уход с экрана (в том числе системным «назад») не обнуляет его молча —
 * вернувшись, человек видит оставшееся время. Ни звука, ни уведомления
 * в конце нет: это не будильник и не обязательство.
 */
function startCalm(seconds) {
  const out = document.getElementById('c-num');
  if (!out) return;

  const now = Date.now();
  if (calmUntil <= now) calmUntil = now + seconds * 1000;
  keepAwake();

  const left = () => Math.max(0, Math.ceil((calmUntil - Date.now()) / 1000));

  const draw = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    out.textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  draw(left());

  tick = setInterval(() => {
    const s = left();
    draw(s);
    if (s <= 0) {
      clearInterval(tick);
      tick = null;
      releaseWake();
    }
  }, 1000);
}

/* ------------------------------------------------------------------ */
/*  События                                                           */
/* ------------------------------------------------------------------ */

document.addEventListener('click', async (e) => {
  const tabEl = e.target.closest('[data-tab]');
  if (tabEl) {
    switchTab(tabEl.dataset.tab);
    return;
  }

  const el = e.target.closest('[data-act]');
  if (!el) return;

  const act = el.dataset.act;
  const id = el.dataset.id;

  switch (act) {
    case 'go':
      stepIdx = 0;
      if (el.dataset.screen !== 'card') cardEdit = false;
      if (el.dataset.screen === 'home' || el.dataset.screen === 'triage') skillCtx = null;
      // вошли в навык — после него спросим «помогло?» именно про него
      if (el.dataset.screen === 'skill') skillCtx = id;
      go(el.dataset.screen, id);
      break;

    case 'back':
      back();
      break;

    case 'step-next': {
      const s = SKILLS[current.id];
      if (stepIdx >= s.steps.length - 1) go('done', current.id);
      else {
        stepIdx += 1;
        render();
      }
      break;
    }

    case 'start-skill': {
      const s = SKILLS[id];
      if (!s?.start) break;
      skillCtx = id;
      if (s.start.type === 'breath') go('breath', s.start.id);
      else if (s.start.type === 'grounding') {
        stepIdx = 0;
        go('grounding');
      } else if (s.start.type === 'timer') go('timer', id);
      else if (s.start.type === 'write') go('write');
      break;
    }

    case 'ground-next':
      if (stepIdx >= GROUNDING_STEPS.length - 1) go('done', skillCtx);
      else {
        stepIdx += 1;
        render();
      }
      break;

    case 'breath-stop':
    case 'timer-stop':
    case 'calm-exit':
      clearInterval(tick);
      tick = null;
      releaseWake();
      back();
      break;

    case 'letter-done':
      go('done', skillCtx);
      break;

    case 'letter-clear':
      data.letter = '';
      data.letterTs = Date.now();
      save();
      render();
      break;

    /* -------------------------- сообщения ------------------------ */

    case 'copy': {
      const msg = MESSAGES.find((m) => m.id === id);
      if (!msg) break;
      const ok = await copyText(msg.text);
      const state = el.querySelector('.msg__state');
      if (state) {
        state.textContent = ok ? MESSAGES_COPIED : MESSAGES_FAILED;
        setTimeout(() => {
          if (state.isConnected) state.textContent = '';
        }, 2500);
      }
      break;
    }

    /* -------------------------- память о навыках ----------------- */

    case 'help': {
      const answer = el.dataset.v;
      const now = Date.now();
      data.help = bump(data.help, id, answer, now);
      // «помогло» прицепляется к черновику записи: только этот ответ,
      // только известный навык, только один раз и не старше 30 минут.
      if (answer === 'yes' && SKILLS[id] && !draft.helped.includes(id)) {
        draft.helped.push(id);
        draft.helpedAt[id] = now;
      }
      save();
      skillCtx = null;
      current = { name: 'done', id: null };
      render();
      break;
    }

    /* -------------------------- карточка ------------------------- */

    case 'card-edit':
      cardEdit = true;
      render();
      break;

    case 'card-cancel':
      cardEdit = false;
      render();
      break;

    case 'card-save':
      for (const f of CRISIS_FIELDS) {
        const el2 = document.getElementById('f-' + f.key);
        data.card[f.key] = el2 ? el2.value.trim() : '';
      }
      data.cardTs = Date.now();
      save();
      cardEdit = false;
      render();
      break;

    /* -------------------------- контакты ------------------------- */

    case 'contacts-edit':
      contactsEdit = true;
      render();
      break;

    case 'contacts-cancel':
      contactsEdit = false;
      render();
      break;

    case 'contacts-save': {
      const next = data.contacts.map((c) => ({ ...c }));
      document.querySelectorAll('[data-c]').forEach((inp) => {
        const i = Number(inp.dataset.i);
        if (next[i]) next[i][inp.dataset.c] = inp.value.trim();
      });
      data.contacts = next.filter((c) => c.label || c.phone);
      data.contactsTs = Date.now();
      save();
      contactsEdit = false;
      render();
      break;
    }

    case 'contact-add':
      data.contacts.push({ label: '', phone: '', note: '' });
      render();
      break;

    case 'contact-del':
      data.contacts.splice(Number(id), 1);
      render();
      break;

    /* -------------------------- дневник -------------------------- */

    case 'mood':
      draft.mood = Number(el.dataset.v);
      render();
      break;

    case 'tag': {
      const t = el.dataset.tag;
      if (draft.tags.has(t)) draft.tags.delete(t);
      else draft.tags.add(t);
      render();
      break;
    }

    case 'save-entry': {
      if (!draft.mood) {
        el.textContent = 'Сначала выбери, как ты';
        setTimeout(() => {
          el.textContent = 'Сохранить';
        }, 1600);
        break;
      }
      const now = Date.now();
      data.entries.push({
        t: now,
        ts: now,
        mood: draft.mood,
        tags: [...draft.tags],
        note: draft.note.trim(),
        helped: draftHelped(now),
      });
      save();
      draft = { mood: null, tags: new Set(), note: '', helped: [], helpedAt: {} };
      render();
      break;
    }

    case 'filter':
      listFilter = el.dataset.tag || null;
      render();
      break;

    case 'draft-unhelp':
      draft.helped = draft.helped.filter((x) => x !== id);
      delete draft.helpedAt[id];
      render();
      break;

    /* -------------------------- прочее --------------------------- */

    case 'erase':
      if (confirm('Стереть все записи, карточку и контакты? Это нельзя отменить.')) {
        try {
          localStorage.removeItem(KEY);
          // отметку «пользовались» тоже: иначе после честной очистки
          // приложение решит, что данные пропали
          localStorage.removeItem(SEEN);
          // и диагностику: после «стереть всё» она не должна оставаться
          localStorage.removeItem(DEBUG);
          // и карантин повреждённых копий: «стереть всё» — это про всё
          for (let i = localStorage.length - 1; i >= 0; i -= 1) {
            const k = localStorage.key(i);
            if (k && k.startsWith('opora.corrupt.')) localStorage.removeItem(k);
          }
        } catch {
          /* приватный режим */
        }
        await clearData();
        location.reload();
      }
      break;

    case 'export-send':
      await sendCopy();
      break;

    case 'export-download':
      await downloadCopy();
      break;

    case 'export-copy-text':
      await copyExportText();
      break;

    // восстановление текстом: буфер, а если не дал — поле для вставки
    case 'paste':
      await pasteFromClipboard();
      break;

    case 'paste-parse':
      await importText(pasteText);
      break;

    // повреждённое хранилище: выгружаем сырьё, а не собранные данные
    case 'export-copy-raw':
      await copyCorruptText();
      break;

    // пять тапов по строке версии в «О приложении»: диагностика без адреса
    case 'about-version': {
      versionTaps += 1;
      clearTimeout(versionTapTimer);
      versionTapTimer = setTimeout(() => {
        versionTaps = 0;
      }, 1500);
      if (versionTaps >= 5) {
        versionTaps = 0;
        clearTimeout(versionTapTimer);
        toggleDebug();
        render();
      }
      break;
    }

    case 'import': {
      const input = document.createElement('input');
      input.type = 'file';
      // формат решает содержимое, а не расширение: копию пересылают
      // в мессенджере и она приходит под любым именем
      input.accept = 'application/json,.json,.txt,text/plain';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) applyImport(file);
      });
      input.click();
      break;
    }

    case 'install':
      promptInstall();
      break;

    case 'close-sheet':
      document.querySelector('.sheet')?.remove();
      break;
  }
});

/* ------------------------------------------------------------------ */
/*  Установка                                                         */
/* ------------------------------------------------------------------ */

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

async function promptInstall() {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
    } catch {
      /* браузер передумал — просто покажем инструкцию ниже */
    }
    deferredPrompt = null;
    return;
  }

  const steps = isIOS
    ? ['Нажми кнопку «Поделиться» внизу экрана',
       'Пролистай и выбери «На экран Домой»',
       'Нажми «Добавить»']
    : ['Открой меню браузера (три точки)',
       'Выбери «Установить приложение» или «На главный экран»',
       'Подтверди'];

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet__inner">
      <h2>Поставить на телефон</h2>
      <ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="muted small">
        Тогда приложение откроется без адресной строки и будет работать без интернета.
      </p>
      <button class="btn btn--primary" data-act="close-sheet">Понятно</button>
    </div>`;
  document.body.appendChild(sheet);
}

/* ------------------------------------------------------------------ */
/*  Старт                                                             */
/* ------------------------------------------------------------------ */

// Первый экран заменяет запись, а не добавляет новую: иначе первый жест
// «назад» возвращал бы на тот же экран и приложение не закрывалось бы.
window.history.replaceState(stateOf(current), '');

render();

// вторая копия: читаем IndexedDB и сливаем уже после первого экрана,
// чтобы приложение открывалось мгновенно
hydrate();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
