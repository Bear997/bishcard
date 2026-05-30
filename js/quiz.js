/**
 * quiz.js — Quiz state machine
 */

const Quiz = (() => {
  let state = null;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start(deck, shouldShuffle = true) {
    const cards = shouldShuffle ? shuffle(deck.cards) : [...deck.cards];
    state = {
      deckId: deck.id,
      deckName: deck.name,
      cards,
      currentIndex: 0,
      score: 0,
      wrong: [],
    };
  }

  function isActive() {
    return state !== null;
  }

  function isFinished() {
    return state && state.currentIndex >= state.cards.length;
  }

  function getCurrentCard() {
    if (!state || isFinished()) return null;
    return state.cards[state.currentIndex];
  }

  function getProgress() {
    if (!state) return { current: 0, total: 0, percent: 0 };
    return {
      current: state.currentIndex + 1,
      total: state.cards.length,
      percent: Math.round((state.currentIndex / state.cards.length) * 100),
    };
  }

  function getScore() {
    return state ? state.score : 0;
  }

  function markCorrect() {
    if (!state || isFinished()) return;
    state.score++;
    state.currentIndex++;
  }

  function markWrong() {
    if (!state || isFinished()) return;
    state.wrong.push(state.cards[state.currentIndex]);
    state.currentIndex++;
  }

  function getResults() {
    if (!state) return null;
    const total = state.cards.length;
    const knew = state.score;
    const didnt = total - knew;
    const percent = total > 0 ? Math.round((knew / total) * 100) : 0;
    return {
      deckId: state.deckId,
      deckName: state.deckName,
      total,
      knew,
      didnt,
      percent,
      wrong: state.wrong,
    };
  }

  function reset() {
    state = null;
  }

  return {
    start,
    isActive,
    isFinished,
    getCurrentCard,
    getProgress,
    getScore,
    markCorrect,
    markWrong,
    getResults,
    reset,
  };
})();

window.Quiz = Quiz;
