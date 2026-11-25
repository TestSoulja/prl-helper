/**
 * Навигация: только решение, без DOM и без window.history.
 *
 * Здесь нет ни одной записи в историю браузера — это делает app.js
 * по ответу `mode`. Зато все правила проверяются тестами без браузера.
 *
 * Два вида экранов:
 *   • вкладка — верхний уровень (главная, дыхание, карточка, дневник);
 *   • экран внутри — навык, развилка, «побыть», контакты.
 *
 * Вкладка заменяет текущую запись истории, экран внутри добавляет новую.
 * Поэтому системный жест «назад» возвращает на прошлый экран, а вкладки
 * не копятся: «вкладка → вкладка → назад» закрывает приложение.
 */

export const TAB_OF = { home: 'home', breath: 'breath', card: 'card', diary: 'diary' };

export const HOME = { name: 'home', id: null };

const same = (a, b) => a.name === b.name && (a.id ?? null) === (b.id ?? null);

/**
 * Верхний уровень — та же вкладка без вложенного id.
 * Важно: `breath` без id — вкладка, а `breath` с id — дыхательная сессия,
 * у неё есть куда вернуться.
 */
export const isTabRoot = (name, id) => TAB_OF[name] === name && !id;

/**
 * Куда ведёт переход на экран `target` из `current`.
 * mode: 'none' — уже здесь, 'replace' — вкладка, 'push' — экран внутри.
 * Возвращает новое состояние; входные объекты не меняет.
 */
export function transition(current, stack, target) {
  const next = { name: target.name, id: target.id ?? null };

  if (same(current, next)) return { mode: 'none', current, stack };

  if (isTabRoot(next.name, next.id)) return { mode: 'replace', current: next, stack: [] };

  return { mode: 'push', current: next, stack: [...stack, current] };
}

/**
 * Шаг назад по внутреннему стеку.
 * moved: false — возвращаться некуда, и тогда приложение не вмешивается
 * в жест: система закрывает его сама.
 */
export function goBack(current, stack) {
  if (!stack.length) return { moved: false, current, stack };
  return { moved: true, current: stack[stack.length - 1], stack: stack.slice(0, -1) };
}

/** То, что кладётся в window.history: только экран, ничего личного. */
export const stateOf = (screen) => ({ opora: { screen: screen.name, id: screen.id ?? null } });
