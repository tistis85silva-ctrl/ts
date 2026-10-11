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

## Estrutura

```
index.html        Página principal (HTML semântico)
css/styles.css    Estilos (tema claro/escuro, responsivo, impressão)
js/parts.js       Catálogo de peças: vistas SVG, roteiro, G-code e macros
js/curso.js       Trilha de formação: módulos, aulas e avaliação
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
