/**
 * Журнал действий 0.11.0.
 *
 * Что это: список того, что человек сделал в приложении, — вход в навык,
 * конец навыка, отметка приёма, сохранённая запись, копия, импорт. Нужен
 * не для показа и не для оценок, а чтобы потом было из чего собрать
 * выгрузку: «сколько раз открывал дыхание», «доходил ли до конца».
 *
 * Чего здесь нет и не должно быть:
 *   — текстов. Ни заметки, ни карточки, ни адреса, ни фразы близкому:
 *     в событии только вид, время и, где нужно, обезличенный id;
 *   — звонков и любых нажатий на 112 и на контакты — их не пишем никогда;
 *   — открытий экранов, меню, «Ещё» и списков: это не действие, а просмотр.
 *
 * Пороги — здесь и только здесь, не по месту вызова:
 *   GLANCE_MS — короче 10 с навык считался «взглядом», а не попыткой;
 *   REPEAT_MS — повторный вход в тот же навык в пределах 2 минут не новое
 *               событие, а n += 1 у предыдущего;
 *   EVENTS_MAX — потолок журнала: 5 000 событий, дальше уходят самые старые.
 *
 * Только чистые функции: без DOM, без времени изнутри (t приходит
 * аргументом). Поэтому проверяются в node, а не глазами.
 */

export const EVENTS_MAX = 5000;
export const GLANCE_MS = 10 * 1000;
export const REPEAT_MS = 2 * 60 * 1000;

/**
 * Виды событий. Список закрытый для записи: приложение пишет только эти.
 * Чужой вид из копии не выбрасывается (см. normalizeEvents), но сам
 * появиться не может — иначе «журнал» однажды наполнился бы чем попало.
 */
export const EVENT_KINDS = [
  'skill_open',
  'skill_done',
  'skill_abort',
  'skill_glance',
  'mark_set',
  'entry_saved',
  'med_change',
  'card_saved',
  'contact_added',
  'message_copy',
  'export_made',
  'import_made',
];

/** Взгляд — не попытка: в выгрузку он не идёт, но в сырье остаётся. */
export const HIDDEN_KINDS = ['skill_glance'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const txt = (v) => (typeof v === 'string' ? v : '');
const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);

/**
 * Одно событие в том виде, в каком его пишет приложение: только известные
 * поля и ничего лишнего. Это и есть ответ на «в журнале нет текста»:
 * лишнее поле сюда просто не попадает, даже если его передали.
 */
export function eventOf(raw) {
  const e = obj(raw) || {};
  const kind = txt(e.kind).trim();
  const t = num(e.t);
  if (!kind || t <= 0) return null;

  const out = { t, kind };
  const id = txt(e.id).trim();
  if (id) out.id = id;
  const n = Math.round(num(e.n));
  if (n > 1) out.n = n;
  const d = Math.round(num(e.d));
  if (d > 0) out.d = d;
  if (e.done === true) out.done = true;
  return out;
}

/**
 * Чтение события из данных или копии: известные поля приводятся к типу,
 * незнакомые сохраняются. Событие без времени или без вида — не событие.
 */
function toEvent(raw) {
  const e = obj(raw);
  if (!e) return null;
  const kind = txt(e.kind).trim();
  const t = num(e.t);
  if (!kind || t <= 0) return null;
  const out = { ...e, t, kind };
  delete out.id;
  const id = txt(e.id).trim();
  if (id) out.id = id;
  delete out.n;
  const n = Math.round(num(e.n));
  if (n > 1) out.n = n;
  delete out.d;
  const d = Math.round(num(e.d));
  if (d > 0) out.d = d;
  if (e.done !== true) delete out.done;
  return out;
}

/**
 * Исход сессии навыка — одна функция на всё приложение. «Дошёл до конца»
 * знает только экран «готово»; всё остальное решает время: 10 с и больше —
 * попытка (abort), меньше — взгляд (glance).
 */
export function sessionKind({ done = false, ms = 0 } = {}) {
  if (done) return 'skill_done';
  return num(ms) >= GLANCE_MS ? 'skill_abort' : 'skill_glance';
}

/** Массив событий в известной форме; порядок не меняется. */
export function normalizeEvents(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(toEvent).filter(Boolean);
}

/**
 * Записать событие. Возвращает новый список и новое число отброшенных:
 * потолок применяется здесь же, чтобы он не зависел от места вызова.
 *
 * Повторный вход в тот же навык в пределах двух минут — не новое событие:
 * у предыдущего растёт n и складывается d. Десять заходов за минуту — одна
 * строка «n = 10», а не десять. Ищем последний *вход* в этот навык, а не
 * просто последнюю строку: между заходами успевает лечь «вышел», и без
 * поиска по id слияние не сработало бы никогда.
 */
export function addEvent(events, raw, dropped = 0) {
  const list = Array.isArray(events) ? events.slice() : [];
  let lost = Math.max(0, Math.round(num(dropped)));
  const e = eventOf(raw);
  if (!e) return { events: list, dropped: lost };

  if (e.kind === 'skill_open') {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const prev = list[i];
      if (prev.kind !== 'skill_open' || (prev.id || '') !== (e.id || '')) continue;
      const near = num(e.t) - num(prev.t);
      if (near >= 0 && near <= REPEAT_MS) {
        prev.n = (prev.n || 1) + 1;
        prev.d = (prev.d || 0) + (e.d || 0);
        return { events: list, dropped: lost };
      }
      // первый же вход в этот навык старше окна — дальше искать незачем
      break;
    }
  }

  list.push(e);
  while (list.length > EVENTS_MAX) {
    list.shift();
    lost += 1;
  }
  return { events: list, dropped: lost };
}

/**
 * Слияние двух журналов: объединение по (t, kind, id), дубли отбрасываются.
 * Потолок — после слияния; сколько при этом ушло, отдаём наружу, чтобы
 * копия не делала вид, что журнал полный с самого начала.
 */
export function mergeEvents(a = [], b = []) {
  const map = new Map();
  for (const raw of [...normalizeEvents(a), ...normalizeEvents(b)]) {
    const key = `${raw.t}|${raw.kind}|${raw.id || ''}`;
    const seen = map.get(key);
    if (!seen) {
      map.set(key, raw);
      continue;
    }
    // Дубль одной и той же сессии: берём большее, а не сумму — иначе
    // одна и та же копия, слитая дважды, удвоила бы счётчик.
    const merged = {
      ...seen,
      n: Math.max(seen.n || 1, raw.n || 1),
      d: Math.max(seen.d || 0, raw.d || 0),
    };
    if (seen.done === true || raw.done === true) merged.done = true;
    map.set(key, merged);
  }

  const list = [...map.values()].sort((x, y) => x.t - y.t);
  const trimmed = Math.max(0, list.length - EVENTS_MAX);
  return { events: trimmed ? list.slice(trimmed) : list, trimmed };
}

/** Журнал для копии: взгляды остаются в сырье, но наружу не идут. */
export function exportEvents(events) {
  const list = normalizeEvents(events);
  return list.filter((e) => !HIDDEN_KINDS.includes(e.kind));
}

/**
 * Строка о журнале для копии: с какого события он начинается и сколько
 * старых отброшено. Без неё выгрузка выглядела бы полной, даже когда
 * начало уже потеряно.
 */
export function journalSummary(events, dropped = 0) {
  const list = normalizeEvents(events);
  return {
    from: list.length ? list[0].t : 0,
    dropped: Math.max(0, Math.round(num(dropped))),
  };
}
