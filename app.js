/**
 * نَشْرَة (Nashrah) - Weekly Newspaper Journaling App
 * Full RTL LocalStorage Application
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'nashrah_journal_v1';

  const ARABIC_DAYS = [
    'السبت',
    'الأحد',
    'الاثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة'
  ];

  const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const ORDINAL_WEEKS = [
    'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'
  ];

  // -------------------- State Management --------------------
  let state = {
    subtitle: 'نشرتي الأسبوعية',
    fontMode: 'custom', // 'custom' (attached font) | 'clear' (IBM Plex / Cairo)
    entriesByDate: {}, // { "YYYY-MM-DD": [ { id, subtitle, content, timeLabel, createdAt } ] }
    baseWeekStart: null // "YYYY-MM-DD" (Saturday of Issue #1)
  };

  let activeTab = 'editor';
  let currentViewedWeekStart = null; // Date object (Saturday)

  // -------------------- Date Helpers (Saturday -> Friday) --------------------
  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, days) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function getWeekSaturday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offsetFromSat = (d.getDay() + 1) % 7;
    d.setDate(d.getDate() - offsetFromSat);
    return d;
  }

  function formatTimeArabic(date) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${period}`;
  }

  function formatDayShort(date) {
    return `${date.getDate()} ${ARABIC_MONTHS[date.getMonth()]}`;
  }

  function formatFullArabicDate(date) {
    const dayIndex = (date.getDay() + 1) % 7;
    return `${ARABIC_DAYS[dayIndex]} · ${date.getDate()} ${ARABIC_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function formatWeekRange(satDate) {
    const friDate = addDays(satDate, 6);
    const satMonth = ARABIC_MONTHS[satDate.getMonth()];
    const friMonth = ARABIC_MONTHS[friDate.getMonth()];
    if (satDate.getMonth() === friDate.getMonth() && satDate.getFullYear() === friDate.getFullYear()) {
      return `${satDate.getDate()} - ${friDate.getDate()} ${friMonth} ${friDate.getFullYear()}`;
    }
    if (satDate.getFullYear() === friDate.getFullYear()) {
      return `${satDate.getDate()} ${satMonth} - ${friDate.getDate()} ${friMonth} ${friDate.getFullYear()}`;
    }
    return `${satDate.getDate()} ${satMonth} ${satDate.getFullYear()} - ${friDate.getDate()} ${friMonth} ${friDate.getFullYear()}`;
  }

  function getWeekOfMonthTitle(satDate) {
    const midWeek = addDays(satDate, 3);
    const weekNum = Math.min(Math.ceil(midWeek.getDate() / 7), 5);
    const ordinal = ORDINAL_WEEKS[weekNum - 1] || 'الأخير';
    return `الأسبوع ${ordinal} من ${ARABIC_MONTHS[midWeek.getMonth()]} ${midWeek.getFullYear()}`;
  }

  function getIssueNumber(weekSat) {
    const baseSat = state.baseWeekStart ? parseDateKey(state.baseWeekStart) : getWeekSaturday(new Date());
    const diffMs = weekSat.getTime() - baseSat.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    return diffWeeks >= 0 ? diffWeeks + 1 : diffWeeks;
  }

  // -------------------- Storage Helpers --------------------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.subtitle = typeof parsed.subtitle === 'string' && parsed.subtitle.trim() ? parsed.subtitle : 'نشرتي الأسبوعية';
          state.fontMode = parsed.fontMode === 'clear' ? 'clear' : 'custom';
          state.entriesByDate = parsed.entriesByDate && typeof parsed.entriesByDate === 'object' ? parsed.entriesByDate : {};
          state.baseWeekStart = parsed.baseWeekStart || null;
        }
      }
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }

    if (!state.baseWeekStart) {
      const keys = Object.keys(state.entriesByDate).sort();
      if (keys.length > 0) {
        state.baseWeekStart = toDateKey(getWeekSaturday(parseDateKey(keys[0])));
      } else {
        state.baseWeekStart = toDateKey(getWeekSaturday(new Date()));
      }
      saveState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  // -------------------- Font Mode Switching --------------------
  function applyFontMode(mode) {
    state.fontMode = mode === 'clear' ? 'clear' : 'custom';
    const body = document.body;
    body.classList.remove('font-mode-custom', 'font-mode-clear');
    body.classList.add(state.fontMode === 'clear' ? 'font-mode-clear' : 'font-mode-custom');

    // Update quick button in header
    const quickLabel = document.getElementById('font-toggle-quick-label');
    const quickBtn = document.getElementById('btn-toggle-font-quick');
    if (quickLabel && quickBtn) {
      if (state.fontMode === 'clear') {
        quickLabel.textContent = 'خط الرقعة';
        quickBtn.classList.add('border-ink', 'bg-newsprintDark');
      } else {
        quickLabel.textContent = 'الخط الواضح';
        quickBtn.classList.remove('border-ink', 'bg-newsprintDark');
      }
    }

    // Update settings modal buttons
    const btnCustom = document.getElementById('btn-font-custom');
    const btnClear = document.getElementById('btn-font-clear');
    if (btnCustom && btnClear) {
      if (state.fontMode === 'clear') {
        btnClear.className = 'px-3 py-2 border-2 border-ink bg-ink text-newsprint text-xs sm:text-sm font-semibold transition-all cursor-pointer';
        btnCustom.className = 'px-3 py-2 border-2 border-rule bg-newsprint text-ink hover:border-ink text-xs sm:text-sm font-semibold transition-all cursor-pointer';
      } else {
        btnCustom.className = 'px-3 py-2 border-2 border-ink bg-ink text-newsprint text-xs sm:text-sm font-semibold transition-all cursor-pointer';
        btnClear.className = 'px-3 py-2 border-2 border-rule bg-newsprint text-ink hover:border-ink text-xs sm:text-sm font-semibold transition-all cursor-pointer';
      }
    }
  }

  // -------------------- UI Helpers --------------------
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('flex');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // -------------------- Tab Switching --------------------
  function switchTab(tabName) {
    activeTab = tabName;
    const editorView = document.getElementById('view-editor');
    const newspaperView = document.getElementById('view-newspaper');
    const btnEditor = document.getElementById('tab-btn-editor');
    const btnNewspaper = document.getElementById('tab-btn-newspaper');

    if (tabName === 'editor') {
      editorView.classList.remove('hidden');
      newspaperView.classList.add('hidden');
      btnEditor.classList.add('active');
      btnNewspaper.classList.remove('active');
      renderEditorToday();
    } else {
      editorView.classList.add('hidden');
      newspaperView.classList.remove('hidden');
      btnEditor.classList.remove('active');
      btnNewspaper.classList.add('active');
      renderNewspaper();
    }
  }

  // -------------------- Render Editor Today Feed --------------------
  function renderEditorToday() {
    const now = new Date();
    const todayKey = toDateKey(now);
    const todaySat = getWeekSaturday(now);
    const issueNum = getIssueNumber(todaySat);

    document.getElementById('editor-today-label').textContent = formatFullArabicDate(now);
    document.getElementById('editor-issue-label').textContent = `العدد #${issueNum}`;

    const entries = state.entriesByDate[todayKey] || [];
    const badge = document.getElementById('today-count-badge');
    badge.textContent = `${entries.length} ${entries.length === 1 ? 'تدوينة' : 'تدوينات'}`;

    const container = document.getElementById('editor-today-list');
    container.innerHTML = '';

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="border border-dashed border-rule p-6 text-center text-sm text-inkMuted bg-newsprintDark/30">
          لم يُنشر شيء في خانة اليوم بعد. اكتب أول فقرة أعلاه لتبدأ عددك اليوم.
        </div>
      `;
      return;
    }

    entries.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'article-item border border-rule bg-white/60 p-4 cursor-pointer';
      card.title = 'انقر للتعديل أو الحذف';
      card.innerHTML = `
        <div class="flex items-start justify-between gap-2 mb-1.5">
          ${entry.subtitle ? `<h3 class="font-headline font-bold text-ink text-sm sm:text-base">${escapeHTML(entry.subtitle)}</h3>` : '<span class="text-xs font-semibold text-inkMuted">تدوينة</span>'}
          <span class="text-[11px] text-inkMuted whitespace-nowrap bg-newsprintDark px-2 py-0.5 border border-rule">${escapeHTML(entry.timeLabel)}</span>
        </div>
        <p class="text-sm text-ink leading-relaxed whitespace-pre-line">${escapeHTML(entry.content)}</p>
      `;
      card.addEventListener('click', () => openEditModal(todayKey, entry.id));
      container.appendChild(card);
    });
  }

  // -------------------- Render Weekly Newspaper --------------------
  function renderNewspaper() {
    if (!currentViewedWeekStart) {
      currentViewedWeekStart = getWeekSaturday(new Date());
    }

    const todayKey = toDateKey(new Date());
    const currentSat = getWeekSaturday(new Date());
    const isCurrentWeek = toDateKey(currentViewedWeekStart) === toDateKey(currentSat);

    const issueNum = getIssueNumber(currentViewedWeekStart);
    const issueDisplay = issueNum >= 1 ? `العدد #${issueNum}` : `أرشيف (${issueNum})`;
    document.getElementById('masthead-issue-number').textContent = issueDisplay;
    document.getElementById('masthead-week-title').textContent = getWeekOfMonthTitle(currentViewedWeekStart);
    document.getElementById('masthead-date-range').textContent = formatWeekRange(currentViewedWeekStart);

    const subtitleInput = document.getElementById('masthead-subtitle-input');
    if (subtitleInput.value !== state.subtitle) {
      subtitleInput.value = state.subtitle;
    }

    const btnCurrentWeek = document.getElementById('btn-current-week');
    if (isCurrentWeek) {
      btnCurrentWeek.classList.add('hidden');
    } else {
      btnCurrentWeek.classList.remove('hidden');
    }

    populateIssueSelect();

    const grid = document.getElementById('newspaper-grid');
    grid.innerHTML = '';

    let totalArticles = 0;

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(currentViewedWeekStart, i);
      const dayKey = toDateKey(dayDate);
      const dayEntries = state.entriesByDate[dayKey] || [];
      totalArticles += dayEntries.length;

      const isToday = dayKey === todayKey;

      const col = document.createElement('section');
      const spanClass = i < 3 ? 'lg:col-span-4 day-cell-top' : 'lg:col-span-3 day-cell-bottom';
      col.className = `day-cell ${spanClass} p-4 sm:p-5 flex flex-col justify-between min-h-[210px] ${isToday ? 'bg-newsprintDark/45' : 'bg-newsprint'}`;

      const headerHtml = `
        <div class="flex items-center justify-between border-b-2 border-ink pb-2 mb-3">
          <div>
            <h2 class="font-headline font-extrabold text-base sm:text-lg text-ink leading-tight">${ARABIC_DAYS[i]}</h2>
            <span class="text-xs text-inkMuted">${formatDayShort(dayDate)}</span>
          </div>
          ${isToday ? '<span class="px-2 py-0.5 bg-ink text-newsprint text-[10px] font-bold">اليوم</span>' : ''}
        </div>
      `;

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'flex-1 space-y-3';

      if (dayEntries.length === 0) {
        bodyDiv.innerHTML = `
          <div class="h-full min-h-[120px] flex flex-col items-center justify-center text-center py-6 px-2 opacity-60">
            <div class="w-8 h-[1px] bg-inkMuted mb-2"></div>
            <p class="text-xs font-medium text-inkMuted italic">مساحة قيد التحرير</p>
            <div class="w-8 h-[1px] bg-inkMuted mt-2"></div>
          </div>
        `;
      } else {
        dayEntries.forEach((entry, idx) => {
          const art = document.createElement('article');
          art.className = `article-item cursor-pointer p-1.5 -mx-1.5 rounded ${idx > 0 ? 'border-t border-rule pt-2.5' : ''}`;
          art.title = 'انقر لتعديل أو حذف هذه الفقرة';
          art.innerHTML = `
            ${entry.subtitle ? `<h3 class="font-headline font-bold text-sm text-ink mb-1 leading-snug">${escapeHTML(entry.subtitle)}</h3>` : ''}
            <p class="text-xs sm:text-[13px] text-ink leading-relaxed whitespace-pre-line">${escapeHTML(entry.content)}</p>
            <div class="mt-1 text-[10px] text-inkMuted font-medium">${escapeHTML(entry.timeLabel)}</div>
          `;
          art.addEventListener('click', () => openEditModal(dayKey, entry.id));
          bodyDiv.appendChild(art);
        });
      }

      col.innerHTML = headerHtml;
      col.appendChild(bodyDiv);
      grid.appendChild(col);
    }

    document.getElementById('newspaper-stats').textContent =
      `${totalArticles} ${totalArticles === 1 ? 'تدوينة' : 'تدوينات'} في هذا العدد`;
  }

  function populateIssueSelect() {
    const select = document.getElementById('issue-select');
    const baseSat = parseDateKey(state.baseWeekStart);
    const todaySat = getWeekSaturday(new Date());

    const weekSet = new Set();
    weekSet.add(toDateKey(baseSat));
    weekSet.add(toDateKey(todaySat));
    weekSet.add(toDateKey(currentViewedWeekStart));

    Object.keys(state.entriesByDate).forEach((dateKey) => {
      if ((state.entriesByDate[dateKey] || []).length > 0) {
        weekSet.add(toDateKey(getWeekSaturday(parseDateKey(dateKey))));
      }
    });

    const sortedWeeks = Array.from(weekSet).sort().reverse();
    select.innerHTML = '';

    sortedWeeks.forEach((wkKey) => {
      const wkDate = parseDateKey(wkKey);
      const num = getIssueNumber(wkDate);
      const opt = document.createElement('option');
      opt.value = wkKey;
      opt.textContent = `${num >= 1 ? `العدد #${num}` : `أرشيف (${num})`} · ${formatWeekRange(wkDate)}`;
      if (wkKey === toDateKey(currentViewedWeekStart)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }

  // -------------------- Publish (Cumulative Append) --------------------
  function handlePublish(e) {
    e.preventDefault();
    const subtitleEl = document.getElementById('entry-subtitle');
    const contentEl = document.getElementById('entry-content');

    const subtitle = subtitleEl.value.trim();
    const content = contentEl.value.trim();
    if (!content) return;

    const now = new Date();
    const todayKey = toDateKey(now);

    if (!state.entriesByDate[todayKey]) {
      state.entriesByDate[todayKey] = [];
    }

    state.entriesByDate[todayKey].push({
      id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      subtitle,
      content,
      timeLabel: formatTimeArabic(now),
      createdAt: now.toISOString()
    });

    const todaySatKey = toDateKey(getWeekSaturday(now));
    if (todaySatKey < state.baseWeekStart) {
      state.baseWeekStart = todaySatKey;
    }

    saveState();

    subtitleEl.value = '';
    contentEl.value = '';
    renderEditorToday();
    showToast('تم النشر وإضافة الفقرة إلى عدد اليوم');
  }

  // -------------------- Edit / Delete Entry --------------------
  function openEditModal(dayKey, entryId) {
    const list = state.entriesByDate[dayKey] || [];
    const entry = list.find((item) => item.id === entryId);
    if (!entry) return;

    document.getElementById('edit-entry-day').value = dayKey;
    document.getElementById('edit-entry-id').value = entryId;
    document.getElementById('edit-entry-subtitle').value = entry.subtitle || '';
    document.getElementById('edit-entry-content').value = entry.content || '';
    openModal('modal-edit-entry');
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    const dayKey = document.getElementById('edit-entry-day').value;
    const entryId = document.getElementById('edit-entry-id').value;
    const newSubtitle = document.getElementById('edit-entry-subtitle').value.trim();
    const newContent = document.getElementById('edit-entry-content').value.trim();

    if (!newContent) return;

    const list = state.entriesByDate[dayKey] || [];
    const target = list.find((item) => item.id === entryId);
    if (target) {
      target.subtitle = newSubtitle;
      target.content = newContent;
      saveState();
      closeModal('modal-edit-entry');
      if (activeTab === 'editor') renderEditorToday();
      else renderNewspaper();
      showToast('تم حفظ التعديل');
    }
  }

  function handleDeleteEntry() {
    const dayKey = document.getElementById('edit-entry-day').value;
    const entryId = document.getElementById('edit-entry-id').value;
    const list = state.entriesByDate[dayKey] || [];
    state.entriesByDate[dayKey] = list.filter((item) => item.id !== entryId);
    if (state.entriesByDate[dayKey].length === 0) {
      delete state.entriesByDate[dayKey];
    }
    saveState();
    closeModal('modal-edit-entry');
    if (activeTab === 'editor') renderEditorToday();
    else renderNewspaper();
    showToast('تم حذف الفقرة');
  }

  // -------------------- Export Custom Logo PNG (Transparent) --------------------
  async function exportLogoPNG() {
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
        await document.fonts.load('700 220px NashrahLogo');
      }
    } catch (e) {
      console.warn('Font load warning:', e);
    }

    const canvas = document.getElementById('logo-export-canvas');
    const width = 1400;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#1A1A1A';
    ctx.font = '700 260px "NashrahLogo", "Cairo", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText('نَشْرَة', width / 2, height / 2);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'nashrah-logo-transparent.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تحميل شعار نشرة (PNG شفاف)');
  }

  // -------------------- Export Newspaper as Image (html2canvas) --------------------
  async function exportNewspaperImage(mode) {
    if (typeof html2canvas !== 'function') {
      showToast('تعذر تحميل أداة تصدير الصور، تحقق من الاتصال.');
      return;
    }

    const progress = document.getElementById('export-progress');
    progress.classList.remove('hidden');

    const target = document.getElementById('newspaper-capture');
    const modeClass = mode === 'portrait' ? 'export-capture-portrait' : 'export-capture-landscape';

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
        await document.fonts.load('700 80px NashrahLogo');
      }

      target.classList.add(modeClass);
      await new Promise((r) => setTimeout(r, 150));

      const canvas = await html2canvas(target, {
        backgroundColor: '#F4F1EA',
        scale: mode === 'portrait' ? 2.5 : 2,
        useCORS: true,
        logging: false
      });

      const issueNum = getIssueNumber(currentViewedWeekStart);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `nashrah-issue-${issueNum}-${mode}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      closeModal('modal-export-image');
      showToast('تم حفظ صورة الجريدة بنجاح');
    } catch (err) {
      console.error('Export image failed:', err);
      showToast('حدث خطأ أثناء تصدير الصورة');
    } finally {
      target.classList.remove(modeClass);
      progress.classList.add('hidden');
    }
  }

  // -------------------- JSON Backup & Restore --------------------
  function exportJSONBackup() {
    const payload = {
      app: 'Nashrah',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nashrah-backup-${toDateKey(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير النسخة الاحتياطية (JSON)');
  }

  function importJSONBackup(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const importedData = parsed.data ? parsed.data : parsed;
        if (!importedData || typeof importedData.entriesByDate !== 'object') {
          showToast('ملف النسخة الاحتياطية غير صالح');
          return;
        }
        state.subtitle = importedData.subtitle || 'نشرتي الأسبوعية';
        state.fontMode = importedData.fontMode === 'clear' ? 'clear' : 'custom';
        state.entriesByDate = importedData.entriesByDate || {};
        state.baseWeekStart = importedData.baseWeekStart || toDateKey(getWeekSaturday(new Date()));
        saveState();
        applyFontMode(state.fontMode);
        renderEditorToday();
        if (activeTab === 'newspaper') renderNewspaper();
        closeModal('modal-settings');
        showToast('تم استيراد النسخة الاحتياطية بنجاح');
      } catch (err) {
        showToast('تعذر قراءة ملف JSON');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  // -------------------- Demo Data & Clear --------------------
  function seedDemoWeek() {
    const sat = getWeekSaturday(new Date());
    const samples = [
      { offset: 0, subtitle: 'بداية أسبوع هادئ', content: 'رتّبت مكتبي وحددت أولويات هذا الأسبوع مع فنجان قهوة صباحي.', time: '9:15 ص' },
      { offset: 1, subtitle: 'إنجاز تقني', content: 'أنهيت مراجعة واجهة المشروع الجديد وأضفت تحسينات على سرعة الاستجابة.', time: '4:40 م' },
      { offset: 2, subtitle: 'خاطرة مسائية', content: 'الالتزام بعشر دقائق يومياً للتدوين يصنع فارقاً واضحاً في صفاء الذهن.', time: '9:30 م' },
      { offset: 3, subtitle: 'قراءة وملاحظات', content: 'أكملت قراءة فصلين حول تصميم المطبوعات الكلاسيكية وتناسق الخطوط العربية.', time: '7:10 م' },
      { offset: 4, subtitle: 'لقاء مع الأصدقاء', content: 'جلسة مسائية لطيفة وتبادل أفكار حول مشاريع الويب القادمة.', time: '10:05 م' },
      { offset: 5, subtitle: 'نزهة قبل الغروب', content: 'مشي سريع لمدة نصف ساعة مع أجواء معتدلة وهادئة.', time: '5:20 م' }
    ];

    samples.forEach((s, idx) => {
      const dKey = toDateKey(addDays(sat, s.offset));
      if (!state.entriesByDate[dKey]) state.entriesByDate[dKey] = [];
      state.entriesByDate[dKey].push({
        id: `demo_${Date.now()}_${idx}`,
        subtitle: s.subtitle,
        content: s.content,
        timeLabel: s.time,
        createdAt: new Date().toISOString()
      });
    });

    saveState();
    closeModal('modal-settings');
    switchTab('newspaper');
    showToast('تمت إضافة مقالات تجريبية للمعاينة');
  }

  // -------------------- PWA Registration & Install Prompt --------------------
  let deferredInstallPrompt = null;

  function setupPWA() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('SW registration skipped:', err);
      });
    }

    const btnHeader = document.getElementById('btn-install-pwa');
    const btnSettings = document.getElementById('btn-install-pwa-settings');
    const hint = document.getElementById('pwa-install-hint');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (btnHeader) btnHeader.classList.remove('hidden');
      if (btnSettings) btnSettings.classList.remove('hidden');
      if (hint) hint.classList.add('hidden');
    });

    async function triggerInstall() {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        showToast('تم تثبيت تطبيق نشرة بنجاح');
      }
      deferredInstallPrompt = null;
      if (btnHeader) btnHeader.classList.add('hidden');
      if (btnSettings) btnSettings.classList.add('hidden');
    }

    if (btnHeader) btnHeader.addEventListener('click', triggerInstall);
    if (btnSettings) btnSettings.addEventListener('click', triggerInstall);

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (btnHeader) btnHeader.classList.add('hidden');
      if (btnSettings) btnSettings.classList.add('hidden');
      showToast('تم تثبيت تطبيق نشرة على جهازك');
    });
  }

  // -------------------- Initialization & Events --------------------
  function init() {
    loadState();
    applyFontMode(state.fontMode);
    currentViewedWeekStart = getWeekSaturday(new Date());

    // Tabs
    document.getElementById('tab-btn-editor').addEventListener('click', () => switchTab('editor'));
    document.getElementById('tab-btn-newspaper').addEventListener('click', () => switchTab('newspaper'));
    document.getElementById('btn-brand-home').addEventListener('click', () => switchTab('newspaper'));
    document.getElementById('btn-goto-newspaper').addEventListener('click', () => switchTab('newspaper'));

    // Quick Font Toggle & Settings Font Buttons
    document.getElementById('btn-toggle-font-quick').addEventListener('click', () => {
      const next = state.fontMode === 'clear' ? 'custom' : 'clear';
      applyFontMode(next);
      saveState();
      showToast(next === 'clear' ? 'تم تفعيل الخط الواضح' : 'تم تفعيل خط الرقعة');
    });

    document.getElementById('btn-font-custom').addEventListener('click', () => {
      applyFontMode('custom');
      saveState();
      showToast('تم تفعيل خط الرقعة');
    });

    document.getElementById('btn-font-clear').addEventListener('click', () => {
      applyFontMode('clear');
      saveState();
      showToast('تم تفعيل الخط الواضح');
    });

    // Editor Submit
    document.getElementById('editor-form').addEventListener('submit', handlePublish);

    // Editable Masthead Subtitle
    const subtitleInput = document.getElementById('masthead-subtitle-input');
    subtitleInput.value = state.subtitle;
    subtitleInput.addEventListener('input', () => {
      state.subtitle = subtitleInput.value.trim() || 'نشرتي الأسبوعية';
      saveState();
    });

    // Issue Navigation
    document.getElementById('btn-prev-week').addEventListener('click', () => {
      currentViewedWeekStart = addDays(currentViewedWeekStart, -7);
      renderNewspaper();
    });
    document.getElementById('btn-next-week').addEventListener('click', () => {
      currentViewedWeekStart = addDays(currentViewedWeekStart, 7);
      renderNewspaper();
    });
    document.getElementById('btn-current-week').addEventListener('click', () => {
      currentViewedWeekStart = getWeekSaturday(new Date());
      renderNewspaper();
    });
    document.getElementById('issue-select').addEventListener('change', (e) => {
      currentViewedWeekStart = parseDateKey(e.target.value);
      renderNewspaper();
    });

    // Modals close buttons
    document.querySelectorAll('.close-modal').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });

    // Edit/Delete Entry
    document.getElementById('edit-entry-form').addEventListener('submit', handleSaveEdit);
    document.getElementById('btn-delete-entry').addEventListener('click', handleDeleteEntry);

    // Export Image Modal
    document.getElementById('btn-open-export').addEventListener('click', () => openModal('modal-export-image'));
    document.getElementById('btn-export-portrait').addEventListener('click', () => exportNewspaperImage('portrait'));
    document.getElementById('btn-export-landscape').addEventListener('click', () => exportNewspaperImage('landscape'));

    // Settings Modal
    document.getElementById('btn-open-settings').addEventListener('click', () => openModal('modal-settings'));
    document.getElementById('btn-download-logo-png').addEventListener('click', exportLogoPNG);
    document.getElementById('btn-export-json').addEventListener('click', exportJSONBackup);
    document.getElementById('input-import-json').addEventListener('change', importJSONBackup);
    document.getElementById('btn-seed-demo').addEventListener('click', seedDemoWeek);

    document.getElementById('btn-clear-all').addEventListener('click', () => {
      document.getElementById('confirm-clear-box').classList.remove('hidden');
    });
    document.getElementById('btn-cancel-clear').addEventListener('click', () => {
      document.getElementById('confirm-clear-box').classList.add('hidden');
    });
    document.getElementById('btn-confirm-clear').addEventListener('click', () => {
      state.entriesByDate = {};
      state.subtitle = 'نشرتي الأسبوعية';
      state.baseWeekStart = toDateKey(getWeekSaturday(new Date()));
      saveState();
      document.getElementById('confirm-clear-box').classList.add('hidden');
      closeModal('modal-settings');
      renderEditorToday();
      if (activeTab === 'newspaper') renderNewspaper();
      showToast('تم مسح جميع البيانات');
    });

    setupPWA();

    // Initial render
    renderEditorToday();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
