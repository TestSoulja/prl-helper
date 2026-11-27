import {
  BREATHS,
  SKILLS,
  TRIAGE,
  PANIC_NOTE,
  URGE_SELF_TITLE,
  URGE_SELF_LINES,
  CRISIS_FIELDS,
  PLAN_EYEBROW,
  PLAN_LEAD,
  PLAN_BUTTON,
  PLAN_NEXT,
  PLAN_DONE,
  CARD_FIRST_TITLE,
  CARD_RISK_LINE,
  CARD_AWAY_TITLE,
  CARD_AWAY_HINT,
  CARD_AWAY_PLACEHOLDER,
  AFTER_MEDS_CARD,
  AFTER_MEDS_CARD_SHORT,
  AFTER_MEDS_CONTACTS,
  MEDS_TITLE,
  MEDS_LEAD,
  MEDS_EXPECT,
  MEDS_LINK,
  MEDS_EMPTY,
  MEDS_ADD,
  MEDS_EDIT,
  MEDS_STOP,
  MEDS_RESUME,
  MEDS_SAVE,
  MEDS_CANCEL,
  MEDS_STOPPED_TITLE,
  MED_NAME_LABEL,
  MED_NAME_PLACEHOLDER,
  MED_NAME_EMPTY,
  MED_HOW_LABEL,
  MED_HOW_PLACEHOLDER,
  MED_SINCE_LABEL,
  MED_MODE_LABEL,
  MED_MODE_REGULAR,
  MED_MODE_ASNEEDED,
  MED_SLOTS_LABEL,
  MED_SLOTS_ONCE,
  MED_SLOTS_TWICE,
  SLOT_MORNING,
  SLOT_EVENING,
  MED_SINCE,
  MED_STOPPED_AT,
  MARKS_TITLE,
  MARK_TAKEN,
  MARK_SKIPPED,
  SLEEP_LABEL,
  SLEEP_UNIT,
  SLEEP_NAP,
  SLEEP_NAP_H_LABEL,
  SLEEP_LINE,
  SLEEP_NAP_LINE,
  SLEEP_NAP_H_LINE,
  MONTHS_GEN,
  DEFAULT_CONTACTS,
  LEGACY_CONTACTS,
  KIDS_TITLE,
  KIDS_CONTACTS,
  NO_ONE_TITLE,
  NO_ONE_TEXT,
  NO_ONE_PHONES,
  NO_ONE_LETTER,
  FIRST_STEP_TITLE,
  FIRST_STEP_LEAD,
  FIRST_STEP_SAY,
  FIRST_STEP_TAKE_TITLE,
  FIRST_STEP_TAKE,
  FIRST_STEP_NOTE,
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
  EXPORT_DOWNLOAD_BUTTON,
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
  SLEEP_HISTORY_TITLE,
  SLEEP_HISTORY_HINT,
  MESSAGES_EDIT,
  MESSAGES_RESET,
  MESSAGES_DELETE,
  MESSAGES_SAVE,
  MESSAGES_CANCEL,
  MESSAGES_ADD,
  MESSAGES_OWN_LABEL,
  MESSAGES_EDIT_LABEL,
  MESSAGES_EMPTY,
  MESSAGES_LONG,
  MESSAGES_LIMIT,
  MESSAGES_MAX_HINT,
  MESSAGES_EDITED_LABEL,
  MESSAGES_HIDDEN,
  MESSAGES_HIDDEN_BACK,
  QUICK_BREATH,
  QUICK_BREATH_META,
  QUICK_GROUND,
  QUICK_GROUND_META,
  QUICK_QUIET,
  QUICK_QUIET_META,
  QUICK_CALL,
  QUICK_CALL_META,
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
  shellOf,
  engineOf,
  refreshDefaultContacts,
  readStored,
  quarantineKey,
  saveOutcome,
  copyKind,
  emptyDraft,
  SCHEMA_VERSION,
  STORAGE_BAD,
  STORAGE_EMPTY,
  SAVE_FAILED,
  COPY_TEXT_EMPTY,
  COPY_TEXT_BAD,
} from './store.js';
import { readData, writeData, clearData } from './db.js';
import {
  TAB_OF,
  transition,
  goBack,
  stateOf,
  historyPlan,
  isTabRoot,
  resumeScreen,
  resumeParent,
} from './nav.js';
import {
  messageList,
  hiddenBuiltins,
  saveBuiltin,
  addOwn,
  removeMessage,
  resetBuiltin,
  restoreHidden,
  ownFull,
  MESSAGE_MAX,
  OWN_MAX,
  MESSAGE_EMPTY,
  MESSAGE_LONG,
  MESSAGE_LIMIT,
} from './messages.js';
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
import {
  dayKey,
  activeMeds,
  stoppedMeds,
  lastChange,
  currentSince,
  markOf,
  toggleMed,
  markableMeds,
  slotsOf,
  sleepText,
  sleepLines,
} from './meds.js';
import { planSteps, firstPerson, awayText } from './card.js';
import { featureOn } from './features.js';
import { addEvent, sessionKind } from './events.js';

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
 * Черновик записи — в данные. Это единственное место хранения: отдельного
 * ключа нет, иначе копия и восстановление разошлись бы с реальностью.
 * `ts` свежий у каждого изменения, поэтому очистка после сохранения
 * не проигрывает старому черновику из второй копии.
 */
function draftSnapshot() {
  return {
    mood: draft.mood,
    tags: [...draft.tags],
    note: draft.note,
    helped: [...draft.helped],
    helpedAt: { ...draft.helpedAt },
    sleepH: draft.sleepH,
    nap: draft.nap === true,
    napH: draft.napH,
    ts: Date.now(),
  };
}

function saveDraft() {
  data.draft = draftSnapshot();
  save();
}

/** Очистить черновик после сохранённой записи, не потеряв факт очистки. */
function clearDraft() {
  draft = draftOf(emptyDraft());
  data.draft = draftSnapshot();
}

/**
 * Запомнить, где человек остановился. Берём ближайший экран из списка
 * возврата: из развилки, «побыть», таймера или формы вернёт тот экран,
 * откуда туда пришли. Глубокие состояния (шаг, сессия, форма) не хранятся.
 * Пишем только при смене экрана: render() зовётся и без перехода.
 */
function rememberScreen() {
  const chain = [...nav, current];
  let target = null;
  for (let i = chain.length - 1; i >= 0 && !target; i -= 1) {
    target = resumeScreen(chain[i].name, chain[i].id);
  }
  if (!target) target = { name: 'home', id: null };
  const prev = data.resume || {};
  if (prev.ts && prev.name === target.name && (prev.id ?? null) === target.id) return;
  data.resume = { name: target.name, id: target.id ?? null, ts: Date.now() };
  save();
}

/* ------------------------------------------------------------------ */
/*  Журнал действий                                                    */
/* ------------------------------------------------------------------ */

/**
 * Одно событие в журнал. При включённой диагностике не пишется ничего:
 * отладка не должна менять данные, которые потом поедут в копию.
 *
 * Текста здесь нет по построению: eventOf() (events.js) оставляет только
 * время, вид, обезличенный id, счётчик n, длительность d и флаг done.
 * Ни заметки, ни карточки, ни адреса, ни фразы близкому сюда не попасть.
 */
function journal(kind, fields = {}) {
  if (debugEnabled()) return;
  const { events, dropped } = addEvent(
    data.events,
    { t: Date.now(), kind, ...fields },
    data.eventsDropped,
  );
  data.events = events;
  data.eventsDropped = dropped;
  save();
}

/** Навык, которому принадлежит экран: у дыхания, заземления и письма он в skillCtx. */
function flowSkill(name, id) {
  if (name === 'skill') return id || null;
  // Дыхание и таймер входят двумя путями: из навыка (skillCtx) и быстрой
  // плиткой с главной (id). Без второго вход не записался бы вовсе.
  if (name === 'timer' || name === 'breath') return skillCtx || id || null;
  if (name === 'grounding' || name === 'write') return skillCtx || null;
  return null;
}

/**
 * Журнал по фактически показанному экрану, а не по нажатию: системный
 * «назад», вкладка и «Закончить» ведут сюда, и ни один путь не теряется.
 * render() зовут и без перехода (тап по настроению, «Сохранить») — тогда
 * экран тот же, и ничего не пишется.
 */
function noteScreen(name, id) {
  const next = { name, id: id ?? null };
  if (shown.name === next.name && shown.id === next.id) return;
  shown = next;

  const skill = flowSkill(name, id);

  if (name === 'done' && flow) {
    // «Готово» — конец сессии, а не выход из неё.
    journal(sessionKind({ done: true }), { id: flow.id, d: Date.now() - flow.at, done: true });
    flow = null;
  } else if (flow && flow.id !== skill) {
    // ушли, не дойдя до конца: 10 с и больше — попытка, меньше — взгляд
    const d = Date.now() - flow.at;
    journal(sessionKind({ ms: d }), { id: flow.id, d });
    flow = null;
  }

  if (skill && !flow) {
    flow = { id: skill, at: Date.now() };
    journal('skill_open', { id: skill });
  }
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
  // вторая копия могла быть свежее: черновик берём из неё, а не из памяти
  draft = draftOf(data.draft);
  render();
}

let current = { name: 'home', id: null };
// внутренний стек возврата; в историю браузера пишет только go()
let nav = [];
// состояние, которым надо переписать запись истории после перехода:
// go(-n) асинхронен, поэтому это делается в popstate, а не сразу в go()
let syncState = null;
// экран, на который вернёт идущий сейчас history.go(-n): пока обход не дошёл,
// current не трогаем — иначе render() покажет новый экран раньше времени
let pendingTarget = null;
let activeTab = 'home';
let stepIdx = 0;
// шаг «Пройти план»: живёт только в памяти экрана. Прогресс не сохраняется —
// иначе пройденный план стал бы заданием, которое можно «провалить».
let planStep = 0;
let cardEdit = false;
let contactsEdit = false;
// форма препарата: null — закрыта, 'new' — добавление, иначе id препарата
let medEdit = null;
// режим в открытой форме: 'regular' | 'asneeded'
let medMode = 'regular';
// сколько раз в день: 'once' | 'twice' (ключи в данных — morning/evening)
let medSlots = 'once';
// набранное в форме при перерисовке (переключение режима): null — из данных
let medDraft = null;
// черновик записи живёт в данных: перезапуск не должен уносить набранное.
// В памяти метки — Set, в данных массив; см. draftOf()/draftSnapshot().
function draftOf(saved) {
  const d = saved || emptyDraft();
  return {
    mood: d.mood ?? null,
    tags: new Set(Array.isArray(d.tags) ? d.tags : []),
    note: d.note || '',
    helped: [...(Array.isArray(d.helped) ? d.helped : [])],
    helpedAt: { ...(d.helpedAt || {}) },
    sleepH: d.sleepH || '',
    nap: d.nap === true,
    napH: d.napH || '',
  };
}
let draft = draftOf(data.draft);
// правка фразы близким: null — ничего не правится, 'new' — своя фраза,
// иначе id встроенной или своей. Текст держим здесь, потому что render()
// пересобирает разметку на каждое действие.
let msgEdit = null;
let msgText = '';
let msgError = '';
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
// Журнал действий: какой экран уже учтён и какая сессия навыка идёт.
// В данные уходят только события; здесь — то, что нужно, чтобы не
// посчитать один и тот же экран дважды и не потерять выход из навыка.
let shown = { name: '', id: null };
let flow = null;
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

/**
 * День `YYYY-MM-DD` словами: «14 марта». Считается как местная дата, а не
 * как момент времени: `new Date('2026-03-14')` — это UTC и в минусовых
 * поясах даёт 13 марта, поэтому разбираем строку сами.
 */
const fmtDay = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
  if (!m) return String(d || '');
  const month = MONTHS_GEN[Number(m[2]) - 1] || '';
  return `${Number(m[3])} ${month}`.trim();
};

const medModeLabel = (mode) => (mode === 'asneeded' ? MED_MODE_ASNEEDED : MED_MODE_REGULAR);

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
    ${
      sleepText(e, { line: SLEEP_LINE, nap: SLEEP_NAP_LINE, napLine: SLEEP_NAP_H_LINE })
        ? `<div class="entry__sleep">${esc(
            sleepText(e, { line: SLEEP_LINE, nap: SLEEP_NAP_LINE, napLine: SLEEP_NAP_H_LINE }),
          )}</div>`
        : ''
    }
    ${e.note ? `<div class="entry__note">${esc(e.note)}</div>` : ''}
  </div>`;

/**
 * Отметка приёма — имя препарата и по строке на каждый приём. Показывается
 * только когда есть что отмечать, и молчит, когда ничего не нажато: ни
 * счётчика, ни подписи «не отмечено», ни красного. Повторное нажатие снимает
 * отметку только у этой строки: у соседнего приёма и соседнего препарата своя.
 */
function marksBlock() {
  const active = markableMeds(data.meds);
  if (!active.length) return '';
  const day = dayKey();
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // Один шаблон кнопки на оба состояния: подписи берутся из content.js,
  // а не переписываются второй раз в разметке.
  const button = (m, slot, state, label) => {
    const word = slot === 'morning' ? SLOT_MORNING : slot === 'evening' ? SLOT_EVENING : '';
    const aria = word ? ` aria-label="${esc(`${cap(word)}: ${label}`)}"` : '';
    return `
          <button class="mark ${markOf(data.marks, day, m.id, slot) === state ? 'on' : ''}"
            data-act="mark" data-med="${esc(m.id)}" data-slot="${slot}" data-state="${state}"${aria}>
            ${esc(label)}
          </button>`;
  };
  const rows = active
    .map((m) => {
      const slots = slotsOf(m);
      const lines = slots.length
        ? slots
            .map(
              (slot) => `
          <div class="marks__row">
            <span class="marks__slot">${esc(
              slot === 'morning' ? SLOT_MORNING : SLOT_EVENING,
            )}</span>${button(m, slot, 'taken', MARK_TAKEN)}${button(
              m,
              slot,
              'skipped',
              MARK_SKIPPED,
            )}
          </div>`,
            )
            .join('')
        : `
          <div class="marks__row">${button(m, '', 'taken', MARK_TAKEN)}${button(
            m,
            '',
            'skipped',
            MARK_SKIPPED,
          )}
          </div>`;
      return `
      <div class="marks__med">
        <div class="marks__name">${esc(m.name)}</div>${lines}
      </div>`;
    })
    .join('');
  return `
    <div class="marks">
      <div class="marks__title">${esc(MARKS_TITLE)}</div>
      ${rows}
    </div>`;
}

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
    // Повторный тап по тому же экрану: чаще всего — по активной вкладке.
    // Она и должна вернуть наверх: человек листал дневник и тапнул
    // «дневник», он ждёт начала. Для экранов внутри (двойной тап по
    // «показать» на «готово») позицию не трогаем — это не вкладка.
    render();
    if (isTabRoot(name, id)) window.scrollTo(0, 0);
    return;
  }

  const plan = historyPlan(step, nav);
  const state = stateOf(step.current);

  if (step.mode === 'push') {
    // собираемся уйти с записи — недоисполненная правка предыдущего
    // перехода к ней уже не относится
    syncState = null;
    window.history.pushState(state, '');
  } else if (plan.back) {
    // Возврат на вкладку из глубины: не заменяем запись, а проходим назад
    // по своим же записям. Если просто заменить текущую, за спиной останутся
    // записи пройденных экранов и первый жест «назад» на вкладке ничего
    // не сделает — ровно та ловушка, от которой уходим.
    //
    // go(-n) асинхронен: replaceState, сделанный до перехода, попал бы
    // в покидаемую запись. Поэтому переход состоялся → поправим запись
    // в popstate, когда она уже текущая.
    //
    // render() здесь не зовём: экран перерисует popstate, когда браузер
    // дошёл до записи. Иначе кадр показал бы экран, до которого обход
    // ещё не добрался, и прокрутка считалась бы дважды.
    syncState = plan.replace ? state : null;
    pendingTarget = step;
    window.history.go(-plan.back);
    return;
  } else if (plan.replace) window.history.replaceState(state, '');

  current = step.current;
  nav = step.stack;
  notice = '';
  render();
  // Тап открывает экран сверху. «Назад» сюда не идёт: там позицию
  // возвращает браузер, и трогать её нельзя.
  window.scrollTo(0, 0);
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
  medEdit = null;
  medDraft = null;
  skillCtx = null;
  stepIdx = 0;
  msgEdit = null;
  msgText = '';
  msgError = '';
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
  // Сюда пришли двумя путями: тап по вкладке из глубины (pendingTarget) или
  // обычный жест «назад». В первом случае экран надо вернуть наверх, во
  // втором — оставить позицию, которую восстановил браузер.
  const fromTap = Boolean(pendingTarget);
  const next = fromTap ? pendingTarget : goBack(current, nav);
  pendingTarget = null;

  // Переход назад по своим записям уже состоялся. Запись, на которую
  // пришли, могла остаться с экраном покинутой вкладки — приводим её
  // к правде, пока экран совпадает с тем, что на нём показано.
  if (syncState) {
    const state = syncState;
    syncState = null;
    window.history.replaceState(state, '');
  }

  if (!fromTap && !next.moved) return;

  current = next.current;
  nav = next.stack;
  cardEdit = false;
  contactsEdit = false;
  medEdit = null;
  medDraft = null;
  notice = '';
  render();

  // Safari возвращает прокрутку уже после обработчика popstate, а Chrome —
  // после первого кадра: сброс в том же кадре браузер перезаписал бы своей
  // позицией. Поэтому два кадра. На iOS это не проверено, обход заранее.
  if (fromTap) {
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, 0)));
  }
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

  for (const b of tabbar.querySelectorAll('[data-tab]')) {
    b.classList.toggle('is-active', b.dataset.tab === activeTab);
  }

  MOUNT[current.name]?.(current.id);
  // журнал — по экрану, который человек действительно видит
  noteScreen(current.name, current.id);
  // запомнили экран уже после отрисовки: если render() зовут без перехода,
  // rememberScreen() видит тот же экран и в данные не пишет
  rememberScreen();
}

/**
 * Форма препарата открывается ниже списка. Без прокрутки нажатие «Добавить»
 * выглядит как «ничего не произошло», и человек нажимает второй раз.
 */
function revealMedForm() {
  requestAnimationFrame(() => {
    const el = view.querySelector('.medform');
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
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
            <span class="quick__icon quick__icon--mint" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M3 9.5c2-2.6 4-2.6 6 0s4 2.6 6 0 3.6-2.2 5.2-.7" />
                <path d="M3 15c2-2.6 4-2.6 6 0s4 2.6 6 0 3.6-2.2 5.2-.7" />
              </svg>
            </span>
            <span class="quick__label">${esc(QUICK_BREATH)}</span>
            <span class="quick__meta">${esc(QUICK_BREATH_META)}</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="skill" data-id="ground5">
            <span class="quick__icon quick__icon--warm" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 4.5v9.5" />
                <path d="M8 10.4 12 14.4l4-4" />
                <path d="M4.5 19h15" />
              </svg>
            </span>
            <span class="quick__label">${esc(QUICK_GROUND)}</span>
            <span class="quick__meta">${esc(QUICK_GROUND_META)}</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="skill" data-id="quiet">
            <span class="quick__icon quick__icon--cool" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M9.5 5.5v13" />
                <path d="M14.5 5.5v13" />
              </svg>
            </span>
            <span class="quick__label">${esc(QUICK_QUIET)}</span>
            <span class="quick__meta">${esc(QUICK_QUIET_META)}</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="contacts">
            <span class="quick__icon quick__icon--rose" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M21.5 16.9v2.6a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6 2 2 0 0 1 2-2.2h2.6a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.4 9.5a15.8 15.8 0 0 0 6.1 6.1l1.4-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.9 2.3z"
                />
              </svg>
            </span>
            <span class="quick__label">${esc(QUICK_CALL)}</span>
            <span class="quick__meta">${esc(QUICK_CALL_META)}</span>
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
    const skills = rankSkills(t.skills, data.help).filter(
      (r) => r.id !== 'oneThing' || featureOn('oneThing'),
    );
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">${esc(t.label)}</div>
          <h1>Попробуй это</h1>
          <p class="lead">Сверху — то, что обычно помогает быстрее всего.</p>
        </header>
        ${
          t.note && (t.id !== 'anxiety' || featureOn('panicNote'))
            ? `<div class="note">${esc(t.note)}</div>`
            : ''
        }
        ${skills.map((r) => skillCard(r.id, r.weak)).join('')}
        ${
          t.id === 'urge' && featureOn('urgeSelf')
            ? `<section class="msgs">
                 <h2 class="msgs__title">${esc(URGE_SELF_TITLE)}</h2>
                 <ul class="msgs__hint">
                   ${URGE_SELF_LINES.map((l) => `<li>${esc(l)}</li>`).join('')}
                 </ul>
               </section>`
            : ''
        }
        <button class="btn btn--ghost" data-act="go" data-screen="triage">
          Это не то, что со мной
        </button>
      </div>`;
  },

  skill(id) {
    // Флаг нового навыка: выключенный навык не открывается и не показывается
    // в развилке. Его оценка в help при этом остаётся в данных как есть.
    if (id === 'oneThing' && !featureOn('oneThing')) return SCREENS.home();
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
          ${featureOn('panicNote') ? `<div class="note">${esc(PANIC_NOTE)}</div>` : ''}
          ${Object.entries(BREATHS)
            .map(
              ([key, b]) => `
            <button class="card" data-act="go" data-screen="breath" data-id="${key}">
              <div class="card__title">${esc(b.name)}</div>
              <div class="card__meta">${b.cycles} цикла · ${b.phases
                .map((p) => p.sec)
                .join('–')}</div>
              <span class="card__chev" aria-hidden="true">›</span>
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
            ${i === GROUNDING_STEPS.length - 1 ? 'Готово' : 'Дальше'}
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
          Не обязательно стало лучше. Достаточно, что ты не остаёшься с этим наедине.
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
          ${featureOn('cardAway')
            ? `<div class="field">
            <label class="field__label" for="f-away">${esc(CARD_AWAY_TITLE)}</label>
            <span class="field__hint">${esc(CARD_AWAY_HINT)}</span>
            <textarea id="f-away" rows="1" placeholder="${esc(
              CARD_AWAY_PLACEHOLDER,
            )}">${esc(data.card.away || '')}</textarea>
          </div>`
            : ''}
          <button class="btn btn--primary" data-act="card-save">Сохранить</button>
          <button class="btn btn--ghost" data-act="card-cancel">Отмена</button>
        </div>`;
    }

    const empty = CRISIS_FIELDS.every((f) => !(data.card[f.key] || '').trim());
    const person = firstPerson(data.card.people);
    const away = awayText(data.card);
    const steps = planSteps(data.card.plan);

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

        ${
          featureOn('cardFirst') && person
            ? `<section class="firstcall">
                 <div class="eyebrow">${esc(CARD_FIRST_TITLE)}</div>
                 <div class="firstcall__name">${esc(person)}</div>
               </section>`
            : ''
        }

        <!-- 112 не под флагом: карточка может быть пустой, а помощь — нет. -->
        <a class="risk" href="tel:112">${esc(CARD_RISK_LINE)}</a>

        ${CRISIS_FIELDS.map((f) => {
          const val = (data.card[f.key] || '').trim();
          return `
            <div class="field-block">
              <h2>${esc(f.label)}</h2>
              <div class="val ${val ? '' : 'empty'}">${val ? esc(val) : 'не заполнено'}</div>
            </div>`;
        }).join('')}

        ${
          featureOn('cardAway') && away
            ? `<div class="field-block">
                 <h2>${esc(CARD_AWAY_TITLE)}</h2>
                 <div class="val">${esc(away)}</div>
               </div>`
            : ''
        }

        <div class="safety">${esc(AFTER_MEDS_CARD_SHORT)}</div>

        ${
          featureOn('cardPlan') && steps.length
            ? `<button class="btn btn--primary" data-act="plan-start">${esc(PLAN_BUTTON)}</button>`
            : ''
        }
        <button class="btn" data-act="card-edit">${empty ? 'Заполнить' : 'Изменить'}</button>
        <button class="btn btn--ghost" data-act="go" data-screen="contacts">Контакты и звонки</button>
      </div>`;
  },

  /**
   * «Пройти план»: шаги из карточки по одному, крупно. Это не навык и не
   * лечение — только слова человека, разложенные по шагам. Прогресс не
   * сохраняется: вышла — план снова с начала, и это не провал.
   */
  plan() {
    if (!featureOn('cardPlan')) return SCREENS.card();
    const steps = planSteps(data.card.plan);
    if (!steps.length) return SCREENS.card();
    const i = Math.min(planStep, steps.length - 1);
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <div class="stepper">
          <div class="eyebrow">${esc(PLAN_EYEBROW)}</div>
          <div class="step__num">шаг ${i + 1} из ${steps.length}</div>
          <div class="step__text">${esc(steps[i])}</div>
          <p class="muted small">${esc(PLAN_LEAD)}</p>
          <button class="btn btn--primary" data-act="plan-next">
            ${i === steps.length - 1 ? esc(PLAN_DONE) : esc(PLAN_NEXT)}
          </button>
          <a class="risk" href="tel:112">${esc(CARD_RISK_LINE)}</a>
        </div>
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
        <div class="safety">${esc(AFTER_MEDS_CONTACTS)}</div>
        ${data.contacts.map(contactLink).join('')}
        <h2 class="section">${esc(KIDS_TITLE)}</h2>
        ${KIDS_CONTACTS.map(contactLink).join('')}
        <button class="btn" data-act="contacts-edit">Изменить список</button>
        ${featureOn('firstStep') ? firstStepBlock() : ''}
        ${featureOn('noOne') ? noOneBlock() : ''}
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

        ${marksBlock()}

        <button class="btn btn--ghost btn--small" data-act="go" data-screen="meds">
          ${esc(MEDS_LINK)}
        </button>

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

        <div class="sleep">
          <label class="sleep__cell" for="sleep-h">
            <span class="sleep__t">${esc(SLEEP_LABEL)}</span>
            <span class="sleep__in">
              <input id="sleep-h" type="number" inputmode="decimal" min="0" max="24" step="0.5"
                value="${esc(draft.sleepH)}">
              <span>${esc(SLEEP_UNIT)}</span>
            </span>
          </label>
          <div class="sleep__napwrap">
            <button class="sleep__nap ${draft.nap ? 'on' : ''}" data-act="sleep-nap"
              role="switch" aria-checked="${draft.nap ? 'true' : 'false'}">
              <span class="sleep__box" aria-hidden="true"></span>
              <span>${esc(SLEEP_NAP)}</span>
            </button>
            ${
              draft.nap
                ? `<label class="sleep__cell" for="sleep-nap-h">
              <span class="sleep__t">${esc(SLEEP_NAP_H_LABEL)}</span>
              <span class="sleep__in">
                <input id="sleep-nap-h" type="number" inputmode="decimal" min="0" max="24" step="0.5"
                  value="${esc(draft.napH)}">
                <span>${esc(SLEEP_UNIT)}</span>
              </span>
            </label>`
                : ''
            }
          </div>
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

        ${sleepHistoryBlock()}
      </div>`;
  },

  /* ------------------------------ приём --------------------------- */

  meds() {
    const active = activeMeds(data.meds);
    const stopped = stoppedMeds(data.meds);

    const ghost = (act, id, label) =>
      `<button class="btn btn--ghost btn--small" data-act="${act}" data-id="${esc(
        id,
      )}">${esc(label)}</button>`;

    const row = (m) => {
      const last = lastChange(m);
      const since = currentSince(m);
      const meta = [
        last?.how ? last.how : '',
        medModeLabel(m.mode),
        since && !m.stoppedAt ? fill(MED_SINCE, { d: fmtDay(since) }) : '',
      ]
        .filter(Boolean)
        .join(' · ');

      return `
        <div class="med ${m.stoppedAt ? 'med--stopped' : ''}">
          <div class="med__name">${esc(m.name)}</div>
          ${meta ? `<div class="med__meta">${esc(meta)}</div>` : ''}
          ${
            m.stoppedAt
              ? `<div class="med__meta">${esc(
                  fill(MED_STOPPED_AT, { d: fmtDay(m.stoppedAt) }),
                )}</div>`
              : ''
          }
          <div class="med__row">
            ${
              m.stoppedAt
                ? ghost('med-resume', m.id, MEDS_RESUME)
                : `${ghost('med-edit', m.id, MEDS_EDIT)}${ghost('med-stop', m.id, MEDS_STOP)}`
            }
          </div>
        </div>`;
    };

    const form = () => {
      if (!medEdit) {
        return `<button class="btn btn--primary" data-act="med-add">${esc(MEDS_ADD)}</button>`;
      }
      const m = medEdit === 'new' ? null : data.meds.find((x) => x.id === medEdit);
      const last = m ? lastChange(m) : null;
      const name = medDraft?.name ?? m?.name ?? '';
      const how = medDraft?.how ?? last?.how ?? '';
      const d = medDraft?.d || dayKey();
      return `
        <div class="medform">
          <label class="field" for="med-name">
            <span>${esc(MED_NAME_LABEL)}</span>
            <input id="med-name" value="${esc(name)}"
              placeholder="${esc(MED_NAME_PLACEHOLDER)}">
          </label>
          <label class="field" for="med-how">
            <span>${esc(MED_HOW_LABEL)}</span>
            <input id="med-how" value="${esc(how)}"
              placeholder="${esc(MED_HOW_PLACEHOLDER)}">
          </label>
          <label class="field" for="med-date">
            <span>${esc(MED_SINCE_LABEL)}</span>
            <input id="med-date" type="date" value="${esc(d)}">
          </label>
          <div class="chips" role="group" aria-label="${esc(MED_MODE_LABEL)}">
            <button class="chip ${medMode === 'regular' ? 'on' : ''}"
              data-act="med-mode" data-mode="regular">${esc(MED_MODE_REGULAR)}</button>
            <button class="chip ${medMode === 'asneeded' ? 'on' : ''}"
              data-act="med-mode" data-mode="asneeded">${esc(MED_MODE_ASNEEDED)}</button>
          </div>
          ${
            medMode === 'regular'
              ? `<div class="chips" role="group" aria-label="${esc(MED_SLOTS_LABEL)}">
            <button class="chip ${medSlots === 'once' ? 'on' : ''}"
              data-act="med-slots" data-slots="once">${esc(MED_SLOTS_ONCE)}</button>
            <button class="chip ${medSlots === 'twice' ? 'on' : ''}"
              data-act="med-slots" data-slots="twice">${esc(MED_SLOTS_TWICE)}</button>
          </div>`
              : ''
          }
          <button class="btn btn--primary" data-act="med-save">${esc(MEDS_SAVE)}</button>
          <button class="btn btn--ghost btn--small" data-act="med-cancel">
            ${esc(MEDS_CANCEL)}
          </button>
        </div>`;
    };

    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">дневник</div>
          <h1>${esc(MEDS_TITLE)}</h1>
          <p class="lead">${esc(MEDS_LEAD)}</p>
        </header>
        ${featureOn('medsExpect') ? `<div class="note">${esc(MEDS_EXPECT)}</div>` : ''}
        ${statusBlock()}
        ${active.map(row).join('')}
        ${!data.meds.length ? `<div class="empty">${esc(MEDS_EMPTY)}</div>` : ''}
        ${form()}
        ${
          stopped.length
            ? `<div class="meds__h">${esc(MEDS_STOPPED_TITLE)}</div>${stopped.map(row).join('')}`
            : ''
        }
        <div class="safety">${esc(AFTER_MEDS_CARD)}</div>
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
                <span class="card__chev" aria-hidden="true">›</span>
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
    // Два пути наружу, порядок один на всех устройствах: текст копии —
    // главный (он работает всегда), скачивание — второй. Системного листа
    // здесь нет: на её телефоне он отвечает отказом независимо от типа файла.
    const copyPrimary = `<button class="btn btn--primary" data-act="export-copy-text">${esc(EXPORT_COPY_BUTTON)}</button>`;
    const download = `<button class="btn" data-act="export-download">${esc(EXPORT_DOWNLOAD_BUTTON)}</button>`;
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
          ${copyPrimary}
          ${download}
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
          Поэтому есть копия. Первый, главный путь: «Скопировать текст копии» —
          и вставить в переписку. Второй: «Скачать файл» на компьютер или в «Файлы»
          телефона.
        </p>
        <p class="muted small">${esc(ABOUT_SCHEMA_NOTE)}</p>
        <p class="muted small">
          Что появилось в этой версии: фразы близким можно править, а свою —
          добавить и убрать. После перезапуска приложение возвращает туда,
          где остановились, и не теряет начатую запись.
          Это не лечение, а способы пережить минуту.
        </p>
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
      <span class="card__chev" aria-hidden="true">›</span>
    </button>`;
}

function contactLink(c, showNumber = false) {
  return `
    <a class="contact" href="tel:${esc(dialable(c.phone))}">
      <div class="contact__body">
        <div class="contact__name">${esc(c.label)}</div>
        ${showNumber ? `<div class="contact__num">${esc(prettyPhone(c.phone))}</div>` : ''}
        ${c.note ? `<div class="contact__note">${esc(c.note)}</div>` : ''}
      </div>
      <div class="contact__call">позвонить</div>
    </a>`;
}

/** Номер для глаза: 8 495 989-50-50. Данные не меняются — только подпись. */
function prettyPhone(p) {
  const d = dialable(p);
  return /^8\d{10}$/.test(d)
    ? `8 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`
    : d;
}

/**
 * «Как спалось»: строки, которые человек сам заполнил. Нет строк — нет
 * блока: пустая рамка «здесь будет ваша статистика» была бы заданием.
 * Ни средних, ни нормы, ни «N из 14».
 */
function sleepHistoryBlock() {
  // Выключенный флаг не читает записи вовсе: блок не создаётся, а не
  // создаётся пустым.
  if (!featureOn('sleepHistory')) return '';
  const rows = sleepLines(data.entries, {
    line: SLEEP_LINE,
    nap: SLEEP_NAP_LINE,
    napLine: SLEEP_NAP_H_LINE,
  });
  if (!rows.length) return '';
  return `
    <section class="sleeplog">
      <h2 class="section">${esc(SLEEP_HISTORY_TITLE)}</h2>
      <p class="hint">${esc(SLEEP_HISTORY_HINT)}</p>
      ${rows
        .map(
          (r) =>
            `<div class="sleeplog__row">${
              r.d ? `<span class="sleeplog__d">${esc(fmtDay(r.d))}</span> · ` : ''
            }${esc(r.text)}</div>`,
        )
        .join('')}
    </section>`;
}

/**
 * «Первый шаг к врачу»: что сказать и что взять. Это не совет лечиться и не
 * обещание, что там помогут, — только слова, которые человек может взять
 * своими. Ни адресов, ни сроков: их нельзя подтвердить.
 */
function firstStepBlock() {
  return `
    <section class="msgs">
      <h2 class="msgs__title">${esc(FIRST_STEP_TITLE)}</h2>
      <p class="msgs__hint">${esc(FIRST_STEP_LEAD)}</p>
      <ul class="msgs__hint">${FIRST_STEP_SAY.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <h3 class="msgs__sub">${esc(FIRST_STEP_TAKE_TITLE)}</h3>
      <ul class="msgs__hint">${FIRST_STEP_TAKE.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="msgs__hint">${esc(FIRST_STEP_NOTE)}</p>
    </section>`;
}

/**
 * «Если звонить некому». Номера берутся не из головы, а из DEFAULT_CONTACTS
 * по белому списку: 112 и линия МЧС. Своих записей этот блок не читает —
 * иначе он показывал бы то, что человек сам стёр.
 */
function noOneBlock() {
  const verified = DEFAULT_CONTACTS.filter((c) => NO_ONE_PHONES.includes(c.phone));
  return `
    <section class="msgs">
      <h2 class="msgs__title">${esc(NO_ONE_TITLE)}</h2>
      <p class="msgs__hint">${esc(NO_ONE_TEXT)}</p>
      ${verified.map((c) => contactLink(c, true)).join('')}
      <p class="msgs__hint">${esc(NO_ONE_LETTER)}</p>
      <button class="btn btn--ghost" data-act="go" data-screen="skill" data-id="letter">
        Письмо, которое не отправится
      </button>
    </section>`;
}

/**
 * Встроенные фразы, которые вообще есть в этой сборке: три под флагом,
 * шесть с ним. Скрытая фраза остаётся здесь — иначе её не вернуть.
 */
function baseMessages() {
  return featureOn('messagesExtra') ? MESSAGES : MESSAGES.slice(0, 3);
}

/**
 * Фразы, которые видно сейчас: встроенные (под флагом) с правками и свои.
 * Список один для экрана и для копирования — иначе тап копировал бы
 * исходный текст вместо исправленного.
 */
function visibleMessages() {
  return messageList(baseMessages(), data.messages);
}

/** Текст ошибки правки по коду из messages.js. */
function msgErrorText(code) {
  if (code === MESSAGE_EMPTY) return MESSAGES_EMPTY;
  if (code === MESSAGE_LONG) return MESSAGES_LONG.replace('{n}', MESSAGE_MAX);
  if (code === MESSAGE_LIMIT) return MESSAGES_LIMIT.replace('{n}', OWN_MAX);
  return '';
}

/** Поле правки: ввод живёт в msgText, как и текст письма в data.letter. */
function bindMsgField() {
  const field = document.getElementById('msg-text');
  if (!field) return;
  field.addEventListener('input', () => {
    msgText = field.value;
    msgError = '';
  });
}

function focusMsgField() {
  requestAnimationFrame(() => {
    const field = document.getElementById('msg-text');
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  });
}

/**
 * Строка фразы: тап по тексту копирует, карандаш справа открывает правку.
 * Раньше правка и удаление были подписями под текстом — карточка выглядела
 * как форма. Карандаш — одна цель 44 px, подпись для чтения с экрана.
 */
const PENCIL = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M4 20v-3.7L15.6 4.7a2.2 2.2 0 0 1 3.1 0l0.6 0.6a2.2 2.2 0 0 1 0 3.1L7.7 20H4Z" />
  <path d="M14.4 5.9l3.7 3.7" />
</svg>`;

function msgRow(m) {
  return `
    <div class="msg">
      <button class="msg__copy" data-act="copy" data-id="${esc(m.id)}">
        ${
          m.own
            ? `<span class="msg__own">${esc(MESSAGES_OWN_LABEL)}</span>`
            : `<span class="msg__label">${esc(m.label)}${
                m.edited ? `<span class="msg__edited">${esc(MESSAGES_EDITED_LABEL)}</span>` : ''
              }</span>`
        }
        <span class="msg__text">${esc(m.text)}</span>
        <span class="msg__state" data-state="${esc(m.id)}"></span>
      </button>
      <button class="msg__act msg__act--icon" data-act="msg-edit" data-id="${esc(m.id)}"
        aria-label="${esc(`${MESSAGES_EDIT}: ${m.own ? MESSAGES_OWN_LABEL : m.label}`)}">
        ${PENCIL}
      </button>
    </div>`;
}

/**
 * Правка: поле, потолок рядом и действия. «Удалить» есть у каждой фразы —
 * своя исчезает совсем, встроенная прячется в данные и возвращается
 * строкой под списком. «Вернуть как было» — только у изменённой.
 * У новой фразы «Удалить» нет: удалять ещё нечего, поле закрывается
 * «Отменой» (иначе это была бы кнопка, которая молча ничего не делает).
 */
function msgEditor(m) {
  const title = m ? (m.own ? MESSAGES_OWN_LABEL : m.label) : MESSAGES_OWN_LABEL;
  const id = m && !m.own ? ` data-id="${esc(m.id)}"` : '';
  return `
    <div class="msg msg--edit">
      <div class="msg__label">${esc(title)}</div>
      <label class="msg__editlabel" for="msg-text">${esc(MESSAGES_EDIT_LABEL)}</label>
      <textarea id="msg-text" rows="3" maxlength="${MESSAGE_MAX}">${esc(msgText)}</textarea>
      <p class="muted small msg__hintline">${
        msgError ? esc(msgError) : esc(MESSAGES_MAX_HINT.replace('{n}', MESSAGE_MAX))
      }</p>
      <div class="msg__acts">
        <button class="msg__act msg__act--main" data-act="msg-save">${esc(MESSAGES_SAVE)}</button>
        <button class="msg__act" data-act="msg-cancel">${esc(MESSAGES_CANCEL)}</button>
      </div>
      ${
        m
          ? `<div class="msg__acts msg__acts--foot">
               <button class="msg__act msg__act--danger"${id} data-act="msg-del">${esc(
                 MESSAGES_DELETE,
               )}</button>
               ${
                 m.edited
                   ? `<button class="msg__act" data-act="msg-reset">${esc(MESSAGES_RESET)}</button>`
                   : ''
               }
             </div>`
          : ''
      }
    </div>`;
}

function messagesBlock() {
  const list = visibleMessages();
  const editing = list.find((m) => m.id === msgEdit);
  const hidden = hiddenBuiltins(baseMessages(), data.messages).length;
  return `
    <section class="msgs">
      <h2 class="msgs__title">${esc(MESSAGES_TITLE)}</h2>
      <p class="msgs__hint">${esc(MESSAGES_HINT)}</p>
      <div class="msgs__list">
        ${list.map((m) => (msgEdit === m.id ? msgEditor(m) : msgRow(m))).join('')}
        ${msgEdit === 'new' ? msgEditor(editing) : ''}
      </div>
      ${
        hidden
          ? `<div class="msgs__hidden">
               <span>${esc(MESSAGES_HIDDEN.replace('{n}', hidden))}</span>
               <button class="msg__act" data-act="msg-restore">${esc(MESSAGES_HIDDEN_BACK)}</button>
             </div>`
          : ''
      }
      ${
        msgEdit === 'new'
          ? ''
          : `<button class="msg__act msgs__add" data-act="msg-new">
               <i aria-hidden="true">+</i>${esc(MESSAGES_ADD)}
             </button>`
      }
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
  // факт импорта — в журнал: по выгрузке видно, что копию принимали.
  // Событие добавляется после слияния и уже не может быть в чужой копии.
  journal('import_made');
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
 * Текст копии. Один и тот же для обоих путей наружу: файл и буфер.
 * Копия одна — всё заполненное, включая журнал и память о навыках.
 * Она не зашифрована — так и подписана на экране.
 */
function buildCopy() {
  return JSON.stringify(buildExport(data, SITE_VERSION, new Date()));
}

/**
 * Файл копии: имя латиницей и дата, без русских слов — файл может уехать
 * в чужой чат, и имя должно открываться на любом устройстве.
 */
function copyFile(text) {
  return new File([text], exportName(new Date()), { type: 'application/json' });
}

function makeCopyFile(text) {
  const file = copyFile(text);
  return { name: file.name, file };
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

/**
 * Строка диагностики — построчно, без догадок: в каком окне открыто
 * приложение, какой движок и сколько точек касания. Строк про системный
 * лист здесь нет: пути, который они описывали, больше нет.
 */
function debugBlock() {
  if (!debugEnabled()) return '';
  const lines = [
    `оболочка: ${shellOf(navigator.userAgent, isStandalone)}`,
    `движок: ${engineOf(navigator.userAgent)}`,
    `maxTouchPoints: ${navigator.maxTouchPoints ?? '?'}`,
  ];
  return `
    <div class="debug">
      <div>${esc(EXPORT_DEBUG)}</div>
      ${lines.map((l) => `<div>${esc(l)}</div>`).join('')}
    </div>`;
}

/**
 * Доставка. У обоих путей одно общее: копия собирается из текущих
 * данных и уходит целиком. Обрезки и «почти отправили» нет.
 */

/** Текст копии в буфер: работает и там, где файл не уходит. */
async function copyExportText() {
  // копия собирается до записи о копии: иначе событие попало бы в неё же
  const ok = await copyText(buildCopy());
  notice = ok ? EXPORT_COPY_DONE : EXPORT_COPY_FAILED;
  if (ok) journal('export_made');
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
    journal('export_made');
  } catch {
    notice = EXPORT_FAILED;
  }
  render();
}

/* ------------------------------------------------------------------ */
/*  Живые экраны                                                       */
/* ------------------------------------------------------------------ */

const MOUNT = {
  /**
   * Поле правки фразы: текст держим в msgText, а не в DOM — экран
   * перерисовывается на каждое действие, и ввод иначе пропадал бы.
   */
  home() {
    bindMsgField();
  },

  contacts() {
    bindMsgField();
  },

  breath(id) {
    if (!id || !BREATHS[id]) return;
    startBreath(id);
  },

  timer(id) {
    const s = SKILLS[id];
    const total = (s?.start?.minutes ?? 1) * 60;
    startTimer(total);
  },

  /**
   * «Пройти план» с клавиатуры: открыли — фокус на «Дальше», дальше Enter.
   * Без этого после открытия фокус остался бы на кнопке прошлого экрана,
   * которой уже нет в документе.
   */
  plan() {
    requestAnimationFrame(() => {
      view.querySelector('[data-act="plan-next"]')?.focus();
    });
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
    // Ввод сразу уходит в данные: перезапуск страницы не должен уносить
    // набранное. Поле записи — не черновик «на потом», а та же запись,
    // которую человек уже начал, поэтому цена сохранения того стоит.
    const note = document.getElementById('note');
    if (note) {
      note.addEventListener('input', () => {
        draft.note = note.value;
        saveDraft();
      });
    }
    // сон — необязательное поле: оно не подсвечивается и ничего не требует
    const sleep = document.getElementById('sleep-h');
    if (sleep) {
      sleep.addEventListener('input', () => {
        draft.sleepH = sleep.value;
        saveDraft();
      });
    }
    const napH = document.getElementById('sleep-nap-h');
    if (napH) {
      napH.addEventListener('input', () => {
        draft.napH = napH.value;
        saveDraft();
      });
    }
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
      if (el.dataset.screen !== 'meds') {
        medEdit = null;
        medDraft = null;
      }
      // правка фразы живёт только там, где фразы видны: ушли — она закрыта
      if (!['home', 'contacts'].includes(el.dataset.screen)) {
        msgEdit = null;
        msgText = '';
        msgError = '';
      }
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
      // копируется то, что видно: исправленная или своя фраза, а не исходник
      const msg = visibleMessages().find((m) => m.id === id);
      if (!msg) break;
      const ok = await copyText(msg.text);
      if (ok) journal('message_copy', { id: msg.id });
      const state = el.querySelector('.msg__state');
      if (state) {
        state.textContent = ok ? MESSAGES_COPIED : MESSAGES_FAILED;
        setTimeout(() => {
          if (state.isConnected) state.textContent = '';
        }, 2500);
      }
      break;
    }

    /* --------------------- правка фраз близким ------------------- */

    case 'msg-edit': {
      const msg = visibleMessages().find((m) => m.id === id);
      if (!msg) break;
      msgEdit = msg.id;
      msgText = msg.text;
      msgError = '';
      render();
      focusMsgField();
      break;
    }

    case 'msg-new':
      if (ownFull(data.messages)) {
        notice = msgErrorText(MESSAGE_LIMIT);
        render();
        break;
      }
      msgEdit = 'new';
      msgText = '';
      msgError = '';
      notice = '';
      render();
      focusMsgField();
      break;

    case 'msg-cancel':
      msgEdit = null;
      msgText = '';
      msgError = '';
      render();
      break;

    case 'msg-save': {
      if (msgEdit === null) break;
      const now = Date.now();
      // «Сохранить» без единой правки — не правка: фраза остаётся
      // встроенной, и «изменено» не появляется из ниоткуда.
      const raw = baseMessages().find((m) => m.id === msgEdit);
      const sameAsBuiltin = Boolean(raw) && raw.text.trim() === msgText.trim();
      const result =
        msgEdit === 'new'
          ? addOwn(data.messages, msgText, now)
          : sameAsBuiltin
            ? { ok: true, messages: resetBuiltin(data.messages, msgEdit, now) }
            : saveBuiltin(data.messages, msgEdit, msgText, now);
      if (!result.ok) {
        // отказ не закрывает поле: текст остаётся, причина — рядом
        msgError = msgErrorText(result.error);
        render();
        focusMsgField();
        break;
      }
      data.messages = result.messages;
      msgEdit = null;
      msgText = '';
      msgError = '';
      save();
      render();
      break;
    }

    case 'msg-del': {
      // «Удалить» живёт только в правке. Своя фраза исчезает совсем,
      // встроенная прячется: её текст остаётся в коде и возвращается
      // строкой «Скрытых фраз».
      if (msgEdit === null) break;
      if (msgEdit !== 'new') data.messages = removeMessage(data.messages, msgEdit, Date.now());
      msgEdit = null;
      msgText = '';
      msgError = '';
      save();
      render();
      break;
    }

    case 'msg-reset': {
      if (!msgEdit || msgEdit === 'new') break;
      data.messages = resetBuiltin(data.messages, msgEdit, Date.now());
      msgEdit = null;
      msgText = '';
      msgError = '';
      save();
      render();
      break;
    }

    case 'msg-restore': {
      // Вернуть все скрытые разом: список открывается в трудную минуту,
      // разбираться по одной в нём не с руки.
      const ids = hiddenBuiltins(baseMessages(), data.messages).map((m) => m.id);
      if (!ids.length) break;
      data.messages = restoreHidden(data.messages, ids, Date.now());
      save();
      render();
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
      data.draft = draftSnapshot();
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

    case 'card-save': {
      for (const f of CRISIS_FIELDS) {
        const el2 = document.getElementById('f-' + f.key);
        data.card[f.key] = el2 ? el2.value.trim() : '';
      }
      // «Что убрать подальше» необязательно: пустое поле ключ не заводит,
      // чтобы старая карточка не обрастала пустыми строками. Выключенный
      // флаг не читает поле и не трогает уже сохранённое значение.
      if (featureOn('cardAway')) {
        const away = (document.getElementById('f-away')?.value || '').trim();
        if (away) data.card.away = away;
        else delete data.card.away;
      }
      data.cardTs = Date.now();
      save();
      journal('card_saved');
      cardEdit = false;
      render();
      break;
    }

    case 'plan-start':
      if (!featureOn('cardPlan')) break;
      planStep = 0;
      go('plan');
      break;

    case 'plan-next': {
      if (!featureOn('cardPlan')) break;
      const steps = planSteps(data.card.plan);
      if (!steps.length) {
        go('card');
        break;
      }
      if (planStep >= steps.length - 1) {
        planStep = 0;
        go('card');
      } else {
        planStep += 1;
        render();
      }
      break;
    }

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
      // «добавил свой номер» — это действие; чем чаще звонили по нему —
      // не пишем никогда, и текст контакта в журнал не попадает.
      const was = data.contacts.filter((c) => c.label || c.phone).length;
      data.contacts = next.filter((c) => c.label || c.phone);
      data.contactsTs = Date.now();
      save();
      if (data.contacts.length > was) journal('contact_added');
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
      saveDraft();
      render();
      break;

    case 'tag': {
      const t = el.dataset.tag;
      if (draft.tags.has(t)) draft.tags.delete(t);
      else draft.tags.add(t);
      saveDraft();
      render();
      break;
    }

    case 'sleep-nap':
      // черновик уже держит введённые часы: input обновляет draft.sleepH
      draft.nap = !draft.nap;
      // выключили — блок исчез, и часы дня больше не утверждение
      if (!draft.nap) draft.napH = '';
      saveDraft();
      render();
      break;

    case 'save-entry': {
      if (!draft.mood) {
        el.textContent = 'Сначала выбери, как ты';
        setTimeout(() => {
          el.textContent = 'Сохранить';
        }, 1600);
        break;
      }
      const now = Date.now();
      const entry = {
        t: now,
        ts: now,
        mood: draft.mood,
        tags: [...draft.tags],
        note: draft.note.trim(),
        helped: draftHelped(now),
      };
      // Сон необязателен. Пустое поле — это не «0 часов»: поля просто нет.
      // 0, введённый руками, — наоборот, утверждение, и он сохраняется.
      const hRaw = (document.getElementById('sleep-h')?.value || '').trim();
      const h = hRaw === '' ? null : Number(hRaw.replace(',', '.'));
      if (h !== null && Number.isFinite(h) && h >= 0 && h <= 24) entry.sleepH = h;
      if (draft.nap === true) {
        entry.nap = true;
        // Часы дневного сна — только вместе с галочкой: без неё это
        // не «дневной сон», а непонятное число.
        const napRaw = (document.getElementById('sleep-nap-h')?.value || '').trim();
        const napH = napRaw === '' ? null : Number(napRaw.replace(',', '.'));
        if (napH !== null && Number.isFinite(napH) && napH >= 0 && napH <= 24) {
          entry.napH = napH;
        }
      }

      data.entries.push(entry);
      // запись сохранена — черновик очищается, и очистка старше прежнего
      // черновика: иначе вторая копия вернула бы набранное
      clearDraft();
      save();
      // только факт: ни настроения, ни меток, ни заметки в журнале нет
      journal('entry_saved');
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
      saveDraft();
      render();
      break;

    /* --------------------------- приём ---------------------------- */

    case 'mark':
      // Строка одна: отметка ставится тому препарату, по которому нажали,
      // а повторный тап тем же состоянием снимает её — нажавшая не то
      // не должна оказаться запертой.
      data.marks = toggleMed(
        data.marks,
        dayKey(),
        el.dataset.med,
        el.dataset.slot || '',
        el.dataset.state,
        Date.now(),
      );
      save();
      // id препарата — обезличенный ключ («m1c3…»): названия в журнале нет
      journal('mark_set', { id: el.dataset.med });
      render();
      break;

    case 'med-add':
      medEdit = 'new';
      medMode = 'regular';
      medSlots = 'once';
      medDraft = null;
      notice = '';
      render();
      revealMedForm();
      break;

    case 'med-cancel':
      medEdit = null;
      medDraft = null;
      notice = '';
      render();
      break;

    case 'med-edit': {
      const m = data.meds.find((x) => x.id === id);
      if (!m) break;
      medEdit = m.id;
      medMode = m.mode;
      medSlots = slotsOf(m).length ? 'twice' : 'once';
      medDraft = null;
      notice = '';
      render();
      revealMedForm();
      break;
    }

    case 'med-mode':
      // перерисовка не должна стереть уже набранное в форме
      medDraft = {
        name: document.getElementById('med-name')?.value || '',
        how: document.getElementById('med-how')?.value || '',
        d: document.getElementById('med-date')?.value || '',
      };
      medMode = el.dataset.mode === 'asneeded' ? 'asneeded' : 'regular';
      render();
      break;

    case 'med-slots':
      // перерисовка не должна стереть уже набранное в форме
      medDraft = {
        name: document.getElementById('med-name')?.value || '',
        how: document.getElementById('med-how')?.value || '',
        d: document.getElementById('med-date')?.value || '',
      };
      medSlots = el.dataset.slots === 'twice' ? 'twice' : 'once';
      render();
      break;

    case 'med-save': {
      const name = (document.getElementById('med-name')?.value || '').trim();
      const how = (document.getElementById('med-how')?.value || '').trim();
      const dInput = (document.getElementById('med-date')?.value || '').trim();
      const d = /^\d{4}-\d{2}-\d{2}$/.test(dInput) ? dInput : dayKey();
      if (!name) {
        notice = MED_NAME_EMPTY;
        render();
        break;
      }
      const ts = Date.now();
      const medId = medEdit === 'new' ? 'm' + ts.toString(36) : medEdit;
      // «Утром и вечером» — только у регулярного приёма. У «по необходимости»
      // отметок нет, поэтому и приёмов в данных нет.
      const slots =
        medMode === 'regular' && medSlots === 'twice' ? ['morning', 'evening'] : [];
      if (medEdit === 'new') {
        data.meds.push({
          id: medId,
          name,
          changes: [{ d, how }],
          mode: medMode,
          slots,
          stoppedAt: '',
          ts,
        });
      } else {
        const m = data.meds.find((x) => x.id === medEdit);
        if (m) {
          const prevHow = lastChange(m)?.how || '';
          m.name = name;
          m.mode = medMode;
          m.slots = slots;
          m.ts = ts;
          // Пустая правка не рождает строку в истории схемы.
          if (how !== prevHow) {
            const at = m.changes.findIndex((c) => c.d === d);
            if (at >= 0) m.changes[at] = { ...m.changes[at], how };
            else m.changes.push({ d, how });
            m.changes.sort((a, b) => String(a.d).localeCompare(String(b.d)));
          }
        }
      }
      medEdit = null;
      medDraft = null;
      notice = '';
      save();
      // название препарата и доза в журнал не идут: только id и факт
      journal('med_change', { id: medId });
      render();
      break;
    }

    case 'med-stop': {
      const m = data.meds.find((x) => x.id === id);
      if (m) {
        // «Убрать» не удаляет: иначе вместе с препаратом пропали бы отметки
        m.stoppedAt = dayKey();
        m.ts = Date.now();
        save();
        journal('med_change', { id });
      }
      render();
      break;
    }

    case 'med-resume': {
      const m = data.meds.find((x) => x.id === id);
      if (m) {
        m.stoppedAt = '';
        m.ts = Date.now();
        save();
        journal('med_change', { id });
      }
      render();
      break;
    }

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
//
// Перезапуск страницы (обновление service worker, возврат в приложение,
// перезагрузка вкладки) начинается с нового документа: память экрана
// не переживает его, поэтому место запоминается в данных. Возвращаемся
// на целый экран, а не в середину действия: сессию дыхания, таймер,
// шаг развилки и открытую форму не восстанавливаем.
const resumed = (() => {
  const saved = data.resume;
  if (!saved || !saved.ts) return null;
  const screen = resumeScreen(saved.name, saved.id);
  if (!screen) return null;
  if (screen.name === 'skill' && !SKILLS[screen.id]) return null;
  return screen;
})();

if (resumed) {
  current = resumed;
  // восстановленный экран — не действие человека: журнал его не пишет,
  // а сессия навыка не начинается заново с перезагрузки
  shown = { name: current.name, id: current.id ?? null };
  if (isTabRoot(resumed.name, resumed.id)) {
    window.history.replaceState(stateOf(current), '');
  } else {
    // Экран внутри без записи в истории оставил бы «‹ назад» без адреса:
    // под ним кладём ту вкладку, откуда такие экраны открываются.
    const parent = resumeParent(resumed.name);
    nav = [parent];
    window.history.replaceState(stateOf(parent), '');
    window.history.pushState(stateOf(current), '');
  }
  activeTab = TAB_OF[current.name] ?? TAB_OF[resumeParent(current.name).name] ?? 'home';
} else {
  window.history.replaceState(stateOf(current), '');
}

render();

// вторая копия: читаем IndexedDB и сливаем уже после первого экрана,
// чтобы приложение открывалось мгновенно
hydrate();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
