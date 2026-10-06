# LotoFácil Canvas

Aplicação estática em HTML, CSS e JavaScript para explorar as 3.268.760 combinações possíveis da Lotofácil em um canvas interativo.

## Como executar

Não é necessário instalar dependências nem compilar o projeto. Abra `index.html` em um navegador moderno.

## Como usar

- **Localizar:** informe 15 dezenas distintas entre 1 e 25 para destacar a combinação correspondente no canvas.
- **Resultado do sorteio:** preencha as 15 dezenas manualmente ou clique em **Aleatório** para gerar 15 dezenas distintas. Clique em **Gerar** para pintar as combinações de acordo com os acertos.
- **Cores:** 11 acertos em amarelo, 12 em amarelo mais escuro, 13 em verde, 14 em laranja e 15 em vermelho. A combinação com 15 acertos recebe um contorno especial.
- **Hover:** passe o ponteiro sobre um cartão para ver suas dezenas, posição e pontuação em relação ao último sorteio gerado.
- **Selecionar região:** clique e arraste com o botão esquerdo sobre o canvas. Ao soltar, o resumo mostra quantos cartões da área estão em cada faixa de pontuação.
- **Prêmios:** o resumo calcula os valores fixos de 11, 12 e 13 acertos e permite editar os prêmios por cartão de 14 e 15 acertos. O total é atualizado automaticamente.
- **Ver cartões:** no resumo da seleção, clique em **Ver cartões** para abrir a lista das combinações incluídas. A lista é paginada em grupos de até 100 cartões.

A faixa de **0 pontos** representa cartões sem prêmio, isto é, com menos de 11 acertos. Como o cartão e o sorteio têm 15 dezenas em um universo de 25, zero acertos reais não é possível; o mínimo é 5.

## Canvas responsivo

A largura do canvas acompanha a área disponível da janela. A altura é recalculada para manter as 3.268.760 combinações, e a barra fixa inferior informa as dimensões atuais em pixels.

A ordem é lexicográfica, da esquerda para a direita e de cima para baixo: o primeiro cartão é `01 02 03 04 05 06 07 08 09 10 11 12 13 14 15`, e o último é `11 12 13 14 15 16 17 18 19 20 21 22 23 24 25`.

## Arquivos

- `index.html`: estrutura da página e formulários.
- `style.css`: layout, cores e apresentação dos diálogos.
- `main.js`: combinações, mapeamento do canvas, busca, pintura e seleção.
