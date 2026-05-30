/**
 * storage.js — localStorage abstraction for Bishcard
 */

const Storage = (() => {
  const KEYS = {
    API_KEY: 'bishcard_api_key',
    MODEL: 'bishcard_model',
    DECKS: 'bishcard_decks',
  };

  function getApiKey() {
    return localStorage.getItem(KEYS.API_KEY) || '';
  }

  function setApiKey(key) {
    if (key) {
      localStorage.setItem(KEYS.API_KEY, key);
    } else {
      localStorage.removeItem(KEYS.API_KEY);
    }
  }

  function clearApiKey() {
    localStorage.removeItem(KEYS.API_KEY);
  }

  function hasApiKey() {
    return !!localStorage.getItem(KEYS.API_KEY);
  }

  function getModel() {
    return localStorage.getItem(KEYS.MODEL) || 'llama-3.3-70b-versatile';
  }

  function setModel(model) {
    localStorage.setItem(KEYS.MODEL, model);
  }

  function getDecks() {
    try {
      const raw = localStorage.getItem(KEYS.DECKS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveDecks(decks) {
    localStorage.setItem(KEYS.DECKS, JSON.stringify(decks));
  }

  function saveDeck(deck) {
    const decks = getDecks();
    const idx = decks.findIndex(d => d.id === deck.id);
    if (idx >= 0) {
      decks[idx] = deck;
    } else {
      decks.unshift(deck);
    }
    saveDecks(decks);
    return deck;
  }

  function deleteDeck(id) {
    const decks = getDecks().filter(d => d.id !== id);
    saveDecks(decks);
  }

  function renameDeck(id, newName) {
    const decks = getDecks();
    const deck = decks.find(d => d.id === id);
    if (deck) {
      deck.name = newName;
      saveDecks(decks);
    }
  }

  function getDeck(id) {
    return getDecks().find(d => d.id === id) || null;
  }

  function createDeck(name, cards) {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      cards,
      createdAt: new Date().toISOString(),
      studiedAt: null,
    };
  }

  function markStudied(id) {
    const decks = getDecks();
    const deck = decks.find(d => d.id === id);
    if (deck) {
      deck.studiedAt = new Date().toISOString();
      saveDecks(decks);
    }
  }

  // ===== SM-2 Spaced Repetition =====
  const SM2_KEY = 'bishcard_sm2';

  function getSm2Store() {
    try { return JSON.parse(localStorage.getItem(SM2_KEY)) || {}; } catch { return {}; }
  }

  function saveSm2Store(data) {
    localStorage.setItem(SM2_KEY, JSON.stringify(data));
  }

  // Stable key for a card — must match Quiz.js cardKey
  function sm2CardKey(card) {
    return card.domanda.slice(0, 80);
  }

  /**
   * Apply SM-2 updates for every card after a completed session.
   * @param {string} deckId
   * @param {Array<{card, quality}>} cardQualities  quality: 1–5
   */
  function updateSm2AfterSession(deckId, cardQualities) {
    const store = getSm2Store();
    if (!store[deckId]) store[deckId] = {};
    const now = new Date();

    cardQualities.forEach(({ card, quality }) => {
      const key = sm2CardKey(card);
      let c = store[deckId][key] || {
        ef: 2.5,           // ease factor
        interval: 0,       // days until next review
        reps: 0,           // consecutive correct answers
        nextReview: null,
        totalOk: 0,
        totalFail: 0,
      };

      if (quality >= 3) {
        if (c.reps === 0)      c.interval = 1;
        else if (c.reps === 1) c.interval = 6;
        else                    c.interval = Math.round(c.interval * c.ef);
        c.ef = Math.max(1.3, c.ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        c.reps++;
        c.totalOk++;
      } else {
        c.interval = 1;
        c.reps = 0;
        c.totalFail++;
      }

      const next = new Date(now);
      next.setDate(next.getDate() + c.interval);
      c.nextReview = next.toISOString();
      store[deckId][key] = c;
    });

    saveSm2Store(store);
  }

  /**
   * Returns SM-2 stats for a deck's card list.
   * dueCount  — cards due for review today (or never studied)
   * masteredCount — cards with ≥3 consecutive correct answers
   */
  function getDeckSm2Stats(deck) {
    const store = getSm2Store();
    const deckData = store[deck.id] || {};
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let dueCount = 0;
    let masteredCount = 0;

    deck.cards.forEach(card => {
      const key = sm2CardKey(card);
      const c = deckData[key];
      if (!c) { dueCount++; return; }          // never studied = due now
      if (c.reps >= 3) masteredCount++;
      if (!c.nextReview || new Date(c.nextReview) <= todayEnd) dueCount++;
    });

    return { dueCount, masteredCount };
  }

  return {
    getApiKey,
    setApiKey,
    clearApiKey,
    hasApiKey,
    getModel,
    setModel,
    getDecks,
    saveDeck,
    deleteDeck,
    renameDeck,
    getDeck,
    createDeck,
    markStudied,
    updateSm2AfterSession,
    getDeckSm2Stats,
  };
})();

window.Storage = Storage;
