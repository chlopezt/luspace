// Blocking, same-origin script: choose the theme before parsing the body.
// Keep this external so the existing CSP does not need unsafe-inline scripts.
(() => {
  let theme = 'system';
  try {
    const saved = localStorage.getItem('luspace-theme');
    if (['light', 'dark', 'system'].includes(saved)) theme = saved;
  } catch {}
  document.documentElement.dataset.theme = theme;
})();
