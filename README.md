# COTA — do desenho à peça pronta

Assistente de CAD em português para ensino de modelagem 3D: você sobe um desenho
técnico, confirma as features detectadas, escolhe o seu software (SolidWorks,
Fusion 360 ou Inventor) e recebe um **roteiro de modelagem passo a passo** com o
comando certo para cada etapa — além de uma **folha de desenho técnica** com
vistas ortográficas cotadas, corte A-A e especificações calculadas.

## Como usar

Basta abrir o `index.html` em qualquer navegador (duplo clique funciona — sem
servidor, sem instalação). Para servir localmente:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Estrutura

```
index.html        Página principal (HTML semântico)
css/styles.css    Estilos (tema claro/escuro, responsivo, impressão)
js/app.js         Lógica do app (estado, roteiro, folha de desenho, exportação)
```

> O arquivo único `Cnc.html` foi dividido nestes três arquivos na refatoração
> v4.1. O conteúdo é o mesmo, agora organizado e mais fácil de manter.

## Funcionalidades

- **Upload de desenho** (PDF, DWG, DXF ou imagem) por arrastar-e-soltar, ou use
  a peça de exemplo
- **Detecção de features** com parâmetros editáveis (dimensões, furos, chanfro)
  — desmarcar uma feature recalcula folha, roteiro e massa em tempo real
- **Roteiro por software**: comandos traduzidos para SolidWorks, Fusion 360 e
  Inventor
- **Folha de desenho** com vistas frontal, superior, lateral e corte A-A em
  SVG, cotas dinâmicas e viewBox ajustável a qualquer dimensão
- **Massa estimada** calculada a partir do volume (aço SAE 1020, 7,85 g/cm³)
- **Progresso visual**: a cena 3D se monta conforme você marca as etapas
- **Exportar TXT** e **Imprimir / PDF** (folha + roteiro com layout de impressão)
- **Sessão persistida**: features, software, progresso e tema sobrevivem ao
  recarregamento da página
- **Acessibilidade**: teclado, `aria-*`, `prefers-reduced-motion`, órbita 3D
  também no toque

## Melhorias da v4.1

- Corrigido: a miniatura 3D da folha sumia após o upload
- Corrigido: massa e chanfro exibidos valores fixos no lugar dos calculados
- Corrigido: cotas eram cortadas quando as dimensões ultrapassavam 400 mm
- Corrigido: furos/chanfros da cena da folha ignoravam as features desmarcadas
- Desenho técnico agora respeita as features incluídas/excluídas
- Refatoração: HTML/CSS/JS separados, JS organizado por responsabilidade
