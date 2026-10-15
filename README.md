# COTA — do desenho à peça pronta

Assistente de CAD + CNC em português para ensino de manufatura: você escolhe uma
**situação de usinagem**, confirma as features detectadas, ajusta as dimensões e
recebe, de uma vez:

- **Folha técnica** com vistas ortográficas cotadas, corte, detalhes e massa calculada
- **Roteiro de modelagem CAD** passo a passo (SolidWorks, Fusion 360 ou Inventor)
- **Programação CNC**: código ISO 6983 (G-code) pronto para o painel **e**
  programa paramétrico (macro com variáveis e laços)

Tudo é **paramétrico**: mude qualquer dimensão e a folha, o roteiro e os dois
programas de CNC são recalculados na hora.

## 📦 Instalação (Windows)

O **COTA-Instalador-v6.7.0.zip** (em [`instalador/`](instalador/) e nos [Releases](https://github.com/tistis85silva-ctrl/ts/releases))
instala o app nos PCs da empresa em 2 minutos, **sem administrador**:

1. Extraia o ZIP e clique duas vezes em **`instalar-cota.bat`**
2. Pronto — atalho "COTA - Formacao CNC" na Área de Trabalho (com ícone),
   entrada no Menu Iniciar e desinstalador
3. O COTA abre em **modo aplicativo** (janela sem barra de endereço) no
   Edge/Chrome e funciona offline

Também há empacotamento Electron (`package.json` + `desktop/main.js`): em uma
máquina Windows com internet, `npm install && npm run dist:win` gera o
`COTA-Instalador.exe` (NSIS) e a versão portátil em `release/`.

## Como usar

Basta abrir o `index.html` em qualquer navegador (duplo clique funciona — sem
servidor, sem instalação). Para servir localmente:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Situações de usinagem (10 exemplos)

**Fresamento (6):**

| Exemplo | Processo | O que treina no CNC |
|---|---|---|
| 🔧 Suporte em L | Fresamento 2,5D | faceamento, contorno, G83, chanfro |
| 📏 Placa com rasgo | Fresamento 2,5D | Extruded Cut, padrão de furos, rasgo |
| ⚙️ Flange circular | Fresamento circular | contorno G02/G03, interpolação helicoidal, padrão polar com COS/SIN |
| 📦 Caixa com cavidade | Fresamento de cavidade | desbaste de pocket em zig-zag, acabamento de parede |
| 📐 Cunha inclinada | Fresamento de rampa | movimento simultâneo X/Z, profundidade variável calculada |
| 🎯 Gabarito de furação | Fresamento — furação | G81/G82/G83, contrabore, furos cegos com demora |

**Torneamento (4):**

| Exemplo | Processo | O que treina no CNC |
|---|---|---|
| 🔄 Eixo escalonado | Torneamento CNC | perfil de revolução, G71/G70, ranhura |
| 🎡 Polia em V | Torneamento — rasgo em V | rasgo angular, geometria por ângulo (TAN), G74 de furação |
| 🔩 Bucha com rosca | Torneamento — rosca interna | mandrilamento, rosca interna **G76** (par M20×1,5) |
| 🛠️ Eixo rosqueado | Torneamento — rosca externa | rosca externa **G76**, rasgo de escape (par com a bucha) |

A galeria tem **filtro por processo** (Todas / Fresamento / Torneamento) para
organizar as turmas. A bucha e o eixo rosqueado formam um **par de ajuste
6H/6g** — dá para usar em aula de montagem e tolerâncias.

## 📚 Roteiro de aulas (trilha de formação)

O app inclui um **curso estruturado de 64h** (6 módulos · 13 aulas), pronto para
formar operadores e programadores de CNC:

| Módulo | Conteúdo | Carga |
|---|---|---|
| M0 — Fundamentos | segurança (NR-12), fixação, zero-peça, leitura de desenho, estrutura ISO | 8h |
| M1 — Fresamento básico | faceamento, contorno, G83, rasgo, padrão de furos | 8h |
| M2 — Interpolação circular | G02/G03, helicoidal, padrão polar SIN/COS, pockets | 12h |
| M3 — Situações especiais | rampas X/Z simultâneos, ciclos G81/G82/G83 | 8h |
| M4 — Torneamento | G71/G70, ranhura, rasgo em V, G74 | 12h |
| M5 — Roscas e montagem | G76 interno/externo, par 6H/6g, avaliação final | 16h |

Cada aula traz **objetivos de aprendizagem**, **conteúdos técnicos**, **roteiro
por fases cronometradas** (teoria → demonstração → prática guiada → prática
independente → avaliação), **pontos de atenção** (segurança e erros clássicos),
**critérios de avaliação** e botão para abrir o **exemplo prático** no app.
O progresso do aluno fica salvo no navegador e o roteiro pode ser **impresso**
para a sala de aula (formato handout profissional).

## 📝 Kit de fichas de avaliação

11 documentos A4 prontos para imprimir e preencher à mão:

| Ficha | Documento | Uso |
|---|---|---|
| 01 | FIC-00 Identificação e plano | dados do participante + controle de módulos/notas |
| 02 | FIC-01 Lista de presença | frequência das 13 aulas com assinatura |
| 03–08 | FIC-M0 a FIC-M5 | avaliação por módulo: teórica (5 questões, 10 pts) + prática (checklist) + conceito |
| 09 | FIC-90 Prova final | 10 questões + atividade integradora prática |
| 10 | FIC-91 Eficácia do treinamento | aplicação em até 90 dias (NR-12 / gestão) |
| 11 | FIC-99 Gabarito do instrutor | respostas-modelo de todas as questões (uso interno) |

O app reúne **40 questões elaboradas** (objetivas e discursivas) com gabarito,
critérios práticos extraídos automaticamente da trilha e linhas de assinatura
(participante, instrutor, gestor, RH/SST). Cada ficha tem código documental e
revisão para controle de documentos (ISO 9001).

## 🏆 Certificado de conclusão

Certificado A4 paisagem com design profissional: moldura dupla dourada,
ornamentos de canto, marca d'água, selo circular em SVG ("APROVADO") e
numeração de registro automática (ex.: COTA-2026-1234) para controle de
validade. Personalização ao vivo pelo formulário (nome, nota final, período,
instrutor, responsável, local) com pré-visualização instantânea — pronto para
imprimir em papel offset 180 g.

## Estrutura

```
index.html        Página principal (HTML semântico)
css/styles.css    Estilos (tema claro/escuro, responsivo, impressão)
js/parts.js       Catálogo de peças: vistas SVG, roteiro, G-code e macros
js/curso.js       Trilha de formação: módulos, aulas e avaliação
js/fichas.js      Kit de fichas: questões, gabarito e modelos
certificado       (renderizado pelo app.js com dados do formulário)
js/app.js         UI: galeria, features, folha, CNC, trilha, sessão
```

## Funcionalidades

- **Galeria de exemplos** com 5 situações de usinagem (fresamento e torneamento)
- **Features paramétricas** por peça — desmarcar/excluir recalcula tudo
- **Folha técnica** em SVG com cotas dinâmicas e viewBox ajustável a qualquer dimensão
- **Massa estimada** calculada do volume (aço SAE 1020, 7,85 g/cm³)
- **Código ISO** comentado, com tabela de ferramentas e ciclos (G81/G83/G71/G70)
- **Programa paramétrico** com variáveis `#`, expressões e laços `WHILE/DO`
- **Copiar / Baixar .tap** do programa ativo; **Imprimir/PDF** com folha + roteiro + os 2 códigos
- **Exportar TXT** com especificações, etapas e os dois programas
- **Sessão persistida**: peça, features, software, progresso, aba de código e tema
- **Acessibilidade**: teclado, `aria-*`, `prefers-reduced-motion`, órbita 3D em touch

## Histórico

### v6.7.0
- **🕳️ Furos e Cavidades Coloridos com Camadas de Remoção Visíveis (3D, Planta e Corte)**:
  - Substitui o preenchimento preto opaco dentro dos furos por **paredes cilíndricas iluminadas na cor exata da ferramenta (`T02`, `T03`, `T04`, `T05`)** + **anéis de profundidade de cada camada removida (`ap` / mergulho `G83 Q`)** nas 3 vistas!
- **💰 Estudo Profissional de Custos & Orçamentação CNC — Nível Mestre (Folha 5 do Book Técnico)**:
  - **Cálculo Industrial Completo**: Matéria-Prima Bruta, Abatimento de Cavaco Reciclado (90%), Hora-Máquina + Operador, **Desgaste de Aresta/Ferramenta pelo Modelo de Taylor** (`T01..T05`), Diluição de Setup + Engenharia CAM pelo Tamanho do Lote (`1` a `1000 un`), Custo Fabril Unitário e Preço de Venda Sugerido
  - **2 Tabelas Mestres + 2 Gráficos SVG Econômicos**: Composição do Custo Unitário e Curva de Economia de Escala por Tamanho de Lote


### v6.6.0
- **🎨 Cores por Ferramenta + Seletor Personalizável (`T01..T05` + Botão `🌈 Paleta`)**:
  - Cada ferramenta (`T01 Faceadora`, `T02 Fresa Topo/Interpolação`, `T03 Broca`, `T04 Chanfro/Mandril`, `T05 Contrafuro/Rosca`) colore as superfícies que usinou e o seu percurso nas 3 vistas, com seletores de cor individuais para cada ferramenta
- **🔄 Movimento Real nas Ferramentas de Interpolação (`G02/G03` Circular e Helicoidal)**:
  - Subdivide círculos e hélices `G02/G03` em 12 passos angulares por volta com rotação de hélice do spindle — a ferramenta orbita fisicamente ao redor do contorno e do furo helicoidal
- **🔧 Imagem 3D e 2D Realista das Ferramentas + Furos Rebaixados (`ctx.clip()`)**:
  - Desenho detalhado de **Cabeçote Faceador com pastilhas douradas TiN girando**, **Fresa de Topo com canais helicoidais torcidos**, **Broca com ponta cônica 118°**, **Fresa de Chanfro 90° em V**, **Pinça ER32 + Cone BT40** e **Porta-Inserto de Torno**
  - Recorte geométrico (`clip`) na boca dos furos e cavidades em 3D (elimina a ilusão de ótica de os furos parecerem pinos subindo!)


### v6.5.0
- **Nova Ordem Lógica do Layout (Fluxo de Processo Primeiro → Estudo e Conclusão Depois)**:
  - **1º Fluxo Operacional Contínuo no Topo**: Galeria de Peças → **1. Aceitar Processo (Features)** → **2. Programação CNC (ISO + Macro)** → **3. Simulador 3D (Workstation 3 Vistas)** → **4. Book Técnico da Peça (4 Folhas)** → **5. Software & Roteiro CAD** → **Calculadora & Tabelas**
  - **2º Área de Estudo, Avaliação e Conclusão no Final**: **Roteiro de Aulas (64h)** → **Quiz de Treino** → **Kit de Fichas de Avaliação** → **Certificado de Conclusão**
  - **Seletor Rápido de Peça (`🔧 Peça`)** dentro do Programa CNC e do Simulador 3D para trocar entre as 10 peças sem precisar subir a tela!


### v6.4.0
- **📘 Book Técnico Completo de Manufatura da Peça (4 Folhas Integradas)**:
  - **KPIs Executivos**: Massa Bruta vs. Peça Pronta, `%` e `kg` de Cavaco Removido, Tempo Total de Ciclo e Estratégia de Passes
  - **Folha 1**: Prancha de Desenho Técnico com Vistas Ortográficas, Corte A-A e Especificações
  - **Folha 2**: **Evolução Passo a Passo (Do Material Bruto até a Usinagem Final)** com diagramas SVG por etapa (Corte na Serra → Setup G54 → cada Operação de Usinagem), tempos, nº de passes e dicas práticas
  - **Folha 3**: **Tabela de Engenharia de Tempos por Ferramenta (`T01..T05`) + Gráficos SVG** (Gráfico de Tempo/Passes por Operação, Balanço Metalúrgico Bruto→Cavaco→Peça e Eficiência OEE Corte vs. Rápido G00 vs. Troca ATC)
  - **Folha 4**: **Plano de Inspeção Dimensional & Metrologia** (cota, tolerância, instrumento recomendado) + diagnóstico automático dos parâmetros escolhidos
- **🎛️ Escolha de Quanto Remover de Material por Vez (`ap` e `Q` em `mm/vez`) em Todas as 10 Situações de Usinagem**:
  - Seletor sincronizado na Programação CNC (Passo 4) e no Simulador 3D (Passo 5) para escolher **Passe de Desbaste (`ap / U`: `0,5` a `5,0 mm/vez`)**, **Mergulho Furação `G83 / G74` (`Q`: `0,5` a `5,0 mm/vez`)** e **Sobremetal de Acabamento (`0,1` a `1,0 mm`)** — recalculando o G-code, os mergulhos animados no Simulador 3D e os tempos/gráficos do Book Técnico!


### v6.3.0
- **Central de Funções de Usinagem & Ponto Zero (`G54`) no Simulador e Gerador CNC**:
  - **📍 Escolha do Ponto Zero (`G54`)**: alterne entre *Centro da Peça (`X0 Y0`)*, *Canto Inferior Esquerdo (`X+ Y+`)*, *Canto Superior Esquerdo (Encosto da Morsa Fixa)* e *Canto Superior Direito* — recalcula todas as coordenadas do Código ISO, do DRO e move o símbolo `G54` nas vistas 3D e Superior!
  - **🔩 Escolha de Ciclo de Furação**: alterne entre `G83` (Pica-pau com quebra-cavaco `Q` animado em mergulhos), `G81` (Simples direto) e `G82` (Com demora `P` no fundo)
  - **🛠️ Modo Desbaste vs. Acabamento**: escolha entre *Desbaste + Acabamento* (inclui passe final de precisão), *Só Desbaste* (deixa sobremetal de `0,3 mm`) ou *Só Acabamento*
  - **🌀 Estratégia de Cavidade pelo Centro**: escolha entre *Espiral pelo Centro (do centro p/ fora)*, *Helicoidal pelo Centro (`G02+Z`)* ou *Zig-Zag*, além do botão **`➕ Cavidade pelo Centro`** para abrir uma cavidade central em qualquer peça


### v6.2.0
- **Interface Workstation em Tela Única (Cockpit Sem Rolar)**:
  - Barra de controle superior compacta e fixa (`sticky`) reunindo reprodução, slider, velocidade, opções 3D, DRO digital e atalhos de operação em apenas ~80px
  - Grade de 3 colunas lado a lado na mesma visão: **Vista 3D Isométrica (Esquerda)** | **Vista Superior + Vista Frontal em Corte (Centro)** | **Bloco Atual + Programa CNC com auto-scroll interno (Direita)** — tudo visível na tela ao mesmo tempo sem precisar rolar o mouse
  - Roda do mouse não sequestra mais a rolagem da página sobre o canvas 3D (evita o zoom acidental gigante ao rolar a tela; zoom pelos botões ➕/➖ ou Ctrl+Scroll)
  - Traçagem da peça nominal visível sobre o bloco bruto em 3D desde o bloco 0


### v6.1.0
- **Renderizador 3D Sólido Suave (Smooth CSG) — fim do serrilhado quadrado**:
  - Substitui a grade de blocos quadrados (voxels) na visualização por **sólidos 3D contínuos e curvas vetoriais suaves** (64 segmentos por cilindro/furo, sombreamento Phong por normal, cantos arredondados nos rasgos/cavidades e corte técnico vetorial A-A na vista frontal)
  - Furo central helicoidal do Flange limpa o miolo completo (sem ilha central residual)
  - Enquadramento 3D recalibrado com margem automática e canvas 3D preenchendo 100% do painel esquerdo (sem faixa escura vazia embaixo)


### v6.0.0
- **Simulador 3D de Remoção de Material v2**:
  - Câmera 3D interativa (arrastar para girar 360° + zoom com roda do mouse ou botões)
  - Modo **🔪 Meio-Corte A-A** em 3D para inspecionar furos cegos, contrafuros, cavidades e roscas internas por dentro
  - Ferramenta 3D animada (fresa/broca + cone BT40 no fresamento; suporte + pastilha diamantada no torno) + brilho/cavacos no contato e eixos G54
  - Torno CNC 3D com **placa de 3 castanhas (chuck)** e barra cilíndrica em revolução (degraus, rasgos, furo central G74, mandrilamento e rosca G76)
  - Ciclos modais `G81/G82/G83` com retração automática ao plano `R`, interpolação helicoidal 3D (`G02` com `Z`) e repetição de perfil `G70 P..Q`
  - **Painel Digital CNC (DRO)** com coordenadas `X/Y/Z`, estado modal `G/T/S/F/M`, `% de área usinada`, tempo estimado de ciclo, atalhos clicáveis por operação e lista de blocos G-code sincronizada


### v5.9.0
- **Simulador 3D com remoção de material (3 vistas)**: vista 3D isométrica,
  vista superior (X×Y) e vista frontal (X×Z) — o bloco começa como **material
  bruto** e vai sendo usinado bloco a bloco (com diâmetro real da ferramenta)
- Suíte de testes versionada em `tests/smoke.js` (`node tests/smoke.js`)


### v5.8.0
- **Simulador de percurso (G-code)**: desenha o caminho da ferramenta e simula
  bloco a bloco (slider + reprodução) — previne colisões antes da máquina
- **Quiz de treino**: as 40 questões das fichas em modo interativo, com
  feedback instantâneo, respostas-modelo e pontuação
- **Calculadora de parâmetros de corte**: S, F, vc e Q por material/ferramenta
  (fresamento e torneamento), com cópia para o painel
- **Tabelas de apoio**: códigos G/M, roscas métricas (broca + Ø menor) e
  tolerâncias ISO 2768 — imprimível
- **Ficha de setup (FIC-SETUP)**: ferramentas e operações extraídas do programa
  + checklist de primeiro ciclo, para levar à máquina


### v5.7.0
- Impressão sem páginas em branco: quebra correta no kit de fichas (sem página
  extra entre fichas), seções vazias não vazam mais para a impressão e código
  longo quebra linha em vez de ser cortado
- Figuras técnicas explicativas do processo: fluxo Desenho → Features →
  Roteiro → Código CNC → Usinagem → Inspeção + figura da peça (vista SVG
  cotada) em cada aula — na tela e na impressão


### v5.6.1
- Corrigido erro de CORS do manifest.json ao abrir pelo instalador (file://):
  o manifest só é carregado em http/https — console limpo no app instalado


### v5.6
- Detecção real do exemplo ao enviar arquivo: correspondência pelo nome
  (ex.: flange.dxf abre o Flange) + análise geométrica de DXF (padrão polar
  de furos) para nomes desconhecidos — antes, tudo abria o exemplo base


### v5.5
- Ícone da marca (favicon.ico multi-tamanho + PNGs) e manifest PWA
- Instalador Windows offline (`instalar-cota.bat`): atalhos com ícone, modo
  aplicativo Edge/Chrome, Menu Iniciar e desinstalador — sem admin
- Pacote Electron pronto para gerar Setup.exe (NSIS) em máquina Windows


### v5.4
- Certificado de conclusão personalizável (A4 paisagem, selo dourado, nº de registro)
- Formulário com pré-visualização ao vivo e impressão dedicada


### v5.3
- Kit de fichas de avaliação pronto para impressão (11 documentos)
- 40 questões com gabarito do instrutor (módulos + prova final)
- Fichas de presença, identificação, eficácia pós-turma (NR-12) e controle de aprovação


### v5.2
- Roteiro de aulas profissional (trilha de formação de 64h) integrado ao app
- Objetivos, roteiro cronometrado, pontos de atenção e checklist por aula
- Progresso do aluno salvo na sessão + impressão do roteiro para sala de aula


### v5.1
- +5 exemplos: cunha inclinada, gabarito de furação, polia em V, bucha com rosca e eixo rosqueado
- Filtro da galeria por processo (fresamento / torneamento)
- Ciclos G82/G76, raspas de escape e par de rosca M20×1,5 para aulas de montagem


### v5.0
- Galeria com 5 situações de usinagem paramétricas
- Geração de código ISO (G-code) + programa paramétrico por peça
- Seção Passo 4 — Programação CNC com abas, realce de sintaxe, copiar e download
- Folha técnica e roteiro genéricos (cada peça traz suas vistas e etapas)

### v4.1
- Arquivo único `Cnc.html` dividido em HTML/CSS/JS
- Correções de bugs (miniatura 3D, massa/chanfro fixos, viewBox, features)
