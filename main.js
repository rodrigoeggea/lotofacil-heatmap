const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const canvasWrap = document.querySelector('.canvas-wrap');
const canvasDimensions = document.getElementById('canvas-dimensions');
const perfectCanvas = document.getElementById('perfect-canvas');
const perfectContext = perfectCanvas.getContext('2d');
const highlightCanvas = document.getElementById('highlight-canvas');
const highlightContext = highlightCanvas.getContext('2d');
const selectionCanvas = document.getElementById('selection-canvas');
const selectionContext = selectionCanvas.getContext('2d');
const selectionLiveCount = document.getElementById('selection-live-count');
const popup = document.getElementById('result-popup');
const positionLabel = document.getElementById('result-position');
const numbersLabel = document.getElementById('result-numbers');
const scoreLabel = document.getElementById('result-score');
const searchForm = document.getElementById('result-search');
const numberInputs = [...searchForm.querySelectorAll('.number-input')];
const searchStatus = document.getElementById('search-status');
const drawForm = document.getElementById('draw-search');
const drawInputs = [...drawForm.querySelectorAll('.number-input')];
const drawStatus = document.getElementById('draw-status');
const randomDrawButton = document.getElementById('draw-random');
const validationDialog = document.getElementById('validation-dialog');
const validationMessage = document.getElementById('validation-message');
const selectionDialog = document.getElementById('selection-dialog');
const selectionTotal = document.getElementById('selection-total');
const selectionCost = document.getElementById('selection-cost');
const selectionCounts = new Map(
  [0, 11, 12, 13, 14, 15].map((hits) => [hits, document.getElementById(`selection-count-${hits}`)])
);
const selectionTierPrizeTotals = new Map(
  [0, 11, 12, 13, 14, 15].map((hits) => [hits, document.getElementById(`selection-tier-prize-total-${hits}`)])
);
const selectionPrize14 = document.getElementById('selection-prize-14');
const selectionPrize15 = document.getElementById('selection-prize-15');
const selectionPrizeTotal = document.getElementById('selection-prize-total');
const showSelectionCardsButton = document.getElementById('show-selection-cards');
const selectionCardsDialog = document.getElementById('selection-cards-dialog');
const selectionPageLabel = document.getElementById('selection-page-label');
const selectionCardList = document.getElementById('selection-card-list');
const selectionPreviousButton = document.getElementById('selection-previous');
const selectionNextButton = document.getElementById('selection-next');

const numberCount = 25;
const numbersPerResult = 15;

function limitNumberInputLength(event) {
  const input = event.currentTarget;

  if (input.value.length > 2) {
    input.value = input.value.slice(0, 2);
  }
}

function padSingleDigitInput(input) {
  if (/^\d$/.test(input.value)) {
    input.value = input.value.padStart(2, '0');
  }
}

function focusAndSelectInput(input) {
  input.focus();
  input.select();
}

function enableInputAutoAdvance(inputs) {
  inputs.forEach((input, index) => {
    let singleDigitTimer = 0;

    padSingleDigitInput(input);
    input.addEventListener('blur', () => {
      window.clearTimeout(singleDigitTimer);
      padSingleDigitInput(input);
    });

    input.addEventListener('input', (event) => {
      limitNumberInputLength(event);
      window.clearTimeout(singleDigitTimer);

      const nextInput = inputs[index + 1];

      if (nextInput === undefined) {
        return;
      }

      if (input.value.length >= 2) {
        focusAndSelectInput(nextInput);
        return;
      }

      if (input.value.length === 1) {
        singleDigitTimer = window.setTimeout(() => {
          if (document.activeElement === input && input.value.length === 1) {
            padSingleDigitInput(input);
            focusAndSelectInput(nextInput);
          }
        }, 500);
      }
    });
  });
}

enableInputAutoAdvance(numberInputs);
enableInputAutoAdvance(drawInputs);

function combinationCount(total, selected) {
  let count = 1;

  for (let index = 1; index <= selected; index += 1) {
    count = (count * (total - selected + index)) / index;
  }

  return count;
}

const resultCount = combinationCount(numberCount, numbersPerResult);
let pixelCount = canvas.width * canvas.height;
const numberFormatter = new Intl.NumberFormat('pt-BR');
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const ticketPrice = 3.5;
let matchByPixel = new Uint8Array(pixelCount);
const selectionPageSize = 100;
let highlightedPixel = null;
let currentDrawNumbers = null;
let selectionDrag = null;
let currentSelectionBounds = null;
let currentSelectionCounts = null;
let selectionPageStarts = [0];
let currentSelectionPage = 0;
let selectionNextOffset = 0;

context.fillStyle = '#ffffff';
context.fillRect(0, 0, canvas.width, canvas.height);

function resultRankAtPixel(pixelIndex) {
  return Math.round((pixelIndex * (resultCount - 1)) / (pixelCount - 1));
}

function getResultAt(rank) {
  const result = [];
  let candidate = 1;
  let remainingRank = rank;

  for (let remaining = numbersPerResult; remaining > 0; remaining -= 1) {
    for (; candidate <= numberCount - remaining + 1; candidate += 1) {
      const resultsWithCandidate = combinationCount(
        numberCount - candidate,
        remaining - 1
      );

      if (remainingRank < resultsWithCandidate) {
        result.push(candidate);
        candidate += 1;
        break;
      }

      remainingRank -= resultsWithCandidate;
    }
  }

  return result;
}

function getRankForResult(result) {
  let rank = 0;
  let firstCandidate = 1;

  for (let index = 0; index < result.length; index += 1) {
    const remaining = result.length - index - 1;

    for (let candidate = firstCandidate; candidate < result[index]; candidate += 1) {
      rank += combinationCount(numberCount - candidate, remaining);
    }

    firstCandidate = result[index] + 1;
  }

  return rank;
}

function getValidNumbers(inputs, subject) {
  const values = inputs.map((input) => input.value.trim());

  if (values.some((value) => value === '')) {
    showValidationError(`Preencha os 15 números ${subject}.`);
    return null;
  }

  const result = values.map(Number);

  if (!result.every((number) => Number.isInteger(number) && number >= 1 && number <= numberCount)) {
    showValidationError('Cada número deve ser um inteiro entre 1 e 25.');
    return null;
  }

  if (new Set(result).size !== numbersPerResult) {
    showValidationError('Os 15 números devem ser diferentes.');
    return null;
  }

  return result.sort((first, second) => first - second);
}

function getDrawNumbersForScoring() {
  const values = drawInputs.map((input) => input.value.trim());

  if (values.every((value) => value === '')) {
    return currentDrawNumbers;
  }

  if (values.some((value) => value === '')) {
    return null;
  }

  const result = values.map(Number);

  if (
    !result.every((number) => Number.isInteger(number) && number >= 1 && number <= numberCount) ||
    new Set(result).size !== numbersPerResult
  ) {
    return null;
  }

  return result.sort((first, second) => first - second);
}

function pixelIndexAtRank(rank) {
  let lower = 0;
  let upper = pixelCount - 1;

  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);

    if (resultRankAtPixel(middle) < rank) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  return lower;
}

function pixelIndexesAtRank(rank) {
  const first = pixelIndexAtRank(rank);

  if (first + 1 < pixelCount && resultRankAtPixel(first + 1) === rank) {
    return [first, first + 1];
  }

  return [first];
}

function clearHighlight() {
  if (highlightedPixel === null) {
    return;
  }

  highlightContext.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
  highlightedPixel = null;
}

function showValidationError(message) {
  searchStatus.textContent = '';
  drawStatus.textContent = '';
  validationMessage.textContent = message;
  validationDialog.showModal();
}

function highlightResult(rank) {
  clearHighlight();

  const pixelIndex = pixelIndexAtRank(rank);
  const x = pixelIndex % canvas.width;
  const y = Math.floor(pixelIndex / canvas.width);

  highlightContext.strokeStyle = '#ad3025';
  highlightContext.lineWidth = 1;
  highlightContext.strokeRect(x - 3.5, y - 3.5, 8, 8);
  highlightContext.fillStyle = '#d54836';
  highlightContext.fillRect(x, y, 1, 1);
  highlightedPixel = { x, y };

  return { x, y };
}

function getCombinations(values, count) {
  const combinations = [];
  const selected = [];

  function collect(start) {
    if (selected.length === count) {
      combinations.push([...selected]);
      return;
    }

    const needed = count - selected.length;

    for (let index = start; index <= values.length - needed; index += 1) {
      selected.push(values[index]);
      collect(index + 1);
      selected.pop();
    }
  }

  collect(0);
  return combinations;
}

function mergeSortedResults(first, second) {
  const result = new Array(numbersPerResult);
  let firstIndex = 0;
  let secondIndex = 0;

  for (let index = 0; index < numbersPerResult; index += 1) {
    if (secondIndex >= second.length || first[firstIndex] < second[secondIndex]) {
      result[index] = first[firstIndex];
      firstIndex += 1;
    } else {
      result[index] = second[secondIndex];
      secondIndex += 1;
    }
  }

  return result;
}

function paintResult(image, rank, color, hits) {
  for (const pixelIndex of pixelIndexesAtRank(rank)) {
    const offset = pixelIndex * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
    matchByPixel[pixelIndex] = hits;
  }
}

function highlightPerfectMatch(rank) {
  const pixelIndex = pixelIndexAtRank(rank);
  const x = pixelIndex % canvas.width;
  const y = Math.floor(pixelIndex / canvas.width);

  perfectContext.strokeStyle = '#18252b';
  perfectContext.lineWidth = 2;
  perfectContext.strokeRect(x - 4.5, y - 4.5, 10, 10);
  perfectContext.strokeStyle = '#ffffff';
  perfectContext.lineWidth = 1;
  perfectContext.strokeRect(x - 2.5, y - 2.5, 6, 6);
}

function generateDrawMatches(drawNumbers) {
  clearHighlight();
  perfectContext.clearRect(0, 0, perfectCanvas.width, perfectCanvas.height);
  selectionContext.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
  matchByPixel.fill(0);

  const drawnSet = new Set(drawNumbers);
  const otherNumbers = Array.from({ length: numberCount }, (_, index) => index + 1)
    .filter((number) => !drawnSet.has(number));
  const image = context.createImageData(canvas.width, canvas.height);
  image.data.fill(255);
  const counts = Array(numbersPerResult + 1).fill(0);
  const colors = {
    11: [255, 241, 118],
    12: [253, 216, 53],
    13: [76, 175, 80],
    14: [251, 140, 0],
    15: [211, 47, 47]
  };

  for (let hits = 11; hits <= numbersPerResult; hits += 1) {
    const drawnCombinations = getCombinations(drawNumbers, hits);
    const otherCombinations = getCombinations(otherNumbers, numbersPerResult - hits);

    for (const drawnCombination of drawnCombinations) {
      for (const otherCombination of otherCombinations) {
        const result = mergeSortedResults(drawnCombination, otherCombination);
          paintResult(image, getRankForResult(result), colors[hits], hits);
        counts[hits] += 1;
      }
    }
  }

  context.putImageData(image, 0, 0);

  if (counts[numbersPerResult] > 0) {
    highlightPerfectMatch(getRankForResult(drawNumbers));
  }

  return counts;
}

function getCanvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();

  return {
    x: Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - bounds.left) * canvas.width) / bounds.width))),
    y: Math.max(0, Math.min(canvas.height - 1, Math.floor(((event.clientY - bounds.top) * canvas.height) / bounds.height)))
  };
}

function drawSelectionRectangle() {
  selectionContext.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);

  const left = Math.min(selectionDrag.start.x, selectionDrag.end.x);
  const top = Math.min(selectionDrag.start.y, selectionDrag.end.y);
  const width = Math.abs(selectionDrag.end.x - selectionDrag.start.x) + 1;
  const height = Math.abs(selectionDrag.end.y - selectionDrag.start.y) + 1;

  selectionContext.fillStyle = 'rgb(23 107 87 / 16%)';
  selectionContext.fillRect(left, top, width, height);
  selectionContext.strokeStyle = '#176b57';
  selectionContext.lineWidth = 2;
  selectionContext.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
}

function updateSelectionLiveCount(event) {
  const width = Math.abs(selectionDrag.end.x - selectionDrag.start.x) + 1;
  const height = Math.abs(selectionDrag.end.y - selectionDrag.start.y) + 1;
  const total = width * height;

  selectionLiveCount.textContent = `${numberFormatter.format(total)} ${total === 1 ? 'cartão' : 'cartões'}`;
  selectionLiveCount.hidden = false;

  const left = Math.min(event.clientX + 14, window.innerWidth - selectionLiveCount.offsetWidth - 8);
  const maxTop = window.innerHeight - document.querySelector('.canvas-size-bar').offsetHeight - selectionLiveCount.offsetHeight - 8;
  const top = Math.min(event.clientY + 14, maxTop);

  selectionLiveCount.style.left = `${Math.max(8, left)}px`;
  selectionLiveCount.style.top = `${Math.max(8, top)}px`;
}

function showSelectionSummary(selection) {
  const left = Math.min(selection.start.x, selection.end.x);
  const top = Math.min(selection.start.y, selection.end.y);
  const right = Math.max(selection.start.x, selection.end.x);
  const bottom = Math.max(selection.start.y, selection.end.y);
  const counts = new Map([0, 11, 12, 13, 14, 15].map((hits) => [hits, 0]));

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const hits = matchByPixel[y * canvas.width + x];
      const tier = hits >= 11 ? hits : 0;
      counts.set(tier, counts.get(tier) + 1);
    }
  }

  const total = (right - left + 1) * (bottom - top + 1);
  currentSelectionBounds = { left, top, right, bottom };
  currentSelectionCounts = counts;
  const cardLabel = total === 1 ? 'cartão selecionado' : 'cartões selecionados';
  selectionTotal.textContent = `${numberFormatter.format(total)} ${cardLabel} nesta região`;
  selectionCost.textContent = `Custo para jogar: ${currencyFormatter.format(total * ticketPrice)}`;

  for (const [hits, output] of selectionCounts) {
    output.textContent = numberFormatter.format(counts.get(hits));
  }

  updateSelectionPrizeTotal();
  selectionDialog.showModal();
}

function getPrizeInputValue(input) {
  const value = input.valueAsNumber;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function updateSelectionPrizeTotal() {
  if (currentSelectionCounts === null) {
    return;
  }

  const prizePerCard = new Map([
    [0, 0],
    [11, 7],
    [12, 14],
    [13, 35],
    [14, getPrizeInputValue(selectionPrize14)],
    [15, getPrizeInputValue(selectionPrize15)]
  ]);
  let totalPrize = 0;

  for (const [hits, output] of selectionTierPrizeTotals) {
    const tierTotal = currentSelectionCounts.get(hits) * prizePerCard.get(hits);
    output.textContent = currencyFormatter.format(tierTotal);
    totalPrize += tierTotal;
  }

  selectionPrizeTotal.textContent = currencyFormatter.format(totalPrize);
}

function renderSelectionCardsPage() {
  const bounds = currentSelectionBounds;
  const width = bounds.right - bounds.left + 1;
  const total = width * (bounds.bottom - bounds.top + 1);
  const start = selectionPageStarts[currentSelectionPage];
  const end = Math.min(total, start + selectionPageSize);

  selectionCardList.replaceChildren();
  selectionCardList.start = start + 1;

  for (let offset = start; offset < end; offset += 1) {
    const x = bounds.left + (offset % width);
    const y = bounds.top + Math.floor(offset / width);
    const rank = resultRankAtPixel(y * canvas.width + x);
    const result = getResultAt(rank);
    const item = document.createElement('li');

    item.textContent = result.map((number) => String(number).padStart(2, '0')).join(' ');
    selectionCardList.append(item);
  }

  selectionNextOffset = end;
  selectionPageLabel.textContent = `Cartões ${numberFormatter.format(start + 1)}–${numberFormatter.format(end)} de ${numberFormatter.format(total)}`;
  selectionPreviousButton.disabled = currentSelectionPage === 0;
  selectionNextButton.disabled = end >= total;
}

function openSelectionCards() {
  if (currentSelectionBounds === null) {
    return;
  }

  currentSelectionPage = 0;
  selectionPageStarts = [0];
  renderSelectionCardsPage();
  selectionCardsDialog.showModal();
}

function goToNextSelectionPage() {
  const bounds = currentSelectionBounds;
  const total = (bounds.right - bounds.left + 1) * (bounds.bottom - bounds.top + 1);

  if (selectionNextOffset >= total) {
    return;
  }

  selectionPageStarts[currentSelectionPage + 1] = selectionNextOffset;
  currentSelectionPage += 1;
  renderSelectionCardsPage();
}

function goToPreviousSelectionPage() {
  if (currentSelectionPage === 0) {
    return;
  }

  currentSelectionPage -= 1;
  renderSelectionCardsPage();
}

function startSelection(event) {
  if (event.button !== 0) {
    return;
  }

  if (currentDrawNumbers === null) {
    showValidationError('Gere o resultado do sorteio antes de selecionar uma região.');
    return;
  }

  event.preventDefault();
  popup.hidden = true;
  const point = getCanvasPoint(event);
  selectionDrag = { pointerId: event.pointerId, start: point, end: point };
  canvas.setPointerCapture(event.pointerId);
  drawSelectionRectangle();
  updateSelectionLiveCount(event);
}

function moveOnCanvas(event) {
  if (selectionDrag !== null && event.pointerId === selectionDrag.pointerId) {
    selectionDrag.end = getCanvasPoint(event);
    drawSelectionRectangle();
    updateSelectionLiveCount(event);
    return;
  }

  showResult(event);
}

function finishSelection(event) {
  if (selectionDrag === null || event.pointerId !== selectionDrag.pointerId) {
    return;
  }

  selectionDrag.end = getCanvasPoint(event);
  drawSelectionRectangle();
  const completedSelection = selectionDrag;
  selectionDrag = null;
  selectionLiveCount.hidden = true;
  showSelectionSummary(completedSelection);
}

function showResult(event) {
  const { x, y } = getCanvasPoint(event);
  const pixelIndex = y * canvas.width + x;
  const rank = resultRankAtPixel(pixelIndex);
  const result = getResultAt(rank);

  positionLabel.textContent = `Resultado ${numberFormatter.format(rank + 1)} de ${numberFormatter.format(resultCount)}`;
  numbersLabel.textContent = result.map((number) => String(number).padStart(2, '0')).join(' ');

  if (currentDrawNumbers === null) {
    scoreLabel.textContent = 'Acertos: gere um sorteio';
    scoreLabel.dataset.tier = 'unknown';
  } else {
    const drawSet = new Set(currentDrawNumbers);
    const hits = result.reduce((total, number) => total + Number(drawSet.has(number)), 0);
    const tier = hits >= 11 ? hits : 0;

    scoreLabel.textContent = hits >= 11
      ? `Acertos: ${hits} pontos`
      : `Acertos: ${hits} (sem prêmio)`;
    scoreLabel.dataset.tier = String(tier);
  }

  popup.hidden = false;

  const left = Math.min(event.clientX + 14, window.innerWidth - popup.offsetWidth - 8);
  const top = Math.min(event.clientY + 14, window.innerHeight - popup.offsetHeight - 8);
  popup.style.left = `${Math.max(8, left)}px`;
  popup.style.top = `${Math.max(8, top)}px`;
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const result = getValidNumbers(numberInputs, 'da busca');

  if (result === null) {
    return;
  }

  clearHighlight();

  const rank = getRankForResult(result);
  const target = highlightResult(rank);
  const drawNumbers = getDrawNumbersForScoring();
  let score = '';

  if (drawNumbers !== null) {
    const drawnNumbers = new Set(drawNumbers);
    const hits = result.reduce((total, number) => total + Number(drawnNumbers.has(number)), 0);
    score = hits >= 11 ? `${hits} acertos` : `${hits} acertos (sem prêmio)`;
  }

  const scoreText = score === '' ? '' : ` ${score}.`;
  searchStatus.textContent = `Resultado ${numberFormatter.format(rank + 1)} destacado no canvas.${scoreText}`;
  popup.hidden = true;

  const bounds = canvas.getBoundingClientRect();
  window.scrollTo({
    left: Math.max(0, bounds.left + window.scrollX + target.x - window.innerWidth / 2),
    top: Math.max(0, bounds.top + window.scrollY + target.y - window.innerHeight / 2),
    behavior: 'smooth'
  });
});

drawForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const drawNumbers = getValidNumbers(drawInputs, 'do sorteio');

  if (drawNumbers === null) {
    return;
  }

  currentDrawNumbers = null;
  configureCanvas();
  currentDrawNumbers = drawNumbers;
  const counts = generateDrawMatches(drawNumbers);
  const total = counts.slice(11).reduce((sum, count) => sum + count, 0);
  const breakdown = counts.slice(11).map((count, index) =>
    `${numberFormatter.format(count)} com ${index + 11}`
  ).join(', ');

  drawStatus.textContent = `${numberFormatter.format(total)} resultados pintados: ${breakdown} acertos.`;
  searchStatus.textContent = '';
  popup.hidden = true;
});

canvas.addEventListener('pointerdown', startSelection);
canvas.addEventListener('pointermove', moveOnCanvas);
canvas.addEventListener('pointerup', finishSelection);
canvas.addEventListener('pointercancel', () => {
  selectionDrag = null;
  selectionLiveCount.hidden = true;
  selectionContext.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
});
canvas.addEventListener('pointerleave', () => {
  if (selectionDrag === null) {
    popup.hidden = true;
  }
});

showSelectionCardsButton.addEventListener('click', openSelectionCards);
selectionPreviousButton.addEventListener('click', goToPreviousSelectionPage);
selectionNextButton.addEventListener('click', goToNextSelectionPage);
selectionPrize14.addEventListener('input', updateSelectionPrizeTotal);
selectionPrize15.addEventListener('input', updateSelectionPrizeTotal);

randomDrawButton.addEventListener('click', () => {
  const pool = Array.from({ length: numberCount }, (_, index) => index + 1);

  for (let index = 0; index < numbersPerResult; index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (numberCount - index));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  pool.slice(0, numbersPerResult)
    .sort((first, second) => first - second)
    .forEach((number, index) => {
      drawInputs[index].value = String(number).padStart(2, '0');
    });

  drawStatus.textContent = 'Números aleatórios preenchidos. Clique em Gerar para aplicar ao canvas.';
});

function configureCanvas() {
  const width = Math.max(1, document.documentElement.clientWidth);
  const height = Math.ceil(resultCount / width);

  canvasDimensions.textContent = `Largura: ${numberFormatter.format(width)} px · Altura: ${numberFormatter.format(height)} px`;

  canvasWrap.style.width = `${width}px`;
  canvasWrap.style.height = `${height}px`;

  if (canvas.width === width && canvas.height === height) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
  perfectCanvas.width = width;
  perfectCanvas.height = height;
  highlightCanvas.width = width;
  highlightCanvas.height = height;
  selectionCanvas.width = width;
  selectionCanvas.height = height;
  pixelCount = width * height;
  matchByPixel = new Uint8Array(pixelCount);
  highlightedPixel = null;
  selectionDrag = null;
  selectionLiveCount.hidden = true;
  popup.hidden = true;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  if (currentDrawNumbers !== null) {
    generateDrawMatches(currentDrawNumbers);
  }
}

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(configureCanvas);
});

configureCanvas();
requestAnimationFrame(configureCanvas);