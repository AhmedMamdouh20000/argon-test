// عناصر الواجهة المشتركة: تبديل الثيم بدائرة متوسعة (View Transitions)، الرسائل السريعة (Toast)، والحوارات (Modal/Sheet)
import { html, render } from '../core/util.js';
import { store } from '../core/store.js';

export function applyTheme(theme, { immediate = true } = {}) {
  const root = document.documentElement;
  const resolved = theme === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-theme', resolved);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', resolved === 'dark' ? '#071417' : '#0B7F7A');
  }
}

export async function toggleThemeWithCircle(clickEvent) {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';

  const saveAndApply = () => {
    applyTheme(next);
    store.patch('setting', 'main', { theme: next });
  };

  const prefersReduced = typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced || typeof document.startViewTransition !== 'function') {
    saveAndApply();
    return next;
  }

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (clickEvent && typeof clickEvent.clientX === 'number' && (clickEvent.clientX !== 0 || clickEvent.clientY !== 0)) {
    x = clickEvent.clientX;
    y = clickEvent.clientY;
  } else if (clickEvent?.currentTarget) {
    const rect = clickEvent.currentTarget.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const root = document.documentElement;
  root.setAttribute('data-vt', 'theme');

  try {
    const transition = document.startViewTransition(() => {
      saveAndApply();
    });

    await transition.ready;

    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${Math.ceil(endRadius)}px at ${x}px ${y}px)`
        ]
      },
      {
        duration: 750,
        easing: 'cubic-bezier(.45,0,.15,1)',
        pseudoElement: '::view-transition-new(root)'
      }
    );

    await transition.finished;
  } catch {
    saveAndApply();
  } finally {
    root.removeAttribute('data-vt');
  }

  return next;
}

let toastTimer = null;
export function showToast(msg, duration = 3000) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}

export function openSheet({ title, bodyHtml, onMount, persistent = false }) {
  let dialog = document.getElementById('app-sheet');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'app-sheet';
    dialog.className = 'sheet';
    document.body.appendChild(dialog);
  }

  dialog.dataset.persistent = persistent ? '1' : '0';

  render(
    dialog,
    html`
      <div class="sheet-box">
        <div class="sheet-head">
          <h3 class="sheet-title">${title}</h3>
          ${persistent ? '' : html`<button type="button" class="btn-icon sheet-close" aria-label="إغلاق">✕</button>`}
        </div>
        <div class="sheet-body">${bodyHtml}</div>
      </div>
    `
  );

  const onCancel = (e) => {
    if (dialog.dataset.persistent === '1') {
      e.preventDefault();
    }
  };
  dialog.oncancel = onCancel;

  const onClick = (e) => {
    if (dialog.dataset.persistent === '1') return;
    if (e.target === dialog || e.target.closest('.sheet-close')) {
      closeSheet();
    }
  };
  dialog.onclick = onClick;

  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', 'open');
  }

  // لو في أوفرلاي خاص بفيديو الديمو، نضمن بقاءه في الـ top-layer
  if (typeof window.__ensureDemoPopoversTop === 'function') {
    window.__ensureDemoPopoversTop();
  }

  if (typeof onMount === 'function') {
    onMount(dialog);
  }
  return dialog;
}

export function closeSheet() {
  const dialog = document.getElementById('app-sheet');
  if (!dialog) return;
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}
