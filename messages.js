/**
 * Фразы близким: правка встроенных, добавление и удаление своих.
 *
 * Только чистые функции: ни DOM, ни хранилища. Поэтому слияние, потолки
 * и надгробия проверяются в node, а экран — браузерной командой.
 *
 * Форма в данных (`data.messages`, необязательный ключ, схема остаётся 4):
 *   overrides[id] = { text, ts }     — правка встроенной фразы;
 *   own[]         = { id, text, ts } — своя фраза;
 *   deleted[]     = { id, ts }       — надгробие: фразу убрали в этот момент;
 *   restored[]    = { id, ts }       — фраза снова заводская с этого момента.
 *
 * Надгробие нужно слиянию двух копий. Без него удалённая фраза вернулась
 * бы из второй копии, а «вернуть как было» отменила бы старая правка.
 * Надгробие не мешает новой правке: живёт то, что свежее по ts.
 *
 * `restored` — тот же приём для обратного хода: «Вернуть как было»
 * и возврат скрытой фразы обязаны побеждать старую правку и старое
 * удаление из второй копии, иначе отменённое всплывало бы снова.
 * Скрытая встроенная фраза уходит из списка (`deleted`), но остаётся
 * в данных: её можно вернуть одним тапом.
 *
 * Потолки выбраны так: 600 знаков — вшестеро длиннее самой длинной
 * встроенной фразы, но всё ещё фраза для мессенджера, а не переписка;
 * 20 своих фраз — экран остаётся списком, а полная копия растёт не больше
 * чем на 12 000 знаков. Пустая строка не сохраняется: это не фраза.
 */

export const MESSAGE_MAX = 600;
export const OWN_MAX = 20;

/** Причины отказа сохранения. Слова для экрана — в content.js. */
export const MESSAGE_EMPTY = 'empty';
export const MESSAGE_LONG = 'long';
export const MESSAGE_LIMIT = 'limit';

const txt = (v) => (typeof v === 'string' ? v : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null);

/** Текст фразы как он хранится: без крайних пробелов, не длиннее потолка. */
export function cleanText(v) {
  return txt(v).trim().slice(0, MESSAGE_MAX);
}

/**
 * Приведение к известной форме. Не меняет вход. Незнакомые поля внутри
 * записей сохраняются: копия из будущей версии не должна потерять данные.
 * Надгробия применяются здесь же, поэтому удалённое не всплывает при чтении.
 */
export function normalizeMessages(raw) {
  const src = obj(raw) || {};

  const overrides = {};
  if (obj(src.overrides)) {
    for (const [id, value] of Object.entries(src.overrides)) {
      const o = obj(value);
      if (!o) continue;
      const text = cleanText(o.text);
      if (!id || !text) continue;
      overrides[id] = { ...o, text, ts: num(o.ts) };
    }
  }

  const own = (Array.isArray(src.own) ? src.own : [])
    .filter(obj)
    .map((m) => ({ ...m, id: txt(m.id), text: cleanText(m.text), ts: num(m.ts) }))
    .filter((m) => m.id && m.text)
    .slice(0, OWN_MAX);

  const deleted = (Array.isArray(src.deleted) ? src.deleted : [])
    .filter(obj)
    .map((d) => ({ ...d, id: txt(d.id), ts: num(d.ts) }))
    .filter((d) => d.id);

  const restored = (Array.isArray(src.restored) ? src.restored : [])
    .filter(obj)
    .map((r) => ({ ...r, id: txt(r.id), ts: num(r.ts) }))
    .filter((r) => r.id);

  return applyTombstones({ overrides, own, deleted, restored });
}

/**
 * Убрать то, что было удалено позже своей правки. Сравнение по ts:
 * правка, сделанная после удаления, живёт. Равное время — удаление
 * считается последним: «убрала» — это тоже действие.
 *
 * `restored` — «снова заводская»: побеждает и удаление, и правку.
 * Проигравшие записи убираются из своей копии, чтобы данные не росли
 * мусором; в чужой копии та же запись остаётся и решает при слиянии.
 */
function applyTombstones({ overrides, own, deleted, restored }) {
  const stones = new Map();
  for (const d of deleted) {
    const prev = stones.get(d.id);
    if (!prev || num(d.ts) > num(prev.ts)) stones.set(d.id, d);
  }

  const backs = new Map();
  for (const r of restored) {
    const prev = backs.get(r.id);
    if (!prev || num(r.ts) > num(prev.ts)) backs.set(r.id, r);
  }

  // «Вернуть как было» старше удаления — прячется; свежее — снимает удаление.
  for (const [id, r] of backs) {
    const stone = stones.get(id);
    if (!stone) continue;
    if (num(r.ts) > num(stone.ts)) stones.delete(id);
    else backs.delete(id);
  }

  const keptOverrides = {};
  for (const [id, o] of Object.entries(overrides)) {
    const stone = stones.get(id);
    if (stone && num(o.ts) <= num(stone.ts)) continue;
    const back = backs.get(id);
    if (back && num(o.ts) <= num(back.ts)) continue;
    keptOverrides[id] = o;
  }

  const keptOwn = own
    .filter((m) => {
      const stone = stones.get(m.id);
      return !stone || num(m.ts) > num(stone.ts);
    })
    .sort((x, y) => num(x.ts) - num(y.ts) || txt(x.id).localeCompare(txt(y.id)));

  return {
    overrides: keptOverrides,
    own: keptOwn,
    deleted: [...stones.values()].sort((x, y) => num(x.ts) - num(y.ts) || txt(x.id).localeCompare(txt(y.id))),
    restored: [...backs.values()].sort((x, y) => num(x.ts) - num(y.ts) || txt(x.id).localeCompare(txt(y.id))),
  };
}

/**
 * Слияние двух копий: правки, свои фразы, удаления и возвраты — по id,
 * побеждает более свежая запись. Ни одна копия не «главнее»: порядок
 * аргументов влияет только на равное время (остаётся первая, то есть своя).
 */
export function mergeMessages(a, b) {
  const A = normalizeMessages(a);
  const B = normalizeMessages(b);

  const overrides = { ...A.overrides };
  for (const [id, o] of Object.entries(B.overrides)) {
    if (!overrides[id] || num(o.ts) > num(overrides[id].ts)) overrides[id] = o;
  }

  const ownById = new Map(A.own.map((m) => [m.id, m]));
  for (const m of B.own) {
    const prev = ownById.get(m.id);
    if (!prev || num(m.ts) > num(prev.ts)) ownById.set(m.id, m);
  }

  const deletedById = new Map(A.deleted.map((d) => [d.id, d]));
  for (const d of B.deleted) {
    const prev = deletedById.get(d.id);
    if (!prev || num(d.ts) > num(prev.ts)) deletedById.set(d.id, d);
  }

  const restoredById = new Map(A.restored.map((r) => [r.id, r]));
  for (const r of B.restored) {
    const prev = restoredById.get(r.id);
    if (!prev || num(r.ts) > num(prev.ts)) restoredById.set(r.id, r);
  }

  return applyTombstones({
    overrides,
    own: [...ownById.values()],
    deleted: [...deletedById.values()],
    restored: [...restoredById.values()],
  });
}

/**
 * Что видно на экране: встроенные фразы по порядку (с правкой, если она
 * есть) и свои в конце. Скрытая фраза в список не попадает; правка,
 * сделанная позже удаления, фразу возвращает — иначе свежая работа
 * на другом телефоне пропадала бы молча.
 */
export function messageList(base = [], messages) {
  const m = normalizeMessages(messages);
  const hidden = new Set(m.deleted.map((d) => d.id));
  const out = (Array.isArray(base) ? base : [])
    .filter(obj)
    .filter((b) => {
      const id = txt(b.id);
      if (!hidden.has(id)) return true;
      const o = m.overrides[id];
      return Boolean(o) && num(o.ts) > num(m.deleted.find((d) => d.id === id)?.ts);
    })
    .map((b) => {
      const id = txt(b.id);
      const o = m.overrides[id];
      const baseText = txt(b.text);
      return {
        id,
        label: txt(b.label),
        text: o ? o.text : baseText,
        // «изменено» только если текст действительно другой: сохранение
        // того же текста не должно выглядеть правкой.
        edited: Boolean(o) && o.text !== baseText,
        own: false,
      };
    });
  for (const o of m.own) out.push({ id: o.id, label: '', text: o.text, own: true, edited: true });
  return out;
}

/** Скрытые встроенные фразы: их можно вернуть одной строкой. */
export function hiddenBuiltins(base = [], messages) {
  const visible = new Set(messageList(base, messages).map((m) => m.id));
  return (Array.isArray(base) ? base : [])
    .filter(obj)
    .map((b) => ({ id: txt(b.id), label: txt(b.label), text: txt(b.text) }))
    .filter((b) => b.id && !visible.has(b.id));
}

/** Своих фраз уже потолок? Экран говорит это заранее, до пустого поля. */
export function ownFull(messages) {
  return normalizeMessages(messages).own.length >= OWN_MAX;
}

/** Правка встроенной фразы. Возвращает { ok, messages } либо причину. */
export function saveBuiltin(messages, id, text, ts) {
  const fail = checkText(text);
  if (fail) return fail;
  const m = normalizeMessages(messages);
  return {
    ok: true,
    messages: normalizeMessages({
      ...m,
      overrides: { ...m.overrides, [txt(id)]: { text: cleanText(text), ts: num(ts) } },
    }),
  };
}

/** Своя фраза. id собирается из времени и не повторяется в одной копии. */
export function addOwn(messages, text, ts) {
  const fail = checkText(text);
  if (fail) return fail;
  const m = normalizeMessages(messages);
  if (m.own.length >= OWN_MAX) return { ok: false, error: MESSAGE_LIMIT };

  const base = `own-${Math.max(1, num(ts)).toString(36)}`;
  let id = base;
  for (let i = 2; m.own.some((x) => x.id === id); i += 1) id = `${base}-${i}`;

  return {
    ok: true,
    messages: normalizeMessages({
      ...m,
      own: [...m.own, { id, text: cleanText(text), ts: num(ts) }],
    }),
  };
}

/**
 * Убрать фразу: свою — совсем, встроенную — из списка (данные остаются,
 * её можно вернуть). Надгробие остаётся, иначе вторая копия вернёт
 * удалённое.
 */
export function removeMessage(messages, id, ts) {
  const m = normalizeMessages(messages);
  const key = txt(id);
  const next = { ...m.overrides };
  delete next[key];
  return normalizeMessages({
    overrides: next,
    own: m.own.filter((x) => x.id !== key),
    deleted: [...m.deleted, { id: key, ts: num(ts) }],
    restored: m.restored,
  });
}

/**
 * «Вернуть как было» и возврат скрытой фразы — одно действие: фраза
 * снова заводская с этого момента. Отметка `restored` нужна, чтобы
 * отменённая правка и отменённое удаление не всплыли из второй копии.
 */
export function resetBuiltin(messages, id, ts) {
  const m = normalizeMessages(messages);
  const key = txt(id);
  const next = { ...m.overrides };
  delete next[key];
  return normalizeMessages({
    overrides: next,
    own: m.own,
    deleted: m.deleted,
    restored: [...m.restored, { id: key, ts: num(ts) }],
  });
}

/** Вернуть все скрытые встроенные фразы одной отметкой времени. */
export function restoreHidden(messages, ids, ts) {
  let out = normalizeMessages(messages);
  for (const id of Array.isArray(ids) ? ids : []) out = resetBuiltin(out, id, ts);
  return out;
}

function checkText(text) {
  if (!txt(text).trim()) return { ok: false, error: MESSAGE_EMPTY };
  if (txt(text).trim().length > MESSAGE_MAX) return { ok: false, error: MESSAGE_LONG };
  return null;
}
