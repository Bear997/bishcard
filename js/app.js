/**
 * app.js — Bishcard main controller
 */

(function () {
  'use strict';

  // ===== State =====
  let selectedFile = null;
  let generatedCards = [];
  let pendingDeckName = '';
  let currentQuizDeckId = null;
  let lastSavedDeckId = null;
  let renamingDeckId = null;
  let deletingDeckId = null;

  // ===== DOM helpers =====
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  // ===== Toast =====
  function toast(message, type = 'info', duration = 4000) {
    const container = $('toast-container');
    const icons = {
      success: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>`,
      error: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('hiding');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ===== View Routing =====
  const views = ['home', 'settings', 'generate', 'decks', 'quiz'];

  function showView(name) {
    views.forEach(v => {
      const el = $(`view-${v}`);
      if (el) el.hidden = v !== name;
    });

    // Update nav active state
    $$('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === name);
    });

    // Side effects per view
    if (name === 'home') renderRecentDecks();
    if (name === 'decks') renderDecksPage();
    if (name === 'settings') loadSettingsForm();
  }

  // ===== Settings =====
  function loadSettingsForm() {
    const keyInput = $('api-key-input');
    const modelSelect = $('model-select');
    const apiKey = Storage.getApiKey();

    if (apiKey) {
      keyInput.value = apiKey;
    }

    const savedModel = Storage.getModel();
    if (modelSelect) modelSelect.value = savedModel;

    updateApiKeyBadge();
  }

  function updateApiKeyBadge() {
    const badge = $('api-key-badge');
    if (badge) badge.hidden = !Storage.hasApiKey();
  }

  function initSettings() {
    const saveBtn = $('save-key-btn');
    const clearBtn = $('clear-key-btn');
    const toggleBtn = $('toggle-key-visibility');
    const keyInput = $('api-key-input');
    const keyStatus = $('key-status');
    const saveModelBtn = $('save-model-btn');

    saveBtn.addEventListener('click', () => {
      const key = keyInput.value.trim();
      if (!key) {
        showKeyStatus('Inserisci una API key valida', 'cleared');
        return;
      }
      if (!key.startsWith('gsk_')) {
        toast('La chiave Groq dovrebbe iniziare con "gsk_"', 'warning');
      }
      Storage.setApiKey(key);
      showKeyStatus('Chiave salvata con successo!', 'saved');
      updateApiKeyBadge();
      toast('API key salvata', 'success');
    });

    clearBtn.addEventListener('click', () => {
      Storage.clearApiKey();
      keyInput.value = '';
      showKeyStatus('Chiave rimossa', 'cleared');
      updateApiKeyBadge();
      toast('API key rimossa', 'info');
    });

    toggleBtn.addEventListener('click', () => {
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = isPassword
        ? `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });

    saveModelBtn.addEventListener('click', () => {
      const model = $('model-select').value;
      Storage.setModel(model);
      toast('Modello salvato', 'success');
    });

    function showKeyStatus(msg, type) {
      keyStatus.textContent = (type === 'saved' ? '✓ ' : '✗ ') + msg;
      keyStatus.className = `key-status key-status--${type}`;
      show(keyStatus);
    }
  }

  // ===== File Upload =====
  function initUpload() {
    const zone = $('upload-zone');
    const fileInput = $('file-input');
    const generateBtn = $('generate-btn');
    const removeBtn = $('remove-file-btn');
    const fileNameSpan = $('file-name');
    const fileInfoDiv = $('file-selected-info');
    const countDec = $('count-dec');
    const countInc = $('count-inc');
    const countInput = $('card-count');

    // Drag & drop
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    ['dragleave', 'dragend'].forEach(ev =>
      zone.addEventListener(ev, () => zone.classList.remove('drag-over'))
    );

    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    });

    // Click to browse
    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) handleFileSelect(file);
    });

    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      selectedFile = null;
      fileInput.value = '';
      hide(fileInfoDiv);
      generateBtn.disabled = true;
    });

    // Number spinner
    countDec.addEventListener('click', () => {
      const v = parseInt(countInput.value) || 15;
      if (v > parseInt(countInput.min)) countInput.value = v - 1;
    });

    countInc.addEventListener('click', () => {
      const v = parseInt(countInput.value) || 15;
      if (v < parseInt(countInput.max)) countInput.value = v + 1;
    });

    countInput.addEventListener('change', () => {
      let v = parseInt(countInput.value) || 15;
      v = Math.max(parseInt(countInput.min), Math.min(parseInt(countInput.max), v));
      countInput.value = v;
    });

    generateBtn.addEventListener('click', startGeneration);

    function handleFileSelect(file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast('Seleziona un file PDF valido', 'error');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast('Il file è troppo grande (max 50 MB)', 'error');
        return;
      }
      selectedFile = file;
      fileNameSpan.textContent = file.name;
      show(fileInfoDiv);
      generateBtn.disabled = false;
    }
  }

  // ===== Generation Flow =====
  async function startGeneration() {
    if (!selectedFile) return;

    if (!Storage.hasApiKey()) {
      toast('Imposta prima la tua Groq API key nelle impostazioni', 'warning');
      showView('settings');
      return;
    }

    const count = parseInt($('card-count').value) || 15;

    // Switch to generate view
    showView('generate');
    setGenStep('extract');
    showGenSpinner(true);
    hide($('gen-preview'));
    hide($('truncate-warning'));
    hide($('gen-error'));
    // Reset post-save state if re-generating
    hide($('save-success'));
    show($('save-deck-card'));

    let extractedText = '';
    let truncated = false;

    // ---- Step 1: Extract text ----
    setGenStatus('Estrazione testo dal PDF...', '');
    show($('gen-progress-wrap'));
    setGenProgress(0);

    try {
      const result = await PdfExtractor.extractText(selectedFile, (current, total) => {
        setGenStatus(
          `Analisi pagine...`,
          `Pagina ${current} di ${total}`
        );
        setGenProgress(Math.round((current / total) * 100));
      });

      extractedText = result.text;
      truncated = result.truncated;

      setGenProgress(100);
      setGenStep('generate', true);

    } catch (err) {
      showGenError(err.message);
      return;
    }

    if (truncated) {
      show($('truncate-warning'));
    }

    // ---- Step 2: Generate via Groq ----
    setGenStatus('Generazione flashcard con l\'AI...', 'Potrebbe richiedere qualche secondo');
    hide($('gen-progress-wrap'));
    setGenStep('generate');

    try {
      const apiKey = Storage.getApiKey();
      const model = Storage.getModel();
      generatedCards = await GroqApi.generateFlashcards(extractedText, count, apiKey, model);
    } catch (err) {
      showGenError(err.message);
      return;
    }

    // ---- Step 3: Review ----
    setGenStep('review', true);
    showGenSpinner(false);
    setGenStatus(`${generatedCards.length} flashcard generate con successo!`, '');

    renderGeneratedCards();
    show($('gen-preview'));

    // Suggest a deck name from filename
    const baseName = selectedFile.name.replace(/\.pdf$/i, '').slice(0, 60);
    $('deck-name-input').value = baseName;
  }

  function setGenStep(step, done = false) {
    const steps = ['extract', 'generate', 'review'];
    const current = steps.indexOf(step);
    steps.forEach((s, i) => {
      const el = $(`step-${s}`);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i < current || (i === current && done)) el.classList.add('done');
      else if (i === current && !done) el.classList.add('active');
    });
  }

  function setGenStatus(text, detail) {
    $('gen-status-text').textContent = text;
    $('gen-status-detail').textContent = detail || '';
  }

  function setGenProgress(percent) {
    $('gen-progress-bar').style.width = `${percent}%`;
  }

  function showGenSpinner(visible) {
    $('gen-spinner').style.display = visible ? '' : 'none';
  }

  function showGenError(msg) {
    showGenSpinner(false);
    $('gen-error-text').textContent = msg;
    show($('gen-error'));
    setGenStatus('Si è verificato un errore', '');
  }

  function renderGeneratedCards() {
    const list = $('gen-flashcard-list');
    $('gen-count').textContent = generatedCards.length;
    list.innerHTML = generatedCards.map((c, i) => `
      <div class="preview-static-item" role="button" tabindex="0" aria-expanded="false">
        <div class="preview-static-q">
          <span class="preview-num">${i + 1}</span>
          <span>${escapeHtml(c.domanda)}</span>
          <svg class="preview-static-chevron" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
        </div>
        <div class="preview-static-a">
          <span class="preview-static-a-label">R</span>${escapeHtml(c.risposta)}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.preview-static-item').forEach(card => {
      card.addEventListener('click', () => {
        const open = card.classList.toggle('revealed');
        card.setAttribute('aria-expanded', String(open));
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });
  }

  function initGenerateView() {
    $('regenerate-btn').addEventListener('click', () => {
      if (selectedFile) startGeneration();
      else {
        showView('home');
        toast('Seleziona un nuovo PDF', 'info');
      }
    });

    $('back-home-btn').addEventListener('click', () => showView('home'));

    $('save-deck-btn').addEventListener('click', saveDeck);

    $('deck-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveDeck();
    });

    $('study-now-btn').addEventListener('click', () => {
      if (lastSavedDeckId) startQuiz(lastSavedDeckId);
    });
  }

  function saveDeck() {
    const name = $('deck-name-input').value.trim();
    if (!name) {
      toast('Dai un nome al mazzo prima di salvarlo', 'warning');
      $('deck-name-input').focus();
      return;
    }
    if (generatedCards.length === 0) {
      toast('Nessuna flashcard da salvare', 'error');
      return;
    }

    const deck = Storage.createDeck(name, generatedCards);
    Storage.saveDeck(deck);
    lastSavedDeckId = deck.id;

    // Reset upload state
    selectedFile = null;
    generatedCards = [];
    if ($('file-input')) $('file-input').value = '';

    // Show success panel in place of the save form
    hide($('save-deck-card'));
    $('save-success-name').textContent = name;
    show($('save-success'));
  }

  // ===== Decks Page =====
  function renderDecksPage() {
    const decks = Storage.getDecks();
    const grid = $('decks-grid');
    const emptyState = $('decks-empty');
    const countLabel = $('decks-count-label');

    countLabel.textContent = decks.length === 0
      ? 'Nessun mazzo salvato'
      : `${decks.length} mazzo${decks.length !== 1 ? 'i' : ''} salvato${decks.length !== 1 ? 'i' : ''}`;

    if (decks.length === 0) {
      show(emptyState);
      grid.innerHTML = '';
      return;
    }

    hide(emptyState);
    grid.innerHTML = decks.map(deck => renderDeckCard(deck)).join('');

    // Attach events
    grid.querySelectorAll('[data-deck-study]').forEach(btn => {
      btn.addEventListener('click', () => startQuiz(btn.dataset.deckStudy));
    });
    grid.querySelectorAll('[data-deck-rename]').forEach(btn => {
      btn.addEventListener('click', () => openRenameModal(btn.dataset.deckRename));
    });
    grid.querySelectorAll('[data-deck-delete]').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.deckDelete));
    });
  }

  function renderDeckCard(deck) {
    const date = new Date(deck.createdAt).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const cardCount = deck.cards.length;
    const studied = deck.studiedAt
      ? new Date(deck.studiedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
      : null;

    const sm2 = Storage.getDeckSm2Stats(deck);
    const sm2Html = renderSm2Badges(sm2, cardCount);

    return `
      <div class="deck-card">
        <div class="deck-card-name" title="${escapeHtml(deck.name)}">${escapeHtml(deck.name)}</div>
        <div class="deck-card-meta">
          <span>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
            ${cardCount} carte
          </span>
          <span>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${date}
          </span>
          ${studied ? `<span title="Ultima sessione">✓ ${studied}</span>` : ''}
        </div>
        ${sm2Html}
        <div class="deck-card-actions">
          <button class="btn btn-primary btn-sm" data-deck-study="${escapeHtml(deck.id)}">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21"/></svg>
            Studia
          </button>
          <div class="deck-card-icon-actions">
            <button class="btn-icon" data-deck-rename="${escapeHtml(deck.id)}" title="Rinomina">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon btn-danger-ghost" data-deck-delete="${escapeHtml(deck.id)}" title="Elimina">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSm2Badges({ dueCount, masteredCount }, totalCards) {
    if (masteredCount === 0 && dueCount === 0) return '';

    const badges = [];

    if (dueCount > 0) {
      badges.push(`
        <span class="sm2-badge sm2-badge--due">
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${dueCount} da rivedere oggi
        </span>
      `);
    }

    if (masteredCount > 0) {
      const allMastered = masteredCount >= totalCards;
      badges.push(`
        <span class="sm2-badge ${allMastered ? 'sm2-badge--all-mastered' : 'sm2-badge--mastered'}">
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>
          ${allMastered ? 'Tutto padroneggiato!' : `${masteredCount} padroneggiate`}
        </span>
      `);
    }

    return `<div class="deck-sm2-stats">${badges.join('')}</div>`;
  }

  function renderRecentDecks() {
    const decks = Storage.getDecks().slice(0, 3);
    const section = $('recent-section');
    const grid = $('recent-decks-grid');

    if (decks.length === 0) {
      hide(section);
      return;
    }

    show(section);
    grid.innerHTML = decks.map(deck => renderDeckCard(deck)).join('');

    grid.querySelectorAll('[data-deck-study]').forEach(btn => {
      btn.addEventListener('click', () => startQuiz(btn.dataset.deckStudy));
    });
    grid.querySelectorAll('[data-deck-rename]').forEach(btn => {
      btn.addEventListener('click', () => openRenameModal(btn.dataset.deckRename));
    });
    grid.querySelectorAll('[data-deck-delete]').forEach(btn => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.deckDelete));
    });
  }

  // ===== Modals =====
  function openRenameModal(deckId) {
    renamingDeckId = deckId;
    const deck = Storage.getDeck(deckId);
    if (!deck) return;
    $('rename-input').value = deck.name;
    show($('rename-modal'));
    setTimeout(() => $('rename-input').focus(), 50);
  }

  function closeRenameModal() {
    hide($('rename-modal'));
    renamingDeckId = null;
  }

  function confirmRename() {
    if (!renamingDeckId) return;
    const newName = $('rename-input').value.trim();
    if (!newName) {
      toast('Il nome non può essere vuoto', 'warning');
      return;
    }
    Storage.renameDeck(renamingDeckId, newName);
    toast('Mazzo rinominato', 'success');
    closeRenameModal();
    renderDecksPage();
    renderRecentDecks();
  }

  function openDeleteModal(deckId) {
    deletingDeckId = deckId;
    const deck = Storage.getDeck(deckId);
    if (!deck) return;
    $('delete-deck-name').textContent = deck.name;
    show($('delete-modal'));
  }

  function closeDeleteModal() {
    hide($('delete-modal'));
    deletingDeckId = null;
  }

  function confirmDelete() {
    if (!deletingDeckId) return;
    Storage.deleteDeck(deletingDeckId);
    toast('Mazzo eliminato', 'info');
    closeDeleteModal();
    renderDecksPage();
    renderRecentDecks();
  }

  function initModals() {
    $('rename-modal-close').addEventListener('click', closeRenameModal);
    $('rename-cancel-btn').addEventListener('click', closeRenameModal);
    $('rename-confirm-btn').addEventListener('click', confirmRename);
    $('rename-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmRename();
      if (e.key === 'Escape') closeRenameModal();
    });

    $('delete-modal-close').addEventListener('click', closeDeleteModal);
    $('delete-cancel-btn').addEventListener('click', closeDeleteModal);
    $('delete-confirm-btn').addEventListener('click', confirmDelete);

    // Close modals on overlay click
    $('rename-modal').addEventListener('click', e => {
      if (e.target === $('rename-modal')) closeRenameModal();
    });
    $('delete-modal').addEventListener('click', e => {
      if (e.target === $('delete-modal')) closeDeleteModal();
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('rename-modal').hidden) closeRenameModal();
        if (!$('delete-modal').hidden) closeDeleteModal();
      }
    });
  }

  // ===== Quiz =====
  function startQuiz(deckId) {
    const deck = Storage.getDeck(deckId);
    if (!deck) {
      toast('Mazzo non trovato', 'error');
      return;
    }
    if (!deck.cards || deck.cards.length === 0) {
      toast('Questo mazzo non ha flashcard', 'error');
      return;
    }

    currentQuizDeckId = deckId;
    Quiz.start(deck);
    showView('quiz');
    renderQuizCard();
  }

  function renderQuizCard() {
    const card = Quiz.getCurrentCard();
    const progress = Quiz.getProgress();

    // Update header
    $('quiz-deck-name').textContent = Storage.getDeck(currentQuizDeckId)?.name || '';
    $('quiz-score-text').textContent = progress.masteredCount;

    // Progress label: show round when > 1
    if (progress.round > 1) {
      $('quiz-progress-label').textContent = `Giro ${progress.round} — ${progress.current} / ${progress.total}`;
    } else {
      $('quiz-progress-label').textContent = `${progress.current} / ${progress.total}`;
    }

    $('quiz-progress-bar').style.width = `${progress.percent}%`;

    // Set card content and reset flip
    $('flashcard-question').textContent = card.domanda;
    $('flashcard-answer').textContent = card.risposta;
    $('flashcard').classList.remove('flipped');

    // Show question controls, hide everything else
    show($('flashcard-wrap'));
    show($('quiz-btn-reveal-wrap'));
    hide($('quiz-btn-eval-wrap'));
    hide($('quiz-round-end'));
    hide($('quiz-summary'));
  }

  function revealAnswer() {
    $('flashcard').classList.add('flipped');
    hide($('quiz-btn-reveal-wrap'));
    show($('quiz-btn-eval-wrap'));
  }

  // Called after every markCorrect/markWrong to decide what to show next
  function handleQuizAdvance() {
    if (Quiz.isSessionDone()) {
      const results = Quiz.getSessionResults();
      Storage.updateSm2AfterSession(results.deckId, results.cardQualities);
      Storage.markStudied(results.deckId);
      showFinalSummary(results);
    } else if (Quiz.isRoundDone()) {
      showRoundEnd(Quiz.getRoundSummary());
    } else {
      renderQuizCard();
    }
  }

  function showRoundEnd(summary) {
    hide($('flashcard-wrap'));
    hide($('quiz-btn-reveal-wrap'));
    hide($('quiz-btn-eval-wrap'));
    hide($('quiz-summary'));

    $('round-end-num').textContent = summary.round;
    $('round-end-wrong-count').textContent = summary.wrongCount;
    $('round-end-mastered-count').textContent = summary.masteredCount;
    $('round-end-total').textContent = summary.totalCards;
    $('round-end-next-num').textContent = summary.round + 1;

    show($('quiz-round-end'));
  }

  function showFinalSummary(results) {
    hide($('flashcard-wrap'));
    hide($('quiz-btn-reveal-wrap'));
    hide($('quiz-btn-eval-wrap'));
    hide($('quiz-round-end'));

    // Score circle: % mastered in round 1 (perfect recall rate)
    const pct = results.totalCards > 0
      ? Math.round((results.masteredFirst / results.totalCards) * 100)
      : 100;
    const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
    const deg = Math.round((pct / 100) * 360);
    $('summary-score-circle').style.background =
      `conic-gradient(${color} ${deg}deg, var(--surface-2) ${deg}deg)`;
    $('summary-percent').textContent = `${pct}%`;
    $('summary-circle-label').textContent = 'al primo giro';

    // Stat chips
    $('summary-knew').textContent = results.masteredFirst;
    $('summary-knew-label').textContent = ' al primo giro';
    $('summary-didnt').textContent = results.rounds;
    $('summary-didnt-label').textContent = results.rounds === 1 ? ' giro' : ' giri';

    // Cards that needed multiple rounds
    const multiSection = $('summary-multi-round-section');
    const multiList = $('summary-multi-round-list');
    if (results.multiRoundCards.length > 0) {
      multiList.innerHTML = results.multiRoundCards.map(c => `
        <div class="summary-wrong-item">
          <div class="summary-wrong-item-q">${escapeHtml(c.domanda)}</div>
          <div class="summary-wrong-item-a">${escapeHtml(c.risposta)}</div>
        </div>
      `).join('');
      show(multiSection);
    } else {
      multiList.innerHTML = '';
      hide(multiSection);
    }

    show($('quiz-summary'));
  }

  function initQuiz() {
    $('quiz-reveal-btn').addEventListener('click', revealAnswer);

    $('quiz-knew-btn').addEventListener('click', () => {
      Quiz.markCorrect();
      handleQuizAdvance();
    });

    $('quiz-didnt-btn').addEventListener('click', () => {
      Quiz.markWrong();
      handleQuizAdvance();
    });

    $('quiz-next-round-btn').addEventListener('click', () => {
      Quiz.startNextRound();
      renderQuizCard();
    });

    $('quiz-exit-btn').addEventListener('click', () => {
      Quiz.reset();
      showView('decks');
    });

    $('quiz-retry-btn').addEventListener('click', () => {
      if (currentQuizDeckId) startQuiz(currentQuizDeckId);
    });

    // Keyboard shortcuts (only active when quiz view is visible)
    document.addEventListener('keydown', e => {
      if ($('view-quiz').hidden) return;
      if (!$('quiz-summary').hidden || !$('quiz-round-end').hidden) return;
      // Don't steal keys from inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      const answerRevealed = !$('quiz-btn-eval-wrap').hidden;

      if ((e.key === ' ' || e.code === 'Space') && !answerRevealed) {
        e.preventDefault();
        revealAnswer();
      } else if (e.key === 'ArrowRight' && answerRevealed) {
        e.preventDefault();
        Quiz.markCorrect();
        handleQuizAdvance();
      } else if (e.key === 'ArrowLeft' && answerRevealed) {
        e.preventDefault();
        Quiz.markWrong();
        handleQuizAdvance();
      }
    });
  }

  // ===== Global nav delegation =====
  function initNav() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (btn) showView(btn.dataset.view);
    });
  }

  // ===== Init =====
  function init() {
    initNav();
    initSettings();
    initUpload();
    initGenerateView();
    initModals();
    initQuiz();

    // Start on home view (or settings if no key)
    if (!Storage.hasApiKey()) {
      showView('settings');
      toast('Benvenuto! Inserisci la tua Groq API key per iniziare', 'info', 6000);
    } else {
      showView('home');
    }

    updateApiKeyBadge();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
