/* ============================================================
   app.js — Main Application Entry Point
   ============================================================ */
(function () {
  'use strict';

  function startApp() {
    // التأكد من أن MP_NAV تم تحميلة بالكامل قبل التشغيل
    if (window.MP_NAV && typeof window.MP_NAV.mountShell === 'function') {
      window.MP_NAV.mountShell();
    } else {
      // إعادة المحاولة بعد 100 ملي ثانية لو الملف اتأخر
      setTimeout(startApp, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }
})();