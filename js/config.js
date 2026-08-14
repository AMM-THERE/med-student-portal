/* ============================================================
   config.js — Constants, storage keys, defaults
   ============================================================ */
(function (global) {
  'use strict';

  // ---- Predefined admin emails (lowercased + trimmed) ----
  // Edit this list to grant admin privileges. Matching is case-insensitive.
  const ADMIN_EMAILS = [
    'admin@medcollege.edu',
    'superadmin@medcollege.edu'
  ];

  // ---- Academic years (used everywhere: registration, badges, filters) ----
  const ACADEMIC_YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Intern'];

  // ---- Default subjects (lecture filter suggestions; users can also type freeform) ----
  const DEFAULT_SUBJECTS = [
    'Anatomy', 'Physiology', 'Biochemistry', 'Pathology',
    'Pharmacology', 'Microbiology', 'Community Medicine',
    'Medicine', 'Surgery', 'Pediatrics', 'OBG', 'Other'
  ];

  // ---- localStorage keys (prefixed to avoid collisions) ----
  const KEYS = {
    USERS:    'medportal_users',
    SESSION:  'medportal_session',
    LECTURES: 'medportal_lectures',
    MESSAGES: 'medportal_messages',
    QUIZZES:  'medportal_quizzes',
    PREFS:    'medportal_prefs'
  };

  // ---- Limits ----
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024;   // 2MB cap for chat images
  const CHAT_POLL_MS    = 3000;              // poll interval for simulated real-time
  const FONT_MIN        = 0.85;
  const FONT_MAX        = 1.25;
  const FONT_STEP       = 0.05;

  // ---- Default preferences ----
  const DEFAULT_PREFS = {
    theme: 'light',         // 'light' | 'dark'
    fontScale: 1.0,
    defaultAnonymous: false
  };

  // ---- Tab ids ----
  const TABS = {
    LECTURES: 'lectures',
    CHAT:     'chat',
    QUIZ:     'quiz'
  };

  global.MP_CONFIG = {
    ADMIN_EMAILS,
    ACADEMIC_YEARS,
    DEFAULT_SUBJECTS,
    KEYS,
    MAX_IMAGE_BYTES,
    CHAT_POLL_MS,
    FONT_MIN,
    FONT_MAX,
    FONT_STEP,
    DEFAULT_PREFS,
    TABS
  };
})(window);
