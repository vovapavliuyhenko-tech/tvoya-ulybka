(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Шапка, мобильное меню и баннер cookie — в common.js (общий для всех страниц)

  /* ---------- Видео: грузим и играем, только когда оно рядом с экраном ---------- */
  const video = $('.visit__video');
  if (video) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!video.src) { video.src = video.dataset.src; video.preload = 'auto'; }
        video.play().catch(() => {});
      } else if (video.src) {
        video.pause();
      }
    }, { rootMargin: '300px 0px' }).observe(video);
  }

  /* ---------- Появление блоков ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* ---------- Счётчик врачей ---------- */
  $$('.counter[data-count]').forEach(el => {
    const target = +el.dataset.count;
    el.textContent = '1';
    const run = () => {
      const start = performance.now(), dur = 1600;
      const tick = now => {
        const p = Math.min(1, (now - start) / dur);
        el.textContent = Math.max(1, Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    new IntersectionObserver((en, o) => {
      if (en[0].isIntersecting) { setTimeout(run, 400); o.disconnect(); }
    }).observe(el);
  });

  /* ---------- До / после: слайдер ---------- */
  const compare = $('#compare');
  let pos = 50;
  const setPos = p => {
    pos = Math.max(0, Math.min(100, p));
    compare.style.setProperty('--pos', pos + '%');
  };
  const fromEvent = e => {
    const r = compare.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  let dragging = false;
  compare.addEventListener('pointerdown', e => {
    dragging = true;
    compare.classList.remove('is-animating');
    compare.setPointerCapture(e.pointerId);
    setPos(fromEvent(e));
  });
  compare.addEventListener('pointermove', e => { if (dragging) setPos(fromEvent(e)); });
  compare.addEventListener('pointerup', () => { dragging = false; });
  compare.addEventListener('pointercancel', () => { dragging = false; });
  $('.compare__handle', compare).addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') setPos(pos - 5);
    if (e.key === 'ArrowRight') setPos(pos + 5);
  });

  const sweep = () => {
    compare.classList.add('is-animating');
    setPos(85);
    setTimeout(() => setPos(50), 750);
    setTimeout(() => compare.classList.remove('is-animating'), 1500);
  };
  new IntersectionObserver((en, o) => {
    if (en[0].isIntersecting) { setTimeout(sweep, 500); o.disconnect(); }
  }, { threshold: 0.5 }).observe(compare);

  /* ---------- До / после: вкладки ---------- */
  // Кейсы — по отзывам «Твоя улыбка» на Яндекс Картах. Фото до/после временные: замените на реальные работы клиники.
  const cases = [
    {
      title: 'Новый винир',
      text: 'Винир раскололся после другой клиники — Рамил Фамилович подробно всё объяснил и сделал его заново, качественно и быстро.',
      labels: ['Работа', 'Итог', 'Врач'],
      visits: 'Винир', term: 'Быстро', price: 'Бабаев Р. Ф.',
      quote: '«Винир сделали заново очень качественно и быстро»', author: 'Пациентка, отзыв на Яндекс Картах',
      before: 'img/wh_before.webp', after: 'img/wh_after.webp', obj: 'img/o_star.webp', shape: 'star'
    },
    {
      title: 'Голливудская улыбка',
      text: 'Всё подробно объяснили, назначили лечение — и пациент получил голливудскую улыбку у доктора Рамила и его команды.',
      labels: ['Работа', 'Итог', 'Врач'],
      visits: 'Эстетика', term: 'Улыбка', price: 'Рамил Ф.',
      quote: '«Теперь у меня голливудская улыбка»', author: 'Сергей Александрович, отзыв на Яндекс Картах',
      before: 'img/vn_before.webp', after: 'img/vn_after.webp', obj: 'img/o_pill.webp', shape: 'veneer'
    }
  ];

  const tabs = $('#caseTabs');
  const tabBg = $('.tabs__bg', tabs);
  const caseCard = $('#caseCard');
  const moveTabBg = btn => {
    tabBg.style.width = btn.offsetWidth + 'px';
    tabBg.style.transform = `translateX(${btn.offsetLeft}px)`;
  };
  const preload = src => { const i = new Image(); i.src = src; };
  cases.forEach(c => { preload(c.before); preload(c.after); preload(c.obj); });

  const showCase = i => {
    const c = cases[i];
    caseCard.classList.add('is-switching');
    compare.classList.add('is-switching');
    setTimeout(() => {
      $('#caseTitle').textContent = c.title;
      $('#caseText').textContent = c.text;
      const labels = c.labels || ['Метод', 'Срок', 'Врач'];
      ['#lbl1', '#lbl2', '#lbl3'].forEach((id, k) => { $(id).textContent = labels[k]; });
      $('#stVisits').textContent = c.visits;
      $('#stTerm').textContent = c.term;
      $('#stPrice').textContent = c.price;
      $('#caseQuote').textContent = c.quote;
      $('#caseAuthor').textContent = c.author;
      // заглушку грузим только если 3D не работает
      const fb = $('#caseObj img');
      fb.dataset.src = c.obj;
      if (!$('#caseObj').classList.contains('is-3d') && fb.getAttribute('src')) fb.src = c.obj;
      if (window.opal3d) window.opal3d.setShape($('#caseObj'), c.shape);
      $('#imgBefore').src = c.before;
      $('#imgAfter').src = c.after;
      caseCard.classList.remove('is-switching');
      compare.classList.remove('is-switching');
      sweep();
    }, 300);
  };

  $$('.tabs__btn', tabs).forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-active')) return;
      $$('.tabs__btn', tabs).forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      moveTabBg(btn);
      showCase(+btn.dataset.case);
    });
  });
  const initTabs = () => moveTabBg($('.tabs__btn.is-active', tabs));
  initTabs();
  window.addEventListener('resize', initTabs);
  document.fonts && document.fonts.ready.then(initTabs);

  /* ---------- Первый визит: шаги загораются по скроллу ---------- */
  // Сплошная линия от центра первого кружка до центра последнего.
  // Анимация работает, только пока блок на экране и линия ещё «доезжает».
  const stepsEl = $('#steps');
  if (stepsEl) {
    const steps = $$('.step', stepsEl);
    const nums = steps.map(s => $('.step__num', s));
    const track = document.createElement('span');
    track.className = 'steps__track';
    track.innerHTML = '<span class="steps__fill"></span><span class="steps__dot"></span>';
    stepsEl.prepend(track);

    let centers = [], top = 0, height = 1, target = 0, shown = 0, running = false, inView = false;
    const layout = () => {
      centers = nums.map(n => n.offsetTop + n.closest('.step').offsetTop + n.offsetHeight / 2);
      top = centers[0];
      height = Math.max(1, centers[centers.length - 1] - top);
      track.style.top = top + 'px';
      track.style.height = height + 'px';
    };
    const measure = () => {
      const mark = window.innerHeight * 0.58;                 // «линия чтения» на экране
      const r = stepsEl.getBoundingClientRect();
      target = Math.max(0, Math.min(1, (mark - (r.top + top)) / height));
    };
    const paint = () => {
      track.style.setProperty('--p', shown.toFixed(4));
      track.style.setProperty('--dot', shown > 0.01 && shown < 0.99 ? 1 : 0);
      steps.forEach((s, i) => {
        const reached = (shown > 0.0005 || target > 0) && (centers[i] - top) / height <= shown + 0.001;
        if (reached !== s.classList.contains('is-active')) s.classList.toggle('is-active', reached);
      });
    };
    const tick = () => {
      shown += (target - shown) * 0.14;
      const done = Math.abs(target - shown) < 0.0005;
      if (done) shown = target;
      paint();
      if (done) { running = false; return; }   // догнали — останавливаемся до следующей прокрутки
      requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!inView) return;
      measure();
      if (!running) { running = true; requestAnimationFrame(tick); }
    };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) kick(); }, { rootMargin: '100px 0px' }).observe(stepsEl);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', () => { layout(); kick(); });
    document.fonts && document.fonts.ready.then(() => { layout(); kick(); });
    layout();
  }

  /* ---------- Бегущие ленты: отзывы и логотипы в подвале ---------- */
  // Скорость в пикселях в секунду (одинаково на 30 и 120 Гц), ширина читается
  // один раз и при ресайзе — без пересчёта раскладки в каждом кадре.
  // Ленты работают и при «уменьшении движения» на телефоне — они медленные и плавные.
  const isMouse = e => e.pointerType === 'mouse';
  function runBelt(track, { speed, dir = -1, copies = 2, hoverSlow = 0, observe }) {
    let x = 0, cur = speed, want = speed, last = performance.now(), visible = false, period = 1;
    const measureBelt = () => {
      period = track.scrollWidth / copies;
      if (dir === 1 && x === 0) x = -period;
    };
    measureBelt();
    window.addEventListener('resize', measureBelt);
    document.fonts && document.fonts.ready.then(measureBelt);
    if (hoverSlow) {
      observe.addEventListener('pointerenter', e => { if (isMouse(e)) want = speed * hoverSlow; });
      observe.addEventListener('pointerleave', e => { if (isMouse(e)) want = speed; });
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { last = performance.now(); requestAnimationFrame(step); }
    }, { rootMargin: '50px 0px' }).observe(observe);
    function step(now) {
      if (!visible) return;                       // вне экрана — не крутим
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      cur += (want - cur) * Math.min(1, dt * 4);
      x += cur * dt * dir;
      if (x <= -period) x += period;
      if (x >= 0) x -= period;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      requestAnimationFrame(step);
    }
  }

  $$('.marquee__track').forEach(track => {
    track.innerHTML += track.innerHTML;           // дубль для бесшовной прокрутки
    $$('.review', track).slice(track.children.length / 2).forEach(el => el.setAttribute('aria-hidden', 'true'));
    runBelt(track, {
      speed: 22,
      dir: track.dataset.dir === 'right' ? 1 : -1,
      copies: 2,
      hoverSlow: 0.0001,                          // мышью — пауза при наведении
      observe: track.parentElement
    });
  });

  const ticker = $('.footer__ticker');
  if (ticker) {
    runBelt($('.footer__track', ticker), { speed: 60, dir: -1, copies: 3, hoverSlow: 0.25, observe: ticker });
  }


  /* ---------- Форма записи ---------- */
  const phone = $('#phone');
  const formatPhone = v => {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1);
    d = d.slice(0, 10);
    const t = '(___) ___-__-__'.split('');
    let k = 0;
    for (let i = 0; i < t.length && k < d.length; i++) if (t[i] === '_') t[i] = d[k++];
    return { text: '+7 ' + t.join(''), digits: d };
  };
  phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+7 '; });
  phone.addEventListener('blur', () => { if (phone.value.replace(/\D/g, '').length <= 1) phone.value = ''; });
  phone.addEventListener('input', () => {
    const { text, digits } = formatPhone(phone.value);
    const filled = text.slice(0, text.search(/_|$/));
    phone.value = digits.length ? filled.replace(/[\s()-]+$/, '') : '+7 ';
  });

  /* ---------- Выпадающий список в стиле сайта ---------- */
  $$('.select').forEach(sel => {
    const btn = $('.select__btn', sel);
    const list = $('.select__list', sel);
    const input = $('input[type=hidden]', sel);
    const value = $('.select__value', sel);
    const opts = $$('.select__opt', sel);
    let active = Math.max(0, opts.findIndex(o => o.getAttribute('aria-selected') === 'true'));

    const highlight = i => {
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.classList.toggle('is-active', k === active));
      opts[active].scrollIntoView({ block: 'nearest' });
    };
    const open = () => {
      sel.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      highlight(active);
    };
    const close = () => {
      sel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    };
    const choose = i => {
      opts.forEach(o => o.setAttribute('aria-selected', 'false'));
      opts[i].setAttribute('aria-selected', 'true');
      value.textContent = opts[i].textContent;
      input.value = opts[i].textContent;
      active = i;
      close();
      btn.focus();
    };

    btn.addEventListener('click', () => (sel.classList.contains('is-open') ? close() : open()));
    opts.forEach((o, i) => {
      o.addEventListener('click', () => choose(i));
      o.addEventListener('pointermove', () => highlight(i));
    });
    sel.addEventListener('keydown', e => {
      const isOpen = sel.classList.contains('is-open');
      if (e.key === 'ArrowDown') { e.preventDefault(); isOpen ? highlight(active + 1) : open(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); isOpen ? highlight(active - 1) : open(); }
      else if ((e.key === 'Enter' || e.key === ' ') && isOpen) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') close();
    });
    document.addEventListener('pointerdown', e => { if (!sel.contains(e.target)) close(); });
    // при прокрутке страницы список не должен «висеть» поверх контента
    let openY = 0;
    btn.addEventListener('click', () => { openY = window.scrollY; });
    window.addEventListener('scroll', () => {
      if (sel.classList.contains('is-open') && Math.abs(window.scrollY - openY) > 60) close();
    }, { passive: true });
  });

  const form = $('#form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.elements.name;
    const okName = name.value.trim().length > 1;
    const okPhone = phone.value.replace(/\D/g, '').length === 11;
    const consent = form.elements.consent;
    const okConsent = consent.checked;
    name.closest('.field').classList.toggle('is-error', !okName);
    phone.closest('.field').classList.toggle('is-error', !okPhone);
    consent.closest('.consent').classList.toggle('is-error', !okConsent);
    if (!okName || !okPhone || !okConsent) return;
    // Здесь можно отправить заявку на сервер / в Telegram.
    form.classList.add('is-sent');
    form.reset();
  });
  $$('.field input', form).forEach(i => i.addEventListener('input', () => i.closest('.field').classList.remove('is-error')));
  form.elements.consent.addEventListener('change', e => e.target.closest('.consent').classList.remove('is-error'));
})();
