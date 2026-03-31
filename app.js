/* ═══════════════════════════════════════════════════════════
   DASHBOARD SUIVI FITNESS — APP LOGIC
   Calendar View · Day Dashboard · Firebase + LocalStorage
   ═══════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─────────────────────────── HELPERS ───────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function dateToKey(date) {
        return date.toISOString().slice(0, 10);
    }

    function todayKey() {
        return dateToKey(new Date());
    }

    // ─────────────────────────── DATA LAYER ───────────────────────────
    let db = null; // Firestore instance
    let useFirebase = false;

    function initFirebase() {
        try {
            if (typeof firebase !== 'undefined' &&
                typeof firebaseConfig !== 'undefined' &&
                firebaseConfig.apiKey && firebaseConfig.apiKey !== 'REPLACE_ME') {
                firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
                useFirebase = true;
                console.log('Firebase connected');
                // Load cloud data on startup
                loadCloudData();
            } else {
                console.log('Firebase not configured — using localStorage only');
            }
        } catch (e) {
            console.warn('Firebase init failed:', e);
            useFirebase = false;
        }
    }

    function loadData() {
        try {
            return JSON.parse(localStorage.getItem('eliasFitness') || '{}');
        } catch {
            return {};
        }
    }

    function saveData(data) {
        // Always save to localStorage (instant, works offline)
        localStorage.setItem('eliasFitness', JSON.stringify(data));

        // Sync to Firebase in background
        if (useFirebase && db) {
            syncToCloud(data);
        }
    }

    function syncToCloud(data) {
        if (!db) return;
        db.collection('users').doc('default').set({ days: data }, { merge: true })
            .catch((e) => console.warn('Cloud sync failed:', e));
    }

    function loadCloudData() {
        if (!db) return;
        db.collection('users').doc('default').get()
            .then((doc) => {
                if (doc.exists && doc.data().days) {
                    const cloudData = doc.data().days;
                    const localData = loadData();

                    // Merge: cloud wins for any key that exists in cloud
                    const merged = { ...localData, ...cloudData };
                    localStorage.setItem('eliasFitness', JSON.stringify(merged));

                    // Re-render calendar with fresh data
                    renderCalendar();
                    console.log('Cloud data loaded & merged');
                }
            })
            .catch((e) => console.warn('Cloud load failed:', e));
    }

    function getDayData(data, key) {
        if (!data[key]) {
            data[key] = {
                water: [false, false, false, false, false, false],
                steps: 0,
                walk: null,
                food: { eggs: false, tuna: false, fromage: false, zeroMonster: false },
                weight: null,
                facePhotos: [],
            };
        }
        return data[key];
    }

    function calcDayScore(dayData) {
        if (!dayData) return 0;
        let completed = 0;
        if (dayData.water && dayData.water.filter(Boolean).length >= 5) completed++;
        if (dayData.water && dayData.water.every(Boolean)) completed++;
        if (dayData.steps >= 15000) completed++;
        if (dayData.walk) completed++;
        if (dayData.walk && dayData.walk.incline >= 12) completed++;
        if (dayData.food && (dayData.food.eggs || dayData.food.tuna || dayData.food.fromage)) completed++;
        if (dayData.food && dayData.food.zeroMonster) completed++;
        if (dayData.weight) completed++;
        return completed;
    }

    function showToast(msg) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    function formatDateLong(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const str = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ═══════════════════════════════════════════════════════════
    // CALENDAR VIEW
    // ═══════════════════════════════════════════════════════════

    let calYear, calMonth; // Currently displayed month

    function initCalendar() {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();

        renderCalendar();

        $('#cal-prev').addEventListener('click', () => {
            calMonth--;
            if (calMonth < 0) { calMonth = 11; calYear--; }
            renderCalendar();
        });

        $('#cal-next').addEventListener('click', () => {
            calMonth++;
            if (calMonth > 11) { calMonth = 0; calYear++; }
            renderCalendar();
        });
    }

    function renderCalendar() {
        const data = loadData();
        const grid = $('#calendar-grid');
        grid.innerHTML = '';

        // Month title
        const monthNames = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        $('#cal-month-title').textContent = `${monthNames[calMonth]} ${calYear}`;

        // First day of month (Monday=0 based)
        const firstDay = new Date(calYear, calMonth, 1);
        let startWeekday = firstDay.getDay(); // 0=Sun
        startWeekday = startWeekday === 0 ? 6 : startWeekday - 1; // Convert to Mon=0

        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const todayStr = todayKey();

        // Empty cells before first day
        for (let i = 0; i < startWeekday; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            grid.appendChild(empty);
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(calYear, calMonth, d);
            const key = dateToKey(dateObj);
            const dayData = data[key];
            const score = calcDayScore(dayData);
            const hasData = dayData && score > 0;

            const cell = document.createElement('div');
            cell.className = 'cal-day';
            if (key === todayStr) cell.classList.add('today');
            if (hasData) cell.classList.add('has-data');

            let inner = `<span class="cal-day-number">${d}</span>`;
            if (hasData) {
                inner += `<span class="cal-day-score">${Math.round((score / 8) * 100)}%</span>`;
            }

            cell.innerHTML = inner;

            cell.addEventListener('click', () => {
                openDashboard(key);
            });

            grid.appendChild(cell);
        }

        // Render weight overview chart
        renderCalWeightChart(data);
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW SWITCHING
    // ═══════════════════════════════════════════════════════════

    let selectedDateKey = null;
    let weightChart = null;
    let calWeightChart = null;
    let dashboardInitialized = false;

    function openDashboard(dateKey) {
        selectedDateKey = dateKey;

        // Destroy calendar chart before switching
        if (calWeightChart) {
            calWeightChart.destroy();
            calWeightChart = null;
        }

        $('#calendar-view').classList.add('hidden');
        $('#dashboard-view').classList.remove('hidden');

        // Set date display
        $('#date-display').textContent = formatDateLong(dateKey);

        // Initialize dashboard for this date
        initDashboard();

        window.scrollTo(0, 0);
    }

    function goBackToCalendar() {
        // Destroy chart to prevent canvas reuse issues
        if (weightChart) {
            weightChart.destroy();
            weightChart = null;
        }

        // Remove all event listeners by cloning key elements
        dashboardInitialized = false;

        $('#dashboard-view').classList.add('hidden');
        $('#calendar-view').classList.remove('hidden');

        // Re-render calendar to show updated scores
        renderCalendar();
        window.scrollTo(0, 0);
    }

    // ═══════════════════════════════════════════════════════════
    // DASHBOARD (for selected day)
    // ═══════════════════════════════════════════════════════════

    function initDashboard() {
        const data = loadData();
        const dayData = getDayData(data, selectedDateKey);

        initWater(data, dayData);
        initSteps(data, dayData);
        initWalk(data, dayData);
        initFood(data, dayData);
        initWeight(data, dayData);
        initFace(data, dayData);
        initScore(data, dayData);
        initReset(data);
    }

    // ─────────────────────────── WATER TRACKER ───────────────────────────
    function initWater(data, dayData) {
        const container = $('#water-bottles');
        container.innerHTML = '';

        for (let i = 0; i < 6; i++) {
            const bottle = document.createElement('div');
            bottle.className = 'water-bottle' + (dayData.water[i] ? ' filled' : '');
            bottle.innerHTML = `
                <span class="bottle-icon">${dayData.water[i] ? '●' : '○'}</span>
                <span class="bottle-label">0.5L</span>
            `;
            bottle.addEventListener('click', () => {
                dayData.water[i] = !dayData.water[i];
                saveData(data);
                updateWaterUI(dayData);
                bottle.classList.toggle('filled');
                bottle.querySelector('.bottle-icon').textContent = dayData.water[i] ? '●' : '○';
                updateScore(data, dayData);
            });
            container.appendChild(bottle);
        }

        updateWaterUI(dayData);
    }

    function updateWaterUI(dayData) {
        const filled = dayData.water.filter(Boolean).length;
        const pct = (filled / 6) * 100;
        $('#water-gauge-fill').style.width = pct + '%';
        $('#water-progress-label').textContent = `${(filled * 0.5).toFixed(1)} / 3L`;
    }

    // ─────────────────────────── STEP COUNTER ───────────────────────────
    function initSteps(data, dayData) {
        // Inject SVG gradient
        const ring = $('.steps-ring');
        if (!ring.querySelector('defs')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            grad.id = 'steps-gradient';
            grad.setAttribute('x1', '0%');
            grad.setAttribute('y1', '0%');
            grad.setAttribute('x2', '100%');
            grad.setAttribute('y2', '100%');
            const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            s1.setAttribute('offset', '0%');
            s1.setAttribute('stop-color', '#16a34a');
            const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            s2.setAttribute('offset', '100%');
            s2.setAttribute('stop-color', '#22c55e');
            grad.appendChild(s1);
            grad.appendChild(s2);
            defs.appendChild(grad);
            ring.insertBefore(defs, ring.firstChild);
        }

        $('#steps-ring-progress').style.stroke = 'url(#steps-gradient)';
        updateStepsUI(dayData);

        // Clone button to remove old listeners
        const oldBtn = $('#steps-save-btn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        const oldInput = $('#steps-input');
        const newInput = oldInput.cloneNode(true);
        oldInput.parentNode.replaceChild(newInput, oldInput);

        newBtn.addEventListener('click', () => {
            const val = parseInt($('#steps-input').value, 10);
            if (isNaN(val) || val < 0) return;
            dayData.steps = val;
            saveData(data);
            updateStepsUI(dayData);
            $('#steps-input').value = '';
            showToast(`${val.toLocaleString('fr-FR')} pas enregistrés`);
            updateScore(data, dayData);
        });

        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('#steps-save-btn').click();
        });
    }

    function updateStepsUI(dayData) {
        const steps = dayData.steps || 0;
        const goal = 15000;
        const maxGoal = 20000;
        const pct = Math.min(steps / goal, 1);
        const circumference = 2 * Math.PI * 85;

        $('#steps-count').textContent = steps.toLocaleString('fr-FR');
        $('#steps-ring-progress').style.strokeDashoffset = circumference * (1 - pct);

        if (steps >= maxGoal) {
            $('#steps-count').style.color = '#d97706';
        } else {
            $('#steps-count').style.color = '';
        }
    }

    // ─────────────────────────── INCLINE WALK ───────────────────────────
    function initWalk(data, dayData) {
        $('#walk-duration').value = '';
        $('#walk-incline').value = '';
        $('#walk-speed').value = '';
        $('#walk-summary').innerHTML = '';
        $('#mission-badge').classList.remove('visible');

        if (dayData.walk) {
            populateWalkUI(dayData.walk);
        }

        // Clone button to remove old listeners
        const oldBtn = $('#walk-save-btn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        newBtn.addEventListener('click', () => {
            const duration = parseFloat($('#walk-duration').value);
            const incline = parseFloat($('#walk-incline').value);
            const speed = parseFloat($('#walk-speed').value);

            if (isNaN(duration) || isNaN(incline) || isNaN(speed)) {
                showToast('Remplis tous les champs');
                return;
            }

            dayData.walk = { duration, incline, speed };
            saveData(data);
            populateWalkUI(dayData.walk);
            showToast('Séance enregistrée');
            updateScore(data, dayData);
        });
    }

    function populateWalkUI(walk) {
        if (!walk) return;
        $('#walk-duration').value = walk.duration;
        $('#walk-incline').value = walk.incline;
        $('#walk-speed').value = walk.speed;

        const badge = $('#mission-badge');
        if (walk.incline >= 12) {
            badge.classList.add('visible');
        } else {
            badge.classList.remove('visible');
        }

        const distance = ((walk.speed * walk.duration) / 60).toFixed(2);
        $('#walk-summary').innerHTML = `
            <span class="summary-highlight">${walk.duration} min</span> à 
            <span class="summary-highlight">${walk.incline}%</span> d'inclinaison, 
            <span class="summary-highlight">${walk.speed} km/h</span> 
            — Distance : <span class="summary-highlight">${distance} km</span>
        `;
    }

    // ─────────────────────────── FOOD JOURNAL ───────────────────────────
    function initFood(data, dayData) {
        $$('.food-checkbox').forEach((cb) => {
            const key = cb.dataset.food;

            // Clone to remove old listeners
            const newCb = cb.cloneNode(true);
            cb.parentNode.replaceChild(newCb, cb);

            newCb.checked = dayData.food[key] || false;

            newCb.addEventListener('change', () => {
                dayData.food[key] = newCb.checked;
                saveData(data);
                updateScore(data, dayData);
                if (key === 'zeroMonster' && newCb.checked) {
                    showToast('Bravo, zéro boisson énergisante');
                }
            });
        });
    }

    // ─────────────────────────── WEIGHT CHART ───────────────────────────
    function initWeight(data, dayData) {
        if (dayData.weight) {
            $('#weight-input').value = dayData.weight;
        } else {
            $('#weight-input').value = '';
        }

        // Clone button
        const oldBtn = $('#weight-save-btn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        const oldInput = $('#weight-input');
        const newInput = oldInput.cloneNode(true);
        oldInput.parentNode.replaceChild(newInput, oldInput);

        newBtn.addEventListener('click', () => {
            const val = parseFloat($('#weight-input').value);
            if (isNaN(val) || val < 30 || val > 300) {
                showToast('Poids invalide');
                return;
            }
            dayData.weight = val;
            saveData(data);
            renderWeightChart(data);
            showToast(`${val} kg enregistré`);
            updateScore(data, dayData);
        });

        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('#weight-save-btn').click();
        });

        renderWeightChart(data);
    }

    function renderWeightChart(data) {
        const entries = [];
        const now = new Date();

        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = dateToKey(d);
            if (data[key] && data[key].weight) {
                entries.push({ date: key, weight: data[key].weight });
            }
        }

        const labels = entries.map((e) => formatDate(e.date));
        const values = entries.map((e) => e.weight);

        const ctx = $('#weight-chart').getContext('2d');

        if (weightChart) {
            weightChart.destroy();
        }

        weightChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Poids (kg)',
                    data: values,
                    borderColor: '#6b7280',
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx: cctx, chartArea } = chart;
                        if (!chartArea) return 'transparent';
                        const gradient = cctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, '#6b728020');
                        gradient.addColorStop(1, '#6b728000');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    pointBackgroundColor: '#6b7280',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.35,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffffee',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        titleColor: '#1a1a1a',
                        bodyColor: '#6b7280',
                        bodyFont: { weight: '700' },
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y} kg`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { color: '#f2f2f4', drawBorder: false },
                        ticks: { color: '#9ca3af', font: { size: 11, family: 'Inter' } },
                    },
                    y: {
                        grid: { color: '#f2f2f4', drawBorder: false },
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 11, family: 'Inter' },
                            callback: (v) => v + ' kg',
                        },
                    },
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            },
        });
    }

    // ─────────────────────────── FACE UPLOAD ───────────────────────────
    function initFace(data, dayData) {
        // Reset preview
        $('#face-preview').classList.remove('visible');
        $('#face-upload-placeholder').style.display = '';

        renderFaceGallery(data);

        // Clone file input and clear btn
        const oldFile = $('#face-file-input');
        const newFile = oldFile.cloneNode(true);
        oldFile.parentNode.replaceChild(newFile, oldFile);

        const oldClear = $('#face-clear-btn');
        const newClear = oldClear.cloneNode(true);
        oldClear.parentNode.replaceChild(newClear, oldClear);

        newFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                resizeImage(dataUrl, 400, (resized) => {
                    const preview = $('#face-preview');
                    preview.src = resized;
                    preview.classList.add('visible');
                    $('#face-upload-placeholder').style.display = 'none';

                    if (!dayData.facePhotos) dayData.facePhotos = [];
                    dayData.facePhotos.push({
                        date: selectedDateKey,
                        src: resized,
                    });
                    saveData(data);
                    renderFaceGallery(data);
                    showToast('Photo sauvegardée');
                });
            };
            reader.readAsDataURL(file);
        });

        newClear.addEventListener('click', () => {
            if (!confirm('Effacer toutes les photos de suivi visage ?')) return;
            Object.keys(data).forEach((key) => {
                if (data[key] && data[key].facePhotos) {
                    data[key].facePhotos = [];
                }
            });
            saveData(data);
            renderFaceGallery(data);
            $('#face-preview').classList.remove('visible');
            $('#face-upload-placeholder').style.display = '';
            showToast('Photos effacées');
        });
    }

    function resizeImage(dataUrl, maxWidth, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    }

    function renderFaceGallery(data) {
        const gallery = $('#face-gallery');
        gallery.innerHTML = '';

        const allPhotos = [];
        Object.keys(data)
            .sort()
            .forEach((dayKey) => {
                if (data[dayKey] && data[dayKey].facePhotos) {
                    data[dayKey].facePhotos.forEach((photo) => {
                        allPhotos.push(photo);
                    });
                }
            });

        allPhotos.slice(-8).forEach((photo) => {
            const item = document.createElement('div');
            item.className = 'face-gallery-item';
            item.innerHTML = `
                <img src="${photo.src}" alt="Visage ${photo.date}">
                <span class="face-gallery-date">${formatDate(photo.date)}</span>
            `;
            gallery.appendChild(item);
        });
    }

    // ─────────────────────────── DAILY SCORE ───────────────────────────
    function initScore(data, dayData) {
        const dots = $('#score-dots');
        dots.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const dot = document.createElement('div');
            dot.className = 'score-dot';
            dot.dataset.index = i;
            dots.appendChild(dot);
        }
        updateScore(data, dayData);
    }

    function updateScore(data, dayData) {
        const completed = calcDayScore(dayData);
        const pct = Math.round((completed / 8) * 100);

        $$('.score-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i < completed);
        });

        $('#score-value').textContent = pct + '%';

        if (pct === 100) {
            $('#score-value').style.color = '#d97706';
        } else {
            $('#score-value').style.color = '';
        }
    }

    // ─────────────────────────── RESET ───────────────────────────
    function initReset(data) {
        const oldBtn = $('#reset-day-btn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        newBtn.addEventListener('click', () => {
            if (!confirm('Réinitialiser toutes les données de ce jour ?')) return;
            delete data[selectedDateKey];
            saveData(data);
            // Re-initialize dashboard
            initDashboard();
            showToast('Journée réinitialisée');
        });
    }

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════

    // ─────────────────────────── CALENDAR WEIGHT CHART ───────────────────────────
    function renderCalWeightChart(data) {
        const entries = [];

        // Collect ALL weight entries sorted by date
        Object.keys(data)
            .sort()
            .forEach((key) => {
                if (data[key] && data[key].weight) {
                    entries.push({ date: key, weight: data[key].weight });
                }
            });

        const emptyMsg = $('#cal-weight-empty');
        const chartContainer = $('.cal-chart-container');
        chartContainer.style.display = 'block';

        let labels, values, isPlaceholder;

        if (entries.length === 0) {
            // Show placeholder template
            emptyMsg.classList.remove('hidden-msg');
            isPlaceholder = true;
            const now = new Date();
            labels = [];
            values = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                labels.push(formatDate(dateToKey(d)));
                values.push(null);
            }
        } else {
            emptyMsg.classList.add('hidden-msg');
            isPlaceholder = false;
            labels = entries.map((e) => formatDate(e.date));
            values = entries.map((e) => e.weight);
        }

        const ctx = $('#cal-weight-chart').getContext('2d');

        if (calWeightChart) {
            calWeightChart.destroy();
        }

        calWeightChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Poids (kg)',
                    data: values,
                    borderColor: '#6b7280',
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx: cctx, chartArea } = chart;
                        if (!chartArea) return 'transparent';
                        const gradient = cctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, '#00bfff25');
                        gradient.addColorStop(1, '#00bfff00');
                        return gradient;
                    },
                    borderWidth: 2.5,
                    pointBackgroundColor: '#6b7280',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.35,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffffee',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        titleColor: '#1a1a1a',
                        bodyColor: '#6b7280',
                        bodyFont: { weight: '700' },
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y} kg`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { color: '#f2f2f4', drawBorder: false },
                        ticks: { color: '#9ca3af', font: { size: 10, family: 'Inter' }, maxRotation: 45 },
                    },
                    y: {
                        grid: { color: '#f2f2f4', drawBorder: false },
                        suggestedMin: isPlaceholder ? 60 : undefined,
                        suggestedMax: isPlaceholder ? 100 : undefined,
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 10, family: 'Inter' },
                            callback: (v) => v + ' kg',
                        },
                    },
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            },
        });
    }

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════

    function init() {
        initFirebase();
        initCalendar();

        // Back button
        $('#btn-back').addEventListener('click', goBackToCalendar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
