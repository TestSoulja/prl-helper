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
 */

export const APP = 'opora';

// Версия формата файла копии. Меняется только при несовместимой правке
// структуры, а не при каждой версии приложения.
export const SCHEMA_VERSION = 1;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);

const txt = (v) => (typeof v === 'string' ? v : '');

const totalOf = (c) => num(c?.yes) + num(c?.no) + num(c?.idk);

/** Поле карточки заполнено? Пустая карточка — это не данные. */
const cardEmpty = (card) =>
  !card || !Object.values(card).some((v) => String(v ?? '').trim() !== '');

function toEntry(e) {
  const given = num(e.ts) || num(e.t);
  return { ...e, t: num(e.t) || given, ts: given };
}

/** Приводит любые прочитанные данные к известной форме. Не меняет вход. */
export function normalize(raw) {
  const src = obj(raw) || {};

  const entries = Array.isArray(src.entries) ? src.entries.filter(obj).map(toEntry) : [];

  const help = {};
  if (obj(src.help)) {
    for (const [id, value] of Object.entries(src.help)) {
      const c = obj(value);
      if (!c) continue;
      help[id] = { yes: num(c.yes), no: num(c.no), idk: num(c.idk), ts: num(c.ts) };
    }
  }

  return {
    card: obj(src.card) ? { ...src.card } : {},
    cardTs: num(src.cardTs),
    contacts: Array.isArray(src.contacts) ? src.contacts.filter(obj).map((c) => ({ ...c })) : [],
    contactsTs: num(src.contactsTs),
    entries,
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
 * Объединение дневника без потерь: запись с тем же временем считается
 * той же самой. Записи без времени остаются все, но самыми старыми.
 */
export function mergeEntries(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const list of [a, b]) {
    for (const item of list) {
      if (!obj(item)) continue;
      const entry = toEntry(item);
      const key = entryKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
  }
  return out.sort((x, y) => num(x.ts) - num(y.ts));
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

/**
 * Слияние двух копий. Порядок аргументов задаёт победителя при равном
 * времени: первая копия считается своей. Возвращает новый объект.
 */
export function mergeData(a, b) {
  const A = normalize(a);
  const B = normalize(b);

  const card = pickCard(A, B);
  const contacts = pickContacts(A, B);
  const letter = pickLetter(A, B);

  return {
    card: { ...card.card },
    cardTs: Math.max(A.cardTs, B.cardTs),
    contacts: contacts.contacts.map((c) => ({ ...c })),
    contactsTs: Math.max(A.contactsTs, B.contactsTs),
    entries: mergeEntries(A.entries, B.entries),
    letter: letter.letter,
    letterTs: Math.max(A.letterTs, B.letterTs),
    help: mergeHelp(A.help, B.help),
    ts: Math.max(A.ts, B.ts),
  };
}

/** Есть ли что терять: заполненная карточка, записи, письмо, оценки. */
export function isDataEmpty(raw) {
  const d = normalize(raw);
  return (
    cardEmpty(d.card) &&
    d.entries.length === 0 &&
    d.letter.trim() === '' &&
    Object.values(d.help).every((c) => totalOf(c) === 0)
  );
}

/** Имя файла: латинский слаг и дата, без русских слов. */
export function exportName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `opora-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

/** Содержимое файла копии. */
export function buildExport(raw, version, date = new Date()) {
  return {
    app: APP,
    version: String(version),
    exportedAt: date.toISOString(),
    data: normalize(raw),
  };
}

/**
 * Разбор файла копии. Возвращает { ok: true, data } либо
 * { ok: false, error } с причиной. Ничего не пишет.
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

  return { ok: true, data: normalize(payload.data), version: payload.version };
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
