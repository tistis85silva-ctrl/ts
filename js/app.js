'use strict';

/* ============================================================
   COTA — do desenho à peça pronta (v5.0)
   UI do app: galeria de usinagem, features, roteiro,
   folha técnica e programação CNC (ISO + paramétrica)
   ============================================================ */

// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================
const SOFT_NAMES = {
    solidworks: 'SolidWorks',
    fusion: 'Fusion 360',
    inventor: 'Inventor'
};

const STORAGE_THEME = 'cota-theme';
const STORAGE_SESSION = 'cota-session';

const app = {
    theme: 'dark',
    soft: 'solidworks',
    partId: DEFAULT_PART_ID,
    steps: [],
    doneIds: new Set(),
    revealed: false,
    confirmed: false,
    fileName: '',
    codeTab: 'iso', // 'iso' | 'macro'
    filter: 'todas', // 'todas' | 'Fresamento' | 'Torneamento'
    doneAulas: new Set()
};

function currentPart() {
    return PARTS[app.partId] || PARTS[DEFAULT_PART_ID];
}

// ============================================================
// HELPERS
// ============================================================
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function parseNum(value, fallback, min, max) {
    let n = parseFloat(value);
    if (!isFinite(n)) n = fallback;
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
}

function todayBR() {
    return new Date().toLocaleDateString('pt-BR');
}

function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Realce simples de G-code: comentários, sequências, códigos G/M/T/S/F
function highlightGcode(text) {
    return text.split('\n').map(line => {
        let html = escapeHtml(line);
        // comentário entre parênteses
        html = html.replace(/\(([^)]*)\)/g, '<span class="gc-comment">($1)</span>');
        // códigos de comando
        html = html.replace(/\b([GM])(\d+)\b/g, '<span class="gc-code">$1$2</span>');
        html = html.replace(/\b(T\d+)\b/g, '<span class="gc-tool">$1</span>');
        html = html.replace(/\b(N\d+)\b/g, '<span class="gc-line">$1</span>');
        // variáveis de macro #nnn
        html = html.replace(/#(\d+)/g, '<span class="gc-var">#$1</span>');
        return html;
    }).join('\n');
}

// ============================================================
// TEMA
// ============================================================
function setTheme(theme) {
    app.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const toggle = $('#themeToggle');
    if (toggle) {
        toggle.classList.toggle('active', theme === 'light');
        toggle.setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
    }
    localStorage.setItem(STORAGE_THEME, theme);

    if (app.steps.length > 0) refreshSheet();
    if (app.revealed) renderCode();
}

// ============================================================
// PERSISTÊNCIA DE SESSÃO
// ============================================================
function saveSession() {
    const features = getFeatureState();
    const compact = {};
    Object.keys(features).forEach(id => {
        compact[id] = { included: features[id].included, params: features[id].params };
    });
    localStorage.setItem(STORAGE_SESSION, JSON.stringify({
        partId: app.partId,
        soft: app.soft,
        revealed: app.revealed,
        confirmed: app.confirmed,
        fileName: app.fileName,
        codeTab: app.codeTab,
        doneIds: Array.from(app.doneIds),
        doneAulas: Array.from(app.doneAulas),
        features: compact
    }));
}

function loadSession() {
    try {
        const raw = localStorage.getItem(STORAGE_SESSION);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

// ============================================================
// GALERIA DE SITUAÇÕES DE USINAGEM
// ============================================================
function renderGallery() {
    const grid = $('#exampleGrid');
    if (!grid) return;
    const ids = Object.keys(PARTS).filter(id => {
        if (app.filter === 'todas') return true;
        return PARTS[id].process.indexOf(app.filter) === 0;
    });
    grid.innerHTML = ids.map(id => {
        const p = PARTS[id];
        return '<button type="button" class="example-card' + (id === app.partId ? ' active' : '') +
            '" data-part="' + id + '" aria-pressed="' + (id === app.partId) + '">' +
            '<div class="ex-icon" aria-hidden="true">' + p.icon + '</div>' +
            '<p class="ex-name">' + p.name + '</p>' +
            '<p class="ex-desc">' + p.desc + '</p>' +
            '<div class="ex-tags">' +
            '<span class="ex-tag">' + p.process + '</span>' +
            '<span class="ex-tag ex-tag-diff">' + p.difficulty + '</span>' +
            '</div>' +
            '</button>';
    }).join('');
    if (!ids.length) {
        grid.innerHTML = '<p class="ex-empty">Nenhum exemplo neste filtro.</p>';
    }
    // estado dos chips
    $$('#filterChips .chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === app.filter);
    });
}

function updateGallerySelection() {
    $$('.example-card').forEach(card => {
        const active = card.dataset.part === app.partId;
        card.classList.toggle('active', active);
        card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function selectPart(partId, opts) {
    opts = opts || {};
    if (!PARTS[partId]) partId = DEFAULT_PART_ID;
    app.partId = partId;
    app.doneIds.clear();
    app.steps = [];
    app.confirmed = false;

    renderFeatures();
    updateGallerySelection();
    renderPartChrome();
    if (!opts.silent) saveSession();
}

// Atualiza rótulos, cena e seções conforme a peça atual
function renderPartChrome() {
    const part = currentPart();
    const label = $('#partLabel');
    if (label) label.textContent = part.tag + ' · REV.' + part.rev;

    const sheetTitle = $('#sheetTitle');
    if (sheetTitle) sheetTitle.textContent = part.tag;
    const sheetSub = $('#sheetSubtitle');
    if (sheetSub) sheetSub.textContent = part.process + ' · ' + part.machine;

    // cena 3D CSS só existe para a peça clássica; demais usam vista técnica ampliada
    const mainScene = $('#mainScene');
    const heroAlt = $('#heroAltSvg');
    const stage = $('.stage');
    if (part.cssScene) {
        if (mainScene) mainScene.style.display = '';
        if (heroAlt) heroAlt.style.display = 'none';
        if (stage) stage.classList.remove('alt');
    } else {
        if (mainScene) mainScene.style.display = 'none';
        if (heroAlt) heroAlt.style.display = '';
        if (stage) stage.classList.add('alt');
    }
    const sheet3d = $('#sheet3dBox');
    if (sheet3d) sheet3d.style.display = part.cssScene ? '' : 'none';

    // rótulos das vistas
    part.viewLabels.forEach((lab, i) => {
        const el = document.getElementById('viewLabel' + i);
        if (el) el.textContent = lab;
    });
}

// ============================================================
// FEATURES (Passo 1)
// ============================================================
function renderFeatures() {
    const grid = $('#featureGrid');
    grid.innerHTML = '';
    currentPart().features.forEach(f => {
        const row = document.createElement('div');
        row.className = 'feature-row';
        row.id = 'frow-' + f.id;

        const paramsHtml = f.params.map(p => {
            const inputId = 'p-' + f.id + '-' + p.key;
            return '<div class="param">' +
                '<label for="' + inputId + '">' + p.label + ' (' + p.unit + ')</label>' +
                '<input type="number" id="' + inputId + '" data-feature="' + f.id + '" data-key="' + p.key +
                '" value="' + p.value + '" step="any" min="0.1" max="2000">' +
                '</div>';
        }).join('');

        row.innerHTML =
            '<input type="checkbox" class="feature-check" data-feature="' + f.id + '" id="chk-' + f.id + '" checked>' +
            '<div>' +
            '<p class="feature-name"><label for="chk-' + f.id + '">' + f.name + '</label></p>' +
            '<p class="feature-hint">' + f.hint + '</p>' +
            '</div>' +
            '<div class="feature-params">' + paramsHtml + '</div>';

        grid.appendChild(row);
    });

    // Listeners delegados (registrados uma única vez)
    if (!grid._bound) {
        grid.addEventListener('change', onFeatureChange);
        grid.addEventListener('input', onFeatureChange);
        grid._bound = true;
    }
}

function onFeatureChange(e) {
    const isCheck = e.target.classList.contains('feature-check');
    if (isCheck) {
        const fid = e.target.dataset.feature;
        const row = $('#frow-' + fid);
        if (row) {
            row.classList.toggle('excluded', !e.target.checked);
            $$('#frow-' + fid + ' .param input').forEach(inp => {
                inp.disabled = !e.target.checked;
            });
        }
    }

    // Atualizações ao vivo: folha + código sempre; roteiro preserva progresso
    refreshSheet();
    if (app.revealed) renderCode();
    if (app.confirmed) refreshPlan();
    saveSession();
}

function getFeatureState() {
    const state = {};
    currentPart().features.forEach(f => {
        const checked = $('.feature-check[data-feature="' + f.id + '"]');
        const included = checked ? checked.checked : true;
        const params = {};
        f.params.forEach(p => {
            const input = $('input[data-feature="' + f.id + '"][data-key="' + p.key + '"]');
            params[p.key] = input ? parseNum(input.value, p.value, 0.1, 2000) : p.value;
        });
        state[f.id] = { included: included, params: params };
    });
    return state;
}

function applyFeatureState(saved) {
    if (!saved) return;
    currentPart().features.forEach(f => {
        const rec = saved[f.id];
        if (!rec) return;
        const checked = $('.feature-check[data-feature="' + f.id + '"]');
        if (checked) {
            checked.checked = rec.included !== false;
            const row = $('#frow-' + f.id);
            if (row) row.classList.toggle('excluded', !checked.checked);
            $$('#frow-' + f.id + ' .param input').forEach(inp => {
                inp.disabled = !checked.checked;
            });
        }
        f.params.forEach(p => {
            const input = $('input[data-feature="' + f.id + '"][data-key="' + p.key + '"]');
            if (input && rec.params && rec.params[p.key] != null) {
                input.value = rec.params[p.key];
            }
        });
    });
}

function getDims() {
    return currentPart().dimsFromState(getFeatureState());
}

// ============================================================
// ROTEIRO DE MODELAGEM (Passo 3)
// ============================================================
function renderSteps() {
    const stepsList = $('#stepsList');
    stepsList.innerHTML = '';

    app.steps.forEach((s, i) => {
        const el = document.createElement('div');
        el.className = 'step';
        el.id = 'step-' + s.id;
        el.setAttribute('role', 'listitem');

        const tipHtml = s.tip ?
            '<div class="step-tip"><span class="tip-icon" aria-hidden="true">💡</span><span>' + s.tip + '</span></div>' :
            '';

        const cmdKey = currentPart().stepCmd[s.id];
        const cmd = cmdKey ? cmdFor(app.soft, cmdKey) : '—';

        el.innerHTML =
            '<div class="step-num">' + (i + 1) + '</div>' +
            '<div>' +
            '<div class="step-header">' +
            '<p class="step-title">' + s.title + '</p>' +
            '<span class="step-badge">' + (s.badge || 'PASSO') + '</span>' +
            '</div>' +
            '<p class="step-desc">' + s.desc + '</p>' +
            '<div class="step-cmd"><span class="cmd-prefix">⌨️ comando:</span> <span class="cmd-text">' + cmd + '</span></div>' +
            tipHtml +
            '<br>' +
            '<button type="button" class="step-toggle" data-id="' + s.id + '" aria-pressed="false">⬜ Marcar concluída</button>' +
            '</div>';

        stepsList.appendChild(el);
    });

    updateProgressUI();
}

function updateCommands() {
    $$('.step').forEach(stepEl => {
        const id = stepEl.id.replace('step-', '');
        const cmdSpan = $('.cmd-text', stepEl);
        const cmdKey = currentPart().stepCmd[id];
        if (cmdSpan && cmdKey) {
            cmdSpan.textContent = cmdFor(app.soft, cmdKey);
        }
    });
}

function setStepDone(id, done, opts) {
    opts = opts || {};
    const stepEl = document.getElementById('step-' + id);
    if (!stepEl) return;

    stepEl.classList.toggle('done', done);
    const btn = $('.step-toggle', stepEl);
    if (btn) {
        btn.textContent = done ? '✅ Concluída' : '⬜ Marcar concluída';
        btn.setAttribute('aria-pressed', done ? 'true' : 'false');
    }

    if (done) {
        app.doneIds.add(id);
    } else {
        app.doneIds.delete(id);
    }

    // Monta/desmonta a cena 3D CSS (peças com sceneMap)
    const map = currentPart().sceneMap || {};
    (map[id] || []).forEach(elId => {
        const el = document.getElementById(elId);
        if (el) el.classList.toggle('on', done);
    });

    updateProgressUI();

    if (!opts.silent && app.steps.length > 0 && app.doneIds.size === app.steps.length) {
        showToast('🎉 Parabéns! Peça concluída com sucesso!');
    }
    if (!opts.silent) saveSession();
}

function updateProgressUI() {
    const total = app.steps.length;
    const done = app.doneIds.size;
    const pct = total ? Math.round(done / total * 100) : 0;

    $('#stepCount').textContent = done;
    $('#stepTotal').textContent = total;
    $('#planFill').style.width = pct + '%';
    $('#planPct').textContent = pct + '%';
    const bar = $('#planProgress');
    if (bar) bar.setAttribute('aria-valuenow', String(pct));
}

function resetScene() {
    const map = currentPart().sceneMap || {};
    Object.values(map).flat().forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('on');
    });
}

function resetPlan() {
    app.doneIds.clear();
    renderSteps();
    resetScene();
    saveSession();
    showToast('🔄 Progresso resetado');
}

// Rebuild preservando o progresso das etapas já concluídas
function refreshPlan() {
    const fState = getFeatureState();
    const doneBefore = new Set(app.doneIds);
    app.steps = currentPart().buildSteps(fState);
    app.doneIds.clear();
    resetScene();
    renderSteps();
    doneBefore.forEach(id => {
        if (app.steps.some(s => s.id === id)) {
            setStepDone(id, true, { silent: true });
        }
    });
    updateProgressUI();
    saveSession();
}

// ============================================================
// FOLHA DE DESENHO
// ============================================================
function renderDrawingSheet() {
    const part = currentPart();
    const fState = getFeatureState();
    const d = part.dimsFromState(fState);
    const t = sheetTheme();
    const views = part.views({ d: d, st: fState, t: t });

    views.forEach((v, i) => {
        const el = document.getElementById('svgView' + i);
        if (el) el.innerHTML = v.svg;
    });

    renderTechInfo(part, d, fState);

    // Miniatura 3D (só peças com cena CSS)
    if (part.cssScene) syncSheet3D(fState);

    // Vista ampliada no hero para peças sem cena CSS
    if (!part.cssScene) {
        const heroAlt = $('#heroAltSvg');
        if (heroAlt && views[0]) heroAlt.innerHTML = views[0].svg;
    }
}

function renderTechInfo(part, d, st) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    set('techMaterial', MATERIAL.name);
    const mass = part.computeMass(d, st);
    set('techWeight', mass.toFixed(2).replace('.', ',') + ' kg');
    set('techDate', todayBR());

    const rows = $('#techRows');
    if (rows) {
        rows.innerHTML = part.techRows(d, st).map(r =>
            '<div class="tech-row"><span class="tech-label">' + r.label +
            '</span><span class="tech-value">' + r.value + '</span></div>'
        ).join('');
    }
}

// Sincroniza a miniatura 3D da folha (cena CSS do suporte em L)
function syncSheet3D(fState) {
    const toggle = (id, on) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('on-sheet', !!on);
    };
    toggle('box-sheet-base', true);
    toggle('box-sheet-wall', fState.wall && fState.wall.included);
    toggle('hole-sheet-base', fState.hole_base && fState.hole_base.included);
    toggle('hole-sheet-wall', fState.hole_wall && fState.hole_wall.included && fState.wall && fState.wall.included);
    toggle('cm1-sheet', fState.chamfer && fState.chamfer.included);
    toggle('cm2-sheet', fState.chamfer && fState.chamfer.included);
}

function refreshSheet() {
    renderDrawingSheet();
}

// ============================================================
// PROGRAMAÇÃO CNC (Passo 4) — ISO + PARAMÉTRICO
// ============================================================
function codeOf(kind) {
    const part = currentPart();
    const fState = getFeatureState();
    const d = part.dimsFromState(fState);
    return kind === 'macro' ? part.macro(d, fState) : part.gcode(d, fState);
}

function renderCode() {
    const view = $('#codeView');
    if (!view) return;
    const code = codeOf(app.codeTab);
    view.innerHTML = highlightGcode(code);

    $$('.code-tab').forEach(tab => {
        const active = tab.dataset.code === app.codeTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const meta = $('#codeMeta');
    if (meta) {
        const part = currentPart();
        meta.textContent = part.machine + ' · ' + part.control + ' · ' + part.stock +
            ' · Programa ' + (app.codeTab === 'macro' ? 'paramétrico (macro)' : 'ISO 6983');
    }
}

function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyCode() {
    const text = codeOf(app.codeTab);
    const done = () => showToast('📋 Código copiado para a área de transferência');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}

function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showToast('⚠️ Não foi possível copiar'); }
    document.body.removeChild(ta);
}

function downloadCode() {
    const part = currentPart();
    const ext = app.codeTab === 'macro' ? 'macro.tap' : 'tap';
    const name = part.id + '-' + (app.codeTab === 'macro' ? 'parametrico' : 'iso') + '.' + ext;
    downloadText(name, codeOf(app.codeTab));
    showToast('💾 Programa salvo como ' + name);
}

// ============================================================
// TRILHA DE FORMAÇÃO (roteiro de aulas)
// ============================================================
function courseTotals() {
    let totalAulas = 0, totalHours = 0;
    COURSE.modules.forEach(m => m.aulas.forEach(a => { totalAulas++; totalHours += a.hours; }));
    return { totalAulas: totalAulas, totalHours: totalHours };
}

function renderCourse() {
    const meta = $('#courseMeta');
    const modules = $('#courseModules');
    if (!modules || typeof COURSE === 'undefined') return;

    const tot = courseTotals();
    if (meta) {
        meta.innerHTML =
            '<span class="course-chip">🎓 ' + COURSE.modules.length + ' módulos</span>' +
            '<span class="course-chip">📖 ' + tot.totalAulas + ' aulas</span>' +
            '<span class="course-chip">⏱ ' + tot.totalHours + 'h de carga horária</span>' +
            '<span class="course-chip">📈 Iniciante → Avançado</span>' +
            '<span class="course-chip">📋 ' + COURSE.certification + '</span>';
    }

    modules.innerHTML = COURSE.modules.map(m => {
        const hours = m.aulas.reduce((s, a) => s + a.hours, 0);
        const aulasHtml = m.aulas.map(a => {
            const part = a.partId ? PARTS[a.partId] : null;
            const done = app.doneAulas.has(a.id);
            const roteiroRows = a.roteiro.map(r =>
                '<tr><td class="rt-fase">' + r.fase + '</td><td class="rt-min">' + r.min + ' min</td><td class="rt-desc">' + r.desc + '</td></tr>'
            ).join('');
            const roteiroTotal = a.roteiro.reduce((s, r) => s + r.min, 0);

            return '<div class="aula' + (done ? ' done' : '') + '" id="aula-' + a.id + '">' +
                '<div class="aula-head">' +
                '<label class="aula-check-label">' +
                '<input type="checkbox" class="aula-check" data-aula="' + a.id + '"' + (done ? ' checked' : '') +
                ' aria-label="Marcar aula ' + a.num + ' como concluída">' +
                '</label>' +
                '<button type="button" class="aula-toggle" aria-expanded="false">' +
                '<span class="aula-num">' + a.num + '</span>' +
                '<span class="aula-title">' + a.title + '</span>' +
                '<span class="aula-hours">' + a.hours + 'h</span>' +
                '</button>' +
                (part ? '<button type="button" class="aula-open" data-part="' + part.id + '" title="Abrir o exemplo prático desta aula">' +
                    part.icon + ' <span>exemplo</span> →</button>' : '') +
                '</div>' +
                '<div class="aula-panel">' +
                '<div class="aula-cols">' +
                '<div>' +
                '<h4 class="aula-h">🎯 Objetivos de aprendizagem</h4>' +
                '<ul class="aula-items">' + a.objectives.map(o => '<li>' + o + '</li>').join('') + '</ul>' +
                '<h4 class="aula-h">📚 Conteúdos técnicos</h4>' +
                '<ul class="aula-items">' + a.topics.map(o => '<li>' + o + '</li>').join('') + '</ul>' +
                '</div>' +
                '<div>' +
                '<h4 class="aula-h">⏱ Roteiro da aula <span class="aula-total-min">(' + roteiroTotal + ' min)</span></h4>' +
                '<table class="roteiro-table">' +
                '<thead><tr><th>Fase</th><th>Tempo</th><th>Descrição</th></tr></thead>' +
                '<tbody>' + roteiroRows + '</tbody>' +
                '</table>' +
                '</div>' +
                '</div>' +
                '<div class="aula-cols">' +
                '<div>' +
                '<h4 class="aula-h">⚠️ Pontos de atenção</h4>' +
                '<ul class="aula-attention">' + a.attention.map(o => '<li>' + o + '</li>').join('') + '</ul>' +
                '</div>' +
                '<div>' +
                '<h4 class="aula-h">✅ Critérios de avaliação</h4>' +
                '<ul class="aula-checklist">' + a.checklist.map(o => '<li>' + o + '</li>').join('') + '</ul>' +
                '</div>' +
                '</div>' +
                (part ? '<div class="aula-practice">🧪 <b>Prática no app:</b> use o exemplo <b>' + part.name + '</b> — features paramétricas, folha técnica, código ISO e macro. ' +
                    '<button type="button" class="btn btn-sm aula-open" data-part="' + part.id + '">Abrir exemplo →</button></div>' : '') +
                '</div>' +
                '</div>';
        }).join('');

        return '<div class="module-card">' +
            '<div class="module-head">' +
            '<div class="module-badge">M' + m.number + '</div>' +
            '<div class="module-info">' +
            '<h3 class="module-title">' + m.title + '</h3>' +
            '<p class="module-goal">' + m.goal + '</p>' +
            '</div>' +
            '<div class="module-meta">' +
            '<span class="ex-tag ex-tag-diff">' + m.level + '</span>' +
            '<span class="ex-tag">' + hours + 'h</span>' +
            '</div>' +
            '</div>' +
            (m.note ? '<p class="module-note">💡 <b>Dica do instrutor:</b> ' + m.note + '</p>' : '') +
            '<div class="aula-list">' + aulasHtml + '</div>' +
            '</div>';
    }).join('');

    updateCourseProgress();
}

function updateCourseProgress() {
    const tot = courseTotals();
    const done = app.doneAulas.size;
    const pct = tot.totalAulas ? Math.round(done / tot.totalAulas * 100) : 0;
    $('#courseFill').style.width = pct + '%';
    $('#coursePct').textContent = pct + '%';
    $('#courseDoneCount').textContent = done + '/' + tot.totalAulas + ' aulas concluídas' +
        (done === tot.totalAulas && tot.totalAulas > 0 ? ' — trilha completa! 🎉' : '');
    const bar = $('#courseProgress');
    if (bar) bar.setAttribute('aria-valuenow', String(pct));
}

function toggleAllAulas() {
    const panels = $$('.aula-panel');
    const anyClosed = panels.some(p => !p.classList.contains('open'));
    panels.forEach(p => p.classList.toggle('open', anyClosed));
    $$('.aula-toggle').forEach(b => b.setAttribute('aria-expanded', anyClosed ? 'true' : 'false'));
    const btn = $('#btnToggleAllAulas');
    if (btn) btn.textContent = anyClosed ? '📕 Recolher tudo' : '📂 Expandir tudo';
}

function printCourse() {
    const tot = courseTotals();
    const meta = $('#printCourseMeta');
    if (meta) {
        meta.textContent = COURSE.title + ' · ' + COURSE.modules.length + ' módulos · ' +
            tot.totalAulas + ' aulas · ' + tot.totalHours + 'h · ' + todayBR();
    }
    // garante todos os painéis abertos na impressão
    $$('.aula-panel').forEach(p => p.classList.add('open'));
    document.body.classList.add('print-course-only');
    window.print();
    setTimeout(() => document.body.classList.remove('print-course-only'), 500);
}

// ============================================================
// UPLOAD / FLUXO PRINCIPAL
// ============================================================
function revealApp(fileName, opts) {
    opts = opts || {};
    if (opts.partId) selectPart(opts.partId, { silent: true });

    app.revealed = true;
    app.confirmed = false;
    app.fileName = fileName;
    app.doneIds.clear();

    $('#fileChipText').textContent = fileName;
    $('#fileChip').classList.add('show');
    $('#detectSection').classList.add('show');

    $('#planSection').classList.remove('show');
    $('#drawingSheetSection').classList.remove('show');
    $('#codeSection').classList.remove('show');
    $('#softHead').style.display = 'none';
    $('#softGrid').style.display = 'none';

    resetScene();
    refreshSheet();

    if (!opts.silent) {
        setTimeout(() => scrollToSection('detectSection'), 150);
        showToast('📄 Arquivo "' + fileName + '" carregado — features detectadas');
    }
    saveSession();
}

function confirmFeatures(opts) {
    opts = opts || {};
    const part = currentPart();
    const fState = getFeatureState();
    app.steps = part.buildSteps(fState);
    app.doneIds.clear();
    app.confirmed = true;

    refreshSheet();
    renderCode();

    $('#drawingSheetSection').classList.add('show');
    $('#softHead').style.display = 'block';
    $('#softGrid').style.display = 'grid';
    $('#planSection').classList.add('show');
    $('#codeSection').classList.add('show');

    renderSteps();

    if (!opts.silent) {
        setTimeout(() => scrollToSection('softHead'), 150);
        showToast('✅ Roteiro, folha e código CNC gerados com sucesso!');
    }
    saveSession();
}

// ============================================================
// SOFTWARE (Passo 2)
// ============================================================
function applySoft(soft, opts) {
    opts = opts || {};
    if (!SOFT_NAMES[soft]) soft = 'solidworks';
    app.soft = soft;
    $$('.soft-card').forEach(card => {
        const active = card.dataset.soft === soft;
        card.classList.toggle('active', active);
        card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updateCommands();
    if (!opts.silent) {
        showToast('Software alterado para ' + SOFT_NAMES[soft]);
        saveSession();
    }
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
function exportTxt() {
    if (!app.steps.length) {
        showToast('⚠️ Nenhum roteiro gerado ainda.');
        return;
    }

    const part = currentPart();
    const fState = getFeatureState();
    const d = part.dimsFromState(fState);
    const lines = [
        'COTA — Roteiro de Modelagem + Programação CNC',
        '=============================================',
        'Peça: ' + part.tag + ' · REV.' + part.rev,
        'Processo: ' + part.process,
        'Máquina: ' + part.machine,
        'Arquivo: ' + (app.fileName || '—'),
        'Software CAD: ' + SOFT_NAMES[app.soft],
        'Data: ' + todayBR(),
        'Material: ' + MATERIAL.name,
        'Massa estimada: ' + part.computeMass(d, fState).toFixed(2).replace('.', ',') + ' kg',
        '',
        'ESPECIFICAÇÕES:'
    ];
    part.techRows(d, fState).forEach(r => lines.push('  ' + r.label + ': ' + r.value));
    lines.push('', 'ETAPAS (' + app.doneIds.size + '/' + app.steps.length + ' concluídas):', '');
    app.steps.forEach((s, i) => {
        const cmdKey = part.stepCmd[s.id];
        lines.push((i + 1) + '. ' + s.title + (app.doneIds.has(s.id) ? ' [concluída]' : ''));
        lines.push('   ' + s.desc);
        lines.push('   Comando: ' + (cmdKey ? cmdFor(app.soft, cmdKey) : '—'));
        if (s.tip) lines.push('   💡 ' + s.tip);
        lines.push('');
    });
    lines.push('', '---------------------------------------------', 'CÓDIGO ISO (G-code)', '---------------------------------------------');
    lines.push(part.gcode(d, fState));
    lines.push('', '---------------------------------------------', 'PROGRAMA PARAMÉTRICO', '---------------------------------------------');
    lines.push(part.macro(d, fState));

    downloadText('roteiro-cota-' + part.id + '.txt', lines.join('\n'));
    showToast('💾 Roteiro + código exportados como TXT');
}

function printPlan() {
    if (!app.steps.length) {
        showToast('⚠️ Nenhum roteiro gerado ainda.');
        return;
    }
    const part = currentPart();
    const fState = getFeatureState();
    const d = part.dimsFromState(fState);
    const meta = $('#printMeta');
    if (meta) {
        meta.textContent = part.tag + ' · REV.' + part.rev + ' · ' + part.process +
            ' · ' + SOFT_NAMES[app.soft] + ' · ' + todayBR();
    }
    const pIso = $('#printCodeIso');
    if (pIso) pIso.textContent = part.gcode(d, fState);
    const pMacro = $('#printCodeMacro');
    if (pMacro) pMacro.textContent = part.macro(d, fState);
    window.print();
}

// ============================================================
// CENA 3D — ÓRBITA (mouse + toque) — cena CSS do suporte em L
// ============================================================
function setupOrbit() {
    $$('.iso-scene, .iso-scene-sheet').forEach(scene => {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let rotX = 55;
        let rotZ = -40;

        const apply = () => {
            scene.style.setProperty('--rx', rotX + 'deg');
            scene.style.setProperty('--rz', rotZ + 'deg');
        };

        scene.addEventListener('pointerdown', e => {
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            scene.style.cursor = 'grabbing';
            if (scene.setPointerCapture) scene.setPointerCapture(e.pointerId);
        });

        scene.addEventListener('pointermove', e => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            rotZ += dx * 0.3;
            rotX = Math.min(Math.max(rotX + dy * 0.3, 20), 80);
            startX = e.clientX;
            startY = e.clientY;
            apply();
        });

        const stop = () => {
            if (!dragging) return;
            dragging = false;
            scene.style.cursor = 'grab';
        };
        scene.addEventListener('pointerup', stop);
        scene.addEventListener('pointercancel', stop);
    });
}

// ============================================================
// NAVEGAÇÃO, TECLADO E EVENTOS GERAIS
// ============================================================
function setupGeneralEvents() {
    $('#logoHome').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    $$('[data-scroll-to]').forEach(btn => {
        btn.addEventListener('click', () => scrollToSection(btn.dataset.scrollTo));
    });
    $$('[data-action="demo"]').forEach(btn => {
        btn.addEventListener('click', () => revealApp(PARTS[DEFAULT_PART_ID].exampleFile, { partId: DEFAULT_PART_ID }));
    });

    $('#themeToggle').addEventListener('click', () => {
        setTheme(app.theme === 'dark' ? 'light' : 'dark');
    });

    // Galeria de exemplos
    const grid = $('#exampleGrid');
    if (grid) {
        grid.addEventListener('click', e => {
            const card = e.target.closest('.example-card');
            if (!card) return;
            const part = PARTS[card.dataset.part];
            if (!part) return;
            selectPart(card.dataset.part);
            revealApp(part.exampleFile);
        });
    }
    // Filtros por processo
    const chips = $('#filterChips');
    if (chips) {
        chips.addEventListener('click', e => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            app.filter = chip.dataset.filter;
            renderGallery();
        });
    }

    // Trilha de formação: expandir painéis, marcar aulas, abrir exemplos
    const courseModules = $('#courseModules');
    if (courseModules) {
        courseModules.addEventListener('click', e => {
            const toggle = e.target.closest('.aula-toggle');
            if (toggle) {
                const panel = toggle.closest('.aula').querySelector('.aula-panel');
                const open = panel.classList.toggle('open');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                return;
            }
            const openBtn = e.target.closest('.aula-open');
            if (openBtn) {
                const part = PARTS[openBtn.dataset.part];
                if (!part) return;
                selectPart(part.id);
                revealApp(part.exampleFile);
            }
        });
        courseModules.addEventListener('change', e => {
            const chk = e.target.closest('.aula-check');
            if (!chk) return;
            const id = chk.dataset.aula;
            if (chk.checked) {
                app.doneAulas.add(id);
            } else {
                app.doneAulas.delete(id);
            }
            const aulaEl = document.getElementById('aula-' + id);
            if (aulaEl) aulaEl.classList.toggle('done', chk.checked);
            updateCourseProgress();
            saveSession();
        });
    }
    const toggleAllBtn = $('#btnToggleAllAulas');
    if (toggleAllBtn) toggleAllBtn.addEventListener('click', toggleAllAulas);
    const printCourseBtn = $('#btnPrintCourse');
    if (printCourseBtn) printCourseBtn.addEventListener('click', printCourse);

    // Upload
    $('#btnDemo').addEventListener('click', () => revealApp(PARTS[DEFAULT_PART_ID].exampleFile, { partId: DEFAULT_PART_ID }));
    $('#btnBrowse').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', e => {
        if (e.target.files[0]) revealApp(e.target.files[0].name);
        e.target.value = '';
    });

    // Drag and drop
    const dz = $('#dropzone');
    ['dragenter', 'dragover'].forEach(evt => {
        dz.addEventListener(evt, e => {
            e.preventDefault();
            dz.classList.add('drag');
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dz.addEventListener(evt, e => {
            e.preventDefault();
            dz.classList.remove('drag');
        });
    });
    dz.addEventListener('drop', e => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) revealApp(e.dataTransfer.files[0].name);
    });

    // Software
    $$('.soft-card').forEach(card => {
        card.addEventListener('click', () => applySoft(card.dataset.soft));
    });

    // Confirmar features
    $('#btnConfirmFeatures').addEventListener('click', () => confirmFeatures());

    // Steps toggle (delegação)
    $('#stepsList').addEventListener('click', e => {
        const btn = e.target.closest('.step-toggle');
        if (!btn) return;
        const id = btn.dataset.id;
        setStepDone(id, !app.doneIds.has(id));
    });

    // Código CNC: abas + copiar + baixar
    $$('.code-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            app.codeTab = tab.dataset.code;
            renderCode();
            saveSession();
        });
    });
    $('#btnCopyCode').addEventListener('click', copyCode);
    $('#btnDownloadCode').addEventListener('click', downloadCode);

    // Reset / exportar / imprimir
    $('#btnResetPlan').addEventListener('click', resetPlan);
    $('#btnExportTxt').addEventListener('click', exportTxt);
    $('#btnPrint').addEventListener('click', printPlan);

    // Atalhos de teclado
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
        if (document.activeElement && document.activeElement.isContentEditable) return;
        if ($('#detectSection').classList.contains('show') && !app.confirmed) {
            $('#btnConfirmFeatures').click();
        }
    });
}

// ============================================================
// SPLASH
// ============================================================
function setupSplash() {
    const splash = $('#splash');
    const firstOfSession = !sessionStorage.getItem('cota-splashed');
    sessionStorage.setItem('cota-splashed', '1');
    setTimeout(() => {
        splash.classList.add('hide');
        setTimeout(() => { splash.style.display = 'none'; }, 900);
    }, firstOfSession ? 1600 : 250);
}

// ============================================================
// AUTO-INIT — pulso no botão de exemplo
// ============================================================
function setupDemoPulse() {
    setTimeout(() => {
        if (!$('#detectSection').classList.contains('show')) {
            const demoBtn = $('#btnDemo');
            demoBtn.style.animation = 'pulse-dot 1.8s ease-in-out 3';
            setTimeout(() => { demoBtn.style.animation = ''; }, 5500);
        }
    }, 2000);
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
function init() {
    renderGallery();

    // Restaura sessão anterior (peça, features, software, progresso, aulas)
    const saved = loadSession();
    if (saved && saved.doneAulas) app.doneAulas = new Set(saved.doneAulas);
    if (saved && saved.partId && PARTS[saved.partId]) {
        selectPart(saved.partId, { silent: true });
        applyFeatureState(saved.features);
        applySoft(saved.soft || 'solidworks', { silent: true });
        if (saved.codeTab) app.codeTab = saved.codeTab;
    } else {
        selectPart(DEFAULT_PART_ID, { silent: true });
        if (saved) applySoft(saved.soft || 'solidworks', { silent: true });
    }

    setTheme(localStorage.getItem(STORAGE_THEME) || 'dark');
    setupGeneralEvents();
    setupOrbit();
    setupSplash();
    renderCourse();
    refreshSheet();

    if (saved && saved.revealed) {
        revealApp(saved.fileName || currentPart().exampleFile, { silent: true });
        if (saved.confirmed) {
            confirmFeatures({ silent: true });
            (saved.doneIds || []).forEach(id => setStepDone(id, true, { silent: true }));
            showToast('📂 Sessão restaurada — ' + currentPart().name + ' · ' + app.doneIds.size + '/' + app.steps.length + ' etapas');
        } else {
            showToast('📂 Sessão anterior restaurada — ' + currentPart().name);
        }
    } else {
        setupDemoPulse();
    }

    console.log('🚀 COTA v5.2 — CAD + CNC Assistant carregado!');
    console.log('⚙️ ' + Object.keys(PARTS).length + ' situações de usinagem com código ISO e paramétrico.');
    console.log('📚 Trilha de formação: ' + COURSE.modules.length + ' módulos · ' + courseTotals().totalAulas + ' aulas.');
    console.log('🎯 Escolha um exemplo na galeria para começar!');
}

document.addEventListener('DOMContentLoaded', init);
