/**
 * Копия данных: слияние двух хранилищ, экспорт и импорт.
 *
 * Только чистые функции: без DOM, без сети, без localStorage и без
 * IndexedDB. Поэтому их можно проверять в node, а не глазами.
 *
 * Формат данных v0.3.0 — те же поля, что раньше, плюс отметки времени:
 *   cardTs, contactsTs, letterTs — когда менялся блок;
 *   entries[].ts                 — когда сделана запись (у старых берётся t);
 *   help[id].ts                  — когда последний раз оценивали навык;
 *   ts                           — когда сохраняли всё целиком.
 * Старые данные без этих полей читаются как есть и считаются самыми
 * старыми (ts = 0).
 *
 * С 0.6.0 у записи есть entries[].helped — id навыков, которые тогда
 * помогли. Это данные записи, а не счётчик: время отметки живёт только
 * в черновике и в хранилище не попадает.
 */

export const APP = 'opora';

// Версия формата данных и файла копии. Меняется только при несовместимой
// правке структуры; каждая версия схемы обязана иметь миграцию ниже.
// Схема 1 — всё до 0.5.0 (номера в данных не было), схема 2 — номер есть,
// неизвестные поля сохраняются на всех уровнях, схема 3 — у записи есть
// список навыков, которые тогда помогли (helped), схема 4 — препараты
// (meds), отметки приёма (marks) и сон в записи (sleepH, nap).
export const SCHEMA_VERSION = 4;

/**
 * Миграции по одной ступени: ключ — схема, из которой переходим.
 * Функция получает данные как есть и возвращает новые; ничего не теряет.
 */
const MIGRATIONS = {
  // 0.1.0–0.4.0 → 0.5.0. Поля не менялись: впервые появляется номер схемы
  // и правило «неизвестное не выбрасывать» (его делает normalize).
  1: (data) => ({ ...data, schema: 2 }),
  // 0.5.0 → 0.6.0. У записи появляется список навыков, которые помогли.
  // У старых записей он пуст: отметок тогда не было, выдумывать нечего.
  // Если в данных он всё же есть — сохраняем, а не затираем.
  2: (data) => ({
    ...data,
    schema: 3,
    entries: Array.isArray(data.entries)
      ? data.entries.map((e) => (obj(e) ? { ...e, helped: helpedList(e.helped) } : e))
      : data.entries,
  }),
  // 0.7.x → 0.8.0. Появляются препараты и отметки приёма. У старых данных
  // их нет — пустые массивы, и это правда: списка не было. Записям НЕ
  // добавляются sleepH и nap: «0 часов сна» и «днём не спала» —
  // утверждения, которых человек не делал. Отсутствует — значит не
  // спрашивали, и в отчёте этой строки просто нет.
  3: (data) => ({
    ...data,
    schema: 4,
    meds: Array.isArray(data.meds) ? data.meds : [],
    marks: Array.isArray(data.marks) ? data.marks : [],
  }),
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);

const txt = (v) => (typeof v === 'string' ? v : '');

/** Номер схемы в данных: нет поля или мусор — считаем первой схемой. */
export function schemaOf(raw) {
  const src = obj(raw) || {};
  const n = Number(src.schema);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * Приведение к текущей схеме. Возвращает { data, schema, notes, newer }.
 * Схема новее нашей — данные не трогаем и говорим об этом: приложение
 * из будущего могло положить поля, которых мы не понимаем.
 */
export function migrate(raw) {
  let data = obj(raw) || {};
  let schema = schemaOf(data);
  const notes = [];

  if (schema > SCHEMA_VERSION) {
    return {
      data: normalize(data),
      schema,
      notes: [`схема ${schema} новее ${SCHEMA_VERSION}: данные не тронуты`],
      newer: true,
    };
  }

  while (schema < SCHEMA_VERSION) {
    const step = MIGRATIONS[schema];
    if (!step) {
      notes.push(`нет миграции ${schema} → ${schema + 1}: данные оставлены как есть`);
      break;
    }
    data = step(data);
    notes.push(`схема ${schema} → ${schema + 1}`);
    schema += 1;
  }

  return { data: normalize({ ...data, schema }), schema, notes, newer: false };
}

/* ------------------------------------------------------------------ */
/*  Что прочиталось из хранилища                                       */
/* ------------------------------------------------------------------ */

export const STORAGE_EMPTY = 'empty';
export const STORAGE_OK = 'ok';
export const STORAGE_BAD = 'corrupt';

/**
 * Разбор сырой строки из localStorage. Битый JSON — не «пусто»: его нельзя
 * молча затирать следующим сохранением, поэтому сырьё возвращается наружу.
 */
export function readStored(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { kind: STORAGE_EMPTY, raw: '' };
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return { kind: STORAGE_BAD, raw };
  }
  if (!obj(value)) return { kind: STORAGE_BAD, raw };
  return { kind: STORAGE_OK, raw, value };
}

/** Куда откладывается повреждённая строка: opora.corrupt.<эпоха>. */
export function quarantineKey(epoch = Date.now()) {
  return `opora.corrupt.${Number(epoch) || 0}`;
}

/* ------------------------------------------------------------------ */
/*  Честный результат сохранения                                       */
/* ------------------------------------------------------------------ */

export const SAVE_OK = 'ok';
export const SAVE_FAILED = 'failed';

/**
 * Записалось ли хоть куда-нибудь. Оба хранилища — localStorage и IndexedDB;
 * если не приняло ни одно, человек должен это увидеть, а не узнать потом.
 */
export function saveOutcome({ local = false, db = false } = {}) {
  return local || db ? SAVE_OK : SAVE_FAILED;
}

const totalOf = (c) => num(c?.yes) + num(c?.no) + num(c?.idk);

/** Поле карточки заполнено? Пустая карточка — это не данные. */
const cardEmpty = (card) =>
  !card || !Object.values(card).some((v) => String(v ?? '').trim() !== '');

/**
 * Список навыков, которые помогли: только непустые строки, без дублей,
 * порядок сохраняется. Мусор (не массив, числа, объекты) — пустой список.
 * Незнакомые id не выбрасываем: навык могли убрать, а запись остаётся правдой.
 */
function helpedList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

function toEntry(e) {
  const given = num(e.ts) || num(e.t);
  // sleepH и nap НЕ заполняются по умолчанию: отсутствие — это «не
  // спрашивали», а не «0 часов» и не «днём не спала».
  return { ...e, t: num(e.t) || given, ts: given, helped: helpedList(e.helped) };
}

/** Режим приёма: ровно два. Третьего («иногда») нет — он ничего не значит. */
export const MED_MODES = ['regular', 'asneeded'];

/** Приёмы: ключи латиницей, слова («утро», «вечер») — в content.js. */
export const MED_SLOTS = ['morning', 'evening'];

/** Состояние отметки: ровно два. «Нет отметки» выводится из отсутствия записи. */
export const MARK_STATES = ['taken', 'skipped'];

function toChange(c) {
  return { ...c, d: txt(c.d), how: txt(c.how) };
}

function toMed(m) {
  return {
    ...m,
    id: txt(m.id),
    name: txt(m.name),
    changes: Array.isArray(m.changes) ? m.changes.filter(obj).map(toChange) : [],
    mode: MED_MODES.includes(m.mode) ? m.mode : 'regular',
    slots: Array.isArray(m.slots) ? [...new Set(m.slots.filter((s) => MED_SLOTS.includes(s)))] : [],
    stoppedAt: txt(m.stoppedAt),
    ts: num(m.ts),
  };
}

function toMark(k) {
  // state не подменяем на «taken»: выдуманная отметка хуже отсутствующей.
  // slot '' — прежняя отметка дня целиком, так выглядят все отметки до 0.9.1.
  return {
    ...k,
    d: txt(k.d),
    med: txt(k.med),
    slot: txt(k.slot),
    state: txt(k.state),
    ts: num(k.ts),
  };
}

/**
 * Приводит любые прочитанные данные к известной форме. Не меняет вход.
 * Это именно приведение типов, а не миграция: неизвестные поля остаются
 * на всех уровнях (верхний, card, записи, контакты, help[id], препараты),
 * иначе копия из будущей версии потеряла бы данные при следующем сохранении.
 */
export function normalize(raw) {
  const src = obj(raw) || {};

  const entries = Array.isArray(src.entries) ? src.entries.filter(obj).map(toEntry) : [];

  const help = {};
  if (obj(src.help)) {
    for (const [id, value] of Object.entries(src.help)) {
      const c = obj(value);
      if (!c) continue;
      help[id] = { ...c, yes: num(c.yes), no: num(c.no), idk: num(c.idk), ts: num(c.ts) };
    }
  }

  return {
    ...src,
    schema: schemaOf(src),
    card: obj(src.card) ? { ...src.card } : {},
    cardTs: num(src.cardTs),
    contacts: Array.isArray(src.contacts) ? src.contacts.filter(obj).map((c) => ({ ...c })) : [],
    contactsTs: num(src.contactsTs),
    entries,
    meds: Array.isArray(src.meds) ? src.meds.filter(obj).map(toMed) : [],
    marks: Array.isArray(src.marks) ? src.marks.filter(obj).map(toMark) : [],
    letter: txt(src.letter),
    letterTs: num(src.letterTs),
    help,
    ts: num(src.ts),
  };
}

const entryKey = (e) => {
  const ts = num(e.ts);
  if (ts > 0) return `ts:${ts}`;
  return `json:${JSON.stringify([num(e.t), txt(e.mood), txt(e.note), e.tags ?? []])}`;
};

/**
 * Заполненное ли это поле сна. Ноль — заполненное (`спала 0 ч` — ответ
 * человека), пустая строка и отсутствие — нет. `Number('') === 0`,
 * поэтому одной проверки на число мало.
 */
const sleepValue = (v) =>
  v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);

/** Дополнить свою запись сном из второй копии, не затирая заполненное. */
function fillSleep(seen, other) {
  for (const field of ['sleepH', 'napH']) {
    if (sleepValue(seen[field]) === null && sleepValue(other[field]) !== null) {
      seen[field] = other[field];
    }
  }
  if (seen.nap !== true && other.nap === true) seen.nap = true;
}

/**
 * Объединение дневника без потерь: запись с тем же временем считается
 * той же самой. Записи без времени остаются все, но самыми старыми.
 * Список «помогло» у одной и той же записи объединяется: сначала порядок
 * первой копии, затем недостающие id из второй. Так результат не зависит
 * от того, какая копия пришла первой.
 */
export function mergeEntries(a = [], b = []) {
  const index = new Map();
  const out = [];
  for (const list of [a, b]) {
    for (const item of list) {
      if (!obj(item)) continue;
      const entry = toEntry(item);
      const key = entryKey(entry);
      const seen = index.get(key);
      if (seen) {
        seen.helped = [...seen.helped, ...entry.helped.filter((id) => !seen.helped.includes(id))];
        fillSleep(seen, entry);
        continue;
      }
      index.set(key, entry);
      out.push(entry);
    }
  }
  return out.sort((x, y) => num(x.ts) - num(y.ts));
}

/**
 * Изменения схемы приёма: объединение по дате. Одна и та же дата в двух
 * копиях — побеждает та, что пришла из более свежей записи препарата
 * (`bWins`), при равенстве остаётся своя. Ни одна дата не выбрасывается:
 * «было 50 мг, стало 75» — это ровно то, что читает врач.
 */
function mergeChanges(a = [], b = [], bWins = false) {
  const out = new Map();
  for (const c of a) {
    if (!obj(c) || !txt(c.d)) continue;
    out.set(txt(c.d), { ...c });
  }
  for (const c of b) {
    if (!obj(c) || !txt(c.d)) continue;
    const key = txt(c.d);
    if (!out.has(key) || bWins) out.set(key, { ...c });
  }
  return [...out.values()].sort((x, y) => txt(x.d).localeCompare(txt(y.d)));
}

/**
 * Препараты: объединение по id, при конфликте побеждает более свежий ts.
 * Препарат не выбрасывается никогда, даже если вторая копия его не знает:
 * иначе вместе с ним пропали бы его отметки.
 * Снятие (`stoppedAt`) решает тоже свежий ts: и «убрала», и «вернула» —
 * событие. Иначе возврат из 0.8.0 не переживал слияние со старой копией:
 * пустое значение проигрывало непустому, и препарат оставался снятым.
 */
function mergeMeds(a = [], b = []) {
  const out = new Map();
  for (const list of [a, b]) {
    for (const raw of list) {
      if (!obj(raw) || !txt(raw.id)) continue;
      const m = toMed(raw);
      const prev = out.get(m.id);
      if (!prev) {
        out.set(m.id, m);
        continue;
      }
      const bWins = num(m.ts) > num(prev.ts);
      out.set(m.id, {
        ...prev,
        ...m,
        name: bWins && txt(m.name) ? txt(m.name) : txt(prev.name) || txt(m.name),
        mode: bWins && MED_MODES.includes(m.mode) ? m.mode : prev.mode,
        slots: bWins ? m.slots : prev.slots,
        changes: mergeChanges(prev.changes, m.changes, bWins),
        stoppedAt: bWins ? txt(m.stoppedAt) : txt(prev.stoppedAt),
        ts: Math.max(num(prev.ts), num(m.ts)),
      });
    }
  }
  return [...out.values()];
}

/**
 * Отметки приёма: ключ — день, препарат и приём. Без slot в ключе утренняя
 * и вечерняя отметки одного дня схлопнулись бы в одну при импорте копии.
 * При конфликте побеждает более свежая отметка: человек мог исправить
 * «не приняла» на «приняла».
 */
function mergeMarks(a = [], b = []) {
  const out = new Map();
  for (const list of [a, b]) {
    for (const raw of list) {
      if (!obj(raw) || !txt(raw.d) || !txt(raw.med)) continue;
      const k = toMark(raw);
      const key = `${k.d}|${k.med}|${k.slot}`;
      const prev = out.get(key);
      if (!prev || num(k.ts) > num(prev.ts)) out.set(key, k);
    }
  }
  return [...out.values()].sort((x, y) => txt(x.d).localeCompare(txt(y.d)));
}

/**
 * Счётчики навыков: у каждого своя отметка времени, побеждает свежая.
 * При равном времени берём тот, где оценок больше, — так оценка не
 * теряется, если вторая копия просто отстала.
 */
function mergeHelp(a, b) {
  const out = {};
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const x = a[id];
    const y = b[id];
    if (!x) out[id] = { ...y };
    else if (!y) out[id] = { ...x };
    else if (num(y.ts) > num(x.ts)) out[id] = { ...y };
    else if (num(x.ts) > num(y.ts)) out[id] = { ...x };
    else out[id] = totalOf(y) > totalOf(x) ? { ...y } : { ...x };
  }
  return out;
}

function pickContacts(a, b) {
  if (JSON.stringify(a.contacts) === JSON.stringify(b.contacts)) return a;
  if (!a.contacts.length) return b;
  if (!b.contacts.length) return a;
  // при равном времени остаётся первая (локальная) копия
  return num(b.contactsTs) > num(a.contactsTs) ? b : a;
}

function pickCard(a, b) {
  if (cardEmpty(a.card)) return b;
  if (cardEmpty(b.card)) return a;
  return num(b.cardTs) > num(a.cardTs) ? b : a;
}

function pickLetter(a, b) {
  if (!a.letter.trim()) return b;
  if (!b.letter.trim()) return a;
  return num(b.letterTs) > num(a.letterTs) ? b : a;
}

const KNOWN_FIELDS = new Set([
  'schema',
  'card',
  'cardTs',
  'contacts',
  'contactsTs',
  'entries',
  'meds',
  'marks',
  'letter',
  'letterTs',
  'help',
  'ts',
]);

/**
 * Поля, которых мы не знаем, переносятся как есть: при равном имени
 * побеждает сторона с более свежим ts (то есть более новая копия).
 */
function mergeUnknown(A, B) {
  const [older, newer] = num(B.ts) > num(A.ts) ? [A, B] : [B, A];
  const out = {};
  for (const src of [older, newer]) {
    for (const [key, value] of Object.entries(src)) {
      if (!KNOWN_FIELDS.has(key)) out[key] = value;
    }
  }
  return out;
}

/**
 * Слияние двух копий. Порядок аргументов задаёт победителя при равном
 * времени: первая копия считается своей. Возвращает новый объект.
 * Данные сначала приводятся к текущей схеме, неизвестное сохраняется.
 */
export function mergeData(a, b) {
  const A = migrate(a).data;
  const B = migrate(b).data;

  const card = pickCard(A, B);
  const contacts = pickContacts(A, B);
  const letter = pickLetter(A, B);

  return {
    ...mergeUnknown(A, B),
    // схему не понижаем: если на устройстве уже данные новой версии,
    // старая не должна объявить их своими
    schema: Math.max(A.schema, B.schema),
    card: { ...card.card },
    cardTs: Math.max(A.cardTs, B.cardTs),
    contacts: contacts.contacts.map((c) => ({ ...c })),
    contactsTs: Math.max(A.contactsTs, B.contactsTs),
    entries: mergeEntries(A.entries, B.entries),
    meds: mergeMeds(A.meds, B.meds),
    marks: mergeMarks(A.marks, B.marks),
    letter: letter.letter,
    letterTs: Math.max(A.letterTs, B.letterTs),
    help: mergeHelp(A.help, B.help),
    ts: Math.max(A.ts, B.ts),
  };
}

/** Есть ли что терять: заполненная карточка, записи, письмо, оценки, приём. */
export function isDataEmpty(raw) {
  const d = normalize(raw);
  return (
    cardEmpty(d.card) &&
    d.entries.length === 0 &&
    d.meds.length === 0 &&
    d.marks.length === 0 &&
    d.letter.trim() === '' &&
    Object.values(d.help).every((c) => totalOf(c) === 0)
  );
}

/** Имя файла: латинский слаг и дата, без русских слов. */
export function exportName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `opora-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

/**
 * Содержимое файла копии. Номер схемы стоит и в конверте, и в данных:
 * конверт читает эта версия, данные — любая, кому файл достанется.
 */
export function buildExport(raw, version, date = new Date(), { entriesOnly = false } = {}) {
  const m = migrate(raw);
  const data = m.data;
  // Копия «только записи за 14 дней»: тот же конверт, та же схема, но в данных
  // нет ни карточки, ни контактов, ни письма, ни препаратов с отметками.
  // Пустые блоки и нулевые отметки времени нужны явно: без них `help`
  // и `cardTs`/`contactsTs`/`letterTs` уезжали из полной копии, хотя подпись
  // обещает «только записи дневника». Слияние при импорте устроено так, что
  // пустые списки и старые отметки времени ничего не стирают.
  const subset = entriesOnly
    ? {
        ...data,
        card: {},
        contacts: [],
        letter: '',
        meds: [],
        marks: [],
        help: {},
        cardTs: 0,
        contactsTs: 0,
        letterTs: 0,
        entries: [...data.entries]
          .sort((a, b) => Number(a.t || 0) - Number(b.t || 0))
          .slice(-14),
      }
    : data;
  return {
    app: APP,
    schema: m.schema,
    version: String(version),
    exportedAt: date.toISOString(),
    data: subset,
  };
}

/* ------------------------------------------------------------------ */
/*  Что за текст нам дали                                              */
/* ------------------------------------------------------------------ */

export const COPY_TEXT_EMPTY = 'empty';
export const COPY_TEXT_BAD = 'bad';
export const COPY_TEXT_OPEN = 'open';

/**
 * Формат определяется по содержимому, а не по имени файла или расширению:
 * копию пересылают в мессенджере, вставляют из буфера, кладут в файл.
 */
export function copyKind(text) {
  const t = String(text ?? '').trim();
  if (!t) return COPY_TEXT_EMPTY;

  let value;
  try {
    value = JSON.parse(t);
  } catch {
    return COPY_TEXT_BAD;
  }
  if (!obj(value)) return COPY_TEXT_BAD;
  return COPY_TEXT_OPEN;
}

/**
 * В каком окне открыто приложение. `Telegram` в userAgent — встроенное окно
 * мессенджера, `; wv` — Android WebView. Строка нужна диагностике: по ней
 * видно, где открыто приложение, без вычислений из кода ошибки.
 */
export function shellOf(ua = '', standalone = false) {
  const s = String(ua);
  if (/Telegram/i.test(s)) return 'telegram';
  if (/;\s*wv[;)]/i.test(s)) return 'webview';
  if (standalone) return 'standalone';
  return 'browser';
}

/**
 * Браузер из userAgent, а не догадка по ошибке. Нужен, чтобы в следующий раз
 * отличить наш дефект от отказа движка: «NotAllowedError» у Chrome и у Safari
 * означает разное, а по одному имени ошибки этого не видно.
 * Порядок проверок важен: Edge и Opera тоже пишут Chrome в userAgent, а
 * CriOS/FxiOS — это Chrome и Firefox на iOS.
 */
export function engineOf(ua = '') {
  const s = String(ua);
  if (/Edg(e|A|iOS)?\//i.test(s)) return 'Edge';
  if (/OPR\/|Opera/i.test(s)) return 'Opera';
  if (/SamsungBrowser/i.test(s)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS\//i.test(s)) return 'Firefox';
  if (/CriOS\/|Chrome\/|Chromium\//i.test(s)) return 'Chrome';
  if (/Safari\//i.test(s)) return 'Safari';
  return 'неизвестный';
}

/**
 * Разбор файла копии. Возвращает { ok: true, data, schema, notes }
 * либо { ok: false, error, schema? } с причиной. Ничего не пишет.
 *
 * Схема новее нашей — отказ: чужие поля мы не понимаем, и «слить как
 * получится» значит потерять их при следующем сохранении.
 */
export function parseImport(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }

  if (!obj(payload) || payload.app !== APP) return { ok: false, error: 'app' };
  if (typeof payload.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(payload.version)) {
    return { ok: false, error: 'version' };
  }
  if (!obj(payload.data)) return { ok: false, error: 'data' };

  // Конверт 0.3.0–0.4.0 номера схемы не нёс: тогда это была схема 1.
  const schema = schemaOf({ schema: payload.schema ?? payload.data.schema });
  if (schema > SCHEMA_VERSION) return { ok: false, error: 'newer', schema };

  const m = migrate(payload.data);
  return {
    ok: true,
    data: m.data,
    schema: m.schema,
    notes: m.notes,
    version: payload.version,
  };
}

/**
 * Что дал импорт: сколько записей дневника добавилось и сколько уже было.
 * Считается по тому же ключу, что и слияние.
 */
export function importCounts(before, after) {
  const have = new Set((normalize(before).entries || []).map(entryKey));
  let fresh = 0;
  let existed = 0;
  for (const entry of normalize(after).entries) {
    if (have.has(entryKey(entry))) existed += 1;
    else fresh += 1;
  }
  return { fresh, existed };
}

/**
 * Подписи заводских контактов: у 112 и линии МЧС в старых версиях они
 * были другими (в том числе «только если ты в Москве»). Заменяем запись
 * только тогда, когда телефон и подпись дословно совпадают с прежними,
 * то есть её не правили руками. Всё своё остаётся как есть.
 * Возвращает новый массив; вход не меняет.
 */
export function refreshDefaultContacts(contacts = [], defaults = [], legacy = []) {
  const now = new Map(defaults.map((d) => [String(d.phone), d]));
  const was = new Map(legacy.map((l) => [String(l.phone), l]));

  return contacts.map((contact) => {
    const before = was.get(String(contact?.phone));
    const current = now.get(String(contact?.phone));
    if (!before || !current) return contact;

    const untouched =
      String(contact.label ?? '') === before.label &&
      String(contact.note ?? '') === before.note;
    return untouched ? { ...contact, label: current.label, note: current.note } : contact;
  });
}
