'use strict';

/* ============================================================
   COTA — do desenho à peça pronta (v4.1)
   Assistente de CAD: desenho técnico → roteiro de modelagem
   ============================================================ */

// ============================================================
// DADOS
// ============================================================
const COMMANDS_BY_SOFT = {
    solidworks: {
        base_sketch: 'Sketch → plano Top → Rectangle',
        base_extrude: 'Features → Extruded Boss/Base',
        wall_sketch: 'Sketch → face traseira → Rectangle',
        wall_extrude: 'Features → Extruded Boss/Base',
        hole_base: 'Features → Hole Wizard → Passante',
        hole_wall: 'Features → Hole Wizard → Passante',
        chamfer: 'Features → Chamfer → Distância-Ângulo'
    },
    fusion: {
        base_sketch: 'Design → Create Sketch (plano Top) → Rectangle',
        base_extrude: 'Design → Create → Extrude',
        wall_sketch: 'Design → Create Sketch (face traseira) → Rectangle',
        wall_extrude: 'Design → Create → Extrude',
        hole_base: 'Design → Create → Hole (Passante)',
        hole_wall: 'Design → Create → Hole (Passante)',
        chamfer: 'Design → Modify → Chamfer'
    },
    inventor: {
        base_sketch: '3D Model → Start 2D Sketch → plano XY → Rectangle',
        base_extrude: '3D Model → Extrude',
        wall_sketch: '3D Model → Start 2D Sketch → face traseira → Rectangle',
        wall_extrude: '3D Model → Extrude',
        hole_base: '3D Model → Hole (Passante)',
        hole_wall: '3D Model → Hole (Passante)',
        chamfer: '3D Model → Modify → Chamfer'
    }
};

const SOFT_NAMES = {
    solidworks: 'SolidWorks',
    fusion: 'Fusion 360',
    inventor: 'Inventor'
};

const FEATURE_DEFS = [{
    id: 'base',
    name: 'Base retangular',
    hint: 'Sketch + extrusão da placa base',
    included: true,
    params: [
        { key: 'largura', label: 'largura', unit: 'mm', value: 160 },
        { key: 'comprimento', label: 'comp.', unit: 'mm', value: 160 },
        { key: 'espessura', label: 'esp.', unit: 'mm', value: 22 }
    ]
}, {
    id: 'wall',
    name: 'Parede vertical',
    hint: 'Sketch + extrusão na face traseira',
    included: true,
    params: [
        { key: 'largura', label: 'largura', unit: 'mm', value: 160 },
        { key: 'altura', label: 'altura', unit: 'mm', value: 100 },
        { key: 'espessura', label: 'esp.', unit: 'mm', value: 18 }
    ]
}, {
    id: 'hole_base',
    name: 'Furo na base',
    hint: 'Furo passante central',
    included: true,
    params: [
        { key: 'diametro', label: 'diâm.', unit: 'mm', value: 26 }
    ]
}, {
    id: 'hole_wall',
    name: 'Furo na parede',
    hint: 'Furo passante na parede vertical',
    included: true,
    params: [
        { key: 'diametro', label: 'diâm.', unit: 'mm', value: 20 }
    ]
}, {
    id: 'chamfer',
    name: 'Chanfro nas arestas',
    hint: 'Arestas superiores frontais da base',
    included: true,
    params: [
        { key: 'tamanho', label: 'tam.', unit: 'mm', value: 3 },
        { key: 'angulo', label: 'ângulo', unit: '°', value: 45 }
    ]
}];

// Mapa passo → elementos 3D da cena principal que se montam ao concluir
const SCENE_PARTS = {
    base_extrude: ['box-base'],
    wall_extrude: ['box-wall'],
    hole_base: ['hole-base'],
    hole_wall: ['hole-wall'],
    chamfer: ['cm1', 'cm2']
};

// Material de referência para o cálculo de massa
const MATERIAL = { name: 'Aço SAE 1020', density: 7.85 }; // g/cm³

const STORAGE_THEME = 'cota-theme';
const STORAGE_SESSION = 'cota-session';

// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================
const app = {
    theme: 'dark',
    soft: 'solidworks',
    steps: [],
    doneIds: new Set(),
    revealed: false,
    confirmed: false,
    fileName: ''
};

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

function fmt(n) {
    return String(Math.round(n * 100) / 100);
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

    // Regenerar folha com as cores do novo tema
    if (app.steps.length > 0) {
        refreshSheet();
    }
}

// ============================================================
// PERSISTÊNCIA DE SESSÃO
// ============================================================
function saveSession() {
    const features = getFeatureState();
    const compact = {};
    Object.keys(features).forEach(id => {
        compact[id] = {
            included: features[id].included,
            params: features[id].params
        };
    });
    localStorage.setItem(STORAGE_SESSION, JSON.stringify({
        soft: app.soft,
        revealed: app.revealed,
        confirmed: app.confirmed,
        fileName: app.fileName,
        doneIds: Array.from(app.doneIds),
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
// FEATURES (Passo 1)
// ============================================================
function renderFeatures() {
    const grid = $('#featureGrid');
    FEATURE_DEFS.forEach(f => {
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

    grid.addEventListener('change', onFeatureChange);
    grid.addEventListener('input', onFeatureChange);
}

function onFeatureChange(e) {
    const isCheck = e.target.classList.contains('feature-check');
    if (isCheck) {
        const fid = e.target.dataset.feature;
        const row = $('#frow-' + fid);
        row.classList.toggle('excluded', !e.target.checked);
        $$('#frow-' + fid + ' .param input').forEach(inp => {
            inp.disabled = !e.target.checked;
        });
    }

    // Atualizações ao vivo: folha sempre; roteiro preserva o progresso
    refreshSheet();
    if (app.confirmed) {
        refreshPlan();
    }
    saveSession();
}

function getFeatureState() {
    const state = {};
    FEATURE_DEFS.forEach(f => {
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
    FEATURE_DEFS.forEach(f => {
        const rec = saved[f.id];
        if (!rec) return;
        const checked = $('.feature-check[data-feature="' + f.id + '"]');
        if (checked) {
            checked.checked = rec.included !== false;
            $('#frow-' + f.id).classList.toggle('excluded', !checked.checked);
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

function getDimsFromState(fState) {
    const b = fState.base.params;
    const w = fState.wall.params;
    return {
        largura: parseNum(b.largura, 160, 0.1, 2000),
        comprimento: parseNum(b.comprimento, 160, 0.1, 2000),
        espessura: parseNum(b.espessura, 22, 0.1, 2000),
        larguraParede: parseNum(w.largura, 160, 0.1, 2000),
        altura: parseNum(w.altura, 100, 0.1, 2000),
        espessuraParede: parseNum(w.espessura, 18, 0.1, 2000),
        diamFuroBase: parseNum(fState.hole_base.params.diametro, 26, 0.1, 2000),
        diamFuroParede: parseNum(fState.hole_wall.params.diametro, 20, 0.1, 2000),
        chanfro: parseNum(fState.chamfer.params.tamanho, 3, 0.1, 2000),
        chanfroAng: parseNum(fState.chamfer.params.angulo, 45, 1, 89)
    };
}

// ============================================================
// ROTEIRO DE MODELAGEM (Passo 3)
// ============================================================
function buildStepDefs(fState) {
    const defs = [];
    const b = fState.base.params;
    const dims = getDimsFromState(fState);

    defs.push({
        id: 'base_sketch',
        title: 'Esboçar a Base',
        badge: 'SKETCH',
        desc: 'Crie um novo sketch no plano superior (Top/XY). Utilize a ferramenta Rectangle para desenhar o contorno da base com as dimensões de ' +
            fmt(dims.largura) + 'mm × ' + fmt(dims.comprimento) + 'mm.',
        tip: 'Utilize o comando "Smart Dimension" para adicionar as medidas. Mantenha o sketch totalmente definido.'
    });

    defs.push({
        id: 'base_extrude',
        title: 'Extrudar a Base',
        badge: 'EXTRUDE',
        desc: 'Selecione o sketch da base e aplique a extrusão. Defina a profundidade para ' + fmt(dims.espessura) + 'mm.',
        tip: 'Verifique se a extrusão está com a direção correta (para cima).'
    });

    if (fState.wall.included) {
        defs.push({
            id: 'wall_sketch',
            title: 'Esboçar a Parede Vertical',
            badge: 'SKETCH',
            desc: 'Selecione a face traseira da base e crie um novo sketch. Desenhe o perfil retangular com ' +
                fmt(dims.larguraParede) + 'mm × ' + fmt(dims.altura) + 'mm.',
            tip: 'Use "Project Geometry" para referenciar as bordas da base e garantir alinhamento.'
        });

        defs.push({
            id: 'wall_extrude',
            title: 'Extrudar a Parede Vertical',
            badge: 'EXTRUDE',
            desc: 'Selecione o sketch da parede e aplique a extrusão com espessura de ' + fmt(dims.espessuraParede) + 'mm.',
            tip: 'Use a opção "From" para garantir que comece exatamente na face da base.'
        });
    }

    if (fState.hole_base.included) {
        defs.push({
            id: 'hole_base',
            title: 'Furo Passante na Base',
            badge: 'HOLE',
            desc: 'Crie um furo passante no centro da base com diâmetro de ' + fmt(dims.diamFuroBase) + 'mm.',
            tip: 'Posicione o furo centralizado usando cotas de referência.'
        });
    }

    if (fState.hole_wall.included && fState.wall.included) {
        defs.push({
            id: 'hole_wall',
            title: 'Furo Passante na Parede',
            badge: 'HOLE',
            desc: 'Adicione um furo passante na parede vertical com diâmetro de ' + fmt(dims.diamFuroParede) + 'mm.',
            tip: 'Use a face da parede como referência para o sketch do furo.'
        });
    }

    if (fState.chamfer.included) {
        defs.push({
            id: 'chamfer',
            title: 'Aplicar Chanfro nas Arestas',
            badge: 'CHAMFER',
            desc: 'Selecione as arestas superiores frontais da base e aplique chanfro de ' +
                fmt(dims.chanfro) + 'mm × ' + fmt(dims.chanfroAng) + '°.',
            tip: 'Use a opção "Distance-Angle" para definir o chanfro.'
        });
    }

    return defs;
}

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

        el.innerHTML =
            '<div class="step-num">' + (i + 1) + '</div>' +
            '<div>' +
            '<div class="step-header">' +
            '<p class="step-title">' + s.title + '</p>' +
            '<span class="step-badge">' + (s.badge || 'PASSO') + '</span>' +
            '</div>' +
            '<p class="step-desc">' + s.desc + '</p>' +
            '<div class="step-cmd"><span class="cmd-prefix">⌨️ comando:</span> <span class="cmd-text">' +
            (COMMANDS_BY_SOFT[app.soft][s.id] || '—') + '</span></div>' +
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
        if (cmdSpan && COMMANDS_BY_SOFT[app.soft][id]) {
            cmdSpan.textContent = COMMANDS_BY_SOFT[app.soft][id];
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

    // Monta/desmonta a cena 3D principal
    (SCENE_PARTS[id] || []).forEach(elId => {
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
    Object.values(SCENE_PARTS).flat().forEach(id => {
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
    app.steps = buildStepDefs(fState);
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

// ----- helpers SVG -----
function svgRect(x, y, w, h, cls, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + Math.max(0, w) + '" height="' + Math.max(0, h) +
        '" class="' + cls + '"' + (extra ? ' ' + extra : '') + '/>';
}
function svgLine(x1, y1, x2, y2, cls) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="' + cls + '"/>';
}
function svgCircle(cx, cy, r, cls) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + Math.max(0.5, r) + '" class="' + cls + '"/>';
}
function svgPolyline(pts, cls) {
    return '<polyline points="' + pts.map(p => p[0] + ',' + p[1]).join(' ') + '" class="' + cls + '"/>';
}
function svgText(x, y, str, cls, anchor, rotate) {
    let attrs = 'x="' + x + '" y="' + y + '" class="' + cls + '"';
    if (anchor) attrs += ' text-anchor="' + anchor + '"';
    if (rotate) attrs += ' transform="rotate(-90, ' + x + ', ' + y + ')"';
    return '<text ' + attrs + '>' + str + '</text>';
}
// Cota horizontal (ticks verticais nas extremidades)
function dimH(x1, x2, y, label, textDy) {
    return svgLine(x1, y, x2, y, 'dim') +
        svgLine(x1, y - 5, x1, y + 5, 'dim') +
        svgLine(x2, y - 5, x2, y + 5, 'dim') +
        svgText((x1 + x2) / 2, y + (textDy == null ? 15 : textDy), label, 'dim-text', 'middle');
}
// Cota vertical: 'rot-l' (texto rotacionado à esquerda), 'end-l' (texto à esquerda),
// 'start-r' (texto à direita)
function dimV(y1, y2, x, label, mode) {
    let out = svgLine(x, y1, x, y2, 'dim') +
        svgLine(x - 5, y1, x + 5, y1, 'dim') +
        svgLine(x - 5, y2, x + 5, y2, 'dim');
    const mid = (y1 + y2) / 2;
    if (mode === 'rot-l') {
        out += svgText(x - 10, mid, label, 'dim-text', 'middle', true);
    } else if (mode === 'end-l') {
        out += svgText(x - 8, mid, label, 'dim-text', 'end');
    } else {
        out += svgText(x + 12, mid, label, 'dim-text');
    }
    return out;
}

function sheetTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        bg: isDark ? '#1A1A2E' : '#F0EDE8',
        stroke: isDark ? '#C4B8A8' : '#5A5A6E',
        dimStroke: isDark ? '#6FD3E0' : '#2D6B8F',
        dimText: isDark ? '#6FD3E0' : '#2D6B8F',
        surfaceBase: isDark ? '#2A3A4A' : '#D5CDC0',
        surfaceWall: isDark ? '#3A4A5A' : '#C4B8A8',
        holeFill: isDark ? '#131B23' : '#B0A898',
        chamferStroke: isDark ? '#FF7A3D' : '#D95A1A',
        labelColor: isDark ? '#8FA0B3' : '#5A5A6E',
        hiddenStroke: isDark ? '#5A6F85' : '#8A8A9E'
    };
}

function createSVG(content, viewBox, t) {
    return '<svg viewBox="' + viewBox + '" xmlns="http://www.w3.org/2000/svg" style="background:' + t.bg +
        '; border-radius:4px; width:100%; height:100%;">' +
        '<defs>' +
        '<style>' +
        '.line { stroke: ' + t.stroke + '; stroke-width: 1.5; fill: none; }' +
        '.dim { stroke: ' + t.dimStroke + '; stroke-width: 1; fill: none; }' +
        '.dim-text { fill: ' + t.dimText + '; font-size: 10px; font-family: "JetBrains Mono", monospace; }' +
        '.hatch { fill: none; stroke: ' + t.stroke + '; stroke-width: 0.8; stroke-dasharray: 2,2; }' +
        '.cut-line { stroke: ' + t.chamferStroke + '; stroke-width: 1.5; stroke-dasharray: 6,3; fill: none; }' +
        '.surface { fill: ' + t.surfaceBase + '; stroke: ' + t.stroke + '; stroke-width: 1; }' +
        '.surface-wall { fill: ' + t.surfaceWall + '; stroke: ' + t.stroke + '; stroke-width: 1; }' +
        '.hole { fill: ' + t.holeFill + '; stroke: ' + t.chamferStroke + '; stroke-width: 1; }' +
        '.hidden { stroke: ' + t.hiddenStroke + '; stroke-width: 1; stroke-dasharray: 4,3; fill: none; }' +
        '.chamfer-line { stroke: ' + t.chamferStroke + '; stroke-width: 1.5; fill: none; }' +
        '.label { fill: ' + t.labelColor + '; font-size: 9px; font-family: "JetBrains Mono", monospace; }' +
        '</style>' +
        '</defs>' +
        content +
        '</svg>';
}

function chamferMarks(x, w, y, cs, includeLeft) {
    let out = '';
    if (includeLeft) {
        out += svgPolyline([[x, y], [x + cs, y - cs], [x + cs, y]], 'chamfer-line');
    }
    out += svgPolyline([[x + w, y], [x + w - cs, y - cs], [x + w - cs, y]], 'chamfer-line');
    return out;
}

function generateDrawingSheet() {
    const fState = getFeatureState();
    const dims = getDimsFromState(fState);
    const w = dims.largura;
    const d = dims.comprimento;
    const e = dims.espessura;
    const h = dims.altura;
    const ep = dims.espessuraParede;
    const dfb = dims.diamFuroBase;
    const dfp = dims.diamFuroParede;
    const hasWall = fState.wall.included;
    const hasHoleBase = fState.hole_base.included;
    const hasHoleWall = fState.hole_wall.included && hasWall;
    const hasChamfer = fState.chamfer.included;
    const cs = Math.max(4, Math.min(dims.chanfro, 20)); // marca de chanfro legível
    const t = sheetTheme();
    const x0 = 50;
    const y0 = 50;

    // ===== VISTA FRONTAL =====
    let frontal = svgRect(x0, y0, w, e + h, 'surface') +
        svgRect(x0, y0, w, e, 'surface') +
        (hasWall ? svgRect(x0, y0 + e, w, h, 'surface-wall') : '');
    if (hasHoleWall) {
        frontal += svgLine(x0 + w / 2, y0 + e + 30, x0 + w / 2, y0 + e + h - 20, 'hidden') +
            svgCircle(x0 + w / 2, y0 + e + 40, dfp / 2, 'hidden');
    }
    if (hasChamfer) frontal += chamferMarks(x0, w, y0 + e, cs, true);
    frontal += dimV(y0, y0 + e + h, 30, fmt(e + h), 'rot-l') +
        dimH(x0, x0 + w, y0 + e + h + 20, fmt(w)) +
        (hasWall ? dimV(y0 + e, y0 + e + h, x0 + w + 20, fmt(h), 'start-r') : '') +
        dimV(y0, y0 + e, x0 - 20, fmt(e), 'end-l') +
        svgLine(x0 - 10, y0 - 15, x0 + w + 10, y0 - 15, 'cut-line') +
        svgText(x0 - 5, y0 - 20, 'A', 'label', 'end') +
        svgText(x0 + w + 10, y0 - 20, 'A', 'label');
    $('#svgFrontalSheet').innerHTML = createSVG(frontal,
        '8 12 ' + (w + 100) + ' ' + (e + h + 88), t);

    // ===== VISTA SUPERIOR =====
    let sup = svgRect(x0, y0, w, d, 'surface');
    if (hasWall) sup += svgRect(x0, y0, w, ep, 'hidden');
    if (hasHoleBase) sup += svgCircle(x0 + w / 2, y0 + d / 2, dfb / 2, 'hole');
    if (hasHoleWall) sup += svgCircle(x0 + w / 2, y0 + ep / 2, dfp / 2, 'hole');
    sup += dimH(x0, x0 + w, y0 + d + 20, fmt(w)) +
        dimV(y0, y0 + d, x0 + w + 20, fmt(d), 'start-r') +
        (hasWall ? dimH(x0, x0 + w, y0 - 20, fmt(ep), -8) : '');
    if (hasHoleBase) sup += svgText(x0 + w / 2 + dfb / 2 + 15, y0 + d / 2, 'Ø' + fmt(dfb), 'dim-text');
    if (hasHoleWall) sup += svgText(x0 + w / 2 + dfp / 2 + 15, y0 + ep / 2, 'Ø' + fmt(dfp), 'dim-text');
    $('#svgSuperiorSheet').innerHTML = createSVG(sup,
        '8 8 ' + (w + 108) + ' ' + (d + 100), t);

    // ===== VISTA LATERAL ESQ. =====
    let lat = svgRect(x0, y0, d, e + h, 'surface') +
        svgRect(x0, y0, d, e, 'surface') +
        (hasWall ? svgRect(x0, y0 + e, d, h, 'surface-wall') : '');
    if (hasHoleWall) lat += svgCircle(x0 + d / 2, y0 + e + 40, dfp / 2, 'hole');
    if (hasChamfer) lat += chamferMarks(x0, d, y0 + e, cs, false);
    lat += dimV(y0, y0 + e + h, 30, fmt(e + h), 'rot-l') +
        dimH(x0, x0 + d, y0 + e + h + 20, fmt(d)) +
        (hasWall ? dimV(y0 + e, y0 + e + h, x0 + d + 20, fmt(h), 'start-r') : '') +
        dimV(y0, y0 + e, x0 - 20, fmt(e), 'end-l');
    if (hasHoleWall) lat += svgText(x0 + d / 2 + dfp / 2 + 15, y0 + e + 40, 'Ø' + fmt(dfp), 'dim-text');
    $('#svgLateralSheet').innerHTML = createSVG(lat,
        '8 12 ' + (d + 100) + ' ' + (e + h + 88), t);

    // ===== CORTE A-A =====
    let corte = svgRect(x0, y0, w, e, 'surface') +
        (hasWall ? svgRect(x0, y0 + e, w, h, 'surface-wall') : '') +
        '<pattern id="hatchPattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="8" stroke="' + t.stroke + '" stroke-width="0.6"/>' +
        '</pattern>' +
        svgRect(x0, y0, w, e + h, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
    if (hasHoleWall) {
        corte += svgRect(x0 + w / 2 - dfp / 2, y0 + e + 30, dfp, Math.max(h - 50, 2), 'hole');
    }
    if (hasHoleBase) {
        corte += svgRect(x0 + w / 2 - dfb / 2, y0 + 10, dfb, Math.max(e - 10, 2), 'hole');
    }
    if (hasChamfer) corte += chamferMarks(x0, w, y0 + e, cs, true);
    corte += dimH(x0, x0 + w, y0 + e + h + 20, fmt(w)) +
        dimV(y0, y0 + e + h, 30, fmt(e + h), 'rot-l');
    if (hasHoleWall) corte += svgText(x0 + w / 2 + dfp / 2 + 15, y0 + e + 50, 'Ø' + fmt(dfp), 'dim-text');
    if (hasHoleBase) corte += svgText(x0 + w / 2 + dfb / 2 + 15, y0 + 30, 'Ø' + fmt(dfb), 'dim-text');
    corte += svgText(x0 + w / 2, y0 - 10, 'A-A', 'label', 'middle');
    $('#svgCorteSheet').innerHTML = createSVG(corte,
        '8 12 ' + (w + 100) + ' ' + (e + h + 88), t);

    updateTechInfo(dims, fState);
}

function computeMass(dims, fState) {
    // mm³ → cm³ → kg (aço 7,85 g/cm³)
    let vol = dims.largura * dims.comprimento * dims.espessura;
    if (fState.wall.included) {
        vol += dims.larguraParede * dims.espessuraParede * dims.altura;
    }
    if (fState.hole_base.included) {
        vol -= Math.PI * Math.pow(dims.diamFuroBase / 2, 2) * dims.espessura;
    }
    if (fState.hole_wall.included && fState.wall.included) {
        vol -= Math.PI * Math.pow(dims.diamFuroParede / 2, 2) * dims.espessuraParede;
    }
    if (fState.chamfer.included) {
        // Dois chanfros de aresta: t²/2 × comprimento cada
        vol -= 2 * (dims.chanfro * dims.chanfro / 2) * dims.largura;
    }
    vol = Math.max(vol, 0);
    return vol * MATERIAL.density / 1e6;
}

function updateTechInfo(dims, fState) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    set('techWidth', fmt(dims.largura) + ' mm');
    set('techDepth', fmt(dims.comprimento) + ' mm');
    set('techHeight', fmt(dims.espessura + dims.altura) + ' mm');
    set('techBaseThick', fmt(dims.espessura) + ' mm');
    set('techWallThick', fState.wall.included ? fmt(dims.espessuraParede) + ' mm' : '—');
    set('techHoleBase', fState.hole_base.included ? 'Ø' + fmt(dims.diamFuroBase) + ' mm' : '—');
    set('techHoleWall', fState.hole_wall.included && fState.wall.included ?
        'Ø' + fmt(dims.diamFuroParede) + ' mm' : '—');
    set('techChamfer', fState.chamfer.included ?
        fmt(dims.chanfro) + ' × ' + fmt(dims.chanfroAng) + '°' : '—');
    set('techMaterial', MATERIAL.name);
    const mass = computeMass(dims, fState);
    set('techWeight', mass.toFixed(2).replace('.', ',') + ' kg');
    set('techDate', todayBR());
}

// Sincroniza a miniatura 3D da folha com as features incluídas
function syncSheet3D(fState) {
    const toggle = (id, on) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('on-sheet', !!on);
    };
    toggle('box-sheet-base', true);
    toggle('box-sheet-wall', fState.wall.included);
    toggle('hole-sheet-base', fState.hole_base.included);
    toggle('hole-sheet-wall', fState.hole_wall.included && fState.wall.included);
    toggle('cm1-sheet', fState.chamfer.included);
    toggle('cm2-sheet', fState.chamfer.included);
}

function refreshSheet() {
    generateDrawingSheet();
    syncSheet3D(getFeatureState());
}

// ============================================================
// UPLOAD / FLUXO PRINCIPAL
// ============================================================
function revealApp(fileName, opts) {
    opts = opts || {};
    app.revealed = true;
    app.confirmed = false;
    app.fileName = fileName;
    app.doneIds.clear();

    $('#fileChipText').textContent = fileName;
    $('#fileChip').classList.add('show');
    $('#detectSection').classList.add('show');

    $('#planSection').classList.remove('show');
    $('#drawingSheetSection').classList.remove('show');
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
    const fState = getFeatureState();
    app.steps = buildStepDefs(fState);
    app.doneIds.clear();
    app.confirmed = true;

    refreshSheet();

    $('#drawingSheetSection').classList.add('show');
    $('#softHead').style.display = 'block';
    $('#softGrid').style.display = 'grid';
    $('#planSection').classList.add('show');

    renderSteps();

    if (!opts.silent) {
        setTimeout(() => scrollToSection('softHead'), 150);
        showToast('✅ Roteiro e folha de desenho gerados com sucesso!');
    }
    saveSession();
}

// ============================================================
// SOFTWARE (Passo 2)
// ============================================================
function applySoft(soft, opts) {
    opts = opts || {};
    if (!COMMANDS_BY_SOFT[soft]) soft = 'solidworks';
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

    const fState = getFeatureState();
    const dims = getDimsFromState(fState);
    const lines = [
        'COTA — Roteiro de Modelagem',
        '============================',
        'Peça: SUPORTE-EM-L · REV.A',
        'Arquivo: ' + (app.fileName || '—'),
        'Software: ' + SOFT_NAMES[app.soft],
        'Data: ' + todayBR(),
        'Material: ' + MATERIAL.name,
        'Massa estimada: ' + computeMass(dims, fState).toFixed(2).replace('.', ',') + ' kg',
        '',
        'Especificações:',
        '  Comprimento total: ' + fmt(dims.largura) + ' mm',
        '  Largura total: ' + fmt(dims.comprimento) + ' mm',
        '  Altura total: ' + fmt(dims.espessura + dims.altura) + ' mm',
        '  Espessura da base: ' + fmt(dims.espessura) + ' mm',
        '  Espessura da parede: ' + (fState.wall.included ? fmt(dims.espessuraParede) + ' mm' : '—'),
        '  Furo base: ' + (fState.hole_base.included ? 'Ø' + fmt(dims.diamFuroBase) + ' mm' : '—'),
        '  Furo parede: ' + (fState.hole_wall.included && fState.wall.included ? 'Ø' + fmt(dims.diamFuroParede) + ' mm' : '—'),
        '  Chanfro: ' + (fState.chamfer.included ? fmt(dims.chanfro) + ' × ' + fmt(dims.chanfroAng) + '°' : '—'),
        '',
        'Etapas concluídas: ' + app.doneIds.size + '/' + app.steps.length,
        ''
    ];

    app.steps.forEach((s, i) => {
        lines.push((i + 1) + '. ' + s.title + (app.doneIds.has(s.id) ? ' [concluída]' : ''));
        lines.push('   ' + s.desc);
        lines.push('   Comando: ' + (COMMANDS_BY_SOFT[app.soft][s.id] || '—'));
        if (s.tip) lines.push('   💡 ' + s.tip);
        lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roteiro-cota-' + app.soft + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('💾 Roteiro exportado como TXT');
}

function printPlan() {
    if (!app.steps.length) {
        showToast('⚠️ Nenhum roteiro gerado ainda.');
        return;
    }
    const dims = getDimsFromState(getFeatureState());
    const meta = $('#printMeta');
    if (meta) {
        meta.textContent = 'SUPORTE-EM-L · REV.A · ' + SOFT_NAMES[app.soft] +
            ' · ' + fmt(dims.largura) + '×' + fmt(dims.comprimento) + '×' + fmt(dims.espessura + dims.altura) + ' mm · ' + todayBR();
    }
    window.print();
}

// ============================================================
// CENA 3D — ÓRBITA (mouse + toque)
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
        btn.addEventListener('click', () => revealApp('suporte-em-L_rev-A.pdf'));
    });

    $('#themeToggle').addEventListener('click', () => {
        setTheme(app.theme === 'dark' ? 'light' : 'dark');
    });

    // Upload
    $('#btnDemo').addEventListener('click', () => revealApp('suporte-em-L_rev-A.pdf'));
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
    renderFeatures();

    // Restaura sessão anterior (features, software, progresso)
    const saved = loadSession();
    if (saved) {
        applyFeatureState(saved.features);
        applySoft(saved.soft || 'solidworks', { silent: true });
    }

    setTheme(localStorage.getItem(STORAGE_THEME) || 'dark');
    setupGeneralEvents();
    setupOrbit();
    setupSplash();

    if (saved && saved.revealed) {
        revealApp(saved.fileName || 'peça.pdf', { silent: true });
        if (saved.confirmed) {
            confirmFeatures({ silent: true });
            (saved.doneIds || []).forEach(id => setStepDone(id, true, { silent: true }));
            showToast('📂 Sessão anterior restaurada — progresso: ' + app.doneIds.size + '/' + app.steps.length);
        } else {
            showToast('📂 Sessão anterior restaurada');
        }
    } else {
        refreshSheet();
        setupDemoPulse();
    }

    console.log('🚀 COTA v4.1 — CAD Assistant carregado!');
    console.log('📐 Folha de desenho com massa e cotas calculadas.');
    console.log('🎯 Clique em "Usar peça de exemplo" para começar!');
}

document.addEventListener('DOMContentLoaded', init);
