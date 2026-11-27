/**
 * Карточка: чистые функции без DOM и без хранилища.
 *
 * Карточка — свободный объект: в ней лежат слова человека, а не схема.
 * Поэтому здесь только чтение того, что он уже написал: шаги плана,
 * первое имя и «что убрать подальше». Ничего не дописывается и не
 * придумывается — пустое остаётся пустым.
 */

const txt = (v) => (typeof v === 'string' ? v : '');

/**
 * Шаги плана: строки, а если человек написал всё одной строкой — части
 * через «→». Пустые строки не шаги: план из одного пробела — не план.
 */
export function planSteps(text) {
  const lines = txt(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parts = lines.length > 1 ? lines : txt(text).split('→');
  return parts.map((l) => l.trim()).filter(Boolean);
}

/**
 * Первое имя из «кому я могу позвонить». Это имя, не номер: приложение
 * не звонит и не обещает, что человек ответит.
 */
export function firstPerson(text) {
  return (
    txt(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)[0] || ''
  );
}

/** «Что убрать подальше» — необязательная строка; пусто — блока нет. */
export function awayText(card) {
  return txt(card?.away).trim();
}
