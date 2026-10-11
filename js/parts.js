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
// PARTE 6 — CUNHA INCLINADA (fresamento de rampa)
// ============================================================
const cunha = {
    id: 'cunha',
    name: 'Cunha inclinada',
    tag: 'CUNHA-INCLINADA',
    rev: 'A',
    process: 'Fresamento de rampa',
    machine: 'Centro de usinagem 3 eixos',
    control: 'ISO 6983 (FANUC/Siemens)',
    stock: 'Bloco 125 × 85 × 45 mm',
    difficulty: 'Intermediário',
    icon: '📐',
    desc: 'Plano inclinado com furação. Treina rampas com movimento simultâneo X/Z e profundidade variável calculada ponto a ponto.',
    exampleFile: 'cunha-inclinada_rev-A.pdf',
    cssScene: false,
    viewLabels: ['PERFIL', 'PLANTA', 'LATERAL ESQ.', 'CORTE A-A'],
    features: [{
        id: 'cunha_feat',
        name: 'Corpo da cunha',
        hint: 'Perfil trapezoidal extrudado (rampa)',
        included: true,
        params: [
            { key: 'comprimento', label: 'comp.', unit: 'mm', value: 120 },
            { key: 'largura', label: 'largura', unit: 'mm', value: 80 },
            { key: 'altura_max', label: 'alt. máx', unit: 'mm', value: 40 },
            { key: 'altura_min', label: 'alt. mín', unit: 'mm', value: 10 }
        ]
    }, {
        id: 'furos',
        name: 'Furos passantes',
        hint: '4 furos atravessando a espessura variável',
        included: true,
        params: [
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 8 },
            { key: 'espacamentoX', label: 'espaç. X', unit: 'mm', value: 80 },
            { key: 'espacamentoY', label: 'espaç. Y', unit: 'mm', value: 50 }
        ]
    }, {
        id: 'chamfer',
        name: 'Chanfro',
        hint: 'Chanfro nas arestas superiores',
        included: true,
        params: [{ key: 'tamanho', label: 'tam.', unit: 'mm', value: 2 }]
    }],
    dimsFromState(st) {
        return {
            comp: st.cunha_feat.params.comprimento,
            larg: st.cunha_feat.params.largura,
            hMax: st.cunha_feat.params.altura_max,
            hMin: st.cunha_feat.params.altura_min,
            diamFuro: st.furos.params.diametro,
            espX: st.furos.params.espacamentoX,
            espY: st.furos.params.espacamentoY,
            chanfro: st.chamfer.params.tamanho
        };
    },
    slopeAngle(d) {
        return Math.atan2(Math.max(d.hMax - d.hMin, 0), d.comp) * 180 / Math.PI;
    },
    // altura do topo inclinado na posição x (medida a partir do fundo)
    heightAt(d, x) {
        return d.hMax - (d.hMax - d.hMin) * x / d.comp;
    },
    computeMass(d, st) {
        let vol = d.comp * d.larg * (d.hMax + d.hMin) / 2;
        if (st.furos.included) {
            // furo com profundidade local da rampa
            const hMed = (d.hMax + d.hMin) / 2;
            vol -= 4 * Math.PI * Math.pow(d.diamFuro / 2, 2) * hMed;
        }
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Comprimento (rampa)', value: fmt(d.comp) + ' mm' },
            { label: 'Largura', value: fmt(d.larg) + ' mm' },
            { label: 'Altura máxima', value: fmt(d.hMax) + ' mm' },
            { label: 'Altura mínima', value: fmt(d.hMin) + ' mm' },
            { label: 'Ângulo da rampa', value: fmt(this.slopeAngle(d)) + '°' },
            { label: 'Furos', value: st.furos.included ? '4 × Ø' + fmt(d.diamFuro) + ' mm (prof. variável)' : '—' },
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
            id: 'wedge_sketch', title: 'Esboçar o Perfil da Cunha', badge: 'SKETCH',
            desc: 'Em um plano lateral, desenhe o trapézio: ' + fmt(d.hMax) + 'mm de altura numa extremidade, ' +
                fmt(d.hMin) + 'mm na outra, sobre ' + fmt(d.comp) + 'mm de comprimento.',
            tip: 'A rampa tem ' + fmt(this.slopeAngle(d)) + '° — use Smart Dimension na altura de cada extremidade.'
        });
        defs.push({
            id: 'wedge_extrude', title: 'Extrudar a Cunha', badge: 'EXTRUDE',
            desc: 'Extrusão do perfil com ' + fmt(d.larg) + 'mm de largura (Mid Plane mantém a simetria).',
            tip: 'Use Mid Plane para facilitar o posicionamento dos furos.'
        });
        if (st.furos.included) {
            defs.push({
                id: 'hole_pattern', title: 'Furos Passantes', badge: 'HOLE',
                desc: '4 furos de Ø' + fmt(d.diamFuro) + 'mm passantes, padrão ' + fmt(d.espX) + 'mm × ' + fmt(d.espY) +
                    'mm. Atenção: a profundidade de corte varia conforme a rampa.',
                tip: 'Use Through All — o comprimento da broca muda conforme a altura local da peça.'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Chanfro', badge: 'CHAMFER',
                desc: 'Chanfro de ' + fmt(d.chanfro) + 'mm × 45° nas arestas superiores do contorno.',
                tip: 'Cuidado com a aresta da rampa — selecione apenas as arestas horizontais.'
            });
        }
        return defs;
    },
    stepCmd: {
        wedge_sketch: 'sketchTop', wedge_extrude: 'extrude', hole_pattern: 'linearPattern', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const x0 = 60, baseY = 170;
        const ang = this.slopeAngle(d);
        const cs = Math.max(3, Math.min(d.chanfro, 12));

        // PERFIL (trapézio da rampa)
        let perfil = svgPolyline([
            [x0, baseY - d.hMax], [x0 + d.comp, baseY - d.hMin],
            [x0 + d.comp, baseY], [x0, baseY], [x0, baseY - d.hMax]
        ], 'surface');
        if (st.chamfer.included) {
            perfil += svgPolyline([[x0, baseY - d.hMax], [x0 + cs, baseY - d.hMax + cs], [x0 + cs, baseY - d.hMax]], 'chamfer-line');
        }
        perfil += dimV(baseY - d.hMax, baseY, 38, fmt(d.hMax), 'rot-l') +
            dimV(baseY - d.hMin, baseY, x0 + d.comp + 20, fmt(d.hMin), 'start-r') +
            dimH(x0, x0 + d.comp, baseY + 20, fmt(d.comp)) +
            svgText(x0 + d.comp * 0.35, baseY - d.hMax + 24, fmt(ang) + '°', 'dim-text') +
            svgLine(x0 - 10, baseY - (d.hMax + d.hMin) / 2, x0 + d.comp + 10, baseY - (d.hMax + d.hMin) / 2, 'cut-line') +
            svgText(x0 - 5, baseY - (d.hMax + d.hMin) / 2 - 6, 'A', 'label', 'end') +
            svgText(x0 + d.comp + 10, baseY - (d.hMax + d.hMin) / 2 - 6, 'A', 'label');

        // PLANTA
        const y0 = 60;
        let planta = svgRect(x0, y0, d.comp, d.larg, 'surface');
        if (st.furos.included) {
            const px = Math.min(d.espX, d.comp - 10) / 2, py = Math.min(d.espY, d.larg - 10) / 2;
            [[-px, -py], [px, -py], [-px, py], [px, py]].forEach(p => {
                planta += svgCircle(x0 + d.comp / 2 + p[0], y0 + d.larg / 2 + p[1], d.diamFuro / 2, 'hole');
            });
            planta += dimH(x0 + d.comp / 2 - px, x0 + d.comp / 2 + px, y0 - 18, fmt(d.espX), -8) +
                dimV(y0 + d.larg / 2 - py, y0 + d.larg / 2 + py, x0 + d.comp + 24, fmt(d.espY), 'start-r') +
                svgText(x0 + d.comp / 2 + px + d.diamFuro + 10, y0 + d.larg / 2 - py, 'Ø' + fmt(d.diamFuro), 'dim-text');
        }
        planta += dimH(x0, x0 + d.comp, y0 + d.larg + 20, fmt(d.comp)) +
            dimV(y0, y0 + d.larg, x0 - 20, fmt(d.larg), 'end-l') +
            svgText(x0 + d.comp / 2, y0 - 30, 'A-A (CORTE LONGITUDINAL)', 'label', 'middle');

        // LATERAL
        let lat = svgRect(x0, y0, d.larg, d.hMax, 'surface') +
            svgLine(x0, y0 + d.hMax - d.hMin, x0 + d.larg, y0 + d.hMax - d.hMin, 'hidden');
        lat += dimV(y0, y0 + d.hMax, 38, fmt(d.hMax), 'rot-l') +
            dimH(x0, x0 + d.larg, y0 + d.hMax + 20, fmt(d.larg));

        // CORTE A-A (perfil com furos de profundidade variável)
        let corte = svgPolyline([
            [x0, baseY - d.hMax], [x0 + d.comp, baseY - d.hMin],
            [x0 + d.comp, baseY], [x0, baseY], [x0, baseY - d.hMax]
        ], 'surface') + hatchBlock() +
            svgPolyline([
                [x0, baseY - d.hMax], [x0 + d.comp, baseY - d.hMin],
                [x0 + d.comp, baseY], [x0, baseY], [x0, baseY - d.hMax]
            ], 'hatch-fill') ;
        corte = corte.replace('class="hatch-fill"', 'class="hatch-fill" fill="url(#hatchPattern)" opacity="0.3"');
        if (st.furos.included) {
            const px = Math.min(d.espX, d.comp - 10) / 2;
            [-px, px].forEach(dx => {
                const hx = x0 + d.comp / 2 + dx;
                const localH = this.heightAt(d, d.comp / 2 + dx);
                corte += svgRect(hx - d.diamFuro / 2, baseY - localH, d.diamFuro, localH, 'hole');
                corte += svgText(hx + d.diamFuro / 2 + 8, baseY - localH / 2, 'prof. ' + fmt(localH), 'dim-text');
            });
        }
        corte += dimH(x0, x0 + d.comp, baseY + 20, fmt(d.comp)) +
            dimV(baseY - d.hMax, baseY, 38, fmt(d.hMax), 'rot-l') +
            svgText(x0 + d.comp / 2, baseY - d.hMax - 12, 'A-A', 'label', 'middle');

        return [
            { svg: createSVG(perfil, '20 20 ' + (d.comp + 130) + ' ' + (d.hMax + 120), t) },
            { svg: createSVG(planta, '20 20 ' + (d.comp + 130) + ' ' + (d.larg + 110), t) },
            { svg: createSVG(lat, '20 20 ' + (d.larg + 130) + ' ' + (d.hMax + 110), t) },
            { svg: createSVG(corte, '20 20 ' + (d.comp + 130) + ' ' + (d.hMax + 120), t) }
        ];
    },
    gcode(d, st) {
        const L = [], k = (d.hMax - d.hMin) / d.comp;
        const passo = 3; // mm por degrau de desbaste
        L.push('%',
            'O0006 (CUNHA INCLINADA - FRESAMENTO DE RAMPA)',
            '(PECA: RAMPA ' + fmt(d.comp) + ' X ' + fmt(d.larg) + ' H' + fmt(d.hMax) + '/' + fmt(d.hMin) + ')',
            '(ANGULO DA RAMPA: ' + fmt(this.slopeAngle(d)) + 'G)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: BLOCO ' + fmt(d.comp + 5) + ' X ' + fmt(d.larg + 5) + ' X ' + fmt(d.hMax + 4) + ')',
            '(T01 - FRESA PLANA D50 - FACEAMENTO)',
            '(T02 - FRESA D12 - DESBASTE E ACABAMENTO DA RAMPA)',
            '(T03 - BROCA D' + fmt(d.diamFuro) + ' - FUROS (PROF. VARIAVEL))',
            '(G54 - ORIGEM NA CANTO ESQ. INFERIOR DA RAMPA, TOPO H' + fmt(d.hMax) + ' = Z0)',
            'N10 G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== DESBASTE DA RAMPA EM DEGRAUS ===)',
            '(CADA PASSE DEIXA 0.3MM DE SOBREMATERIAL)',
            '(NIVEIS: PROFUNDIDADE CRESCE E A FAIXA EM X ACOMPANHA A RAMPA)');
        let ln = 20, depth = 0;
        while (depth < d.hMax - d.hMin - 0.5) {
            depth = Math.min(depth + passo, d.hMax - d.hMin);
            const xEnd = depth / k + 2; // onde a rampa está neste nível (+avanço)
            L.push('N' + ln + ' G00 X-5. Y-' + fmt(d.larg / 2 + 8),
                'N' + (ln + 10) + ' G01 Z-' + fmt(depth + 0.3) + ' F100.',
                'N' + (ln + 20) + ' G01 X' + fmt(Math.min(xEnd, d.comp + 2)) + ' F260.  (DEGRAU DA RAMPA)');
            ln += 30;
        }
        L.push('N' + ln + ' G00 Z2.',
            '',
            '(=== ACABAMENTO DA RAMPA ===)',
            '(PASSADA DIAGONAL: X E Z MOVEM JUNTOS - INTERPOLACAO LINEAR 2 EIXOS)');
        ln += 10;
        // 2 passadas de acabamento (bordas da largura)
        [-1, 1].forEach(side => {
            const y = side * (d.larg / 2 - 4);
            L.push('N' + ln + ' G00 X-5. Y' + fmt(y),
                'N' + (ln + 10) + ' G01 Z' + fmt(-0) + ' F90.',
                'N' + (ln + 20) + ' G01 X' + fmt(d.comp + 2) + ' Z-' + fmt(d.hMax - d.hMin) + ' F220.  (DESCIDA NA RAMPA)');
            ln += 30;
        });
        L.push('N' + ln + ' G00 Z2.  (POSICIONA PARA OS FUROS)');
        ln += 10;
        if (st.furos.included) {
            L.push('',
                '(=== FUROS COM PROFUNDIDADE CALCULADA ===)',
                '(PROF. = ALTURA LOCAL DA RAMPA + 2MM DE SAIDA)');
            L.push('N' + ln + ' T03 M06', 'N' + (ln + 10) + ' S1800 M03', 'N' + (ln + 20) + ' G43 Z50. H03');
            ln += 30;
            const px = Math.min(d.espX, d.comp - 10) / 2, py = Math.min(d.espY, d.larg - 10) / 2;
            [[-px, -py], [px, -py], [-px, py], [px, py]].forEach((p, i) => {
                const xPart = d.comp / 2 + p[0];
                const localH = this.heightAt(d, xPart);
                L.push('N' + ln + ' G83 X' + fmt(xPart) + ' Y' + fmt(d.larg / 2 + p[1]) +
                    ' Z-' + fmt(localH + 2) + ' R2. Q3. F130.  (FURO ' + (i + 1) + ')');
                ln += 10;
            });
            L.push('N' + ln + ' G80');
            ln += 10;
        }
        L.push('N' + ln + ' G00 Z100. M09',
            'N' + (ln + 10) + ' M05',
            'N' + (ln + 20) + ' G91 G28 Z0.',
            'N' + (ln + 30) + ' M30',
            '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [];
        L.push('%',
            'O1006 (CUNHA INCLINADA - MACRO PARAMETRICO)',
            '(A RAMPA E UMA FUNCAO: Z(X) = HMAX - (HMAX-HMIN) * X / COMP)',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(d.comp) + '   (COMPRIMENTO)',
            '#101 = ' + gf(d.larg) + '    (LARGURA)',
            '#102 = ' + gf(d.hMax) + '    (ALTURA MAXIMA)',
            '#103 = ' + gf(d.hMin) + '    (ALTURA MINIMA)',
            '#104 = ' + gf(d.diamFuro) + '      (DIAMETRO DOS FUROS)',
            '#105 = ' + gf(d.espX) + '    (ESPACAMENTO X)',
            '#106 = ' + gf(d.espY) + '    (ESPACAMENTO Y)',
            '',
            '(=== CALCULOS ===)',
            '#110 = #100 / 2      (CENTRO EM X)',
            '#111 = #101 / 2      (CENTRO EM Y)',
            '#112 = #102 - #103   (DESNIVEL DA RAMPA)',
            '#113 = #112 / #100   (INCLINACAO = TANGENTE)',
            '',
            'G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== DESBASTE DA RAMPA - LACO POR NIVEIS ===)',
            'T02 M06 S3200 M03',
            'G43 Z50. H02 M08',
            '#120 = 0.   (PROFUNDIDADE ATUAL)',
            'WHILE [#120 LT #112] DO1',
            '  #120 = #120 + 3',
            '  IF [#120 GT #112] THEN #120 = #112',
            '  #121 = #120 / #113 + 2   (FIM EM X NESTE NIVEL)',
            '  G00 X-5. Y[-#111 - 8]',
            '  G01 Z[-#120 - 0.3] F100.',
            '  G01 X#121 F260.',
            'END1',
            'G00 Z2.',
            '',
            '(=== ACABAMENTO DIAGONAL DA RAMPA ===)',
            'G00 X-5. Y[-#111 + 4]',
            'G01 Z0. F90.',
            'G01 X[#100 + 2] Z[-#112] F220.  (X E Z SIMULTANEOS)',
            'G00 Z2.');
        if (st.furos.included) {
            L.push('',
                '(=== FUROS - PROFUNDIDADE CALCULADA PELA RAMPA ===)',
                'T03 M06 S1800 M03',
                'G43 Z50. H03',
                '#130 = -1   (COLUNA EM X)',
                'WHILE [#130 LE 1] DO2',
                '  #131 = -1  (LINHA EM Y)',
                '  WHILE [#131 LE 1] DO3',
                '    #132 = #110 + #130 * #105 / 2   (X DO FURO)',
                '    #133 = #102 - #113 * #132 + 2   (PROF. = Z(X) + SAIDA)',
                '    G81 X#132 Y[#111 + #131 * #106 / 2] Z[-#133] R2. F130.',
                '    #131 = #131 + 2',
                '  END3',
                '  #130 = #130 + 2',
                'END2',
                'G80');
        }
        L.push('G00 Z100. M09', 'M05', 'G91 G28 Z0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 7 — GABARITO DE FURAÇÃO (famílias de furos)
// ============================================================
const gabaritoFuracao = {
    id: 'gabarito-furacao',
    name: 'Gabarito de furação',
    tag: 'GABARITO-FURACAO',
    rev: 'A',
    process: 'Fresamento — furação',
    machine: 'Centro de usinagem 3 eixos',
    control: 'ISO 6983 (FANUC/Siemens)',
    stock: 'Placa 165 × 105 × 20 mm',
    difficulty: 'Intermediário',
    icon: '🎯',
    desc: 'Três famílias de furos: passantes, contraborejados e cegos. O roteiro completo de furação — G81, G82 (demora) e G83 (desbaste de lascas).',
    exampleFile: 'gabarito-furacao_rev-A.pdf',
    cssScene: false,
    viewLabels: ['PLANTA', 'FRONTAL', 'LATERAL ESQ.', 'CORTE A-A'],
    features: [{
        id: 'placa',
        name: 'Placa base',
        hint: 'Extrusão da placa do gabarito',
        included: true,
        params: [
            { key: 'largura', label: 'largura', unit: 'mm', value: 160 },
            { key: 'comprimento', label: 'comp.', unit: 'mm', value: 100 },
            { key: 'espessura', label: 'esp.', unit: 'mm', value: 15 }
        ]
    }, {
        id: 'furos_simples',
        name: 'Furos passantes Ø8',
        hint: '2 furos passantes (ciclo G83 com lascas)',
        included: true,
        params: [
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 8 },
            { key: 'espacamento', label: 'espaç.', unit: 'mm', value: 120 }
        ]
    }, {
        id: 'furos_contraborejados',
        name: 'Furos contraborejados',
        hint: '2 furos Ø12 com contrafuro Ø20 × 6 mm',
        included: true,
        params: [
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 12 },
            { key: 'diam_contr', label: 'Ø contr.', unit: 'mm', value: 20 },
            { key: 'prof_contr', label: 'prof. contr.', unit: 'mm', value: 6 },
            { key: 'espacamento', label: 'espaç.', unit: 'mm', value: 80 }
        ]
    }, {
        id: 'furos_cegos',
        name: 'Furos cegos',
        hint: '2 furos Ø6 com profundidade controlada',
        included: true,
        params: [
            { key: 'diametro', label: 'diâm.', unit: 'mm', value: 6 },
            { key: 'profundidade', label: 'prof.', unit: 'mm', value: 10 },
            { key: 'espacamento', label: 'espaç.', unit: 'mm', value: 40 }
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
            larg: st.placa.params.largura,
            comp: st.placa.params.comprimento,
            esp: st.placa.params.espessura,
            dSimples: st.furos_simples.params.diametro,
            espSimples: st.furos_simples.params.espacamento,
            dContr: st.furos_contraborejados.params.diametro,
            dContrB: st.furos_contraborejados.params.diam_contr,
            pContrB: st.furos_contraborejados.params.prof_contr,
            espContr: st.furos_contraborejados.params.espacamento,
            dCego: st.furos_cegos.params.diametro,
            pCego: st.furos_cegos.params.profundidade,
            espCego: st.furos_cegos.params.espacamento,
            chanfro: st.chamfer.params.tamanho
        };
    },
    computeMass(d, st) {
        let vol = d.larg * d.comp * d.esp;
        if (st.furos_simples.included) vol -= 2 * Math.PI * Math.pow(d.dSimples / 2, 2) * d.esp;
        if (st.furos_contraborejados.included) {
            vol -= 2 * Math.PI * Math.pow(d.dContr / 2, 2) * d.esp;
            vol -= 2 * Math.PI * (Math.pow(d.dContrB / 2, 2) - Math.pow(d.dContr / 2, 2)) * d.pContrB;
        }
        if (st.furos_cegos.included) vol -= 2 * Math.PI * Math.pow(d.dCego / 2, 2) * d.pCego;
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Largura', value: fmt(d.larg) + ' mm' },
            { label: 'Comprimento', value: fmt(d.comp) + ' mm' },
            { label: 'Espessura', value: fmt(d.esp) + ' mm' },
            { label: 'Furos passantes', value: st.furos_simples.included ? '2 × Ø' + fmt(d.dSimples) + ' (espaç. ' + fmt(d.espSimples) + ')' : '—' },
            { label: 'Contraboreados', value: st.furos_contraborejados.included ? '2 × Ø' + fmt(d.dContr) + ' c/ contr. Ø' + fmt(d.dContrB) + ' × ' + fmt(d.pContrB) + ' (espaç. ' + fmt(d.espContr) + ')' : '—' },
            { label: 'Furos cegos', value: st.furos_cegos.included ? '2 × Ø' + fmt(d.dCego) + ' prof. ' + fmt(d.pCego) + ' (espaç. ' + fmt(d.espCego) + ')' : '—' },
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
            desc: 'Sketch no plano Top: retângulo ' + fmt(d.larg) + 'mm × ' + fmt(d.comp) + 'mm centralizado.',
            tip: 'Simetria em relação à origem simplifica todos os posicionamentos.'
        });
        defs.push({
            id: 'base_extrude', title: 'Extrudar a Placa', badge: 'EXTRUDE',
            desc: 'Extrusão de ' + fmt(d.esp) + 'mm.',
            tip: 'Confira a espessura na vista frontal.'
        });
        if (st.furos_simples.included) {
            defs.push({
                id: 'holes_simple', title: 'Furos Passantes Ø' + fmt(d.dSimples), badge: 'HOLE',
                desc: '2 furos passantes espaçados ' + fmt(d.espSimples) + 'mm no eixo central.',
                tip: 'Through All + Linear Pattern (2 ocorrências).'
            });
        }
        if (st.furos_contraborejados.included) {
            defs.push({
                id: 'holes_cbore', title: 'Furos Contraborejados', badge: 'HOLE',
                desc: '2 furos Ø' + fmt(d.dContr) + ' com contrafuro Ø' + fmt(d.dContrB) + 'mm × ' + fmt(d.pContrB) +
                    'mm de profundidade, espaçados ' + fmt(d.espContr) + 'mm.',
                tip: 'Hole Wizard com opção Counterbore — defina as duas profundidades.'
            });
        }
        if (st.furos_cegos.included) {
            defs.push({
                id: 'holes_blind', title: 'Furos Cegos', badge: 'HOLE',
                desc: '2 furos Ø' + fmt(d.dCego) + 'mm com ' + fmt(d.pCego) + 'mm de profundidade (cegos), espaçados ' + fmt(d.espCego) + 'mm.',
                tip: 'Marque Blind (não Through All) e informe a profundidade.'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Chanfro de Contorno', badge: 'CHAMFER',
                desc: 'Chanfro de ' + fmt(d.chanfro) + 'mm × 45° nas arestas superiores.',
                tip: 'Selecione o loop superior completo.'
            });
        }
        return defs;
    },
    stepCmd: {
        base_sketch: 'sketchTop', base_extrude: 'extrude', holes_simple: 'hole',
        holes_cbore: 'hole', holes_blind: 'hole', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const x0 = 50, y0 = 60;
        const cs = Math.max(3, Math.min(d.chanfro, 12));
        const holes = [];
        if (st.furos_simples.included) {
            holes.push({ x: -d.espSimples / 2, r: d.dSimples / 2, type: 'thru' });
            holes.push({ x: d.espSimples / 2, r: d.dSimples / 2, type: 'thru' });
        }
        if (st.furos_contraborejados.included) {
            holes.push({ x: -d.espContr / 2, r: d.dContr / 2, type: 'cbore', rb: d.dContrB / 2 });
            holes.push({ x: d.espContr / 2, r: d.dContr / 2, type: 'cbore', rb: d.dContrB / 2 });
        }
        if (st.furos_cegos.included) {
            holes.push({ x: -d.espCego / 2, r: d.dCego / 2, type: 'blind' });
            holes.push({ x: d.espCego / 2, r: d.dCego / 2, type: 'blind' });
        }

        // PLANTA
        let planta = svgRect(x0, y0, d.larg, d.comp, 'surface');
        holes.forEach(h => {
            const cx = x0 + d.larg / 2 + h.x, cy = y0 + d.comp / 2;
            if (h.type === 'cbore') planta += svgCircle(cx, cy, h.rb, 'hidden');
            planta += svgCircle(cx, cy, h.r, 'hole');
        });
        planta += dimH(x0, x0 + d.larg, y0 + d.comp + 20, fmt(d.larg)) +
            dimV(y0, y0 + d.comp, x0 + d.larg + 24, fmt(d.comp), 'start-r');
        holes.forEach(h => {
            planta += dimH(x0 + d.larg / 2, x0 + d.larg / 2 + h.x, y0 - 18, fmt(Math.abs(h.x) * 2), -8);
        });
        if (st.furos_contraborejados.included) {
            planta += svgText(x0 + d.larg / 2 + d.espContr / 2 + d.dContrB + 10, y0 + d.comp / 2 - 8,
                'Ø' + fmt(d.dContrB) + ' ↧' + fmt(d.pContrB), 'dim-text');
        }
        planta += svgLine(x0 - 10, y0 + d.comp / 2, x0 + d.larg + 10, y0 + d.comp / 2, 'cut-line') +
            svgText(x0 - 5, y0 + d.comp / 2 - 6, 'A', 'label', 'end') +
            svgText(x0 + d.larg + 10, y0 + d.comp / 2 - 6, 'A', 'label');

        // FRONTAL
        let frontal = svgRect(x0, y0, d.larg, d.esp, 'surface');
        holes.forEach(h => {
            const cx = x0 + d.larg / 2 + h.x;
            if (h.type === 'blind') {
                frontal += svgLine(cx - h.r, y0, cx - h.r, y0 + d.pCego, 'hidden') +
                    svgLine(cx + h.r, y0, cx + h.r, y0 + d.pCego, 'hidden') +
                    svgLine(cx - h.r, y0 + d.pCego, cx + h.r, y0 + d.pCego, 'hidden');
            } else {
                frontal += svgLine(cx - h.r, y0, cx - h.r, y0 + d.esp, 'hidden') +
                    svgLine(cx + h.r, y0, cx + h.r, y0 + d.esp, 'hidden');
                if (h.type === 'cbore') {
                    frontal += svgLine(cx - h.rb, y0, cx - h.rb, y0 + d.pContrB, 'hidden') +
                        svgLine(cx + h.rb, y0, cx + h.rb, y0 + d.pContrB, 'hidden') +
                        svgLine(cx - h.rb, y0 + d.pContrB, cx + h.rb, y0 + d.pContrB, 'hidden');
                }
            }
        });
        if (st.chamfer.included) frontal += chamferMarks(x0, d.larg, y0, cs, true);
        frontal += dimV(y0, y0 + d.esp, 30, fmt(d.esp), 'rot-l') +
            dimH(x0, x0 + d.larg, y0 + d.esp + 20, fmt(d.larg));

        // LATERAL
        let lat = svgRect(x0, y0, d.comp, d.esp, 'surface');
        if (st.chamfer.included) lat += chamferMarks(x0, d.comp, y0, cs, true);
        lat += dimV(y0, y0 + d.esp, 30, fmt(d.esp), 'rot-l') +
            dimH(x0, x0 + d.comp, y0 + d.esp + 20, fmt(d.comp));

        // CORTE A-A (cortina de furos)
        let corte = svgRect(x0, y0, d.larg, d.esp, 'surface') + hatchBlock();
        // faixas hachuradas entre os furos
        let edges = [{ x: x0, w: d.larg }];
        holes.forEach(h => {
            const cx = x0 + d.larg / 2 + h.x;
            const rw = h.type === 'cbore' ? h.rb : h.r;
            const next = [];
            edges.forEach(seg => {
                const s1 = { x: seg.x, w: cx - rw - seg.x };
                const s2 = { x: cx + rw, w: seg.x + seg.w - (cx + rw) };
                if (s1.w > 0.5) next.push(s1);
                if (s2.w > 0.5) next.push(s2);
            });
            edges = next;
        });
        edges.forEach(seg => {
            corte += svgRect(seg.x, y0, seg.w, d.esp, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        });
        holes.forEach(h => {
            const cx = x0 + d.larg / 2 + h.x;
            if (h.type === 'blind') {
                corte += svgRect(cx - h.r, y0, h.r * 2, d.pCego, 'hole');
                corte += svgText(cx + h.r + 8, y0 + d.pCego / 2, '↧' + fmt(d.pCego), 'dim-text');
            } else {
                corte += svgRect(cx - h.r, y0, h.r * 2, d.esp, 'hole');
                if (h.type === 'cbore') {
                    corte += svgRect(cx - h.rb, y0, h.rb * 2, d.pContrB, 'hole');
                    corte += svgText(cx + h.rb + 8, y0 + d.pContrB / 2, 'Ø' + fmt(d.dContrB) + ' ↧' + fmt(d.pContrB), 'dim-text');
                }
                corte += svgText(cx + h.r + 8, y0 + d.esp / 2 + 12, 'Ø' + fmt(h.r * 2), 'dim-text');
            }
        });
        corte += dimV(y0, y0 + d.esp, 30, fmt(d.esp), 'rot-l') +
            dimH(x0, x0 + d.larg, y0 + d.esp + 20, fmt(d.larg)) +
            svgText(x0 + d.larg / 2, y0 - 12, 'A-A', 'label', 'middle');

        return [
            { svg: createSVG(planta, '8 20 ' + (d.larg + 110) + ' ' + (d.comp + 110), t) },
            { svg: createSVG(frontal, '8 12 ' + (d.larg + 100) + ' ' + (d.esp + 88), t) },
            { svg: createSVG(lat, '8 12 ' + (d.comp + 100) + ' ' + (d.esp + 88), t) },
            { svg: createSVG(corte, '8 12 ' + (d.larg + 100) + ' ' + (d.esp + 88), t) }
        ];
    },
    gcode(d, st) {
        const L = [];
        const y = d.comp / 2;
        L.push('%',
            'O0007 (GABARITO DE FURACAO - 3 FAMILIAS DE FUROS)',
            '(PECA: ' + fmt(d.larg) + ' X ' + fmt(d.comp) + ' X ' + fmt(d.esp) + ' - REV A)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: PLACA ' + fmt(d.larg + 5) + ' X ' + fmt(d.comp + 5) + ' X ' + fmt(d.esp + 4) + ')',
            '(T01 - FRESA PLANA D50 - FACEAMENTO/CONTORNO)',
            '(T02 - CENTRO DE FURAR 90G - PILOTAGEM)',
            '(T03 - BROCA D' + fmt(d.dCego) + ' - FUROS CEGOS)',
            '(T04 - BROCA D' + fmt(d.dSimples) + ' - FUROS PASSANTES (LASCAS))',
            '(T05 - BROCA D' + fmt(d.dContr) + ' + FRESA D' + fmt(d.dContrB) + ' - CONTRABORES)',
            '(G54 - ORIGEM NO CENTRO DA PECA, FACE SUPERIOR Z0)',
            'N10 G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== FACEAMENTO ===)',
            'N20 T01 M06 S2800 M03',
            'N30 G00 G54 X-' + fmt(d.larg / 2 + 30) + ' Y-' + fmt(y + 30),
            'N40 G43 Z50. H01 M08',
            'N50 G01 Z0. F120.',
            'N60 G01 X' + fmt(d.larg / 2 + 30) + ' F450.',
            'N70 Y' + fmt(y + 30),
            'N80 X-' + fmt(d.larg / 2 + 30),
            'N90 G00 Z50.',
            '',
            '(=== PILOTAGEM COM CENTRO DE FURAR ===)',
            '(TODOS OS ' + (this._holeCount(st)) + ' FUROS GANHAM CONDUTOR)',
            'N100 T02 M06 S3000 M03',
            'N110 G43 Z50. H02');
        let ln = 120;
        const spots = this._holeList(st, d);
        spots.forEach(h => {
            L.push('N' + ln + ' G81 X' + fmt(h.x) + ' Y' + fmt(h.y) + ' Z-2. R2. F100.  (' + h.tag + ')');
            ln += 10;
        });
        L.push('N' + ln + ' G80');
        ln += 10;
        if (st.furos_cegos.included) {
            L.push('',
                '(=== FUROS CEGOS D' + gf(d.dCego) + ' - G82 COM DEMORA ===)',
                '(G82 = BROCAR + DEMORA (G04) NO FUNDO - FUNDO LISO)',
                'N' + ln + ' T03 M06 S2000 M03',
                'N' + (ln + 10) + ' G43 Z50. H03');
            ln += 20;
            spots.filter(h => h.kind === 'blind').forEach(h => {
                L.push('N' + ln + ' G82 X' + fmt(h.x) + ' Y' + fmt(h.y) + ' Z-' + fmt(d.pCego + 0.5) + ' R2. P500 F120.');
                ln += 10;
            });
            L.push('N' + ln + ' G80');
            ln += 10;
        }
        if (st.furos_simples.included) {
            L.push('',
                '(=== FUROS PASSANTES D' + gf(d.dSimples) + ' - G83 COM LASCAS ===)',
                '(Q = PROFUNDIDADE DE CADA LASCAMENTO)',
                'N' + ln + ' T04 M06 S1800 M03',
                'N' + (ln + 10) + ' G43 Z50. H04');
            ln += 20;
            spots.filter(h => h.kind === 'thru').forEach(h => {
                L.push('N' + ln + ' G83 X' + fmt(h.x) + ' Y' + fmt(h.y) + ' Z-' + fmt(d.esp + 2) + ' R2. Q3. F140.');
                ln += 10;
            });
            L.push('N' + ln + ' G80');
            ln += 10;
        }
        if (st.furos_contraborejados.included) {
            L.push('',
                '(=== CONTRABORES Ø' + gf(d.dContrB) + ' X ' + gf(d.pContrB) + ' ===)',
                '(1O A BROCA PASSANTE, DEPOIS O CONTRAFURO COM DEMORA)');
            L.push('N' + ln + ' T05 M06 S1600 M03',
                'N' + (ln + 10) + ' G43 Z50. H05');
            ln += 20;
            spots.filter(h => h.kind === 'cbore').forEach(h => {
                L.push('N' + ln + ' G83 X' + fmt(h.x) + ' Y' + fmt(h.y) + ' Z-' + fmt(d.esp + 2) + ' R2. Q3. F120.  (FURO Ø' + gf(d.dContr) + ')');
                ln += 10;
            });
            L.push('N' + ln + ' G80');
            ln += 10;
            L.push('(TROCA PARA FRESA DE CONTRAFURO - MESMO PORTA-FERRAMENTAS OU T06)');
            spots.filter(h => h.kind === 'cbore').forEach(h => {
                L.push('N' + ln + ' G82 X' + fmt(h.x) + ' Y' + fmt(h.y) + ' Z-' + fmt(d.pContrB) + ' R2. P800 F100.  (CONTRAFURO)');
                ln += 10;
            });
            L.push('N' + ln + ' G80');
            ln += 10;
        }
        L.push('N' + ln + ' G00 Z100. M09',
            'N' + (ln + 10) + ' M05',
            'N' + (ln + 20) + ' G91 G28 Z0.',
            'N' + (ln + 30) + ' M30',
            '%');
        return L.join('\n');
    },
    _holeCount(st) {
        let n = 0;
        if (st.furos_simples.included) n += 2;
        if (st.furos_contraborejados.included) n += 2;
        if (st.furos_cegos.included) n += 2;
        return n;
    },
    _holeList(st, d) {
        const list = [];
        if (st.furos_simples.included) {
            list.push({ x: -d.espSimples / 2, y: 0, kind: 'thru', tag: 'PASSANTE 1' });
            list.push({ x: d.espSimples / 2, y: 0, kind: 'thru', tag: 'PASSANTE 2' });
        }
        if (st.furos_contraborejados.included) {
            list.push({ x: -d.espContr / 2, y: 0, kind: 'cbore', tag: 'CONTRABORE 1' });
            list.push({ x: d.espContr / 2, y: 0, kind: 'cbore', tag: 'CONTRABORE 2' });
        }
        if (st.furos_cegos.included) {
            list.push({ x: -d.espCego / 2, y: 0, kind: 'blind', tag: 'CEGO 1' });
            list.push({ x: d.espCego / 2, y: 0, kind: 'blind', tag: 'CEGO 2' });
        }
        return list;
    },
    macro(d, st) {
        const L = [];
        L.push('%',
            'O1007 (GABARITO DE FURACAO - MACRO PARAMETRICO)',
            '(AS FAMILIAS SAO PROGRAMADAS POR LACOS COM PARAMETROS)',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(d.larg) + '   (LARGURA)',
            '#101 = ' + gf(d.comp) + '   (COMPRIMENTO)',
            '#102 = ' + gf(d.esp) + '    (ESPESSURA)',
            '#103 = ' + gf(d.dSimples) + '      (FUROS PASSANTES)',
            '#104 = ' + gf(d.espSimples) + '   (ESPAC. PASSANTES)',
            '#105 = ' + gf(d.dContr) + '    (FURO CONTRABOREJADO)',
            '#106 = ' + gf(d.dContrB) + '    (CONTRAFURO)',
            '#107 = ' + gf(d.pContrB) + '      (PROF. CONTRAFURO)',
            '#108 = ' + gf(d.espContr) + '    (ESPAC. CONTRABORES)',
            '#109 = ' + gf(d.dCego) + '      (FURO CEGO)',
            '#110 = ' + gf(d.pCego) + '     (PROF. CEGO)',
            '#111 = ' + gf(d.espCego) + '    (ESPAC. CEGOS)',
            '',
            'G21 G90 G17 G40 G49 G80 G94',
            '',
            '(=== FUROS CEGOS - G82 COM DEMORA ===)',
            'T03 M06 S2000 M03',
            'G43 Z50. H03 M08',
            '#120 = -1',
            'WHILE [#120 LE 1] DO1',
            '  G82 X[#120 * #111 / 2] Y0. Z[-#110 - 0.5] R2. P500 F120.',
            '  #120 = #120 + 2',
            'END1',
            'G80',
            '',
            '(=== FUROS PASSANTES - G83 COM LASCAS ===)',
            'T04 M06 S1800 M03',
            'G43 Z50. H04',
            '#121 = -1',
            'WHILE [#121 LE 1] DO2',
            '  G83 X[#121 * #104 / 2] Y0. Z[-#102 - 2] R2. Q[#103 / 3] F140.',
            '  #121 = #121 + 2',
            'END2',
            'G80');
        if (st.furos_contraborejados.included) {
            L.push('',
                '(=== CONTRABORES - BROCAR E REBAIXAR ===)',
                'T05 M06 S1600 M03',
                'G43 Z50. H05',
                '#122 = -1',
                'WHILE [#122 LE 1] DO3',
                '  G83 X[#122 * #108 / 2] Y0. Z[-#102 - 2] R2. Q3. F120.  (FURO)',
                '  #122 = #122 + 2',
                'END3',
                'G80',
                '#123 = -1',
                'WHILE [#123 LE 1] DO4',
                '  G82 X[#123 * #108 / 2] Y0. Z[-#107] R2. P800 F100.  (CONTRAFURO)',
                '  #123 = #123 + 2',
                'END4',
                'G80');
        }
        L.push('G00 Z100. M09', 'M05', 'G91 G28 Z0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 8 — POLIA EM V (torneamento — rasgo angular)
// ============================================================
const poliaV = {
    id: 'polia-v',
    name: 'Polia em V',
    tag: 'POLIA-V',
    rev: 'A',
    process: 'Torneamento — rasgo em V',
    machine: 'Torno CNC (comando FANUC)',
    control: 'ISO 6983 (FANUC G71/G70)',
    stock: 'Barra Ø85 × 35 mm',
    difficulty: 'Intermediário',
    icon: '🎡',
    desc: 'Polia com rasgo em V de 40°, furo central e chanfros. Treina perfil com rasgo angular, cálculo de profundidade pelo ângulo e torneamento interno.',
    exampleFile: 'polia-v_rev-A.pdf',
    cssScene: false,
    isTurning: true,
    viewLabels: ['PERFIL', 'FRONTAL', 'SEÇÃO A-A', 'DETALHE B'],
    features: [{
        id: 'corpo',
        name: 'Corpo da polia',
        hint: 'Disco torneado externo',
        included: true,
        params: [
            { key: 'diametro', label: 'Ø externo', unit: 'mm', value: 80 },
            { key: 'espessura', label: 'espessura', unit: 'mm', value: 30 }
        ]
    }, {
        id: 'furo_central',
        name: 'Furo central',
        hint: 'Furo passante mandrilado',
        included: true,
        params: [{ key: 'diametro', label: 'diâm.', unit: 'mm', value: 25 }]
    }, {
        id: 'rasgo_v',
        name: 'Rasgo em V',
        hint: 'Rasgo angular no diâmetro externo',
        included: true,
        params: [
            { key: 'largura', label: 'largura', unit: 'mm', value: 12 },
            { key: 'angulo', label: 'ângulo', unit: '°', value: 40 },
            { key: 'diam_fundo', label: 'Ø fundo', unit: 'mm', value: 60 }
        ]
    }, {
        id: 'chamfer',
        name: 'Chanfros',
        hint: 'Chanfros no furo central e nas faces',
        included: true,
        params: [{ key: 'tamanho', label: 'tam.', unit: 'mm', value: 2 }]
    }],
    dimsFromState(st) {
        return {
            D: st.corpo.params.diametro,
            e: st.corpo.params.espessura,
            furo: st.furo_central.params.diametro,
            vLarg: st.rasgo_v.params.largura,
            vAng: st.rasgo_v.params.angulo,
            vFundo: st.rasgo_v.params.diam_fundo,
            chanfro: st.chamfer.params.tamanho
        };
    },
    vDepth(d) {
        return Math.max((d.D - d.vFundo) / 2, 0.5);
    },
    computeMass(d, st) {
        let vol = Math.PI / 4 * d.D * d.D * d.e;
        if (st.furo_central.included) vol -= Math.PI / 4 * d.furo * d.furo * d.e;
        if (st.rasgo_v.included) {
            // volume do cunhete V: trapezoidal aproximado (largura no topo, fundo chanfrado pelo ângulo)
            const t = this.vDepth(d);
            const area = t * d.vLarg - t * t * Math.tan((d.vAng / 2) * Math.PI / 180);
            vol -= Math.PI * d.vFundo * Math.max(area, 0);
        }
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Diâmetro externo', value: 'Ø' + fmt(d.D) + ' mm' },
            { label: 'Espessura', value: fmt(d.e) + ' mm' },
            { label: 'Furo central', value: st.furo_central.included ? 'Ø' + fmt(d.furo) + ' mm (H7)' : '—' },
            { label: 'Rasgo em V', value: st.rasgo_v.included ? fmt(d.vLarg) + ' mm × ' + fmt(d.vAng) + '° · Ø fundo ' + fmt(d.vFundo) : '—' },
            { label: 'Profundidade do V', value: st.rasgo_v.included ? fmt(this.vDepth(d)) + ' mm' : '—' },
            { label: 'Chanfros', value: st.chamfer.included ? fmt(d.chanfro) + ' × 45°' : '—' },
            { label: 'Tolerância', value: 'ISO 2768-m' },
            { label: 'Acabamento', value: 'Usinagem' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'pulley_sketch', title: 'Esboçar o Perfil', badge: 'SKETCH',
            desc: 'Perfil de revolução: Ø' + fmt(d.D) + 'mm × ' + fmt(d.e) + 'mm com a linha de centro.',
            tip: 'Meio perfil + linha de centro é o caminho mais rápido para Revolve.'
        });
        defs.push({
            id: 'pulley_revolve', title: 'Revolver o Corpo', badge: 'REVOLVE',
            desc: 'Revolved Boss/Base 360° formando o disco.',
            tip: 'Confira a espessura na vista frontal.'
        });
        if (st.furo_central.included) {
            defs.push({
                id: 'bore_hole', title: 'Furo Central', badge: 'HOLE',
                desc: 'Furo passante de Ø' + fmt(d.furo) + 'mm mandrilado (tolerância H7 para assentar no eixo).',
                tip: 'Depois do furo, use Hole Wizard com tolerância ou mandrile.'
            });
        }
        if (st.rasgo_v.included) {
            defs.push({
                id: 'groove_sketch', title: 'Esboçar o Rasgo em V', badge: 'SKETCH',
                desc: 'Perfil do rasgo: abertura de ' + fmt(d.vLarg) + 'mm, ângulo de ' + fmt(d.vAng) +
                    '° e Ø de fundo ' + fmt(d.vFundo) + 'mm (profundidade ' + fmt(this.vDepth(d)) + 'mm).',
                tip: 'O ângulo total do V é 2× meia-ângulo — use Smart Dimension no ângulo.'
            });
            defs.push({
                id: 'groove_cut', title: 'Abrir o Rasgo em V', badge: 'CUT',
                desc: 'Revolved Cut 360° usando o perfil do rasgo.',
                tip: 'Alternativa: ferramenta de ranhura angular com cortes de mergulho.'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Chanfros', badge: 'CHAMFER',
                desc: 'Chanfros de ' + fmt(d.chanfro) + 'mm × 45° no furo central e nas faces externas.',
                tip: 'Selecione os dois loops do furo (entrada e saída).'
            });
        }
        return defs;
    },
    stepCmd: {
        pulley_sketch: 'sketchTop', pulley_revolve: 'revolve', bore_hole: 'hole',
        groove_sketch: 'sketchTop', groove_cut: 'revolveCut', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const axisY = 130, x0 = 60;
        const vd = this.vDepth(d);
        const halfTop = d.vLarg / 2;
        const cs = Math.max(2, Math.min(d.chanfro, 8));

        // PERFIL
        let perfil = svgRect(x0, axisY - d.D / 2, d.e, d.D, 'surface') +
            svgLine(x0 - 20, axisY, x0 + d.e + 20, axisY, 'cut-line');
        if (st.rasgo_v.included) {
            const zc = x0 + d.e / 2;
            perfil += svgPolyline([
                [zc - halfTop, axisY - d.D / 2], [zc - halfTop + vd * Math.tan((d.vAng / 2) * Math.PI / 180), axisY - d.D / 2 + vd],
                [zc + halfTop - vd * Math.tan((d.vAng / 2) * Math.PI / 180), axisY - d.D / 2 + vd],
                [zc + halfTop, axisY - d.D / 2], [zc - halfTop, axisY - d.D / 2]
            ], 'hole');
            perfil += dimH(zc - halfTop, zc + halfTop, axisY - d.D / 2 - 18, fmt(d.vLarg), -8);
        }
        if (st.furo_central.included) {
            perfil += svgLine(x0, axisY - d.furo / 2, x0 + d.e, axisY - d.furo / 2, 'hidden') +
                svgLine(x0, axisY + d.furo / 2, x0 + d.e, axisY + d.furo / 2, 'hidden');
        }
        perfil += dimV(axisY - d.D / 2, axisY + d.D / 2, 38, 'Ø' + fmt(d.D), 'rot-l') +
            dimH(x0, x0 + d.e, axisY + d.D / 2 + 22, fmt(d.e));

        // FRONTAL
        const fcx = 110, fcy = 115;
        let frontal = svgCircle(fcx, fcy, d.D / 2, 'surface') +
            svgLine(fcx - d.D / 2 - 14, fcy, fcx + d.D / 2 + 14, fcy, 'cut-line') +
            svgLine(fcx, fcy - d.D / 2 - 14, fcx, fcy + d.D / 2 + 14, 'cut-line') +
            dimH(fcx - d.D / 2, fcx + d.D / 2, fcy + d.D / 2 + 22, 'Ø' + fmt(d.D));
        if (st.furo_central.included) {
            frontal += svgCircle(fcx, fcy, d.furo / 2, 'hole') +
                dimH(fcx - d.furo / 2, fcx + d.furo / 2, fcy - d.D / 2 - 18, 'Ø' + fmt(d.furo), -8);
        }

        // SEÇÃO A-A
        let secao = svgRect(x0, axisY - d.D / 2, d.e, d.D, 'surface') + hatchBlock();
        if (st.furo_central.included) {
            secao += svgRect(x0, axisY - d.D / 2, d.e, d.D / 2 - d.furo / 2, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                svgRect(x0, axisY + d.furo / 2, d.e, d.D / 2 - d.furo / 2, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                dimH(x0 + d.e / 2 - d.furo / 2, x0 + d.e / 2 + d.furo / 2, axisY + d.D / 2 + 22, 'Ø' + fmt(d.furo));
        } else {
            secao += svgRect(x0, axisY - d.D / 2, d.e, d.D, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        }
        if (st.rasgo_v.included) {
            const zc = x0 + d.e / 2;
            secao += svgPolyline([
                [zc - halfTop, axisY - d.D / 2], [zc - halfTop + vd * Math.tan((d.vAng / 2) * Math.PI / 180), axisY - d.D / 2 + vd],
                [zc + halfTop - vd * Math.tan((d.vAng / 2) * Math.PI / 180), axisY - d.D / 2 + vd],
                [zc + halfTop, axisY - d.D / 2], [zc - halfTop, axisY - d.D / 2]
            ], 'hole');
        }
        secao += svgLine(x0 - 20, axisY, x0 + d.e + 20, axisY, 'cut-line') +
            dimV(axisY - d.D / 2, axisY + d.D / 2, 38, 'Ø' + fmt(d.D), 'rot-l') +
            svgText(x0 + d.e / 2, axisY + d.D / 2 + 40, 'A-A', 'label', 'middle');

        // DETALHE B (rasgo em V ampliado)
        const zx = 50, zy = 60;
        let det = '';
        if (st.rasgo_v.included) {
            const sk = 2.2; // escala do detalhe
            det += svgRect(zx, zy, 60, 24, 'surface') +
                svgRect(zx + 130, zy, 70, 24, 'surface');
            det += svgPolyline([
                [zx + 60, zy], [zx + 60 + vd * sk * Math.tan((d.vAng / 2) * Math.PI / 180) * 2, zy + vd * sk],
                [zx + 130 - vd * sk * Math.tan((d.vAng / 2) * Math.PI / 180) * 2, zy + vd * sk],
                [zx + 130, zy], [zx + 60, zy]
            ], 'hole');
            det += dimH(zx + 60, zx + 130, zy + vd * sk + 22, fmt(d.vLarg)) +
                dimV(zy, zy + vd * sk, zx + 46, fmt(vd), 'end-l') +
                svgText(zx + 78, zy - 8, fmt(d.vAng) + '°', 'dim-text') +
                svgText(zx + 30, zy + 60, 'ØFUND0 ' + fmt(d.vFundo) + ' - PROF. ' + fmt(vd), 'label');
        } else {
            det += svgRect(zx, zy, 180, 40, 'surface') +
                svgText(zx + 12, zy + 24, 'SEM RASGO EM V', 'label');
        }
        det = svgText(zx - 22, zy + 6, 'B', 'label') + det;

        return [
            { svg: createSVG(perfil, '20 20 ' + (d.e + 130) + ' ' + (d.D + 110), t) },
            { svg: createSVG(frontal, '20 12 220 230', t) },
            { svg: createSVG(secao, '20 20 ' + (d.e + 130) + ' ' + (d.D + 110), t) },
            { svg: createSVG(det, '20 30 280 130', t) }
        ];
    },
    gcode(d, st) {
        const L = [];
        const t = this.vDepth(d);
        const halfTop = d.vLarg / 2;
        const halfFundo = halfTop - t * Math.tan((d.vAng / 2) * Math.PI / 180);
        L.push('%',
            'O0008 (POLIA EM V - TORNEAMENTO)',
            '(PECA: Ø' + fmt(d.D) + ' X ' + fmt(d.e) + ' - RASGO V ' + fmt(d.vAng) + 'G)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: BARRA Ø' + fmt(d.D + 5) + ' X ' + fmt(d.e + 15) + ')',
            '(T01 - SERRILHA ROUGHING 80G - DESBASTE)',
            '(T02 - ACABAMENTO 55G - PERFIL E RASGO V)',
            '(T03 - BROCA D' + fmt(Math.min(d.furo, 23)) + ' - FURO CENTRAL)',
            '(T04 - MANDRIL - ACABAMENTO DO FURO Ø' + fmt(d.furo) + ')',
            '(G54 NO BICO / EIXO DE ROTACAO - Z0 NA FACE)',
            'N10 G21 G99 G97 G40',
            'N20 T0101 M03 S1100',
            'N30 G00 X' + fmt(d.D + 6) + ' Z2. M08',
            '',
            '(=== DESBASTE - G71 COM PERFIL INCLUINDO O V ===)',
            'N40 G71 U1.5 R0.5',
            'N50 G71 P100 Q200 U0.3 W0.1 F0.25',
            'N100 G00 X' + fmt(d.D - 2 * d.chanfro));
        if (st.chamfer.included) {
            L.push('N110 G01 X' + fmt(d.D) + ' Z-' + fmt(d.chanfro) + ' F0.12  (CHANFRO DA FACE)');
        } else {
            L.push('N110 G01 X' + fmt(d.D) + ' Z0. F0.12');
        }
        if (st.rasgo_v.included) {
            L.push('N120 Z-' + fmt(d.e / 2 - halfTop) + '  (ATE O RASGO V)',
                'N130 X' + fmt(d.vFundo) + ' Z-' + fmt(d.e / 2 - halfFundo) + '  (PAREDE DO V)',
                'N140 Z-' + fmt(d.e / 2 + halfFundo) + '  (FUNDO DO V - Ø' + fmt(d.vFundo) + ')',
                'N150 X' + fmt(d.D) + ' Z-' + fmt(d.e / 2 + halfTop) + '  (SAIDA DO V)',
                'N160 Z-' + fmt(d.e - d.chanfro) + '.');
        } else {
            L.push('N120 Z-' + fmt(d.e - d.chanfro) + '.');
        }
        if (st.chamfer.included) {
            L.push('N170 X' + fmt(d.D - 2 * d.chanfro) + ' Z-' + fmt(d.e) + '  (CHANFRO TRASEIRO)');
        } else {
            L.push('N170 Z-' + fmt(d.e) + '.');
        }
        L.push('N200 X' + fmt(d.D + 4),
            'N210 G00 X' + fmt(d.D + 20) + ' Z20.',
            '',
            '(=== ACABAMENTO - G70 ===)',
            'N220 T0202 M03 S1700',
            'N230 G00 X' + fmt(d.D + 6) + ' Z2.',
            'N240 G70 P100 Q200 F0.12',
            'N250 G00 X' + fmt(d.D + 20) + ' Z20.');
        if (st.furo_central.included) {
            L.push('',
                '(=== FURO CENTRAL - BROCA E MANDRIL ===)',
                'N260 T0303 M03 S900',
                'N270 G00 X0. Z2.',
                'N280 G74 R1.',
                'N290 G74 X0. Z-' + fmt(d.e + 2) + ' Q4000 R0. F0.1  (FURACAO COM RETORNO DE LASCAS)',
                'N300 G00 X' + fmt(d.D + 20) + ' Z20.',
                'N310 T0404 M03 S1200',
                'N320 G00 X' + fmt(d.furo - 2) + ' Z2.',
                'N330 G01 Z-' + fmt(d.e + 1) + ' F0.1  (MANDRILAMENTO)',
                'N340 G01 X' + fmt(d.furo - 2) + ' F0.2',
                'N350 G00 Z2.',
                'N360 G00 X' + fmt(d.D + 20) + ' Z20.');
        }
        L.push('N400 M09', 'N410 M05', 'N420 G28 U0. W0.', 'N430 M30', '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [];
        L.push('%',
            'O1008 (POLIA EM V - MACRO PARAMETRICO)',
            '(A GEOMETRIA DO V E CALCULADA PELO ANGULO: MEIA ABERTURA = PROF * TAN(A/2))',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(d.D) + '   (DIAMETRO EXTERNO)',
            '#101 = ' + gf(d.e) + '    (ESPESSURA)',
            '#102 = ' + gf(d.furo) + '    (FURO CENTRAL)',
            '#103 = ' + gf(d.vLarg) + '    (ABERTURA DO V)',
            '#104 = ' + gf(d.vAng) + '    (ANGULO DO V)',
            '#105 = ' + gf(d.vFundo) + '    (DIAMETRO DE FUNDO DO V)',
            '#106 = ' + gf(d.chanfro) + '      (CHANFRO)',
            '',
            '(=== CALCULOS DA GEOMETRIA DO V ===)',
            '#110 = [#100 - #105] / 2     (PROFUNDIDADE DO V)',
            '#111 = #103 / 2              (MEIA ABERTURA NO TOPO)',
            '#112 = #111 - #110 * TAN[#104 / 2]  (MEIA ABERTURA NO FUNDO)',
            '#113 = #101 / 2              (CENTRO DO RASGO EM Z)',
            '',
            'G21 G99 G97 G40',
            'T0101 M03 S1100',
            'G00 X[#100 + 6] Z2. M08',
            '',
            '(=== G71 COM PERFIL PARAMETRICO (INCLUI O V) ===)',
            'G71 U1.5 R0.5',
            'G71 P100 Q200 U0.3 W0.1 F0.25',
            'N100 G00 X[#100 - 2 * #106]',
            'N110 G01 X#100 Z[-#106] F0.12',
            'N120 Z[-#113 + #111]',
            'N130 X#105 Z[-#113 + #112]  (PAREDE DO V)',
            'N140 Z[-#113 - #112]  (FUNDO DO V)',
            'N150 X#100 Z[-#113 - #111]  (SAIDA DO V)',
            'N160 Z[-#101 + #106]',
            'N170 X[#100 - 2 * #106] Z[-#101]',
            'N200 X[#100 + 4]',
            'N210 G00 X[#100 + 20] Z20.',
            '',
            '(=== ACABAMENTO ===)',
            'T0202 M03 S1700',
            'G00 X[#100 + 6] Z2.',
            'G70 P100 Q200 F0.12',
            'G00 X[#100 + 20] Z20.');
        if (st.furo_central.included) {
            L.push('',
                '(=== FURO CENTRAL ===)',
                'T0303 M03 S900',
                'G00 X0. Z2.',
                'G74 R1.',
                'G74 X0. Z[-#101 - 2] Q4000 R0. F0.1',
                'G00 X[#100 + 20] Z20.',
                'T0404 M03 S1200',
                'G00 X[#102 - 2] Z2.',
                'G01 Z[-#101 - 1] F0.1  (MANDRILAMENTO)',
                'G01 X[#102 - 2] F0.2',
                'G00 Z2.',
                'G00 X[#100 + 20] Z20.');
        }
        L.push('M09', 'M05', 'G28 U0. W0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 9 — BUCHA COM ROSCA INTERNA (torneamento — rosca)
// ============================================================
const buchaRosca = {
    id: 'bucha-rosca',
    name: 'Bucha com rosca',
    tag: 'BUCHA-ROSCA',
    rev: 'A',
    process: 'Torneamento — rosca interna',
    machine: 'Torno CNC (comando FANUC)',
    control: 'ISO 6983 (FANUC G76)',
    stock: 'Barra Ø55 × 65 mm',
    difficulty: 'Avançado',
    icon: '🔩',
    desc: 'Bucha com rosca interna M20×1,5 — par de ajuste com o Eixo Rosqueado. Treina furação, mandrilamento e ciclo de roscar G76.',
    exampleFile: 'bucha-rosca_rev-A.pdf',
    cssScene: false,
    isTurning: true,
    viewLabels: ['PERFIL', 'FRONTAL', 'SEÇÃO A-A', 'DETALHE DA ROSCA'],
    features: [{
        id: 'corpo',
        name: 'Corpo da bucha',
        hint: 'Cilindro externo torneado',
        included: true,
        params: [
            { key: 'diametro', label: 'Ø externo', unit: 'mm', value: 50 },
            { key: 'comprimento', label: 'compr.', unit: 'mm', value: 60 }
        ]
    }, {
        id: 'furo',
        name: 'Furo passante',
        hint: 'Furo de passagem (fundo da rosca)',
        included: true,
        params: [{ key: 'diametro', label: 'diâm.', unit: 'mm', value: 17 }]
    }, {
        id: 'rosca',
        name: 'Rosca interna M20×1,5',
        hint: 'Rosca cilíndrica com ciclo G76',
        included: true,
        params: [
            { key: 'diametro', label: 'Ø nominal', unit: 'mm', value: 20 },
            { key: 'passo', label: 'passo', unit: 'mm', value: 1.5 },
            { key: 'profundidade', label: 'prof.', unit: 'mm', value: 45 }
        ]
    }, {
        id: 'chamfer',
        name: 'Chanfro de entrada',
        hint: 'Chanfro de guia na boca do furo',
        included: true,
        params: [{ key: 'tamanho', label: 'tam.', unit: 'mm', value: 2 }]
    }],
    dimsFromState(st) {
        return {
            D: st.corpo.params.diametro,
            L: st.corpo.params.comprimento,
            furo: st.furo.params.diametro,
            roscaD: st.rosca.params.diametro,
            passo: st.rosca.params.passo,
            roscaProf: st.rosca.params.profundidade,
            chanfro: st.chamfer.params.tamanho
        };
    },
    // diâmetro menor (fundo de rosca) ≈ Ønominal − 1,0825 × passo
    threadMinor(d) {
        return d.roscaD - 1.0825 * d.passo;
    },
    // altura da filete ≈ 0,6134 × passo (microns para o P do G76)
    threadHeight(d) {
        return 0.6134 * d.passo;
    },
    computeMass(d, st) {
        let vol = Math.PI / 4 * d.D * d.D * d.L;
        if (st.furo.included) vol -= Math.PI / 4 * d.furo * d.furo * d.L;
        if (st.rosca.included) {
            // alarga o furo até o Ø menor da rosca na profundidade roscada
            const prof = Math.min(d.roscaProf, d.L);
            vol -= Math.PI / 4 * (Math.pow(this.threadMinor(d), 2) - Math.pow(d.furo, 2)) * prof;
        }
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Diâmetro externo', value: 'Ø' + fmt(d.D) + ' mm (h8)' },
            { label: 'Comprimento', value: fmt(d.L) + ' mm' },
            { label: 'Furo de passagem', value: st.furo.included ? 'Ø' + fmt(d.furo) + ' mm' : '—' },
            { label: 'Rosca', value: st.rosca.included ? 'M' + fmt(d.roscaD) + ' × ' + fmt(d.passo) + ' - 6H' : '—' },
            { label: 'Profundidade da rosca', value: st.rosca.included ? fmt(d.roscaProf) + ' mm' : '—' },
            { label: 'Ø menor (referência)', value: st.rosca.included ? 'Ø' + fmt(this.threadMinor(d)) + ' mm' : '—' },
            { label: 'Chanfro', value: st.chamfer.included ? fmt(d.chanfro) + ' × 45°' : '—' },
            { label: 'Par de ajuste', value: 'EIXO-ROSCADO M20×1,5 (6g)' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'bushing_sketch', title: 'Esboçar o Corpo', badge: 'SKETCH',
            desc: 'Perfil retangular de Ø' + fmt(d.D) + 'mm × ' + fmt(d.L) + 'mm com linha de centro.',
            tip: 'Meio perfil para revolução.'
        });
        defs.push({
            id: 'bushing_revolve', title: 'Revolver o Corpo', badge: 'REVOLVE',
            desc: 'Revolved Boss/Base 360°.',
            tip: 'Confira o Ø externo na vista frontal.'
        });
        if (st.furo.included) {
            defs.push({
                id: 'bore_hole', title: 'Furo Passante', badge: 'HOLE',
                desc: 'Furo de passagem Ø' + fmt(d.furo) + 'mm — fundo do furo de rosca.',
                tip: 'Depois do furo, o mandrilamento prepara o Ø menor da rosca.'
            });
        }
        if (st.rosca.included) {
            defs.push({
                id: 'thread_prebore', title: 'Mandrilamento para a Rosca', badge: 'BORE',
                desc: 'Mandrilamento até Ø' + fmt(this.threadMinor(d)) + 'mm (Ø menor da rosca M' + fmt(d.roscaD) + '×' + fmt(d.passo) + ').',
                tip: 'Ø menor ≈ Ønominal − 1,0825 × passo. Sem esse preparo, a rosca fica cortada.'
            });
            defs.push({
                id: 'thread_cut', title: 'Roscar o Furo', badge: 'THREAD',
                desc: 'Thread com profundidade de ' + fmt(d.roscaProf) + 'mm — no CNC use o ciclo G76.',
                tip: 'No CAD: use a ferramenta de rosca (Cosmetic Thread ou Thread Feature).'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Chanfro de Entrada', badge: 'CHAMFER',
                desc: 'Chanfro de ' + fmt(d.chanfro) + 'mm × 45° na boca do furo — guia o eixo na montagem.',
                tip: 'Facilita o engate da rosca na montagem.'
            });
        }
        return defs;
    },
    stepCmd: {
        bushing_sketch: 'sketchTop', bushing_revolve: 'revolve', bore_hole: 'hole',
        thread_prebore: 'extrudeCut', thread_cut: 'extrudeCut', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const axisY = 120, x0 = 60;
        const cs = Math.max(2, Math.min(d.chanfro, 8));
        const minor = this.threadMinor(d);

        // PERFIL
        let perfil = svgRect(x0, axisY - d.D / 2, d.L, d.D, 'surface') +
            svgLine(x0 - 20, axisY, x0 + d.L + 20, axisY, 'cut-line');
        if (st.rosca.included) {
            perfil += svgLine(x0, axisY - minor / 2, x0 + d.L, axisY - minor / 2, 'hidden') +
                svgLine(x0, axisY + minor / 2, x0 + d.L, axisY + minor / 2, 'hidden') +
                svgText(x0 + d.L / 2, axisY - minor / 2 - 8, 'M' + fmt(d.roscaD) + '×' + fmt(d.passo), 'label', 'middle');
        } else if (st.furo.included) {
            perfil += svgLine(x0, axisY - d.furo / 2, x0 + d.L, axisY - d.furo / 2, 'hidden') +
                svgLine(x0, axisY + d.furo / 2, x0 + d.L, axisY + d.furo / 2, 'hidden');
        }
        if (st.chamfer.included) {
            perfil += svgPolyline([[x0, axisY - d.D / 2], [x0 + cs, axisY - d.D / 2 + cs], [x0 + cs, axisY - d.D / 2]], 'chamfer-line');
        }
        perfil += dimV(axisY - d.D / 2, axisY + d.D / 2, 38, 'Ø' + fmt(d.D), 'rot-l') +
            dimH(x0, x0 + d.L, axisY + d.D / 2 + 22, fmt(d.L));

        // FRONTAL
        const fcx = 110, fcy = 110;
        let frontal = svgCircle(fcx, fcy, d.D / 2, 'surface') +
            svgLine(fcx - d.D / 2 - 14, fcy, fcx + d.D / 2 + 14, fcy, 'cut-line') +
            svgLine(fcx, fcy - d.D / 2 - 14, fcx, fcy + d.D / 2 + 14, 'cut-line');
        if (st.rosca.included) {
            frontal += svgCircle(fcx, fcy, d.roscaD / 2, 'hidden') +
                svgCircle(fcx, fcy, minor / 2, 'hole') +
                dimH(fcx - d.roscaD / 2, fcx + d.roscaD / 2, fcy - d.D / 2 - 18, 'M' + fmt(d.roscaD), -8);
        } else if (st.furo.included) {
            frontal += svgCircle(fcx, fcy, d.furo / 2, 'hole');
        }
        frontal += dimH(fcx - d.D / 2, fcx + d.D / 2, fcy + d.D / 2 + 22, 'Ø' + fmt(d.D));

        // SEÇÃO A-A
        let secao = svgRect(x0, axisY - d.D / 2, d.L, d.D, 'surface') + hatchBlock();
        const boreR = st.rosca.included ? minor / 2 : (st.furo.included ? d.furo / 2 : 0);
        if (boreR > 0) {
            secao += svgRect(x0, axisY - d.D / 2, d.L, d.D / 2 - boreR, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
                svgRect(x0, axisY + boreR, d.L, d.D / 2 - boreR, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        } else {
            secao += svgRect(x0, axisY - d.D / 2, d.L, d.D, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"');
        }
        if (st.rosca.included) {
            secao += svgLine(x0, axisY - d.roscaD / 2, x0 + d.roscaProf, axisY - d.roscaD / 2, 'hidden') +
                svgLine(x0, axisY + d.roscaD / 2, x0 + d.roscaProf, axisY + d.roscaD / 2, 'hidden') +
                dimH(x0, x0 + d.roscaProf, axisY + d.D / 2 + 22, 'ROS. ' + fmt(d.roscaProf));
        }
        secao += svgLine(x0 - 20, axisY, x0 + d.L + 20, axisY, 'cut-line') +
            dimV(axisY - d.D / 2, axisY + d.D / 2, 38, 'Ø' + fmt(d.D), 'rot-l') +
            svgText(x0 + d.L / 2, axisY - d.D / 2 - 12, 'A-A', 'label', 'middle');

        // DETALHE DA ROSCA (perfil de filete com passo)
        const zx = 50, zy = 70;
        let det = '';
        if (st.rosca.included) {
            const pitch = d.passo * 12; // escala 12:1
            for (let i = 0; i < 5; i++) {
                det += svgPolyline([
                    [zx + i * pitch, zy], [zx + i * pitch + pitch / 2, zy - 22],
                    [zx + i * pitch + pitch, zy]
                ], 'chamfer-line');
            }
            det += svgLine(zx - 8, zy, zx + 5 * pitch + 8, zy, 'dim') +
                svgText(zx + pitch * 2, zy + 22, 'PASSO ' + fmt(d.passo) + ' mm', 'dim-text', 'middle') +
                svgText(zx + pitch * 2, zy - 32, 'M' + fmt(d.roscaD) + ' × ' + fmt(d.passo) + ' - 6H', 'label', 'middle');
        } else {
            det += svgRect(zx, zy - 30, 200, 50, 'surface') +
                svgText(zx + 12, zy, 'SEM ROSCA', 'label');
        }
        det = svgText(zx - 22, zy - 24, 'B', 'label') + det;

        return [
            { svg: createSVG(perfil, '20 15 ' + (d.L + 130) + ' ' + (d.D + 110), t) },
            { svg: createSVG(frontal, '20 12 220 220', t) },
            { svg: createSVG(secao, '20 15 ' + (d.L + 130) + ' ' + (d.D + 110), t) },
            { svg: createSVG(det, '20 20 280 120', t) }
        ];
    },
    gcode(d, st) {
        const L = [], minor = this.threadMinor(d);
        const hMicrons = Math.round(this.threadHeight(d) * 1000);
        L.push('%',
            'O0009 (BUCHA COM ROSCA INTERNA - TORNEAMENTO)',
            '(PECA: Ø' + fmt(d.D) + ' X ' + fmt(d.L) + ' - ROSCA M' + fmt(d.roscaD) + 'X' + fmt(d.passo) + ' INTERNA)',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: BARRA Ø' + fmt(d.D + 5) + ' X ' + fmt(d.L + 15) + ')',
            '(T01 - SERRILHA - DESBASTE DO EXTERNO)',
            '(T02 - ACABAMENTO 55G)',
            '(T03 - BROCA D' + fmt(Math.min(d.furo, 18)) + ' - FURO DE PASSAGEM)',
            '(T04 - MANDRIL - PREPARO Ø' + fmt(minor) + ' (MENOR DA ROSCA))',
            '(T05 - PONTA DE ROSCAR INTERNA 60G - ROSCA M' + fmt(d.roscaD) + 'X' + fmt(d.passo) + ')',
            '(G54 NO BICO / EIXO DE ROTACAO - Z0 NA FACE DA BUCHA)',
            'N10 G21 G99 G97 G40',
            'N20 T0101 M03 S1100',
            'N30 G00 X' + fmt(d.D + 6) + ' Z2. M08',
            '',
            '(=== DESBASTE DO EXTERNO ===)',
            'N40 G71 U1.5 R0.5',
            'N50 G71 P100 Q150 U0.3 W0.1 F0.25',
            'N100 G00 X' + fmt(d.D - 2 * d.chanfro),
            'N110 G01 X' + fmt(d.D) + ' Z-' + fmt(d.chanfro) + ' F0.12  (CHANFRO)',
            'N120 Z-' + fmt(d.L) + '.',
            'N150 X' + fmt(d.D + 4),
            'N160 G00 X' + fmt(d.D + 20) + ' Z20.',
            '',
            '(=== ACABAMENTO ===)',
            'N170 T0202 M03 S1600',
            'N180 G00 X' + fmt(d.D + 6) + ' Z2.',
            'N190 G70 P100 Q150 F0.12',
            'N200 G00 X' + fmt(d.D + 20) + ' Z20.');
        if (st.furo.included || st.rosca.included) {
            L.push('',
                '(=== FURO DE PASSAGEM ===)',
                'N210 T0303 M03 S900',
                'N220 G00 X0. Z2.',
                'N230 G74 R1.',
                'N240 G74 X0. Z-' + fmt(d.L + 2) + ' Q4000 R0. F0.1  (FURACAO COM RETORNO DE LASCAS)',
                'N250 G00 X' + fmt(d.D + 20) + ' Z20.');
        }
        if (st.rosca.included) {
            L.push('',
                '(=== PREPARO DO FURO - MANDRILAR ATE O Ø MENOR ===)',
                '(Ø MENOR = ØNOMINAL - 1.0825 x PASSO = ' + fmt(minor) + ')',
                'N260 T0404 M03 S1100',
                'N270 G00 X' + fmt(minor - 1) + ' Z2.',
                'N280 G01 Z-' + fmt(d.roscaProf + 1) + ' F0.1  (MANDRILAMENTO)',
                'N290 G01 X' + fmt(minor - 1) + ' F0.25',
                'N300 G00 Z2.',
                'N310 G00 X' + fmt(d.D + 20) + ' Z20.',
                '',
                '(=== ROSCA COM CICLO G76 ===)',
                '(G76 Pmmrraa Qmin Rd)',
                '(P: 02 PASSES DE ACABAMENTO, 00 SEM CHANFRO NA ROSCA, 60G ANGULO)',
                '(Q: CORTE MINIMO | R: SOBREMATERIAL | X: Ø MAIOR FINAL | P: ALTURA DO FILETE EM MICRONS)',
                'N320 T0505 M03 S700',
                'N330 G00 X' + fmt(minor - 1) + ' Z3.',
                'N340 G76 P020060 Q80 R0.05',
                'N350 G76 X' + fmt(d.roscaD) + ' Z-' + fmt(d.roscaProf) + ' P' + hMicrons + ' Q150 F' + fmt(d.passo),
                'N360 G00 X' + fmt(d.D + 20) + ' Z20.  (CUIDADO: ROSCA INTERNA RETIRA EM X CRESCENTE)');
        }
        L.push('N400 M09', 'N410 M05', 'N420 G28 U0. W0.', 'N430 M30', '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [];
        L.push('%',
            'O1009 (BUCHA COM ROSCA - MACRO PARAMETRICO)',
            '(O G76 RECEBE VALORES CALCULADOS A PARTIR DO PASSO)',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(d.D) + '   (Ø EXTERNO)',
            '#101 = ' + gf(d.L) + '    (COMPRIMENTO)',
            '#102 = ' + gf(d.furo) + '    (FURO DE PASSAGEM)',
            '#103 = ' + gf(d.roscaD) + '    (Ø NOMINAL DA ROSCA)',
            '#104 = ' + gf(d.passo) + '    (PASSO)',
            '#105 = ' + gf(d.roscaProf) + '    (PROFUNDIDADE DA ROSCA)',
            '#106 = ' + gf(d.chanfro) + '      (CHANFRO)',
            '',
            '(=== CALCULOS DA ROSCA (FORMULAS ISO) ===)',
            '#110 = #103 - 1.0825 * #104   (Ø MENOR DO FURO)',
            '#111 = 0.6134 * #104          (ALTURA DO FILETE)',
            '#112 = #111 * 1000            (ALTURA EM MICRONS - P DO G76)',
            '#113 = #104 * 0.4             (CORTE MINIMO Q EM MICRONS ~)',
            '',
            'G21 G99 G97 G40',
            'T0101 M03 S1100',
            'G00 X[#100 + 6] Z2. M08',
            'G71 U1.5 R0.5',
            'G71 P100 Q150 U0.3 W0.1 F0.25',
            'N100 G00 X[#100 - 2 * #106]',
            'N110 G01 X#100 Z[-#106] F0.12',
            'N120 Z[-#101]',
            'N150 X[#100 + 4]',
            'G00 X[#100 + 20] Z20.',
            'T0202 M03 S1600',
            'G00 X[#100 + 6] Z2.',
            'G70 P100 Q150 F0.12',
            'G00 X[#100 + 20] Z20.',
            '',
            '(=== FURO + MANDRILAMENTO ===)',
            'T0303 M03 S900',
            'G00 X0. Z2.',
            'G74 R1.',
            'G74 X0. Z[-#101 - 2] Q4000 R0. F0.1',
            'G00 X[#100 + 20] Z20.',
            'T0404 M03 S1100',
            'G00 X[#110 - 1] Z2.',
            'G01 Z[-#105 - 1] F0.1',
            'G01 X[#110 - 1] F0.25',
            'G00 Z2.',
            'G00 X[#100 + 20] Z20.',
            '',
            '(=== CICLO DE ROSCA COM VALORES CALCULADOS ===)',
            'T0505 M03 S700',
            'G00 X[#110 - 1] Z3.',
            'G76 P020060 Q80 R0.05',
            'G76 X#103 Z[-#105] P#112 Q150 F#104',
            'G00 X[#100 + 20] Z20.',
            'M09', 'M05', 'G28 U0. W0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// PARTE 10 — EIXO ROSQUEADO (torneamento — rosca externa)
// ============================================================
const eixoRosqueado = {
    id: 'eixo-rosqueado',
    name: 'Eixo rosqueado',
    tag: 'EIXO-ROSCADO',
    rev: 'A',
    process: 'Torneamento — rosca externa',
    machine: 'Torno CNC (comando FANUC)',
    control: 'ISO 6983 (FANUC G76)',
    stock: 'Barra Ø40 × 130 mm',
    difficulty: 'Avançado',
    icon: '🛠️',
    desc: 'Eixo com rosca externa M20×1,5, rasgo de escape e chanfros — o par da Bucha com Rosca (ajuste 6H/6g). Treina G76 externo e alívio de rosca.',
    exampleFile: 'eixo-rosqueado_rev-A.pdf',
    cssScene: false,
    isTurning: true,
    viewLabels: ['PERFIL', 'FRONTAL', 'SEÇÃO A-A', 'DETALHE DA ROSCA'],
    features: [{
        id: 'degraus',
        name: 'Degraus do eixo',
        hint: 'Cabeça + corpo roscado',
        included: true,
        params: [
            { key: 'diam_cabeca', label: 'Ø cabeça', unit: 'mm', value: 36 },
            { key: 'comp_cabeca', label: 'comp. cabeça', unit: 'mm', value: 25 },
            { key: 'diam_corpo', label: 'Ø corpo', unit: 'mm', value: 20 },
            { key: 'comp_corpo', label: 'comp. corpo', unit: 'mm', value: 95 }
        ]
    }, {
        id: 'rosca',
        name: 'Rosca externa M20×1,5',
        hint: 'Rosca no corpo com ciclo G76',
        included: true,
        params: [
            { key: 'diametro', label: 'Ø nominal', unit: 'mm', value: 20 },
            { key: 'passo', label: 'passo', unit: 'mm', value: 1.5 },
            { key: 'comprimento', label: 'compr.', unit: 'mm', value: 40 }
        ]
    }, {
        id: 'rasgo',
        name: 'Rasgo de escape',
        hint: 'Alívio no fim da rosca',
        included: true,
        params: [
            { key: 'diametro', label: 'Ø rasgo', unit: 'mm', value: 17 },
            { key: 'largura', label: 'largura', unit: 'mm', value: 3 }
        ]
    }, {
        id: 'chamfer',
        name: 'Chanfros',
        hint: 'Chanfros de guia e de montagem',
        included: true,
        params: [{ key: 'tamanho', label: 'tam.', unit: 'mm', value: 2 }]
    }],
    dimsFromState(st) {
        return {
            dCab: st.degraus.params.diam_cabeca,
            cCab: st.degraus.params.comp_cabeca,
            dCorpo: st.degraus.params.diam_corpo,
            cCorpo: st.degraus.params.comp_corpo,
            roscaD: st.rosca.params.diametro,
            passo: st.rosca.params.passo,
            roscaComp: st.rosca.params.comprimento,
            rasgoD: st.rasgo.params.diametro,
            rasgoL: st.rasgo.params.largura,
            chanfro: st.chamfer.params.tamanho
        };
    },
    threadMinor(d) {
        return d.roscaD - 1.0825 * d.passo;
    },
    computeMass(d, st) {
        let vol = Math.PI / 4 * (d.dCab * d.dCab * d.cCab + d.dCorpo * d.dCorpo * d.cCorpo);
        if (st.rosca.included) {
            const comp = Math.min(d.roscaComp, d.cCorpo);
            vol -= Math.PI / 4 * (d.dCorpo * d.dCorpo - Math.pow(this.threadMinor(d), 2)) * comp;
        }
        if (st.rasgo.included) {
            vol -= Math.PI / 4 * (d.dCorpo * d.dCorpo - d.rasgoD * d.rasgoD) * d.rasgoL;
        }
        return Math.max(vol, 0) * MATERIAL.density / 1e6;
    },
    techRows(d, st) {
        return [
            { label: 'Cabeça', value: 'Ø' + fmt(d.dCab) + ' × ' + fmt(d.cCab) + ' mm' },
            { label: 'Corpo', value: 'Ø' + fmt(d.dCorpo) + ' × ' + fmt(d.cCorpo) + ' mm' },
            { label: 'Comprimento total', value: fmt(d.cCab + d.cCorpo) + ' mm' },
            { label: 'Rosca', value: st.rosca.included ? 'M' + fmt(d.roscaD) + ' × ' + fmt(d.passo) + ' - 6g × ' + fmt(d.roscaComp) + ' mm' : '—' },
            { label: 'Ø menor (referência)', value: st.rosca.included ? 'Ø' + fmt(this.threadMinor(d)) + ' mm' : '—' },
            { label: 'Rasgo de escape', value: st.rasgo.included ? 'Ø' + fmt(d.rasgoD) + ' × ' + fmt(d.rasgoL) + ' mm' : '—' },
            { label: 'Chanfros', value: st.chamfer.included ? fmt(d.chanfro) + ' × 45°' : '—' },
            { label: 'Par de ajuste', value: 'BUCHA-ROSCA M20×1,5 (6H)' }
        ];
    },
    buildSteps(st) {
        const d = this.dimsFromState(st);
        const defs = [];
        defs.push({
            id: 'shaft_sketch', title: 'Esboçar o Perfil', badge: 'SKETCH',
            desc: 'Perfil do eixo: cabeça Ø' + fmt(d.dCab) + '×' + fmt(d.cCab) + 'mm e corpo Ø' + fmt(d.dCorpo) + '×' + fmt(d.cCorpo) + 'mm.',
            tip: 'Meio perfil com linha de centro.'
        });
        defs.push({
            id: 'shaft_revolve', title: 'Revolver o Perfil', badge: 'REVOLVE',
            desc: 'Revolved Boss/Base 360°.',
            tip: 'Confira os dois degraus na vista frontal.'
        });
        if (st.rosca.included) {
            defs.push({
                id: 'thread_prep', title: 'Preparar o Diâmetro da Rosca', badge: 'TURN',
                desc: 'Rebaixe o corpo para Ø' + fmt(this.threadMinor(d)) + 'mm no comprimento da rosca (' + fmt(d.roscaComp) + 'mm) — Ø menor da rosca M' + fmt(d.roscaD) + '×' + fmt(d.passo) + '.',
                tip: 'No CAD, o recurso de rosca cuida disso; no CNC é o passe de preparo.'
            });
            defs.push({
                id: 'thread_cut', title: 'Roscar o Eixo', badge: 'THREAD',
                desc: 'Rosca externa M' + fmt(d.roscaD) + '×' + fmt(d.passo) + ' com ' + fmt(d.roscaComp) + 'mm de comprimento — ciclo G76 no CNC.',
                tip: 'Acompanhe com anel calibrador M' + fmt(d.roscaD) + '.'
            });
        }
        if (st.rasgo.included) {
            defs.push({
                id: 'groove_cut', title: 'Rasgo de Escape', badge: 'CUT',
                desc: 'Rasgo de Ø' + fmt(d.rasgoD) + 'mm × ' + fmt(d.rasgoL) + 'mm no fim da rosca — garante saída da ferramenta.',
                tip: 'Sem o rasgo de escape, a rosca não fecha até o fundo.'
            });
        }
        if (st.chamfer.included) {
            defs.push({
                id: 'chamfer', title: 'Chanfros', badge: 'CHAMFER',
                desc: 'Chanfros de ' + fmt(d.chanfro) + 'mm × 45° na ponta roscada e na face da cabeça.',
                tip: 'O chanfro da ponta funciona como guia de engate na bucha.'
            });
        }
        return defs;
    },
    stepCmd: {
        shaft_sketch: 'sketchTop', shaft_revolve: 'revolve', thread_prep: 'extrudeCut',
        thread_cut: 'extrudeCut', groove_cut: 'revolveCut', chamfer: 'chamfer'
    },
    views(ctx) {
        const { d, st, t } = ctx;
        const total = d.cCab + d.cCorpo;
        const maxD = Math.max(d.dCab, d.dCorpo);
        const x0 = 60, axisY = 50 + maxD / 2 + 20;
        const cs = Math.max(2, Math.min(d.chanfro, 8));
        const minor = this.threadMinor(d);

        // PERFIL
        let perfil = svgRect(x0, axisY - d.dCab / 2, d.cCab, d.dCab, 'surface') +
            svgRect(x0 + d.cCab, axisY - d.dCorpo / 2, d.cCorpo, d.dCorpo, 'surface-wall') +
            svgLine(x0 - 20, axisY, x0 + total + 20, axisY, 'cut-line');
        if (st.rosca.included) {
            perfil += svgLine(x0 + total - d.roscaComp, axisY - minor / 2, x0 + total, axisY - minor / 2, 'hidden') +
                svgLine(x0 + total - d.roscaComp, axisY + minor / 2, x0 + total, axisY + minor / 2, 'hidden') +
                svgText(x0 + total - d.roscaComp / 2, axisY - minor / 2 - 8, 'M' + fmt(d.roscaD) + '×' + fmt(d.passo), 'label', 'middle');
        }
        if (st.rasgo.included) {
            const zx = x0 + total - d.roscaComp - d.rasgoL;
            perfil += svgRect(zx, axisY - d.rasgoD / 2, d.rasgoL, d.rasgoD, 'hole');
        }
        if (st.chamfer.included) {
            perfil += svgPolyline([[x0 + total, axisY - d.dCorpo / 2], [x0 + total - cs, axisY - d.dCorpo / 2 + cs], [x0 + total - cs, axisY - d.dCorpo / 2]], 'chamfer-line');
        }
        perfil += dimV(axisY - d.dCab / 2, axisY + d.dCab / 2, 38, 'Ø' + fmt(d.dCab), 'rot-l') +
            dimV(axisY - d.dCorpo / 2, axisY + d.dCorpo / 2, x0 + total + 22, 'Ø' + fmt(d.dCorpo), 'start-r') +
            dimH(x0, x0 + d.cCab, axisY + maxD / 2 + 30, fmt(d.cCab)) +
            dimH(x0 + d.cCab, x0 + total, axisY + maxD / 2 + 30, fmt(d.cCorpo)) +
            dimH(x0, x0 + total, axisY + maxD / 2 + 55, fmt(total));

        // FRONTAL
        const fcx = 110, fcy = 110;
        let frontal = svgCircle(fcx, fcy, d.dCab / 2, 'surface') +
            svgCircle(fcx, fcy, d.dCorpo / 2, 'hidden') +
            svgLine(fcx - d.dCab / 2 - 14, fcy, fcx + d.dCab / 2 + 14, fcy, 'cut-line') +
            svgLine(fcx, fcy - d.dCab / 2 - 14, fcx, fcy + d.dCab / 2 + 14, 'cut-line') +
            dimH(fcx - d.dCab / 2, fcx + d.dCab / 2, fcy + d.dCab / 2 + 22, 'Ø' + fmt(d.dCab));

        // SEÇÃO A-A
        let secao = svgRect(x0, axisY - d.dCab / 2, d.cCab, d.dCab, 'surface') +
            svgRect(x0 + d.cCab, axisY - d.dCorpo / 2, d.cCorpo, d.dCorpo, 'surface-wall') + hatchBlock() +
            svgRect(x0, axisY - d.dCab / 2, d.cCab, d.dCab, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
            svgRect(x0 + d.cCab, axisY - d.dCorpo / 2, d.cCorpo, d.dCorpo, 'hatch-fill', 'fill="url(#hatchPattern)" opacity="0.3"') +
            svgLine(x0 - 20, axisY, x0 + total + 20, axisY, 'cut-line') +
            dimH(x0, x0 + total, axisY + maxD / 2 + 30, fmt(total)) +
            svgText(x0 + total / 2, axisY - maxD / 2 - 12, 'A-A', 'label', 'middle');

        // DETALHE DA ROSCA
        const zx = 50, zy = 70;
        let det = '';
        if (st.rosca.included) {
            const pitch = d.passo * 12;
            for (let i = 0; i < 5; i++) {
                det += svgPolyline([
                    [zx + i * pitch, zy], [zx + i * pitch + pitch / 2, zy - 22],
                    [zx + i * pitch + pitch, zy]
                ], 'chamfer-line');
            }
            det += svgLine(zx - 8, zy, zx + 5 * pitch + 8, zy, 'dim') +
                svgText(zx + pitch * 2, zy + 22, 'PASSO ' + fmt(d.passo) + ' mm', 'dim-text', 'middle') +
                svgText(zx + pitch * 2, zy - 32, 'M' + fmt(d.roscaD) + ' × ' + fmt(d.passo) + ' - 6g', 'label', 'middle');
        } else {
            det += svgRect(zx, zy - 30, 200, 50, 'surface') +
                svgText(zx + 12, zy, 'SEM ROSCA', 'label');
        }
        det = svgText(zx - 22, zy - 24, 'B', 'label') + det;

        return [
            { svg: createSVG(perfil, '20 8 ' + (total + 130) + ' ' + (maxD + 130), t) },
            { svg: createSVG(frontal, '20 12 220 220', t) },
            { svg: createSVG(secao, '20 8 ' + (total + 130) + ' ' + (maxD + 110), t) },
            { svg: createSVG(det, '20 20 280 120', t) }
        ];
    },
    gcode(d, st) {
        const L = [], total = d.cCab + d.cCorpo, minor = this.threadMinor(d);
        const hMicrons = Math.round(0.6134 * d.passo * 1000);
        const ch = st.chamfer.included ? d.chanfro : 0;
        L.push('%',
            'O0010 (EIXO ROSQUEADO - TORNEAMENTO COM ROSCA EXTERNA)',
            '(PECA: Ø' + fmt(d.dCab) + '/Ø' + fmt(d.dCorpo) + ' L' + fmt(total) + ' - ROSCA M' + fmt(d.roscaD) + 'X' + fmt(d.passo) + ')',
            '(MATERIAL: ' + MATERIAL.name + ' - ESTOQUE: BARRA Ø' + fmt(d.dCab + 4) + ' X ' + fmt(total + 15) + ')',
            '(T01 - SERRILHA ROUGHING 80G)',
            '(T02 - ACABAMENTO 55G)',
            '(T03 - RANHURADORA 3MM - RASGO DE ESCAPE)',
            '(T04 - PONTA DE ROSCAR EXTERNA 60G)',
            '(G54 NO BICO / EIXO DE ROTACAO - Z0 NA FACE)',
            'N10 G21 G99 G97 G40',
            'N20 T0101 M03 S1100',
            'N30 G00 X' + fmt(d.dCab + 6) + ' Z2. M08',
            '',
            '(=== DESBASTE DO PERFIL - G71 ===)',
            '(INCLUI A PREPARACAO DO Ø DA ROSCA)',
            'N40 G71 U1.5 R0.5',
            'N50 G71 P100 Q200 U0.3 W0.1 F0.25',
            'N100 G00 X' + fmt(d.dCorpo - 2 * ch));
        if (ch) {
            L.push('N110 G01 X' + fmt(d.dCorpo) + ' Z-' + fmt(ch) + ' F0.12  (CHANFRO DA PONTA)');
        } else {
            L.push('N110 G01 X' + fmt(d.dCorpo) + ' Z0. F0.12');
        }
        if (st.rasgo.included) {
            const zRasgo = d.roscaComp + d.rasgoL / 2;
            L.push('N120 Z-' + fmt(Math.min(d.roscaComp, d.cCorpo)) + '  (COMPRIMENTO DA ROSCA)',
                'N130 X' + fmt(d.rasgoD) + '  (RASGO DE ESCAPE Ø' + gf(d.rasgoD) + ')',
                'N140 Z-' + fmt(Math.min(d.roscaComp + d.rasgoL, d.cCorpo)) + '.',
                'N150 X' + fmt(d.dCorpo) + '.');
        } else {
            L.push('N120 Z-' + fmt(d.cCorpo) + '.');
        }
        L.push('N160 X' + fmt(d.dCab - 2 * ch) + '  (TRANSICAO PARA A CABECA)');
        if (ch) {
            L.push('N170 X' + fmt(d.dCab) + ' Z-' + fmt(d.cCorpo + ch) + '  (CHANFRO DA TRANSICAO)');
        }
        L.push('N180 Z-' + fmt(total) + '  (CABECA Ø' + gf(d.dCab) + ')',
            'N200 X' + fmt(d.dCab + 4),
            'N210 G00 X' + fmt(d.dCab + 20) + ' Z20.',
            '',
            '(=== ACABAMENTO - G70 ===)',
            'N220 T0202 M03 S1700',
            'N230 G00 X' + fmt(d.dCab + 6) + ' Z2.',
            'N240 G70 P100 Q200 F0.12',
            'N250 G00 X' + fmt(d.dCab + 20) + ' Z20.');
        if (st.rasgo.included) {
            const zRasgo = Math.min(d.roscaComp, d.cCorpo);
            L.push('',
                '(=== RASGO DE ESCAPE ===)',
                'N260 T0303 M03 S800',
                'N270 G00 X' + fmt(d.dCorpo + 2) + ' Z-' + fmt(zRasgo) + '.',
                'N280 G01 X' + fmt(d.rasgoD) + ' F0.06  (CORTE RADIAL)',
                'N290 G04 X0.2',
                'N300 G01 X' + fmt(d.dCorpo + 2) + ' F0.2',
                'N310 G00 X' + fmt(d.dCab + 20) + ' Z20.');
        }
        if (st.rosca.included) {
            const zStart = ch;
            L.push('',
                '(=== ROSCA EXTERNA COM CICLO G76 ===)',
                '(X FINAL = Ø MENOR DA ROSCA = ' + fmt(minor) + ' = ØNOM - 1.0825 x PASSO)',
                '(P: 2 PASSES DE ACABAMENTO, 00 SEM CHANFRO, 60G | Q: CORTE MINIMO | R: SOBREMATERIAL)',
                'N320 T0404 M03 S700',
                'N330 G00 X' + fmt(d.roscaD + 4) + ' Z' + fmt(zStart + 3) + '.',
                'N340 G76 P020060 Q80 R0.05',
                'N350 G76 X' + fmt(minor) + ' Z-' + fmt(Math.min(d.roscaComp, d.cCorpo)) + ' P' + hMicrons + ' Q150 F' + fmt(d.passo),
                'N360 G00 X' + fmt(d.dCab + 20) + ' Z20.');
        }
        L.push('N400 M09', 'N410 M05', 'N420 G28 U0. W0.', 'N430 M30', '%');
        return L.join('\n');
    },
    macro(d, st) {
        const L = [], total = d.cCab + d.cCorpo;
        L.push('%',
            'O1010 (EIXO ROSQUEADO - MACRO PARAMETRICO)',
            '(O PAR DE PECAS E CALCULADO: Ø MENOR DA ROSCA = ØNOM - 1.0825 x PASSO)',
            '',
            '(=== PARAMETROS ===)',
            '#100 = ' + gf(d.dCab) + '   (Ø DA CABECA)',
            '#101 = ' + gf(d.cCab) + '    (COMP. DA CABECA)',
            '#102 = ' + gf(d.dCorpo) + '    (Ø DO CORPO)',
            '#103 = ' + gf(d.cCorpo) + '   (COMP. DO CORPO)',
            '#104 = ' + gf(d.roscaD) + '    (Ø NOMINAL DA ROSCA)',
            '#105 = ' + gf(d.passo) + '    (PASSO)',
            '#106 = ' + gf(d.roscaComp) + '    (COMPRIMENTO DA ROSCA)',
            '#107 = ' + gf(d.rasgoD) + '    (Ø DO RASGO DE ESCAPE)',
            '#108 = ' + gf(d.rasgoL) + '      (LARGURA DO RASGO)',
            '#109 = ' + gf(d.chanfro) + '      (CHANFRO)',
            '',
            '(=== CALCULOS ===)',
            '#110 = #104 - 1.0825 * #105   (Ø MENOR DA ROSCA)',
            '#111 = 0.6134 * #105 * 1000   (ALTURA DO FILETE EM MICRONS)',
            '#112 = #103 + #101            (COMPRIMENTO TOTAL)',
            '#113 = #106 + #108            (FIM DO RASGO A PARTIR DA PONTA)',
            '',
            'G21 G99 G97 G40',
            'T0101 M03 S1100',
            'G00 X[#100 + 6] Z2. M08',
            'G71 U1.5 R0.5',
            'G71 P100 Q200 U0.3 W0.1 F0.25',
            'N100 G00 X[#102 - 2 * #109]',
            'N110 G01 X#102 Z[-#109] F0.12',
            'N120 Z[-#106]',
            'N130 X#107  (RASGO DE ESCAPE)',
            'N140 Z[-#113]',
            'N150 X#102',
            'N160 X[#100 - 2 * #109] Z[-#103 - #109]',
            'N180 X#100 Z[-#103 - 2 * #109]',
            'N190 Z[-#112]',
            'N200 X[#100 + 4]',
            'G00 X[#100 + 20] Z20.',
            'T0202 M03 S1700',
            'G00 X[#100 + 6] Z2.',
            'G70 P100 Q200 F0.12',
            'G00 X[#100 + 20] Z20.',
            '',
            '(=== RASGO DE ESCAPE ===)',
            'T0303 M03 S800',
            'G00 X[#102 + 2] Z[-#106 - #108 / 2]',
            'G01 X#107 F0.06',
            'G04 X0.2',
            'G01 X[#102 + 2] F0.2',
            'G00 X[#100 + 20] Z20.',
            '',
            '(=== ROSCA EXTERNA - G76 COM VALORES CALCULADOS ===)',
            'T0404 M03 S700',
            'G00 X[#104 + 4] Z3.',
            'G76 P020060 Q80 R0.05',
            'G76 X#110 Z[-#106] P#111 Q150 F#105',
            'G00 X[#100 + 20] Z20.',
            'M09', 'M05', 'G28 U0. W0.', 'M30', '%');
        return L.join('\n');
    }
};

// ============================================================
// REGISTRO DE PARTES

const PARTS = {
    'suporte-l': suporteL,
    'placa-rasgo': placaRasgo,
    'flange': flange,
    'caixa-cavidade': caixaCavidade,
    'eixo-escalonado': eixoEscalonado,
    'cunha': cunha,
    'gabarito-furacao': gabaritoFuracao,
    'polia-v': poliaV,
    'bucha-rosca': buchaRosca,
    'eixo-rosqueado': eixoRosqueado
};
const DEFAULT_PART_ID = 'suporte-l';
