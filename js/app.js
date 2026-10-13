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
// SIMULADOR DE PERCURSO (G-code) — Passo 5
// ============================================================
// Interpreta o código ISO gerado e desenha o caminho da ferramenta
function parseToolpath(code) {
    const segs = [];
    let x = 0, y = 0, z = 0;
    let motion = 'rapid'; // G00
    String(code).split('\n').forEach((raw, idx) => {
        const line = String(raw).split('(')[0]; // remove comentários
        if (!line.trim()) return;
        const words = {};
        line.replace(/([A-Z])\s*(-?\d+\.?\d*)/g, (m, c, v) => {
            words[c] = parseFloat(v);
            return m;
        });
        if (words.G !== undefined) {
            const g = words.G;
            if (g === 0 || g === 80) motion = 'rapid';
            else if (g === 1) motion = 'feed';
            else if (g === 2) motion = 'arc-cw';
            else if (g === 3) motion = 'arc-ccw';
        }
        const isCanned = /G8[123]/.test(line);
        const hasXY = words.X !== undefined || words.Y !== undefined;
        const nx = words.X !== undefined ? words.X : x;
        const ny = words.Y !== undefined ? words.Y : y;
        const nz = words.Z !== undefined ? words.Z : z;

        const push = (x1, y1, z1, x2, y2, z2, type) => {
            if (x1 === x2 && y1 === y2 && z1 === z2) return;
            segs.push({
                x1: x1, y1: y1, z1: z1, x2: x2, y2: y2, z2: z2,
                type: type, i: words.I, j: words.J,
                text: String(raw).trim(), line: idx + 1
            });
        };

        if (isCanned && hasXY && words.Z !== undefined) {
            // ciclo fixo: aproxima em XY (rápido) e mergulha em Z (corte)
            push(x, y, z, nx, ny, z, 'rapid');
            push(nx, ny, z, nx, ny, nz, 'feed');
        } else if (motion.indexOf('arc') === 0) {
            push(x, y, z, nx, ny, nz, motion);
        } else {
            push(x, y, z, nx, ny, nz, motion);
        }
        x = nx; y = ny; z = nz;
    });
    return { segs: segs };
}

function sampleArc(seg) {
    const cx = seg.x1 + (seg.i || 0);
    const cy = seg.y1 + (seg.j || 0);
    const r = Math.hypot(seg.x1 - cx, seg.y1 - cy);
    const a0 = Math.atan2(seg.y1 - cy, seg.x1 - cx);
    const a1 = Math.atan2(seg.y2 - cy, seg.x2 - cx);
    let da = a1 - a0;
    if (seg.type === 'arc-cw') {
        while (da > 0) da -= 2 * Math.PI;
        if (Math.abs(da) < 1e-6) da = -2 * Math.PI;
    } else {
        while (da < 0) da += 2 * Math.PI;
        if (Math.abs(da) < 1e-6) da = 2 * Math.PI;
    }
    const pts = [];
    const steps = Math.max(10, Math.ceil(Math.abs(da) / (Math.PI / 18)));
    for (let k = 0; k <= steps; k++) {
        const a = a0 + da * k / steps;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
}

function renderSimulator() {
    const box = $('#simPlot');
    if (!box) return;
    const part = currentPart();
    const turning = !!part.isTurning;
    let segs = [];
    try {
        segs = parseToolpath(part.gcode(getDims(), getFeatureState())).segs;
    } catch (e) { segs = []; }
    app.simSegs = segs;
    app.simTurning = turning;

    const info = $('#simInfo');
    if (!segs.length) {
        box.innerHTML = '<p class="sim-empty">🎯 Gere o roteiro no Passo 3 para visualizar o percurso da ferramenta.</p>';
        if (info) info.textContent = 'Aguardando código…';
        const sl = $('#simSlider');
        if (sl) { sl.max = 0; sl.value = 0; sl.disabled = true; }
        return;
    }

    // mapeia eixos: fresamento = X×Y (vista superior) | torno = Z×X (perfil)
    const uv = s => ({
        u1: turning ? s.z1 : s.x1, v1: turning ? s.x1 : s.y1,
        u2: turning ? s.z2 : s.x2, v2: turning ? s.x2 : s.y2
    });
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    segs.forEach(s => {
        const p = uv(s);
        [p.u1, p.u2].forEach(u => { uMin = Math.min(uMin, u); uMax = Math.max(uMax, u); });
        [p.v1, p.v2].forEach(v => { vMin = Math.min(vMin, v); vMax = Math.max(vMax, v); });
    });
    const pad = Math.max((uMax - uMin) * 0.08, 5);
    const W = 640, H = 420;
    const sc = Math.min((W - 40) / Math.max(uMax - uMin + 2 * pad, 1), (H - 40) / Math.max(vMax - vMin + 2 * pad, 1));
    const px = u => 20 + (u - uMin + pad) * sc;
    const py = v => H - 20 - (v - vMin + pad) * sc;

    const upto = Math.min(app.simIndex == null ? segs.length : app.simIndex, segs.length);
    const drawSeg = (s, done) => {
        const p = uv(s);
        const cls = done ? (s.type === 'rapid' ? 'tp-rapid' : 'tp-feed') : 'tp-future';
        if (s.type.indexOf('arc') === 0) {
            const pts = sampleArc(s).map(pt => {
                const u = turning ? pt[1] : pt[0];
                const v = turning ? pt[0] : pt[1];
                return px(u) + ',' + py(v);
            }).join(' ');
            return '<polyline points="' + pts + '" class="' + cls + '"/>';
        }
        return '<line x1="' + px(p.u1) + '" y1="' + py(p.v1) + '" x2="' + px(p.u2) + '" y2="' + py(p.v2) + '" class="' + cls + '"/>';
    };

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="tp-svg">' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0E1621"/>';
    segs.forEach((s, i) => { svg += drawSeg(s, i < upto); });
    // marcadores início/fim/posição atual
    const p0 = uv(segs[0]);
    svg += '<circle cx="' + px(p0.u1) + '" cy="' + py(p0.v1) + '" r="5" class="tp-start"/>';
    const last = segs[Math.max(upto - 1, 0)];
    const pl = uv(last);
    svg += '<circle cx="' + px(pl.u2) + '" cy="' + py(pl.v2) + '" r="7" class="tp-tool"/>';
    svg += '<text x="12" y="20" class="tp-label">' +
        (turning ? 'PERFIL (Z × X — diâmetro)' : 'VISTA SUPERIOR (X × Y)') + '</text>';
    svg += '</svg>';
    box.innerHTML = svg;

    const sl = $('#simSlider');
    if (sl) {
        sl.disabled = false;
        sl.max = segs.length;
        if (app.simIndex == null) sl.value = segs.length;
    }
    const counter = $('#simCounter');
    if (counter) counter.textContent = upto + '/' + segs.length + ' blocos';
    if (info) {
        info.textContent = last && last.text ? ('Bloco ' + last.line + ': ' + last.text) : '—';
    }
}

function simStep(delta) {
    const n = (app.simSegs || []).length;
    if (!n) return;
    if (app.simIndex == null) app.simIndex = delta > 0 ? 1 : n - 1;
    else app.simIndex = Math.min(Math.max(app.simIndex + delta, 0), n);
    renderSimulator();
}

function simTogglePlay() {
    const btn = $('#simPlay');
    if (app.simTimer) {
        clearInterval(app.simTimer);
        app.simTimer = null;
        if (btn) btn.textContent = '▶ Reproduzir';
        return;
    }
    const n = (app.simSegs || []).length;
    if (!n) return;
    if (app.simIndex == null || app.simIndex >= n) app.simIndex = 1;
    app.simTimer = setInterval(() => {
        if (app.simIndex >= n) {
            simTogglePlay();
            return;
        }
        simStep(1);
    }, 160);
    if (btn) btn.textContent = '⏸ Pausar';
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

    console.log('🚀 COTA v5.8.0 — CAD + CNC Assistant carregado!');
    console.log('⚙️ ' + Object.keys(PARTS).length + ' situações de usinagem com código ISO e paramétrico.');
    console.log('🎯 Simulador de percurso, quiz de treino, calculadora de corte e tabelas prontos.');
    console.log('🎯 Escolha um exemplo na galeria para começar!');
}

document.addEventListener('DOMContentLoaded', init);
