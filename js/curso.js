'use strict';

/* ============================================================
   COTA — curso.js (v5.2)
   Trilha de formação profissional: CNC do desenho à peça pronta
   · 6 módulos · 13 aulas · 64h
   · cada aula: objetivos, tópicos, roteiro por fases,
     pontos de atenção e critérios de avaliação
   ============================================================ */

const COURSE = {
    title: 'CNC do Desenho à Peça Pronta',
    subtitle: 'Trilha de formação para operadores e programadores de CNC',
    audience: 'Colaboradores de usinagem (operadores, programadores e preparadores)',
    methodology: 'Teoria + demonstração no app + prática no simulador/painel + avaliação por checklist',
    certification: 'Certificado de conclusão — 64h (módulos avaliados individualmente)',

    modules: [
        // ============================================================
        // MÓDULO 0 — FUNDAMENTOS
        // ============================================================
        {
            id: 'm0',
            number: 0,
            title: 'Fundamentos, segurança e leitura técnica',
            level: 'Todos',
            goal: 'Preparar o colaborador para trabalhar com segurança no centro de usinagem e no torno, interpretar desenhos técnicos e compreender a estrutura de um programa ISO 6983.',
            note: 'Aula obrigatória antes de qualquer prática nas máquinas. Revalidar anualmente.',
            aulas: [{
                id: 'm0a1',
                num: '0.1',
                title: 'Segurança, fixação e zero-peça',
                hours: 4,
                partId: null,
                objectives: [
                    'Identificar os riscos da operação de CNC e aplicar as normas de segurança (EPIs, proteções, procedimento de parada de emergência)',
                    'Executar a fixação correta da peça e da ferramenta (garra, morsa, torque de aperto)',
                    'Definir o zero-peça (G54) com sensor de borda / apalpador e registrar os deslocamentos no painel'
                ],
                topics: [
                    'NR-12: proteções, cortinas, comando bimanual e parada de emergência',
                    'Tipos de fixação: morsa de precisão, placa de força, garra de 3 mandris (torno)',
                    'Zero-peça: teoria do G54/G55, apalpador eletrônico e referenciamento do torno (X/Z)',
                    'Ordem de ligação do comando: casa em Z (G28), referenciamento, alarmes'
                ],
                roteiro: [
                    { fase: 'Apresentação e segurança', min: 30, desc: 'Tour pela máquina desligada; pontos de risco; parada de emergência; EPIs obrigatórios.' },
                    { fase: 'Teoria', min: 60, desc: 'Fixação, zero-peça, sistemas de coordenadas (peça, mesa, ferramenta) e tabela de deslocamentos.' },
                    { fase: 'Demonstração', min: 45, desc: 'Preparador demonstra fixação da morsa, aperto com torque e busca de zero-peça com sensor.' },
                    { fase: 'Prática guiada', min: 90, desc: 'Cada participante executa fixação e zero-peça com acompanhamento; registra G54 no painel.' },
                    { fase: 'Avaliação', min: 45, desc: 'Checklist de segurança e setup; prova oral sobre riscos e procedimento de emergência.' }
                ],
                attention: [
                    'Nunca abrir a porta da máquina com o spindle girando — parar M05 e aguardar',
                    'Conferir o aperto da ferramenta SEMPRE antes do primeiro ciclo (perigo de peça voadora)',
                    'Zero-peça digitado errado é a causa nº 1 de colisões no primeiro programa',
                    'Primeiro ciclo sempre em Single Block + Feed Override baixo + Dry Run/sem peça'
                ],
                checklist: [
                    'Usa os EPIs corretos e identifica a parada de emergência',
                    'Fixa a peça com aperto adequado e sem folga',
                    'Executa a busca de zero-peça e grava o G54',
                    'Explica o procedimento de primeiro ciclo em modo seguro'
                ]
            }, {
                id: 'm0a2',
                num: '0.2',
                title: 'Leitura de desenho técnico e estrutura do programa ISO',
                hours: 4,
                partId: 'suporte-l',
                objectives: [
                    'Interpretar vistas ortográficas, cortes, detalhes e cotas de um desenho mecânico',
                    'Aplicar tolerâncias gerais ISO 2768 e identificar símbolos (Ø, ↧, rugosidade)',
                    'Reconhecer a estrutura de um programa ISO 6983: %, número O, blocos N, palavras G/M/T/S/F'
                ],
                topics: [
                    'Vistas: frontal, superior, lateral, corte A-A e detalhe ampliado',
                    'Cotagem funcional: tolerâncias dimensionais e geométricas (ISO 2768-m)',
                    'Estrutura do programa: cabeçalho, blocos, modalidade, comentário, fim (%)',
                    'Palavras de comando: G preparatórios, M auxiliares, T ferramenta, S rotação, F avanço'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 60, desc: 'Leitura de desenho: vistas, cotas, tolerâncias e simbologia técnica.' },
                    { fase: 'Demonstração no app', min: 45, desc: 'Abrir a folha técnica do Suporte em L e correlacionar cada vista com a peça física.' },
                    { fase: 'Prática guiada', min: 90, desc: 'Leitura dirigida de 3 desenhos; cada participante preenche uma ficha de leitura de cota.' },
                    { fase: 'Prática independente', min: 45, desc: 'Interpretação individual do desenho e transcrição dos parâmetros para o app.' },
                    { fase: 'Avaliação', min: 30, desc: 'Prova de leitura de desenho + identificação de palavras em um trecho de programa.' }
                ],
                attention: [
                    'Cotas sem tolerância seguem ISO 2768 — não são "livres"',
                    'Corte A-A mostra o interior: confira sempre as linhas ocultas antes de programar',
                    'Números decimais: no CNC "X50" e "X50." são válidos — "X50,5" (vírgula) NÃO é',
                    'Comentários entre parênteses ( ) servem para o humano — o comando ignora'
                ],
                checklist: [
                    'Lê vistas ortográficas e localiza uma cota em qualquer vista',
                    'Converte tolerâncias ISO 2768 em limites máximo/mínimo',
                    'Identifica G, M, T, S e F em um bloco de programa',
                    'Monta o cabeçalho de segurança de um programa no app'
                ]
            }]
        },

        // ============================================================
        // MÓDULO 1 — FRESAMENTO 2,5D BÁSICO
        // ============================================================
        {
            id: 'm1',
            number: 1,
            title: 'Fresamento 2,5D — fundamentos',
            level: 'Iniciante',
            goal: 'Dominar as operações fundamentais de fresamento: faceamento, contorno, furação com ciclos e chanfro, com escolha consciente de parâmetros de corte.',
            note: 'Usar o app para comparar código ISO × macro antes de ir para o simulador.',
            aulas: [{
                id: 'm1a1',
                num: '1.1',
                title: 'Suporte em L — faceamento, contorno e furação',
                hours: 4,
                partId: 'suporte-l',
                objectives: [
                    'Programar faceamento com passadas laterais e profundidade de passe adequada',
                    'Executar contorno externo com aproximação, avanço e afastamento corretos',
                    'Aplicar o ciclo de furação G83 (desbaste de lascas) em furo passante'
                ],
                topics: [
                    'Parâmetros de corte: vc, fz, ap, ae e relação com o material (SAE 1020)',
                    'Aproximação tangencial e lead-in/lead-out no contorno',
                    'Ciclo G83: R de referência, Q de lascamento, Z de saída (+2 mm)',
                    'Chanfro com fresa de 90°: profundidade = tamanho do chanfro'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 45, desc: 'Parâmetros de corte e leitura do roteiro de modelagem da peça.' },
                    { fase: 'Demonstração no app', min: 40, desc: 'Gerar o código da peça; percorrer cada bloco comentado; alterar uma dimensão e observar o recálculo.' },
                    { fase: 'Prática guiada', min: 90, desc: 'Cada participante escreve o programa do zero no app e compara com o gerado.' },
                    { fase: 'Prática independente', min: 60, desc: 'Simulação no painel/simulador com verificação de percurso.' },
                    { fase: 'Avaliação', min: 45, desc: 'Checklist de programação + simulação aprovada sem alarmes.' }
                ],
                attention: [
                    'Z de saída do G83 sempre 2 mm além da face de saída (senão fica rebarba no fundo)',
                    'Contorno sem lead-in marca a peça e sobrecarrega a fresa',
                    'Nunca posicionar Z dentro da peça em G00 (movimento rápido)',
                    'Conferir se a ferramenta do contorno tem canto vivo ou raio — muda o perfil'
                ],
                checklist: [
                    'Programa faceamento com passadas corretas',
                    'Programa contorno com aproximação/afastamento',
                    'Usa G83 com R e Q adequados à broca',
                    'Simula o programa completo sem colisão'
                ]
            }, {
                id: 'm1a2',
                num: '1.2',
                title: 'Placa com rasgo — cortes internos e padrão de furos',
                hours: 4,
                partId: 'placa-rasgo',
                objectives: [
                    'Programar limpeza interna de cavidade (rasgo) com desbaste e acabamento de parede',
                    'Posicionar padrões de furos em coordenadas a partir do centro da peça',
                    'Otimizar a ordem dos furos para reduzir deslocamentos'
                ],
                topics: [
                    'Estratégia de rasgo: desbaste central + passes de parede',
                    'Coordenadas relativas ao centro (G54): simetria e padrão retangular',
                    'Profundidade de corte parcial (Z negativo) vs. Through All',
                    'Acabamento de fundo de rasgo: passes finais em Z'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 40, desc: 'Estratégias de limpeza de material em cavidades estreitas.' },
                    { fase: 'Demonstração no app', min: 40, desc: 'Gerar código; comparar as duas versões (ISO × macro) do rasgo com laço WHILE.' },
                    { fase: 'Prática guiada', min: 100, desc: 'Programação do rasgo e do padrão; cálculo manual das coordenadas dos 4 furos.' },
                    { fase: 'Prática independente', min: 60, desc: 'Variação de exercício: mudar espaçamento no app e refazer as coordenadas.' },
                    { fase: 'Avaliação', min: 40, desc: 'Checklist + verificação das coordenadas calculadas.' }
                ],
                attention: [
                    'Rasgo estreito: profundidade de passe menor que a largura evita vibração (chatter)',
                    'Furos fora de posição: conferir sempre o sinal (+/−) das coordenadas',
                    'Ordem de furação em zigue-zague reduz tempo de máquina',
                    'Fundos de rasgo: programar acabamento para não deixar degrau'
                ],
                checklist: [
                    'Programa desbaste e acabamento do rasgo',
                    'Calcula as 4 coordenadas do padrão a partir do centro',
                    'Ordena os furos otimizando deslocamentos',
                    'Simula e mede as posições no simulador'
                ]
            }]
        },

        // ============================================================
        // MÓDULO 2 — FRESAMENTO: FORMAS E PADRÕES
        // ============================================================
        {
            id: 'm2',
            number: 2,
            title: 'Fresamento — interpolação circular e cavidades',
            level: 'Intermediário',
            goal: 'Programar contornos circulares, interpolação helicoidal e padrões polares; dominar estratégias de desbaste e acabamento de cavidades.',
            note: 'Este módulo introduz trigonometria no CNC — reservar tempo para os cálculos SIN/COS.',
            aulas: [{
                id: 'm2a1',
                num: '2.1',
                title: 'Flange circular — G02/G03 e padrão polar',
                hours: 6,
                partId: 'flange',
                objectives: [
                    'Programar contorno circular completo com G02/G03 e vetores I/J',
                    'Executar interpolação helicoidal para abertura de furo central',
                    'Calcular e programar um padrão polar (furos em círculo primitivo) com SIN/COS'
                ],
                topics: [
                    'Sentido de giro: G02 (horário) × G03 (anti-horário) — visão do spindle',
                    'Vetores I/J relativos ao centro; volta completa com I = raio',
                    'Interpolação helicoidal: G02/G03 com Z decrescente por volta',
                    'Padrão polar: X = R·cos(α), Y = R·sin(α); tabela de coordenadas fixas',
                    'Introdução à macro: laço WHILE com ângulo incremental'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 60, desc: 'Interpolação circular: convenção de sinais, I/J e estratégias de furação helicoidal.' },
                    { fase: 'Cálculos', min: 45, desc: 'Exercício de trigonometria: coordenadas dos 6 furos do CP Ø90 calculadas à mão.' },
                    { fase: 'Demonstração no app', min: 45, desc: 'Código ISO com coordenadas fixadas × macro com COS/SIN — comparar lado a lado.' },
                    { fase: 'Prática guiada', min: 120, desc: 'Programação completa do flange; variação do nº de furos na macro.' },
                    { fase: 'Prática independente', min: 60, desc: 'Exercício: flange com 8 furos e CP Ø110 — refazer cálculos e código.' },
                    { fase: 'Avaliação', min: 30, desc: 'Checklist + verificação das coordenadas polares.' }
                ],
                attention: [
                    'G02 e G03 invertem o sentido — erro clássico que corta a peça no lado errado',
                    'Volta completa: se I/J errados, o controlador gera alarme de arco inválido',
                    'Helicoidal: passo de descida por volta deve ser ≤ 50% do diâmetro da fresa',
                    'Ângulo zero do padrão: definir convenção (ex.: 12 h = −90°) e documentar no programa'
                ],
                checklist: [
                    'Programa contorno circular com G02 correto',
                    'Executa furação helicoidal com descida por volta',
                    'Calcula coordenadas polares com precisão de 3 casas',
                    'Escreve um laço WHILE para o padrão polar'
                ]
            }, {
                id: 'm2a2',
                num: '2.2',
                title: 'Caixa com cavidade — desbaste e acabamento de pocket',
                hours: 6,
                partId: 'caixa-cavidade',
                objectives: [
                    'Planejar a estratégia de desbaste de cavidade (passes em zigue-zague)',
                    'Programar acabamento de parede com sobrematerial controlado',
                    'Controlar profundidade parcial de fundo e sua tolerância'
                ],
                topics: [
                    'Estratégias de pocket: zigue-zague, espiral, ilha',
                    'Sobrematerial de parede (0,2–0,5 mm) e passe de acabamento',
                    'Profundidade de passe (ap) × largura de passe (ae) em cavidade',
                    'Relação profundidade/largura e risco de vibração em fresas alongadas'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 60, desc: 'Estratégias de remoção de material em cavidades e forças de corte.' },
                    { fase: 'Demonstração no app', min: 45, desc: 'Macro do pocket com laços aninhados (profundidade × varredura Y) — animar a lógica no quadro.' },
                    { fase: 'Prática guiada', min: 120, desc: 'Programação do desbaste em zigue-zague e do acabamento de parede.' },
                    { fase: 'Prática independente', min: 75, desc: 'Exercício: cavidade 60×40×25 em peça 100×80 — refazer estratégia.' },
                    { fase: 'Avaliação', min: 60, desc: 'Checklist + medição do fundo e das paredes na peça simulada.' }
                ],
                attention: [
                    'Passe de acabamento sem sobrematerial deixa marca e estoura a tolerância',
                    'Fundo da cavidade: profundidade medida a partir da face usinada, não do zero-peça bruto',
                    'Não descer em espiral com passo vertical maior que o recomendado para a fresa',
                    'Conferir o canto interno: raio ≥ raio da fresa — nunca canto vivo'
                ],
                checklist: [
                    'Planeja e programa desbaste em zigue-zague',
                    'Deixa e remove sobrematerial de parede',
                    'Controla a profundidade do fundo dentro da tolerância',
                    'Simula e identifica colisões potenciais'
                ]
            }]
        },

        // ============================================================
        // MÓDULO 3 — FRESAMENTO: SITUAÇÕES ESPECIAIS
        // ============================================================
        {
            id: 'm3',
            number: 3,
            title: 'Fresamento — rampas e famílias de furos',
            level: 'Intermediário',
            goal: 'Resolver situações que fogem do básico: superfícies inclinadas com movimento simultâneo de eixos e furação com múltiplos padrões e profundidades.',
            note: 'Módulo forte em matemática aplicada — os cálculos são a chave da aula.',
            aulas: [{
                id: 'm3a1',
                num: '3.1',
                title: 'Cunha inclinada — rampas com eixos simultâneos',
                hours: 4,
                partId: 'cunha',
                objectives: [
                    'Programar desbaste de rampa em degraus e acabamento com X/Z simultâneos (G1 com dois eixos)',
                    'Aplicar a função da rampa Z(x) para calcular profundidades locais',
                    'Programar furos com profundidade variável calculada ponto a ponto'
                ],
                topics: [
                    'Interpolação linear em 2 eixos: X e Z avançando juntos',
                    'Função da rampa: Z(x) = Hmáx − (Hmáx − Hmín)·x/L',
                    'Desbaste em degraus × acabamento diagonal',
                    'Profundidade de furo em superfície inclinada = altura local + saída'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 45, desc: 'Geometria da rampa, tangente do ângulo e movimento simultâneo de eixos.' },
                    { fase: 'Cálculos', min: 45, desc: 'Exercício: calcular Z nos 4 furos e o ângulo da rampa.' },
                    { fase: 'Demonstração no app', min: 40, desc: 'Macro da rampa com laço de níveis e profundidades calculadas pela fórmula.' },
                    { fase: 'Prática guiada', min: 100, desc: 'Programação completa; verificação do percurso no simulador.' },
                    { fase: 'Avaliação', min: 30, desc: 'Checklist + conferência dos valores calculados.' }
                ],
                attention: [
                    'Z positivo na rampa = acima do zero — nunca confundir com profundidade',
                    'O passe diagonal deve ter avanço reduzido (força lateral maior)',
                    'Furo em rampa: profundidade errada fura fundo ou não passa — sempre calcular',
                    'Simular o perfil da rampa antes do primeiro corte real'
                ],
                checklist: [
                    'Programa desbaste em degraus da rampa',
                    'Programa acabamento diagonal com X/Z simultâneos',
                    'Calcula profundidades de furo pela função da rampa',
                    'Verifica o perfil no simulador'
                ]
            }, {
                id: 'm3a2',
                num: '3.2',
                title: 'Gabarito de furação — ciclos G81, G82 e G83',
                hours: 4,
                partId: 'gabarito-furacao',
                objectives: [
                    'Diferenciar e aplicar os ciclos G81 (simples), G82 (com demora) e G83 (desbaste de lascas)',
                    'Programar furos contraborejados e furos cegos com profundidade controlada',
                    'Otimizar a sequência de ferramentas e a pilotagem com centro de furar'
                ],
                topics: [
                    'G81: furação simples (passantes curtos)',
                    'G82: furação com G04 no fundo (contrabore e furos cegos de fundo liso)',
                    'G83: desbaste de lascas (Q) em furos profundos',
                    'Pilotagem: centro de furar 90° antes das brocas',
                    'Contrabore: brocar primeiro, depois rebaixar com fresa/contrabroca'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 60, desc: 'Ciclos de furação: parâmetros R, Q, P e Z; quando usar cada um.' },
                    { fase: 'Demonstração no app', min: 40, desc: 'Código do gabarito com os 3 ciclos e as 3 famílias de furos; comparar tempos.' },
                    { fase: 'Prática guiada', min: 100, desc: 'Programação completa; ordem de ferramentas e pilotagem.' },
                    { fase: 'Prática independente', min: 40, desc: 'Exercício: nova família de 4 furos M8 preparados Ø6,8.' },
                    { fase: 'Avaliação', min: 40, desc: 'Checklist + escolha justificada do ciclo para cada situação.' }
                ],
                attention: [
                    'G83 sem Q vira G81 — a broca trava e quebra em furo profundo',
                    'Contrabore sem demora (P) deixa fundo irregular',
                    'Furo cego: profundidade SEMPRE maior que a nominal (+0,3 a +0,5 mm)',
                    'Sequência: pilotar TODOS os furos antes de trocar de ferramenta (reduz tempo)'
                ],
                checklist: [
                    'Escolhe o ciclo correto para cada família de furos',
                    'Programa contrabore com demora adequada',
                    'Programa furos cegos com profundidade e folga corretas',
                    'Otimiza a sequência de ferramentas'
                ]
            }]
        },

        // ============================================================
        // MÓDULO 4 — TORNEAMENTO
        // ============================================================
        {
            id: 'm4',
            number: 4,
            title: 'Torneamento — perfis e ciclos de desbaste',
            level: 'Intermediário',
            goal: 'Programar torneamento de perfis com ciclos de desbaste/acabamento, ranhuras e furação no torno, com atenção à velocidade constante e à segurança do porta-ferramentas.',
            note: 'Primeiro contato com torno CNC: reforçar convenção de diâmetro no X e o perigo de colisão do cabeçote.',
            aulas: [{
                id: 'm4a1',
                num: '4.1',
                title: 'Eixo escalonado — G71/G70 e ranhura',
                hours: 6,
                partId: 'eixo-escalonado',
                objectives: [
                    'Programar perfil de revolução com o ciclo de desbaste G71 e acabamento G70',
                    'Definir o perfil em blocos N100–N200 com ordem e sobrematerial corretos',
                    'Programar ranhura de retentor com ferramenta de corte radial'
                ],
                topics: [
                    'G96 (vc constante) × G97 (rpm fixa) — quando usar cada um',
                    'G71: U (profundidade de passe), R (retorno), P/Q (blocos do perfil), U/W (sobrematerial)',
                    'G70: passe de acabamento no mesmo perfil',
                    'Ranhura: corte radial, avanço lento e demora no fundo',
                    'Convenção X em diâmetro no torno CNC'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 60, desc: 'Torneamento: cinemática, G96/G97, estrutura do G71 e pontos do perfil.' },
                    { fase: 'Demonstração no app', min: 45, desc: 'Perfil do eixo no app; blocos N100–N200 comentados; macro com posições calculadas.' },
                    { fase: 'Prática guiada', min: 135, desc: 'Programação completa do eixo com ranhura; simulação do perfil.' },
                    { fase: 'Prática independente', min: 75, desc: 'Exercício: eixo Ø40/Ø30/Ø20 com rasgo em outra posição.' },
                    { fase: 'Avaliação', min: 45, desc: 'Checklist + verificação do perfil e do sobrematerial.' }
                ],
                attention: [
                    'Perfil do G71 deve ser monotônico em Z (nunca voltar em Z dentro do perfil)',
                    'Sobrematerial U/W em excesso sobrecarrega a ferramenta de acabamento',
                    'Ranhura: avanço reduzido (F0,05–0,1) e G04 no fundo evitam lascamento',
                    'Perigo de colisão: conferir a ordem dos pontos do perfil antes de rodar'
                ],
                checklist: [
                    'Programa G71 com perfil em blocos correto',
                    'Executa acabamento com G70',
                    'Programa ranhura com avanço e demora adequados',
                    'Simula o perfil sem colisão'
                ]
            }, {
                id: 'm4a2',
                num: '4.2',
                title: 'Polia em V — rasgo angular e furação no torno',
                hours: 6,
                partId: 'polia-v',
                objectives: [
                    'Programar rasgo em V usando a geometria do ângulo (profundidade e abertura)',
                    'Executar furação no torno com o ciclo G74 (retorno de lascas)',
                    'Mandrilamento de furo central com tolerância'
                ],
                topics: [
                    'Geometria do V: prof. = (D − Dfundo)/2; meia-abertura = prof·tan(α/2)',
                    'Perfil do V no G71: pontos calculados do fundo e da abertura',
                    'G74: furação com retorno de lascas no torno (eixo X central)',
                    'Mandrilamento: passes radiais para Ø final (H7)',
                    'Ordem de operações: furo → perfil → rasgo ou perfil → furo (discutir)'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 60, desc: 'Geometria de rasgos angulares e cálculo com tangente; furação no torno.' },
                    { fase: 'Cálculos', min: 45, desc: 'Exercício: calcular profundidade e pontos do V para Ø80 → Ø60 com 40°.' },
                    { fase: 'Demonstração no app', min: 45, desc: 'Macro da polia: pontos do V calculados por TAN; G74 paramétrico.' },
                    { fase: 'Prática guiada', min: 135, desc: 'Programação completa; mandrilamento do furo Ø25 H7.' },
                    { fase: 'Avaliação', min: 75, desc: 'Checklist + medição do ângulo e do Ø de fundo do V.' }
                ],
                attention: [
                    'Ângulo do V é TOTAL (2× meia-ângulo) — erro comum dobrar a tangente',
                    'G74: retorno de lascas obrigatório em furo profundo; nunca forçar em G01 contínuo',
                    'Mandrilamento: primeiro passe tira pouco (0,2–0,3 mm) para não vibrar',
                    'Furo antes de perfilar o V reduz risco de lascamento do rasgo'
                ],
                checklist: [
                    'Calcula os pontos do V pelo ângulo',
                    'Programa o rasgo V no perfil G71',
                    'Executa furação com G74',
                    'Mandrilamento dentro da tolerância'
                ]
            }]
        },

        // ============================================================
        // MÓDULO 5 — ROSCAS E MONTAGEM
        // ============================================================
        {
            id: 'm5',
            number: 5,
            title: 'Roscas, par de peças e avaliação final',
            level: 'Avançado',
            goal: 'Programar roscas internas e externas com ciclo G76, compreender a teoria de filetes e executar a montagem e verificação de um par de peças com ajuste definido.',
            note: 'Módulo avaliativo do curso — a montagem do par usa peças reais usinadas pelos participantes.',
            aulas: [{
                id: 'm5a1',
                num: '5.1',
                title: 'Bucha com rosca interna — mandrilamento e G76',
                hours: 6,
                partId: 'bucha-rosca',
                objectives: [
                    'Preparar o furo de rosca no diâmetro menor correto (Ønom − 1,0825 × passo)',
                    'Programar rosca interna com o ciclo de rosqueamento G76',
                    'Verificar a rosca com anel calibrador e compreender a tolerância 6H'
                ],
                topics: [
                    'Teoria de roscas: passo, altura de filete (0,6134 × P), Ø maior/menor',
                    'G76: P (passes/ângulo), Q (corte mínimo), X (Ø final), P (altura em microns), F (passo)',
                    'Rosca interna: corte em X crescente; velocidade baixa; lubrificação',
                    'Verificação: anel calibrador M20×1,5 — classe 6H'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 60, desc: 'Teoria de roscas métricas ISO: geometria, fórmulas e classes de tolerância.' },
                    { fase: 'Cálculos', min: 45, desc: 'Exercício: calcular Ø menor, altura de filete em microns e parâmetros do G76.' },
                    { fase: 'Demonstração no app', min: 45, desc: 'Macro da bucha: fórmulas da rosca embutidas no G76; comparar com ISO fixo.' },
                    { fase: 'Prática guiada', min: 135, desc: 'Programação completa: furo, mandrilamento, rosqueamento; verificação com anel.' },
                    { fase: 'Avaliação', min: 75, desc: 'Checklist + verificação dimensional e de rosca na peça.' }
                ],
                attention: [
                    'Rosca interna: X do G76 é o DIÂMETRO MAIOR (corte sai para fora) — nunca inverter',
                    'Mandrilamento antes do rosqueamento é OBRIGATÓRIO — rosca em furo errado corrói o filete',
                    'Altura do filete em MICRONS no P do G76 (0,6134 × P × 1000)',
                    'Primeiro rosqueamento: Single Block + rotação reduzida + verificação com anel'
                ],
                checklist: [
                    'Calcula os parâmetros da rosca pelas fórmulas ISO',
                    'Prepara o furo no Ø menor correto',
                    'Programa G76 interno com valores calculados',
                    'Verifica a rosca com anel calibrador'
                ]
            }, {
                id: 'm5a2',
                num: '5.2',
                title: 'Eixo rosqueado — rosca externa e rasgo de escape',
                hours: 6,
                partId: 'eixo-rosqueado',
                objectives: [
                    'Preparar o diâmetro da rosca externa no Ø menor (referência do filete)',
                    'Programar rosca externa com G76 e rasgo de escape no fim da rosca',
                    'Verificar a rosca com anel e compreender a tolerância 6g'
                ],
                topics: [
                    'Rosca externa: Ø menor = Ønom − 1,0825 × P (base do filete)',
                    'G76 externo: X final é o Ø MENOR (corte entra para dentro)',
                    'Rasgo de escape: largura ≥ passo; garante saída da ferramenta',
                    'Chamfer de guia na ponta: facilita o engate na montagem',
                    'Verificação: anel M20×1,5 — classe 6g'
                ],
                roteiro: [
                    { fase: 'Teoria', min: 45, desc: 'Rosca externa × interna: diferenças de programação e de verificação.' },
                    { fase: 'Cálculos', min: 30, desc: 'Exercício: parâmetros do G76 externo e posição do rasgo de escape.' },
                    { fase: 'Demonstração no app', min: 45, desc: 'Código do eixo: G71 → G70 → rasgo → G76; macro com valores calculados.' },
                    { fase: 'Prática guiada', min: 135, desc: 'Programação completa; usinagem e verificação com anel.' },
                    { fase: 'Avaliação', min: 105, desc: 'Checklist + medição de Ø menor e verificação da rosca.' }
                ],
                attention: [
                    'Rosca externa: X do G76 é o Ø MENOR — inverter arredonda o filete',
                    'Sem rasgo de escape, a rosca não fecha e a ferramenta quebra no fundo',
                    'Muitos passes finais (P02) melhoram o acabamento do filete',
                    'Ø menor errado: rosca folgada (menor grande) ou apertada (menor pequeno)'
                ],
                checklist: [
                    'Prepara o Ø menor da rosca',
                    'Programa G76 externo com parâmetros calculados',
                    'Usina o rasgo de escape na posição correta',
                    'Verifica a rosca com anel calibrador'
                ]
            }, {
                id: 'm5a3',
                num: '5.3',
                title: 'Montagem do par 6H/6g e avaliação final',
                hours: 4,
                partId: 'bucha-rosca',
                objectives: [
                    'Montar o par bucha/eixo e validar o ajuste rosca 6H/6g',
                    'Aplicar os conhecimentos do curso em uma atividade integradora',
                    'Demonstrar autonomia: leitura, programação, simulação e verificação'
                ],
                topics: [
                    'Classes de tolerância de rosca: 6H (fêmea) × 6g (macho)',
                    'Montagem manual: torque de aperto, alinhamento, ausência de folga perceptível',
                    'Análise de não conformidades: rosca apertada/folgada, Ø fora, posição',
                    'Atividade integradora: peça surpresa — do desenho ao código sozinho'
                ],
                roteiro: [
                    { fase: 'Montagem', min: 60, desc: 'Montagem do par bucha + eixo; inspeção de ajuste; registro na ficha.' },
                    { fase: 'Discussão', min: 30, desc: 'Análise de não conformidades encontradas nas peças da turma.' },
                    { fase: 'Atividade integradora', min: 120, desc: 'Peça surpresa: cada participante lê o desenho, programa no app, simula e apresenta o código.' },
                    { fase: 'Avaliação final', min: 90, desc: 'Avaliação prática + feedback individual + emissão de certificados.' }
                ],
                attention: [
                    'Ajuste rosqueado não depende só do Ø — acabamento do filete importa',
                    'Peça fora de tolerância: analisar causa (ferramenta, parâmetro, zero-peça) antes de refazer',
                    'Atividade integradora é individual — não compartilhar código durante a avaliação',
                    'Registro das medições: histórico da turma para melhoria contínua'
                ],
                checklist: [
                    'Monta o par com ajuste adequado (6H/6g)',
                    'Executa a atividade integradora com autonomia',
                    'Apresenta e justifica o código gerado',
                    'Conclui as 13 aulas da trilha'
                ]
            }]
        }
    ]
};
