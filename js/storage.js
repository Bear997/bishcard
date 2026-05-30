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
  };
})();

window.Storage = Storage;
