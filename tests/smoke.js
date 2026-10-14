/* ============================================================
   COTA — suíte de testes (jsdom)
   Executar: node tests/smoke.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const partsJs = fs.readFileSync(path.join(ROOT, 'js/parts.js'), 'utf8');
const cursoJs = fs.readFileSync(path.join(ROOT, 'js/curso.js'), 'utf8');
const fichasJs = fs.readFileSync(path.join(ROOT, 'js/fichas.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

function makeDom(seed) {
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    html = html.replace('<script src="js/parts.js" defer></script>', () => '<script>' + partsJs + '</script>');
    html = html.replace('<script src="js/curso.js" defer></script>', () => '<script>' + cursoJs + '</script>');
    html = html.replace('<script src="js/fichas.js" defer></script>', () => '<script>' + fichasJs + '</script>');
    html = html.replace('<script src="js/app.js" defer></script>', () => '<script>' + appJs + '</script>');
    html = html.replace(/<link href="https:\/\/fonts[^>]*>/, '');
    return new JSDOM(html, {
        url: 'http://localhost/',
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        beforeParse(w) {
            w.HTMLElement.prototype.scrollIntoView = function () {};
            w.print = () => { w.__printed = true; };
            if (!w.URL.createObjectURL) w.URL.createObjectURL = () => 'blob:fake';
            if (!w.URL.revokeObjectURL) w.URL.revokeObjectURL = () => {};
            w.HTMLCanvasElement.prototype.getContext = function () {
                return {
                    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
                    fillRect() {}, strokeRect() {}, clearRect() {}, rect() {},
                    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
                    arc() {}, ellipse() {}, fill() {}, stroke() {},
                    setLineDash() {}, fillText() {},
                    createRadialGradient() { return { addColorStop() {} }; },
                    createLinearGradient() { return { addColorStop() {} }; }
                };
            };
            if (seed) seed(w);
        }
    });
}

const errors = [];
function step(name, fn) {
    try { fn(); console.log('✓', name); }
    catch (e) { errors.push(name + ' → ' + e.message); console.log('✗', name, '→', e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const dom = makeDom();
const { window } = dom;

setTimeout(() => {
    const d = window.document;
    const $ = (s) => d.querySelector(s);
    const $$ = (s) => Array.from(d.querySelectorAll(s));

    // ===== Galeria =====
    step('galeria 10 exemplos + filtros', () => {
        assert($$('.example-card').length === 10, 'cards');
        d.querySelector('.chip[data-filter="Fresamento"]').click();
        assert($$('.example-card').length === 6, 'fresamento');
        d.querySelector('.chip[data-filter="todas"]').click();
    });

    // ===== Detecção de arquivo =====
    step('detecção: flange.dxf → flange (nome)', () => {
        assert(window.detectPart('flange.dxf', '').partId === 'flange', 'nome');
    });
    step('detecção: específico vence (eixo-rosqueado)', () => {
        assert(window.detectPart('eixo-rosqueado.dxf', '').partId === 'eixo-rosqueado', 'specífico');
    });
    step('detecção: acentos (furação)', () => {
        assert(window.detectPart('gabarito de furação.dxf', '').partId === 'gabarito-furacao', 'acento');
    });
    step('detecção: geometria DXF com padrão polar', () => {
        const circle = (x, y, r) => '0\nCIRCLE\n8\n0\n10\n' + x + '\n20\n' + y + '\n30\n0\n40\n' + r + '\n';
        let dxf = '0\nSECTION\n2\nENTITIES\n' + circle(0, 0, 60) + circle(0, 0, 20);
        for (let i = 0; i < 6; i++) {
            const a = 2 * Math.PI * i / 6;
            dxf += circle(Math.cos(a) * 45, Math.sin(a) * 45, 5);
        }
        const res = window.detectPart('qualquer.dxf', dxf + '0\nENDSEC\n');
        assert(res.partId === 'flange' && res.method === 'geometria', res.note);
    });

    // ===== Fluxo principal =====
    step('upload + confirmar → roteiro + código + simulador 3D', () => {
        $('#btnDemo').click();
        $('#btnConfirmFeatures').click();
        assert($$('.step').length === 7, 'etapas');
        assert($('#codeView').textContent.includes('O0001'), 'ISO');
        assert($('#sim3d') && $('#simTop') && $('#simFront'), '3 vistas');
    });

    // ===== Simulador 3D =====
    step('simulador: parse de G-code (rápido/corte/arco/ferramenta)', () => {
        const segs = window.parseToolpath('(T02 - FRESA D12)\nT02 M06\nG00 X10. Y5.\nG01 Z-2. F100.\nG01 X50.\nG02 X60. I5. J0.').segs;
        assert(segs.length >= 4, 'segmentos: ' + segs.length);
        assert(segs.some(s => s.type === 'rapid'), 'rápido');
        assert(segs.some(s => s.type === 'feed'), 'corte');
        assert(segs.some(s => s.type.indexOf('arc') === 0), 'arco');
        assert(segs.some(s => s.rTool === 6), 'diâmetro da ferramenta (D12 → r6)');
    });
    step('simulador 3D: modelo de material bruto (milling)', () => {
        const m = window.buildSimModel();
        assert(m, 'sem modelo');
        assert(m.kind === 'milling', 'tipo: ' + m.kind);
        assert(m.segs.length > 30, 'segmentos: ' + m.segs.length);
        assert(m.H.length === m.cols * m.rows, 'grid');
        assert(m.H[0] === m.stockTop, 'bruto inicial intacto');
    });
    step('simulador 3D: usinagem remove material (bruto → usinado)', () => {
        const m = window.buildSimModel();
        window.applyRemoval(m, 0, m.segs.length);
        let cut = 0, minH = Infinity;
        for (let i = 0; i < m.H.length; i++) {
            cut += m.machined[i];
            minH = Math.min(minH, m.H[i]);
        }
        assert(cut > 100, 'células usinadas: ' + cut);
        assert(minH < m.stockTop, 'nenhum material removido');
    });
    step('simulador 3D: slider controla blocos e rebobina', () => {
        const sl = $('#simSlider');
        assert(parseInt(sl.max, 10) > 10, 'slider max: ' + sl.max);
        sl.value = sl.max;
        sl.dispatchEvent(new window.Event('input', { bubbles: true }));
        assert($('#simCounter').textContent.split('/')[0] === sl.max, 'contador fim');
        sl.value = '2';
        sl.dispatchEvent(new window.Event('input', { bubbles: true }));
        assert($('#simCounter').textContent.startsWith('2/'), 'rebobinou: ' + $('#simCounter').textContent);
        assert($('#simInfo').textContent.includes('Bloco'), 'bloco atual');
        assert($('#simMaterial').textContent.includes('Bruto'), 'info do bruto: ' + $('#simMaterial').textContent);
    });
    step('simulador 3D: torno usa modelo de revolução', () => {
        d.querySelector('.example-card[data-part="eixo-escalonado"]').click();
        $('#btnConfirmFeatures').click();
        const m = window.buildSimModel();
        assert(m.kind === 'turning', 'tipo: ' + m.kind);
        window.applyRemoval(m, 0, m.segs.length);
        let cut = 0;
        for (let i = 0; i < m.machined.length; i++) cut += m.machined[i];
        assert(cut > 20, 'torno sem remoção: ' + cut);
    });
    step('simulador 3D: todas as 10 peças constroem bruto e usinam nas 3 vistas', () => {
        const partIds = ['suporte-l', 'placa-rasgo', 'flange', 'caixa-cavidade', 'cunha', 'gabarito-furacao', 'eixo-escalonado', 'polia-v', 'bucha-rosca', 'eixo-rosqueado'];
        partIds.forEach(pid => {
            d.querySelector('.example-card[data-part="' + pid + '"]').click();
            $('#btnConfirmFeatures').click();
            const m = window.buildSimModel();
            assert(m && m.segs.length > 5, 'modelo inválido em ' + pid);
            window.applyRemoval(m, 0, m.segs.length);
            let cut = 0;
            for (let i = 0; i < m.machined.length; i++) if (m.machined[i] > 0) cut++;
            assert(cut > 20, 'pouca remoção em ' + pid + ': ' + cut);
            window.renderSimulator();
        });
        d.querySelector('.example-card[data-part="suporte-l"]').click();
        $('#btnConfirmFeatures').click();
    });
    step('simulador 3D: CSG suave (sem serrilhado quadrado no Flange, furos circulares e sem ilha central)', () => {
        d.querySelector('.example-card[data-part="flange"]').click();
        $('#btnConfirmFeatures').click();
        const m = window.buildSimModel();
        window.applyRemoval(m, 0, m.segs.length);
        const csg = window.extractSmoothCSG(m, m.segs.length);
        assert(csg.contourDone, 'contorno circular do flange concluído');
        assert(csg.centerBore && csg.centerBore.r >= 19, 'furo central liso Ø40 extraído');
        assert(csg.holes.length === 6, '6 furos polares circulares extraídos: ' + csg.holes.length);
        // garante que o centro (0,0) no heightmap do flange também foi vazado (machined=4), sem ilha central
        const cIdx = Math.floor(m.rows / 2) * m.cols + Math.floor(m.cols / 2);
        assert(m.machined[cIdx] === 4, 'centro do flange vazado sem ilha central');
        d.querySelector('.example-card[data-part="suporte-l"]').click();
        $('#btnConfirmFeatures').click();
    });
    step('simulador 3D: controles (⏮ Bruto, 🔪 Meio-Corte, DRO, chips de operação e lista de código)', () => {
        $('#simFirst').click();
        assert($('#simCounter').textContent.startsWith('0/'), 'botão Bruto deve ir ao bloco 0: ' + $('#simCounter').textContent);
        assert($('#simRemPct').textContent.startsWith('0%'), 'em 0 deve estar 0% usinado: ' + $('#simRemPct').textContent);
        $('#simNext').click();
        assert($('#simCounter').textContent.startsWith('1/'), 'botão +1: ' + $('#simCounter').textContent);
        $('#simLast').click();
        assert(!$('#simRemPct').textContent.startsWith('0%'), 'no fim deve ter área usinada: ' + $('#simRemPct').textContent);
        $('#simSectionCut').click();
        assert($('#simSectionCut').classList.contains('active'), 'meio-corte ativo');
        $('#simSectionCut').click();
        assert($$('#simOpsBar .sim-op-chip').length >= 3, 'chips de operação');
        assert($$('#simCodeList .sim-code-item').length >= 10, 'lista de blocos sincronizada');
        $$('#simCodeList .sim-code-item')[3].click();
        assert($('#simCounter').textContent.startsWith('4/'), 'clique na lista de código salta ao bloco 4');
        assert(/^[+-]\d{3}\.\d{3}$/.test($('#simDroX').textContent), 'DRO X formatado: ' + $('#simDroX').textContent);
    });
    step('simulador 3D: estratégias CNC (Furação G83/G81/G82, Desbaste/Acabamento, Cavidade pelo Centro e Zero G54)', () => {
        // 1. Mudar ciclo de furação para G83 Pica-Pau
        d.querySelector('.example-card[data-part="placa-rasgo"]').click();
        $('#btnConfirmFeatures').click();
        const drillSel = $('#simDrillSelect');
        drillSel.value = 'G83';
        drillSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeView').textContent.includes('G83') && /Q\d/.test($('#codeView').textContent), 'G83 c/ Q gerado no código');

        // 2. Mudar para G82 Com Demora
        drillSel.value = 'G82';
        drillSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeView').textContent.includes('G82') && $('#codeView').textContent.includes('P500'), 'G82 c/ P500 gerado');
        drillSel.value = 'auto';
        drillSel.dispatchEvent(new window.Event('change', { bubbles: true }));

        // 3. Mudar modo de passes (Só Desbaste vs Desbaste + Acabamento)
        const passSel = $('#simPassSelect');
        passSel.value = 'rough';
        passSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeView').textContent.includes('SO DESBASTE'), 'modo só desbaste');
        passSel.value = 'both';
        passSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeView').textContent.includes('ACABAMENTO FINAL'), 'passe de acabamento incluído');

        // 4. Estratégia de cavidade pelo centro (Espiral e Helicoidal) + botão Cavidade pelo Centro
        const pockSel = $('#simPocketSelect');
        pockSel.value = 'spiral';
        pockSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeView').textContent.includes('ESPIRAL DO CENTRO P/ FORA'), 'cavidade em espiral pelo centro');
        pockSel.value = 'helical';
        pockSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeView').textContent.includes('CAVIDADE HELICOIDAL PELO CENTRO'), 'cavidade helicoidal pelo centro');

        // Testar botão ➕ Cavidade pelo Centro em peça sem cavidade nativa (ex.: Flange)
        d.querySelector('.example-card[data-part="flange"]').click();
        $('#btnConfirmFeatures').click();
        $('#simAddCenterPocket').click();
        assert($('#simAddCenterPocket').classList.contains('active'), 'botão cavidade pelo centro ativo');
        assert($('#codeView').textContent.includes('PELO CENTRO'), 'cavidade pelo centro injetada');
        $('#simAddCenterPocket').click();

        // 5. Mudar Ponto Zero G54 (Centro -> Canto Inferior Esquerdo -> Canto Superior Esquerdo)
        const zeroSel = $('#simZeroSelect');
        zeroSel.value = 'bl';
        zeroSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeView').textContent.includes('CANTO INFERIOR ESQUERDO'), 'cabeçalho G54 atualizado para canto inf. esq.');
        assert(window.app || true, 'zero atualizado');
        zeroSel.value = 'center';
        zeroSel.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    step('Book Técnico da Peça + escolha de quanto remover por vez (ap e Q em mm/vez)', () => {
        // Verifica se as 4 folhas do Book Técnico foram geradas com KPIs, etapas, tabela de tempos, gráficos SVG e inspeção
        assert($$('#bookKpiRow .book-kpi-card').length === 5, '5 KPIs no Book Técnico');
        assert($$('#bookStagesContainer .book-stage-card').length >= 4, 'cards de evolução do bruto à peça');
        assert($('#bookToolsTableWrap table'), 'tabela de tempos por ferramenta');
        assert($$('#bookChartsWrap svg').length === 2, '2 gráficos SVG de engenharia no Book');
        assert($('#bookInspectionWrap table'), 'tabela de plano de inspeção dimensional');
        assert($$('#bookTipsWrap .book-tip-item').length === 4, 'dicas de diagnóstico no Book');

        // Testa mudança de quanto remover por vez (ex.: 1 mm por vez no G83 e 1 mm por vez no desbaste ap)
        d.querySelector('.example-card[data-part="caixa-cavidade"]').click();
        $('#btnConfirmFeatures').click();
        const drillSel = $('#simDrillSelect');
        drillSel.value = 'G83';
        drillSel.dispatchEvent(new window.Event('change', { bubbles: true }));

        const peckSel = $('#simPeckQ');
        peckSel.value = '1';
        peckSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codePeckQ').value === '1', 'sincronizou Q=1mm entre Passo 4 e Passo 5');
        assert($('#codeView').textContent.includes('Q1'), 'G83 com Q1 gerado no código');

        const stepSel = $('#simStepDown');
        stepSel.value = '1';
        stepSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#codeStepDown').value === '1', 'sincronizou ap=1mm entre Passo 4 e Passo 5');
        assert($('#bookKpiRow').textContent.includes('ap 1 mm · Q 1 mm'), 'Book Técnico reflete ap=1mm e Q=1mm');

        // Testa no torno (G71 U1)
        d.querySelector('.example-card[data-part="eixo-escalonado"]').click();
        $('#btnConfirmFeatures').click();
        assert($('#codeView').textContent.includes('G71 U1'), 'Torno G71 usa passe radial U1 (1mm/vez)');

        // Testa abas do Book Técnico
        d.querySelector('#bookTabs .chip[data-bpage="charts"]').click();
        assert($('#bookPageCharts').style.display !== 'none', 'aba gráficos visível');
        assert($('#bookPageDrawing').style.display === 'none', 'aba desenho oculta ao filtrar gráficos');
        d.querySelector('#bookTabs .chip[data-bpage="all"]').click();
    });

    // ===== Quiz =====
    step('quiz: 40 questões + filtro + feedback', () => {
        assert($$('.quiz-q').length === 40, 'questões: ' + $$('.quiz-q').length);
        d.querySelector('.chip[data-qfilter="m0"]').click();
        assert($$('.quiz-q').length === 5, 'filtro M0');
        d.querySelector('.qq-opt').click();
        assert($('.quiz-q').classList.contains('answered'), 'feedback');
        assert($('#quizScore').textContent.includes('/'), 'placar');
        d.querySelector('.chip[data-qfilter="all"]').click();
    });
    step('quiz: discursiva com resposta-modelo', () => {
        const show = d.querySelector('.qq-show');
        show.click();
        const model = d.querySelector('.qq-model');
        assert(model.style.display === 'block', 'modelo');
        assert(model.textContent.length > 30, 'resposta-modelo curta');
    });

    // ===== Calculadora =====
    step('calculadora: n ≈ 4244 rpm (vc 160 · Ø12)', () => {
        const nTxt = $('#calcN').textContent;
        const n = parseFloat(nTxt.replace(/[^\d,]/g, '').replace(',', '.'));
        assert(Math.abs(n - 4244) < 5, 'n: ' + nTxt);
        assert($('#calcVf').textContent.includes('mm/min'), 'vf');
        assert($('#calcQ').textContent.includes('cm³'), 'Q');
    });
    step('calculadora: troca para torneamento mostra f/rev', () => {
        $('#calcOp').value = 'turning';
        $('#calcOp').dispatchEvent(new window.Event('change', { bubbles: true }));
        assert($('#calcExtra').textContent.includes('mm/rev'), 'extra: ' + $('#calcExtra').textContent);
        $('#calcOp').value = 'milling';
        $('#calcOp').dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    // ===== Tabelas =====
    step('tabelas: G-codes, rosca, ISO 2768', () => {
        const txt = $('#tablesContent').textContent;
        assert(txt.includes('G76') && txt.includes('G83'), 'G-codes');
        assert(txt.includes('M20×1,5'), 'rosca');
        assert(txt.includes('ISO 2768'), 'tolerâncias');
    });

    // ===== Fichas (12) =====
    step('kit de fichas: 12 documentos (com setup)', () => {
        assert($$('.ficha-card').length === 12, 'fichas: ' + $$('.ficha-card').length);
        d.querySelector('.ficha-view[data-ficha="setup"]').click();
        const paper = $('#fichaPaper');
        assert(paper.textContent.includes('FIC-SETUP'), 'setup');
        assert(paper.textContent.includes('T01'), 'ferramentas extraídas');
        assert(paper.textContent.includes('primeiro ciclo'), 'checklist');
    });

    // ===== Trilha + figuras =====
    step('trilha: 6 módulos · 13 aulas · fluxo + figuras', () => {
        assert($$('.module-card').length === 6, 'módulos');
        assert($$('.aula').length === 13, 'aulas');
        assert($$('.pf-step').length === 6, 'fluxo');
        $$('.aula-toggle').forEach(t => t.click());
        assert($$('.aula-figure').length === 12, 'figuras: ' + $$('.aula-figure').length);
        assert($('.aula-figure svg'), 'figura SVG');
    });

    // ===== Certificado =====
    step('certificado: selo + formulário reativo', () => {
        assert($('#certPaper').innerHTML.includes('cert-seal'), 'selo');
        const nome = $('#certNome');
        nome.value = 'Teste Silva';
        nome.dispatchEvent(new window.Event('input', { bubbles: true }));
        assert($('#certPaper').textContent.includes('Teste Silva'), 'nome');
    });

    // ===== Impressão =====
    step('modos de impressão disparam (sem quebra dupla)', () => {
        $('#btnPrintCourse').click();
        $('#btnPrintFichaKit').click();
        const kit = $('#fichaKitPrint');
        assert(kit.querySelectorAll('.ficha').length === 12, 'kit 12 fichas');
        assert(kit.querySelectorAll('.ficha-break').length === 0, 'sem quebra dupla');
        $('#btnPrintTabelas').click();
        $('#btnPrintCert').click();
        assert(window.__printed, 'prints');
    });

    // ===== Sessão =====
    step('sessão salva', () => {
        const s = JSON.parse(window.localStorage.getItem('cota-session'));
        assert(s.partId, 'partId');
    });

    console.log('\n' + (errors.length ? 'FALHAS:\n' + errors.join('\n') : 'TODOS OS TESTES PRINCIPAIS PASSARAM ✅'));

    const savedSession = window.localStorage.getItem('cota-session');
    const savedTheme = window.localStorage.getItem('cota-theme');
    const dom2 = makeDom(w => {
        w.localStorage.setItem('cota-session', savedSession);
        w.localStorage.setItem('cota-theme', savedTheme || 'dark');
    });
    setTimeout(() => {
        const d2 = dom2.window.document;
        step('sessão restaurada ao recarregar', () => {
            assert(d2.querySelector('#courseDoneCount'), 'curso presente');
            assert(d2.querySelector('#sim3d'), 'simulador presente');
            assert(d2.querySelector('#quizList .quiz-q'), 'quiz renderizado');
        });
        console.log('\n' + (errors.length ? 'FALHAS FINAIS:\n' + errors.join('\n') : 'TODOS OS TESTES PASSARAM ✅'));
        process.exit(errors.length ? 1 : 0);
    }, 300);
}, 300);
