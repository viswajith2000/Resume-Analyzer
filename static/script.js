/* ============================================================
   AI Resume Analyzer — Frontend Script
   Handles: form validation, API call, score animation,
            skill rendering, tips rendering, error handling
============================================================ */

(function () {
  'use strict';

  // ── DOM References ──────────────────────────────────────────
  const form          = document.getElementById('analyzeForm');
  const uploadArea    = document.getElementById('uploadArea');
  const resumeFile    = document.getElementById('resumeFile');
  const fileInfo      = document.getElementById('fileInfo');
  const fileName      = document.getElementById('fileName');
  const removeFile    = document.getElementById('removeFile');
  const fileError     = document.getElementById('fileError');
  const jobDesc       = document.getElementById('jobDescription');
  const charCount     = document.getElementById('charCount');
  const jdError       = document.getElementById('jdError');
  const analyzeBtn    = document.getElementById('analyzeBtn');
  const btnContent    = document.getElementById('btnContent');
  const btnLoader     = document.getElementById('btnLoader');
  const loadingOverlay= document.getElementById('loadingOverlay');
  const errorBanner   = document.getElementById('errorBanner');
  const errorMessage  = document.getElementById('errorMessage');
  const errorClose    = document.getElementById('errorClose');
  const resultsSection= document.getElementById('resultsSection');

  // Results elements
  const scoreProgress = document.getElementById('scoreProgress');
  const scoreNumber   = document.getElementById('scoreNumber');
  const scoreTag      = document.getElementById('scoreTag');
  const verdictText   = document.getElementById('verdictText');
  const matchedSkills = document.getElementById('matchedSkills');
  const missingSkills = document.getElementById('missingSkills');
  const matchedCount  = document.getElementById('matchedCount');
  const missingCount  = document.getElementById('missingCount');
  const tipsList      = document.getElementById('tipsList');
  const reanalyzeBtn  = document.getElementById('reanalyzeBtn');

  // Loading steps
  const loadingSteps = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3'),
    document.getElementById('step4'),
  ];

  // SVG circle constants (r=80, circumference = 2πr ≈ 502.65)
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 80;

  let loadingStepTimer = null;

  // ── Character Counter ────────────────────────────────────────
  jobDesc.addEventListener('input', function () {
    const count = this.value.length;
    charCount.textContent = count.toLocaleString() + ' character' + (count !== 1 ? 's' : '');
    if (count > 0) {
      jdError.classList.remove('show');
    }
  });

  // ── File Upload — Click ──────────────────────────────────────
  uploadArea.addEventListener('click', function (e) {
    if (e.target === removeFile) return;
    resumeFile.click();
  });

  resumeFile.addEventListener('change', function () {
    handleFileSelect(this.files[0]);
  });

  // ── File Upload — Drag & Drop ────────────────────────────────
  uploadArea.addEventListener('dragenter', function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.contains(e.relatedTarget)) {
      this.classList.remove('drag-over');
    }
  });

  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showError('Only PDF files are accepted. Please drop a valid PDF resume.');
        return;
      }
      handleFileSelect(file);
    }
  });

  // ── Remove File ──────────────────────────────────────────────
  removeFile.addEventListener('click', function (e) {
    e.stopPropagation();
    clearFile();
  });

  function handleFileSelect(file) {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      fileError.classList.add('show');
      clearFile();
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File is too large. Maximum size is 10MB.');
      clearFile();
      return;
    }

    // Assign to input (for FormData)
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    resumeFile.files = dataTransfer.files;

    // Show file info
    fileName.textContent = file.name;
    fileInfo.style.display = 'flex';
    uploadArea.classList.add('has-file');
    fileError.classList.remove('show');
  }

  function clearFile() {
    resumeFile.value = '';
    fileInfo.style.display = 'none';
    uploadArea.classList.remove('has-file');
  }

  // ── Form Validation ──────────────────────────────────────────
  function validateForm() {
    let valid = true;

    if (!resumeFile.files || resumeFile.files.length === 0) {
      fileError.classList.add('show');
      valid = false;
    } else {
      fileError.classList.remove('show');
    }

    if (!jobDesc.value.trim()) {
      jdError.classList.add('show');
      valid = false;
    } else {
      jdError.classList.remove('show');
    }

    return valid;
  }

  // ── Form Submit ──────────────────────────────────────────────
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    hideError();

    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.field-error.show');
      if (firstError) {
        firstError.closest('.input-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setLoadingState(true);

    const formData = new FormData();
    formData.append('resume', resumeFile.files[0]);
    formData.append('job_description', jobDesc.value.trim());

    try {
      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errMsg = 'Server error (' + response.status + '). Please try again.';
        try {
          const errData = await response.json();
          if (errData.error || errData.message) {
            errMsg = errData.error || errData.message;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      console.log('API Response:', data);
      setLoadingState(false);
      renderResults(data);

    } catch (err) {
      setLoadingState(false);
      showError(err.message || 'Something went wrong. Please try again.');
    }
  });

  // ── Loading State ────────────────────────────────────────────
  function setLoadingState(isLoading) {
    if (isLoading) {
      analyzeBtn.disabled = true;
      btnContent.style.display = 'none';
      btnLoader.style.display = 'flex';
      loadingOverlay.style.display = 'flex';
      startLoadingSteps();
    } else {
      analyzeBtn.disabled = false;
      btnContent.style.display = 'flex';
      btnLoader.style.display = 'none';
      loadingOverlay.style.display = 'none';
      stopLoadingSteps();
    }
  }

  function startLoadingSteps() {
    let currentStep = 0;

    // Reset all steps
    loadingSteps.forEach(function (step) {
      step.classList.remove('active', 'done');
    });

    loadingSteps[0].classList.add('active');

    loadingStepTimer = setInterval(function () {
      if (currentStep < loadingSteps.length - 1) {
        loadingSteps[currentStep].classList.remove('active');
        loadingSteps[currentStep].classList.add('done');
        currentStep++;
        loadingSteps[currentStep].classList.add('active');
      }
    }, 900);
  }

  function stopLoadingSteps() {
    if (loadingStepTimer) {
      clearInterval(loadingStepTimer);
      loadingStepTimer = null;
    }
    loadingSteps.forEach(function (step) {
      step.classList.remove('active', 'done');
    });
    loadingSteps[0].classList.add('active');
  }

  // ── Error Handling ───────────────────────────────────────────
  function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.style.display = 'flex';
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorBanner.style.display = 'none';
  }

  errorClose.addEventListener('click', hideError);

  // ── Render Results ───────────────────────────────────────────
  function renderResults(data) {
    const score = Math.max(0, Math.min(100, Number(data.score) || 0));
    const matched = Array.isArray(data.matched_skills) ? data.matched_skills : [];
    const missing = Array.isArray(data.missing_skills) ? data.missing_skills : [];
    const tips    = Array.isArray(data.tips) ? data.tips : [];
    const verdict = data.verdict || 'Analysis complete.';

    // Show results section
    resultsSection.style.display = 'block';

    // Scroll to results
    setTimeout(function () {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // Render verdict
    verdictText.textContent = verdict;

    // Render skills
    renderSkillTags(matchedSkills, matched, 'matched');
    renderSkillTags(missingSkills, missing, 'missing');
    matchedCount.textContent = matched.length;
    missingCount.textContent = missing.length;

    // Render tips
    renderTips(tips);

    // Animate score meter
    setTimeout(function () {
      animateScore(score);
    }, 300);
  }

  // ── Score Animation ──────────────────────────────────────────
  function animateScore(targetScore) {
    const duration = 1600;
    const startTime = performance.now();
    const startScore = 0;

    // Set color class
    const colorClass = targetScore <= 40 ? 'score-red'
                     : targetScore <= 70 ? 'score-orange'
                     : 'score-green';

    scoreProgress.setAttribute('class', 'score-progress ' + colorClass);
    scoreNumber.className = 'score-number ' + colorClass;

    // Determine label
    const label = targetScore <= 40 ? 'Weak Match'
                : targetScore <= 70 ? 'Fair Match'
                : 'Strong Match';
    scoreTag.textContent = label;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(startScore + (targetScore - startScore) * eased);

      // Update number
      scoreNumber.textContent = current;

      // Update circle arc
      const offset = CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * current) / 100;
      scoreProgress.style.strokeDashoffset = offset;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        scoreNumber.textContent = targetScore;
        scoreProgress.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * targetScore) / 100;
      }
    }

    requestAnimationFrame(tick);
  }

  // ── Render Skill Tags ────────────────────────────────────────
  function renderSkillTags(container, skills, type) {
    container.innerHTML = '';

    if (!skills || skills.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'no-skills';
      empty.textContent = type === 'matched' ? 'No matching skills found.' : 'No missing skills — great fit!';
      container.appendChild(empty);
      return;
    }

    skills.forEach(function (skill, index) {
      const tag = document.createElement('span');
      tag.className = 'skill-tag ' + type;
      tag.style.animationDelay = (index * 60) + 'ms';

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '11');
      icon.setAttribute('height', '11');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '3');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

      if (type === 'matched') {
        path.setAttribute('d', 'M20 6L9 17l-5-5');
      } else {
        const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6');
        l1.setAttribute('x2', '6');  l1.setAttribute('y2', '18');
        l2.setAttribute('x1', '6');  l2.setAttribute('y1', '6');
        l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
        icon.appendChild(l1);
        icon.appendChild(l2);
      }

      if (type === 'matched') {
        icon.appendChild(path);
      }

      tag.appendChild(icon);
      tag.appendChild(document.createTextNode(skill));
      container.appendChild(tag);
    });
  }

  // ── Render Tips ──────────────────────────────────────────────
  function renderTips(tips) {
    tipsList.innerHTML = '';

    if (!tips || tips.length === 0) {
      const li = document.createElement('li');
      li.className = 'tip-item';
      li.innerHTML = '<span class="tip-text">No specific tips — your resume looks well-optimized for this role!</span>';
      tipsList.appendChild(li);
      return;
    }

    tips.forEach(function (tip, index) {
      const li = document.createElement('li');
      li.className = 'tip-item';
      li.style.animationDelay = (index * 80) + 'ms';

      const numEl = document.createElement('span');
      numEl.className = 'tip-number';
      numEl.textContent = index + 1;

      const textEl = document.createElement('span');
      textEl.className = 'tip-text';
      textEl.textContent = tip;

      li.appendChild(numEl);
      li.appendChild(textEl);
      tipsList.appendChild(li);
    });
  }

  // ── Re-analyze Button ────────────────────────────────────────
  reanalyzeBtn.addEventListener('click', function () {
    // Hide results
    resultsSection.style.display = 'none';

    // Reset form
    form.reset();
    clearFile();
    charCount.textContent = '0 characters';
    hideError();

    // Reset score display
    scoreNumber.textContent = '0';
    scoreNumber.className = 'score-number';
    scoreProgress.setAttribute('class', 'score-progress');
    scoreProgress.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
    scoreTag.textContent = 'Match';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

})();
