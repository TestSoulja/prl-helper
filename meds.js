/**
 * Приём: чистые функции без DOM, без хранилища и без текстов интерфейса.
 *
 * На вход препараты и отметки, на выход id и состояния; слова («каждый
 * день», «приняла всё», «спала 5 ч») берёт content.js. Поэтому всё это
 * проверяется в node, а не глазами.
 *
 * Главное правило схемы: третьего состояния нет. «Нет отметки» — это
 * отсутствие записи, а не запись со значением «none». Хранить «не
 * отметила» значило бы помнить то, чего человек не делал.
 */
import { MARK_STATES, MED_SLOTS, ASNEEDED_SLOT } from './store.js';

const txt = (v) => (typeof v === 'string' ? v : '');
const pad = (n) => String(n).padStart(2, '0');
const obj = (v) => Boolean(v) && typeof v === 'object';

/**
 * Горизонт счётчика «за N дней». 30, а не 14: «как часто за месяц» — обычный
 * вопрос врача. 14 остаётся у дневника и сна, где вопрос другой: «что было»,
 * а не «сколько раз». Это разные вещи, и одно число на них не годится.
 */
export const ASNEEDED_PERIOD_DAYS = 30;

/** Сегодняшний день по местному времени: отметка — про день, а не про миг. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Действующие препараты: снятые остаются в данных, но не в отметке. */
export function activeMeds(meds = []) {
  return (Array.isArray(meds) ? meds : []).filter((m) => m && !txt(m.stoppedAt));
}

/**
 * Препараты, которым можно поставить отметку. «По необходимости» входит:
 * у него записывается только факт приёма, и это тоже отметка. Снятые
 * не входят: новых приёмов у них не бывает, а старые остаются в данных.
 */
export function markableMeds(meds = []) {
  return activeMeds(meds);
}

/** Снятые: «больше не принимаю». Из данных не удаляются никогда. */
export function stoppedMeds(meds = []) {
  return (Array.isArray(meds) ? meds : []).filter((m) => m && txt(m.stoppedAt));
}

/**
 * Приёмы препарата: [] — один раз в день (поведение 0.9.0), либо оба ключа
 * `morning` и `evening`. Неполный или чужой список читается как «один раз»:
 * третьего режима нет, и выдумывать его из опечатки нельзя.
 */
export function slotsOf(med) {
  const list = Array.isArray(med?.slots) ? med.slots : [];
  return MED_SLOTS.every((s) => list.includes(s)) ? [...MED_SLOTS] : [];
}

/** Изменения схемы по дате: от раннего к позднему. Вход не меняется. */
export function sortedChanges(med) {
  const list = Array.isArray(med?.changes) ? med.changes.filter((c) => c && txt(c.d)) : [];
  return [...list].sort((a, b) => txt(a.d).localeCompare(txt(b.d)));
}

/** Что человек принимает сейчас — последняя запись схемы. */
export function lastChange(med) {
  const list = sortedChanges(med);
  return list.length ? list[list.length - 1] : null;
}

/** Дата изменения схемы по порядку: `at` — индекс, отрицательный считается с конца. */
function changeDate(med, at) {
  const list = sortedChanges(med);
  if (!list.length) return '';
  return txt(list[at < 0 ? list.length + at : at].d);
}

/** Дата начала: самое раннее изменение. Отдельного поля `since` нет. */
export function sinceOf(med) {
  return changeDate(med, 0);
}

/**
 * С какого дня действует текущая схема — дата последнего изменения.
 * Дата начала (`sinceOf`) для строки списка не годится: «75 мг, утром ·
 * с 14 марта» читается как «75 мг с марта», хотя дозу подняли в ноябре.
 * Цифра рядом с дозой обязана относиться к этой дозе.
 */
export function currentSince(med) {
  return changeDate(med, -1);
}

/** Ключ отметки: день, препарат и приём. Пустой slot — прежняя отметка дня. */
const markKey = (med, slot) => `${med}|${slot}`;

/** Отметки одного дня: Map(препарат|приём → состояние). */
export function marksOfDay(marks = [], d = '') {
  const out = new Map();
  for (const k of Array.isArray(marks) ? marks : []) {
    if (!k || txt(k.d) !== d || !txt(k.med)) continue;
    out.set(markKey(txt(k.med), txt(k.slot)), txt(k.state));
  }
  return out;
}

/**
 * Состояние одной строки приёма: 'taken', 'skipped' или '' (нет отметки).
 * Отдельного значения «не отметила» нет: пустая строка — это отсутствие
 * записи, а не третье состояние.
 */
export function markOf(marks = [], d = '', medId = '', slot = '') {
  const s = marksOfDay(marks, d).get(markKey(txt(medId), txt(slot)));
  return MARK_STATES.includes(s) ? s : '';
}

/**
 * Поставить отметку одному приёму или снять её. Повторный тап тем же
 * состоянием снимает только эту строку: соседний приём и соседний препарат
 * не трогаются. Другое состояние заменяет запись, а не добавляет вторую.
 * Возвращает новый массив; вход не меняется.
 */
export function toggleMed(
  marks = [],
  d = '',
  medId = '',
  slot = '',
  state = '',
  ts = Date.now(),
) {
  const id = txt(medId);
  const at = txt(slot);
  const all = Array.isArray(marks) ? marks : [];
  if (!id || !MARK_STATES.includes(state)) return all;
  const rest = all.filter(
    (k) => k && !(txt(k.d) === d && txt(k.med) === id && txt(k.slot) === at),
  );
  if (markOf(all, d, id, at) === state) return rest;
  return [...rest, { d, med: id, slot: at, state, ts }];
}

/**
 * Время приёма «ЧЧ:ММ» или '' — мусор не превращается в полночь.
 * Строкой, а не числом: в копии должно стоять ровно то время, которое
 * человек ввёл, независимо от часового пояса того, кто копию откроет.
 */
export function parseClock(value) {
  const s = txt(value).trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : '';
}

/** День со сдвигом: '2026-11-27' и -13 → '2026-11-14'. */
function shiftDay(d, delta) {
  const [y, m, dd] = txt(d).split('-').map(Number);
  if (!y || !m || !dd) return '';
  const date = new Date(y, m - 1, dd);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

/**
 * Id записи «по необходимости». Без случайности: тест должен получать
 * одно и то же, а совпадение в одну миллисекунду разводится счётным хвостом.
 */
export function newMarkId(ts = Date.now(), marks = []) {
  const base = `u${Number(ts).toString(36)}`;
  const taken = new Set(
    (Array.isArray(marks) ? marks : []).map((k) => txt(k?.u)).filter(Boolean),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Приёмы одного дня, по времени: только «принято», мусор не считается. */
export function asNeededOfDay(marks = [], d = '', medId = '') {
  return (Array.isArray(marks) ? marks : [])
    .filter(
      (k) =>
        obj(k) &&
        txt(k.d) === txt(d) &&
        txt(k.med) === txt(medId) &&
        txt(k.slot) === ASNEEDED_SLOT &&
        txt(k.state) === 'taken',
    )
    .sort((x, y) => txt(x.at).localeCompare(txt(y.at)) || Number(x.ts) - Number(y.ts));
}

/**
 * Сколько раз за последние `days` календарных дней, включая сегодня.
 * Ноль не печатается: строки нет вовсе. Знаменателя «из 30» нет — это
 * счёт фактов, а не отчёт об успеваемости.
 */
export function asNeededCount(
  marks = [],
  medId = '',
  today = dayKey(),
  days = ASNEEDED_PERIOD_DAYS,
) {
  const to = txt(today);
  const from = shiftDay(to, -(Math.max(1, days) - 1));
  if (!from) return 0;
  return (Array.isArray(marks) ? marks : []).filter(
    (k) =>
      obj(k) &&
      txt(k.med) === medId &&
      txt(k.slot) === ASNEEDED_SLOT &&
      txt(k.state) === 'taken' &&
      txt(k.d) >= from &&
      txt(k.d) <= to,
  ).length;
}

/**
 * Записать приём: день и время приёма, состояние только «принято».
 * Повтор в ту же минуту не плодит вторую запись — это один приём.
 * Возвращает новый массив; вход не меняется.
 */
export function addAsNeededMark(marks = [], medId = '', at = '', d = dayKey(), ts = Date.now()) {
  const id = txt(medId);
  const clock = parseClock(at);
  const day = txt(d);
  const all = Array.isArray(marks) ? marks : [];
  if (!id || !clock || !day) return all;
  const same = all.some(
    (k) =>
      obj(k) &&
      txt(k.med) === id &&
      txt(k.slot) === ASNEEDED_SLOT &&
      txt(k.d) === day &&
      txt(k.at) === clock,
  );
  if (same) return all;
  return [
    ...all,
    { d: day, med: id, slot: ASNEEDED_SLOT, state: 'taken', at: clock, u: newMarkId(ts, all), ts },
  ];
}

/**
 * Поправить приём: день и время. Запись находится по `u`, а не по ключу, —
 * поэтому правка меняет ключ, но не добавляет вторую запись. Второе поле
 * `ts` — момент правки: по нему старая копия с прежним временем проигрывает.
 *
 * Возвращает `{ marks, error }`; причины — коды, слова живут в content.js.
 */
export function updateAsNeededMark(marks = [], u = '', patch = {}, ts = Date.now()) {
  const all = Array.isArray(marks) ? marks : [];
  const id = txt(u);
  const idx = all.findIndex(
    (k) => obj(k) && txt(k.u) === id && txt(k.slot) === ASNEEDED_SLOT,
  );
  if (!id || idx < 0) return { marks: all, error: 'missing' };
  const rec = all[idx];
  const clock = parseClock(patch?.at ?? rec.at);
  const day = txt(patch?.d ?? rec.d);
  if (!clock) return { marks: all, error: 'clock' };
  if (!day) return { marks: all, error: 'day' };
  const busy = all.some(
    (k, i) =>
      i !== idx &&
      obj(k) &&
      txt(k.slot) === ASNEEDED_SLOT &&
      txt(k.med) === txt(rec.med) &&
      txt(k.d) === day &&
      txt(k.at) === clock,
  );
  if (busy) return { marks: all, error: 'busy' };
  const next = all.slice();
  next[idx] = { ...rec, d: day, at: clock, ts };
  return { marks: next, error: '' };
}

/** Удалить ровно одну запись по `u`; соседние и ежедневные не трогаются. */
export function removeAsNeededMark(marks = [], u = '') {
  const all = Array.isArray(marks) ? marks : [];
  const id = txt(u);
  if (!id) return all;
  return all.filter((k) => !(obj(k) && txt(k.u) === id && txt(k.slot) === ASNEEDED_SLOT));
}

/**
 * Строка про сон для записи дневника: «спала 5 ч · спала днём 1 ч»,
 * «спала 5 ч · спала днём» или только «спала 5 ч».
 * Часы печатаются как введены (запятая в дробях), без округления и без
 * средних. Не заполнено — строки нет вовсе. Часы дня печатаются только
 * вместе с галочкой: без неё это не дневной сон, а непонятное число.
 */
export function sleepText(entry, words) {
  const parts = [];
  const asNum = (v) =>
    v === '' || v === null || v === undefined ? NaN : Number(v);
  // Пустая строка — это «не заполнено», а не ноль часов: Number('') === 0.
  const h = asNum(entry?.sleepH);
  if (Number.isFinite(h) && h >= 0) {
    parts.push(String(words.line).replace('{h}', String(h).replace('.', ',')));
  }
  if (entry?.nap === true) {
    const napH = asNum(entry?.napH);
    if (Number.isFinite(napH) && napH >= 0 && words.napLine) {
      parts.push(String(words.napLine).replace('{h}', String(napH).replace('.', ',')));
    } else {
      parts.push(String(words.nap));
    }
  }
  return parts.join(' · ');
}

/**
 * «Как спалось»: последние записи, где человек заполнил сон. Только строки —
 * без средних, нормы и счёта «N из 14». Пустых строк нет: если не заполнено,
 * записи в списке не видно вовсе.
 */
export function sleepLines(entries = [], words, limit = 14) {
  const filled = (e) => {
    if (!e) return false;
    const h = e.sleepH;
    const nh = e.napH;
    return (
      (h !== undefined && h !== null && h !== '') ||
      e.nap === true ||
      (nh !== undefined && nh !== null && nh !== '')
    );
  };
  return (Array.isArray(entries) ? entries : [])
    .filter(filled)
    .sort((a, b) => Number(a.t || 0) - Number(b.t || 0))
    .slice(-limit)
    .map((e) => ({ d: e.t ? dayKey(new Date(Number(e.t))) : '', text: sleepText(e, words) }))
    .filter((row) => row.text);
}
