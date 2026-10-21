/* Общий код для всех страниц: шапка, мобильное меню, баннер cookie */
(() => {
  const $ = (s, el = document) => el.querySelector(s);

  /* ---------- Шапка: состояние при скролле + мобильное меню ---------- */
  const header = $('#header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const burger = $('#burger');
    const nav = $('#nav');
    const closeMenu = () => { nav.classList.remove('is-open'); header.classList.remove('menu-open'); };
    burger.addEventListener('click', () => {
      nav.classList.toggle('is-open');
      header.classList.toggle('menu-open');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  }

  /* ---------- Запасные картинки 3D-фигур ---------- */
  // PNG/WebP-заглушки грузятся, только если 3D не запустилось (нет WebGL или CDN недоступен)
  window.opalFallback = () => {
    document.querySelectorAll('.obj3d:not(.is-3d) img[data-src]').forEach(img => {
      if (!img.getAttribute('src')) img.src = img.dataset.src;
    });
  };
  if (document.querySelector('.obj3d')) {
    setTimeout(() => { if (!document.querySelector('.obj3d.is-3d')) window.opalFallback(); }, 6000);
  }

  /* ---------- Баннер cookie ---------- */
  const KEY = 'tvoya_cookie_consent'; // 'all' | 'necessary'
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* приватный режим */ } };

  function showBanner() {
    if ($('.cookie')) return;
    const el = document.createElement('div');
    el.className = 'cookie';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Уведомление об использовании cookie');
    el.innerHTML = `
      <div class="cookie__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-6 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>
      </div>
      <p class="cookie__text">Мы используем cookie, чтобы сайт работал корректно и становился удобнее. Подробнее — в <a href="cookies.html">политике cookie</a>.</p>
      <div class="cookie__actions">
        <button type="button" class="cookie__btn cookie__btn--ghost" data-consent="necessary">Только необходимые</button>
        <button type="button" class="cookie__btn" data-consent="all">Принять</button>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-shown')));
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-consent]');
      if (!btn) return;
      write(btn.dataset.consent);
      el.classList.remove('is-shown');
      setTimeout(() => el.remove(), 500);
    });
  }

  if (!read()) setTimeout(showBanner, 1200);

  // Кнопка «Изменить настройки cookie» на странице политики
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-cookie-reset]')) return;
    try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
    showBanner();
  });
})();

/* На компьютере ссылка «tel:» часто ничего не открывает — копируем номер и показываем подсказку */
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let tip;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="tel:"]');
    if (!a) return;
    const num = a.getAttribute('href').slice(4);
    const pretty = a.textContent.trim().match(/\+?\d[\d\s()-]{8,}/) ? a.textContent.trim() : num;
    const show = () => {
      if (!tip) {
        tip = document.createElement('div');
        tip.setAttribute('role', 'status');
        tip.style.cssText = 'position:fixed;left:50%;bottom:24px;z-index:99;transform:translate(-50%,20px);opacity:0;padding:12px 18px;border-radius:14px;background:#111;color:#fff;font:500 14px/1.4 Montserrat,system-ui,sans-serif;box-shadow:0 14px 34px -14px rgba(0,0,0,.5);transition:opacity .3s,transform .3s;pointer-events:none';
        document.body.appendChild(tip);
      }
      tip.textContent = `Номер ${pretty} скопирован — позвоните с телефона`;
      requestAnimationFrame(() => { tip.style.opacity = '1'; tip.style.transform = 'translate(-50%,0)'; });
      clearTimeout(tip._t);
      tip._t = setTimeout(() => { tip.style.opacity = '0'; tip.style.transform = 'translate(-50%,20px)'; }, 3200);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(num).then(show, show); else show();
  });
})();
