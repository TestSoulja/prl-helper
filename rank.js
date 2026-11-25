/**
 * Память о том, что помогает. Чистые функции без DOM и без хранилища:
 * их можно проверять в node, а не глазами.
 *
 * Формат счётчиков: { [skillId]: { yes, no, idk } }.
 * Старые данные без поля help читаются как есть — пустой объект.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function counts(stats, id) {
  const s = (stats && typeof stats === 'object' && stats[id]) || {};
  return { yes: num(s.yes), no: num(s.no), idk: num(s.idk) };
}

/** Счёт навыка: помогло минус не помогло. «Не знаю» не влияет. */
export function score(stats, id) {
  const c = counts(stats, id);
  return c.yes - c.no;
}

/**
 * Метка «раньше не заходило»: счёт ниже нуля и хотя бы две оценки.
 * Одна неудача — это ещё не вывод о навыке.
 */
export function isWeak(stats, id) {
  const c = counts(stats, id);
  return c.yes + c.no >= 2 && c.yes - c.no < 0;
}

/**
 * Порядок навыков в развилке: по счёту, при равенстве — исходный порядок.
 * Ничего не выбрасывает: на входе три id, на выходе три.
 */
export function rankSkills(ids, stats) {
  return ids
    .map((id, index) => ({ id, index, score: score(stats, id), weak: isWeak(stats, id) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ id, score: s, weak }) => ({ id, score: s, weak }));
}

/** Новый объект счётчиков с одной добавленной оценкой. Исходный не меняется. */
export function bump(help, id, value, ts = 0) {
  const base = help && typeof help === 'object' ? help : {};
  if (!['yes', 'no', 'idk'].includes(value)) return base;

  const prev = counts(base, id);
  return { ...base, [id]: { ...prev, [value]: prev[value] + 1, ts } };
}
