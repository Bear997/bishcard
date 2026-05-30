/**
 * groqApi.js — Groq API client for flashcard generation
 */

const GroqApi = (() => {
  const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

  function buildPrompt(text, count) {
    return `Sei un esperto creatore di materiale didattico. Analizza attentamente il seguente testo e genera esattamente ${count} flashcard per lo studio.

REGOLE FONDAMENTALI:
1. Rispondi ESCLUSIVAMENTE con un array JSON valido, senza testo aggiuntivo, senza markdown, senza backtick, senza commenti
2. Ogni flashcard deve avere esattamente i campi "domanda" e "risposta"
3. Le domande devono coprire i concetti più importanti, le definizioni chiave e i fatti rilevanti
4. Le risposte devono essere concise ma complete (massimo 2-3 frasi)
5. Usa la stessa lingua del testo originale
6. Le domande devono essere specifiche e verificabili, non generiche

Schema OBBLIGATORIO (solo questo, nient'altro):
[{"domanda": "...", "risposta": "..."}, ...]

TESTO DA ANALIZZARE:
${text}`;
  }

  /**
   * Robustly parses the JSON array from a Groq response string.
   * Handles: raw JSON, markdown code blocks, extra surrounding text.
   */
  function parseFlashcards(rawText) {
    let text = rawText.trim();

    // Strip markdown code fences
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

    // Try direct parse first
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      throw new Error('Not an array');
    } catch {
      // Find the first [ ... ] block
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start !== -1 && end > start) {
        try {
          const sliced = text.slice(start, end + 1);
          const parsed = JSON.parse(sliced);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // fall through
        }
      }
      throw new Error('Risposta dell\'AI non è un JSON valido. Riprova.');
    }
  }

  function validateCards(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error('L\'AI non ha generato nessuna flashcard. Riprova.');
    }
    return cards
      .filter(c => c && typeof c.domanda === 'string' && typeof c.risposta === 'string')
      .map(c => ({
        domanda: c.domanda.trim(),
        risposta: c.risposta.trim(),
      }))
      .filter(c => c.domanda && c.risposta);
  }

  /**
   * Generates flashcards from text using the Groq API.
   * @param {string} text - The source text
   * @param {number} count - Number of flashcards to generate
   * @param {string} apiKey - Groq API key
   * @param {string} model - Model ID
   * @returns {Promise<Array<{domanda: string, risposta: string}>>}
   */
  async function generateFlashcards(text, count, apiKey, model) {
    if (!apiKey) throw new Error('API key mancante. Vai nelle impostazioni per inserirla.');

    const body = {
      model: model || 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Sei un assistente specializzato nella creazione di materiale didattico. Rispondi sempre e solo con JSON valido, senza testo aggiuntivo.',
        },
        {
          role: 'user',
          content: buildPrompt(text, count),
        },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    };

    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error('Errore di rete. Controlla la connessione internet.');
    }

    if (!response.ok) {
      let errorMsg = `Errore API (${response.status})`;
      try {
        const errData = await response.json();
        const detail = errData?.error?.message || '';
        if (response.status === 401) {
          errorMsg = 'API key non valida. Controlla le impostazioni.';
        } else if (response.status === 429) {
          errorMsg = 'Limite di richieste raggiunto. Aspetta qualche secondo e riprova.';
        } else if (response.status === 413 || detail.includes('context')) {
          errorMsg = 'Il testo è troppo lungo per questo modello. Prova con un PDF più corto.';
        } else if (detail) {
          errorMsg = `Errore Groq: ${detail}`;
        }
      } catch {
        // keep generic message
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('Risposta vuota dall\'AI. Riprova.');
    }

    const cards = parseFlashcards(rawContent);
    const valid = validateCards(cards);

    if (valid.length === 0) {
      throw new Error('Le flashcard generate non sono valide. Riprova.');
    }

    return valid;
  }

  /**
   * Asks the AI to explain a flashcard the user got wrong.
   */
  async function explainCard(domanda, risposta, apiKey, model) {
    if (!apiKey) throw new Error('API key mancante. Vai nelle impostazioni per inserirla.');

    const prompt =
      `L'utente stava studiando e non ricordava questa flashcard. ` +
      `Domanda: ${domanda}. Risposta corretta: ${risposta}. ` +
      `Spiega il concetto in modo semplice e chiaro, in massimo 4-5 righe, ` +
      `come se lo spiegassi a uno studente. Rispondi nella stessa lingua della domanda.`;

    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 512,
        }),
      });
    } catch {
      throw new Error('Errore di rete. Controlla la connessione.');
    }

    if (!response.ok) {
      if (response.status === 429) throw new Error('Limite di richieste raggiunto. Riprova tra qualche secondo.');
      throw new Error(`Errore API (${response.status})`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || 'Nessuna spiegazione disponibile.';
  }

  return { generateFlashcards, explainCard };
})();

window.GroqApi = GroqApi;
