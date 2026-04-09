(function() {
  const isLogin = document.location.pathname.toLowerCase().endsWith('login.html');

  // Shared footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (isLogin) {
    setupLogin();
  } else {
    setupQuiz();
  }

  function setupLogin() {
    const loginForm = document.getElementById('loginForm');
    const oauthButtons = document.querySelectorAll('.oauth');

    const completeLogin = () => {
      // Demo only: pretend login and redirect to index
      window.location.href = 'index.html';
    };

    if (loginForm) {
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        completeLogin();
      });
    }
    oauthButtons.forEach(btn => btn.addEventListener('click', completeLogin));
  }

  function setupQuiz() {
    const form = document.getElementById('quizForm');
    const resetBtn = document.getElementById('resetBtn');
    const quizContainer = document.getElementById('quizContainer');
    const resultsSection = document.getElementById('results');
    const showAnswersBtn = document.getElementById('showAnswersBtn');
    const regenBtn = document.getElementById('regenBtn');
    const filesInput = document.getElementById('files');

    /** Internal state */
    let currentQuestions = [];
    let currentSelections = {}; // { [questionId]: selectedIndex }
    let showAnswers = false;

    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const topicInput = (formData.get('topic') || '').toString().trim();
        const difficulty = (formData.get('difficulty') || 'easy').toString();
        const count = parseInt((formData.get('count') || '10').toString(), 10);

        let topic = topicInput;
        if (!topic && filesInput && filesInput.files && filesInput.files.length > 0) {
          topic = await inferTopicFromFiles(filesInput.files);
        }
        if (!topic) {
          topic = 'general mathematics';
        }

        currentQuestions = generateDummyQuestions(topic, difficulty, count);
        currentSelections = {};
        renderQuiz(quizContainer, currentQuestions, showAnswers, currentSelections);
        resultsSection?.classList.remove('hidden');
        showAnswers = false;
        updateShowAnswersState(showAnswersBtn, showAnswers);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        form?.reset();
        resultsSection?.classList.add('hidden');
        quizContainer.innerHTML = '';
        showAnswers = false;
        currentSelections = {};
        updateShowAnswersState(showAnswersBtn, showAnswers);
      });
    }

    if (showAnswersBtn) {
      showAnswersBtn.addEventListener('click', function() {
        showAnswers = !showAnswers;
        updateShowAnswersState(showAnswersBtn, showAnswers);
        renderQuiz(quizContainer, currentQuestions, showAnswers, currentSelections);
      });
    }

    if (regenBtn) {
      regenBtn.addEventListener('click', function() {
        const topic = (document.getElementById('topic')?.value || 'general mathematics').toString();
        const difficulty = (document.getElementById('difficulty')?.value || 'easy').toString();
        const count = parseInt((document.getElementById('count')?.value || '10').toString(), 10);
        currentQuestions = generateDummyQuestions(topic, difficulty, count);
        // keep selections if same count? safer to reset
        currentSelections = {};
        renderQuiz(quizContainer, currentQuestions, showAnswers, currentSelections);
      });
    }
  }

  function updateShowAnswersState(button, show) {
    if (!button) return;
    button.textContent = show ? 'Hide Answers' : 'Show Answers';
  }

  function generateDummyQuestions(topic, difficulty, count) {
    const questions = [];
    const optionLetters = ['A','B','C','D'];
    for (let i = 1; i <= count; i++) {
      const correctIndex = Math.floor(Math.random() * 4);
      const opts = optionLetters.map((letter, idx) => `${letter}. Option ${idx + 1}`);
      questions.push({
        id: i,
        text: `Question ${i}. "${capitalize(difficulty)}" question on "${topic}"`,
        options: opts,
        correctIndex
      });
    }
    return questions;
  }

  function renderQuiz(container, questions, showAnswers, selections) {
    if (!container) return;
    container.innerHTML = '';
    questions.forEach(q => {
      const qEl = document.createElement('div');
      qEl.className = 'question';
      const title = document.createElement('h3');
      title.textContent = q.text;
      const optsEl = document.createElement('div');
      optsEl.className = 'options';
      const selectedIndex = selections?.[q.id];
      q.options.forEach((opt, idx) => {
        const label = document.createElement('label');
        label.className = 'option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `q_${q.id}`;
        input.value = String(idx);
        if (selectedIndex === idx) {
          input.checked = true;
          if (showAnswers) {
            label.classList.add('chosen');
          } else {
            label.classList.add('selected');
          }
        }
        // Badge with option letter (A, B, C, D)
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = String.fromCharCode(65 + idx);
        // Text (cleaned to avoid duplicate letters)
        const text = document.createElement('span');
        text.className = 'text';
        const labelText = typeof opt === 'string' ? opt.replace(/^[A-D]\.\s*/, '') : String(opt);
        text.textContent = labelText;
        label.appendChild(input);
        label.appendChild(badge);
        label.appendChild(text);
        if (!showAnswers) {
          label.addEventListener('click', function() {
            // Persist selection state
            selections[q.id] = idx;
            const siblings = Array.from(optsEl.querySelectorAll('.option'));
            siblings.forEach(s => s.classList.remove('selected'));
            label.classList.add('selected');
          });
        } else {
          // Show answers logic:
          // - Always mark the correct option green with tick
          // - If the chosen option is wrong, mark only that one red with cross
          if (idx === q.correctIndex) {
            label.classList.add('correct', 'show');
          }
          const userChoseThis = selectedIndex === idx;
          const userChoseWrong = selectedIndex !== undefined && selectedIndex !== null && selectedIndex !== q.correctIndex;
          if (userChoseThis) {
            label.classList.add('chosen');
            if (userChoseWrong && idx !== q.correctIndex) {
              label.classList.add('incorrect', 'show');
            }
          }
        }
        optsEl.appendChild(label);
      });
      qEl.appendChild(title);
      qEl.appendChild(optsEl);
      container.appendChild(qEl);
    });
  }

  async function inferTopicFromFiles(fileList) {
    // Lightweight heuristic: try reading text from first file if possible.
    // For non-text (e.g., PDFs), we fallback to a generic topic.
    const first = fileList[0];
    if (!first) return '';
    try {
      if (first.type.startsWith('text/') || first.name.endsWith('.md') || first.name.endsWith('.csv') || first.name.endsWith('.json')) {
        const text = await first.text();
        const guess = guessTopicFromText(text);
        return guess || '';
      }
    } catch (e) {
      // ignore
    }
    // PDF and others are not parsed client-side here; return generic.
    return 'uploaded material';
  }

  function guessTopicFromText(text) {
    const candidates = [
      'algebra', 'geometry', 'trigonometry', 'calculus', 'probability', 'statistics', 'number theory', 'matrices', 'vectors', 'limits', 'derivatives', 'integrals'
    ];
    const lower = text.toLowerCase();
    for (const c of candidates) {
      if (lower.includes(c)) return c;
    }
    return '';
  }

  function capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
})();


