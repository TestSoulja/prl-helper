import {
  BREATHS,
  SKILLS,
  TRIAGE,
  CRISIS_FIELDS,
  DEFAULT_CONTACTS,
  MOOD_WORDS,
  MOOD_TAGS,
  SAFETY_NOTE,
  GROUNDING_STEPS,
  MESSAGES,
  MESSAGES_TITLE,
  MESSAGES_HINT,
  MESSAGES_COPIED,
  MESSAGES_FAILED,
  HELP_QUESTION,
  HELP_ANSWERS,
  WEAK_LABEL,
  CALM_BUTTON,
  CALM_LINE,
  CALM_EXIT,
  CALM_MINUTES,
  EXPORT_BUTTON,
  EXPORT_NOTE,
  EXPORT_DONE,
  EXPORT_FAILED,
  IMPORT_BUTTON,
  IMPORT_RESULT,
  IMPORT_ERR_JSON,
  IMPORT_ERR_APP,
  IMPORT_ERR_VERSION,
  IMPORT_ERR_DATA,
  EMPTY_TITLE,
  EMPTY_TEXT,
  EMPTY_IMPORT,
  PERSIST_LABEL,
  PERSIST_YES,
  PERSIST_NO,
  PERSIST_NOTE,
} from './content.js';

import { rankSkills, bump } from './rank.js';
import {
  normalize,
  mergeData,
  isDataEmpty,
  buildExport,
  parseImport,
  importCounts,
  exportName,
} from './store.js';
import { readData, writeData, clearData } from './db.js';

/* ------------------------------------------------------------------ */
/*  Состояние                                                          */
/* ------------------------------------------------------------------ */

// Единственный источник версии — <meta name="site-version"> в index.html.
const SITE_VERSION =
  document.querySelector('meta[name="site-version"]')?.content || '?';

const KEY = 'opora.v1';
// отметка «приложением уже пользовались»: нужна, чтобы отличить
// «данные вычищены» от «первый запуск»
const SEEN = 'opora.seen';

const defaults = () => ({
  ...normalize(null),
  contacts: DEFAULT_CONTACTS.map((c) => ({ ...c })),
});

// была ли своя копия в localStorage: если нет — при равном времени
// главной считается копия из IndexedDB, иначе стандартные контакты
// перебили бы уже отредактированные
const hadLocal = (() => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
})();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();

    const saved = JSON.parse(raw);
    const data = normalize(saved);
    // совсем старые записи без списка контактов — стандартный список
    if (!Array.isArray(saved?.contacts)) {
      data.contacts = DEFAULT_CONTACTS.map((c) => ({ ...c }));
    }
    return data;
  } catch {
    return defaults();
  }
}

let data = load();

function markUsed() {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    /* приватный режим — отметки не будет */
  }
}

// раньше пользовались — значит, если данные пропали, это стоит сказать
if (!isDataEmpty(data)) markUsed();

let persistAsked = false;

async function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* браузер отказал — покажем это в настройках как «нет» */
  }
}

function save() {
  data.ts = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* приватный режим или переполнение — вторая копия ниже всё равно попробует */
  }
  markUsed();
  askPersist();
  writeData(data);
}

/**
 * Вторая копия при старте: читаем IndexedDB, сливаем с localStorage
 * и раскладываем результат обратно в оба места. Если localStorage
 * вычистили, данные поднимутся из IndexedDB.
 */
async function hydrate() {
  const second = await readData();

  if (!second) {
    if (!isDataEmpty(data)) writeData(data);
    return;
  }

  // localStorage пуст — значит своя копия «свежая» только по названию:
  // главной считаем вторую, чтобы не потерять отредактированные контакты
  const merged = hadLocal
    ? mergeData(data, normalize(second))
    : mergeData(normalize(second), data);
  if (JSON.stringify(merged) === JSON.stringify(data)) return;

  data = merged;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ничего страшного: в IndexedDB уже лежит */
  }
  writeData(data);
  render();
}

let current = { name: 'home', id: null };
let history = [];
let activeTab = 'home';
let stepIdx = 0;
let cardEdit = false;
let contactsEdit = false;
let draft = { mood: null, tags: new Set(), note: '' };
let tick = null;
let wakeLock = null;
let deferredPrompt = null;
// какой навык сейчас выполняется: нужен, чтобы после него задать один вопрос
let skillCtx = null;
// что показать про копию и восстановление: пусто, пока ничего не делали
let notice = '';
// защищено ли хранилище от очистки: null — ещё не узнали
let persisted = null;

const TAB_OF = { home: 'home', breath: 'breath', card: 'card', diary: 'diary' };

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

/* ------------------------------------------------------------------ */
/*  Утилиты                                                            */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const fmtDate = (t) =>
  new Date(t).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const isStandalone =
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

const dialable = (p) => String(p).replace(/[^\d+]/g, '');

/**
 * Копирование в буфер. Ничего не отправляет и адресатов не знает.
 * Сначала Clipboard API, потом старый способ — он нужен там, где
 * асинхронный API запрещён (http, встроенный браузер, старые движки).
 */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* нет разрешения или не тот контекст — идём в фолбэк */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-2000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Навигация                                                          */
/* ------------------------------------------------------------------ */

function go(name, id = null) {
  history.push({ ...current });
  current = { name, id };
  notice = '';
  render();
}

function back() {
  current = history.pop() || { name: activeTab, id: null };
  notice = '';
  render();
}

function switchTab(name) {
  history = [];
  current = { name, id: null };
  cardEdit = false;
  contactsEdit = false;
  skillCtx = null;
  notice = '';
  render();
}

/* ------------------------------------------------------------------ */
/*  Рендер                                                            */
/* ------------------------------------------------------------------ */

function render() {
  clearInterval(tick);
  tick = null;
  releaseWake();

  if (TAB_OF[current.name]) activeTab = TAB_OF[current.name];

  document.body.classList.toggle(
    'immersive',
    (current.name === 'breath' && Boolean(current.id)) || current.name === 'calm',
  );

  const html = SCREENS[current.name]?.(current.id) ?? SCREENS.home();
  view.innerHTML = html;
  view.scrollTop = 0;

  for (const b of tabbar.querySelectorAll('[data-tab]')) {
    b.classList.toggle('is-active', b.dataset.tab === activeTab);
  }

  MOUNT[current.name]?.(current.id);
}

/* ------------------------------------------------------------------ */
/*  Экраны                                                            */
/* ------------------------------------------------------------------ */

const SCREENS = {
  home() {
    return `
      <div class="screen">
        <header class="head">
          <div class="toprow">
            <div class="eyebrow">сейчас</div>
            <button class="dots" data-act="go" data-screen="more" aria-label="Ещё">⋯</button>
          </div>
          <h1>Как ты?</h1>
        </header>

        <button class="hero" data-act="go" data-screen="triage">
          <span class="hero__t">Мне плохо сейчас</span>
          <span class="hero__s">Подскажу, что делать</span>
        </button>

        <div class="safety">${esc(SAFETY_NOTE)}</div>

        ${restoreBanner()}

        ${statusBlock()}

        <div class="quick">
          <button class="quick__item" data-act="go" data-screen="breath" data-id="sigh">
            Дыхание<span>20 секунд</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="skill" data-id="ground5">
            Заземление<span>3 минуты</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="skill" data-id="cold">
            Холод<span>1 минута</span>
          </button>
          <button class="quick__item" data-act="go" data-screen="skill" data-id="quiet">
            Пауза<span>1 минута</span>
          </button>
        </div>

        <button class="btn btn--calm" data-act="go" data-screen="calm">
          ${esc(CALM_BUTTON)}
        </button>

        <div class="note">Здесь можно ничего не делать и ничего не объяснять.</div>

        ${messagesBlock()}

        ${installBlock()}
      </div>`;
  },

  triage() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <h1>Что происходит?</h1>
        </header>
        <div class="grid">
          ${TRIAGE.map(
            (t) =>
              `<button class="grid__btn" data-act="go" data-screen="result" data-id="${t.id}">${esc(
                t.label,
              )}</button>`,
          ).join('')}
        </div>
      </div>`;
  },

  result(id) {
    const t = TRIAGE.find((x) => x.id === id) || TRIAGE[0];
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">${esc(t.label)}</div>
          <h1>Попробуй это</h1>
          <p class="lead">Сверху — то, что обычно помогает быстрее всего.</p>
        </header>
        ${rankSkills(t.skills, data.help)
          .map((r) => skillCard(r.id, r.weak))
          .join('')}
        <button class="btn btn--ghost" data-act="go" data-screen="triage">
          Это не то, что со мной
        </button>
      </div>`;
  },

  skill(id) {
    const s = SKILLS[id];
    if (!s) return SCREENS.home();

    const body = s.body ? `<p>${esc(s.body)}</p>` : '';

    if (s.steps) {
      const n = s.steps.length;
      const i = Math.min(stepIdx, n - 1);
      const dots = s.steps
        .map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`)
        .join('');
      return `
        <div class="screen">
          <button class="back" data-act="back">‹ назад</button>
          <div class="stepper">
            <div class="progress">${dots}</div>
            <div class="step__num">шаг ${i + 1} из ${n}</div>
            <div class="step__text">${esc(s.steps[i])}</div>
            <button class="btn btn--primary" data-act="step-next">
              ${i === n - 1 ? 'Готово' : 'Дальше'}
            </button>
            ${s.caution ? `<div class="caution">${esc(s.caution)}</div>` : ''}
          </div>
        </div>`;
    }

    const cta = s.start
      ? `<button class="btn btn--primary" data-act="start-skill" data-id="${id}">
           ${
             { breath: 'Начать дыхание', grounding: 'Начать', timer: 'Начать', write: 'Писать' }[
               s.start.type
             ] || 'Начать'
           }
         </button>`
      : '';

    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">${esc(s.meta)}</div>
          <h1>${esc(s.title)}</h1>
          <p class="lead">${esc(s.lead)}</p>
        </header>
        ${body}
        ${cta}
        ${s.caution ? `<div class="caution">${esc(s.caution)}</div>` : ''}
      </div>`;
  },

  breath(id) {
    if (!id) {
      return `
        <div class="screen">
          <header class="head">
            <div class="eyebrow">дыхание</div>
            <h1>Выбери ритм</h1>
            <p class="lead">Не важно, какой выберешь. Важен длинный выдох.</p>
          </header>
          ${Object.entries(BREATHS)
            .map(
              ([key, b]) => `
            <button class="card" data-act="go" data-screen="breath" data-id="${key}">
              <div class="card__title">${esc(b.name)}</div>
              <div class="card__meta">${b.cycles} цикла · ${b.phases
                .map((p) => p.sec)
                .join('–')}</div>
            </button>`,
            )
            .join('')}
        </div>`;
    }

    const b = BREATHS[id];
    if (!b) return SCREENS.breath();

    return `
      <div class="screen breath">
        <div class="breath-stage">
          <div class="breath-circle" id="b-circle"></div>
          <div class="breath-inner"></div>
        </div>
        <div class="breath-label" id="b-label">Приготовься</div>
        <div class="breath-count" id="b-count">3</div>
        <div class="breath-meta" id="b-meta">${esc(b.name)}</div>
        <div class="breath-actions">
          <button class="btn btn--ghost" data-act="breath-stop">Закончить</button>
        </div>
      </div>`;
  },

  grounding() {
    const i = Math.min(stepIdx, GROUNDING_STEPS.length - 1);
    const step = GROUNDING_STEPS[i];
    const dots = GROUNDING_STEPS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <div class="stepper">
          <div class="progress">${dots}</div>
          <div class="step__num">${i + 1} из ${GROUNDING_STEPS.length}</div>
          <div class="timer__num">${step.n}</div>
          <div class="step__text">${esc(step.verb)}</div>
          <p class="muted small">${esc(step.hint)}</p>
          <button class="btn btn--primary" data-act="ground-next">
            ${i === GROUNDING_STEPS.length - 1 ? 'Готово' : 'Нашла'}
          </button>
        </div>
      </div>`;
  },

  timer(id) {
    const s = SKILLS[id];
    const minutes = s?.start?.minutes ?? 1;
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <div class="timer">
          <div class="timer__num" id="t-num">${String(minutes).padStart(2, '0')}:00</div>
          <div class="timer__hint">
            ${
              s?.lead
                ? esc(s.lead)
                : 'Займи руки чем-нибудь. Вода, окно, пол.'
            }
          </div>
          <div class="timer__hint">Ничего не нужно решать прямо сейчас.</div>
          <button class="btn btn--ghost" data-act="timer-stop">Хватит</button>
        </div>
      </div>`;
  },

  write() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">только для тебя</div>
          <h1>Пиши как есть</h1>
          <p class="lead">Это никто не прочитает. Текст останется на этом телефоне.</p>
        </header>
        <textarea id="letter" rows="12" placeholder="Всё, что хочется сказать…">${esc(
          data.letter,
        )}</textarea>
        <div style="height:14px"></div>
        <button class="btn btn--primary" data-act="letter-done">Готово</button>
        <button class="btn btn--ghost btn--danger" data-act="letter-clear">Стереть текст</button>
      </div>`;
  },

  done(id) {
    const skill = id && SKILLS[id] ? id : null;
    return `
      <div class="screen">
        <header class="head">
          <div class="eyebrow">готово</div>
          <h1>Как сейчас?</h1>
        </header>
        <p class="lead">
          Не обязательно стало лучше. Достаточно, что ты не осталась с этим одна.
        </p>
        ${
          skill
            ? `<section class="ask">
                 <h2 class="ask__q">${esc(HELP_QUESTION)}</h2>
                 <div class="ask__opts">
                   ${HELP_ANSWERS.map(
                     (a) =>
                       `<button class="ask__opt" data-act="help" data-id="${skill}" data-v="${a.id}">${esc(
                         a.label,
                       )}</button>`,
                   ).join('')}
                 </div>
               </section>`
            : ''
        }
        <button class="btn btn--primary" data-act="go" data-screen="triage">Ещё что-нибудь</button>
        <button class="btn" data-act="go" data-screen="home">На главную</button>
      </div>`;
  },

  calm() {
    return `
      <div class="screen calm">
        <div class="calm__halo" aria-hidden="true"></div>
        <div class="calm__line">${esc(CALM_LINE)}</div>
        <div class="calm__time" id="c-num">${String(CALM_MINUTES).padStart(2, '0')}:00</div>
        <button class="btn btn--ghost calm__exit" data-act="calm-exit">${esc(CALM_EXIT)}</button>
      </div>`;
  },

  /* ------------------------------ карточка ------------------------ */

  card() {
    if (cardEdit) {
      return `
        <div class="screen">
          <button class="back" data-act="back">‹ назад</button>
          <header class="head">
            <h1>Моя карточка</h1>
            <p class="lead">Заполняй спокойно и по чуть-чуть. Можно вернуться позже.</p>
          </header>
          ${CRISIS_FIELDS.map(
            (f) => `
            <div class="field">
              <label class="field__label" for="f-${f.key}">${esc(f.label)}</label>
              <span class="field__hint">${esc(f.hint)}</span>
              <textarea id="f-${f.key}" rows="3" placeholder="${esc(f.placeholder)}">${esc(
                data.card[f.key] || '',
              )}</textarea>
            </div>`,
          ).join('')}
          <button class="btn btn--primary" data-act="card-save">Сохранить</button>
          <button class="btn btn--ghost" data-act="card-cancel">Отмена</button>
        </div>`;
    }

    const empty = CRISIS_FIELDS.every((f) => !(data.card[f.key] || '').trim());

    return `
      <div class="screen">
        <header class="head">
          <div class="eyebrow">на плохие минуты</div>
          <h1>Моя карточка</h1>
          <p class="lead">Твои собственные слова. Их не нужно придумывать заново в накате.</p>
        </header>

        ${
          empty
            ? `<div class="note" style="margin-bottom:18px">
                 Пока пусто. Заполни, когда будет ресурс — не сегодня, так завтра.
               </div>`
            : ''
        }

        ${CRISIS_FIELDS.map((f) => {
          const val = (data.card[f.key] || '').trim();
          return `
            <div class="field-block">
              <h2>${esc(f.label)}</h2>
              <div class="val ${val ? '' : 'empty'}">${val ? esc(val) : 'не заполнено'}</div>
            </div>`;
        }).join('')}

        <button class="btn" data-act="card-edit">${empty ? 'Заполнить' : 'Изменить'}</button>
        <button class="btn btn--ghost" data-act="go" data-screen="contacts">Контакты и звонки</button>
      </div>`;
  },

  contacts() {
    if (contactsEdit) {
      return `
        <div class="screen">
          <button class="back" data-act="back">‹ назад</button>
          <header class="head"><h1>Контакты</h1></header>
          ${data.contacts
            .map(
              (c, i) => `
            <div class="field-block">
              <div class="field">
                <label class="field__label">Название</label>
                <input type="text" data-c="label" data-i="${i}" value="${esc(c.label)}">
              </div>
              <div class="field">
                <label class="field__label">Телефон</label>
                <input type="tel" data-c="phone" data-i="${i}" value="${esc(c.phone)}">
              </div>
              <div class="field" style="margin-bottom:0">
                <label class="field__label">Заметка</label>
                <input type="text" data-c="note" data-i="${i}" value="${esc(c.note || '')}">
              </div>
              <div style="height:10px"></div>
              <button class="btn btn--ghost btn--danger" data-act="contact-del" data-id="${i}">
                Удалить
              </button>
            </div>`,
            )
            .join('')}
          <button class="btn" data-act="contact-add">+ Добавить контакт</button>
          <button class="btn btn--primary" data-act="contacts-save">Сохранить</button>
          <button class="btn btn--ghost" data-act="contacts-cancel">Отмена</button>
        </div>`;
    }

    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <h1>Контакты</h1>
          <p class="lead">Нажми, чтобы позвонить. Номера проверь под свой город.</p>
        </header>
        ${data.contacts
          .map(
            (c) => `
          <a class="contact" href="tel:${esc(dialable(c.phone))}">
            <div class="contact__body">
              <div class="contact__name">${esc(c.label)}</div>
              ${c.note ? `<div class="contact__note">${esc(c.note)}</div>` : ''}
            </div>
            <div class="contact__call">позвонить</div>
          </a>`,
          )
          .join('')}
        <button class="btn" data-act="contacts-edit">Изменить список</button>
        ${messagesBlock()}
      </div>`;
  },

  /* ------------------------------ дневник ------------------------- */

  diary() {
    const entries = [...data.entries].sort((a, b) => b.t - a.t);
    const last = [...data.entries].sort((a, b) => a.t - b.t).slice(-14);

    return `
      <div class="screen">
        <header class="head">
          <div class="eyebrow">если хочется</div>
          <h1>Как я</h1>
          <p class="lead">Совсем не обязательно. Никаких серий и напоминаний здесь нет.</p>
        </header>

        <div class="mood">
          ${MOOD_WORDS.map(
            (w, i) => `
            <button class="mood__btn ${draft.mood === i + 1 ? 'on' : ''}"
              data-act="mood" data-v="${i + 1}">
              <i></i>${esc(w)}
            </button>`,
          ).join('')}
        </div>

        <div class="tags">
          ${MOOD_TAGS.map(
            (t) => `
            <button class="tag ${draft.tags.has(t) ? 'on' : ''}" data-act="tag" data-tag="${esc(t)}">
              ${esc(t)}
            </button>`,
          ).join('')}
        </div>

        <textarea id="note" rows="3" placeholder="Что-то ещё? Пара слов достаточно.">${esc(
          draft.note,
        )}</textarea>
        <div style="height:14px"></div>
        <button class="btn btn--primary" data-act="save-entry">Сохранить</button>

        ${
          last.length
            ? `<div class="spark">${last
                .map(
                  (e) =>
                    `<div class="spark__d" style="height:${6 + e.mood * 9}px;opacity:${
                      0.35 + e.mood * 0.13
                    }"></div>`,
                )
                .join('')}</div>`
            : ''
        }

        ${
          entries.length
            ? entries
                .slice(0, 40)
                .map(
                  (e) => `
              <div class="entry">
                <div class="entry__top">
                  <span class="entry__date">${fmtDate(e.t)}</span>
                  <span class="entry__mood">${esc(MOOD_WORDS[e.mood - 1] || '')}</span>
                </div>
                ${e.tags?.length ? `<div class="entry__tags">${esc(e.tags.join(' · '))}</div>` : ''}
                ${e.note ? `<div class="entry__note">${esc(e.note)}</div>` : ''}
              </div>`,
                )
                .join('')
            : `<div class="empty">Записей пока нет. Это нормально.</div>`
        }
      </div>`;
  },

  /* ------------------------------ прочее -------------------------- */

  more() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head"><h1>Ещё</h1></header>
        <div class="grid">
          <button class="grid__btn" data-act="go" data-screen="contacts">Контакты и звонки</button>
          <button class="grid__btn" data-act="go" data-screen="about">О приложении</button>
          <button class="grid__btn" data-act="install">Установить на телефон</button>
          <button class="grid__btn" data-act="export">${esc(EXPORT_BUTTON)}</button>
          <button class="grid__btn" data-act="import">${esc(IMPORT_BUTTON)}</button>
        </div>
        <p class="hint">${esc(EXPORT_NOTE)}</p>
        ${statusBlock()}
        <div class="persist">
          <div class="persist__row">
            <span>${esc(PERSIST_LABEL)}</span>
            <span id="persist-state">${
              persisted === null ? '—' : persisted ? esc(PERSIST_YES) : esc(PERSIST_NO)
            }</span>
          </div>
          <p class="hint">${esc(PERSIST_NOTE)}</p>
        </div>
        <button class="btn btn--ghost btn--danger" data-act="erase">Стереть всё</button>
        <div class="safety">${esc(SAFETY_NOTE)}</div>
      </div>`;
  },

  about() {
    return `
      <div class="screen">
        <button class="back" data-act="back">‹ назад</button>
        <header class="head">
          <div class="eyebrow">опора</div>
          <h1>О приложении</h1>
        </header>
        <p>
          Это набор техник, которые помогают пережить тяжёлые минуты, и место,
          где можно собрать свои собственные слова заранее.
        </p>
        <p class="muted small">
          Приложение не ставит диагнозов, ничего не считает и никуда не отправляет.
          Все записи хранятся в этом браузере на этом телефоне — в двух местах,
          чтобы пережить очистку одного из них.
        </p>
        <p class="muted small">
          Если телефон потеряется или данные браузера сотрут полностью — записи исчезнут.
          Поэтому есть кнопка «Сохранить копию»: файл уходит в мессенджер или в файлы.
        </p>
        <div class="note">
          ${esc(SAFETY_NOTE)}
          Если есть угроза для жизни — это не к приложению, это в скорую.
        </div>
        <div class="safety">
          Версия ${esc(SITE_VERSION)} · работает офлайн
        </div>
      </div>`;
  },
};

/* ------------------------------------------------------------------ */
/*  Мелкие шаблоны                                                     */
/* ------------------------------------------------------------------ */

function skillCard(id, weak = false) {
  const s = SKILLS[id];
  if (!s) return '';
  return `
    <button class="card" data-act="go" data-screen="skill" data-id="${id}">
      <div class="card__title">${esc(s.title)}</div>
      <div class="card__meta">${esc(s.meta)}</div>
      ${s.lead ? `<div class="card__lead">${esc(s.lead)}</div>` : ''}
      ${weak ? `<div class="card__weak">${esc(WEAK_LABEL)}</div>` : ''}
    </button>`;
}

function messagesBlock() {
  return `
    <section class="msgs">
      <h2 class="msgs__title">${esc(MESSAGES_TITLE)}</h2>
      <p class="msgs__hint">${esc(MESSAGES_HINT)}</p>
      <div class="msgs__list">
        ${MESSAGES.map(
          (m) => `
          <button class="msg" data-act="copy" data-id="${m.id}">
            <span class="msg__label">${esc(m.label)}</span>
            <span class="msg__text">${esc(m.text)}</span>
            <span class="msg__state" data-state="${m.id}"></span>
          </button>`,
        ).join('')}
      </div>
    </section>`;
}

function installBlock() {
  if (isStandalone) return '';
  return `
    <div style="height:14px"></div>
    <button class="btn" data-act="install" style="margin-top:14px">
      Поставить на главный экран
    </button>`;
}

/* ------------------------------------------------------------------ */
/*  Копия и восстановление                                            */
/* ------------------------------------------------------------------ */

function statusBlock() {
  if (!notice) return '';
  return `<p class="status" role="status">${esc(notice)}</p>`;
}

/**
 * Data может пропасть целиком: localStorage вычистили, а IndexedDB
 * не пережила. Если приложением раньше пользовались — говорим прямо
 * и даём кнопку импорта, а не делаем вид, что всё в порядке.
 */
function restoreBanner() {
  if (!isDataEmpty(data)) return '';

  let seen = false;
  try {
    seen = localStorage.getItem(SEEN) === '1';
  } catch {
    seen = false;
  }
  if (!seen) return '';

  return `
    <section class="restore">
      <h2 class="restore__title">${esc(EMPTY_TITLE)}</h2>
      <p class="restore__text">${esc(EMPTY_TEXT)}</p>
      <button class="btn btn--primary" data-act="import">${esc(EMPTY_IMPORT)}</button>
    </section>`;
}

async function refreshPersist() {
  let value = false;
  try {
    if (navigator.storage?.persisted) value = await navigator.storage.persisted();
  } catch {
    value = false;
  }
  persisted = value;
  const el = document.getElementById('persist-state');
  if (el) el.textContent = value ? PERSIST_YES : PERSIST_NO;
}

async function applyImport(file) {
  let text = '';
  try {
    text = await file.text();
  } catch {
    notice = IMPORT_ERR_JSON;
    render();
    return;
  }

  const parsed = parseImport(text);
  if (!parsed.ok) {
    notice =
      {
        json: IMPORT_ERR_JSON,
        app: IMPORT_ERR_APP,
        version: IMPORT_ERR_VERSION,
        data: IMPORT_ERR_DATA,
      }[parsed.error] || IMPORT_ERR_JSON;
    // данные не тронуты: сохранять нечего
    render();
    return;
  }

  const merged = mergeData(data, parsed.data);
  const { fresh, existed } = importCounts(data, merged);
  data = merged;
  save();
  notice = IMPORT_RESULT.replace('{n}', String(fresh)).replace('{m}', String(existed));
  render();
}

/**
 * Копия файла: на телефоне — «Поделиться» (это и есть пересылка себе
 * в избранное), иначе обычное скачивание. Имя — слаг и дата, без
 * русских слов: файл может уехать в чужой чат.
 */
async function saveCopy() {
  const payload = buildExport(data, SITE_VERSION);
  const name = exportName(new Date());
  const file = new File([JSON.stringify(payload, null, 2)], name, {
    type: 'application/json',
  });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      notice = EXPORT_DONE;
      render();
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      /* не вышло поделиться — ниже обычное скачивание */
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    notice = EXPORT_DONE;
  } catch {
    notice = EXPORT_FAILED;
  }
  render();
}

/* ------------------------------------------------------------------ */
/*  Живые экраны                                                       */
/* ------------------------------------------------------------------ */

const MOUNT = {
  breath(id) {
    if (!id || !BREATHS[id]) return;
    startBreath(id);
  },

  timer(id) {
    const s = SKILLS[id];
    const total = (s?.start?.minutes ?? 1) * 60;
    startTimer(total);
  },

  calm() {
    startCalm(CALM_MINUTES * 60);
  },

  write() {
    const ta = document.getElementById('letter');
    if (!ta) return;
    ta.addEventListener('input', () => {
      data.letter = ta.value;
      data.letterTs = Date.now();
      save();
    });
    ta.focus();
  },

  diary() {
    const note = document.getElementById('note');
    if (!note) return;
    note.addEventListener('input', () => {
      draft.note = note.value;
    });
  },

  more() {
    refreshPersist();
  },
};

/* ------------------------------------------------------------------ */
/*  Дыхание                                                           */
/* ------------------------------------------------------------------ */

function startBreath(id) {
  const b = BREATHS[id];
  const circle = document.getElementById('b-circle');
  const label = document.getElementById('b-label');
  const count = document.getElementById('b-count');
  const meta = document.getElementById('b-meta');
  if (!circle || !label || !count) return;

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  keepAwake();

  let phase = 0;
  let cycle = 0;
  let phaseEnd = 0;

  const apply = (p, dur) => {
    label.textContent = p.label;
    if (!calm) {
      circle.style.transitionDuration = dur + 's';
      circle.style.transform = `scale(${p.scale})`;
    }
    if (meta) meta.textContent = `${b.name} · круг ${cycle + 1} из ${b.cycles}`;
  };

  // подготовка
  let prep = 3;
  label.textContent = 'Приготовься';
  count.textContent = String(prep);
  tick = setInterval(() => {
    prep -= 1;
    if (prep > 0) {
      count.textContent = String(prep);
      return;
    }
    clearInterval(tick);
    phaseEnd = performance.now() + b.phases[0].sec * 1000;
    apply(b.phases[0], b.phases[0].sec);
    buzz();

    tick = setInterval(() => {
      const left = Math.max(0, (phaseEnd - performance.now()) / 1000);
      count.textContent = String(Math.ceil(left) || 0);

      if (left <= 0.02) {
        phase += 1;
        if (phase >= b.phases.length) {
          phase = 0;
          cycle += 1;
          if (cycle >= b.cycles) {
            clearInterval(tick);
            tick = null;
            buzz(80);
            go('done', skillCtx);
            return;
          }
        }
        const p = b.phases[phase];
        phaseEnd = performance.now() + p.sec * 1000;
        apply(p, p.sec);
        buzz();
      }
    }, 90);
  }, 1000);
}

function buzz(ms = 25) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* не поддерживается */
  }
}

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    wakeLock = null;
  }
}

function releaseWake() {
  try {
    wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

/* ------------------------------------------------------------------ */
/*  Таймер                                                            */
/* ------------------------------------------------------------------ */

function startTimer(seconds) {
  const out = document.getElementById('t-num');
  if (!out) return;
  keepAwake();

  let left = seconds;
  const draw = () => {
    const m = Math.floor(left / 60);
    const s = left % 60;
    out.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  draw();

  tick = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(tick);
      tick = null;
      buzz(90);
      go('done', skillCtx);
      return;
    }
    draw();
  }, 1000);
}

/**
 * «Просто побыть»: только время. Ни шагов, ни вопросов, ни оценок —
 * по истечении ничего не происходит, экран просто остаётся.
 */
function startCalm(seconds) {
  const out = document.getElementById('c-num');
  if (!out) return;
  keepAwake();

  let left = seconds;
  const draw = () => {
    const m = Math.floor(left / 60);
    const s = left % 60;
    out.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  draw();

  tick = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      out.textContent = '00:00';
      clearInterval(tick);
      tick = null;
      releaseWake();
      return;
    }
    draw();
  }, 1000);
}

/* ------------------------------------------------------------------ */
/*  События                                                           */
/* ------------------------------------------------------------------ */

document.addEventListener('click', async (e) => {
  const tabEl = e.target.closest('[data-tab]');
  if (tabEl) {
    switchTab(tabEl.dataset.tab);
    return;
  }

  const el = e.target.closest('[data-act]');
  if (!el) return;

  const act = el.dataset.act;
  const id = el.dataset.id;

  switch (act) {
    case 'go':
      stepIdx = 0;
      if (el.dataset.screen !== 'card') cardEdit = false;
      if (el.dataset.screen === 'home' || el.dataset.screen === 'triage') skillCtx = null;
      // вошли в навык — после него спросим «помогло?» именно про него
      if (el.dataset.screen === 'skill') skillCtx = id;
      go(el.dataset.screen, id);
      break;

    case 'back':
      back();
      break;

    case 'step-next': {
      const s = SKILLS[current.id];
      if (stepIdx >= s.steps.length - 1) go('done', current.id);
      else {
        stepIdx += 1;
        render();
      }
      break;
    }

    case 'start-skill': {
      const s = SKILLS[id];
      if (!s?.start) break;
      skillCtx = id;
      if (s.start.type === 'breath') go('breath', s.start.id);
      else if (s.start.type === 'grounding') {
        stepIdx = 0;
        go('grounding');
      } else if (s.start.type === 'timer') go('timer', id);
      else if (s.start.type === 'write') go('write');
      break;
    }

    case 'ground-next':
      if (stepIdx >= GROUNDING_STEPS.length - 1) go('done', skillCtx);
      else {
        stepIdx += 1;
        render();
      }
      break;

    case 'breath-stop':
    case 'timer-stop':
    case 'calm-exit':
      clearInterval(tick);
      tick = null;
      releaseWake();
      back();
      break;

    case 'letter-done':
      go('done', skillCtx);
      break;

    case 'letter-clear':
      data.letter = '';
      data.letterTs = Date.now();
      save();
      render();
      break;

    /* -------------------------- сообщения ------------------------ */

    case 'copy': {
      const msg = MESSAGES.find((m) => m.id === id);
      if (!msg) break;
      const ok = await copyText(msg.text);
      const state = el.querySelector('.msg__state');
      if (state) {
        state.textContent = ok ? MESSAGES_COPIED : MESSAGES_FAILED;
        setTimeout(() => {
          if (state.isConnected) state.textContent = '';
        }, 2500);
      }
      break;
    }

    /* -------------------------- память о навыках ----------------- */

    case 'help': {
      data.help = bump(data.help, id, el.dataset.v, Date.now());
      save();
      skillCtx = null;
      current = { name: 'done', id: null };
      render();
      break;
    }

    /* -------------------------- карточка ------------------------- */

    case 'card-edit':
      cardEdit = true;
      render();
      break;

    case 'card-cancel':
      cardEdit = false;
      render();
      break;

    case 'card-save':
      for (const f of CRISIS_FIELDS) {
        const el2 = document.getElementById('f-' + f.key);
        data.card[f.key] = el2 ? el2.value.trim() : '';
      }
      data.cardTs = Date.now();
      save();
      cardEdit = false;
      render();
      break;

    /* -------------------------- контакты ------------------------- */

    case 'contacts-edit':
      contactsEdit = true;
      render();
      break;

    case 'contacts-cancel':
      contactsEdit = false;
      render();
      break;

    case 'contacts-save': {
      const next = data.contacts.map((c) => ({ ...c }));
      document.querySelectorAll('[data-c]').forEach((inp) => {
        const i = Number(inp.dataset.i);
        if (next[i]) next[i][inp.dataset.c] = inp.value.trim();
      });
      data.contacts = next.filter((c) => c.label || c.phone);
      data.contactsTs = Date.now();
      save();
      contactsEdit = false;
      render();
      break;
    }

    case 'contact-add':
      data.contacts.push({ label: '', phone: '', note: '' });
      render();
      break;

    case 'contact-del':
      data.contacts.splice(Number(id), 1);
      render();
      break;

    /* -------------------------- дневник -------------------------- */

    case 'mood':
      draft.mood = Number(el.dataset.v);
      render();
      break;

    case 'tag': {
      const t = el.dataset.tag;
      if (draft.tags.has(t)) draft.tags.delete(t);
      else draft.tags.add(t);
      render();
      break;
    }

    case 'save-entry': {
      if (!draft.mood) {
        el.textContent = 'Сначала выбери, как ты';
        setTimeout(() => {
          el.textContent = 'Сохранить';
        }, 1600);
        break;
      }
      const now = Date.now();
      data.entries.push({
        t: now,
        ts: now,
        mood: draft.mood,
        tags: [...draft.tags],
        note: draft.note.trim(),
      });
      save();
      draft = { mood: null, tags: new Set(), note: '' };
      render();
      break;
    }

    /* -------------------------- прочее --------------------------- */

    case 'erase':
      if (confirm('Стереть все записи, карточку и контакты? Это нельзя отменить.')) {
        try {
          localStorage.removeItem(KEY);
          // отметку «пользовались» тоже: иначе после честной очистки
          // приложение решит, что данные пропали
          localStorage.removeItem(SEEN);
        } catch {
          /* приватный режим */
        }
        await clearData();
        location.reload();
      }
      break;

    case 'export':
      await saveCopy();
      break;

    case 'import': {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) applyImport(file);
      });
      input.click();
      break;
    }

    case 'install':
      promptInstall();
      break;

    case 'close-sheet':
      document.querySelector('.sheet')?.remove();
      break;
  }
});

/* ------------------------------------------------------------------ */
/*  Установка                                                         */
/* ------------------------------------------------------------------ */

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

async function promptInstall() {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
    } catch {
      /* браузер передумал — просто покажем инструкцию ниже */
    }
    deferredPrompt = null;
    return;
  }

  const steps = isIOS
    ? ['Нажми кнопку «Поделиться» внизу экрана',
       'Пролистай и выбери «На экран Домой»',
       'Нажми «Добавить»']
    : ['Открой меню браузера (три точки)',
       'Выбери «Установить приложение» или «На главный экран»',
       'Подтверди'];

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet__inner">
      <h2>Поставить на телефон</h2>
      <ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="muted small">
        Тогда приложение откроется без адресной строки и будет работать без интернета.
      </p>
      <button class="btn btn--primary" data-act="close-sheet">Понятно</button>
    </div>`;
  document.body.appendChild(sheet);
}

/* ------------------------------------------------------------------ */
/*  Старт                                                             */
/* ------------------------------------------------------------------ */

render();

// вторая копия: читаем IndexedDB и сливаем уже после первого экрана,
// чтобы приложение открывалось мгновенно
hydrate();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
