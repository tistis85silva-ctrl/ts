'use strict';

/* ============================================================
   COTA — parts.js (v5.0)
   Catálogo de situações de usinagem + geradores de:
   · vistas SVG da folha técnica
   · roteiro de modelagem (CAD)
   · código ISO 6983 (G-code)
   · programa paramétrico (macro com variáveis)
   ============================================================ */

// ============================================================
// HELPERS COMPARTILHADOS
// ============================================================
function fmt(n) {
    return String(Math.round(n * 100) / 100);
}

// Número no formato de comando CNC: 120. / 7.5 / 0.25
function gf(n) {
    const s = Number(n).toFixed(3);
    return s.replace(/0+$/, '').replace(/\.$/, '');
}

const MATERIAL = { name: 'Aço SAE 1020', density: 7.85 }; // g/cm³

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
// Cota vertical: 'rot-l' | 'end-l' | 'start-r'
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
function chamferMarks(x, w, y, cs, includeLeft) {
    let out = '';
    if (includeLeft) {
        out += svgPolyline([[x, y], [x + cs, y - cs], [x + cs, y]], 'chamfer-line');
    }
    out += svgPolyline([[x + w, y], [x + w - cs, y - cs], [x + w - cs, y]], 'chamfer-line');
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

function hatchBlock() {
    return '<pattern id="hatchPattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="8" stroke="#888" stroke-width="0.6"/>' +
        '</pattern>';
}

// ============================================================
// COMANDOS CAD COMPARTILHADOS (por software)
// ============================================================
const CMD = {
    sketchTop: {
        solidworks: 'Sketch → plano Top → Rectangle',
        fusion: 'Design → Create Sketch (plano Top) → Rectangle',
        inventor: '3D Model → Start 2D Sketch → plano XY → Rectangle'
    },
    extrude: {
        solidworks: 'Features → Extruded Boss/Base',
        fusion: 'Design → Create → Extrude',
        inventor: '3D Model → Extrude'
    },
    extrudeCut: {
        solidworks: 'Features → Extruded Cut',
        fusion: 'Design → Create → Extrude (Cut)',
        inventor: '3D Model → Extrude (Cut)'
    },
    hole: {
        solidworks: 'Features → Hole Wizard → Passante',
        fusion: 'Design → Create → Hole (Passante)',
        inventor: '3D Model → Hole (Passante)'
    },
    chamfer: {
        solidworks: 'Features → Chamfer → Distância-Ângulo',
        fusion: 'Design → Modify → Chamfer',
        inventor: '3D Model → Modify → Chamfer'
    },
    circle: {
        solidworks: 'Sketch → plano Top → Circle',
        fusion: 'Design → Create Sketch (plano Top) → Circle',
        inventor: '3D Model → Start 2D Sketch → plano XY → Circle'
    },
    revolve: {
        solidworks: 'Features → Revolved Boss/Base (360°)',
        fusion: 'Design → Create → Revolve (360°)',
        inventor: '3D Model → Revolve (360°)'
    },
    revolveCut: {
        solidworks: 'Features → Revolved Cut',
        fusion: 'Design → Create → Revolve (Cut)',
        inventor: '3D Model → Revolve (Cut)'
    },
    circularPattern: {
        solidworks: 'Features → Circular Pattern (eixo central)',
        fusion: 'Create → Pattern → Circular Pattern',
        inventor: '3D Model → Pattern → Circular Pattern'
    },
    slot: {
        solidworks: 'Sketch → Slot (Straight Slot)',
        fusion: 'Create Sketch → Slot → Straight Slot',
        inventor: 'Start 2D Sketch → Slot (Straight Slot)'
    },
    linearPattern: {
        solidworks: 'Features → Linear Pattern (2 direções)',
        fusion: 'Create → Pattern → Rectangular Pattern',
        inventor: '3D Model → Pattern → Rectangular Pattern'
    }
};

function cmdFor(soft, key) {
    const c = CMD[key];
    return (c && (c[soft] || c.solidworks)) || '—';
}

// ============================================================
// PARTE 1 — SUPORTE EM L (fresamento 2,5D)
// ============================================================
const suporteL = {
    id: 'suporte-l',
    name: 'Suporte em L',
    tag: 'SUPORTE-EM-L',
    rev: 'A',
    process: 'Fresamento 2,5D',
    machine: 'Centro de usinagem 3 eixos',
    control: 'ISO 6983 (FANUC/Siemens)',
    stock: 'Bloco 165 × 165 × 32 mm',
    difficulty: 'Iniciante',
    icon: '🔧',
    desc: 'Placa base + parede vertical, furos passantes e chanfros. O clássico para treinar sketch, extrusão e furação.',
    exampleFile: 'suporte-em-L_rev-A.pdf',
    cssScene: true,
    sceneMap: {
        base_extrude: ['box-base'],
        wall_extrude: ['box-wall'],
        hole_base: ['hole-base'],
        hole_wall: ['hole-wall'],
        chamfer: ['cm1', 'cm2']
    },
    viewLabels: ['FRONTAL', 'SUPERIOR', 'LATERAL ESQ.', 'CORTE A-A'],
    features: [{
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
        params: [{ key: 'diametro', label: 'diâm.', unit: 'mm', value: 26 }]
    }, {
        id: 'hole_wall',
        name: 'Furo na parede',
        hint: 'Furo passante na parede vertical',
        included: true,
        params: [{ key: 'diametro', label: 'diâm.', unit: 'mm', value: 20 }]
    }, {
        id: 'chamfer',
        name: 'Chanfro nas arestas',
        hint: 'Arestas superiores frontais da base',
        included: true,
        params: [
            { key: 'tamanho', label: 'tam.', unit: 'mm', value: 3 },
            { key: 'angulo', label: 'ângulo', unit: '°', value: 45 }
        ]
    }],
    dimsFromState(st) {
        return {
            largura: st.base.params.largura,
            comprimento: st.base.params.comprimento,
            espessura: st.base.params.espessura,
            larguraParede: st.wall.params.largura,
            altura: st.wall.params.altura,
            espessuraParede: st.wall.params.espessura,
            diamFuroBase: st.hole_base.params.diametro,
            diamFuroParede: st.hole_wall.params.diametro,
            chanfro: st.chamfer.params.tamanho,
            chanfroAng: st.chamfer.params.angulo
        };
    },
    computeMass(d, st) {
        let vol = d.largura * d.comprimento * d.espessura;
        if (st.wall.included) vol += d.larguraParede * d.espessuraParede * d.altura;
        if (st.hole_base.included) vol -= Math.PI * Math.pow(d.diamFuroBase / 2, 2) * d.espessura;
        if (st.hole_wall.included && st.wall.included) vol -= Math.PI * Math.pow(d.diamFuroParede / 2, 2) * d.espessuraParede;
        if (st.chamfer.included) vol -= 2 * (d.chanfro * d.chanfro / 2) * d.largura;
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Comprimento total', value: fmt(d.largura) + ' mm' },
            { label: 'Largura total', value: fmt(d.comprimento) + ' mm' },
            { label: 'Altura total', value: fmt(d.espessura + d.altura) + ' mm' },
            { label: 'Espessura da base', value: fmt(d.espessura) + ' mm' },
            { label: 'Espessura da parede', value: st.wall.included ? fmt(d.espessuraParede) + ' mm' : '—' },
            { label: 'Furo base', value: st.hole_base.included ? 'Ø' + fmt(d.diamFuroBase) + ' mm' : '—' },
            { label: 'Furo parede', value: st.hole_wall.included && st.wall.included ? 'Ø' + fmt(d.diamFuroParede) + ' mm' : '—' },
            { label: 'Chanfro', value: st.chamfer.included ? fmt(d.chanfro) + ' × ' + fmt(d.chanfroAng) + '°' : '—' },
            { label: 'Tolerância', value: 'ISO 2768-m' },
            { label: 'Acabamento', value: 'Usinagem' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'base_sketch', title: 'Esboçar a Base', badge: 'SKETCH',
            desc: 'Crie um novo sketch no plano superior (Top/XY). Utilize a ferramenta Rectangle para desenhar o contorno da base com as dimensões de ' +
                fmt(d.largura) + 'mm × ' + fmt(d.comprimento) + 'mm.',
            tip: 'Utilize o comando "Smart Dimension" para adicionar as medidas. Mantenha o sketch totalmente definido.'
        });
        defs.push({
            id: 'base_extrude', title: 'Extrudar a Base', badge: 'EXTRUDE',
            desc: 'Selecione o sketch da base e aplique a extrusão. Defina a profundidade para ' + fmt(d.espessura) + 'mm.',
            tip: 'Verifique se a extrusão está com a direção correta (para cima).'
        });
        if (st.wall.included) {
            defs.push({
                id: 'wall_sketch', title: 'Esboçar a Parede Vertical', badge: 'SKETCH',
                desc: 'Selecione a face traseira da base e crie um novo sketch. Desenhe o perfil retangular com ' +
                    fmt(d.larguraParede) + 'mm × ' + fmt(d.altura) + 'mm.',
                tip: 'Use "Project Geometry" para referenciar as bordas da base e garantir alinhamento.'
            });
            defs.push({
                id: 'wall_extrude', title: 'Extrudar a Parede Vertical', badge: 'EXTRUDE',
                desc: 'Selecione o sketch da parede e aplique a extrusão com espessura de ' + fmt(d.espessuraParede) + 'mm.',
                tip: 'Use a opção "From" para garantir que comece exatamente na face da base.'
            });
        }
        if (st.hole_base.included) {
            defs.push({
                id: 'hole_base', title: 'Furo Passante na Base', badge: 'HOLE',
                desc: 'Crie um furo passante no centro da base com diâmetro de ' + fmt(d.diamFuroBase) + 'mm.',
                tip: 'Posicione o furo centralizado usando cotas de referência.'
            });
        }
        if (st.hole_wall.included && st.wall.included) {
            defs.push({
                id: 'hole_wall', title: 'Furo Passante na Parede', badge: 'HOLE',
                desc: 'Adicione um furo passante na parede vertical com diâmetro de ' + fmt(d.diamFuroParede) + 'mm.',
                tip: 'Use a face da parede como referência para o sketch do furo.'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Aplicar Chanfro nas Arestas', badge: 'CHAMFER',
                desc: 'Selecione as arestas superiores frontais da base e aplique chanfro de ' +
                    fmt(d.chanfro) + 'mm × ' + fmt(d.chanfroAng) + '°.',
                tip: 'Use a opção "Distance-Angle" para definir o chanfro.'
            });
        }
        return defs;
    },
    stepCmd: {
        base_sketch: 'sketchTop', base_extrude: 'extrude', wall_sketch: 'sketchTop',
        wall_extrude: 'extrude', hole_base: 'hole', hole_wall: 'hole', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const w = d.largura, dd = d.comprimento, e = d.espessura, h = d.altura;
        const ep = d.espessuraParede, dfb = d.diamFuroBase, dfp = d.diamFuroParede;
        const hasWall = st.wall.included, hasHoleWall = st.hole_wall.included && hasWall;
        const hasHoleBase = st.hole_base.included, hasChamfer = st.chamfer.included;
        const cs = Math.max(4, Math.min(d.chanfro, 20));
        const x0 = 50, y0 = 50;

        // FRONTAL
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

        // SUPERIOR
        let sup = svgRect(x0, y0, w, dd, 'surface');
        if (hasWall) sup += svgRect(x0, y0, w, ep, 'hidden');
        if (hasHoleBase) sup += svgCircle(x0 + w / 2, y0 + dd / 2, dfb / 2, 'hole');
        if (hasHoleWall) sup += svgCircle(x0 + w / 2, y0 + ep / 2, dfp / 2, 'hole');
        sup += dimH(x0, x0 + w, y0 + dd + 20, fmt(w)) +
            dimV(y0, y0 + dd, x0 + w + 20, fmt(dd), 'start-r') +
            (hasWall ? dimH(x0, x0 + w, y0 - 20, fmt(ep), -8) : '');
        if (hasHoleBase) sup += svgText(x0 + w / 2 + dfb / 2 + 15, y0 + dd / 2, 'Ø' + fmt(dfb), 'dim-text');
        if (hasHoleWall) sup += svgText(x0 + w / 2 + dfp / 2 + 15, y0 + ep / 2, 'Ø' + fmt(dfp), 'dim-text');

        // LATERAL
        let lat = svgRect(x0, y0, dd, e + h, 'surface') +
            svgRect(x0, y0, dd, e, 'surface') +
            (hasWall ? svgRect(x0, y0 + e, dd, h, 'surface-wall') : '');
        if (hasHoleWall) lat += svgCircle(x0 + dd / 2, y0 + e + 40, dfp / 2, 'hole');
        if (hasChamfer) lat += chamferMarks(x0, dd, y0 + e, cs, true);
        lat += dimV(y0, y0 + e + h, 30, fmt(e + h), 'rot-l') +
            dimH(x0, x0 + dd, y0 + e + h + 20, fmt(dd)) +
            (hasWall ? dimV(y0 + e, y0 + e + h, x0 + dd + 20, fmt(h), 'start-r') : '') +
            dimV(y0, y0 + e, x0 - 20, fmt(e), 'end-l');
        if (hasHoleWall) lat += svgText(x0 + dd / 2 + dfp / 2 + 15, y0 + e + 40, 'Ø' + fmt(dfp), 'dim-text');

        // CORTE A-A
        let corte = svgRect(x0, y0, w, e, 'surface') +
            (hasWall ? svgRect(x0, y0 + e, w, h, 'surface-wall') : '') +
            hatchBlock() +
            svgRect(x0, y0, w, e + h, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        if (hasHoleWall) corte += svgRect(x0 + w / 2 - dfp / 2, y0 + e + 30, dfp, Math.max(h - 50, 2), 'hole');
        if (hasHoleBase) corte += svgRect(x0 + w / 2 - dfb / 2, y0 + 10, dfb, Math.max(e - 10, 2), 'hole');
        if (hasChamfer) corte += chamferMarks(x0, w, y0 + e, cs, true);
        corte += dimH(x0, x0 + w, y0 + e + h + 20, fmt(w)) +
            dimV(y0, y0 + e + h, 30, fmt(e + h), 'rot-l');
        if (hasHoleWall) corte += svgText(x0 + w / 2 + dfp / 2 + 15, y0 + e + 50, 'Ø' + fmt(dfp), 'dim-text');
        if (hasHoleBase) corte += svgText(x0 + w / 2 + dfb / 2 + 15, y0 + 30, 'Ø' + fmt(dfb), 'dim-text');
        corte += svgText(x0 + w / 2, y0 - 10, 'A-A', 'label', 'middle');

        return [
            { svg: createSVG(frontal, '8 12 ' + (w + 100) + ' ' + (e + h + 88), t), vb: '8 12 ' + (w + 100) + ' ' + (e + h + 88) },
            { svg: createSVG(sup, '8 8 ' + (w + 108) + ' ' + (dd + 100), t) },
            { svg: createSVG(lat, '8 12 ' + (dd + 100) + ' ' + (e + h + 88), t) },
            { svg: createSVG(corte, '8 12 ' + (w + 100) + ' ' + (e + h + 88), t) }
        ];
    },
    gcode(d, st) {
        const L = [], w = d.largura, dd = d.comprimento, e = d.espessura, h = d.altura;
        const ep = d.espessuraParede, dfb = d.diamFuroBase, dfp = d.diamFuroParede;
        const hasWall = st.wall.included, hasHoleWall = st.hole_wall.included && hasWall;
        const hasHoleBase = st.hole_base.included, hasChamfer = st.chamfer.included;
        const x = w / 2, y = dd / 2;
        L.push('%',
            'O0001 (SUPORTE EM L - FRESAMENTO 2.5D)',
            '(PECA: ' + fmt(w) + ' X ' + fmt(dd) + ' X ' + fmt(e + h) + ' - REV A)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: BLOCO ' + fmt(w + 5) + ' X ' + fmt(dd + 5) + ' X ' + fmt(e + h + 4) + ')',
            '(T01 - FRESA PLANA D50 - FACEAMENTO)',
            '(T02 - FRESA D16 DE 4 ALETAS - CONTORNO/ESBOCO)',
            '(T03 - BROCA D' + fmt(Math.min(dfb, 25)) + ' - FURO BASE)',
            '(T04 - BROCA D' + fmt(Math.min(dfp, 20)) + ' - FURO PAREDE)',
            '(T05 - FRESA DE CHANFRO 90G - C' + fmt(d.chanfro) + ')',
            '(G54 - ORIGEM NO CENTRO DA PEC A, FACE SUPERIOR Z0)',
            'N10 G21 G90 G17 G40 G49 G80 G94',
            'N20 T01 M06',
            'N30 S2800 M03',
            'N40 G00 G54 X-' + gf(x + 30) + ' Y-' + gf(y + 30) + '.',
            'N50 G43 Z50. H01 M08',
            '',
            '(=== FACEAMENTO DA BASE ===)',
            'N60 G00 Z0.5',
            'N70 G01 Z0. F120.',
            'N80 G01 X' + gf(x + 30) + ' F450.',
            'N90 Y-' + gf(y + 30) + '.',
            'N100 X-' + gf(x + 30) + '.');
        if (hasWall) {
            L.push('N110 Y' + gf(y + 30) + '.',
                'N120 X' + gf(x + 30) + '.');
        } else {
            L.push('N110 Y' + gf(y + 30) + '.');
        }
        L.push('N130 G00 Z50.',
            '',
            '(=== CONTORNO DA BASE ' + gf(w) + ' X ' + gf(dd) + ' ===)',
            'N140 T02 M06',
            'N150 S3200 M03',
            'N160 G00 G54 X-' + gf(x + 12) + ' Y-' + gf(y + 12) + '.',
            'N170 G43 Z50. H02',
            'N180 Z2. M08',
            'N190 G01 Z-' + gf(e) + ' F100.',
            'N200 G01 X-' + gf(x) + ' F280.',
            'N210 Y-' + gf(y) + '.',
            'N220 X' + gf(x) + '.',
            'N230 Y' + gf(y) + '.',
            'N240 X-' + gf(x) + '.',
            'N250 Y-' + gf(y) + '.');
        if (hasWall) {
            L.push('N260 G00 Z2.',
                '',
                '(=== PERFIL DA PAREDE ' + gf(ep) + ' DE ESPESSURA ===)',
                '(APROXIMACAO EM 2 DEGRESSEMENTOS)',
                'N270 G00 X-' + gf(x + 12) + ' Y' + gf(dd / 2 - ep - 12) + '.',
                'N280 G01 Z' + gf(-(e + h)) + ' F90.',
                'N290 G01 Y' + gf(dd / 2) + ' F250.',
                'N300 X' + gf(x) + '.',
                'N310 Y' + gf(dd / 2 - ep) + '.',
                'N320 X-' + gf(x) + '.');
        }
        L.push('N330 G00 Z50.');
        if (hasHoleBase) {
            L.push('',
                '(=== FURO BASE D' + gf(dfb) + ' - BROCA COM DESBASTE DE LASCAS ===)',
                'N340 T03 M06',
                'N350 S1400 M03',
                'N360 G00 G54 X0. Y0.',
                'N370 G43 Z50. H03',
                'N380 G83 X0. Y0. Z-' + gf(e + 2) + ' R2. Q4. F120.',
                'N390 G80');
        }
        if (hasHoleWall) {
            L.push('',
                '(=== FURO PAREDE D' + gf(dfp) + ' ===)',
                '(EM PECA MONTADA: USAR SUFIXO OU FIXACAO ESPECIFICA)',
                'N400 T04 M06',
                'N410 S1600 M03',
                'N420 G00 G54 X0. Y' + gf(dd / 2) + '.',
                'N430 G43 Z50. H04',
                'N440 G83 X0. Y' + gf(dd / 2) + ' Z-' + gf(ep + 2) + ' R2. Q3. F110.',
                'N450 G80');
        }
        if (hasChamfer) {
            L.push('',
                '(=== CHANFRO C' + gf(d.chanfro) + ' X ' + gf(d.chanfroAng) + 'G ===)',
                'N460 T05 M06',
                'N470 S2400 M03',
                'N480 G00 G54 X-' + gf(x) + ' Y-' + gf(y) + '.',
                'N490 G43 Z50. H05',
                'N500 G01 Z' + gf(-d.chanfro) + ' F100.',
                'N510 G01 X' + gf(x) + ' F300.',
                'N520 Y' + gf(y) + '.',
                'N530 X-' + gf(x) + '.',
                'N540 Y-' + gf(y) + '.');
        }
        L.push('N550 G00 Z100. M09',
            'N560 M05',
            'N570 G91 G28 Z0.',
            'N580 M30',
            '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [], w = d.largura, dd = d.comprimento, e = d.espessura, h = d.altura;
        const ep = d.espessuraParede, dfb = d.diamFuroBase, dfp = d.diamFuroParede;
        const hasWall = st.wall.included, hasHoleWall = st.hole_wall.included && hasWall;
        const hasHoleBase = st.hole_base.included, hasChamfer = st.chamfer.included;
        L.push('%',
            'O1001 (SUPORTE EM L - MACRO PARAMETRICO)',
            '(ALTERE AS VARIAVEIS ABAIXO E TODO O PROGRAMA SE ADAPTA)',
            '',
            '(=== PARAMETROS DA PECA ===)',
            '#100 = ' + gf(w) + '   (LARGURA DA BASE)',
            '#101 = ' + gf(dd) + '   (PROFUNDIDADE DA BASE)',
            '#102 = ' + gf(e) + '    (ESPESSURA DA BASE)',
            '#103 = ' + gf(h) + '   (ALTURA DA PAREDE)',
            '#104 = ' + gf(ep) + '    (ESPESSURA DA PAREDE)',
            '#105 = ' + gf(dfb) + '    (FURO BASE)',
            '#106 = ' + gf(dfp) + '    (FURO PAREDE)',
            '#107 = ' + gf(d.chanfro) + '      (CHANFRO)',
            '',
            '(=== CALCULOS DERIVADOS ===)',
            '#110 = #100 / 2   (MEIA LARGURA)',
            '#111 = #101 / 2   (MEIA PROFUNDIDADE)',
            '#112 = #102 + #103  (ALTURA TOTAL)',
            '',
            '(=== SEGURANCA ===)',
            'G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== FACEAMENTO COM PASSADAS EM Y ===)',
            'T01 M06',
            'S2800 M03',
            'G00 G54 X[-#110 - 30] Y[-#111 - 30]',
            'G43 Z50. H01 M08',
            '#120 = -#111 - 30   (VARREDURA INICIAL)',
            'WHILE [#120 LE #111 + 30] DO1',
            '  G01 X[#110 + 30] F450.',
            '  #120 = #120 + 40  (PASSO DA FRESA)',
            '  Y#120',
            '  X[-#110 - 30]',
            '  #120 = #120 + 40',
            '  Y#120',
            'END1',
            'G00 Z50.',
            '',
            '(=== CONTORNO DA BASE ===)',
            'T02 M06',
            'S3200 M03',
            'G00 X[-#110 - 12] Y[-#111 - 12]',
            'G43 Z50. H02',
            'G01 Z[-#102] F100.',
            'G01 X[-#110] F280.',
            'Y[-#111]',
            'X#110',
            'Y#111',
            'X[-#110]',
            'Y[-#111]',
            'G00 Z2.');
        if (hasWall) {
            L.push('',
                '(=== PERFIL DA PAREDE ===)',
                'G00 X[-#110 - 12] Y[#111 - #104 - 12]',
                'G01 Z[-#112] F90.',
                'G01 Y#111 F250.',
                'X#110',
                'Y[#111 - #104]',
                'X[-#110]',
                'G00 Z50.');
        }
        if (hasHoleBase) {
            L.push('',
                '(=== FURO CENTRAL - PROFUNDIDADE PARAMETRICA ===)',
                'T03 M06',
                'S1400 M03',
                'G00 G54 X0. Y0.',
                'G43 Z50. H03',
                'G83 X0. Y0. Z[-#102 - 2] R2. Q[#105 / 4] F120.',
                'G80');
        }
        if (hasHoleWall) {
            L.push('',
                '(=== FURO NA PAREDE ===)',
                'T04 M06',
                'S1600 M03',
                'G00 G54 X0. Y#111',
                'G43 Z50. H04',
                'G83 X0. Y#111 Z[-#104 - 2] R2. Q3. F110.',
                'G80');
        }
        if (hasChamfer) {
            L.push('',
                '(=== CHANFRO DE BORDA ===)',
                'T05 M06',
                'S2400 M03',
                'G00 X[-#110] Y[-#111]',
                'G43 Z50. H05',
                'G01 Z[-#107] F100.',
                'G01 X#110 F300.',
                'Y#111',
                'X[-#110]',
                'Y[-#111]');
        }
        L.push('G00 Z100. M09', 'M05', 'G91 G28 Z0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 2 — PLACA COM RASGO (fresamento 2,5D)
// ============================================================
const placaRasgo = {
    id: 'placa-rasgo',
    name: 'Placa com rasgo',
    tag: 'PLACA-RASGO',
    rev: 'A',
    process: 'Fresamento 2,5D',
    machine: 'Centro de usinagem 3 eixos',
    control: 'ISO 6983 (FANUC/Siemens)',
    stock: 'Placa 145 × 105 × 20 mm',
    difficulty: 'Iniciante',
    icon: '📏',
    desc: 'Placa com rasgo passante central e padrão de 4 furos. Treina Extruded Cut, padrão linear e furação em coordenadas.',
    exampleFile: 'placa-rasgo_rev-A.pdf',
    cssScene: false,
    viewLabels: ['FRONTAL', 'SUPERIOR', 'LATERAL ESQ.', 'CORTE A-A'],
    features: [{
        id: 'placa',
        name: 'Placa base',
        hint: 'Extrusão da placa retangular',
        included: true,
        params: [
            { key: 'largura', label: 'largura', unit: 'mm', value: 140 },
            { key: 'comprimento', label: 'comp.', unit: 'mm', value: 100 },
            { key: 'espessura', label: 'esp.', unit: 'mm', value: 15 }
        ]
    }, {
        id: 'rasgo',
        name: 'Rasgo passante',
        hint: 'Fresação de rasgo reto central (Slot)',
        included: true,
        params: [
            { key: 'comprimento', label: 'comp.', unit: 'mm', value: 60 },
            { key: 'largura', label: 'largura', unit: 'mm', value: 14 }
        ]
    }, {
        id: 'furos',
        name: 'Padrão de furos',
        hint: '4 furos passantes no padrão retangular',
        included: true,
        params: [
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 8 },
            { key: 'espacamentoX', label: 'espaç. X', unit: 'mm', value: 100 },
            { key: 'espacamentoY', label: 'espaç. Y', unit: 'mm', value: 60 }
        ]
    }, {
        id: 'chamfer',
        name: 'Chanfro de contorno',
        hint: 'Chanfro nas arestas superiores',
        included: true,
        params: [{ key: 'tamanho', label: 'tam.', unit: 'mm', value: 2 }]
    }],
    dimsFromState(st) {
        return {
            largura: st.placa.params.largura,
            comprimento: st.placa.params.comprimento,
            espessura: st.placa.params.espessura,
            rasgoComp: st.rasgo.params.comprimento,
            rasgoLarg: st.rasgo.params.largura,
            diamFuro: st.furos.params.diametro,
            espX: st.furos.params.espacamentoX,
            espY: st.furos.params.espacamentoY,
            chanfro: st.chamfer.params.tamanho
        };
    },
    computeMass(d, st) {
        let vol = d.largura * d.comprimento * d.espessura;
        if (st.rasgo.included) vol -= d.rasgoComp * d.rasgoLarg * d.espessura;
        if (st.furos.included) vol -= 4 * Math.PI * Math.pow(d.diamFuro / 2, 2) * d.espessura;
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Largura', value: fmt(d.largura) + ' mm' },
            { label: 'Comprimento', value: fmt(d.comprimento) + ' mm' },
            { label: 'Espessura', value: fmt(d.espessura) + ' mm' },
            { label: 'Rasgo', value: st.rasgo.included ? fmt(d.rasgoComp) + ' × ' + fmt(d.rasgoLarg) + ' mm (passante)' : '—' },
            { label: 'Furos', value: st.furos.included ? '4 × Ø' + fmt(d.diamFuro) + ' mm' : '—' },
            { label: 'Padrão de furos', value: st.furos.included ? fmt(d.espX) + ' × ' + fmt(d.espY) + ' mm' : '—' },
            { label: 'Chanfro', value: st.chamfer.included ? fmt(d.chanfro) + ' × 45°' : '—' },
            { label: 'Tolerância', value: 'ISO 2768-m' },
            { label: 'Acabamento', value: 'Usinagem' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'base_sketch', title: 'Esboçar a Placa', badge: 'SKETCH',
            desc: 'Sketch no plano Top: retângulo de ' + fmt(d.largura) + 'mm × ' + fmt(d.comprimento) + 'mm totalmente definido.',
            tip: 'Centralize o retângulo na origem com relações de simetria.'
        });
        defs.push({
            id: 'base_extrude', title: 'Extrudar a Placa', badge: 'EXTRUDE',
            desc: 'Extrusão de ' + fmt(d.espessura) + 'mm a partir do sketch da placa.',
            tip: 'Confira a espessura na vista lateral.'
        });
        if (st.rasgo.included) {
            defs.push({
                id: 'slot_sketch', title: 'Esboçar o Rasgo', badge: 'SKETCH',
                desc: 'Use a ferramenta Straight Slot e desenhe o rasgo central de ' + fmt(d.rasgoComp) + 'mm × ' + fmt(d.rasgoLarg) + 'mm.',
                tip: 'Fixe o centro do rasgo na origem para manter a simetria.'
            });
            defs.push({
                id: 'slot_cut', title: 'Usinar o Rasgo', badge: 'CUT',
                desc: 'Extruded Cut com a opção Through All para abrir o rasgo passante.',
                tip: 'Confirme na vista superior que o rasgo está centralizado.'
            });
        }
        if (st.furos.included) {
            defs.push({
                id: 'hole_pattern', title: 'Padrão de 4 Furos', badge: 'HOLE',
                desc: 'Furos de Ø' + fmt(d.diamFuro) + 'mm espaçados ' + fmt(d.espX) + 'mm × ' + fmt(d.espY) +
                    'mm. Crie 1 furo e aplique Linear Pattern em X e Y.',
                tip: 'Use Reference Geometry para posicionar o primeiro furo a partir do centro.'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Chanfro de Contorno', badge: 'CHAMFER',
                desc: 'Aplique chanfro de ' + fmt(d.chanfro) + 'mm × 45° nas arestas superiores do contorno.',
                tip: 'Selecione o loop de arestas superior de uma vez.'
            });
        }
        return defs;
    },
    stepCmd: {
        base_sketch: 'sketchTop', base_extrude: 'extrude', slot_sketch: 'slot',
        slot_cut: 'extrudeCut', hole_pattern: 'linearPattern', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const w = d.largura, dd = d.comprimento, e = d.espessura;
        const sl = Math.min(d.rasgoComp, w - 8), sw = Math.min(d.rasgoLarg, dd - 8);
        const hd = d.diamFuro, px = Math.min(d.espX, w - hd - 4), py = Math.min(d.espY, dd - hd - 4);
        const cs = Math.max(3, Math.min(d.chanfro, 12));
        const x0 = 50, y0 = 50;

        // FRONTAL
        let frontal = svgRect(x0, y0, w, e, 'surface');
        if (st.rasgo.included) {
            frontal += svgLine(x0 + w / 2 - sw / 2, y0, x0 + w / 2 - sw / 2, y0 + e, 'hidden') +
                svgLine(x0 + w / 2 + sw / 2, y0, x0 + w / 2 + sw / 2, y0 + e, 'hidden');
        }
        if (st.furos.included) {
            [-px / 2, px / 2].forEach(dx => {
                frontal += svgLine(x0 + w / 2 + dx, y0, x0 + w / 2 + dx, y0 + e, 'hidden');
            });
        }
        if (st.chamfer.included) frontal += chamferMarks(x0, w, y0, cs, true);
        frontal += dimV(y0, y0 + e, 30, fmt(e), 'rot-l') +
            dimH(x0, x0 + w, y0 + e + 20, fmt(w)) +
            svgLine(x0 - 10, y0 + e / 2, x0 + w + 10, y0 + e / 2, 'cut-line') +
            svgText(x0 - 5, y0 + e / 2 - 6, 'A', 'label', 'end') +
            svgText(x0 + w + 10, y0 + e / 2 - 6, 'A', 'label');

        // SUPERIOR
        let sup = svgRect(x0, y0, w, dd, 'surface');
        if (st.rasgo.included) {
            sup += svgRect(x0 + w / 2 - sl / 2, y0 + dd / 2 - sw / 2, sl, sw, 'hole') +
                dimH(x0 + w / 2 - sl / 2, x0 + w / 2 + sl / 2, y0 + dd / 2 + sw / 2 + 18, fmt(sl)) +
                dimV(y0 + dd / 2 - sw / 2, y0 + dd / 2 + sw / 2, x0 + w / 2 - sl / 2 - 14, fmt(sw), 'end-l');
        }
        if (st.furos.included) {
            [[-px / 2, -py / 2], [px / 2, -py / 2], [-px / 2, py / 2], [px / 2, py / 2]].forEach(p => {
                sup += svgCircle(x0 + w / 2 + p[0], y0 + dd / 2 + p[1], hd / 2, 'hole');
            });
            sup += dimH(x0 + w / 2 - px / 2, x0 + w / 2 + px / 2, y0 - 20, fmt(px), -8) +
                dimV(y0 + dd / 2 - py / 2, y0 + dd / 2 + py / 2, x0 + w + 24, fmt(py), 'start-r') +
                svgText(x0 + w / 2 + px / 2 + hd / 2 + 10, y0 + dd / 2 - py / 2, 'Ø' + fmt(hd), 'dim-text');
        }
        sup += dimH(x0, x0 + w, y0 + dd + 20, fmt(w)) +
            dimV(y0, y0 + dd, x0 + w + 24, fmt(dd), 'start-r');

        // LATERAL
        let lat = svgRect(x0, y0, dd, e, 'surface');
        if (st.rasgo.included) {
            lat += svgLine(x0 + dd / 2 - sl / 2, y0, x0 + dd / 2 - sl / 2, y0 + e, 'hidden') +
                svgLine(x0 + dd / 2 + sl / 2, y0, x0 + dd / 2 + sl / 2, y0 + e, 'hidden');
        }
        if (st.chamfer.included) lat += chamferMarks(x0, dd, y0, cs, true);
        lat += dimV(y0, y0 + e, 30, fmt(e), 'rot-l') +
            dimH(x0, x0 + dd, y0 + e + 20, fmt(dd));

        // CORTE A-A
        let corte = svgRect(x0, y0, w, e, 'surface') + hatchBlock();
        if (st.rasgo.included) {
            corte += svgRect(x0, y0, w / 2 - sw / 2, e, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                svgRect(x0 + w / 2 + sw / 2, y0, w / 2 - sw / 2, e, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                dimH(x0 + w / 2 - sw / 2, x0 + w / 2 + sw / 2, y0 + e + 20, fmt(sw));
        } else {
            corte += svgRect(x0, y0, w, e, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        }
        if (st.furos.included) {
            corte += svgRect(x0 + w / 2 - px / 2 - hd / 2, y0, hd, e, 'hole');
            corte += svgRect(x0 + w / 2 + px / 2 - hd / 2, y0, hd, e, 'hole');
            corte += svgText(x0 + w / 2 + px / 2 + hd / 2 + 10, y0 + e / 2, 'Ø' + fmt(hd), 'dim-text');
        }
        corte += dimV(y0, y0 + e, 30, fmt(e), 'rot-l') +
            dimH(x0, x0 + w, y0 + e + 20, fmt(w)) +
            svgText(x0 + w / 2, y0 - 10, 'A-A', 'label', 'middle');

        return [
            { svg: createSVG(frontal, '8 12 ' + (w + 100) + ' ' + (e + 88), t) },
            { svg: createSVG(sup, '8 8 ' + (w + 110) + ' ' + (dd + 100), t) },
            { svg: createSVG(lat, '8 12 ' + (dd + 100) + ' ' + (e + 88), t) },
            { svg: createSVG(corte, '8 12 ' + (w + 100) + ' ' + (e + 88), t) }
        ];
    },
    gcode(d, st) {
        const L = [], w = d.largura, dd = d.comprimento, e = d.espessura;
        const sl = d.rasgoComp, sw = d.rasgoLarg, hd = d.diamFuro;
        const px = d.espX / 2, py = d.espY / 2;
        const x = w / 2, y = dd / 2;
        L.push('%',
            'O0002 (PLACA COM RASGO - FRESAMENTO 2.5D)',
            '(PECA: ' + fmt(w) + ' X ' + fmt(dd) + ' X ' + fmt(e) + ' - REV A)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: PLACA ' + fmt(w + 5) + ' X ' + fmt(dd + 5) + ' X ' + fmt(e + 4) + ')',
            '(T01 - FRESA PLANA D50 - FACEAMENTO)',
            '(T02 - FRESA D10 - RASGO E CONTORNO)',
            '(T03 - BROCA D' + fmt(hd) + ' - PADRAO DE FUROS)',
            '(T04 - FRESA DE CHANFRO 90G - C' + fmt(d.chanfro) + ')',
            '(G54 - ORIGEM NO CENTRO DA PECA, FACE SUPERIOR Z0)',
            'N10 G21 G90 G17 G40 G49 G80 G94',
            'N20 T01 M06',
            'N30 S3000 M03',
            'N40 G00 G54 X-' + gf(x + 30) + ' Y-' + gf(y + 30) + '.',
            'N50 G43 Z50. H01 M08',
            'N60 G01 Z0. F120.',
            'N70 G01 X' + gf(x + 30) + ' F480.',
            'N80 Y' + gf(y + 30) + '.',
            'N90 X-' + gf(x + 30) + '.',
            'N100 Y-' + gf(y + 30) + '.',
            'N110 G00 Z50.',
            '',
            '(=== CONTORNO ' + gf(w) + ' X ' + gf(dd) + ' ===)',
            'N120 T02 M06',
            'N130 S3500 M03',
            'N140 G00 G54 X-' + gf(x + 10) + ' Y-' + gf(y + 10) + '.',
            'N150 G43 Z50. H02',
            'N160 G01 Z-' + gf(e) + ' F110.',
            'N170 G01 X-' + gf(x) + ' F300.',
            'N180 Y-' + gf(y) + '.',
            'N190 X' + gf(x) + '.',
            'N200 Y' + gf(y) + '.',
            'N210 X-' + gf(x) + '.',
            'N220 Y-' + gf(y) + '.');
        if (st.rasgo.included) {
            L.push('N230 G00 Z2.',
                '',
                '(=== RASGO ' + gf(sl) + ' X ' + gf(sw) + ' - LIMPEZA INTERNA ===)',
                '(DEGRESSEMENTOS A PARTIR DO CENTRO)',
                'N240 G00 X0. Y0.',
                'N250 G01 Z-' + gf(e) + ' F100.',
                '#100 = 0.  (APROVEITADO COMO ENDERECO - VER MACRO)',
                'N260 G01 X-' + gf(sl / 2 - sw / 2) + ' F260.',
                'N270 Y-' + gf(sw / 2) + '.',
                'N280 X' + gf(sl / 2 - sw / 2) + '.',
                'N290 Y' + gf(sw / 2) + '.',
                'N300 X-' + gf(sl / 2 - sw / 2) + '.',
                'N310 Y0.',
                'N320 G00 Z2.');
        }
        if (st.furos.included) {
            L.push('',
                '(=== PADRAO DE 4 FUROS D' + gf(hd) + ' ===)',
                '(COORDENADAS: +-' + gf(px) + ' / +-' + gf(py) + ')',
                'N330 T03 M06',
                'N340 S1800 M03',
                'N350 G00 G54 X' + gf(-px) + ' Y' + gf(-py) + '.',
                'N360 G43 Z50. H03',
                'N370 G81 X' + gf(-px) + ' Y' + gf(-py) + ' Z-' + gf(e + 2) + ' R2. F140.',
                'N380 X' + gf(px),
                'N390 Y' + gf(py),
                'N400 X' + gf(-px),
                'N410 G80');
        }
        if (st.chamfer.included) {
            L.push('',
                '(=== CHANFRO C' + gf(d.chanfro) + ' NO CONTORNO ===)',
                'N420 T04 M06',
                'N430 S2400 M03',
                'N440 G00 G54 X-' + gf(x) + ' Y-' + gf(y) + '.',
                'N450 G43 Z50. H04',
                'N460 G01 Z-' + gf(d.chanfro) + ' F100.',
                'N470 G01 X' + gf(x) + ' F320.',
                'N480 Y' + gf(y) + '.',
                'N490 X-' + gf(x) + '.',
                'N500 Y-' + gf(y) + '.');
        }
        L.push('N510 G00 Z100. M09', 'N520 M05', 'N530 G91 G28 Z0.', 'N540 M30', '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [], w = d.largura, dd = d.comprimento, e = d.espessura;
        const sl = d.rasgoComp, sw = d.rasgoLarg, hd = d.diamFuro;
        L.push('%',
            'O1002 (PLACA COM RASGO - MACRO PARAMETRICO)',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(w) + '   (LARGURA)',
            '#101 = ' + gf(dd) + '   (COMPRIMENTO)',
            '#102 = ' + gf(e) + '    (ESPESSURA)',
            '#103 = ' + gf(sl) + '    (COMP. RASGO)',
            '#104 = ' + gf(sw) + '    (LARG. RASGO)',
            '#105 = ' + gf(hd) + '      (DIAM. FUROS)',
            '#106 = ' + gf(d.espX) + '   (ESPACAMENTO X)',
            '#107 = ' + gf(d.espY) + '    (ESPACAMENTO Y)',
            '',
            '(=== CALCULOS ===)',
            '#110 = #100 / 2',
            '#111 = #101 / 2',
            '#112 = #103 / 2',
            '#113 = #104 / 2',
            '#114 = #106 / 2',
            '#115 = #107 / 2',
            '',
            'G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== FACEAMENTO ===)',
            'T01 M06 S3000 M03',
            'G00 G54 X[-#110 - 30] Y[-#111 - 30]',
            'G43 Z50. H01 M08',
            'G01 Z0. F120.',
            'G01 X[#110 + 30] F480.',
            'Y[#111 + 30]',
            'X[-#110 - 30]',
            'Y[-#111 - 30]',
            'G00 Z50.',
            '',
            '(=== CONTORNO ===)',
            'T02 M06 S3500 M03',
            'G00 X[-#110 - 10] Y[-#111 - 10]',
            'G43 Z50. H02',
            'G01 Z[-#102] F110.',
            'G01 X[-#110] F300.',
            'Y[-#111]',
            'X#110',
            'Y#111',
            'X[-#110]',
            'Y[-#111]');
        if (st.rasgo.included) {
            L.push('',
                '(=== RASGO - LIMPEZA COM VARREDURA ===)',
                'G00 X0. Y0.',
                'G01 Z[-#102] F100.',
                '#120 = -#113   (VARREDURA EM Y)',
                'WHILE [#120 LE #113] DO1',
                '  G01 X[-#112 + #113] F260.  (CORTE LIMPO NAS PONTAS)',
                '  Y#120',
                '  X[#112 - #113]',
                '  #120 = #120 + [#104 * 0.6]',
                '  Y#120',
                '  X[-#112 + #113]',
                '  #120 = #120 + [#104 * 0.6]',
                'END1',
                'G00 Z2.');
        }
        if (st.furos.included) {
            L.push('',
                '(=== PADRAO DE FUROS - LACO 2X2 ===)',
                'T03 M06 S1800 M03',
                'G43 Z50. H03',
                '#130 = -1   (CONTADOR EM X)',
                'WHILE [#130 LE 1] DO2',
                '  #131 = -1  (CONTADOR EM Y)',
                '  WHILE [#131 LE 1] DO3',
                '    G81 X[#130 * #114] Y[#131 * #115] Z[-#102 - 2] R2. F140.',
                '    #131 = #131 + 2',
                '  END3',
                '  #130 = #130 + 2',
                'END2',
                'G80');
        }
        if (st.chamfer.included) {
            L.push('',
                '(=== CHANFRO PARAMETRICO ===)',
                '#140 = ' + gf(d.chanfro) + '  (TAMANHO DO CHANFRO)',
                'T04 M06 S2400 M03',
                'G00 X[-#110] Y[-#111]',
                'G43 Z50. H04',
                'G01 Z[-#140] F100.',
                'G01 X#110 F320.',
                'Y#111',
                'X[-#110]',
                'Y[-#111]');
        }
        L.push('G00 Z100. M09', 'M05', 'G91 G28 Z0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 3 — FLANGE CIRCULAR (fresamento circular + padrão polar)
// ============================================================
const flange = {
    id: 'flange',
    name: 'Flange circular',
    tag: 'FLANGE-CIRCULAR',
    rev: 'B',
    process: 'Fresamento circular',
    machine: 'Centro de usinagem 3 eixos',
    control: 'ISO 6983 (FANUC/Siemens)',
    stock: 'Disco Ø125 × 22 mm',
    difficulty: 'Intermediário',
    icon: '⚙️',
    desc: 'Contorno circular (G02/G03), furo central e padrão polar de furos. O clássico para treinar círculos primitivos e SIN/COS.',
    exampleFile: 'flange-circular_rev-B.pdf',
    cssScene: false,
    viewLabels: ['SUPERIOR', 'FRONTAL', 'CORTE A-A', 'DETALHE B'],
    features: [{
        id: 'disco',
        name: 'Disco externo',
        hint: 'Círculo extrudado (corpo do flange)',
        included: true,
        params: [
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 120 },
            { key: 'espessura', label: 'esp.', unit: 'mm', value: 18 }
        ]
    }, {
        id: 'furo_central',
        name: 'Furo central',
        hint: 'Furo passante central',
        included: true,
        params: [{ key: 'diametro', label: 'diâm.', unit: 'mm', value: 40 }]
    }, {
        id: 'furos_cp',
        name: 'Furos no círculo primitivo',
        hint: 'Padrão polar de furos',
        included: true,
        params: [
            { key: 'quantidade', label: 'qtd', unit: 'un', value: 6 },
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 10 },
            { key: 'diametro_cp', label: 'Ø CP', unit: 'mm', value: 90 }
        ]
    }, {
        id: 'chamfer',
        name: 'Chanfro',
        hint: 'Chanfro nos bordos do furo central',
        included: true,
        params: [{ key: 'tamanho', label: 'tam.', unit: 'mm', value: 2 }]
    }],
    dimsFromState(st) {
        return {
            diametro: st.disco.params.diametro,
            espessura: st.disco.params.espessura,
            furoCentral: st.furo_central.params.diametro,
            qtdFuros: Math.max(2, Math.round(st.furos_cp.params.quantidade)),
            diamFuros: st.furos_cp.params.diametro,
            diamCP: st.furos_cp.params.diametro_cp,
            chanfro: st.chamfer.params.tamanho
        };
    },
    computeMass(d, st) {
        let vol = Math.PI * Math.pow(d.diametro / 2, 2) * d.espessura;
        if (st.furo_central.included) vol -= Math.PI * Math.pow(d.furoCentral / 2, 2) * d.espessura;
        if (st.furos_cp.included) vol -= d.qtdFuros * Math.PI * Math.pow(d.diamFuros / 2, 2) * d.espessura;
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Diâmetro externo', value: 'Ø' + fmt(d.diametro) + ' mm' },
            { label: 'Espessura', value: fmt(d.espessura) + ' mm' },
            { label: 'Furo central', value: st.furo_central.included ? 'Ø' + fmt(d.furoCentral) + ' mm' : '—' },
            { label: 'Furos do CP', value: st.furos_cp.included ? d.qtdFuros + ' × Ø' + fmt(d.diamFuros) + ' mm' : '—' },
            { label: 'Círculo primitivo', value: st.furos_cp.included ? 'Ø' + fmt(d.diamCP) + ' mm' : '—' },
            { label: 'Chanfro', value: st.chamfer.included ? fmt(d.chanfro) + ' × 45°' : '—' },
            { label: 'Tolerância', value: 'ISO 2768-m' },
            { label: 'Acabamento', value: 'Usinagem' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'base_sketch', title: 'Esboçar o Disco', badge: 'SKETCH',
            desc: 'Sketch no plano Top com círculo de Ø' + fmt(d.diametro) + 'mm centralizado na origem.',
            tip: 'Use Smart Dimension para definir o diâmetro.'
        });
        defs.push({
            id: 'base_extrude', title: 'Extrudar o Disco', badge: 'EXTRUDE',
            desc: 'Extrusão de ' + fmt(d.espessura) + 'mm formando o corpo do flange.',
            tip: 'Confirme a espessura na vista frontal da folha.'
        });
        if (st.furo_central.included) {
            defs.push({
                id: 'hole_center', title: 'Furo Central', badge: 'HOLE',
                desc: 'Furo passante central de Ø' + fmt(d.furoCentral) + 'mm.',
                tip: 'Posicione o furo exatamente na origem do sketch.'
            });
        }
        if (st.furos_cp.included) {
            defs.push({
                id: 'bolt_sketch', title: 'Esboçar 1 Furo do Padrão', badge: 'SKETCH',
                desc: 'Desenhe 1 furo de Ø' + fmt(d.diamFuros) + 'mm sobre o círculo primitivo de Ø' + fmt(d.diamCP) + 'mm.',
                tip: 'Use um círculo de referência (construction) para o CP.'
            });
            defs.push({
                id: 'bolt_pattern', title: 'Padrão Circular', badge: 'PATTERN',
                desc: 'Circular Pattern com ' + d.qtdFuros + ' furos espaçados igualmente (360°/' + d.qtdFuros + ' = ' + fmt(360 / d.qtdFuros) + '°).',
                tip: 'Selecione o eixo central da peça como referência do padrão.'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Chanfro no Furo Central', badge: 'CHAMFER',
                desc: 'Aplique chanfro de ' + fmt(d.chanfro) + 'mm × 45° nas bordas do furo central.',
                tip: 'Selecione ambos os loops (superior e inferior) do furo.'
            });
        }
        return defs;
    },
    stepCmd: {
        base_sketch: 'circle', base_extrude: 'extrude', hole_center: 'hole',
        bolt_sketch: 'circle', bolt_pattern: 'circularPattern', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const D = d.diametro, e = d.espessura, fc = d.furoCentral;
        const n = d.qtdFuros, df = d.diamFuros, cp = d.diamCP;
        const cx = 120, cy = 110, R = D / 2;
        const cs = Math.max(3, Math.min(d.chanfro, 12));

        // SUPERIOR
        let sup = svgCircle(cx, cy, R, 'surface');
        if (st.furo_central.included) sup += svgCircle(cx, cy, fc / 2, 'hole');
        if (st.furos_cp.included) {
            sup += svgCircle(cx, cy, cp / 2, 'hidden');
            for (let i = 0; i < n; i++) {
                const ang = 2 * Math.PI * i / n - Math.PI / 2;
                sup += svgCircle(cx + Math.cos(ang) * cp / 2, cy + Math.sin(ang) * cp / 2, df / 2, 'hole');
            }
            sup += svgText(cx + cp / 2 + df / 2 + 12, cy - cp / 2 * 0.6, 'Ø' + fmt(df), 'dim-text');
        }
        sup += svgLine(cx - R - 18, cy, cx + R + 18, cy, 'dim') +
            svgLine(cx, cy - R - 18, cx, cy + R + 18, 'dim');
        sup += dimH(cx - R, cx + R, cy + R + 22, 'Ø' + fmt(D)) +
            (st.furo_central.included ? dimH(cx - fc / 2, cx + fc / 2, cy - R - 22, 'Ø' + fmt(fc), -8) : '') +
            (st.furos_cp.included ? dimH(cx - cp / 2, cx + cp / 2, cy + R + 48, 'Ø' + fmt(cp)) : '');

        // FRONTAL
        let frontal = svgRect(cx - R, 60, D, e, 'surface');
        if (st.furo_central.included) {
            frontal += svgLine(cx - fc / 2, 60, cx - fc / 2, 60 + e, 'hidden') +
                svgLine(cx + fc / 2, 60, cx + fc / 2, 60 + e, 'hidden');
        }
        if (st.furos_cp.included) {
            [-cp / 2, cp / 2].forEach(dx => {
                frontal += svgLine(cx + dx, 60, cx + dx, 60 + e, 'hidden');
            });
        }
        if (st.chamfer.included && st.furo_central.included) {
            frontal += svgPolyline([[cx - fc / 2, 60], [cx - fc / 2 + cs, 60 + cs], [cx - fc / 2, 60 + cs]], 'chamfer-line');
        }
        frontal += dimV(60, 60 + e, 36, fmt(e), 'rot-l') +
            dimH(cx - R, cx + R, 60 + e + 22, 'Ø' + fmt(D));

        // CORTE A-A
        let corte = svgRect(cx - R, 60, D, e, 'surface') + hatchBlock();
        if (st.furo_central.included) {
            corte += svgRect(cx - R, 60, R - fc / 2, e, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                svgRect(cx + fc / 2, 60, R - fc / 2, e, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                dimH(cx - fc / 2, cx + fc / 2, 60 + e + 22, 'Ø' + fmt(fc));
        } else {
            corte += svgRect(cx - R, 60, D, e, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        }
        corte += dimV(60, 60 + e, 36, fmt(e), 'rot-l') +
            dimH(cx - R, cx + R, 60 - 22, 'Ø' + fmt(D), -8) +
            svgText(cx, 48, 'A-A', 'label', 'middle');

        // DETALHE B (chanfro ampliado)
        let det = '';
        const zx = 70, zy = 70, zw = 120, zh = 80;
        if (st.chamfer.included && st.furo_central.included) {
            det += svgRect(zx, zy, zw, zh * 0.35, 'surface') +
                svgRect(zx, zy + zh * 0.35, zw, zh * 0.65, 'hole') +
                svgPolyline([[zx, zy], [zx + 22, zy + 22], [zx, zy + 22]], 'chamfer-line') +
                dimH(zx, zx + 22, zy + 40, fmt(d.chanfro)) +
                dimV(zy, zy + 22, zx + 34, fmt(d.chanfro), 'start-r') +
                svgText(zx + 140, zy + 20, 'ESCALA 4:1', 'label') +
                svgText(zx + 140, zy + 36, 'CHANFRO ' + fmt(d.chanfro) + ' x 45°', 'label');
        } else {
            det += svgRect(zx, zy, zw, zh, 'surface') +
                svgText(zx + 10, zy + zh / 2, 'SEM CHANFRO', 'label');
        }
        det = svgText(zx - 26, zy + 6, 'B', 'label') + det;

        return [
            { svg: createSVG(sup, '8 12 224 236', t) },
            { svg: createSVG(frontal, '8 12 ' + (D + 100) + ' ' + (e + 88), t) },
            { svg: createSVG(corte, '8 12 ' + (D + 100) + ' ' + (e + 88), t) },
            { svg: createSVG(det, '30 40 260 140', t) }
        ];
    },
    gcode(d, st) {
        const L = [], D = d.diametro, e = d.espessura, fc = d.furoCentral;
        const n = d.qtdFuros, df = d.diamFuros, cp = d.diamCP, R = D / 2;
        L.push('%',
            'O0003 (FLANGE CIRCULAR - FRESAMENTO)',
            '(PECA: FLANGE D' + fmt(D) + ' X ' + fmt(e) + ' - REV B)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: DISCO D' + fmt(D + 5) + ' X ' + fmt(e + 4) + ')',
            '(T01 - FRESA PLANA D50 - FACEAMENTO)',
            '(T02 - FRESA D12 - CONTORNO CIRCULAR)',
            '(T03 - BROCA D' + fmt(Math.min(df, 12)) + ' - FUROS DO CP)',
            '(T04 - FRESA DE CHANFRO 90G - C' + fmt(d.chanfro) + ')',
            '(G54 - ORIGEM NO CENTRO, FACE SUPERIOR Z0)',
            'N10 G21 G90 G17 G40 G49 G80 G94',
            'N20 T01 M06',
            'N30 S2800 M03',
            'N40 G00 G54 X-' + gf(R + 30) + ' Y-' + gf(R + 30) + '.',
            'N50 G43 Z50. H01 M08',
            'N60 G01 Z0. F120.',
            'N70 G01 X' + gf(R + 30) + ' F450.',
            'N80 Y' + gf(R + 30) + '.',
            'N90 X-' + gf(R + 30) + '.',
            'N100 G00 Z50.',
            '',
            '(=== CONTORNO CIRCULAR D' + gf(D) + ' - INTERPOLACAO G02 ===)',
            'N110 T02 M06',
            'N120 S3200 M03',
            'N130 G00 X-' + gf(R + 8) + ' Y0.',
            'N140 G43 Z50. H02',
            'N150 G01 Z-' + gf(e) + ' F110.',
            'N160 G01 X-' + gf(R) + ' F280.',
            'N170 G02 X-' + gf(R) + ' Y0. I' + gf(R) + ' J0.  (VOLTA COMPLETA HORARIA)');
        let lineNo = 180;
        if (st.furo_central.included) {
            const rr = fc / 2;
            L.push('N180 G00 Z2.',                '',
                '(=== FURO CENTRAL D' + gf(fc) + ' - INTERPOLACAO HELICOIDAL ===)',
                '(REBAIXO EM ESPIRAL COM DEGRESSEMENTO DE ' + gf(Math.min(3, e / 4)) + 'MM)',
                'N190 G00 X-' + gf(rr - 4) + ' Y0.',
                'N200 G01 Z0. F100.',
                'N210 G02 I' + gf(rr - 4) + ' Z-' + gf(Math.min(3, e / 4)) + ' F220.',
                'N220 G02 I' + gf(rr - 4) + ' Z-' + gf(2 * Math.min(3, e / 4)) + '.');
            let zc = 2 * Math.min(3, e / 4);
            lineNo = 230;
            while (zc < e - 1) {
                zc = Math.min(zc + Math.min(3, e / 4), e);
                L.push('N' + lineNo + ' G02 I' + gf(rr - 4) + ' Z-' + gf(zc) + '.');
                lineNo += 10;
            }
            L.push('N' + lineNo + ' G02 I' + gf(rr - 4) + '  (ACABAMENTO DA PAREDE)',
                'N' + (lineNo + 10) + ' G00 Z50.');
            lineNo += 20;
        }
        if (st.furos_cp.included) {
            L.push('',
                '(=== ' + n + ' FUROS D' + gf(df) + ' NO CP D' + gf(cp) + ' ===)',
                '(ANGULO ENTRE FUROS: ' + fmt(360 / n) + 'G - COORDENADAS FIXADAS)');
            let ln = lineNo;
            L.push('N' + ln + ' T03 M06', 'N' + (ln + 10) + ' S1800 M03', 'N' + (ln + 20) + ' G43 Z50. H03');
            ln += 30;
            for (let i = 0; i < n; i++) {
                const ang = 2 * Math.PI * i / n - Math.PI / 2;
                const px = cp / 2 * Math.cos(ang), py = cp / 2 * Math.sin(ang);
                L.push('N' + ln + ' G81 X' + gf(px) + ' Y' + gf(py) + ' Z-' + gf(e + 2) + ' R2. F140.');
                ln += 10;
            }
            L.push('N' + ln + ' G80');
            lineNo = ln + 10;
        }
        if (st.chamfer.included && st.furo_central.included) {
            const rr = fc / 2;
            L.push('',
                '(=== CHANFRO NO FURO CENTRAL ===)',
                'N' + lineNo + ' T04 M06', 'N' + (lineNo + 10) + ' S2400 M03',
                'N' + (lineNo + 20) + ' G00 X-' + gf(rr - d.chanfro) + ' Y0.',
                'N' + (lineNo + 30) + ' G43 Z50. H04',
                'N' + (lineNo + 40) + ' G01 Z-' + gf(d.chanfro) + ' F100.',
                'N' + (lineNo + 50) + ' G02 I' + gf(rr - d.chanfro) + ' F300.');
            lineNo += 60;
        }
        L.push('N' + lineNo + ' G00 Z100. M09',
            'N' + (lineNo + 10) + ' M05',
            'N' + (lineNo + 20) + ' G91 G28 Z0.',
            'N' + (lineNo + 30) + ' M30',
            '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [], D = d.diametro, e = d.espessura, fc = d.furoCentral;
        const n = d.qtdFuros, df = d.diamFuros, cp = d.diamCP;
        L.push('%',
            'O1003 (FLANGE CIRCULAR - MACRO PARAMETRICO)',
            '(O PADRAO POLAR USA TRIGONOMETRIA: X = R*COS(A), Y = R*SIN(A))',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(D) + '   (DIAMETRO EXTERNO)',
            '#101 = ' + gf(e) + '    (ESPESSURA)',
            '#102 = ' + gf(fc) + '    (FURO CENTRAL)',
            '#103 = ' + n + '      (QTD FUROS DO CP)',
            '#104 = ' + gf(df) + '    (DIAMETRO DOS FUROS)',
            '#105 = ' + gf(cp) + '    (DIAMETRO DO CIRCULO PRIMITIVO)',
            '#106 = ' + gf(d.chanfro) + '      (CHANFRO)',
            '',
            '(=== CALCULOS ===)',
            '#110 = #100 / 2      (RAIO EXTERNO)',
            '#111 = #102 / 2      (RAIO DO FURO CENTRAL)',
            '#112 = #105 / 2      (RAIO DO CP)',
            '#113 = 360. / #103   (PASSO ANGULAR)',
            '',
            'G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== FACEAMENTO ===)',
            'T01 M06 S2800 M03',
            'G00 G54 X[-#110 - 30] Y[-#110 - 30]',
            'G43 Z50. H01 M08',
            'G01 Z0. F120.',
            'G01 X[#110 + 30] F450.',
            'Y[#110 + 30]',
            'X[-#110 - 30]',
            'G00 Z50.',
            '',
            '(=== CONTORNO CIRCULAR - G02 COM RAIO PARAMETRICO ===)',
            'T02 M06 S3200 M03',
            'G00 X[-#110 - 8] Y0.',
            'G43 Z50. H02',
            'G01 Z[-#101] F110.',
            'G01 X[-#110] F280.',
            'G02 X[-#110] Y0. I#110 J0.');
        if (st.furo_central.included) {
            L.push('',
                '(=== FURO CENTRAL - INTERPOLACAO HELICOIDAL ===)',
                '#120 = 0.  (PROFUNDIDADE ATUAL)',
                '#121 = 3.  (DEGRESSEMENTO POR VOLTA)',
                'G00 X[-#111 + 4] Y0.',
                'G01 Z0. F100.',
                'WHILE [#120 LT #101] DO1',
                '  #120 = #120 + #121',
                '  IF [#120 GT #101] THEN #120 = #101',
                '  G02 I[#111 - 4] Z[-#120] F220.',
                'END1',
                'G02 I[#111 - 4]   (ACABAMENTO)',
                'G00 Z50.');
        }
        if (st.furos_cp.included) {
            L.push('',
                '(=== PADRAO POLAR - LACO COM COS/SIN ===)',
                'T03 M06 S1800 M03',
                'G43 Z50. H03',
                '#130 = 0.  (ANGULO ATUAL)',
                'WHILE [#130 LT 360.] DO2',
                '  #131 = #112 * COS[#130]   (COORDENADA X)',
                '  #132 = #112 * SIN[#130]   (COORDENADA Y)',
                '  G81 X#131 Y#132 Z[-#101 - 2] R2. F140.',
                '  #130 = #130 + #113',
                'END2',
                'G80');
        }
        if (st.chamfer.included && st.furo_central.included) {
            L.push('',
                '(=== CHANFRO PARAMETRICO ===)',
                'T04 M06 S2400 M03',
                'G00 X[-#111 + #106] Y0.',
                'G43 Z50. H04',
                'G01 Z[-#106] F100.',
                'G02 I[#111 - #106] F300.');
        }
        L.push('G00 Z100. M09', 'M05', 'G91 G28 Z0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 4 — CAIXA COM CAVIDADE (fresamento de cavidade)
// ============================================================
const caixaCavidade = {
    id: 'caixa-cavidade',
    name: 'Caixa com cavidade',
    tag: 'CAIXA-CAVIDADE',
    rev: 'A',
    process: 'Fresamento de cavidade',
    machine: 'Centro de usinagem 3 eixos',
    control: 'ISO 6983 (FANUC/Siemens)',
    stock: 'Bloco 125 × 85 × 35 mm',
    difficulty: 'Intermediário',
    icon: '📦',
    desc: 'Bloco com cavidade (pocket) e furos de fixação na brida. Treina desbaste de cavidade com passadas e acabamento de parede.',
    exampleFile: 'caixa-cavidade_rev-A.pdf',
    cssScene: false,
    viewLabels: ['SUPERIOR', 'FRONTAL', 'LATERAL ESQ.', 'CORTE A-A'],
    features: [{
        id: 'bloco',
        name: 'Bloco externo',
        hint: 'Corpo da caixa (extrusão)',
        included: true,
        params: [
            { key: 'largura', label: 'largura', unit: 'mm', value: 120 },
            { key: 'profundidade', label: 'prof.', unit: 'mm', value: 80 },
            { key: 'altura', label: 'altura', unit: 'mm', value: 30 }
        ]
    }, {
        id: 'cavidade',
        name: 'Cavidade interna',
        hint: 'Pocket com profundidade controlada',
        included: true,
        params: [
            { key: 'largura', label: 'largura', unit: 'mm', value: 90 },
            { key: 'profundidade', label: 'prof.', unit: 'mm', value: 50 },
            { key: 'prof_corte', label: 'prof. corte', unit: 'mm', value: 20 }
        ]
    }, {
        id: 'furos_fix',
        name: 'Furos de fixação',
        hint: '4 furos na brida ao redor da cavidade',
        included: true,
        params: [
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 6 },
            { key: 'espacamentoX', label: 'espaç. X', unit: 'mm', value: 100 },
            { key: 'espacamentoY', label: 'espaç. Y', unit: 'mm', value: 60 }
        ]
    }],
    dimsFromState(st) {
        return {
            largura: st.bloco.params.largura,
            profundidade: st.bloco.params.profundidade,
            altura: st.bloco.params.altura,
            cavL: st.cavidade.params.largura,
            cavP: st.cavidade.params.profundidade,
            cavD: st.cavidade.params.prof_corte,
            diamFuro: st.furos_fix.params.diametro,
            espX: st.furos_fix.params.espacamentoX,
            espY: st.furos_fix.params.espacamentoY
        };
    },
    computeMass(d, st) {
        let vol = d.largura * d.profundidade * d.altura;
        if (st.cavidade.included) vol -= d.cavL * d.cavP * Math.min(d.cavD, d.altura);
        if (st.furos_fix.included) vol -= 4 * Math.PI * Math.pow(d.diamFuro / 2, 2) * d.altura;
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Largura', value: fmt(d.largura) + ' mm' },
            { label: 'Profundidade', value: fmt(d.profundidade) + ' mm' },
            { label: 'Altura', value: fmt(d.altura) + ' mm' },
            { label: 'Cavidade', value: st.cavidade.included ? fmt(d.cavL) + ' × ' + fmt(d.cavP) + ' × ' + fmt(d.cavD) + ' mm' : '—' },
            { label: 'Parede da brida', value: st.cavidade.included ? fmt((d.largura - d.cavL) / 2) + ' mm (mín.)' : '—' },
            { label: 'Furos de fixação', value: st.furos_fix.included ? '4 × Ø' + fmt(d.diamFuro) + ' mm' : '—' },
            { label: 'Padrão de furos', value: st.furos_fix.included ? fmt(d.espX) + ' × ' + fmt(d.espY) + ' mm' : '—' },
            { label: 'Tolerância', value: 'ISO 2768-m' },
            { label: 'Acabamento', value: 'Usinagem' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'base_sketch', title: 'Esboçar o Bloco', badge: 'SKETCH',
            desc: 'Sketch no plano Top: retângulo ' + fmt(d.largura) + 'mm × ' + fmt(d.profundidade) + 'mm.',
            tip: 'Centralize o retângulo na origem.'
        });
        defs.push({
            id: 'base_extrude', title: 'Extrudar o Bloco', badge: 'EXTRUDE',
            desc: 'Extrusão de ' + fmt(d.altura) + 'mm formando o corpo da caixa.',
            tip: 'A altura define a profundidade disponível para a cavidade.'
        });
        if (st.cavidade.included) {
            defs.push({
                id: 'pocket_sketch', title: 'Esboçar a Cavidade', badge: 'SKETCH',
                desc: 'Na face superior, desenhe o retângulo da cavidade: ' + fmt(d.cavL) + 'mm × ' + fmt(d.cavP) + 'mm.',
                tip: 'Deixe a brida com espessura uniforme: ' + fmt((d.largura - d.cavL) / 2) + 'mm de cada lado.'
            });
            defs.push({
                id: 'pocket_cut', title: 'Fresar a Cavidade (Pocket)', badge: 'POCKET',
                desc: 'Extruded Cut com profundidade de ' + fmt(d.cavD) + 'mm (parcial, ' + fmt(d.altura - d.cavD) + 'mm de fundo).',
                tip: 'Não use Through All — a profundidade do fundo é dimensionada.'
            });
        }
        if (st.furos_fix.included) {
            defs.push({
                id: 'hole_pattern', title: 'Furos de Fixação', badge: 'HOLE',
                desc: '4 furos de Ø' + fmt(d.diamFuro) + 'mm na brida, padrão ' + fmt(d.espX) + 'mm × ' + fmt(d.espY) + 'mm.',
                tip: 'Um furo + Linear Pattern em X e Y economiza tempo.'
            });
        }
        return defs;
    },
    stepCmd: {
        base_sketch: 'sketchTop', base_extrude: 'extrude', pocket_sketch: 'sketchTop',
        pocket_cut: 'extrudeCut', hole_pattern: 'linearPattern'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const w = d.largura, dd = d.profundidade, h = d.altura;
        const cl = d.cavL, cp = d.cavP, cd = Math.min(d.cavD, h - 2);
        const hd = d.diamFuro, px = Math.min(d.espX, w - hd - 4), py = Math.min(d.espY, dd - hd - 4);
        const x0 = 50, y0 = 50;

        // SUPERIOR
        let sup = svgRect(x0, y0, w, dd, 'surface');
        if (st.cavidade.included) {
            sup += svgRect(x0 + w / 2 - cl / 2, y0 + dd / 2 - cp / 2, cl, cp, 'hole') +
                dimH(x0 + w / 2 - cl / 2, x0 + w / 2 + cl / 2, y0 + dd / 2 + cp / 2 + 18, fmt(cl)) +
                dimV(y0 + dd / 2 - cp / 2, y0 + dd / 2 + cp / 2, x0 + w / 2 - cl / 2 - 14, fmt(cp), 'end-l');
        }
        if (st.furos_fix.included) {
            [[-px / 2, -py / 2], [px / 2, -py / 2], [-px / 2, py / 2], [px / 2, py / 2]].forEach(p => {
                sup += svgCircle(x0 + w / 2 + p[0], y0 + dd / 2 + p[1], hd / 2, 'hole');
            });
            sup += svgText(x0 + w / 2 + px / 2 + hd / 2 + 10, y0 + dd / 2 - py / 2, 'Ø' + fmt(hd), 'dim-text');
        }
        sup += dimH(x0, x0 + w, y0 + dd + 20, fmt(w)) +
            dimV(y0, y0 + dd, x0 + w + 24, fmt(dd), 'start-r') +
            svgLine(x0 - 10, y0 + dd / 2, x0 + w + 10, y0 + dd / 2, 'cut-line') +
            svgText(x0 - 5, y0 + dd / 2 - 6, 'A', 'label', 'end') +
            svgText(x0 + w + 10, y0 + dd / 2 - 6, 'A', 'label');

        // FRONTAL
        let frontal = svgRect(x0, y0, w, h, 'surface');
        if (st.cavidade.included) {
            frontal += svgLine(x0 + w / 2 - cl / 2, y0, x0 + w / 2 - cl / 2, y0 + cd, 'hidden') +
                svgLine(x0 + w / 2 + cl / 2, y0, x0 + w / 2 + cl / 2, y0 + cd, 'hidden') +
                svgLine(x0 + w / 2 - cl / 2, y0 + cd, x0 + w / 2 + cl / 2, y0 + cd, 'hidden');
        }
        if (st.furos_fix.included) {
            [-px / 2, px / 2].forEach(dx => {
                frontal += svgLine(x0 + w / 2 + dx, y0, x0 + w / 2 + dx, y0 + h, 'hidden');
            });
        }
        frontal += dimV(y0, y0 + h, 30, fmt(h), 'rot-l') +
            dimH(x0, x0 + w, y0 + h + 20, fmt(w));
        if (st.cavidade.included) {
            frontal += dimV(y0, y0 + cd, x0 + w + 20, fmt(cd), 'start-r');
        }

        // LATERAL
        let lat = svgRect(x0, y0, dd, h, 'surface');
        if (st.cavidade.included) {
            lat += svgLine(x0 + dd / 2 - cp / 2, y0, x0 + dd / 2 - cp / 2, y0 + cd, 'hidden') +
                svgLine(x0 + dd / 2 + cp / 2, y0, x0 + dd / 2 + cp / 2, y0 + cd, 'hidden') +
                svgLine(x0 + dd / 2 - cp / 2, y0 + cd, x0 + dd / 2 + cp / 2, y0 + cd, 'hidden');
        }
        lat += dimV(y0, y0 + h, 30, fmt(h), 'rot-l') +
            dimH(x0, x0 + dd, y0 + h + 20, fmt(dd));

        // CORTE A-A
        let corte = hatchBlock();
        if (st.cavidade.included) {
            corte += svgRect(x0, y0, w / 2 - cl / 2, h, 'surface') +
                svgRect(x0 + w / 2 + cl / 2, y0, w / 2 - cl / 2, h, 'surface') +
                svgRect(x0, y0, w / 2 - cl / 2, h, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                svgRect(x0 + w / 2 + cl / 2, y0, w / 2 - cl / 2, h, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                svgRect(x0 + w / 2 - cl / 2, y0 + cd, cl, h - cd, 'surface') +
                svgRect(x0 + w / 2 - cl / 2, y0 + cd, cl, h - cd, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                dimH(x0 + w / 2 - cl / 2, x0 + w / 2 + cl / 2, y0 + cd - 14, fmt(cl), -8) +
                dimV(y0, y0 + cd, x0 + w / 2, fmt(cd), 'start-r');
        } else {
            corte += svgRect(x0, y0, w, h, 'surface') +
                svgRect(x0, y0, w, h, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        }
        corte += dimV(y0, y0 + h, 30, fmt(h), 'rot-l') +
            dimH(x0, x0 + w, y0 + h + 20, fmt(w)) +
            svgText(x0 + w / 2, y0 - 10, 'A-A', 'label', 'middle');

        return [
            { svg: createSVG(sup, '8 8 ' + (w + 110) + ' ' + (dd + 100), t) },
            { svg: createSVG(frontal, '8 12 ' + (w + 100) + ' ' + (h + 88), t) },
            { svg: createSVG(lat, '8 12 ' + (dd + 100) + ' ' + (h + 88), t) },
            { svg: createSVG(corte, '8 12 ' + (w + 100) + ' ' + (h + 88), t) }
        ];
    },
    gcode(d, st) {
        const L = [], w = d.largura, dd = d.profundidade, h = d.altura;
        const cl = d.cavL, cp = d.cavP, cd = d.cavD, hd = d.diamFuro;
        const px = d.espX / 2, py = d.espY / 2;
        const x = w / 2, y = dd / 2;
        const step = 6; // passo de desbaste da fresa D12
        L.push('%',
            'O0004 (CAIXA COM CAVIDADE - FRESAMENTO DE POCKET)',
            '(PECA: ' + fmt(w) + ' X ' + fmt(dd) + ' X ' + fmt(h) + ' - REV A)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: BLOCO ' + fmt(w + 5) + ' X ' + fmt(dd + 5) + ' X ' + fmt(h + 4) + ')',
            '(T01 - FRESA PLANA D50 - FACEAMENTO)',
            '(T02 - FRESA D12 - CONTORNO E DESBASTE DA CAVIDADE)',
            '(T03 - BROCA D' + fmt(hd) + ' - FUROS DE FIXACAO)',
            '(G54 - ORIGEM NO CENTRO, FACE SUPERIOR Z0)',
            'N10 G21 G90 G17 G40 G49 G80 G94',
            'N20 T01 M06',
            'N30 S2800 M03',
            'N40 G00 G54 X-' + gf(x + 30) + ' Y-' + gf(y + 30) + '.',
            'N50 G43 Z50. H01 M08',
            'N60 G01 Z0. F120.',
            'N70 G01 X' + gf(x + 30) + ' F450.',
            'N80 Y' + gf(y + 30) + '.',
            'N90 X-' + gf(x + 30) + '.',
            'N100 G00 Z50.',
            '',
            '(=== CONTORNO EXTERNO ===)',
            'N110 T02 M06',
            'N120 S3200 M03',
            'N130 G00 X-' + gf(x + 10) + ' Y-' + gf(y + 10) + '.',
            'N140 G43 Z50. H02',
            'N150 G01 Z-' + gf(h) + ' F100.',
            'N160 G01 X-' + gf(x) + ' F280.',
            'N170 Y-' + gf(y) + '.',
            'N180 X' + gf(x) + '.',
            'N190 Y' + gf(y) + '.',
            'N200 X-' + gf(x) + '.',
            'N210 Y-' + gf(y) + '.');
        if (st.cavidade.included) {
            const cxl = cl / 2 - 6, cyp = cp / 2 - 6;
            L.push('N220 G00 Z2.',
                '',
                '(=== DESBASTE DA CAVIDADE ' + gf(cl) + ' X ' + gf(cp) + ' X ' + gf(cd) + ' ===)',
                '(VARREDURA EM ZIG-ZAG, SULCOS DE ' + gf(step) + 'MM, PROFUNDIDADE ' + gf(Math.min(4, cd / 2)) + 'MM/PASSADA)');
            let ln = 230, z = 0;
            while (z < cd - 0.01) {
                z = Math.min(z + Math.min(4, cd / 2), cd);
                L.push('N' + ln + ' G00 X-' + gf(cxl) + ' Y-' + gf(cyp));
                ln += 10;
                L.push('N' + ln + ' G01 Z-' + gf(z) + ' F90.');
                ln += 10;
                let yy = -cyp, going = true;
                while (yy < cyp - 0.01) {
                    const target = going ? cyp : Math.max(yy + step > cyp ? cyp : yy + step, -cyp);
                    if (going) {
                        L.push('N' + ln + ' G01 Y' + gf(cyp) + ' F240.');
                        yy = cyp;
                    } else {
                        const ny = Math.min(yy + step, cyp);
                        L.push('N' + ln + ' G01 Y' + gf(ny) + ' F240.');
                        yy = ny;
                    }
                    going = !going;
                    if (yy < cyp - 0.01) {
                        const nx = going ? cxl : -cxl;
                        L.push('N' + ln + ' G01 X' + gf(nx));
                        ln += 10;
                    }
                    ln += 10;
                }
            }
            L.push('N' + ln + ' G00 Z2.');
            ln += 10;
            L.push('N' + ln + ' G00 X-' + gf(cl / 2 - 3) + ' Y-' + gf(cp / 2 - 3) + '  (ACABAMENTO DAS PAREDES)');
            ln += 10;
            L.push('N' + ln + ' G01 Z-' + gf(cd) + ' F90.');
            ln += 10;
            L.push('N' + ln + ' G01 X-' + gf(cl / 2) + ' F200.',
                'N' + (ln + 10) + ' Y-' + gf(cp / 2) + '.',
                'N' + (ln + 20) + ' X' + gf(cl / 2) + '.',
                'N' + (ln + 30) + ' Y' + gf(cp / 2) + '.',
                'N' + (ln + 40) + ' X-' + gf(cl / 2) + '.',
                'N' + (ln + 50) + ' Y-' + gf(cp / 2) + '.');
            ln += 60;
            L.push('N' + ln + ' G00 Z50.');
        }
        if (st.furos_fix.included) {
            let ln = 500;
            L.push('',
                '(=== FUROS DE FIXACAO D' + gf(hd) + ' ===)',
                'N' + ln + ' T03 M06',
                'N' + (ln + 10) + ' S1800 M03',
                'N' + (ln + 20) + ' G43 Z50. H03',
                'N' + (ln + 30) + ' G81 X' + gf(-px) + ' Y' + gf(-py) + ' Z-' + gf(h + 2) + ' R2. F140.',
                'N' + (ln + 40) + ' X' + gf(px),
                'N' + (ln + 50) + ' Y' + gf(py),
                'N' + (ln + 60) + ' X' + gf(-px),
                'N' + (ln + 70) + ' G80');
        }
        L.push('N900 G00 Z100. M09', 'N910 M05', 'N920 G91 G28 Z0.', 'N930 M30', '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [], w = d.largura, dd = d.profundidade, h = d.altura;
        const cl = d.cavL, cp = d.cavP, cd = d.cavD, hd = d.diamFuro;
        L.push('%',
            'O1004 (CAIXA COM CAVIDADE - MACRO PARAMETRICO)',
            '(O POCKET USA LACOS ANINHADOS: VARREDURA EM X DEPOIS EM Y)',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(w) + '   (LARGURA DO BLOCO)',
            '#101 = ' + gf(dd) + '    (PROFUNDIDADE DO BLOCO)',
            '#102 = ' + gf(h) + '    (ALTURA DO BLOCO)',
            '#103 = ' + gf(cl) + '    (LARGURA DA CAVIDADE)',
            '#104 = ' + gf(cp) + '    (PROFUNDIDADE DA CAVIDADE)',
            '#105 = ' + gf(cd) + '    (PROF. DE CORTE DA CAVIDADE)',
            '#106 = ' + gf(hd) + '      (FUROS DE FIXACAO)',
            '#107 = ' + gf(d.espX) + '   (ESPACAMENTO X)',
            '#108 = ' + gf(d.espY) + '    (ESPACAMENTO Y)',
            '#109 = 6.     (PASSO DO DESBASTE)',
            '',
            '(=== CALCULOS ===)',
            '#110 = #100 / 2',
            '#111 = #101 / 2',
            '#112 = #103 / 2 - 6   (LIMITE X DO DESBASTE)',
            '#113 = #104 / 2 - 6   (LIMITE Y DO DESBASTE)',
            '#114 = #107 / 2',
            '#115 = #108 / 2',
            '',
            'G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== FACEAMENTO ===)',
            'T01 M06 S2800 M03',
            'G00 G54 X[-#110 - 30] Y[-#111 - 30]',
            'G43 Z50. H01 M08',
            'G01 Z0. F120.',
            'G01 X[#110 + 30] F450.',
            'Y[#111 + 30]',
            'X[-#110 - 30]',
            'G00 Z50.',
            '',
            '(=== CONTORNO EXTERNO ===)',
            'T02 M06 S3200 M03',
            'G00 X[-#110 - 10] Y[-#111 - 10]',
            'G43 Z50. H02',
            'G01 Z[-#102] F100.',
            'G01 X[-#110] F280.',
            'Y[-#111]',
            'X#110',
            'Y#111',
            'X[-#110]',
            'Y[-#111]');
        if (st.cavidade.included) {
            L.push('',
                '(=== DESBASTE DA CAVIDADE ===)',
                '(LACO EXTERNO: PROFUNDIDADE | LACO INTERNO: ZIG-ZAG EM Y)',
                '#120 = 0.   (PROFUNDIDADE ATUAL)',
                'WHILE [#120 LT #105] DO1',
                '  #120 = #120 + 4',
                '  IF [#120 GT #105] THEN #120 = #105',
                '  G00 X[-#112] Y[-#113]',
                '  G01 Z[-#120] F90.',
                '  #121 = -#113   (VARREDURA Y)',
                '  #122 = 1       (SENTIDO: 1 = +Y, 0 = -Y)',
                '  WHILE [#121 LT #113] DO2',
                '    IF [#122 EQ 1] THEN #123 = #113',
                '    IF [#122 EQ 0] THEN #123 = #121 + #109',
                '    IF [#123 GT #113] THEN #123 = #113',
                '    G01 Y#123 F240.',
                '    #121 = #123',
                '    IF [#122 EQ 1] THEN #122 = 0 ELSE #122 = 1',
                '    IF [#121 LT #113] THEN G01 X[-#112 * #122 + #112 * [1 - #122]]',
                '  END2',
                'END1',
                'G00 Z2.',
                '',
                '(=== ACABAMENTO DAS PAREDES ===)',
                'G00 X[-#103 / 2 + 3] Y[-#104 / 2 + 3]',
                'G01 Z[-#105] F90.',
                'G01 X[-#103 / 2] F200.',
                'Y[-#104 / 2]',
                'X[#103 / 2]',
                'Y[#104 / 2]',
                'X[-#103 / 2]',
                'Y[-#104 / 2]',
                'G00 Z50.');
        }
        if (st.furos_fix.included) {
            L.push('',
                '(=== FUROS DE FIXACAO - LACO 2X2 ===)',
                'T03 M06 S1800 M03',
                'G43 Z50. H03',
                '#130 = -1',
                'WHILE [#130 LE 1] DO3',
                '  #131 = -1',
                '  WHILE [#131 LE 1] DO4',
                '    G81 X[#130 * #114] Y[#131 * #115] Z[-#102 - 2] R2. F140.',
                '    #131 = #131 + 2',
                '  END4',
                '  #130 = #130 + 2',
                'END3',
                'G80');
        }
        L.push('G00 Z100. M09', 'M05', 'G91 G28 Z0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 5 — EIXO ESCALONADO (torneamento CNC)
// ============================================================
const eixoEscalonado = {
    id: 'eixo-escalonado',
    name: 'Eixo escalonado',
    tag: 'EIXO-ESCALONADO',
    rev: 'A',
    process: 'Torneamento CNC',
    machine: 'Torno CNC (comando FANUC)',
    control: 'ISO 6983 (FANUC G71/G70)',
    stock: 'Barra Ø55 × 165 mm',
    difficulty: 'Intermediário',
    icon: '🔄',
    desc: 'Eixo com 3 degraus, chanfros e rasgo de retentor. Treina perfil de revolução, G71 (desbaste) e G70 (acabamento).',
    exampleFile: 'eixo-escalonado_rev-A.pdf',
    cssScene: false,
    isTurning: true,
    viewLabels: ['PERFIL', 'FRONTAL', 'SEÇÃO A-A', 'DETALHE B'],
    features: [{
        id: 'degraus',
        name: 'Degraus do eixo',
        hint: 'Perfil de revolução com 3 diâmetros',
        included: true,
        params: [
            { key: 'diam1', label: 'Ø1', unit: 'mm', value: 50 },
            { key: 'comp1', label: 'comp. 1', unit: 'mm', value: 40 },
            { key: 'diam2', label: 'Ø2', unit: 'mm', value: 35 },
            { key: 'comp2', label: 'comp. 2', unit: 'mm', value: 60 },
            { key: 'diam3', label: 'Ø3', unit: 'mm', value: 25 },
            { key: 'comp3', label: 'comp. 3', unit: 'mm', value: 50 }
        ]
    }, {
        id: 'rasgo',
        name: 'Rasgo de retentor',
        hint: 'Rebaixo circular no degrau central',
        included: true,
        params: [
            { key: 'diametro', label: 'Ø rasgo', unit: 'mm', value: 30 },
            { key: 'largura', label: 'largura', unit: 'mm', value: 5 },
            { key: 'posicao', label: 'posição Z', unit: 'mm', value: 70 }
        ]
    }, {
        id: 'chamfer',
        name: 'Chanfros',
        hint: 'Chanfros nas transições e extremidades',
        included: true,
        params: [{ key: 'tamanho', label: 'tam.', unit: 'mm', value: 2 }]
    }],
    dimsFromState(st) {
        return {
            d1: st.degraus.params.diam1,
            c1: st.degraus.params.comp1,
            d2: st.degraus.params.diam2,
            c2: st.degraus.params.comp2,
            d3: st.degraus.params.diam3,
            c3: st.degraus.params.comp3,
            rasgoD: st.rasgo.params.diametro,
            rasgoL: st.rasgo.params.largura,
            rasgoZ: st.rasgo.params.posicao,
            chanfro: st.chamfer.params.tamanho
        };
    },
    computeMass(d, st) {
        let vol = Math.PI / 4 * (d.d1 * d.d1 * d.c1 + d.d2 * d.d2 * d.c2 + d.d3 * d.d3 * d.c3);
        if (st.rasgo.included) {
            const dz = Math.min(d.rasgoL, d.c2);
            vol -= Math.PI / 4 * (d.d2 * d.d2 - d.rasgoD * d.rasgoD) * dz;
        }
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Ø1 (cabeça)', value: 'Ø' + fmt(d.d1) + ' × ' + fmt(d.c1) + ' mm' },
            { label: 'Ø2 (intermediário)', value: 'Ø' + fmt(d.d2) + ' × ' + fmt(d.c2) + ' mm' },
            { label: 'Ø3 (extremidade)', value: 'Ø' + fmt(d.d3) + ' × ' + fmt(d.c3) + ' mm' },
            { label: 'Comprimento total', value: fmt(d.c1 + d.c2 + d.c3) + ' mm' },
            { label: 'Rasgo', value: st.rasgo.included ? 'Ø' + fmt(d.rasgoD) + ' × ' + fmt(d.rasgoL) + ' mm' : '—' },
            { label: 'Chanfros', value: st.chamfer.included ? fmt(d.chanfro) + ' × 45°' : '—' },
            { label: 'Tolerância', value: 'h7 (eixos)' },
            { label: 'Acabamento', value: 'Retificado' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'shaft_sketch', title: 'Esboçar o Perfil', badge: 'SKETCH',
            desc: 'Em um plano que contenha o eixo, desenhe o perfil do eixo com Line: Ø' + fmt(d.d1) + ' × ' + fmt(d.c1) +
                ', Ø' + fmt(d.d2) + ' × ' + fmt(d.c2) + ', Ø' + fmt(d.d3) + ' × ' + fmt(d.c3) + 'mm.',
            tip: 'Desenhe só metade do perfil e use a linha de centro como referência de revolução.'
        });
        defs.push({
            id: 'shaft_revolve', title: 'Revolver o Perfil', badge: 'REVOLVE',
            desc: 'Revolved Boss/Base 360° usando a linha de centro como eixo.',
            tip: 'Confira os 3 degraus na vista frontal da folha.'
        });
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Aplicar Chanfros', badge: 'CHAMFER',
                desc: 'Chanfros de ' + fmt(d.chanfro) + 'mm × 45° nas transições de diâmetro e nas extremidades.',
                tip: 'São 4 chanfros: 2 transições + 2 extremidades.'
            });
        }
        if (st.rasgo.included) {
            defs.push({
                id: 'groove_sketch', title: 'Esboçar o Rasgo', badge: 'SKETCH',
                desc: 'Sketch do retângulo do rasgo (Ø' + fmt(d.rasgoD) + 'mm × ' + fmt(d.rasgoL) + 'mm) a ' + fmt(d.rasgoZ) + 'mm da face.',
                tip: 'O rasgo fica no degrau central (Ø' + fmt(d.d2) + 'mm).'
            });
            defs.push({
                id: 'groove_cut', title: 'Revolved Cut do Rasgo', badge: 'CUT',
                desc: 'Revolved Cut 360° para abrir o rasgo de retentor.',
                tip: 'Alternativamente, use a ferramenta Groove (ranhura).'
            });
        }
        return defs;
    },
    stepCmd: {
        shaft_sketch: 'sketchTop', shaft_revolve: 'revolve', chamfer: 'chamfer',
        groove_sketch: 'sketchTop', groove_cut: 'revolveCut'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const total = d.c1 + d.c2 + d.c3;
        const maxD = Math.max(d.d1, d.d2, d.d3);
        const x0 = 60, axisY = 50 + maxD / 2 + 20;
        const cs = Math.max(2, Math.min(d.chanfro, 8));

        // PERFIL (com eixo de simetria)
        const prof = (hatch) => {
            let s = svgRect(x0, axisY - d.d1 / 2, d.c1, d.d1, hatch ? 'hatch-fill' : 'surface',
                hatch ? 'fill="url(#hatchPattern)" opacity="0.3"' : '') +
                svgRect(x0 + d.c1, axisY - d.d2 / 2, d.c2, d.d2, hatch ? 'hatch-fill' : 'surface-wall',
                    hatch ? 'fill="url(#hatchPattern)" opacity="0.3"' : '') +
                svgRect(x0 + d.c1 + d.c2, axisY - d.d3 / 2, d.c3, d.d3, hatch ? 'hatch-fill' : 'surface',
                    hatch ? 'fill="url(#hatchPattern)" opacity="0.3"' : '');
            return s;
        };
        let perfil = prof(false) +
            svgLine(x0 - 20, axisY, x0 + total + 20, axisY, 'cut-line');
        if (st.rasgo.included) {
            const rz = Math.max(x0 + d.c1, Math.min(x0 + d.rasgoZ, x0 + d.c1 + d.c2 - d.rasgoL));
            perfil += svgRect(rz, axisY - d.rasgoD / 2, d.rasgoL, d.rasgoD, 'hole');
        }
        if (st.chamfer.included) {
            perfil += svgPolyline([[x0, axisY - d.d1 / 2], [x0 + cs, axisY - d.d1 / 2 + cs], [x0 + cs, axisY - d.d1 / 2]], 'chamfer-line') +
                svgPolyline([[x0 + total, axisY + d.d3 / 2], [x0 + total - cs, axisY + d.d3 / 2 - cs], [x0 + total - cs, axisY + d.d3 / 2]], 'chamfer-line');
        }
        perfil += dimV(axisY - d.d1 / 2, axisY + d.d1 / 2, 38, 'Ø' + fmt(d.d1), 'rot-l') +
            dimV(axisY - d.d2 / 2, axisY + d.d2 / 2, x0 + d.c1 + d.c2 / 2, 'Ø' + fmt(d.d2), 'end-l') +
            dimV(axisY - d.d3 / 2, axisY + d.d3 / 2, x0 + total + 22, 'Ø' + fmt(d.d3), 'start-r') +
            dimH(x0, x0 + d.c1, axisY + maxD / 2 + 30, fmt(d.c1)) +
            dimH(x0 + d.c1, x0 + d.c1 + d.c2, axisY + maxD / 2 + 30, fmt(d.c2)) +
            dimH(x0 + d.c1 + d.c2, x0 + total, axisY + maxD / 2 + 30, fmt(d.c3)) +
            dimH(x0, x0 + total, axisY + maxD / 2 + 55, fmt(total)) +
            svgLine(x0 - 12, axisY - maxD / 2 - 12, x0 - 12, axisY + maxD / 2 + 12, 'cut-line') +
            svgLine(x0 + total + 12, axisY - maxD / 2 - 12, x0 + total + 12, axisY + maxD / 2 + 12, 'cut-line') +
            svgText(x0 - 18, axisY - maxD / 2 - 16, 'A', 'label', 'end') +
            svgText(x0 + total + 12, axisY - maxD / 2 - 16, 'A', 'label');

        // FRONTAL (vista de face)
        const fcx = 110, fcy = 110;
        let frontal = svgCircle(fcx, fcy, d.d1 / 2, 'surface') +
            svgLine(fcx - d.d1 / 2 - 14, fcy, fcx + d.d1 / 2 + 14, fcy, 'cut-line') +
            svgLine(fcx, fcy - d.d1 / 2 - 14, fcx, fcy + d.d1 / 2 + 14, 'cut-line') +
            dimH(fcx - d.d1 / 2, fcx + d.d1 / 2, fcy + d.d1 / 2 + 22, 'Ø' + fmt(d.d1));

        // SEÇÃO A-A
        let secao = prof(true) +
            svgLine(x0 - 20, axisY, x0 + total + 20, axisY, 'cut-line') +
            dimH(x0, x0 + total, axisY + maxD / 2 + 30, fmt(total)) +
            svgText(x0 + total / 2, axisY - maxD / 2 - 12, 'A-A', 'label', 'middle');

        // DETALHE B (transição Ø2 → Ø3 com chanfro)
        let det = '';
        const zx = 60, zy = 60;
        det += svgRect(zx, zy, 100, 24, 'surface-wall') +
            svgRect(zx + 100, zy + 8, 80, 16, 'surface');
        if (st.chamfer.included) {
            det += svgPolyline([[zx + 100, zy], [zx + 100 - cs * 3, zy + cs * 3], [zx + 100 - cs * 3, zy]], 'chamfer-line') +
                dimH(zx + 100 - cs * 3, zx + 100, zy + 40, fmt(d.chanfro));
        }
        det += svgText(zx + 120, zy - 10, 'ESCALA 4:1 - TRANSICAO ' + fmt(d.d2) + '/' + fmt(d.d3), 'label');
        det = svgText(zx - 26, zy + 6, 'B', 'label') + det;

        return [
            { svg: createSVG(perfil, '20 8 ' + (total + 130) + ' ' + (maxD + 140), t) },
            { svg: createSVG(frontal, '20 20 200 200', t) },
            { svg: createSVG(secao, '20 8 ' + (total + 130) + ' ' + (maxD + 120), t) },
            { svg: createSVG(det, '30 30 260 110', t) }
        ];
    },
    gcode(d, st) {
        const L = [], total = d.c1 + d.c2 + d.c3;
        const ch = st.chamfer.included ? d.chanfro : 0;
        L.push('%',
            'O0005 (EIXO ESCALONADO - TORNEAMENTO CNC)',
            '(PECA: Ø' + fmt(d.d1) + '/Ø' + fmt(d.d2) + '/Ø' + fmt(d.d3) + ' L' + fmt(total) + ' - REV A)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: BARRA Ø' + fmt(Math.max(d.d1, d.d2, d.d3) + 5) + ' X ' + fmt(total + 15) + ')',
            '(T01 - SERRILHA ROUGHING 80G - DESBASTE)',
            '(T02 - ACABAMENTO 55G - PERFIL FINAL)',
            '(T03 - RANHURADORA 3MM - RASGO DE RETENTOR)',
            '(ORIGEM G54 NO BICO DA PECA / EIXO DE ROTACAO)',
            'N10 G21 G99 G97 G40',
            'N20 T0101 M03 S1200',
            'N30 G00 X' + gf(Math.max(d.d1, d.d2, d.d3) + 6) + ' Z2. M08',
            '',
            '(=== DESBASTE COM G71 - CICLO DE TORNEAMENTO ===)',
            '(U = PROF. DE PASSE, R = RETORNO DE SEGURANCA)',
            'N40 G71 U1.5 R0.5',
            '(P/Q = BLOCOS DO PERFIL, U/W = SOBREMATERIAL DE ACABAMENTO)',
            'N50 G71 P100 Q200 U0.3 W0.1 F0.25',
            '',
            '(=== PERFIL DA PECA (BLOCOS N100 A N200) ===)',
            'N100 G00 X' + gf(d.d3 - 2 * ch) + '  (INICIO DO PERFIL)');
        if (ch) {
            L.push('N110 G01 X' + gf(d.d3) + ' Z-' + gf(ch) + ' F0.12  (CHANFRO EXTREMIDADE)',
                'N120 Z-' + gf(d.c3) + '  (DEGRAU Ø' + gf(d.d3) + ')',
                'N130 X' + gf(d.d2 - 2 * ch) + '  (TRANSICAO)');
            if (st.rasgo.included) {
                const z1 = Math.max(d.c3, Math.min(d.rasgoZ, d.c3 + d.c2 - d.rasgoL));
                L.push('N140 X' + gf(d.d2) + ' Z-' + gf(d.c3 + ch) + '  (CHANFRO TRANSICAO)',
                    'N150 Z-' + gf(z1) + '  (ATE O RASGO)',
                    'N160 X' + gf(d.rasgoD) + '  (RASGO Ø' + gf(d.rasgoD) + ' - VER T03)',
                    'N170 Z-' + gf(z1 + Math.min(d.rasgoL, d.c2)) + '.',
                    'N180 X' + gf(d.d2) + ' Z-' + gf(d.c3 + d.c2) + '  (FIM DO DEGRAU Ø' + gf(d.d2) + ')');
            } else {
                L.push('N140 X' + gf(d.d2) + ' Z-' + gf(d.c3 + ch) + '  (CHANFRO TRANSICAO)',
                    'N150 Z-' + gf(d.c3 + d.c2) + '  (DEGRAU Ø' + gf(d.d2) + ')');
            }
            L.push('N190 X' + gf(d.d1 - 2 * ch) + '  (TRANSICAO PARA Ø' + gf(d.d1) + ')',
                'N195 X' + gf(d.d1) + ' Z-' + gf(d.c3 + d.c2 + ch) + '  (CHANFRO)',
                'N200 Z-' + gf(total) + '  (DEGRAU Ø' + gf(d.d1) + ')');
        } else {
            L.push('N110 G01 X' + gf(d.d3) + ' Z0. F0.12',
                'N120 Z-' + gf(d.c3) + '.',
                'N130 X' + gf(d.d2) + '.',
                'N140 Z-' + gf(d.c3 + d.c2) + '.',
                'N150 X' + gf(d.d1) + '.',
                'N200 Z-' + gf(total) + '.');
        }
        L.push('N210 G00 X' + gf(Math.max(d.d1, d.d2, d.d3) + 20) + ' Z20.',
            '',
            '(=== ACABAMENTO COM G70 ===)',
            'N220 T0202 M03 S1800',
            'N230 G00 X' + gf(Math.max(d.d1, d.d2, d.d3) + 6) + ' Z2.',
            'N240 G70 P100 Q200 F0.12',
            'N250 G00 X' + gf(Math.max(d.d1, d.d2, d.d3) + 20) + ' Z20.');
        if (st.rasgo.included) {
            const z1 = Math.max(d.c3, Math.min(d.rasgoZ, d.c3 + d.c2 - d.rasgoL));
            L.push('',
                '(=== RASGO DE RETENTOR Ø' + gf(d.rasgoD) + ' ===)',
                'N260 T0303 M03 S800',
                'N270 G00 X' + gf(d.d2 + 2) + ' Z-' + gf(z1) + '.',
                'N280 G01 X' + gf(d.rasgoD) + ' F0.06  (CORTE RADIAL)',
                'N290 G04 X0.2  (DEMORA NO FUND0)',
                'N300 G01 X' + gf(d.d2 + 2) + ' F0.2  (RECOLHIMENTO)',
                'N310 Z-' + gf(z1 + Math.min(d.rasgoL, d.c2)) + '.',
                'N320 G01 X' + gf(d.rasgoD) + ' F0.06',
                'N330 G04 X0.2',
                'N340 G01 X' + gf(d.d2 + 2) + ' F0.2',
                'N350 G00 X' + gf(Math.max(d.d1, d.d2, d.d3) + 20) + ' Z20.');
        }
        L.push('N400 M09', 'N410 M05', 'N420 G28 U0. W0.', 'N430 M30', '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [], total = d.c1 + d.c2 + d.c3;
        L.push('%',
            'O1005 (EIXO ESCALONADO - MACRO PARAMETRICO)',
            '(TODOS OS DEGRAUS SAO CALCULADOS A PARTIR DOS COMPRIMENTOS)',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(d.d1) + '   (Ø1 - CABECA)',
            '#101 = ' + gf(d.c1) + '    (COMP 1)',
            '#102 = ' + gf(d.d2) + '    (Ø2 - INTERMEDIARIO)',
            '#103 = ' + gf(d.c2) + '    (COMP 2)',
            '#104 = ' + gf(d.d3) + '    (Ø3 - EXTREMIDADE)',
            '#105 = ' + gf(d.c3) + '    (COMP 3)',
            '#106 = ' + gf(d.chanfro) + '      (CHANFRO)',
            '#107 = ' + gf(d.rasgoD) + '    (Ø DO RASGO)',
            '#108 = ' + gf(d.rasgoL) + '      (LARGURA DO RASGO)',
            '#109 = ' + gf(d.rasgoZ) + '    (POSICAO Z DO RASGO)',
            '',
            '(=== CALCULOS ===)',
            '#110 = #105 + #103          (Z DA TRANSICAO 3/2)',
            '#111 = #110 + #103          (Z DA TRANSICAO 2/1)',
            '#112 = #111 + #101          (COMPRIMENTO TOTAL)',
            '#113 = #109 + #108          (FIM DO RASGO)',
            '#114 = 3.                   (PROF. DE PASSE)',
            '',
            'G21 G99 G97 G40',
            'T0101 M03 S1200',
            'G00 X[#100 + 6] Z2. M08',
            '',
            '(=== DESBASTE COM G71 PARAMETRICO ===)',
            'G71 U1.5 R0.5',
            'G71 P100 Q200 U0.3 W0.1 F0.25',
            'N100 G00 X[#104 - 2 * #106]',
            'N110 G01 X#104 Z[-#106] F0.12  (CHANFRO)',
            'N120 Z[-#105]  (DEGRAU 3)',
            'N130 X[#102 - 2 * #106]',
            'N140 X#102 Z[-#105 - #106]  (TRANSICAO 3/2)');
        if (st.rasgo.included) {
            L.push('N150 Z[-#109]  (ATE O RASGO)',
                'N160 X#107  (RASGO)',
                'N170 Z[-#113]',
                'N180 X#102 Z[-#110]  (FIM DEGRU 2)');
        } else {
            L.push('N150 Z[-#110]  (DEGRAU 2)');
        }
        L.push('N190 X[#100 - 2 * #106]',
            'N195 X#100 Z[-#110 - #106]  (TRANSICAO 2/1)',
            'N200 Z[-#112]  (DEGRAU 1 / FIM)',
            'N210 G00 X[#100 + 20] Z20.',
            '',
            '(=== ACABAMENTO ===)',
            'T0202 M03 S1800',
            'G00 X[#100 + 6] Z2.',
            'G70 P100 Q200 F0.12',
            'G00 X[#100 + 20] Z20.');
        if (st.rasgo.included) {
            L.push('',
                '(=== RASGO COM LACO DE CORTE ===)',
                'T0303 M03 S800',
                '#120 = #109   (Z ATUAL DO CORTE)',
                'WHILE [#120 LE #113] DO1',
                '  G00 X[#102 + 2] Z[-#120]',
                '  G01 X#107 F0.06',
                '  G04 X0.2',
                '  G01 X[#102 + 2] F0.2',
                '  #120 = #120 + 3  (PASSO DA LAMINA)',
                'END1',
                'G00 X[#100 + 20] Z20.');
        }
        L.push('M09', 'M05', 'G28 U0. W0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// REGISTRO DE PARTES
// ============================================================
const PARTS = {
    'suporte-l': suporteL,
    'placa-rasgo': placaRasgo,
    'flange': flange,
    'caixa-cavidade': caixaCavidade,
    'eixo-escalonado': eixoEscalonado
};
const DEFAULT_PART_ID = 'suporte-l';
