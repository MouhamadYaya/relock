/*
 * Mobile navigation drawer.
 *
 * The markup is a plain <details>, so the menu already opens and closes with
 * JavaScript disabled. Everything below is enhancement: Escape to close,
 * backdrop taps, background scroll-lock, focus handling, and closing the
 * drawer when an in-page anchor is followed.
 */
(function () {
  var menu = document.querySelector('.rl-menu');
  if (!menu) return;

  var burger = menu.querySelector('summary');
  var panel = menu.querySelector('.rl-menu__panel');
  var backdrop = menu.querySelector('.rl-menu__backdrop');
  if (!burger || !panel) return;

  var desktop = window.matchMedia('(min-width: 961px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var scrollY = 0;
  var locked = false;

  function lock() {
    if (locked) return;
    scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    locked = true;
  }

  function unlock(restoreScroll) {
    if (!locked) return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    locked = false;
    if (restoreScroll !== false) {
      // `html` scrolls smoothly, which would animate the restore.
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    }
  }

  function close(options) {
    if (!menu.open) return;
    menu.open = false;
    unlock(!options || options.restoreScroll !== false);
    if (options && options.focusBurger) burger.focus();
  }

  menu.addEventListener('toggle', function () {
    if (menu.open) {
      lock();
      var first = panel.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    } else {
      unlock(true);
    }
  });

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      close({ focusBurger: true });
    });
  }

  document.addEventListener('keydown', function (event) {
    if (!menu.open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close({ focusBurger: true });
      return;
    }

    if (event.key !== 'Tab') return;

    // Keep focus inside the drawer while it covers the page.
    var focusable = [burger].concat(
      Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled])')),
    );
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  panel.addEventListener('click', function (event) {
    var link = event.target.closest('a');
    if (!link || !link.href) return;

    var target = new URL(link.href, window.location.href);
    var samePage =
      target.origin === window.location.origin &&
      target.pathname === window.location.pathname &&
      target.hash;

    if (!samePage) {
      // Leaving the page: drop the lock so a bfcache restore is not stuck.
      close({ restoreScroll: false });
      return;
    }

    // An in-page anchor: close first, then scroll ourselves, otherwise the
    // scroll-lock would swallow the jump.
    event.preventDefault();
    var section = document.getElementById(decodeURIComponent(target.hash.slice(1)));
    close();
    if (window.history.pushState) window.history.pushState(null, '', target.hash);
    if (section) {
      section.scrollIntoView({
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  });

  // Rotating to a width where the full navbar returns leaves no way to close.
  desktop.addEventListener('change', function (event) {
    if (event.matches) close();
  });

  // Restoring from the back/forward cache must never leave the body locked.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) close({ restoreScroll: false });
  });
})();
