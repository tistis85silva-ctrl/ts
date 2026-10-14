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
    invalidateSim();
    renderSimulator();
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
// FIGURAS TÉCNICAS (imagens explicativas do processo)
// ============================================================
// Paleta clara de prancha técnica — figuras imprimem como desenho em papel
function paperTheme() {
    return {
        bg: '#F7F4EE',
        stroke: '#5A5A6E',
        dimStroke: '#2D6B8F',
        dimText: '#2D6B8F',
        surfaceBase: '#D5CDC0',
        surfaceWall: '#C4B8A8',
        holeFill: '#B0A898',
        chamferStroke: '#D95A1A',
        labelColor: '#5A5A6E',
        hiddenStroke: '#8A8A9E'
    };
}

// Vista técnica principal da peça (com dimensões padrão) para ilustrar a aula
function partFigure(part) {
    try {
        const st = {};
        part.features.forEach(f => {
            st[f.id] = { included: true, params: {} };
            f.params.forEach(p => { st[f.id].params[p.key] = p.value; });
        });
        const d = part.dimsFromState(st);
        const views = part.views({ d: d, st: st, t: paperTheme() });
        return (views[0] && views[0].svg) || '';
    } catch (e) {
        return '';
    }
}

function processFlowHtml() {
    const steps = [
        ['📄', 'Desenho técnico'],
        ['🔍', 'Features paramétricas'],
        ['🧭', 'Roteiro CAD'],
        ['⚙️', 'Código ISO + Macro'],
        ['🏭', 'Usinagem CNC'],
        ['✅', 'Inspeção e certificado']
    ];
    return '<div class="process-flow" aria-label="Fluxo do processo de usinagem">' +
        steps.map((s, i) =>
            '<div class="pf-step"><span class="pf-n">' + (i + 1) + '</span>' +
            '<span class="pf-ic" aria-hidden="true">' + s[0] + '</span>' +
            '<span class="pf-tx">' + s[1] + '</span></div>' +
            (i < steps.length - 1 ? '<span class="pf-arrow" aria-hidden="true">→</span>' : '')
        ).join('') +
        '</div>';
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
    let figN = 0;
    if (meta) {
        meta.innerHTML =
            '<span class="course-chip">🎓 ' + COURSE.modules.length + ' módulos</span>' +
            '<span class="course-chip">📖 ' + tot.totalAulas + ' aulas</span>' +
            '<span class="course-chip">⏱ ' + tot.totalHours + 'h de carga horária</span>' +
            '<span class="course-chip">📈 Iniciante → Avançado</span>' +
            '<span class="course-chip">📋 ' + COURSE.certification + '</span>';
    }

    modules.innerHTML = processFlowHtml() + COURSE.modules.map(m => {
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
                (part ? (function () {
                    figN++;
                    const svg = partFigure(part);
                    return (svg ? '<figure class="aula-figure">' +
                        '<div class="af-svg">' + svg + '</div>' +
                        '<figcaption class="af-cap">Fig. ' + figN + ' — ' + part.name +
                        ': vista técnica principal usada na aula (extraída do exemplo no app)</figcaption>' +
                        '</figure>' : '') +
                        '<div class="aula-practice">🧪 <b>Prática no app:</b> use o exemplo <b>' + part.name + '</b> — features paramétricas, folha técnica, código ISO e macro. ' +
                        '<button type="button" class="btn btn-sm aula-open" data-part="' + part.id + '">Abrir exemplo →</button></div>';
                })() : '') +
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
// KIT DE FICHAS DE AVALIAÇÃO
// ============================================================
function fillLine(cls) {
    return '<i class="fill-line ' + (cls || '') + '"></i>';
}
function answerLines(n) {
    let s = '<div class="answer-lines">';
    for (let i = 0; i < n; i++) s += '<i class="fill-line"></i>';
    return s + '</div>';
}
function optsHtml(opts) {
    return '<div class="q-opts">' + opts.map((o, i) =>
        '<span class="q-opt">□ ' + String.fromCharCode(65 + i) + ') ' + o + '</span>').join('') + '</div>';
}
function fichaHead(doc, title, sub) {
    return '<header class="ficha-head">' +
        '<div class="ficha-brand">COTA · Formação CNC</div>' +
        '<div class="ficha-title-block"><h3>' + title + '</h3><p>' + sub + '</p></div>' +
        '<div class="ficha-doc">Doc. ' + doc + ' · Rev. 01</div>' +
        '</header>' +
        '<div class="ficha-id-row">' +
        '<span class="fi">Participante: ' + fillLine('xl') + '</span>' +
        '<span class="fi">Turma: ' + fillLine('s') + '</span>' +
        '<span class="fi">Data: ' + fillLine('s') + '</span>' +
        '</div>';
}
function fichaSigns(labels) {
    return '<div class="ficha-signs">' + labels.map(l =>
        '<div class="ficha-sign"><span class="sign-label">' + l + '</span>' + fillLine('sign') + '</div>'
    ).join('') + '</div>';
}
function questionsHtml(list, startNum) {
    let n = startNum || 1;
    return '<ol class="ficha-questions">' + list.map(q => {
        let html = '<li><p class="q-text">' + q.q + ' <span class="q-pts">(' + q.pts.toFixed(1).replace('.', ',') + ' pt)</span></p>';
        if (q.type === 'multi') {
            html += optsHtml(q.opts);
        } else {
            html += answerLines(3);
        }
        n++;
        return html + '</li>';
    }).join('') + '</ol>';
}

function buildFichaIdentificacao() {
    const tot = courseTotals();
    const planRows = COURSE.modules.map(m => {
        const hours = m.aulas.reduce((s, a) => s + a.hours, 0);
        return '<tr><td>M' + m.number + '</td><td>' + m.title + '</td><td>' + hours + 'h</td>' +
            '<td class="fill-cell"></td><td class="fill-cell"></td>' +
            '<td class="fill-cell center">□ A&nbsp;&nbsp;□ R</td></tr>';
    }).join('');
    return '<div class="ficha" data-ficha="identificacao">' +
        fichaHead('FIC-00', 'Ficha de Identificação e Plano do Participante', COURSE.title + ' · ' + tot.totalHours + 'h') +
        '<div class="ficha-fields">' +
        '<span class="fi">Nome completo: ' + fillLine('xl') + '</span>' +
        '<span class="fi">RG/CPF: ' + fillLine('m') + '</span>' +
        '<span class="fi">Cargo/função: ' + fillLine('m') + '</span>' +
        '<span class="fi">Setor: ' + fillLine('m') + '</span>' +
        '<span class="fi">Admissão: ' + fillLine('s') + '</span>' +
        '<span class="fi">Instrutor(a): ' + fillLine('m') + '</span>' +
        '<span class="fi">Período do curso: ' + fillLine('m') + '</span>' +
        '<span class="fi">Local: ' + fillLine('m') + '</span>' +
        '</div>' +
        '<h4 class="ficha-h">Plano de formação e controle de aprovação</h4>' +
        '<table class="ficha-table"><thead><tr><th>Mód.</th><th>Conteúdo</th><th>Carga</th><th>Data</th><th>Nota</th><th>Conceito</th></tr></thead>' +
        '<tbody>' + planRows + '</tbody></table>' +
        '<div class="ficha-result">' +
        '<span>Média final: ' + fillLine('s') + '</span>' +
        '<span>Prova final: ' + fillLine('s') + '</span>' +
        '<span class="big">Resultado: □ APROVADO&nbsp;&nbsp;&nbsp;□ REPROVADO</span>' +
        '</div>' +
        '<p class="ficha-note"><b>Critério de aprovação do curso:</b> média das avaliações de módulo ≥ 7,0, prova final ≥ 7,0 e todos os critérios práticos conformes.</p>' +
        fichaSigns(['Participante', 'Instrutor(a)', 'Responsável pelo treinamento']) +
        '</div>';
}

function buildFichaPresenca() {
    const rows = [];
    COURSE.modules.forEach(m => {
        m.aulas.forEach(a => {
            rows.push('<tr><td class="center">' + a.num + '</td><td>' + a.title + '</td>' +
                '<td class="center">' + a.hours + 'h</td><td class="fill-cell"></td><td class="fill-cell"></td></tr>');
        });
    });
    const tot = courseTotals();
    return '<div class="ficha" data-ficha="presenca">' +
        fichaHead('FIC-01', 'Lista de Presença', COURSE.title + ' · ' + tot.totalAulas + ' aulas · ' + tot.totalHours + 'h') +
        '<table class="ficha-table"><thead><tr><th>Nº</th><th>Aula</th><th>Carga</th><th>Data</th><th>Assinatura do participante</th></tr></thead>' +
        '<tbody>' + rows.join('') + '</tbody></table>' +
        '<div class="ficha-result"><span class="big">Carga horária total frequentada: ' + fillLine('s') + ' de ' + tot.totalHours + 'h</span></div>' +
        '<p class="ficha-note">Frequência mínima exigida para certificação: 75% da carga horária. Justificar faltas no campo abaixo.</p>' +
        '<div class="ficha-obs">Justificativas: ' + fillLine('xl') + '<br>' + fillLine('xl') + '</div>' +
        fichaSigns(['Participante', 'Instrutor(a)']) +
        '</div>';
}

function buildFichaModule(moduleId) {
    const m = COURSE.modules.find(mm => mm.id === moduleId);
    const quiz = QUIZ[moduleId] || [];
    const criteria = [];
    m.aulas.forEach(a => {
        a.checklist.forEach(c => criteria.push({ label: 'Aula ' + a.num + ' — ' + c }));
    });
    const critRows = criteria.map((c, i) =>
        '<tr><td class="center">' + (i + 1) + '</td><td>' + c.label + '</td>' +
        '<td class="center fill-cell"></td><td class="center fill-cell"></td><td class="fill-cell"></td></tr>'
    ).join('');
    const hours = m.aulas.reduce((s, a) => s + a.hours, 0);
    return '<div class="ficha" data-ficha="' + m.id + '">' +
        fichaHead('FIC-' + m.id.toUpperCase().replace('M', 'M'), 'Avaliação — Módulo M' + m.number, m.title + ' · ' + hours + 'h · Nível: ' + m.level) +
        '<h4 class="ficha-h">Parte A — Avaliação teórica (10,0 pontos · aprovação ≥ 7,0)</h4>' +
        questionsHtml(quiz, 1) +
        '<h4 class="ficha-h">Parte B — Avaliação prática (todos os critérios devem estar conformes)</h4>' +
        '<table class="ficha-table"><thead><tr><th>Nº</th><th>Critério de execução</th><th>Conf.</th><th>Não conf.</th><th>Observação</th></tr></thead>' +
        '<tbody>' + critRows + '</tbody></table>' +
        '<div class="ficha-result">' +
        '<span>Nota teórica: ' + fillLine('s') + ' / 10,0</span>' +
        '<span>Prática: □ Conforme&nbsp;&nbsp;□ Não conforme</span>' +
        '<span class="big">Conceito: □ APROVADO&nbsp;&nbsp;□ REPROVADO</span>' +
        '</div>' +
        '<div class="ficha-obs">Observações do instrutor: ' + fillLine('xl') + '<br>' + fillLine('xl') + '</div>' +
        fichaSigns(['Participante', 'Instrutor(a)']) +
        '</div>';
}

function buildFichaProvaFinal() {
    return '<div class="ficha" data-ficha="prova-final">' +
        fichaHead('FIC-90', 'Prova Final Integradora', COURSE.title + ' · 10,0 pontos · aprovação ≥ 7,0') +
        '<h4 class="ficha-h">Parte A — Questões (10 × 1,0 = 10,0 pontos)</h4>' +
        questionsHtml(QUIZ.final, 1) +
        '<h4 class="ficha-h">Parte B — Atividade integradora (prática — avaliação do instrutor)</h4>' +
        '<p class="ficha-text">Peça surpresa: leitura do desenho, programação no app (ISO e/ou macro), simulação e apresentação do código ao instrutor. Critérios: interpretação correta, código sem erros, simulação aprovada e justificativa técnica.</p>' +
        '<div class="ficha-result">' +
        '<span>Nota da prova: ' + fillLine('s') + ' / 10,0</span>' +
        '<span>Integradora: □ Aprovado&nbsp;&nbsp;□ Não aprovado</span>' +
        '<span class="big">Conceito final: □ APROVADO&nbsp;&nbsp;□ REPROVADO</span>' +
        '</div>' +
        '<div class="ficha-obs">Observações: ' + fillLine('xl') + '</div>' +
        fichaSigns(['Participante', 'Instrutor(a)']) +
        '</div>';
}

function buildFichaEficacia() {
    const statements = [
        'O colaborador aplica os conhecimentos do treinamento no trabalho diário?',
        'Houve redução de erros, refugo ou retrabalhos após o treinamento?',
        'O colaborador interpreta desenhos técnicos com autonomia?',
        'O colaborador elabora e ajusta programas CNC com supervisão mínima?',
        'Os procedimentos de segurança (NR-12) estão sendo seguidos no posto?',
        'Houve necessidade de retreinamento ou apoio adicional?'
    ];
    const rows = statements.map((s, i) =>
        '<tr><td class="center">' + (i + 1) + '</td><td>' + s + '</td>' +
        '<td class="center fill-cell"></td><td class="center fill-cell"></td><td class="center fill-cell"></td></tr>'
    ).join('');
    return '<div class="ficha" data-ficha="eficacia">' +
        fichaHead('FIC-91', 'Avaliação de Eficácia do Treinamento', 'Aplicar em até 90 dias após a conclusão · NR-12 / gestão de pessoas') +
        '<div class="ficha-fields">' +
        '<span class="fi">Colaborador: ' + fillLine('xl') + '</span>' +
        '<span class="fi">Gestor responsável: ' + fillLine('m') + '</span>' +
        '<span class="fi">Data da avaliação: ' + fillLine('s') + '</span>' +
        '</div>' +
        '<table class="ficha-table"><thead><tr><th>Nº</th><th>Verificação</th><th>Sim</th><th>Parcial</th><th>Não</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
        '<div class="ficha-obs">Principais ganhos observados: ' + fillLine('xl') + '<br>' + fillLine('xl') + '</div>' +
        '<div class="ficha-obs">Sugestões / necessidade de retreinamento: ' + fillLine('xl') + '<br>' + fillLine('xl') + '</div>' +
        fichaSigns(['Colaborador', 'Gestor imediato', 'Instrutor(a)', 'RH / SST']) +
        '</div>';
}

function buildFichaGabarito() {
    let body = '';
    ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'].forEach(mid => {
        const m = COURSE.modules.find(mm => mm.id === mid);
        body += '<h4 class="ficha-h">M' + m.number + ' — ' + m.title + '</h4>' +
            '<table class="ficha-table"><thead><tr><th>Q</th><th>Tipo</th><th>Resposta</th></tr></thead><tbody>' +
            (QUIZ[mid] || []).map((q, i) =>
                '<tr><td class="center">' + (i + 1) + '</td><td>' + (q.type === 'multi' ? 'Objetiva' : 'Discursiva') + '</td>' +
                '<td class="gabarito-a">' + (q.type === 'multi' ? 'Letra ' + q.a : q.a) + '</td></tr>'
            ).join('') + '</tbody></table>';
    });
    body += '<h4 class="ficha-h">Prova final integradora</h4>' +
        '<table class="ficha-table"><thead><tr><th>Q</th><th>Tipo</th><th>Resposta</th></tr></thead><tbody>' +
        QUIZ.final.map((q, i) =>
            '<tr><td class="center">' + (i + 1) + '</td><td>' + (q.type === 'multi' ? 'Objetiva' : 'Discursiva') + '</td>' +
            '<td class="gabarito-a">' + (q.type === 'multi' ? 'Letra ' + q.a : q.a) + '</td></tr>'
        ).join('') + '</tbody></table>';
    return '<div class="ficha" data-ficha="gabarito">' +
        fichaHead('FIC-99', 'Gabarito do Instrutor', 'Uso interno — não distribuir aos participantes') +
        body +
        '<p class="ficha-note"><b>Correção:</b> questões objetivas = 2,0 pts (módulo) / 1,0 pt (prova final) quando corretas. Discursivas avaliar completude técnica conforme resposta-modelo. Nota mínima de aprovação: 7,0.</p>' +
        fichaSigns(['Instrutor(a)', 'Responsável pelo treinamento']) +
        '</div>';
}

function renderFicha(id) {
    switch (id) {
        case 'identificacao': return buildFichaIdentificacao();
        case 'presenca': return buildFichaPresenca();
        case 'prova-final': return buildFichaProvaFinal();
        case 'eficacia': return buildFichaEficacia();
        case 'gabarito': return buildFichaGabarito();
        case 'setup': return buildFichaSetup();
        default:
            if (/^m\d$/.test(id)) return buildFichaModule(id);
            return '';
    }
}

function renderFichaGrid() {
    const grid = $('#fichaGrid');
    if (!grid || typeof FICHAS === 'undefined') return;
    grid.innerHTML = FICHAS.map(f =>
        '<div class="ficha-card">' +
        '<div class="ficha-card-icon">' + f.icon + '</div>' +
        '<p class="ficha-card-doc">' + f.doc + '</p>' +
        '<p class="ficha-card-title">' + f.title + '</p>' +
        '<p class="ficha-card-desc">' + f.desc + '</p>' +
        '<div class="ficha-card-actions">' +
        '<button type="button" class="btn btn-sm ficha-view" data-ficha="' + f.id + '">👁 Visualizar</button>' +
        '<button type="button" class="btn btn-sm btn-accent ficha-print" data-ficha="' + f.id + '">🖨️ Imprimir</button>' +
        '</div>' +
        '</div>'
    ).join('');
}

function showFichaPreview(id) {
    const meta = FICHAS.find(f => f.id === id);
    const paper = $('#fichaPaper');
    const wrap = $('#fichaPreviewWrap');
    if (!paper || !wrap) return;
    paper.innerHTML = renderFicha(id);
    paper.dataset.current = id;
    $('#fichaPreviewTitle').textContent = (meta ? meta.doc + ' — ' + meta.title : 'Ficha');
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeFichaPreview() {
    const wrap = $('#fichaPreviewWrap');
    if (wrap) wrap.style.display = 'none';
}

function printSingleFicha() {
    const paper = $('#fichaPaper');
    if (!paper || !paper.dataset.current) {
        showToast('⚠️ Visualize uma ficha antes de imprimir.');
        return;
    }
    $('#printFichaMeta').textContent = (FICHAS.find(f => f.id === paper.dataset.current) || {}).doc + ' · ' + todayBR();
    document.body.classList.add('print-ficha');
    window.print();
    setTimeout(() => document.body.classList.remove('print-ficha'), 500);
}

function printFichaById(id) {
    showFichaPreview(id);
    printSingleFicha();
}

function printFichaKit() {
    const kit = $('#fichaKitPrint');
    if (!kit) return;
    // fichas encadeadas: a quebra de página é feita pelo CSS (.ficha + .ficha),
    // sem elementos extras — evita páginas em branco entre as fichas
    kit.innerHTML = FICHAS.map(f => renderFicha(f.id)).join('');
    $('#printFichaMeta').textContent = 'Kit completo · ' + FICHAS.length + ' fichas · ' + todayBR();
    document.body.classList.add('print-ficha-kit');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('print-ficha-kit');
        kit.innerHTML = ''; // evita vazar para outras impressões
    }, 500);
}

// ============================================================
// CERTIFICADO DE CONCLUSÃO
// ============================================================
function certCornerSvg() {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M6,94 L6,22 Q6,6 22,6 L94,6" fill="none" stroke="url(#certGold)" stroke-width="3"/>' +
        '<path d="M16,94 L16,32 Q16,16 32,16 L94,16" fill="none" stroke="url(#certGold)" stroke-width="1.2"/>' +
        '<circle cx="22" cy="22" r="4.5" fill="none" stroke="url(#certGold)" stroke-width="1.5"/>' +
        '<circle cx="22" cy="22" r="1.6" fill="#B8860B"/>' +
        '</svg>';
}

function certSealSvg() {
    return '<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" class="cert-seal" aria-hidden="true">' +
        '<defs>' +
        '<path id="certSealArc" d="M110,110 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0"/>' +
        '<path id="certSealArc2" d="M110,110 m-82,0 a82,82 0 1,0 164,0 a82,82 0 1,0 -164,0"/>' +
        '<linearGradient id="certGold" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#D4AF37"/><stop offset="0.5" stop-color="#F5D778"/>' +
        '<stop offset="1" stop-color="#A67C00"/></linearGradient>' +
        '</defs>' +
        '<circle cx="110" cy="110" r="104" fill="none" stroke="url(#certGold)" stroke-width="7"/>' +
        '<circle cx="110" cy="110" r="92" fill="none" stroke="url(#certGold)" stroke-width="2"/>' +
        '<circle cx="110" cy="110" r="62" fill="none" stroke="url(#certGold)" stroke-width="1.5"/>' +
        '<text class="seal-ring"><textPath href="#certSealArc" startOffset="50%" text-anchor="middle">' +
        'COTA · FORMAÇÃO CNC · CURSO PROFISSIONALIZANTE</textPath></text>' +
        '<text class="seal-ring seal-ring-b"><textPath href="#certSealArc2" startOffset="50%" text-anchor="middle">' +
        'DO DESENHO À PEÇA PRONTA · 64 HORAS</textPath></text>' +
        '<text x="110" y="104" text-anchor="middle" class="seal-main">APROVADO</text>' +
        '<text x="110" y="128" text-anchor="middle" class="seal-sub" id="sealYear">' + new Date().getFullYear() + '</text>' +
        '<path d="M110,140 l3.2,6.5 7.2,1 -5.2,5.1 1.2,7.2 -6.4,-3.4 -6.4,3.4 1.2,-7.2 -5.2,-5.1 7.2,-1 z" fill="url(#certGold)"/>' +
        '</svg>';
}

function certData() {
    return {
        nome: ($('#certNome') && $('#certNome').value.trim()) || 'Nome do Participante',
        nota: ($('#certNota') && $('#certNota').value.trim()) || '—',
        periodo: ($('#certPeriodo') && $('#certPeriodo').value.trim()) || '—',
        data: ($('#certData') && $('#certData').value.trim()) || todayBR(),
        instrutor: ($('#certInstrutor') && $('#certInstrutor').value.trim()) || 'Instrutor(a)',
        responsavel: ($('#certResponsavel') && $('#certResponsavel').value.trim()) || 'Responsável pelo treinamento',
        local: ($('#certLocal') && $('#certLocal').value.trim()) || '—',
        registro: ($('#certRegistro') && $('#certRegistro').value.trim()) || '—'
    };
}

function renderCertificate() {
    const paper = $('#certPaper');
    if (!paper) return;
    const c = certData();
    const tot = courseTotals();
    paper.innerHTML =
        '<div class="cert-watermark" aria-hidden="true">COTA</div>' +
        '<span class="cert-corner tl">' + certCornerSvg() + '</span>' +
        '<span class="cert-corner tr">' + certCornerSvg() + '</span>' +
        '<span class="cert-corner bl">' + certCornerSvg() + '</span>' +
        '<span class="cert-corner br">' + certCornerSvg() + '</span>' +
        '<header class="cert-header">' +
        '<div class="cert-brand">COTA<span> · </span>FORMAÇÃO PROFISSIONAL EM MANUFATURA</div>' +
        '<div class="cert-reg">REGISTRO Nº <b>' + c.registro + '</b></div>' +
        '</header>' +
        '<h1 class="cert-title">CERTIFICADO</h1>' +
        '<h2 class="cert-subtitle">DE CONCLUSÃO</h2>' +
        '<p class="cert-lead">Certificamos que</p>' +
        '<p class="cert-name">' + c.nome + '</p>' +
        '<p class="cert-text">concluiu com aproveitamento o curso <b>' + COURSE.title + '</b>, ' +
        'com carga horária de <b>' + tot.totalHours + ' horas</b> (' + COURSE.modules.length + ' módulos · ' +
        tot.totalAulas + ' aulas), no período de <b>' + c.periodo + '</b>, ' +
        'tendo sido <b>APROVADO</b> nas avaliações teóricas e práticas da trilha de formação ' +
        'em programação e operação de CNC.</p>' +
        '<div class="cert-facts">' +
        '<div class="cf"><b>' + tot.totalHours + 'h</b><span>Carga horária</span></div>' +
        '<div class="cf"><b>' + COURSE.modules.length + '</b><span>Módulos</span></div>' +
        '<div class="cf"><b>' + tot.totalAulas + '</b><span>Aulas</span></div>' +
        '<div class="cf"><b>' + c.nota + '</b><span>Nota final</span></div>' +
        '<div class="cf cf-ok"><b>APROVADO</b><span>Conceito</span></div>' +
        '</div>' +
        '<div class="cert-bottom">' +
        '<div class="cert-signs">' +
        '<div class="cert-sign-block"><i class="cert-sign-line"></i><span class="cert-sign-name">' + c.instrutor + '</span><span class="cert-sign-role">Instrutor(a)</span></div>' +
        '<div class="cert-sign-block"><i class="cert-sign-line"></i><span class="cert-sign-name">' + c.responsavel + '</span><span class="cert-sign-role">Responsável pelo treinamento</span></div>' +
        '</div>' +
        '<div class="cert-seal-wrap">' + certSealSvg() + '</div>' +
        '</div>' +
        '<footer class="cert-footer">' +
        '<span>' + c.local + '</span>' +
        '<span>Emitido em ' + c.data + '</span>' +
        '<span>Doc. COTA-CERT · Rev. 01</span>' +
        '</footer>';
}

function initCertForm() {
    const reg = $('#certRegistro');
    if (reg && !reg.value) {
        const y = new Date().getFullYear();
        const seq = String(Math.floor(Math.random() * 9000) + 1000);
        reg.value = 'COTA-' + y + '-' + seq;
    }
    const data = $('#certData');
    if (data && !data.value) data.value = todayBR();

    const form = $('#certForm');
    if (form) {
        form.addEventListener('input', renderCertificate);
    }
    const resetBtn = $('#btnCertReset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            ['certNome', 'certPeriodo', 'certInstrutor', 'certResponsavel', 'certLocal'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const nota = $('#certNota');
            if (nota) nota.value = '8,5';
            const regEl = $('#certRegistro');
            if (regEl) {
                const y = new Date().getFullYear();
                regEl.value = 'COTA-' + y + '-' + String(Math.floor(Math.random() * 9000) + 1000);
            }
            const dataEl = $('#certData');
            if (dataEl) dataEl.value = todayBR();
            renderCertificate();
            showToast('↺ Campos do certificado limpos');
        });
    }
    const printBtn = $('#btnPrintCert');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            renderCertificate();
            document.body.classList.add('print-certificado');
            window.print();
            setTimeout(() => document.body.classList.remove('print-certificado'), 500);
        });
    }
    renderCertificate();
}

// ============================================================
// DETECÇÃO DO EXEMPLO A PARTIR DO ARQUIVO ENVIADO
// ============================================================
// Palavras-chave por exemplo (específicos primeiro vencem pelo peso)
const PART_NAME_KEYS = [
    { id: 'eixo-rosqueado', keys: ['eixo-rosqueado', 'eixo rosqueado', 'eixo roscado', 'rosqueado', 'parafuso'] },
    { id: 'bucha-rosca', keys: ['bucha', 'rosca interna', 'porca'] },
    { id: 'eixo-escalonado', keys: ['eixo-escalonado', 'eixo escalonado', 'escalonado', 'eixo'] },
    { id: 'placa-rasgo', keys: ['placa', 'rasgo', 'slot', 'ranhura'] },
    { id: 'gabarito-furacao', keys: ['gabarito', 'furacao'] },
    { id: 'caixa-cavidade', keys: ['caixa', 'cavidade', 'pocket'] },
    { id: 'flange', keys: ['flange'] },
    { id: 'polia-v', keys: ['polia'] },
    { id: 'cunha', keys: ['cunha', 'rampa'] },
    { id: 'suporte-l', keys: ['suporte', 'cantoneira', 'peca em l'] }
];

function normText(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w]+/g, ' ').trim();
}

// Escolhe o exemplo pelo nome do arquivo (peso = tamanho das chaves encontradas)
function matchPartByFileName(fileName) {
    const n = ' ' + normText(fileName) + ' ';
    let best = null, bestScore = 0;
    PART_NAME_KEYS.forEach(rec => {
        let score = 0;
        rec.keys.forEach(k => {
            const nk = normText(k);
            if (nk && n.indexOf(nk) >= 0) score += nk.length;
        });
        if (score > bestScore) {
            bestScore = score;
            best = rec.id;
        }
    });
    return best ? { partId: best, score: bestScore } : null;
}

// Lê um DXF ASCII e extrai entidades (CIRCLE, LINE, ARC, polilinhas)
function analyzeDxf(text) {
    const lines = String(text).split(/\r\n|\r|\n/);
    const circles = [];
    let current = null, x = null, y = null, r = null;
    let nLine = 0, nArc = 0, nPoly = 0;

    const flushCircle = () => {
        if (isFinite(x) && isFinite(y) && isFinite(r) && r > 0) circles.push({ x: x, y: y, r: r });
        x = y = r = null;
    };

    for (let i = 0; i + 1 < lines.length; i += 2) {
        const code = lines[i].trim();
        const val = lines[i + 1];
        if (code === '0') {
            if (current === 'CIRCLE') flushCircle();
            current = val.trim();
            if (current === 'LINE') nLine++;
            else if (current === 'ARC') nArc++;
            else if (current === 'LWPOLYLINE' || current === 'POLYLINE') nPoly++;
            x = y = r = null;
        } else if (current === 'CIRCLE') {
            const num = parseFloat(val);
            if (code === '10') x = num;
            else if (code === '20') y = num;
            else if (code === '40') r = num;
        }
    }
    if (current === 'CIRCLE') flushCircle();
    return { circles: circles, nLine: nLine, nArc: nArc, nPoly: nPoly };
}

// Reconhece peças pela geometria do DXF (ex.: flange = padrão polar de furos)
function detectPartFromGeometry(g) {
    const cs = g.circles.filter(c => isFinite(c.r) && c.r > 0);
    if (cs.length >= 4) {
        const big = cs.reduce((m, c) => (c.r > m.r ? c : m), cs[0]);
        // candidatos a furos: distantes do centro e menores que o disco externo
        const ring = cs.filter(c => {
            const dist = Math.hypot(c.x - big.x, c.y - big.y);
            return c.r < big.r * 0.75 && dist > big.r * 0.25 && dist < big.r * 1.15;
        });
        if (ring.length >= 3) {
            const dists = ring.map(c => Math.hypot(c.x - big.x, c.y - big.y));
            const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
            const spread = Math.max.apply(null, dists) - Math.min.apply(null, dists);
            // furos equidistantes do centro => padrão polar (círculo primitivo)
            if (spread < Math.max(mean * 0.3, 1.5)) {
                return 'flange';
            }
        }
    }
    return null;
}

// Combina nome + geometria e devolve o exemplo mais provável
function detectPart(fileName, text) {
    const byName = matchPartByFileName(fileName);
    if (byName) {
        return {
            partId: byName.partId,
            method: 'nome',
            note: 'Correspondência pelo nome do arquivo'
        };
    }
    if (text && String(text).indexOf('AutoCAD Binary') !== 0) {
        const g = analyzeDxf(text);
        const byGeo = detectPartFromGeometry(g);
        if (byGeo) {
            return {
                partId: byGeo,
                method: 'geometria',
                note: 'Análise geométrica do DXF: ' + g.circles.length + ' círculos com padrão polar detectado'
            };
        }
        if (g.circles.length + g.nLine + g.nArc + g.nPoly > 0) {
            return {
                partId: null,
                method: 'geometria',
                note: 'DXF lido (' + g.circles.length + ' círculos, ' + (g.nLine + g.nArc + g.nPoly) +
                    ' linhas/arcs) sem correspondência exata — usando o exemplo base'
            };
        }
    }
    return {
        partId: null,
        method: null,
        note: 'Sem correspondência com os 10 exemplos — usando o exemplo base'
    };
}

function handleUploadFile(file) {
    const name = file.name || 'arquivo';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'dxf' && typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onload = () => {
            const res = detectPart(name, String(reader.result || ''));
            revealApp(name, { partId: res.partId || undefined, detectNote: res.note });
        };
        reader.onerror = () => {
            const res = detectPart(name, '');
            revealApp(name, { partId: res.partId || undefined, detectNote: res.note });
        };
        reader.readAsText(file);
    } else {
        const res = detectPart(name, '');
        revealApp(name, { partId: res.partId || undefined, detectNote: res.note });
    }
}

// ============================================================
// SIMULADOR 3D DE REMOÇÃO DE MATERIAL — Passo 5 (v6.1 Smooth CSG)
// ============================================================

// Estado visual padrão da câmera e camadas do simulador
function ensureSimViewState() {
    if (!app.simCam) {
        app.simCam = { yaw: -0.68, pitch: 0.58, zoom: 1.0 };
    }
    if (app.simShowPath === undefined) app.simShowPath = true;
    if (app.simShowTool === undefined) app.simShowTool = true;
    if (app.simSectionCut === undefined) app.simSectionCut = false;
    if (!app.simSpeed) app.simSpeed = 1;
}

// Interpreta o código ISO completo: movimentos, ciclos modais (G81/G82/G83/G71/G70/G74/G76),
// ferramentas (diâmetro, nome, tipo), operações, rotação S, avanço F e tempo estimado
function parseToolpath(code) {
    const text = String(code);
    const toolDiam = {};
    const toolAltDiam = {};
    const toolName = {};
    let m;
    const reLineT = /\(T0?(\d+)\s*-\s*([^)]+)\)/g;
    while ((m = reLineT.exec(text)) !== null) {
        const tid = parseInt(m[1], 10);
        const desc = m[2].trim();
        toolName[tid] = desc.split('-')[0].trim();
        const dMatches = [];
        let dm;
        const reD = /[DØ](\d+\.?\d*)/g;
        while ((dm = reD.exec(desc)) !== null) dMatches.push(parseFloat(dm[1]));
        if (dMatches.length >= 1) toolDiam[tid] = dMatches[0];
        if (dMatches.length >= 2) toolAltDiam[tid] = dMatches[1];
        if (!toolDiam[tid]) {
            const cM = desc.match(/C(\d+\.?\d*)/);
            if (cM) toolDiam[tid] = Math.max(parseFloat(cM[1]) * 2.5, 4);
            const mmM = desc.match(/(\d+\.?\d*)MM/);
            if (mmM) toolDiam[tid] = parseFloat(mmM[1]);
        }
    }

    const segs = [];
    const ops = [];
    let currentOp = 'Posicionamento inicial';
    let x = 0, y = 0, z = 10;
    let motion = 'rapid';
    let gModal = 'G00';
    let canned = null; // null | 'G81' | 'G82' | 'G83'
    let cannedZ = -10, cannedR = 2;
    let tool = 1;
    let spindle = 1500, feed = 200, coolant = 'M09';
    let useAltDiam = false;
    let cumTime = 0; // segundos

    // mapa de blocos N para suportar G70 P..Q no torno
    const nBlocks = {};
    const rawLines = text.split('\n');
    rawLines.forEach((raw, idx) => {
        const nM = raw.match(/^\s*N(\d+)\s+(.*)$/);
        if (nM) nBlocks[parseInt(nM[1], 10)] = { raw: raw, idx: idx };
    });

    const pushSeg = (x1, y1, z1, x2, y2, z2, type, extra) => {
        if (x1 === x2 && y1 === y2 && z1 === z2 && !(extra && extra.fullCircle)) return;
        const dist = (extra && extra.arcLen) || Math.hypot(x2 - x1, y2 - y1, z2 - z1);
        const spd = type === 'rapid' ? 5000 : Math.max(feed > 5 ? feed : spindle * Math.max(feed, 0.12), 60);
        const dt = Math.max(dist / (spd / 60), 0.05);
        cumTime += dt;
        const dActive = (useAltDiam && toolAltDiam[tool]) ? toolAltDiam[tool] : (toolDiam[tool] || 10);
        const rTool = dActive / 2;
        segs.push(Object.assign({
            x1: x1, y1: y1, z1: z1, x2: x2, y2: y2, z2: z2,
            type: type, tool: tool, rTool: rTool,
            toolDesc: toolName[tool] || ('T0' + tool),
            gModal: gModal, spindle: spindle, feed: feed, coolant: coolant,
            opName: currentOp, time: cumTime, dt: dt
        }, extra || {}));
    };

    const processLine = (raw, idx, overrideOp) => {
        const opSection = raw.match(/\((?:===\s*)?([^)=]{4,}?)(?:\s*===)\)/);
        if (opSection) {
            currentOp = opSection[1].trim();
            ops.push({ name: currentOp, startIdx: segs.length });
        }
        if (/CONTRAFURO/i.test(raw) && toolAltDiam[tool]) {
            useAltDiam = true;
        }
        const line = String(raw).split('(')[0];
        if (!line.trim() || line.trim().indexOf('#') === 0 || line.trim() === '%') return;

        const gList = [];
        line.replace(/G(\d+)/g, (mm, gv) => { gList.push(parseInt(gv, 10)); return mm; });
        const mList = [];
        line.replace(/M(\d+)/g, (mm, mv) => { mList.push(parseInt(mv, 10)); return mm; });

        const words = {};
        line.replace(/([A-Z])\s*(-?\d+\.?\d*)/g, (mm, c, v) => {
            words[c] = parseFloat(v);
            return mm;
        });

        const tM = line.match(/T0?(\d)\d*/);
        if (tM) {
            const nt = parseInt(tM[1], 10);
            if (nt >= 1 && nt <= 9) {
                tool = nt;
                useAltDiam = false;
            }
        }
        if (words.S !== undefined) spindle = words.S;
        if (words.F !== undefined) feed = words.F;
        if (mList.indexOf(8) >= 0) coolant = 'M08';
        if (mList.indexOf(9) >= 0) coolant = 'M09';

        gList.forEach(g => {
            if (g === 80) { canned = null; motion = 'rapid'; gModal = 'G80'; }
            else if (g === 0) { canned = null; motion = 'rapid'; gModal = 'G00'; }
            else if (g === 1) { canned = null; motion = 'feed'; gModal = 'G01'; }
            else if (g === 2) { canned = null; motion = 'arc-cw'; gModal = 'G02'; }
            else if (g === 3) { canned = null; motion = 'arc-ccw'; gModal = 'G03'; }
            else if (g === 81 || g === 82 || g === 83) {
                canned = 'G' + g;
                gModal = canned;
                if (words.Z !== undefined) cannedZ = words.Z;
                if (words.R !== undefined) cannedR = words.R;
            } else if (g === 71 || g === 70 || g === 74 || g === 76) {
                gModal = 'G' + g;
            }
        });

        const hasXY = words.X !== undefined || words.Y !== undefined;
        const hasZ = words.Z !== undefined;
        const hasIJ = words.I !== undefined || words.J !== undefined;
        const nx = words.X !== undefined ? words.X : x;
        const ny = words.Y !== undefined ? words.Y : y;
        const nz = words.Z !== undefined ? words.Z : z;
        const baseExtra = {
            i: words.I, j: words.J,
            text: (overrideOp ? ('[' + overrideOp + '] ') : '') + String(raw).trim(),
            line: idx + 1
        };

        if (gList.indexOf(70) >= 0 && words.P !== undefined && words.Q !== undefined) {
            const pStart = Math.round(words.P), qEnd = Math.round(words.Q);
            Object.keys(nBlocks).map(Number).sort((a, b) => a - b).forEach(nNum => {
                if (nNum >= pStart && nNum <= qEnd) {
                    processLine(nBlocks[nNum].raw, nBlocks[nNum].idx, 'G70 Acabamento');
                }
            });
            return;
        }

        if (gList.indexOf(74) >= 0 && hasZ) {
            pushSeg(x, y, z, 0, 0, nz, 'feed', Object.assign({}, baseExtra, { opKind: 'AxialDrill' }));
            pushSeg(0, 0, nz, 0, 0, 2, 'rapid', Object.assign({}, baseExtra, { opKind: 'Retract' }));
            x = 0; y = 0; z = 2;
            return;
        }

        if (gList.indexOf(76) >= 0 && hasZ && words.X !== undefined) {
            const pitch = words.F || 1.5;
            const internal = words.X > x;
            pushSeg(words.X, 0, z, words.X, 0, nz, 'feed', Object.assign({}, baseExtra, {
                opKind: internal ? 'ThreadInt' : 'ThreadExt',
                pitch: pitch, threadDiam: words.X
            }));
            pushSeg(words.X, 0, nz, x, 0, 3, 'rapid', baseExtra);
            z = 3;
            return;
        }

        if (canned && (hasXY || hasZ)) {
            if (words.Z !== undefined) cannedZ = words.Z;
            if (words.R !== undefined) cannedR = words.R;
            pushSeg(x, y, z, nx, ny, cannedR, 'rapid', baseExtra);
            pushSeg(nx, ny, cannedR, nx, ny, cannedZ, 'feed', Object.assign({}, baseExtra, { opKind: 'Drill' }));
            pushSeg(nx, ny, cannedZ, nx, ny, cannedR, 'rapid', Object.assign({}, baseExtra, { opKind: 'Retract' }));
            x = nx; y = ny; z = cannedR;
            return;
        }

        if (motion.indexOf('arc') === 0 && (hasXY || hasZ || hasIJ)) {
            const rArc = Math.hypot(words.I || 0, words.J || 0);
            const fullCircle = Math.hypot(nx - x, ny - y) < 0.01 && rArc > 0.1;
            const arcLen = fullCircle ? (2 * Math.PI * rArc) : Math.max(Math.hypot(nx - x, ny - y, nz - z), rArc);
            pushSeg(x, y, z, nx, ny, nz, motion, Object.assign({}, baseExtra, {
                fullCircle: fullCircle, arcLen: arcLen
            }));
            x = nx; y = ny; z = nz;
            return;
        }

        if (hasXY || hasZ) {
            pushSeg(x, y, z, nx, ny, nz, motion, baseExtra);
            x = nx; y = ny; z = nz;
        }
    };

    rawLines.forEach((raw, idx) => processLine(raw, idx, null));
    return { segs: segs, ops: ops, toolDiam: toolDiam, toolName: toolName };
}

function sampleArc(seg) {
    const cx = seg.x1 + (seg.i || 0);
    const cy = seg.y1 + (seg.j || 0);
    const r = Math.hypot(seg.x1 - cx, seg.y1 - cy);
    const a0 = Math.atan2(seg.y1 - cy, seg.x1 - cx);
    const a1 = Math.atan2(seg.y2 - cy, seg.x2 - cx);
    let da = a1 - a0;
    if (seg.type === 'arc-cw') {
        while (da > -1e-6) da -= 2 * Math.PI;
    } else {
        while (da < 1e-6) da += 2 * Math.PI;
    }
    const pts = [];
    const steps = Math.max(24, Math.ceil(Math.abs(da) / (Math.PI / 32)));
    for (let k = 0; k <= steps; k++) {
        const a = a0 + da * k / steps;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
}

function sampleSeg(seg, step) {
    if (seg.type.indexOf('arc') === 0) {
        const arcPts = sampleArc(seg);
        const n = Math.max(arcPts.length - 1, 1);
        return arcPts.map((p, k) => ({
            x: p[0],
            y: p[1],
            z: seg.z1 + (seg.z2 - seg.z1) * (k / n)
        }));
    }
    const dist = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1, seg.z2 - seg.z1);
    const n = Math.max(1, Math.ceil(dist / Math.max(step, 0.25)));
    const pts = [];
    for (let k = 0; k <= n; k++) {
        const t = k / n;
        pts.push({
            x: seg.x1 + (seg.x2 - seg.x1) * t,
            y: seg.y1 + (seg.y2 - seg.y1) * t,
            z: seg.z1 + (seg.z2 - seg.z1) * t
        });
    }
    return pts;
}

// Constrói o modelo do material bruto + metadados CSG suaves para renderização CAD 3D
function buildSimModel() {
    const part = currentPart();
    const fState = getFeatureState();
    const d = getDims();
    let parsed = { segs: [], ops: [] };
    try {
        parsed = parseToolpath(part.gcode(d, fState));
    } catch (e) { parsed = { segs: [], ops: [] }; }
    const segs = parsed.segs;
    if (!segs.length) return null;

    const turning = !!part.isTurning;

    if (turning) {
        let zMin = -30, maxDiam = 40;
        segs.forEach(s => {
            if (s.type !== 'rapid') {
                zMin = Math.min(zMin, s.z1, s.z2);
                maxDiam = Math.max(maxDiam, s.x1, s.x2);
            }
        });
        if (d.D) maxDiam = Math.max(maxDiam, d.D);
        if (d.d1) maxDiam = Math.max(maxDiam, d.d1, d.d2 || 0, d.d3 || 0);
        if (d.dCab) maxDiam = Math.max(maxDiam, d.dCab, d.dCorpo || 0);

        const partLen = Math.max(Math.abs(zMin), d.L || d.e || ((d.c1 || 0) + (d.c2 || 0) + (d.c3 || 0)) || ((d.cCab || 0) + (d.cCorpo || 0)) || 60);
        zMin = -partLen;
        const rStock = Math.round(maxDiam / 2 + 2.5);
        const cols = 160;
        const rows = 44;
        const cell = partLen / cols;
        const H = new Float32Array(cols * rows);
        const mach = new Uint8Array(cols * rows);
        const R_ext = new Float32Array(cols);
        const R_int = new Float32Array(cols);
        const machExt = new Uint8Array(cols);
        const machInt = new Uint8Array(cols);
        const threadPitch = new Float32Array(cols);

        for (let i = 0; i < cols; i++) R_ext[i] = rStock;
        for (let i = 0; i < cols * rows; i++) H[i] = rStock;

        return {
            kind: 'turning', partId: part.id, dims: d, fState: fState,
            cols: cols, rows: rows, cell: cell,
            u0: zMin, v0: -rStock,
            partLen: partLen, stockTop: rStock, zMin: zMin,
            H: H, machined: mach,
            R_ext: R_ext, R_int: R_int, machExt: machExt, machInt: machInt, threadPitch: threadPitch,
            segs: segs, ops: parsed.ops, applied: 0
        };
    }

    let partX0 = -70, partX1 = 70, partY0 = -50, partY1 = 50, partThick = 20;
    if (part.id === 'cunha') {
        partX0 = 0; partX1 = d.comp || 120;
        partY0 = 0; partY1 = d.larg || 80;
        partThick = d.hMax || 40;
    } else if (part.id === 'flange') {
        const R = (d.diametro || 120) / 2;
        partX0 = -R; partX1 = R; partY0 = -R; partY1 = R;
        partThick = d.espessura || 18;
    } else {
        const W = d.largura || d.larg || 140;
        const Dp = d.comprimento || d.profundidade || d.comp || 100;
        partX0 = -W / 2; partX1 = W / 2;
        partY0 = -Dp / 2; partY1 = Dp / 2;
        partThick = d.espessura || d.altura || d.esp || 20;
    }

    const stockMargin = 4.0;
    const u0 = partX0 - stockMargin, u1 = partX1 + stockMargin;
    const v0 = partY0 - stockMargin, v1 = partY1 + stockMargin;
    const spanU = u1 - u0, spanV = v1 - v0;
    const cell = Math.max(Math.max(spanU, spanV) / 96, 0.85);
    const cols = Math.max(28, Math.ceil(spanU / cell));
    const rows = Math.max(28, Math.ceil(spanV / cell));
    const stockTop = 1.5;
    const zBottom = -partThick;

    const H = new Float32Array(cols * rows);
    const initH = new Float32Array(cols * rows);
    const mach = new Uint8Array(cols * rows);

    const hasWall = part.id === 'suporte-l' && fState.wall && fState.wall.included;
    const wallEp = hasWall ? (d.espessuraParede || 18) : 0;
    const wallTop = hasWall ? Math.min(d.altura || 60, partThick * 2.0) : stockTop;

    for (let j = 0; j < rows; j++) {
        const wy = v0 + (j + 0.5) * cell;
        for (let i = 0; i < cols; i++) {
            const wx = u0 + (i + 0.5) * cell;
            let h0 = stockTop;
            if (hasWall && wy >= partY1 - wallEp && wy <= partY1 && wx >= partX0 && wx <= partX1) {
                h0 = wallTop;
            }
            const idx = j * cols + i;
            H[idx] = h0;
            initH[idx] = h0;
        }
    }

    return {
        kind: 'milling', partId: part.id, dims: d, fState: fState,
        cols: cols, rows: rows, cell: cell,
        u0: u0, v0: v0,
        partX0: partX0, partX1: partX1, partY0: partY0, partY1: partY1,
        stockTop: stockTop, zBottom: zBottom, zMin: zBottom,
        hasWall: hasWall, wallEp: wallEp, wallTop: wallTop, wallHoleR: 0,
        H: H, initH: initH, machined: mach,
        segs: segs, ops: parsed.ops, applied: 0
    };
}

function resetSimModel(model) {
    if (!model) return;
    if (model.kind === 'turning') {
        model.R_ext.fill(model.stockTop);
        model.R_int.fill(0);
        model.machExt.fill(0);
        model.machInt.fill(0);
        model.threadPitch.fill(0);
        model.H.fill(model.stockTop);
        model.machined.fill(0);
    } else {
        model.H.set(model.initH);
        model.machined.fill(0);
        model.wallHoleR = 0;
    }
    model.applied = 0;
}

// Aplica a remoção de material dos segmentos [de..ate[
function applyRemoval(model, de, ate) {
    if (!model) return;
    const { cols, rows, cell, H, machined, kind } = model;

    for (let s = de; s < ate; s++) {
        const seg = model.segs[s];
        if (!seg || seg.type === 'rapid') continue;

        if (kind === 'turning') {
            const zA = Math.min(seg.z1, seg.z2), zB = Math.max(seg.z1, seg.z2);
            const iA = Math.max(0, Math.floor((zA - model.u0) / cell));
            const iB = Math.min(cols - 1, Math.ceil((zB - model.u0) / cell));

            if (seg.opKind === 'AxialDrill') {
                const rDrill = Math.max(seg.rTool || 8, 2);
                for (let i = iA; i <= iB; i++) {
                    if (model.R_int[i] < rDrill) {
                        model.R_int[i] = rDrill;
                        model.machInt[i] = 1;
                    }
                }
            } else if (seg.opKind === 'ThreadInt') {
                const rThread = Math.max((seg.threadDiam || 20) / 2, 2);
                for (let i = iA; i <= iB; i++) {
                    model.R_int[i] = Math.max(model.R_int[i], rThread - 0.5);
                    model.machInt[i] = 3;
                    model.threadPitch[i] = seg.pitch || 1.5;
                }
            } else if (seg.opKind === 'ThreadExt') {
                const rThread = Math.max((seg.threadDiam || 18.4) / 2, 2);
                for (let i = iA; i <= iB; i++) {
                    model.R_ext[i] = Math.min(model.R_ext[i], rThread + 0.4);
                    model.machExt[i] = 3;
                    model.threadPitch[i] = seg.pitch || 1.5;
                }
            } else if (/MANDRIL/i.test(seg.opName) || /MANDRIL/i.test(seg.text)) {
                const rBore = Math.max(Math.max(seg.x1, seg.x2) / 2, 2);
                for (let i = iA; i <= iB; i++) {
                    if (model.R_int[i] < rBore) {
                        model.R_int[i] = rBore;
                        model.machInt[i] = 2;
                    }
                }
            } else {
                const dz = seg.z2 - seg.z1;
                const isGroove = /RASGO|RANHUR|CORTE RADIAL/i.test(seg.opName + ' ' + seg.text);
                const wIdx = isGroove ? Math.max(1, Math.round(1.6 / cell)) : 0;
                for (let i = Math.max(0, iA - wIdx); i <= Math.min(cols - 1, iB + wIdx); i++) {
                    const zSlice = model.u0 + (i + 0.5) * cell;
                    const t = Math.abs(dz) > 0.05 ? Math.min(Math.max((zSlice - seg.z1) / dz, 0), 1) : 1;
                    const dAt = seg.x1 + (seg.x2 - seg.x1) * t;
                    const rCut = Math.max(dAt / 2, 0.5);
                    if (rCut < model.R_ext[i] + 0.05) {
                        model.R_ext[i] = Math.min(model.R_ext[i], rCut);
                        model.machExt[i] = (isGroove || Math.abs(seg.x2 - seg.x1) > 0.2) ? 2 : 1;
                    }
                }
            }
            for (let i = 0; i < cols; i++) {
                const rE = model.R_ext[i];
                const mFlag = (model.machExt[i] || model.machInt[i]) ? 1 : 0;
                for (let j = 0; j < rows; j++) {
                    const idx = j * cols + i;
                    H[idx] = rE;
                    if (mFlag) machined[idx] = 1;
                }
            }
            continue;
        }

        // FRESAMENTO
        if (model.hasWall && /FURO PAREDE/i.test(seg.opName)) {
            model.wallHoleR = Math.max(seg.rTool || 10, 4);
            continue;
        }

        const isFace = /FACEAMENTO/i.test(seg.opName) || seg.tool === 1;
        const isChamfer = /CHANFRO/i.test(seg.opName) || /CHANFRO/i.test(seg.toolDesc);
        const isContour = /CONTORNO/i.test(seg.opName);
        const isHelicalBore = /FURO CENTRAL/i.test(seg.opName) && seg.type.indexOf('arc') === 0;
        const rTool = Math.max(seg.rTool || 6, 1.5);

        // No furo central helicoidal, limpa também o miolo central para não sobrar ilha no centro!
        if (isHelicalBore) {
            const cxB = seg.x1 + (seg.i || 0);
            const cyB = seg.y1 + (seg.j || 0);
            const rBore = Math.hypot(seg.i || 0, seg.j || 0) + Math.min(rTool, 4);
            const zTarget = Math.max(seg.z2, model.zBottom);
            for (let j = 0; j < rows; j++) {
                const wy = model.v0 + (j + 0.5) * cell;
                for (let i = 0; i < cols; i++) {
                    const wx = model.u0 + (i + 0.5) * cell;
                    if (Math.hypot(wx - cxB, wy - cyB) <= rBore) {
                        const idx = j * cols + i;
                        if (H[idx] > zTarget) {
                            H[idx] = zTarget;
                            machined[idx] = zTarget <= model.zBottom + 0.25 ? 4 : 2;
                        }
                    }
                }
            }
            continue;
        }

        const step = Math.max(cell * 0.55, 0.45);
        const pts = sampleSeg(seg, step);

        pts.forEach(p => {
            if (p.z > model.stockTop + 0.2) return;
            const ci = Math.round((p.x - model.u0) / cell);
            const cj = Math.round((p.y - model.v0) / cell);
            const rc = Math.ceil(rTool / cell);

            for (let j = Math.max(0, cj - rc); j <= Math.min(rows - 1, cj + rc); j++) {
                const wy = model.v0 + (j + 0.5) * cell;
                for (let i = Math.max(0, ci - rc); i <= Math.min(cols - 1, ci + rc); i++) {
                    const wx = model.u0 + (i + 0.5) * cell;
                    const dx = (i - ci) * cell, dy = (j - cj) * cell;
                    if (dx * dx + dy * dy > rTool * rTool) continue;
                    const idx = j * cols + i;

                    if (model.hasWall && isFace && wy >= model.partY1 - model.wallEp &&
                        wx >= model.partX0 && wx <= model.partX1) {
                        if (machined[idx] === 0) machined[idx] = 1;
                        continue;
                    }

                    if (isContour) {
                        const insidePart = model.partId === 'flange'
                            ? (Math.hypot(wx, wy) <= model.partX1 - 0.8)
                            : (wx >= model.partX0 + 0.8 && wx <= model.partX1 - 0.8 &&
                               wy >= model.partY0 + 0.8 && wy <= model.partY1 - 0.8);
                        if (insidePart) continue;
                    }

                    const zTarget = Math.max(p.z, model.zBottom);
                    if (H[idx] > zTarget - 0.02) {
                        H[idx] = zTarget;
                        if (zTarget <= model.zBottom + 0.25 && !isContour) {
                            machined[idx] = 4;
                        } else if (isChamfer) {
                            machined[idx] = 3;
                        } else if (zTarget < -0.25) {
                            machined[idx] = 2;
                        } else {
                            machined[idx] = Math.max(machined[idx], 1);
                        }
                    }
                }
            }
        });

        if (isContour && model.partId === 'flange' && seg.fullCircle && seg.z2 <= model.zBottom + 1) {
            const R = model.partX1;
            for (let j = 0; j < rows; j++) {
                const wy = model.v0 + (j + 0.5) * cell;
                for (let i = 0; i < cols; i++) {
                    const wx = model.u0 + (i + 0.5) * cell;
                    if (Math.hypot(wx, wy) > R + 0.4) {
                        const idx = j * cols + i;
                        H[idx] = model.zBottom;
                        machined[idx] = 4;
                    }
                }
            }
        }
    }
    model.applied = ate;
}

function simMachinedCount() {
    const m = app.simModel;
    if (!m) return 0;
    let n = 0;
    for (let i = 0; i < m.machined.length; i++) if (m.machined[i] > 0) n++;
    return n;
}

// ============================================================
// MOTOR CSG CONTÍNUO (CURVAS SUAVES SEM SERRILHADO DE VOXELS)
// ============================================================
// Extrai o estado geométrico exato (faceamento, contorno, furos cilíndricos suaves,
// cavidades com cantos arredondados, rampa inclinada e chanfros) até o bloco `upto`.
function extractSmoothCSG(model, upto) {
    const csg = {
        faceSegs: [],
        faceDone: false,
        contourZ: 0,
        contourDone: false,
        centerBore: null, // { cx, cy, r, z, chamfer }
        holes: [],        // [{ x, y, steps: [{ r, z }] }]
        pocket: null,     // { x0, y0, x1, y1, rCorner, z }
        rampSteps: [],    // [{ xStart, z }]
        rampFinishCount: 0,
        outerChamfer: 0,
        wallMachined: false,
        wallHoleR: 0
    };
    const holeMap = {};

    for (let i = 0; i < upto && i < model.segs.length; i++) {
        const s = model.segs[i];
        if (!s || s.type === 'rapid') continue;
        const op = s.opName || '';

        if (/FACEAMENTO/i.test(op) || s.tool === 1) {
            if (s.z2 <= 0.1) csg.faceSegs.push(s);
        } else if (/CONTORNO/i.test(op)) {
            csg.contourZ = Math.min(csg.contourZ, s.z2);
            if (s.fullCircle || (Math.abs(s.x2 - model.partX0) < 2 && Math.abs(s.y2 - model.partY0) < 2 && csg.contourZ <= model.zBottom + 1)) {
                csg.contourDone = true;
            }
        } else if (/PERFIL DA PAREDE/i.test(op)) {
            csg.wallMachined = true;
        } else if (/FURO PAREDE/i.test(op)) {
            csg.wallHoleR = Math.max(s.rTool || 10, 4);
        } else if (/FURO CENTRAL/i.test(op) && s.type.indexOf('arc') === 0) {
            const cx = s.x1 + (s.i || 0), cy = s.y1 + (s.j || 0);
            const r = (model.dims && model.dims.furoCentral) ? (model.dims.furoCentral / 2) : (Math.hypot(s.i || 0, s.j || 0) + 4);
            if (!csg.centerBore) csg.centerBore = { cx: cx, cy: cy, r: r, z: 0, chamfer: 0 };
            csg.centerBore.z = Math.min(csg.centerBore.z, Math.max(s.z2, model.zBottom));
        } else if (s.opKind === 'Drill') {
            const key = s.x2.toFixed(1) + ':' + s.y2.toFixed(1);
            if (!holeMap[key]) {
                holeMap[key] = { x: s.x2, y: s.y2, steps: [] };
                csg.holes.push(holeMap[key]);
            }
            const rH = s.rTool || 4;
            const zH = Math.max(s.z2, model.zBottom);
            const existing = holeMap[key].steps.find(st => Math.abs(st.r - rH) < 0.3);
            if (existing) existing.z = Math.min(existing.z, zH);
            else holeMap[key].steps.push({ r: rH, z: zH });
        } else if (/CAVIDADE|RASGO/i.test(op)) {
            const rT = s.rTool || 5;
            if (!csg.pocket) {
                csg.pocket = {
                    x0: Math.min(s.x1, s.x2) - rT,
                    x1: Math.max(s.x1, s.x2) + rT,
                    y0: Math.min(s.y1, s.y2) - rT,
                    y1: Math.max(s.y1, s.y2) + rT,
                    rCorner: rT,
                    z: Math.max(s.z2, model.zBottom)
                };
            } else {
                csg.pocket.x0 = Math.min(csg.pocket.x0, s.x1 - rT, s.x2 - rT);
                csg.pocket.x1 = Math.max(csg.pocket.x1, s.x1 + rT, s.x2 + rT);
                csg.pocket.y0 = Math.min(csg.pocket.y0, s.y1 - rT, s.y2 - rT);
                csg.pocket.y1 = Math.max(csg.pocket.y1, s.y1 + rT, s.y2 + rT);
                csg.pocket.z = Math.min(csg.pocket.z, Math.max(s.z2, model.zBottom));
            }
        } else if (/DEGRAU DA RAMPA/i.test(op) || /DESBASTE DA RAMPA/i.test(op)) {
            if (s.z2 < -0.2 && Math.abs(s.x2 - s.x1) > 5) {
                const xSt = Math.min(s.x1, s.x2);
                const last = csg.rampSteps[csg.rampSteps.length - 1];
                if (!last || Math.abs(last.z - s.z2) > 0.2) {
                    csg.rampSteps.push({ xStart: xSt, z: s.z2 });
                }
            }
        } else if (/ACABAMENTO DA RAMPA/i.test(op)) {
            if (s.z2 < s.z1 - 1) csg.rampFinishCount++;
        } else if (/CHANFRO/i.test(op)) {
            const chVal = Math.abs(s.z2) || (model.dims && model.dims.chanfro) || 2;
            if (csg.centerBore && /FURO CENTRAL/i.test(op)) {
                csg.centerBore.chamfer = chVal;
            } else {
                csg.outerChamfer = chVal;
            }
        }
    }

    if (csg.faceSegs.length >= 3 || model.partId === 'cunha') csg.faceDone = true;
    if (csg.contourZ <= model.zBottom + 0.5) csg.contourDone = true;
    csg.holes.forEach(h => h.steps.sort((a, b) => b.r - a.r)); // maior raio (contrafuro) primeiro
    return csg;
}

// ----- Paleta CAD/CAM Studio -----
const SIM_COLORS = {
    bg: '#0B121B',
    bgTop: '#152336',
    grid: 'rgba(111, 211, 224, 0.07)',
    rawTop: '#8C765A',
    rawTopDark: '#736048',
    rawSideX: '#6B5942',
    rawSideY: '#524432',
    facedTopA: '#9BE0EE',
    facedTopB: '#6BC2D4',
    cutSideX: '#4895A8',
    cutSideY: '#337182',
    pocketFloor: '#2B6475',
    holeAbyss: '#080E16',
    chamferGold: '#FFB366',
    sectionFill: '#3B6E7C',
    sectionStroke: '#FF9F5A',
    viseBody: '#202E3D',
    viseJaw: '#32465C',
    pathRapid: 'rgba(143, 160, 179, 0.65)',
    pathFeed: '#FF7A3D',
    pathDone: 'rgba(255, 122, 61, 0.85)',
    pathFuture: 'rgba(111, 211, 224, 0.16)',
    toolBody: '#DCEAF2',
    toolFlute: '#6FD3E0',
    toolHolder: '#283646',
    insertGold: '#F5C542'
};

function simCtx(id) {
    const c = document.getElementById(id);
    if (!c || !c.getContext) return null;
    try {
        const ctx = c.getContext('2d');
        return ctx ? { canvas: c, ctx: ctx } : null;
    } catch (e) {
        return null;
    }
}

// Gera polígono 2D suave para disco (Flange) ou retângulo com cantos opcionais
function makeCirclePoly2D(cx, cy, r, n, yMinClip) {
    const pts = [];
    const steps = n || 64;
    for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const px = cx + Math.cos(a) * r;
        let py = cy + Math.sin(a) * r;
        if (yMinClip !== undefined && py < yMinClip) py = yMinClip;
        pts.push([px, py]);
    }
    return pts;
}

function makeRoundedRectPoly2D(x0, y0, x1, y1, r, yMinClip) {
    const ya = yMinClip !== undefined ? Math.max(y0, yMinClip) : y0;
    const yb = y1;
    if (yb <= ya) return [];
    const rc = Math.max(0, Math.min(r || 0, (x1 - x0) / 2, (yb - ya) / 2));
    if (rc < 0.3) {
        return [[x0, ya], [x1, ya], [x1, yb], [x0, yb]];
    }
    const pts = [];
    const corners = [
        [x1 - rc, ya + rc, -Math.PI / 2, 0],
        [x1 - rc, yb - rc, 0, Math.PI / 2],
        [x0 + rc, yb - rc, Math.PI / 2, Math.PI],
        [x0 + rc, ya + rc, Math.PI, Math.PI * 1.5]
    ];
    corners.forEach(c => {
        const segs = 10;
        for (let k = 0; k <= segs; k++) {
            const a = c[2] + (c[3] - c[2]) * (k / segs);
            pts.push([c[0] + Math.cos(a) * rc, c[1] + Math.sin(a) * rc]);
        }
    });
    return pts;
}

// Desenha um prisma/cilindro 3D suave extrudado entre zBot e zTop com sombreamento Phong por normal
function drawExtrudedSolid3D(ctx, proj, cam, poly2D, zTopFn, zBot, opts) {
    if (!poly2D || poly2D.length < 3) return;
    opts = opts || {};
    const sinY = Math.sin(cam.yaw), cosY = Math.cos(cam.pitch);
    const viewX = -sinY, viewY = - Math.cos(cam.yaw);
    const n = poly2D.length;

    const drawWall = (pA, pB, frontFacing) => {
        const dx = pB[0] - pA[0], dy = pB[1] - pA[1];
        const len = Math.hypot(dx, dy);
        if (len < 1e-3) return;
        // Normal externa 2D (assumindo poly2D anti-horário)
        const nx = dy / len, ny = -dx / len;
        const dotCam = nx * viewX + ny * viewY;
        const isFront = opts.insideCavity ? (dotCam < 0.15) : (dotCam > -0.15);
        if (isFront !== frontFacing) return;

        const ztA = typeof zTopFn === 'function' ? zTopFn(pA[0], pA[1]) : zTopFn;
        const ztB = typeof zTopFn === 'function' ? zTopFn(pB[0], pB[1]) : zTopFn;
        if (ztA <= zBot + 0.05 && ztB <= zBot + 0.05) return;

        const sA = proj(pA[0], pA[1], ztA);
        const sB = proj(pB[0], pB[1], ztB);
        const sC = proj(pB[0], pB[1], zBot);
        const sD = proj(pA[0], pA[1], zBot);

        // Iluminação direcional suave na parede
        const lightDot = nx * 0.65 - ny * 0.55;
        const shade = opts.insideCavity
            ? (0.42 - 0.25 * lightDot)
            : (0.68 + 0.28 * lightDot);
        const baseRGB = opts.raw ? [136, 114, 86] : (opts.sectionWall && Math.abs(ny + 1) < 0.1 ? [62, 126, 144] : [88, 174, 194]);
        const fill = 'rgb(' +
            Math.min(255, Math.max(18, Math.round(baseRGB[0] * shade))) + ',' +
            Math.min(255, Math.max(24, Math.round(baseRGB[1] * shade))) + ',' +
            Math.min(255, Math.max(30, Math.round(baseRGB[2] * shade))) + ')';

        ctx.fillStyle = fill;
        ctx.strokeStyle = fill;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(sA[0], sA[1]);
        ctx.lineTo(sB[0], sB[1]);
        ctx.lineTo(sC[0], sC[1]);
        ctx.lineTo(sD[0], sD[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Hachura no plano de Meio-Corte A-A
        if (opts.sectionWall && Math.abs(pA[1] - opts.sectionY) < 0.2 && Math.abs(pB[1] - opts.sectionY) < 0.2) {
            ctx.strokeStyle = 'rgba(255, 159, 90, 0.55)';
            ctx.lineWidth = 1.1;
            ctx.stroke();
        }
    };

    // Se for cavidade interna: desenha o fundo primeiro e depois as paredes internas visíveis
    if (opts.insideCavity) {
        ctx.fillStyle = opts.through ? SIM_COLORS.holeAbyss : SIM_COLORS.pocketFloor;
        ctx.beginPath();
        poly2D.forEach((p, k) => {
            const sp = proj(p[0], p[1], zBot);
            if (k === 0) ctx.moveTo(sp[0], sp[1]);
            else ctx.lineTo(sp[0], sp[1]);
        });
        ctx.closePath();
        ctx.fill();

        for (let k = 0; k < n; k++) {
            drawWall(poly2D[k], poly2D[(k + 1) % n], true);
        }
        // Borda superior nítida da cavidade/furo (ou chanfro dourado)
        ctx.strokeStyle = opts.chamfer > 0 ? SIM_COLORS.chamferGold : 'rgba(180, 232, 244, 0.65)';
        ctx.lineWidth = opts.chamfer > 0 ? 2.4 : 1.1;
        ctx.beginPath();
        poly2D.forEach((p, k) => {
            const zt = typeof zTopFn === 'function' ? zTopFn(p[0], p[1]) : zTopFn;
            const sp = proj(p[0], p[1], zt);
            if (k === 0) ctx.moveTo(sp[0], sp[1]);
            else ctx.lineTo(sp[0], sp[1]);
        });
        ctx.closePath();
        ctx.stroke();
        return;
    }

    // Sólido externo: paredes traseiras → paredes frontais → face superior suave
    for (let k = 0; k < n; k++) drawWall(poly2D[k], poly2D[(k + 1) % n], false);
    for (let k = 0; k < n; k++) drawWall(poly2D[k], poly2D[(k + 1) % n], true);

    if (!opts.skipTop) {
        ctx.fillStyle = opts.topFill || (opts.raw ? SIM_COLORS.rawTop : SIM_COLORS.facedTopB);
        ctx.beginPath();
        poly2D.forEach((p, k) => {
            const zt = typeof zTopFn === 'function' ? zTopFn(p[0], p[1]) : zTopFn;
            const sp = proj(p[0], p[1], zt);
            if (k === 0) ctx.moveTo(sp[0], sp[1]);
            else ctx.lineTo(sp[0], sp[1]);
        });
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = opts.chamfer > 0
            ? SIM_COLORS.chamferGold
            : (opts.raw ? 'rgba(210, 185, 150, 0.45)' : 'rgba(195, 240, 250, 0.72)');
        ctx.lineWidth = opts.chamfer > 0 ? 2.2 : 1.2;
        ctx.stroke();
    }
    void cosY;
}

// ============================================================
// VISTA 1: 3D ISOMÉTRICA INTERATIVA (Sólido CSG Suave)
// ============================================================
function renderSim3D(model) {
    const pair = simCtx('sim3d');
    if (!pair || !pair.ctx || !model) return;
    ensureSimViewState();
    const ctx = pair.ctx, W = pair.canvas.width, Hc = pair.canvas.height;

    const bgGrad = ctx.createRadialGradient(W * 0.5, Hc * 0.45, 20, W * 0.5, Hc * 0.5, W * 0.65);
    bgGrad.addColorStop(0, SIM_COLORS.bgTop);
    bgGrad.addColorStop(1, SIM_COLORS.bg);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, Hc);

    if (model.kind === 'turning') {
        renderSim3DTurning(ctx, W, Hc, model);
        return;
    }

    const { cols, rows, cell } = model;
    const cam = app.simCam;
    const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
    const sinP = Math.sin(cam.pitch), cosP = Math.cos(cam.pitch);

    const spanX = cols * cell, spanY = rows * cell;
    const topMax = model.hasWall ? model.wallTop : model.stockTop;
    const spanZ = topMax - model.zBottom;
    const zExag = spanZ < 32 ? 1.55 : 1.15;
    // Escala confortável com margem generosa para nunca cortar as bordas nem a ferramenta!
    const diagXY = Math.hypot(spanX, spanY);
    const baseScale = Math.min((W * 0.62) / Math.max(diagXY, 1), (Hc * 0.56) / Math.max(diagXY * 0.55 + spanZ * zExag + 32, 1));
    const s = baseScale * cam.zoom;
    const cxWorld = model.u0 + spanX / 2;
    const cyWorld = model.v0 + spanY / 2;
    const czWorld = (topMax + model.zBottom) / 2;
    const ox = W * 0.5, oy = Hc * 0.58;

    const proj = (wx, wy, wz) => {
        const dx = wx - cxWorld, dy = wy - cyWorld, dz = (wz - czWorld) * zExag;
        const rx = dx * cosY - dy * sinY;
        const ry = dx * sinY + dy * cosY;
        return [
            ox + rx * s,
            oy + ry * sinP * s - dz * cosP * s
        ];
    };

    // 1. Grade da mesa da máquina sob a peça
    ctx.strokeStyle = SIM_COLORS.grid;
    ctx.lineWidth = 1;
    const gStep = Math.max(20, Math.round(spanX / 5 / 10) * 10);
    for (let gx = -4; gx <= 4; gx++) {
        const p1 = proj(cxWorld + gx * gStep, cyWorld - spanY * 0.85, model.zBottom - 8);
        const p2 = proj(cxWorld + gx * gStep, cyWorld + spanY * 0.85, model.zBottom - 8);
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
    for (let gy = -4; gy <= 4; gy++) {
        const p1 = proj(cxWorld - spanX * 0.85, cyWorld + gy * gStep, model.zBottom - 8);
        const p2 = proj(cxWorld + spanX * 0.85, cyWorld + gy * gStep, model.zBottom - 8);
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }

    // 2. Mordentes da morsa sob o bloco
    const visePoly = makeRoundedRectPoly2D(model.partX0 + 8, model.v0 - 6, model.partX1 - 8, model.v0 + spanY + 6, 3);
    drawExtrudedSolid3D(ctx, proj, cam, visePoly, model.zBottom, model.zBottom - 7, {
        raw: true, topFill: SIM_COLORS.viseJaw
    });

    const upto = Math.min(app.simIndex == null ? model.segs.length : app.simIndex, model.segs.length);
    const csg = extractSmoothCSG(model, upto);
    const yClip = app.simSectionCut ? ((model.partY0 + model.partY1) / 2) : undefined;

    // Gradiente metálico para o topo da peça usinada
    const pTopL = proj(model.partX0, model.partY1, 0);
    const pBotR = proj(model.partX1, model.partY0, 0);
    const metalGrad = ctx.createLinearGradient(pTopL[0], pTopL[1], pBotR[0], pBotR[1]);
    metalGrad.addColorStop(0, SIM_COLORS.facedTopA);
    metalGrad.addColorStop(0.55, SIM_COLORS.facedTopB);
    metalGrad.addColorStop(1, '#4EA4B8');

    const rawGrad = ctx.createLinearGradient(pTopL[0], pTopL[1], pBotR[0], pBotR[1]);
    rawGrad.addColorStop(0, '#9B8568');
    rawGrad.addColorStop(1, '#736048');

    // Função de altura do topo Z(x,y) (suporta plano reto ou rampa inclinada da Cunha!)
    const totalRampFinish = 5;
    const rampRatio = Math.min(csg.rampFinishCount / totalRampFinish, 1);
    const topZFn = (wx, wy) => {
        if (model.partId === 'cunha') {
            const d = model.dims;
            const zSlope = -((d.hMax - d.hMin) * Math.min(Math.max(wx / Math.max(d.comp, 1), 0), 1));
            if (rampRatio > 0) return zSlope * rampRatio;
            // Durante o desbaste em degraus da rampa:
            let zStep = 0;
            csg.rampSteps.forEach(st => { if (wx >= st.xStart) zStep = Math.min(zStep, st.z); });
            return zStep;
        }
        return csg.faceDone ? 0 : model.stockTop;
    };

    // 3. Se o contorno externo ainda não terminou, mostra o bloco de Material Bruto externo
    const stockX0 = model.u0, stockX1 = model.u0 + spanX;
    const stockY0 = model.v0, stockY1 = model.v0 + spanY;
    if (!csg.contourDone) {
        const rawPoly = makeRoundedRectPoly2D(stockX0, stockY0, stockX1, stockY1, 2, yClip);
        drawExtrudedSolid3D(ctx, proj, cam, rawPoly, topZFn, model.zBottom, {
            raw: !csg.faceDone,
            topFill: csg.faceDone ? metalGrad : rawGrad,
            sectionWall: app.simSectionCut,
            sectionY: yClip
        });

        // Se o faceamento está em andamento (parcial), desenha as faixas já faceadas em metal brilhante sobre o bruto!
        if (!csg.faceDone && csg.faceSegs.length > 0) {
            const facedPoly = makeRoundedRectPoly2D(
                stockX0 + 1,
                stockY0 + 1,
                stockX1 - 1,
                Math.min(stockY1 - 1, stockY0 + (spanY * csg.faceSegs.length) / 5),
                2,
                yClip
            );
            drawExtrudedSolid3D(ctx, proj, cam, facedPoly, 0.05, -0.1, {
                raw: false, topFill: metalGrad
            });
        }

        // Traçagem da peça nominal sobre o bloco bruto (mostra o contorno alvo antes da usinagem)
        const layoutPoly = model.partId === 'flange'
            ? makeCirclePoly2D(0, 0, model.partX1, 64, yClip)
            : makeRoundedRectPoly2D(model.partX0, model.partY0, model.partX1, model.partY1, 2, yClip);
        if (layoutPoly.length > 2) {
            ctx.strokeStyle = 'rgba(231, 236, 242, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            layoutPoly.forEach((p, k) => {
                const sp = proj(p[0], p[1], topZFn(p[0], p[1]) + 0.15);
                if (k === 0) ctx.moveTo(sp[0], sp[1]);
                else ctx.lineTo(sp[0], sp[1]);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Canal do contorno sendo usinado
        if (csg.contourZ < -0.2) {
            const bodyPoly = model.partId === 'flange'
                ? makeCirclePoly2D(0, 0, model.partX1, 64, yClip)
                : makeRoundedRectPoly2D(model.partX0, model.partY0, model.partX1, model.partY1, 2, yClip);
            drawExtrudedSolid3D(ctx, proj, cam, bodyPoly, 0.1, csg.contourZ, {
                raw: false, topFill: metalGrad, chamfer: csg.outerChamfer
            });
        }
    } else {
        // Contorno externo concluído: desenha a silhueta fantasma do bruto original + o corpo sólido suave da peça!
        const rawGhost = makeRoundedRectPoly2D(stockX0, stockY0, stockX1, stockY1, 2, yClip);
        if (rawGhost.length > 2) {
            ctx.strokeStyle = 'rgba(140, 118, 90, 0.32)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            rawGhost.forEach((p, k) => {
                const sp = proj(p[0], p[1], model.stockTop);
                if (k === 0) ctx.moveTo(sp[0], sp[1]);
                else ctx.lineTo(sp[0], sp[1]);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const partPoly = model.partId === 'flange'
            ? makeCirclePoly2D(0, 0, model.partX1, 72, yClip)
            : makeRoundedRectPoly2D(model.partX0, model.partY0, model.partX1, model.partY1, 2.5, yClip);
        drawExtrudedSolid3D(ctx, proj, cam, partPoly, topZFn, model.zBottom, {
            raw: false,
            topFill: metalGrad,
            chamfer: csg.outerChamfer,
            sectionWall: app.simSectionCut,
            sectionY: yClip
        });
    }

    // 4. Parede vertical traseira do Suporte em L (com furo horizontal suave quando usinado!)
    if (model.hasWall) {
        const wallY0 = model.partY1 - model.wallEp;
        if (!yClip || model.partY1 > yClip) {
            const wallPoly = makeRoundedRectPoly2D(model.partX0, wallY0, model.partX1, model.partY1, 1.5, yClip);
            drawExtrudedSolid3D(ctx, proj, cam, wallPoly, model.wallTop, 0, {
                raw: !csg.wallMachined && !csg.faceDone,
                topFill: metalGrad
            });
            if (csg.wallHoleR > 0) {
                // Desenha o furo passante na face frontal da parede vertical
                const zHoleCenter = model.wallTop * 0.48;
                const steps = 40;
                ctx.fillStyle = SIM_COLORS.holeAbyss;
                ctx.strokeStyle = 'rgba(180, 232, 244, 0.75)';
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                for (let k = 0; k < steps; k++) {
                    const a = (k / steps) * Math.PI * 2;
                    const hx = Math.cos(a) * csg.wallHoleR;
                    const hz = zHoleCenter + Math.sin(a) * csg.wallHoleR;
                    const sp = proj(hx, wallY0, hz);
                    if (k === 0) ctx.moveTo(sp[0], sp[1]);
                    else ctx.lineTo(sp[0], sp[1]);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    // 5. Cavidade / Rasgo com cantos arredondados suaves (Placa com Rasgo e Caixa com Cavidade)
    if (csg.pocket && csg.pocket.z < -0.2) {
        const pk = csg.pocket;
        const pkPoly = makeRoundedRectPoly2D(pk.x0, pk.y0, pk.x1, pk.y1, pk.rCorner, yClip);
        const isThru = pk.z <= model.zBottom + 0.4;
        drawExtrudedSolid3D(ctx, proj, cam, pkPoly, 0, pk.z, {
            insideCavity: true,
            through: isThru
        });
    }

    // 6. Furo Central Helicoidal suave (ex.: Ø40 no Flange — sem ilha no meio!)
    if (csg.centerBore && csg.centerBore.z < -0.2) {
        const cb = csg.centerBore;
        const cbPoly = makeCirclePoly2D(cb.cx, cb.cy, cb.r, 64, yClip);
        const isThru = cb.z <= model.zBottom + 0.4;
        drawExtrudedSolid3D(ctx, proj, cam, cbPoly, 0, cb.z, {
            insideCavity: true,
            through: isThru,
            chamfer: cb.chamfer
        });
    }

    // 7. Furos cilíndricos e contrafuros escalonados suaves (G81/G82/G83)
    csg.holes.forEach(h => {
        if (yClip !== undefined && h.y + h.steps[0].r < yClip) return;
        let prevZTop = topZFn(h.x, h.y);
        h.steps.forEach(st => {
            const hPoly = makeCirclePoly2D(h.x, h.y, st.r, 40, yClip);
            const isThru = st.z <= model.zBottom + 0.4;
            drawExtrudedSolid3D(ctx, proj, cam, hPoly, prevZTop, st.z, {
                insideCavity: true,
                through: isThru
            });
            prevZTop = st.z;
        });
    });

    // 8. Eixos da origem G54 (X vermelho, Y verde, Z azul)
    const o0 = proj(0, 0, 0.5);
    const oxAxis = proj(22, 0, 0.5);
    const oyAxis = proj(0, 22, 0.5);
    const ozAxis = proj(0, 0, 22);
    const drawAxis = (pEnd, col, lbl) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(o0[0], o0[1]); ctx.lineTo(pEnd[0], pEnd[1]); ctx.stroke();
        ctx.fillStyle = col; ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(lbl, pEnd[0] + 3, pEnd[1] - 2);
    };
    drawAxis(oxAxis, '#FF6B6B', 'X');
    drawAxis(oyAxis, '#5FD98A', 'Y');
    drawAxis(ozAxis, '#6FD3E0', 'Z');

    // 9. Percurso 3D suave sobreposto
    if (app.simShowPath && upto > 0) {
        for (let si = 0; si < upto; si++) {
            const seg = model.segs[si];
            const isRecent = si >= upto - 8;
            ctx.strokeStyle = seg.type === 'rapid'
                ? 'rgba(143, 160, 179, 0.35)'
                : (isRecent ? '#FF9F5A' : 'rgba(255, 122, 61, 0.55)');
            ctx.lineWidth = isRecent && seg.type !== 'rapid' ? 2.0 : 1.1;
            if (seg.type === 'rapid') ctx.setLineDash([4, 4]);
            else ctx.setLineDash([]);
            ctx.beginPath();
            const pts = seg.type.indexOf('arc') === 0 ? sampleSeg(seg, 2) : [
                { x: seg.x1, y: seg.y1, z: Math.min(seg.z1, 18) },
                { x: seg.x2, y: seg.y2, z: Math.min(seg.z2, 18) }
            ];
            pts.forEach((p, k) => {
                const sp = proj(p.x, p.y, Math.min(p.z, 18));
                if (k === 0) ctx.moveTo(sp[0], sp[1]);
                else ctx.lineTo(sp[0], sp[1]);
            });
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    // 10. Ferramenta 3D cilíndrica + cone porta-ferramentas BT40
    if (app.simShowTool && model.segs.length > 0) {
        const cur = upto > 0 ? model.segs[upto - 1] : model.segs[0];
        const tx = upto > 0 ? cur.x2 : cur.x1;
        const ty = upto > 0 ? cur.y2 : cur.y1;
        const tz = Math.min(upto > 0 ? cur.z2 : cur.z1, 20);
        const rT = Math.min(Math.max(cur.rTool || 6, 3), 18);
        const tip = proj(tx, ty, tz);
        const shankTop = proj(tx, ty, tz + 26);
        const holderTop = proj(tx, ty, tz + 44);
        const radPx = Math.max(rT * s * 0.65, 5);

        if (upto > 0 && cur.type !== 'rapid' && tz <= model.stockTop + 0.5) {
            const glow = ctx.createRadialGradient(tip[0], tip[1], 1, tip[0], tip[1], radPx * 2.2);
            glow.addColorStop(0, 'rgba(255, 165, 70, 0.85)');
            glow.addColorStop(1, 'rgba(255, 122, 61, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(tip[0], tip[1], radPx * 2.2, 0, Math.PI * 2); ctx.fill();
        }

        // Corpo cilíndrico da fresa/broca com tampas elípticas suaves
        ctx.fillStyle = SIM_COLORS.toolBody;
        ctx.strokeStyle = SIM_COLORS.toolFlute;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tip[0] - radPx, tip[1]);
        ctx.lineTo(shankTop[0] - radPx, shankTop[1]);
        ctx.lineTo(shankTop[0] + radPx, shankTop[1]);
        ctx.lineTo(tip[0] + radPx, tip[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = SIM_COLORS.toolFlute;
        ctx.beginPath();
        ctx.ellipse(tip[0], tip[1], radPx, Math.max(radPx * 0.38, 2.5), 0, 0, Math.PI * 2);
        ctx.fill();

        // Porta-ferramenta BT40
        const hRad = Math.max(radPx * 1.45, 10);
        ctx.fillStyle = SIM_COLORS.toolHolder;
        ctx.strokeStyle = '#6FD3E0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(shankTop[0] - hRad, shankTop[1]);
        ctx.lineTo(holderTop[0] - hRad * 1.2, holderTop[1]);
        ctx.lineTo(holderTop[0] + hRad * 1.2, holderTop[1]);
        ctx.lineTo(shankTop[0] + hRad, shankTop[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(231, 236, 242, 0.85)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(
        (app.simSectionCut ? '🔪 MEIO-CORTE A-A ATIVO · ' : '') +
        'MODELO 3D SÓLIDO (arraste para girar · scroll para zoom)',
        14, 22
    );
}

// Renderização 3D suave para Torneamento (cilindro revolucionado de alta resolução + placa de 3 castanhas)
function renderSim3DTurning(ctx, W, Hc, model) {
    ensureSimViewState();
    const { cols, cell, R_ext, R_int, machExt, machInt, threadPitch } = model;
    const cam = app.simCam;
    const s = Math.min((W * 0.72) / (model.partLen * 1.15), (Hc * 0.68) / (model.stockTop * 2.5)) * cam.zoom;
    const tilt = 0.34 * Math.cos(cam.yaw + 0.68);
    const pitchY = 0.16 * Math.sin(cam.pitch - 0.58);
    const ox = W * 0.24, oy = Hc * 0.52;

    const ringPt = (zVal, r, ang) => {
        const dz = zVal - model.u0;
        const cx = ox + dz * s;
        const cy = oy + dz * pitchY * s;
        return [
            cx + Math.cos(ang) * r * tilt * s,
            cy - Math.sin(ang) * r * s
        ];
    };

    // 1. Placa de 3 castanhas à esquerda
    const rChuck = model.stockTop * 1.32;
    for (let c = -28; c <= 0; c += 4) {
        const cx = ox + c * s * 0.8;
        ctx.fillStyle = c === 0 ? '#2D3C4E' : '#1F2A38';
        ctx.strokeStyle = '#3E526A';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, oy, Math.max(Math.abs(rChuck * tilt * s), 8), rChuck * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    [0.4, 2.5, 4.6].forEach(ang => {
        const p1 = ringPt(model.u0, model.stockTop * 0.98, ang);
        const p2 = ringPt(model.u0 - 10, rChuck * 0.95, ang);
        ctx.strokeStyle = '#6FD3E0';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    });

    // 2. Superfície cilíndrica suave de alta definição
    const hasCutaway = app.simSectionCut || model.R_int[Math.floor(cols / 2)] > 0.5;
    const aSteps = 36;
    for (let i = 0; i < cols; i++) {
        const iNext = Math.min(i + 1, cols - 1);
        const z1 = model.u0 + i * cell, z2 = model.u0 + (i + 1) * cell;
        let rE1 = R_ext[i], rE2 = R_ext[iNext];
        const rI = R_int[i];
        const mE = machExt[i];
        if (mE === 3 && threadPitch[i] > 0) {
            const wave = Math.sin(i * 1.5) * 0.45;
            rE1 += wave; rE2 += wave;
        }

        for (let k = 0; k < aSteps; k++) {
            const a0 = (k / aSteps) * Math.PI * 2;
            const a1 = ((k + 1) / aSteps) * Math.PI * 2;
            const aMid = (a0 + a1) / 2;
            if (hasCutaway && aMid > -0.65 && aMid < 0.85) continue;
            if (Math.cos(aMid - 0.35) < -0.25 && !hasCutaway) continue;

            const light = 0.56 + 0.42 * Math.sin(aMid + 0.5);
            let col;
            if (mE === 0) {
                col = 'rgb(' + Math.round(138 * light) + ',' + Math.round(115 * light) + ',' + Math.round(86 * light) + ')';
            } else if (mE === 3) {
                col = 'rgb(' + Math.round(235 * light) + ',' + Math.round(180 * light) + ',' + Math.round(95 * light) + ')';
            } else {
                col = 'rgb(' + Math.round(118 * light) + ',' + Math.round(200 * light) + ',' + Math.round(218 * light) + ')';
            }
            const pA = ringPt(z1, rE1, a0), pB = ringPt(z2, rE2, a0);
            const pC = ringPt(z2, rE2, a1), pD = ringPt(z1, rE1, a1);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(pA[0], pA[1]); ctx.lineTo(pB[0], pB[1]);
            ctx.lineTo(pC[0], pC[1]); ctx.lineTo(pD[0], pD[1]);
            ctx.closePath();
            ctx.fill();
        }

        if (hasCutaway && rI > 0.5) {
            let rIn = rI;
            if (machInt[i] === 3) rIn += Math.sin(i * 1.5) * 0.45;
            const p1 = ringPt(z1, rIn, 0.85), p2 = ringPt(z2, rIn, 0.85);
            const p3 = ringPt(z2, rIn, -0.65), p4 = ringPt(z1, rIn, -0.65);
            ctx.fillStyle = machInt[i] === 3 ? '#B88946' : '#295766';
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
            ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]);
            ctx.closePath();
            ctx.fill();
        }
    }

    const upto = Math.min(app.simIndex == null ? model.segs.length : app.simIndex, model.segs.length);
    if (app.simShowTool && model.segs.length > 0) {
        const cur = upto > 0 ? model.segs[upto - 1] : model.segs[0];
        const tz = Math.min(Math.max(upto > 0 ? cur.z2 : cur.z1, model.u0), 6);
        const tr = Math.min(Math.max((upto > 0 ? cur.x2 : cur.x1) / 2, 0), model.stockTop + 6);
        const tip = ringPt(tz, tr, Math.PI / 2);

        if (upto > 0 && cur.type !== 'rapid') {
            ctx.fillStyle = 'rgba(255, 165, 70, 0.75)';
            ctx.beginPath(); ctx.arc(tip[0], tip[1], 9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = SIM_COLORS.insertGold;
        ctx.strokeStyle = '#1A1408';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        ctx.lineTo(tip[0] - 8, tip[1] - 12);
        ctx.lineTo(tip[0] + 8, tip[1] - 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = SIM_COLORS.toolHolder;
        ctx.fillRect(tip[0] - 6, tip[1] - 42, 14, 30);
    }

    ctx.fillStyle = 'rgba(231, 236, 242, 0.85)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('TORNO CNC 3D · PLACA DE 3 CASTANHAS + BARRA EM REVOLUÇÃO', 14, 22);
}

// ============================================================
// VISTA 2: SUPERIOR / PLANTA VETORIAL SUAVE (X×Y | Z×ØX)
// ============================================================
function renderSimTop(model) {
    const pair = simCtx('simTop');
    if (!pair || !pair.ctx || !model) return;
    ensureSimViewState();
    const ctx = pair.ctx, W = pair.canvas.width, Hc = pair.canvas.height;
    const { cols, rows, cell, kind } = model;
    ctx.fillStyle = SIM_COLORS.bg;
    ctx.fillRect(0, 0, W, Hc);

    const topTitle = $('#simTopTitle');
    if (topTitle) {
        topTitle.innerHTML = kind === 'turning'
            ? '⬛ Vista longitudinal (Z × ØX) <span class="sim-hint">perfil + furo em corte</span>'
            : '⬛ Vista superior (X × Y) <span class="sim-hint">geometria vetorial + percurso</span>';
    }

    const upto = Math.min(app.simIndex == null ? model.segs.length : app.simIndex, model.segs.length);

    if (kind === 'turning') {
        const s = Math.min((W - 56) / model.partLen, (Hc - 48) / (model.stockTop * 2.2));
        const ox = 36, cy = Hc / 2;

        ctx.strokeStyle = 'rgba(138, 117, 89, 0.55)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(ox, cy - model.stockTop * s, model.partLen * s, model.stockTop * 2 * s);
        ctx.setLineDash([]);

        for (let i = 0; i < cols; i++) {
            const xPx = ox + i * cell * s;
            const wPx = Math.ceil(cell * s) + 1;
            const rE = model.R_ext[i], rI = model.R_int[i];
            ctx.fillStyle = model.machExt[i] === 0 ? SIM_COLORS.rawTop
                : (model.machExt[i] === 3 ? SIM_COLORS.chamferGold : SIM_COLORS.facedTopB);
            ctx.fillRect(xPx, cy - rE * s, wPx, (rE - rI) * s);
            ctx.fillRect(xPx, cy + rI * s, wPx, (rE - rI) * s);
            if (rI > 0.3) {
                ctx.fillStyle = SIM_COLORS.holeAbyss;
                ctx.fillRect(xPx, cy - rI * s, wPx, rI * 2 * s);
            }
        }
        ctx.strokeStyle = 'rgba(255, 122, 61, 0.65)';
        ctx.setLineDash([8, 4]);
        ctx.beginPath(); ctx.moveTo(12, cy); ctx.lineTo(W - 12, cy); ctx.stroke();
        ctx.setLineDash([]);

        if (app.simShowPath) {
            model.segs.forEach((seg, si) => {
                if (si >= upto) return;
                ctx.strokeStyle = seg.type === 'rapid' ? SIM_COLORS.pathRapid : SIM_COLORS.pathFeed;
                ctx.lineWidth = seg.type === 'rapid' ? 0.9 : 1.5;
                const x1 = ox + (seg.z1 - model.u0) * s, y1 = cy - (seg.x1 / 2) * s;
                const x2 = ox + (seg.z2 - model.u0) * s, y2 = cy - (seg.x2 / 2) * s;
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            });
        }
        return;
    }

    // FRESAMENTO: Planta vetorial suave (círculos perfeitos e cantos arredondados!)
    const spanX = cols * cell, spanY = rows * cell;
    const s = Math.min((W - 44) / spanX, (Hc - 44) / spanY);
    const ox = (W - spanX * s) / 2;
    const oy = (Hc - spanY * s) / 2;
    const toPx = (wx, wy) => [
        ox + (wx - model.u0) * s,
        oy + (spanY - (wy - model.v0)) * s
    ];

    const csg = extractSmoothCSG(model, upto);

    // 1. Bloco de Material Bruto externo
    ctx.fillStyle = csg.contourDone ? 'rgba(138, 117, 89, 0.16)' : SIM_COLORS.rawTop;
    ctx.strokeStyle = 'rgba(190, 165, 130, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(ox, oy, spanX * s, spanY * s);
    ctx.strokeRect(ox, oy, spanX * s, spanY * s);

    // 2. Corpo da Peça (disco perfeito no Flange | retângulo suave nas demais)
    ctx.fillStyle = csg.faceDone ? SIM_COLORS.facedTopB : SIM_COLORS.rawTop;
    ctx.strokeStyle = csg.outerChamfer > 0 ? SIM_COLORS.chamferGold : '#B8EEF8';
    ctx.lineWidth = csg.outerChamfer > 0 ? 2.5 : 1.4;
    if (model.partId === 'flange') {
        const c0 = toPx(0, 0);
        ctx.beginPath();
        ctx.arc(c0[0], c0[1], model.partX1 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else {
        const pTL = toPx(model.partX0, model.partY1);
        const pw = (model.partX1 - model.partX0) * s;
        const ph = (model.partY1 - model.partY0) * s;
        ctx.fillRect(pTL[0], pTL[1], pw, ph);
        ctx.strokeRect(pTL[0], pTL[1], pw, ph);
    }

    // Parede traseira do Suporte em L
    if (model.hasWall) {
        const pW = toPx(model.partX0, model.partY1);
        const pw = (model.partX1 - model.partX0) * s;
        const ph = model.wallEp * s;
        ctx.fillStyle = '#5CAEC0';
        ctx.fillRect(pW[0], pW[1], pw, ph);
        ctx.strokeRect(pW[0], pW[1], pw, ph);
    }

    // 3. Cavidade / Rasgo vetorial com cantos arredondados
    if (csg.pocket && csg.pocket.z < -0.2) {
        const pk = csg.pocket;
        const pkPoly = makeRoundedRectPoly2D(pk.x0, pk.y0, pk.x1, pk.y1, pk.rCorner);
        ctx.fillStyle = pk.z <= model.zBottom + 0.4 ? SIM_COLORS.holeAbyss : SIM_COLORS.pocketFloor;
        ctx.strokeStyle = '#9BE0EE';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        pkPoly.forEach((p, k) => {
            const sp = toPx(p[0], p[1]);
            if (k === 0) ctx.moveTo(sp[0], sp[1]);
            else ctx.lineTo(sp[0], sp[1]);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // 4. Furo Central circular perfeito (Flange)
    if (csg.centerBore && csg.centerBore.z < -0.2) {
        const cb = csg.centerBore;
        const c0 = toPx(cb.cx, cb.cy);
        ctx.fillStyle = cb.z <= model.zBottom + 0.4 ? SIM_COLORS.holeAbyss : SIM_COLORS.pocketFloor;
        ctx.strokeStyle = cb.chamfer > 0 ? SIM_COLORS.chamferGold : '#9BE0EE';
        ctx.lineWidth = cb.chamfer > 0 ? 2.4 : 1.4;
        ctx.beginPath();
        ctx.arc(c0[0], c0[1], cb.r * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // 5. Furos e contrafuros circulares perfeitos (G81/G82/G83)
    csg.holes.forEach(h => {
        const cH = toPx(h.x, h.y);
        h.steps.forEach(st => {
            const isThru = st.z <= model.zBottom + 0.4;
            ctx.fillStyle = isThru ? SIM_COLORS.holeAbyss : SIM_COLORS.pocketFloor;
            ctx.strokeStyle = '#9BE0EE';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cH[0], cH[1], Math.max(st.r * s, 2.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    });

    // 6. Percurso G00/G01/G02 sobreposto
    if (app.simShowPath) {
        model.segs.forEach((seg, si) => {
            const done = si < upto;
            if (!done && seg.type === 'rapid') return;
            ctx.strokeStyle = done
                ? (seg.type === 'rapid' ? SIM_COLORS.pathRapid : SIM_COLORS.pathDone)
                : SIM_COLORS.pathFuture;
            ctx.lineWidth = done && seg.type !== 'rapid' ? 1.4 : 0.9;
            if (seg.type === 'rapid') ctx.setLineDash([3, 3]);
            else ctx.setLineDash([]);
            ctx.beginPath();
            const pts = seg.type.indexOf('arc') === 0 ? sampleSeg(seg, 2) : [
                { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }
            ];
            pts.forEach((p, k) => {
                const xy = toPx(p.x, p.y);
                if (k === 0) ctx.moveTo(xy[0], xy[1]);
                else ctx.lineTo(xy[0], xy[1]);
            });
            ctx.stroke();
        });
        ctx.setLineDash([]);
    }

    // 7. Ferramenta atual
    if (app.simShowTool && model.segs.length > 0) {
        const cur = upto > 0 ? model.segs[upto - 1] : model.segs[0];
        const tx = upto > 0 ? cur.x2 : cur.x1;
        const ty = upto > 0 ? cur.y2 : cur.y1;
        const t = toPx(tx, ty);
        const rPx = Math.max((cur.rTool || 5) * s, 4);
        ctx.fillStyle = 'rgba(111, 211, 224, 0.25)';
        ctx.strokeStyle = SIM_COLORS.toolFlute;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(t[0], t[1], rPx, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(t[0], t[1], 2.2, 0, Math.PI * 2); ctx.fill();
    }
}

// ============================================================
// VISTA 3: FRONTAL EM CORTE VETORIAL SUAVE (X×Z | Seção ØX)
// ============================================================
function renderSimFront(model) {
    const pair = simCtx('simFront');
    if (!pair || !pair.ctx || !model) return;
    ensureSimViewState();
    const ctx = pair.ctx, W = pair.canvas.width, Hc = pair.canvas.height;
    const { cols, cell, kind } = model;
    ctx.fillStyle = SIM_COLORS.bg;
    ctx.fillRect(0, 0, W, Hc);

    const frontTitle = $('#simFrontTitle');
    if (frontTitle) {
        frontTitle.innerHTML = kind === 'turning'
            ? '🏔️ Vista frontal de face (ØX × Y) <span class="sim-hint">seção transversal</span>'
            : '🏔️ Vista frontal em corte (X × Z) <span class="sim-hint">seção A-A + profundidades</span>';
    }

    const upto = Math.min(app.simIndex == null ? model.segs.length : app.simIndex, model.segs.length);
    const cur = model.segs.length > 0 ? (upto > 0 ? model.segs[upto - 1] : model.segs[0]) : null;

    if (kind === 'turning') {
        const cx = W / 2, cy = Hc / 2;
        const s = Math.min(W, Hc) * 0.38 / Math.max(model.stockTop, 1);
        const zCur = cur ? (upto > 0 ? cur.z2 : cur.z1) : -model.partLen / 2;
        const idxSlice = Math.min(Math.max(Math.round((zCur - model.u0) / cell), 0), cols - 1);

        ctx.strokeStyle = SIM_COLORS.rawTop;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, model.stockTop * s, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        const rE = model.R_ext[idxSlice], rI = model.R_int[idxSlice];
        ctx.fillStyle = model.machExt[idxSlice] ? SIM_COLORS.facedTopB : SIM_COLORS.rawTop;
        ctx.beginPath(); ctx.arc(cx, cy, rE * s, 0, Math.PI * 2); ctx.fill();
        if (rI > 0.2) {
            ctx.fillStyle = SIM_COLORS.holeAbyss;
            ctx.beginPath(); ctx.arc(cx, cy, rI * s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(231, 236, 242, 0.85)';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('Øext: ' + fmt(rE * 2) + ' mm' + (rI > 0.2 ? (' · Øint: ' + fmt(rI * 2) + ' mm') : ''), 12, Hc - 12);
        return;
    }

    // FRESAMENTO: Corte técnico vetorial A-A (sem barras verticais pixeladas!)
    const spanX = cols * cell;
    const zTopMax = model.hasWall ? model.wallTop : model.stockTop;
    const totalZ = zTopMax - model.zBottom;
    const sX = (W - 60) / spanX;
    const sZ = (Hc - 58) / Math.max(totalZ + 8, 12);
    const ox = 42;
    const xToPx = xVal => ox + (xVal - model.u0) * sX;
    const zToY = zVal => 28 + (zTopMax - zVal) * sZ;
    const yBottomPx = zToY(model.zBottom);

    const csg = extractSmoothCSG(model, upto);

    // 1. Contorno tracejado do Bloco Bruto original (+1,5 mm)
    const xStockL = xToPx(model.u0), xStockR = xToPx(model.u0 + spanX);
    const yStockTop = zToY(model.stockTop);
    ctx.strokeStyle = 'rgba(138, 117, 89, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(xStockL, yStockTop, xStockR - xStockL, yBottomPx - yStockTop);
    ctx.setLineDash([]);

    // 2. Corpo seccionado da peça
    const xPartL = xToPx(csg.contourDone ? model.partX0 : model.u0);
    const xPartR = xToPx(csg.contourDone ? model.partX1 : (model.u0 + spanX));
    const yPartTop = zToY(csg.faceDone ? 0 : model.stockTop);

    ctx.fillStyle = csg.faceDone ? SIM_COLORS.cutSideX : SIM_COLORS.rawTop;
    ctx.strokeStyle = '#9BE0EE';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (model.partId === 'cunha' && (csg.rampFinishCount > 0 || csg.rampSteps.length > 0)) {
        const d = model.dims;
        const zRight = -(d.hMax - d.hMin);
        ctx.moveTo(xPartL, zToY(0));
        ctx.lineTo(xPartR, zToY(zRight));
        ctx.lineTo(xPartR, yBottomPx);
        ctx.lineTo(xPartL, yBottomPx);
    } else {
        ctx.rect(xPartL, yPartTop, xPartR - xPartL, yBottomPx - yPartTop);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Recortes internos suaves na seção (Cavidade, Furo Central e Furos/Contrafuros)
    const carveRect = (x0, x1, zTop, zBot) => {
        const px0 = xToPx(x0), px1 = xToPx(x1);
        const py0 = zToY(zTop), py1 = zToY(zBot);
        ctx.fillStyle = zBot <= model.zBottom + 0.4 ? SIM_COLORS.holeAbyss : '#162838';
        ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
        ctx.strokeStyle = '#6FD3E0';
        ctx.lineWidth = 1.1;
        ctx.strokeRect(px0, py0, px1 - px0, py1 - py0);
    };

    if (csg.pocket && csg.pocket.z < -0.2) {
        carveRect(csg.pocket.x0, csg.pocket.x1, 0, csg.pocket.z);
    }
    if (csg.centerBore && csg.centerBore.z < -0.2) {
        carveRect(csg.centerBore.cx - csg.centerBore.r, csg.centerBore.cx + csg.centerBore.r, 0, csg.centerBore.z);
    }
    csg.holes.forEach(h => {
        h.steps.forEach(st => {
            carveRect(h.x - st.r, h.x + st.r, 0, st.z);
        });
    });

    // 4. Linhas de referência Z0 e Fundo da peça
    const yZ0 = zToY(0);
    ctx.strokeStyle = 'rgba(111, 211, 224, 0.55)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(ox - 8, yZ0); ctx.lineTo(W - 10, yZ0); ctx.stroke();
    ctx.strokeStyle = 'rgba(143, 160, 179, 0.4)';
    ctx.beginPath(); ctx.moveTo(ox - 8, yBottomPx); ctx.lineTo(W - 10, yBottomPx); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(231, 236, 242, 0.85)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText('Z0', 8, yZ0 + 3);
    ctx.fillText(fmt(model.zBottom), 4, yBottomPx + 3);

    // 5. Silhueta da ferramenta na vista frontal
    if (app.simShowTool && cur) {
        const tx = upto > 0 ? cur.x2 : cur.x1;
        const tz = Math.min(upto > 0 ? cur.z2 : cur.z1, zTopMax + 8);
        const xToolPx = xToPx(tx);
        const yToolPx = zToY(tz);
        const rPx = Math.max((cur.rTool || 5) * sX, 4);
        ctx.fillStyle = 'rgba(220, 234, 242, 0.85)';
        ctx.strokeStyle = SIM_COLORS.toolFlute;
        ctx.lineWidth = 1.5;
        ctx.fillRect(xToolPx - rPx, Math.max(4, yToolPx - 28), rPx * 2, Math.min(28, yToolPx - 4));
        ctx.strokeRect(xToolPx - rPx, Math.max(4, yToolPx - 28), rPx * 2, Math.min(28, yToolPx - 4));
    }
}

function fmtDroCoord(n) {
    const val = isFinite(n) ? n : 0;
    const sign = val >= 0 ? '+' : '-';
    const abs = Math.abs(val).toFixed(3);
    const parts = abs.split('.');
    while (parts[0].length < 3) parts[0] = '0' + parts[0];
    return sign + parts[0] + '.' + parts[1];
}

function fmtTimeMMSS(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (rem < 10 ? '0' + rem : rem);
}

function renderSimCodeAndOps(model, upto) {
    const opsBar = $('#simOpsBar');
    if (opsBar && model) {
        const curOp = (upto > 0 && model.segs[upto - 1]) ? model.segs[upto - 1].opName : '__bruto__';
        let chipsHtml = '<button type="button" class="sim-op-chip' + (upto === 0 ? ' active' : '') +
            '" data-sim-idx="0">🧱 0. Bruto intacto</button>';
        (model.ops || []).forEach((op, i) => {
            const nextStart = (model.ops[i + 1] && model.ops[i + 1].startIdx) || model.segs.length;
            const active = upto > 0 && curOp === op.name;
            chipsHtml += '<button type="button" class="sim-op-chip' + (active ? ' active' : '') +
                '" data-sim-idx="' + nextStart + '">' + (i + 1) + '. ' + op.name + '</button>';
        });
        opsBar.innerHTML = chipsHtml;
    }

    const codeList = $('#simCodeList');
    if (codeList && model) {
        if (codeList._renderedPart !== model.partId + ':' + model.segs.length) {
            codeList.innerHTML = model.segs.map((s, idx) =>
                '<button type="button" class="sim-code-item" data-sim-idx="' + (idx + 1) + '">' +
                '<span class="sci-idx">#' + (idx + 1) + '</span>' +
                '<span class="sci-txt">' + escapeHtml(s.text) + '</span>' +
                '<span class="sci-op">' + escapeHtml(s.opName) + '</span>' +
                '</button>'
            ).join('');
            codeList._renderedPart = model.partId + ':' + model.segs.length;
        }
        let activeItem = null;
        $$('.sim-code-item', codeList).forEach((el, idx) => {
            const stepNum = idx + 1;
            const isAct = stepNum === upto;
            el.classList.toggle('active', isAct);
            el.classList.toggle('done', stepNum < upto);
            if (isAct) activeItem = el;
        });
        if (activeItem && codeList.clientHeight > 0) {
            const targetTop = activeItem.offsetTop - codeList.clientHeight / 2 + activeItem.clientHeight / 2;
            codeList.scrollTop = Math.max(0, targetTop);
        }
    }
}

function renderSimulator() {
    ensureSimViewState();
    const side = $('#simInfo');
    const counter = $('#simCounter');
    const slider = $('#simSlider');
    if (!app.simModel) app.simModel = buildSimModel();
    const model = app.simModel;
    if (!model) {
        if (side) side.textContent = 'Aguardando código…';
        if (slider) { slider.max = 0; slider.disabled = true; }
        return;
    }

    const upto = Math.min(app.simIndex == null ? model.segs.length : app.simIndex, model.segs.length);
    if (upto > model.applied) {
        applyRemoval(model, model.applied, upto);
    } else if (upto < model.applied) {
        resetSimModel(model);
        applyRemoval(model, 0, upto);
    }

    renderSim3D(model);
    renderSimTop(model);
    renderSimFront(model);

    if (slider) {
        slider.disabled = false;
        slider.max = model.segs.length;
        slider.value = upto;
    }
    if (counter) counter.textContent = upto + '/' + model.segs.length + ' blocos';

    const cur = upto > 0 ? model.segs[upto - 1] : null;
    if (side) {
        if (upto === 0) {
            side.textContent = 'Bloco 0: Peça 100% em MATERIAL BRUTO (antes do início do ciclo)\nClique em ▶ Reproduzir ou avance o controle deslizante.';
        } else if (cur && cur.text) {
            side.textContent = 'Bloco ' + cur.line + ' [' + cur.opName + ']: ' + cur.text +
                '\nFerramenta T0' + cur.tool + ' (' + cur.toolDesc + ' · Ø' + ((cur.rTool || 5) * 2) + ' mm)';
        } else {
            side.textContent = '—';
        }
    }

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const cx = cur ? cur.x2 : (model.segs[0] ? model.segs[0].x1 : 0);
    const cy = cur ? cur.y2 : (model.segs[0] ? model.segs[0].y1 : 0);
    const cz = cur ? cur.z2 : (model.segs[0] ? model.segs[0].z1 : 50);
    setTxt('simDroX', fmtDroCoord(cx));
    setTxt('simDroY', fmtDroCoord(cy));
    setTxt('simDroZ', fmtDroCoord(cz));
    setTxt('simModalG', cur ? (cur.gModal + (cur.type === 'rapid' ? ' Rápido' : ' Corte')) : 'G00 Pronto');
    setTxt('simModalT', cur ? ('T0' + cur.tool + ' · Ø' + fmt((cur.rTool || 5) * 2) + ' mm') : 'T01 · —');
    setTxt('simModalSF', cur ? ('S' + cur.spindle + ' RPM · F' + cur.feed + ' · ' + cur.coolant) : 'S0 RPM · F0');

    const totalCells = model.machined.length || 1;
    const cutCells = simMachinedCount();
    const pctRem = Math.min(100, Math.round((cutCells / totalCells) * 100));
    setTxt('simRemPct', pctRem + '% da área usinada');
    const fillEl = $('#simRemFill');
    if (fillEl) fillEl.style.width = pctRem + '%';

    const curTime = cur ? cur.time : 0;
    const totTime = model.segs.length ? model.segs[model.segs.length - 1].time : 0;
    setTxt('simCycleTime', '⏱ ' + fmtTimeMMSS(curTime) + ' / ' + fmtTimeMMSS(totTime));

    const matEl = $('#simMaterial');
    if (matEl) {
        matEl.textContent = model.kind === 'turning'
            ? 'Bruto: barra Ø' + fmt(Math.round(model.stockTop * 2)) + ' × ' + fmt(Math.round(model.partLen)) + ' mm (' + pctRem + '% usinado)'
            : 'Bruto: bloco ' + fmt(Math.round(model.cols * model.cell)) + ' × ' +
              fmt(Math.round(model.rows * model.cell)) + ' × ' + fmt(Math.round(model.stockTop - model.zBottom)) + ' mm (' + pctRem + '% usinado)';
    }

    renderSimCodeAndOps(model, upto);
}

function simStep(delta) {
    const n = (app.simModel && app.simModel.segs || []).length;
    if (!n) return;
    if (app.simIndex == null) app.simIndex = delta > 0 ? 1 : n - 1;
    else app.simIndex = Math.min(Math.max(app.simIndex + delta, 0), n);
    renderSimulator();
}

function simJumpTo(idx) {
    const n = (app.simModel && app.simModel.segs || []).length;
    if (!n) return;
    app.simIndex = Math.min(Math.max(idx, 0), n);
    renderSimulator();
}

function invalidateSim() {
    app.simModel = null;
    app.simIndex = null;
    const btn = $('#simPlay');
    if (btn) btn.textContent = '▶ Reproduzir';
    if (app.simTimer) { clearInterval(app.simTimer); app.simTimer = null; }
}

function simTogglePlay() {
    const btn = $('#simPlay');
    if (app.simTimer) {
        clearInterval(app.simTimer);
        app.simTimer = null;
        if (btn) btn.textContent = '▶ Reproduzir';
        return;
    }
    const n = (app.simModel && app.simModel.segs || []).length;
    if (!n) return;
    if (app.simIndex == null || app.simIndex >= n) app.simIndex = 0;
    const speed = parseFloat(($('#simSpeed') && $('#simSpeed').value) || app.simSpeed || 1) || 1;
    const interval = Math.max(25, Math.round(130 / speed));
    app.simTimer = setInterval(() => {
        if (app.simIndex >= n) {
            simTogglePlay();
            return;
        }
        simStep(1);
    }, interval);
    if (btn) btn.textContent = '⏸ Pausar';
}

function setupSimOrbitAndControls() {
    ensureSimViewState();
    const c3d = $('#sim3d');
    if (c3d && !c3d._orbitBound) {
        c3d._orbitBound = true;
        let dragging = false, sx = 0, sy = 0;
        c3d.addEventListener('pointerdown', e => {
            dragging = true;
            sx = e.clientX; sy = e.clientY;
            if (c3d.setPointerCapture) {
                try { c3d.setPointerCapture(e.pointerId); } catch (err) {}
            }
        });
        c3d.addEventListener('pointermove', e => {
            if (!dragging) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            sx = e.clientX; sy = e.clientY;
            app.simCam.yaw += dx * 0.012;
            app.simCam.pitch = Math.min(Math.max(app.simCam.pitch + dy * 0.01, 0.22), 1.32);
            renderSimulator();
        });
        const stopDrag = () => { dragging = false; };
        c3d.addEventListener('pointerup', stopDrag);
        c3d.addEventListener('pointercancel', stopDrag);
        c3d.addEventListener('wheel', e => {
            if (!e.ctrlKey && !e.altKey) return; // deixa o scroll normal da página livre; zoom com Ctrl+Scroll ou botões ➕/➖
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.91;
            app.simCam.zoom = Math.min(Math.max(app.simCam.zoom * factor, 0.55), 2.4);
            renderSimulator();
        }, { passive: false });
    }

    const bindClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el && !el._bound) { el._bound = true; el.addEventListener('click', fn); }
    };
    bindClick('simFirst', () => { if (app.simTimer) simTogglePlay(); simJumpTo(0); });
    bindClick('simPrev', () => { if (app.simTimer) simTogglePlay(); simStep(-1); });
    bindClick('simNext', () => { if (app.simTimer) simTogglePlay(); simStep(1); });
    bindClick('simLast', () => {
        if (app.simTimer) simTogglePlay();
        const n = (app.simModel && app.simModel.segs || []).length;
        simJumpTo(n);
    });
    bindClick('simSectionCut', () => {
        app.simSectionCut = !app.simSectionCut;
        const b = $('#simSectionCut');
        if (b) {
            b.classList.toggle('active', app.simSectionCut);
            b.setAttribute('aria-pressed', app.simSectionCut ? 'true' : 'false');
        }
        renderSimulator();
    });
    bindClick('simTogglePath', () => {
        app.simShowPath = !app.simShowPath;
        const b = $('#simTogglePath');
        if (b) {
            b.classList.toggle('active', app.simShowPath);
            b.setAttribute('aria-pressed', app.simShowPath ? 'true' : 'false');
        }
        renderSimulator();
    });
    bindClick('simToggleTool', () => {
        app.simShowTool = !app.simShowTool;
        const b = $('#simToggleTool');
        if (b) {
            b.classList.toggle('active', app.simShowTool);
            b.setAttribute('aria-pressed', app.simShowTool ? 'true' : 'false');
        }
        renderSimulator();
    });
    bindClick('simZoomIn', () => {
        app.simCam.zoom = Math.min(app.simCam.zoom * 1.15, 2.4);
        renderSimulator();
    });
    bindClick('simZoomOut', () => {
        app.simCam.zoom = Math.max(app.simCam.zoom * 0.87, 0.55);
        renderSimulator();
    });
    bindClick('simResetCam', () => {
        app.simCam = { yaw: -0.68, pitch: 0.58, zoom: 1.0 };
        renderSimulator();
    });

    const speedSel = $('#simSpeed');
    if (speedSel && !speedSel._bound) {
        speedSel._bound = true;
        speedSel.addEventListener('change', e => {
            app.simSpeed = parseFloat(e.target.value) || 1;
            if (app.simTimer) {
                simTogglePlay();
                simTogglePlay();
            }
        });
    }

    const opsBar = $('#simOpsBar');
    if (opsBar && !opsBar._bound) {
        opsBar._bound = true;
        opsBar.addEventListener('click', e => {
            const btn = e.target.closest('.sim-op-chip');
            if (!btn) return;
            if (app.simTimer) simTogglePlay();
            simJumpTo(parseInt(btn.dataset.simIdx, 10) || 0);
        });
    }

    const codeList = $('#simCodeList');
    if (codeList && !codeList._bound) {
        codeList._bound = true;
        codeList.addEventListener('click', e => {
            const item = e.target.closest('.sim-code-item');
            if (!item) return;
            if (app.simTimer) simTogglePlay();
            simJumpTo(parseInt(item.dataset.simIdx, 10) || 0);
        });
    }
}

// ============================================================
// QUIZ DE TREINO
// ============================================================
function renderQuiz() {
    const list = $('#quizList');
    if (!list || typeof QUIZ === 'undefined') return;
    const filter = app.quizFilter || 'all';
    const keys = filter === 'all' ? ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'final'] : [filter];
    const totalName = id => id === 'final' ? 'Prova final' : id.toUpperCase();

    let html = '';
    keys.forEach(mid => {
        const quiz = QUIZ[mid] || [];
        html += '<div class="quiz-block"><h3 class="quiz-block-title">' + totalName(mid) +
            ' <span class="qb-count">' + quiz.length + ' questões</span></h3>';
        quiz.forEach((q, i) => {
            const qid = mid + '-' + i;
            const answered = app.quizAnswers[qid];
            html += '<div class="quiz-q' + (answered ? ' answered ' + (answered.ok ? 'ok' : 'bad') : '') + '" data-qid="' + qid + '">' +
                '<p class="qq-text">' + (i + 1) + '. ' + q.q +
                ' <span class="qq-pts">(' + q.pts.toFixed(1).replace('.', ',') + ' pt)</span></p>';
            if (q.type === 'multi') {
                html += '<div class="qq-opts">' + q.opts.map((o, oi) => {
                    const letter = String.fromCharCode(65 + oi);
                    let cls = 'qq-opt';
                    if (answered) {
                        if (letter === q.a) cls += ' correct';
                        else if (answered.pick === letter) cls += ' wrong';
                        else cls += ' dim';
                    }
                    return '<button type="button" class="' + cls + '" data-qid="' + qid + '" data-ans="' + letter + '"' +
                        (answered ? ' disabled' : '') + '>' + letter + ') ' + o + '</button>';
                }).join('') + '</div>';
                if (answered) {
                    html += '<p class="qq-feedback">' + (answered.ok ? '✅ Correto!' : '❌ Incorreto.') +
                        ' Resposta: <b>' + q.a + '</b></p>';
                }
            } else {
                html += '<div class="qq-disc">' +
                    '<button type="button" class="btn btn-sm qq-show" data-qid="' + qid + '">👁 Ver resposta-modelo</button>' +
                    '<div class="qq-model" id="model-' + qid + '" style="display:none;">' + q.a + '</div>' +
                    (answered ? '<p class="qq-feedback">' + (answered.ok ? '✅ Autoavaliação: acertou' : '📌 Autoavaliação: rever o conteúdo') + '</p>' :
                        '<div class="qq-self">' +
                        '<button type="button" class="btn btn-sm qq-mark" data-qid="' + qid + '" data-ok="1">Acertei</button>' +
                        '<button type="button" class="btn btn-sm qq-mark" data-qid="' + qid + '" data-ok="0">Errei</button>' +
                        '</div>') +
                    '</div>';
            }
            html += '</div>';
        });
        html += '</div>';
    });
    list.innerHTML = html;

    // placar
    let score = 0, total = 0;
    keys.forEach(mid => {
        (QUIZ[mid] || []).forEach((q, i) => {
            total += q.pts;
            const a = app.quizAnswers[mid + '-' + i];
            if (a && a.ok) score += q.pts;
        });
    });
    const scoreEl = $('#quizScore');
    if (scoreEl) scoreEl.textContent = score.toFixed(1).replace('.', ',') + ' / ' + total.toFixed(1).replace('.', ',') + ' pts';

    $$('#quizFilters .chip').forEach(c => c.classList.toggle('active', c.dataset.qfilter === filter));
}

function answerQuiz(qid, pick) {
    const parts = qid.split('-');
    const mid = parts[0], i = parseInt(parts[1], 10);
    const q = (QUIZ[mid] || [])[i];
    if (!q || app.quizAnswers[qid]) return;
    app.quizAnswers[qid] = { ok: pick === q.a, pick: pick };
    renderQuiz();
}

function markQuizSelf(qid, ok) {
    if (app.quizAnswers[qid]) return;
    app.quizAnswers[qid] = { ok: !!ok, pick: 'self' };
    renderQuiz();
}

// ============================================================
// CALCULADORA DE PARÂMETROS DE CORTE
// ============================================================
const CUT_MATERIALS = {
    'aco1020': { name: 'Aço SAE 1020', vc: 160 },
    'inox': { name: 'Aço inox', vc: 100 },
    'aluminio': { name: 'Alumínio', vc: 400 },
    'fundido': { name: 'Ferro fundido', vc: 120 },
    'bronze': { name: 'Bronze/Latão', vc: 200 }
};

function updateCalc() {
    const mat = CUT_MATERIALS[$('#calcMat') ? $('#calcMat').value : 'aco1020'] || CUT_MATERIALS.aco1020;
    const hard = $('#calcTool') ? $('#calcTool').value : 'carbide';
    const vc = (parseFloat($('#calcVc') && $('#calcVc').value) || mat.vc) * (hard === 'hss' ? 0.45 : 1);
    const D = Math.max(parseFloat($('#calcD') && $('#calcD').value) || 10, 0.1);
    const op = $('#calcOp') ? $('#calcOp').value : 'milling';

    // mostra só os campos da operação escolhida
    $$('#calcForm .calc-milling').forEach(el => { el.style.display = op === 'milling' ? '' : 'none'; });
    $$('#calcForm .calc-turning').forEach(el => { el.style.display = op === 'turning' ? '' : 'none'; });

    const n = Math.round(vc * 1000 / (Math.PI * D));
    let vf = 0, q = 0, extra = '';
    if (op === 'milling') {
        const z = Math.max(parseFloat($('#calcZ') && $('#calcZ').value) || 4, 1);
        const fz = Math.max(parseFloat($('#calcFz') && $('#calcFz').value) || 0.05, 0.001);
        const ap = Math.max(parseFloat($('#calcAp') && $('#calcAp').value) || 2, 0.1);
        const ae = Math.max(parseFloat($('#calcAe') && $('#calcAe').value) || 10, 0.1);
        vf = fz * z * n;
        q = ap * ae * vf / 1000;
        extra = 'fz = ' + fz + ' mm/dente · z = ' + z + ' dentes';
    } else {
        const f = Math.max(parseFloat($('#calcF') && $('#calcF').value) || 0.2, 0.01);
        const ap = Math.max(parseFloat($('#calcAp') && $('#calcAp').value) || 1, 0.1);
        vf = f * n;
        q = ap * f * vf / 1000;
        extra = 'f = ' + f + ' mm/rev';
    }

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('calcVcOut', Math.round(vc) + ' m/min');
    set('calcN', n.toLocaleString('pt-BR') + ' rpm');
    set('calcVf', Math.round(vf).toLocaleString('pt-BR') + ' mm/min');
    set('calcQ', q.toFixed(1).replace('.', ',') + ' cm³/min');
    set('calcExtra', extra);
    const warn = $('#calcWarn');
    if (warn) {
        warn.textContent = n > 10000 ? '⚠️ Rotação acima do típico para centros de usinagem (10.000 rpm) — confira o limite da sua máquina.' : '';
    }
}

function copyCalc() {
    const txt = 'Parâmetros de corte COTA\n' +
        'S = ' + $('#calcN').textContent + ' | F = ' + $('#calcVf').textContent + '\n' +
        'vc = ' + $('#calcVcOut').textContent + ' | Q = ' + $('#calcQ').textContent + '\n' +
        $('#calcExtra').textContent;
    fallbackCopy(txt, () => showToast('📋 Parâmetros copiados'));
}

// ============================================================
// TABELAS DE APOIO
// ============================================================
function renderTables() {
    const box = $('#tablesContent');
    if (!box) return;

    const gCodes = [
        ['G00', 'Posicionamento rápido', 'G00 X50. Y30.'],
        ['G01', 'Interpolação linear (corte)', 'G01 X100. F250.'],
        ['G02', 'Arco horário (CW)', 'G02 X20. I10. J0.'],
        ['G03', 'Arco anti-horário (CCW)', 'G03 X20. I10. J0.'],
        ['G17', 'Plano de interpolação XY', 'G17'],
        ['G21', 'Programação em milímetros', 'G21'],
        ['G28', 'Retorno à referência', 'G91 G28 Z0.'],
        ['G40', 'Cancela compensação de raio', 'G40'],
        ['G43', 'Compensação de comprimento (+)', 'G43 Z50. H01'],
        ['G54', 'Sistema de coordenadas da peça', 'G54'],
        ['G70', 'Ciclo de acabamento (torno)', 'G70 P100 Q200'],
        ['G71', 'Ciclo de desbaste (torno)', 'G71 U1.5 R0.5'],
        ['G74', 'Furação com retorno de lascas', 'G74 X0. Z-40. Q4000'],
        ['G76', 'Ciclo de rosqueamento', 'G76 X18.4 Z-40. P920 Q200 F1.5'],
        ['G80', 'Cancela ciclos fixos', 'G80'],
        ['G81', 'Furação simples', 'G81 X10. Y0. Z-20. R2. F140.'],
        ['G82', 'Furação com demora (fund0 liso)', 'G82 X10. Z-6. R2. P500 F100.'],
        ['G83', 'Furação com lascamento (profundo)', 'G83 X10. Z-30. R2. Q4. F120.'],
        ['G90', 'Programação absoluta', 'G90'],
        ['G94', 'Avanço em mm/min', 'G94']
    ];
    const mCodes = [
        ['M00', 'Parada programada (aguarda operador)'],
        ['M03', 'Spindle horário'],
        ['M05', 'Spindle parado'],
        ['M06', 'Troca de ferramenta'],
        ['M08', 'Refrigerante ligado'],
        ['M09', 'Refrigerante desligado'],
        ['M30', 'Fim de programa (rebobina)'],
        ['M98', 'Chama subprograma'],
        ['M99', 'Retorna do subprograma']
    ];
    // rosca métrica: broca = Ønom − passo | Ø menor = Ønom − 1,0825 × passo
    const threads = [
        ['M6×1', 6, 1], ['M8×1,25', 8, 1.25], ['M10×1,5', 10, 1.5],
        ['M12×1,75', 12, 1.75], ['M14×2', 14, 2], ['M16×2', 16, 2],
        ['M20×1,5', 20, 1.5], ['M20×2,5', 20, 2.5], ['M24×3', 24, 3]
    ];
    const iso = [
        ['0,5 a 3', '±0,05', '±0,1'],
        ['3 a 6', '±0,05', '±0,1'],
        ['6 a 30', '±0,1', '±0,2'],
        ['30 a 120', '±0,15', '±0,3'],
        ['120 a 400', '±0,2', '±0,5'],
        ['400 a 1000', '±0,3', '±0,8']
    ];

    box.innerHTML =
        '<div class="tables-grid">' +
        '<div class="table-card"><h3 class="table-title">⚙️ Códigos G — uso comum</h3>' +
        '<table class="ref-table"><thead><tr><th>Cód.</th><th>Função</th><th>Exemplo</th></tr></thead><tbody>' +
        gCodes.map(r => '<tr><td class="rt-code">' + r[0] + '</td><td>' + r[1] + '</td><td class="rt-ex">' + r[2] + '</td></tr>').join('') +
        '</tbody></table></div>' +

        '<div class="table-card"><h3 class="table-title">🔧 Códigos M — uso comum</h3>' +
        '<table class="ref-table"><thead><tr><th>Cód.</th><th>Função</th></tr></thead><tbody>' +
        mCodes.map(r => '<tr><td class="rt-code">' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') +
        '</tbody></table></div>' +

        '<div class="table-card"><h3 class="table-title">🔩 Roscas métricas — broca e Ø menor</h3>' +
        '<table class="ref-table"><thead><tr><th>Rosca</th><th>Broca (Ø menor)</th><th>Ø menor do filete</th></tr></thead><tbody>' +
        threads.map(r => '<tr><td class="rt-code">' + r[0] + '</td><td>Ø' + (r[1] - r[2]).toFixed(1).replace('.', ',') +
            ' mm</td><td>Ø' + (r[1] - 1.0825 * r[2]).toFixed(2).replace('.', ',') + ' mm</td></tr>').join('') +
        '</tbody></table>' +
        '<p class="table-note">Broca ≈ Ønominal − passo · Ømenor ≈ Ønominal − 1,0825 × passo</p></div>' +

        '<div class="table-card"><h3 class="table-title">📏 Tolerâncias gerais ISO 2768</h3>' +
        '<table class="ref-table"><thead><tr><th>Faixa nominal (mm)</th><th>f (± mm)</th><th>m (± mm)</th></tr></thead><tbody>' +
        iso.map(r => '<tr><td class="rt-code">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') +
        '</tbody></table>' +
        '<p class="table-note">m = tolerância média (comum em desenhos) · f = fina</p></div>' +
        '</div>';
}

function printTabelas() {
    $('#printFichaMeta') && ($('#printFichaMeta').textContent = 'Tabelas de apoio · ' + todayBR());
    document.body.classList.add('print-tabelas');
    window.print();
    setTimeout(() => document.body.classList.remove('print-tabelas'), 500);
}

// ============================================================
// FICHA DE SETUP POR PEÇA
// ============================================================
function extractSetupInfo(code) {
    const tools = [];
    const ops = [];
    let m;
    const reTool = /\(T(\d+)\s*-\s*([^)]+)\)/g;
    while ((m = reTool.exec(code)) !== null) {
        tools.push({ id: 'T' + m[1], desc: m[2].trim() });
    }
    const reOp = /\(===\s*([^=]+?)\s*===\)/g;
    while ((m = reOp.exec(code)) !== null) {
        ops.push(m[1].trim());
    }
    return { tools: tools, ops: ops };
}

function buildFichaSetup() {
    const part = currentPart();
    const fState = getFeatureState();
    const d = part.dimsFromState(fState);
    const info = extractSetupInfo(part.gcode(d, fState));

    const toolRows = (info.tools.length ? info.tools : [{ id: 'T01', desc: '—' }]).map(t =>
        '<tr><td class="center rt-code">' + t.id + '</td><td>' + t.desc + '</td>' +
        '<td class="fill-cell"></td><td class="fill-cell"></td><td class="fill-cell"></td></tr>'
    ).join('');
    const opRows = (info.ops.length ? info.ops : ['—']).map((o, i) =>
        '<tr><td class="center">' + (i + 1) + '</td><td>' + o + '</td><td class="fill-cell"></td><td class="center fill-cell"></td></tr>'
    ).join('');

    return '<div class="ficha" data-ficha="setup">' +
        fichaHead('FIC-SETUP', 'Ficha de Setup de Usinagem', part.tag + ' · REV.' + part.rev + ' · ' + part.machine) +
        '<div class="ficha-fields">' +
        '<span class="fi">Operador: ' + fillLine('m') + '</span>' +
        '<span class="fi">Máquina: ' + fillLine('m') + '</span>' +
        '<span class="fi">Data: ' + fillLine('s') + '</span>' +
        '<span class="fi">Fixação (morsa/garra): ' + fillLine('m') + '</span>' +
        '<span class="fi">Zero-peça (G54): X ' + fillLine('s') + ' Y ' + fillLine('s') + ' Z ' + fillLine('s') + '</span>' +
        '<span class="fi">Material/Estoque: ' + fillLine('m') + '</span>' +
        '</div>' +
        '<h4 class="ficha-h">Tabela de ferramentas</h4>' +
        '<table class="ficha-table"><thead><tr><th>T</th><th>Descrição (do programa)</th><th>Comp.</th><th>Raio</th><th>Desloc.</th></tr></thead>' +
        '<tbody>' + toolRows + '</tbody></table>' +
        '<h4 class="ficha-h">Sequência de operações</h4>' +
        '<table class="ficha-table"><thead><tr><th>Nº</th><th>Operação</th><th>Observações</th><th>OK</th></tr></thead>' +
        '<tbody>' + opRows + '</tbody></table>' +
        '<h4 class="ficha-h">Checklist de primeiro ciclo</h4>' +
        '<ul class="aula-checklist">' +
        '<li>Programa simulado (Single Block + Dry Run) sem alarmes</li>' +
        '<li>Zero-peça conferido com indicador/apalpador</li>' +
        '<li>Ferramentas e deslocamentos conferidos (H/D)</li>' +
        '<li>Fixação apertada e peça sem folga</li>' +
        '<li>Refrigerante e velocidade verificados</li>' +
        '<li>Primeira peça medida antes do lote</li>' +
        '</ul>' +
        '<div class="ficha-result">' +
        '<span>Peça OK: □ Sim&nbsp;&nbsp;□ Não</span>' +
        '<span class="big">Liberação: □ APROVADO&nbsp;&nbsp;□ REPROVADO</span>' +
        '</div>' +
        '<div class="ficha-obs">Ajustes / deslocamentos de correção (wear): ' + fillLine('xl') + '<br>' + fillLine('xl') + '</div>' +
        fichaSigns(['Operador', 'Preparador', 'Supervisor']) +
        '</div>';
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

    const detectNote = $('#detectNote');
    if (detectNote) {
        const part = currentPart();
        detectNote.textContent = (opts.detectNote ? opts.detectNote + ' → ' : 'Exemplo selecionado → ') +
            part.name.toUpperCase() + ' · ' + part.process;
    }

    $('#planSection').classList.remove('show');
    $('#drawingSheetSection').classList.remove('show');
    $('#codeSection').classList.remove('show');
    $('#softHead').style.display = 'none';
    $('#softGrid').style.display = 'none';

    resetScene();
    refreshSheet();

    if (!opts.silent) {
        setTimeout(() => scrollToSection('detectSection'), 150);
        showToast('📄 "' + fileName + '" carregado — ' + currentPart().name +
            ' (' + currentPart().features.length + ' features sugeridas)');
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

    // Kit de fichas: visualizar, imprimir
    const fichaGrid = $('#fichaGrid');
    if (fichaGrid) {
        fichaGrid.addEventListener('click', e => {
            const view = e.target.closest('.ficha-view');
            if (view) {
                showFichaPreview(view.dataset.ficha);
                return;
            }
            const pr = e.target.closest('.ficha-print');
            if (pr) printFichaById(pr.dataset.ficha);
        });
    }
    const btnPrintKit = $('#btnPrintFichaKit');
    if (btnPrintKit) btnPrintKit.addEventListener('click', printFichaKit);
    const btnPrintCurrent = $('#btnPrintCurrentFicha');
    if (btnPrintCurrent) btnPrintCurrent.addEventListener('click', printSingleFicha);
    const btnClosePreview = $('#btnCloseFichaPreview');
    if (btnClosePreview) btnClosePreview.addEventListener('click', closeFichaPreview);

    // Simulador de percurso
    const simPlay = $('#simPlay');
    if (simPlay) simPlay.addEventListener('click', simTogglePlay);
    const simSlider = $('#simSlider');
    if (simSlider) simSlider.addEventListener('input', e => {
        app.simIndex = parseInt(e.target.value, 10) || 0;
        renderSimulator();
    });
    const simReset = $('#simReset');
    if (simReset) simReset.addEventListener('click', () => {
        if (app.simTimer) simTogglePlay();
        app.simIndex = null;
        renderSimulator();
    });

    // Quiz de treino
    const quizList = $('#quizList');
    if (quizList) {
        quizList.addEventListener('click', e => {
            const opt = e.target.closest('.qq-opt');
            if (opt) {
                answerQuiz(opt.dataset.qid, opt.dataset.ans);
                return;
            }
            const show = e.target.closest('.qq-show');
            if (show) {
                const model = document.getElementById('model-' + show.dataset.qid);
                if (model) {
                    const vis = model.style.display !== 'none';
                    model.style.display = vis ? 'none' : 'block';
                    show.textContent = vis ? '👁 Ver resposta-modelo' : '🙈 Ocultar resposta';
                }
                return;
            }
            const mark = e.target.closest('.qq-mark');
            if (mark) markQuizSelf(mark.dataset.qid, mark.dataset.ok === '1');
        });
    }
    const quizFilters = $('#quizFilters');
    if (quizFilters) quizFilters.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        app.quizFilter = chip.dataset.qfilter;
        renderQuiz();
    });
    const quizReset = $('#quizReset');
    if (quizReset) quizReset.addEventListener('click', () => {
        app.quizAnswers = {};
        renderQuiz();
        showToast('🔄 Quiz reiniciado');
    });

    // Calculadora de corte
    const calcForm = $('#calcForm');
    if (calcForm) {
        calcForm.addEventListener('input', updateCalc);
        calcForm.addEventListener('change', updateCalc);
    }
    const calcCopy = $('#calcCopy');
    if (calcCopy) calcCopy.addEventListener('click', copyCalc);

    // Tabelas de apoio
    const printTabs = $('#btnPrintTabelas');
    if (printTabs) printTabs.addEventListener('click', printTabelas);

    // Upload (com detecção do exemplo: nome + geometria DXF)
    $('#btnDemo').addEventListener('click', () => revealApp(PARTS[DEFAULT_PART_ID].exampleFile, { partId: DEFAULT_PART_ID }));
    $('#btnBrowse').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', e => {
        if (e.target.files[0]) handleUploadFile(e.target.files[0]);
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
        if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]);
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
// MANIFEST PWA (só em http/https — file:// bloqueia com CORS)
// ============================================================
function setupManifest() {
    if (typeof location !== 'undefined' && location.protocol === 'file:') return;
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.json';
    document.head.appendChild(link);
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
function init() {
    setupManifest();
    app.quizFilter = 'all';
    app.quizAnswers = {};
    app.simIndex = null;
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
    renderFichaGrid();
    initCertForm();
    renderQuiz();
    renderTables();
    updateCalc();
    setupSimOrbitAndControls();
    renderSimulator();
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

    console.log('🚀 COTA v6.2.0 — CAD + CNC Assistant carregado!');
    console.log('⚙️ ' + Object.keys(PARTS).length + ' situações de usinagem com código ISO e paramétrico.');
    console.log('🎯 Simulador de percurso, quiz de treino, calculadora de corte e tabelas prontos.');
    console.log('🎯 Escolha um exemplo na galeria para começar!');
}

document.addEventListener('DOMContentLoaded', init);
