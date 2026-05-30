/**
 * quiz.js — Infinite study mode quiz with SM-2 quality tracking
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

  // Stable key for a card — must match Storage.sm2CardKey
  function cardKey(card) {
    return card.domanda.slice(0, 80);
  }

  /**
   * Start a new quiz session.
   * All cards are shuffled into the first round queue.
   */
  function start(deck, shouldShuffle = true) {
    const allCards = [...deck.cards];
    state = {
      deckId: deck.id,
      deckName: deck.name,
      allCards,
      totalCards: allCards.length,
      queue: shouldShuffle ? shuffle([...allCards]) : [...allCards],
      wrongThisRound: [],              // cards answered wrong this round → next round queue
      currentIndex: 0,
      round: 1,
      masteredRound: {},               // cardKey → round number when first mastered
    };
  }

  function isActive() {
    return state !== null;
  }

  function getCurrentCard() {
    if (!state || isRoundDone()) return null;
    return state.queue[state.currentIndex];
  }

  function isRoundDone() {
    return state !== null && state.currentIndex >= state.queue.length;
  }

  // Session ends when a round finishes with zero wrong answers
  function isSessionDone() {
    return isRoundDone() && state.wrongThisRound.length === 0;
  }

  function getProgress() {
    if (!state) return { current: 0, total: 0, round: 1, percent: 0, totalCards: 0, masteredCount: 0 };
    const total = state.queue.length;
    const current = Math.min(state.currentIndex + 1, total);
    return {
      current,
      total,
      round: state.round,
      percent: total > 0 ? Math.round((state.currentIndex / total) * 100) : 100,
      totalCards: state.totalCards,
      masteredCount: Object.keys(state.masteredRound).length,
    };
  }

  function markCorrect() {
    if (!state || isRoundDone()) return;
    const card = state.queue[state.currentIndex];
    const key = cardKey(card);
    // Record only the first round it was answered correctly
    if (!(key in state.masteredRound)) {
      state.masteredRound[key] = state.round;
    }
    state.currentIndex++;
  }

  function markWrong() {
    if (!state || isRoundDone()) return;
    const card = state.queue[state.currentIndex];
    state.wrongThisRound.push(card);
    state.currentIndex++;
  }

  // Transition to next round — returns false if session is already done
  function startNextRound() {
    if (!isRoundDone() || isSessionDone()) return false;
    state.round++;
    state.queue = shuffle([...state.wrongThisRound]);
    state.wrongThisRound = [];
    state.currentIndex = 0;
    return true;
  }

  // Snapshot for the between-rounds screen
  function getRoundSummary() {
    if (!state) return null;
    return {
      round: state.round,
      wrongCount: state.wrongThisRound.length,
      masteredCount: Object.keys(state.masteredRound).length,
      totalCards: state.totalCards,
    };
  }

  // Full results at session end, including SM-2 quality per card
  function getSessionResults() {
    if (!state) return null;
    const masteredFirst = Object.values(state.masteredRound).filter(r => r === 1).length;

    // SM-2 quality: round 1 = 5 (perfect recall), round 2 = 4, round 3+ = 3
    const cardQualities = state.allCards.map(card => {
      const key = cardKey(card);
      const round = state.masteredRound[key];
      const quality = round ? Math.max(3, 6 - round) : 1;
      return { card, quality };
    });

    // Cards that needed more than one round to master
    const multiRoundCards = state.allCards.filter(card => {
      const key = cardKey(card);
      return state.masteredRound[key] && state.masteredRound[key] > 1;
    });

    return {
      deckId: state.deckId,
      deckName: state.deckName,
      totalCards: state.totalCards,
      rounds: state.round,
      masteredFirst,
      cardQualities,
      multiRoundCards,
    };
  }

  function reset() {
    state = null;
  }

  return {
    start,
    isActive,
    getCurrentCard,
    isRoundDone,
    isSessionDone,
    getProgress,
    markCorrect,
    markWrong,
    startNextRound,
    getRoundSummary,
    getSessionResults,
    reset,
  };
})();

window.Quiz = Quiz;
