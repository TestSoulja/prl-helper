/**
 * Темы дневника: что было тогда и что помогло.
 *
 * Чистые функции без DOM, без хранилища и без текстов интерфейса:
 * на вход записи и список известных навыков, на выход числа и id.
 * Слова (названия навыков, «раз/раза», подписи) берёт content.js,
 * поэтому всё это можно проверять в node, а не глазами.
 *
 * Формат записи: { t, ts, mood, tags: [...], note, helped: [id навыков] }.
 * Незнакомый id в helped не выбрасывается: навык могли убрать из продукта,
 * а запись остаётся правдой о том, что тогда помогло.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const tagsOf = (e) =>
  Array.isArray(e?.tags) ? e.tags.filter((t) => typeof t === 'string') : [];

const helpedOf = (e) => (Array.isArray(e?.helped) ? e.helped : []);

/** Сколько записей показываем в общем списке за раз. */
export const LIST_LIMIT = 40;

/** Метки, которые реально встречаются в записях, в порядке `order`. */
export function tagsWithCounts(entries = [], order = []) {
  const list = Array.isArray(entries) ? entries.filter(isObj) : [];
  return order
    .map((tag) => ({ tag, n: list.filter((e) => tagsOf(e).includes(tag)).length }))
    .filter((x) => x.n > 0);
}

/** Записи одной метки, новые сверху. */
export function topicEntries(entries = [], tag) {
  return (Array.isArray(entries) ? entries.filter(isObj) : [])
    .filter((e) => tagsOf(e).includes(tag))
    .slice()
    .sort((a, b) => num(b.t) - num(a.t));
}

/**
 * Список записей с фильтром по метке, новые сверху.
 * Фильтр пустой — все записи; порядок входа не меняется.
 */
export function listEntries(entries = [], filter = null) {
  const list = (Array.isArray(entries) ? entries.filter(isObj) : []).slice();
  const picked = filter ? list.filter((e) => tagsOf(e).includes(filter)) : list;
  return picked.sort((a, b) => num(b.t) - num(a.t));
}

/**
 * Что показать из списка: первые `limit` и сколько всего. Лимит считается
 * по отфильтрованному списку, поэтому старые записи по метке не теряются.
 */
export function pageOf(list = [], limit = LIST_LIMIT) {
  const all = Array.isArray(list) ? list : [];
  return { shown: all.slice(0, limit), total: all.length };
}

/**
 * Сколько записей с меткой (M) и в скольких из них помогал каждый навык (N).
 * Считаются только навыки из `known` и только N ≥ 1; порядок — по N убыв.,
 * при равенстве — как в `known`. Мусор в helped не считается дважды.
 */
export function topicStats(entries = [], tag, known = []) {
  const list = topicEntries(entries, tag);
  const index = new Map(known.map((id, i) => [id, i]));
  const counts = new Map();

  for (const e of list) {
    const seen = new Set();
    for (const id of helpedOf(e)) {
      if (!index.has(id) || seen.has(id)) continue;
      seen.add(id);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }

  const helped = [...counts.entries()]
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n - a.n || index.get(a.id) - index.get(b.id));

  return { total: list.length, helped };
}

/**
 * «В прошлый раз помогало»: из самой свежей записи с этой меткой, где
 * помогал известный навык. Больше `limit` имён не берём: это факт о прошлом,
 * а не список рекомендаций. Нет данных — пустой массив, и строки нет.
 */
export function lastHelped(entries = [], tag, known = [], limit = 2) {
  const index = new Set(known);
  for (const e of topicEntries(entries, tag)) {
    const ids = [];
    for (const id of helpedOf(e)) {
      if (index.has(id) && !ids.includes(id)) ids.push(id);
    }
    if (ids.length) return ids.slice(0, limit);
  }
  return [];
}

/** Слово к числу: 1 раз, 2 раза, 5 раз, 11 раз, 21 раз, 22 раза. */
export function timesWord(n) {
  const k = Math.abs(Math.trunc(num(n))) % 100;
  const d = k % 10;
  if (k > 10 && k < 20) return 'раз';
  if (d === 1) return 'раз';
  if (d >= 2 && d <= 4) return 'раза';
  return 'раз';
}
