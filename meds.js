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
import { MARK_STATES } from './store.js';

const txt = (v) => (typeof v === 'string' ? v : '');
const pad = (n) => String(n).padStart(2, '0');

/** Сегодняшний день по местному времени: отметка — про день, а не про миг. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Действующие препараты: снятые остаются в данных, но не в отметке. */
export function activeMeds(meds = []) {
  return (Array.isArray(meds) ? meds : []).filter((m) => m && !txt(m.stoppedAt));
}

/**
 * Препараты, у которых есть ежедневная отметка. «По необходимости» сюда не
 * входит: «не приняла» для него ничего не значит — человек не обязан
 * принимать его каждый день, и такой вопрос был бы укором.
 */
export function markableMeds(meds = []) {
  return activeMeds(meds).filter((m) => txt(m.mode) !== 'asneeded');
}

/** Снятые: «больше не принимаю». Из данных не удаляются никогда. */
export function stoppedMeds(meds = []) {
  return (Array.isArray(meds) ? meds : []).filter((m) => m && txt(m.stoppedAt));
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

/** Отметки одного дня: Map(препарат → состояние). */
export function marksOfDay(marks = [], d = '') {
  const out = new Map();
  for (const k of Array.isArray(marks) ? marks : []) {
    if (!k || txt(k.d) !== d || !txt(k.med)) continue;
    out.set(txt(k.med), txt(k.state));
  }
  return out;
}

/**
 * Состояние одной строки препарата: 'taken', 'skipped' или '' (нет отметки).
 * Отдельного значения «не отметила» нет: пустая строка — это отсутствие
 * записи, а не третье состояние.
 */
export function markOf(marks = [], d = '', medId = '') {
  const s = marksOfDay(marks, d).get(txt(medId));
  return MARK_STATES.includes(s) ? s : '';
}

/**
 * Поставить отметку одному препарату или снять её. Повторный тап тем же
 * состоянием снимает только эту строку: соседние препараты не трогаются.
 * Другое состояние заменяет запись, а не добавляет вторую.
 * Возвращает новый массив; вход не меняется.
 */
export function toggleMed(marks = [], d = '', medId = '', state = '', ts = Date.now()) {
  const id = txt(medId);
  const all = Array.isArray(marks) ? marks : [];
  if (!id || !MARK_STATES.includes(state)) return all;
  const rest = all.filter((k) => k && !(txt(k.d) === d && txt(k.med) === id));
  if (markOf(all, d, id) === state) return rest;
  return [...rest, { d, med: id, state, ts }];
}

/**
 * Строка про сон для записи дневника: «спала 5 ч · спала днём».
 * Часы печатаются как введены (запятая в дробях), без округления и без
 * средних. Не заполнено — строки нет вовсе.
 */
export function sleepText(entry, words) {
  const parts = [];
  const raw = entry?.sleepH;
  // Пустая строка — это «не заполнено», а не ноль часов: Number('') === 0.
  const h = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
  if (Number.isFinite(h) && h >= 0) {
    parts.push(String(words.line).replace('{h}', String(h).replace('.', ',')));
  }
  if (entry?.nap === true) parts.push(String(words.nap));
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
    return (h !== undefined && h !== null && h !== '') || e.nap === true;
  };
  return (Array.isArray(entries) ? entries : [])
    .filter(filled)
    .sort((a, b) => Number(a.t || 0) - Number(b.t || 0))
    .slice(-limit)
    .map((e) => ({ d: e.t ? dayKey(new Date(Number(e.t))) : '', text: sleepText(e, words) }))
    .filter((row) => row.text);
}
