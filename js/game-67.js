
(async function () {
  const { Timer, SFX, showPreview } = window.AppUtil || {};
  const DATA = await (await fetch('data/sixseven.json')).json();

  const $  = s => document.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // DOM refs
  const modeSel = $('#sixSevenMode');
  const catSel  = $('#sixSevenCat');
  const subSel  = $('#sixSevenSub');
  const wrap    = $('#sixSevenWrap');
  const tOut    = $('#sixSevenTime');
  const cOut    = $('#sixSevenCorrect');
  const sOut    = $('#sixSevenScore');
  const hOut    = $('#sixSevenHigh');
  const timer   = new Timer(tOut);

  // State
  let totalMs = 0;       // total time across all questions
  let totalScore = 0;    // sum of per-question scores
  let idx = 0;
  let correctQuestions = 0;
  let questions = [];    // picked 10 for this session

  // Populate selects
  function fill(sel, items) { sel.innerHTML = ''; items.forEach(v => sel.append(new Option(v, v))); }
  fill(catSel, Object.keys(DATA));
  function updateSub() {
    const subs = Object.keys(DATA[catSel.value] || {});
    fill(subSel, subs);
    loadHigh(); // refresh highscore display when category changes
  }
  catSel.addEventListener('change', updateSub);
  subSel.addEventListener('change', loadHigh);
  updateSub();

  // Highscore helpers
  function hsKey() {
    return `highscore:sixseven:${modeSel.value}:${catSel.value}:${subSel.value}`;
  }
  function loadHigh() {
    const v = Number(localStorage.getItem(hsKey()) || 0);
    hOut.textContent = String(v);
  }

  // Start game
  function start() {
    const list = ((DATA[catSel.value] || {})[subSel.value] || []);
    questions = [...list].sort(() => Math.random() - 0.5).slice(0, 10); // pick 10
    idx = 0; correctQuestions = 0; totalScore = 0; totalMs = 0;
    cOut.textContent = '0'; sOut.textContent = '0';
    render();
    SFX && SFX.click();
  }

  // Scoring is purely sum of per-question scores now
  function scoreNow() { return totalScore; }

  // Render one question
  function render() {
    if (!questions.length) { wrap.innerHTML = '<p>No items.</p>'; return; }
    if (idx >= questions.length) { end(); return; }

    const item = questions[idx];
    const mode = Number(modeSel.value);
    const needed = mode === 7 ? (item.answers7 || []) : (item.answers6 || []);
    const n = mode; // number of inputs to render

    // build prompt + N text inputs
    wrap.innerHTML = `
      <div class="sixseven">
        <div class="small">Q${idx+1} of ${questions.length}</div>
        <div class="prompt">${item.prompt}</div>
        <div class="multi-grid">
          ${Array.from({ length: n }, (_, i) => `
            <div class="multi-row">
              <label>Answer ${i+1}</label>
              <input type="text" class="multi-input" data-idx="${i}" />
            </div>
          `).join('')}
        </div>
        <div class="controls">
          <button id="sixSevenCheck" class="btn btn-primary">Check</button>
        </div>
        <div id="sixSevenFeedback" class="small"></div>
      </div>
    `;

    // Per-question timer (reset + start)
    timer.reset();
    timer.start();

    // Check handler: compare all inputs to needed answers
    $('#sixSevenCheck').addEventListener('click', () => {
      timer.stop();
      const ms = timer.elapsedMs();
      totalMs += ms;
      const secs = Math.floor(ms / 1000);

      const inputs = $$('.multi-input', wrap).map(inp => (inp.value || '').trim().toLowerCase());
      const expected = needed.map(a => (a || '').trim().toLowerCase());

      // Strict rule: question is correct only if ALL answers match
      let allCorrect = inputs.length === expected.length &&
                       inputs.every((val, i) => val === expected[i]);

      // Visual feedback on each input
      $$('.multi-input', wrap).forEach((inp, i) => {
        const ok = (inputs[i] === expected[i]);
        inp.classList.toggle('correct', ok);
        inp.classList.toggle('wrong', !ok);
      });

      // award score
      let questionScore = 0;
      if (allCorrect) {
        questionScore = 50 + (secs < 51 ? (51 - secs) : 0);
        totalScore += questionScore;
        correctQuestions++;
        cOut.textContent = String(correctQuestions);
        SFX && SFX.correct();
        $('#sixSevenFeedback').textContent = `✅ Correct — +${questionScore} points`;
      } else {
        SFX && SFX.wrong();
        $('#sixSevenFeedback').textContent = `❌ Incorrect — +0 points`;
      }

      sOut.textContent = String(scoreNow());

      // Show Next button to continue
      const nextRow = document.createElement('div');
      nextRow.className = 'next-row';
      nextRow.innerHTML = '<button id="sixSevenNext" class="btn btn-primary">Next</button>';
      wrap.appendChild(nextRow);

      $('#sixSevenCheck').disabled = true;
      $('#sixSevenNext').addEventListener('click', () => { idx++; render(); });
    });
  }

  // Finish screen + leaderboard
  function end() {
    timer.stop();
    const score = scoreNow();

    // Update highscore
    const prevHS = Number(localStorage.getItem(hsKey()) || 0);
    if (score > prevHS) localStorage.setItem(hsKey(), String(score));
    hOut.textContent = String(Math.max(score, prevHS));

    // Leaderboard entry (score + total time)
    const lbKey = `sixseven:${modeSel.value}:${catSel.value}:${subSel.value}`;
    localStorage.setItem(lbKey, JSON.stringify({ score, ms: totalMs }));

    const totalTime = Timer.format(totalMs);
    wrap.innerHTML = `
      <p><strong>Done!</strong>
        Correct: ${correctQuestions}/${questions.length}
        — Time: ${totalTime}
        — Score: ${score}
      </p>
      <button class="btn" id="sixSevenAgain">Play again</button>
    `;
    $('#sixSevenAgain').addEventListener('click', start);
    SFX && SFX.success();
  }

  // Preview shows prompt + answers for the chosen mode
  $('#sixSevenPreview').addEventListener('click', () => {
    const list = ((DATA[catSel.value] || {})[subSel.value] || []);
    if (!list.length) { showPreview('6 7 Preview', '<p>No items.</p>'); return; }
    const mode = Number(modeSel.value);
    const html = list.map((it, i) => {
      const arr = mode === 7 ? (it.answers7 || []) : (it.answers6 || []);
      return `<div style="margin:8px 0"><strong>Q${i+1}.</strong> ${it.prompt}<br><em>Answers:</em> ${arr.join(', ')}</div>`;
    }).join('');
    showPreview(`6 7 Preview — ${catSel.value} / ${subSel.value} (mode ${mode})`, html);
  });

  // Start button
  $('#sixSevenStart').addEventListener('click', start);
})();
