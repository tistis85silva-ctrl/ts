'use strict';

/* ============================================================
   COTA — fichas.js (v5.3)
   Kit de fichas de avaliação do curso CNC do Desenho à Peça Pronta
   · fichas de identificação, presença, avaliação por módulo,
     prova final, eficácia do treinamento e gabarito do instrutor
   ============================================================ */

// ============================================================
// QUESTÕES DE AVALIAÇÃO (por módulo + prova final)
// type: 'multi' (objetiva) | 'disc' (discursiva)
// Cada questão vale 2,0 pontos — avaliação teórica = 10,0
// ============================================================
const QUIZ = {
    m0: [{
        type: 'multi', pts: 2,
        q: 'Qual é a finalidade do G54 no comando CNC?',
        opts: ['Definir a velocidade do spindle', 'Definir o zero-peça (origem do programa)', 'Chamar a ferramenta T01', 'Ativar o refrigeração'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'Antes do primeiro ciclo de um programa novo, o operador deve:',
        opts: ['Rodar com Feed 100% logo de início', 'Abrir a porta para observar de perto', 'Simular em Single Block com Feed Override reduzido', 'Apertar Cycle Start duas vezes'],
        a: 'C'
    }, {
        type: 'multi', pts: 2,
        q: 'Uma cota sem tolerância indicada no desenho técnico segue:',
        opts: ['Qualquer medida serve', 'A norma ISO 2768 (tolerâncias gerais)', 'A escolha do operador', 'Tolerância zero'],
        a: 'B'
    }, {
        type: 'disc', pts: 2,
        q: 'Cite 3 itens de EPI obrigatórios na usinagem CNC e indique onde fica a parada de emergência da sua máquina.',
        a: 'EPIs: óculos de segurança, protetor auricular, sapato de biqueira, avental, protetor facial (quando aplicável). A parada de emergência fica no painel frontal da máquina (botão grande vermelho/emergência) — sempre acessível ao operador.'
    }, {
        type: 'disc', pts: 2,
        q: 'Explique o que acontece se o zero-peça for registrado com erro de 5 mm.',
        a: 'Todas as cotas do programa serão deslocadas em 5 mm: a peça sai fora de medida (refugo), podendo haver colisão da ferramenta com a peça, garra ou mesa — risco de acidente e quebra de ferramenta.'
    }],

    m1: [{
        type: 'multi', pts: 2,
        q: 'O ciclo G83 é utilizado para:',
        opts: ['Roscar furos', 'Furação com desbaste de lascas (furos profundos)', 'Contraborear furos', 'Chanfrar bordas'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'A aproximação (lead-in) no contorno externo serve para:',
        opts: ['Economizar tempo de máquina', 'Evitar marca da ferramenta e choque de corte', 'Refrescar a peça', 'Facilitar a medição'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'O valor Q no ciclo G83 representa:',
        opts: ['A velocidade de corte', 'A profundidade de cada lascamento', 'A quantidade de furos', 'O raio da ferramenta'],
        a: 'B'
    }, {
        type: 'disc', pts: 2,
        q: 'Por que o Z de saída do furo deve avançar além da face de saída?',
        a: 'Para garantir a passagem completa da broca e evitar rebarba no fundo/saída do furo; a folga típica é de 2 mm além da face de saída.'
    }, {
        type: 'disc', pts: 2,
        q: 'Cite os 4 parâmetros de corte e explique o que cada um controla.',
        a: 'vc (velocidade de corte — desgaste/vide útil), fz (avanço por dente — acabamento e carga), ap (profundidade de passe axial), ae (largura de passe radial).'
    }],

    m2: [{
        type: 'multi', pts: 2,
        q: 'O comando G02 indica movimento de interpolação:',
        opts: ['Anti-horária', 'Horária', 'Rápida', 'Linear'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'Em um padrão polar de 6 furos igualmente espaçados, o ângulo entre os furos é:',
        opts: ['30°', '45°', '60°', '90°'],
        a: 'C'
    }, {
        type: 'multi', pts: 2,
        q: 'Na interpolação helicoidal para abrir um furo central:',
        opts: ['O Z permanece fixo', 'O Z desce progressivamente a cada volta', 'O X fica parado', 'Não é possível programar'],
        a: 'B'
    }, {
        type: 'disc', pts: 2,
        q: 'Calcule as coordenadas X e Y do primeiro furo (0°) de um padrão de 6 furos em círculo primitivo Ø90 mm.',
        a: 'R = 45 mm. Em 0°: X = 45 × cos(0°) = 45,000 mm e Y = 45 × sen(0°) = 0,000 mm. (Aceita-se convenção com ângulo inicial diferente, desde que justificada.)'
    }, {
        type: 'disc', pts: 2,
        q: 'Explique a diferença entre G02 e G03 e onde o operador observa o sentido de giro.',
        a: 'G02 = horário (CW), G03 = anti-horário (CCW), sempre vistos do lado do spindle (para cima, na fresadora). O erro de sentido corta o material no lado errado do contorno.'
    }],

    m3: [{
        type: 'multi', pts: 2,
        q: 'No ciclo G82, a letra P indica:',
        opts: ['O passo da rosca', 'A demora (dwell) da ferramenta no fundo do furo', 'A profundidade total', 'A pressão do refrigeração'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'Um furo cego deve ser programado com profundidade:',
        opts: ['Exatamente igual à nominal', 'Menor que a nominal', 'Maior que a nominal (folga de saída da ferramenta)', 'Qualquer valor serve'],
        a: 'C'
    }, {
        type: 'multi', pts: 2,
        q: 'Em uma rampa com altura máxima 40 mm, mínima 10 mm e 120 mm de comprimento, a altura em x = 60 mm é:',
        opts: ['40 mm', '30 mm', '25 mm', '10 mm'],
        a: 'C'
    }, {
        type: 'disc', pts: 2,
        q: 'Por que a pilotagem (centro de furar) é executada antes das brocas?',
        a: 'O centro de furar cria um assento cônico que guia a ponta da broca, evitando que ela fuja na entrada (especialmente em superfícies irregulares), melhorando a posição e a vida da broca.'
    }, {
        type: 'disc', pts: 2,
        q: 'Dê a fórmula da altura local de uma rampa e calcule a altura em x = 30 mm (Hmáx 40, Hmín 10, L 120).',
        a: 'Z(x) = Hmáx − (Hmáx − Hmín) × x / L. Z(30) = 40 − 30 × 30/120 = 40 − 7,5 = 32,5 mm.'
    }],

    m4: [{
        type: 'multi', pts: 2,
        q: 'O ciclo G71 no torno CNC é utilizado para:',
        opts: ['Acabamento de perfil', 'Rosqueamento', 'Desbaste de perfil de revolução', 'Furação'],
        a: 'C'
    }, {
        type: 'multi', pts: 2,
        q: 'No torno CNC, o eixo X é programado em:',
        opts: ['Raio', 'Diâmetro', 'Comprimento', 'Ângulo'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'O ciclo G74 no torno é usado em:',
        opts: ['Rosqueamento', 'Abertura de ranhura', 'Furação com retorno de lascas', 'Chanfro'],
        a: 'C'
    }, {
        type: 'disc', pts: 2,
        q: 'Explique o que é o sobrematerial (U/W) do G71 e por que ele existe.',
        a: 'U (radial) e W (axial) são o material deixado pelo desbaste para o passe de acabamento (G70). Garantem acabamento dimensional e superficial sem sobrecarregar a ferramenta de desbaste.'
    }, {
        type: 'disc', pts: 2,
        q: 'Por que o perfil do G71 deve ser monotônico em Z?',
        a: 'Porque o ciclo calcula os passes de desbaste a partir do perfil de referência; um perfil que retrocede em Z gera cortes indesejados, sobrecarga da ferramenta e possível colisão.'
    }],

    m5: [{
        type: 'multi', pts: 2,
        q: 'O diâmetro menor (base do filete) de uma rosca M20×1,5 é aproximadamente:',
        opts: ['21,5 mm', '18,4 mm', '20,0 mm', '16,0 mm'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'No G76 de rosca EXTERNA, o valor X representa:',
        opts: ['O diâmetro maior da rosca', 'O diâmetro menor (fundo do filete)', 'O passo', 'O comprimento roscado'],
        a: 'B'
    }, {
        type: 'multi', pts: 2,
        q: 'O rasgo de escape na rosca externa serve para:',
        opts: ['Diminuir o peso da peça', 'Garantir a saída da ferramenta e o filete completo', 'Finalidade estética', 'Passagem de refrigeração'],
        a: 'B'
    }, {
        type: 'disc', pts: 2,
        q: 'Calcule a altura de filete em microns de uma rosca M20×1,5 (valor P do G76).',
        a: 'h = 0,6134 × passo = 0,6134 × 1,5 = 0,9201 mm → P = 920 microns.'
    }, {
        type: 'disc', pts: 2,
        q: 'Explique o que significa o ajuste 6H/6g no par bucha/eixo.',
        a: '6H é a classe de tolerância da rosca fêmea (interna) e 6g a da rosca macho (externa). O par garante o encaixe: 6H é ligeiramente folgado em relação a 6g, permitindo montagem manual suave com boa fixação.'
    }],

    final: [{
        type: 'multi', pts: 1,
        q: 'A ordem correta de uma sequência de usinagem típica é:',
        opts: ['Acabamento → desbaste → furação', 'Faceamento → desbaste → acabamento → furação/acabamentos', 'Furação → faceamento → acabamento', 'Qualquer ordem dá o mesmo resultado'],
        a: 'B'
    }, {
        type: 'multi', pts: 1,
        q: 'O bloco de segurança G21 G90 G17 G40 G49 G80 significa (em ordem):',
        opts: ['mm, absoluto, plano XY, sem compensação de raio, sem comprimento de ferramenta, cancela ciclos fixos', 'polegadas, incremental, plano XZ, com compensação, com ferramenta, ativa ciclo', 'mm, incremental, plano XY, sem raio, com ferramenta, cancela rosca', 'velocidade, avanço, rotação, ferramenta, programa, fim'],
        a: 'A'
    }, {
        type: 'multi', pts: 1,
        q: 'Para um furo passante profundo em aço, o ciclo indicado é:',
        opts: ['G81', 'G82', 'G83', 'G76'],
        a: 'C'
    }, {
        type: 'multi', pts: 1,
        q: 'O diâmetro menor da rosca M20×1,5 é:',
        opts: ['≈ 18,4 mm', '≈ 20,0 mm', '≈ 21,5 mm', '≈ 16,5 mm'],
        a: 'A'
    }, {
        type: 'multi', pts: 1,
        q: 'Em um padrão de 4 furos em CP Ø80, o raio usado nos cálculos polares é:',
        opts: ['80 mm', '40 mm', '20 mm', '160 mm'],
        a: 'B'
    }, {
        type: 'multi', pts: 1,
        q: 'No ciclo G71, os blocos P e Q indicam:',
        opts: ['A velocidade e o avanço', 'O intervalo de blocos que define o perfil da peça', 'A profundidade de passe e o retorno', 'A ferramenta e o deslocamento'],
        a: 'B'
    }, {
        type: 'multi', pts: 1,
        q: 'Para um contrafuro de fundo liso, o ciclo mais adequado é:',
        opts: ['G81', 'G82 (com demora)', 'G83', 'G70'],
        a: 'B'
    }, {
        type: 'multi', pts: 1,
        q: 'No G76 de rosca INTERNA, o valor X indica:',
        opts: ['O diâmetro maior (topo do filete)', 'O diâmetro menor', 'O passo', 'O comprimento'],
        a: 'A'
    }, {
        type: 'multi', pts: 1,
        q: 'O sobrematerial U/W do G71 é removido em qual ciclo?',
        opts: ['G70 (acabamento)', 'G74 (furação)', 'G76 (rosca)', 'G83 (lascas)'],
        a: 'A'
    }, {
        type: 'disc', pts: 1,
        q: 'Descreva o fluxo completo do desenho técnico até a peça pronta, citando ao menos 5 etapas.',
        a: 'Exemplo de resposta: (1) leitura e interpretação do desenho; (2) planejamento do processo (operações, ferramentas, parâmetros); (3) programação (código ISO ou macro) e simulação; (4) setup da máquina (fixação, ferramentas, zero-peça G54); (5) primeiro ciclo em modo seguro (Single Block, Feed baixo); (6) usinagem completa com verificação em processo; (7) inspeção final e ajuste de deslocamentos (wear).'
    }]
};

// ============================================================
// FICHAS DO KIT
// ============================================================
const FICHAS = [{
    id: 'identificacao',
    num: '01',
    doc: 'FIC-00',
    icon: '🪪',
    title: 'Identificação e plano do participante',
    desc: 'Dados do colaborador e controle dos módulos, notas e aprovação da trilha completa.'
}, {
    id: 'presenca',
    num: '02',
    doc: 'FIC-01',
    icon: '📋',
    title: 'Lista de presença',
    desc: 'Controle de frequência das 13 aulas com carga horária e assinatura do participante.'
}, {
    id: 'm0',
    num: '03',
    doc: 'FIC-M0',
    icon: '📝',
    title: 'Avaliação — M0 Fundamentos',
    desc: 'Avaliação teórica e prática do módulo de fundamentos, segurança e leitura técnica.'
}, {
    id: 'm1',
    num: '04',
    doc: 'FIC-M1',
    icon: '📝',
    title: 'Avaliação — M1 Fresamento básico',
    desc: 'Avaliação do módulo de faceamento, contorno e furação com ciclos.'
}, {
    id: 'm2',
    num: '05',
    doc: 'FIC-M2',
    icon: '📝',
    title: 'Avaliação — M2 Interpolação circular',
    desc: 'Avaliação do módulo de interpolação circular, padrões polares e cavidades.'
}, {
    id: 'm3',
    num: '06',
    doc: 'FIC-M3',
    icon: '📝',
    title: 'Avaliação — M3 Situações especiais',
    desc: 'Avaliação do módulo de rampas e famílias de furos (G81/G82/G83).'
}, {
    id: 'm4',
    num: '07',
    doc: 'FIC-M4',
    icon: '📝',
    title: 'Avaliação — M4 Torneamento',
    desc: 'Avaliação do módulo de torneamento: G71/G70, ranhura e furação no torno.'
}, {
    id: 'm5',
    num: '08',
    doc: 'FIC-M5',
    icon: '📝',
    title: 'Avaliação — M5 Roscas e montagem',
    desc: 'Avaliação do módulo de roscas (G76), par de peças 6H/6g e montagem.'
}, {
    id: 'prova-final',
    num: '09',
    doc: 'FIC-90',
    icon: '🏁',
    title: 'Prova final integradora',
    desc: '10 questões cobrindo a trilha completa + atividade prática integradora.'
}, {
    id: 'eficacia',
    num: '10',
    doc: 'FIC-91',
    icon: '📊',
    title: 'Avaliação de eficácia do treinamento',
    desc: 'Aplicação pós-turma (até 90 dias) — avaliação do gestor sobre transferência para o trabalho.'
}, {
    id: 'gabarito',
    num: '11',
    doc: 'FIC-99',
    icon: '🔑',
    title: 'Gabarito do instrutor',
    desc: 'Respostas de todas as questões das avaliações de módulo e da prova final.'
}];
