const SPEED_SCALE = 0.00009;
const POPULATION_SIZE = 150;
const FRAME_INTERVAL = 1000 / 90; // 90 FPS

let game, scoreDisplay, statsDisplay, dinosContainer, lastTime, speedScale, score;
let neat, dinos = [], isJumping = [], activeDinosaurs = [];
let nextCactusTime, grounds, cacti = [];

document.addEventListener("DOMContentLoaded", () => {
  game = document.querySelector("#game");
  scoreDisplay = document.querySelector("#score");
  statsDisplay = {
    population: document.getElementById("population"),
    generation: document.getElementById("generation"),
    bestFitness: document.getElementById("best-fitness"),
    currentNeurons: document.getElementById("current-neurons"),
    currentConnections: document.getElementById("current-connections"),
    currentHiddenLayers: document.getElementById("current-hidden-layers"),
  };
  dinosContainer = document.getElementById("dinos");

  neat = new neataptic.Neat(
    2, // Número de entradas: Distância ao próximo cacto e velocidade
    1, // Uma saída: Pular ou não
    null,
    {
      mutation: neataptic.methods.mutation.ALL,
      popsize: POPULATION_SIZE,
      mutationRate: 0.8,
      elitism: Math.round(POPULATION_SIZE * 0.2),
    }
  );

  startGame();
});

/* Atualização de frames */
function update(time) { 
  if (lastTime == null) {
    lastTime = time;
    window.requestAnimationFrame(update);
    return;
  }

  const delta = time - lastTime;

  if (delta >= FRAME_INTERVAL) {
    updateGround(delta, speedScale);
    updateDinos(delta, speedScale);
    updateCactus(delta, speedScale);
    updateSpeedScale(delta);
    updateScore(delta);

    if (checkGameOver()) {
      evolvePopulation();
      return startGame();
    }

    lastTime = time;
  }

  window.requestAnimationFrame(update);
}

function startGame() {
  lastTime = null;
  speedScale = 1;
  score = 0;
  setupGround();
  setupDinos();
  setupCactus();
  window.requestAnimationFrame(update);
  updateStats();
}

function evolvePopulation() {
  neat.sort();
  const newPopulation = [];

  for (let i = 0; i < neat.elitism; i++) {
    newPopulation.push(neat.population[i]);
  }

  for (let i = 0; i < neat.popsize - neat.elitism; i++) {
    newPopulation.push(neat.getOffspring());
  }

  neat.population = newPopulation;
  neat.mutate();
  neat.generation++;
}

function updateStats() {
  statsDisplay.population.textContent = `Population: ${activeDinosaurs.length}`;
  statsDisplay.generation.textContent = `Generation: ${neat.generation}`;
  statsDisplay.bestFitness.textContent = `Best Fitness: ${Math.round(neat.population[0].score * 100) / 100}`;
  const bestGenome = neat.population[0];
  statsDisplay.currentNeurons.textContent = `Neurons: ${bestGenome.nodes.length}`;
  statsDisplay.currentConnections.textContent = `Connections: ${bestGenome.connections.length}`;
  statsDisplay.currentHiddenLayers.textContent = `Hidden Layers: ${bestGenome.nodes.filter(n => n.type === 'hidden').length}`;
}

/* Acelera o jogo com o passar do tempo */
function updateSpeedScale(delta) { 
  speedScale += delta * SPEED_SCALE;
}

function updateScore(delta) {
  score += delta * 0.01; 
  scoreDisplay.textContent = Math.floor(score);
}

/* Condições de colisão */
function checkCollision(rect1, rect2) {
  return (
    rect1.left < rect2.right &&
    rect1.top < rect2.bottom &&
    rect1.right > rect2.left &&
    rect1.bottom > rect2.top
  );
}

function checkGameOver() {
  activeDinosaurs = activeDinosaurs.filter(index => {
    const dinoRect = getDinoRect(dinos[index]);
    const collided = getCactusRects().some(rect => checkCollision(rect, dinoRect));
    if (collided) {
      neat.population[index].score = score;
      dinos[index].remove(); // Remove a sprite do dinossauro colidido
    }
    return !collided;
  });

  updateStats();
  return activeDinosaurs.length === 0;
}

/* MANIPULAÇÃO DAS PROPRIEDADES CSS */

/* Pega valor da propriedade */
function getCustomProperty(elem, prop) {
  return parseFloat(getComputedStyle(elem).getPropertyValue(prop)) || 0;
}

/* Define valor da propriedade */
function setCustomProperty(elem, prop, value) {
  elem.style.setProperty(prop, value);
}

/* Incrementa o valor da propriedade */
function incrementCustomProperty(elem, prop, inc) {
  setCustomProperty(elem, prop, getCustomProperty(elem, prop) + inc);
}

/* MOVIMENTO DO CHÃO */
const GROUND_SPEED = 0.05;

function setupGround() {
  grounds = document.querySelectorAll(".ground");
  setCustomProperty(grounds[0], "--left", 0);
  setCustomProperty(grounds[1], "--left", 300);
}

function updateGround(delta, speedScale) {
  grounds.forEach(ground => {
    incrementCustomProperty(ground, "--left", delta * speedScale * GROUND_SPEED * -1);

    if (getCustomProperty(ground, "--left") <= -300) {
      incrementCustomProperty(ground, "--left", 600);
    }
  });
}

/* MOVIMENTO DOS DINOSSAUROS */
const JUMP_SPEED = 0.45;
const GRAVITY = 0.0015;
const DINO_FRAME_COUNT = 2;
const FRAME_TIME = 100;

let dinoFrames = [], currentFrameTime = [];

function setupDinos() {
  dinosContainer.innerHTML = "";
  dinos = [];
  isJumping = [];
  dinoFrames = [];
  currentFrameTime = [];
  activeDinosaurs = [];

  for (let i = 0; i < POPULATION_SIZE; i++) {
    const dino = document.createElement("img");
    dino.src = `imgs/dino-stationary.png`;
    dino.classList.add("dino");
    dinosContainer.appendChild(dino);
    dinos.push(dino);
    isJumping.push(false);
    dinoFrames.push(0);
    currentFrameTime.push(0);
    activeDinosaurs.push(i);
    setCustomProperty(dino, "--bottom", 0);
  }
}

function updateDinos(delta, speedScale) {
  const activationTable = document.getElementById("activation-table");
  activationTable.innerHTML = "";

  activeDinosaurs.forEach(index => {
    const dino = dinos[index];
    handleRun(dino, delta, speedScale, index);
    handleJump(dino, delta, index);

    const inputs = [getNextCactusDistance(dino), speedScale];
    const output = neat.population[index].activate(inputs);
    if (output[0] > 0.5 && !isJumping[index]) {
      yVelocity[index] = JUMP_SPEED;
      isJumping[index] = true;
    }

    // Adiciona as ativações ao gráfico
    const activationDiv = document.createElement("div");
    activationDiv.innerHTML = `
      <strong>Dino ${index}</strong>: Inputs: [${inputs.map(v => v.toFixed(2)).join(", ")}], Output: ${output[0].toFixed(2)}
    `;
    activationTable.appendChild(activationDiv);

    // Atualiza a visualização da rede neural do primeiro dinossauro ativo
    if (index === activeDinosaurs[0]) {
      updateNetworkVisualization(neat.population[index]);
    }
  });
}

function handleRun(dino, delta, speedScale, index) {
  if (isJumping[index]) {
    dino.src = `imgs/dino-stationary.png`;
    return;
  }

  if (currentFrameTime[index] >= FRAME_TIME) {
    dinoFrames[index] = (dinoFrames[index] + 1) % DINO_FRAME_COUNT;
    dino.src = `imgs/dino-run-${dinoFrames[index]}.png`;
    currentFrameTime[index] -= FRAME_TIME
  }
  currentFrameTime[index] += delta * speedScale;
}

let yVelocity = new Array(POPULATION_SIZE).fill(0);

function handleJump(dino, delta, index) {
  if (!isJumping[index]) return;

  incrementCustomProperty(dino, "--bottom", yVelocity[index] * delta);

  if (getCustomProperty(dino, "--bottom") <= 0) {
    setCustomProperty(dino, "--bottom", 0);
    isJumping[index] = false;
  }

  yVelocity[index] -= GRAVITY * delta;
}

function getDinoRect(dino) {
  return dino.getBoundingClientRect();
}

/* ADICIONA CACTUS */
const CACTUS_SPEED = 0.05;
const CACTUS_INTERVAL_MIN = 3300;
const CACTUS_INTERVAL_MAX = 11900;

function setupCactus() {
  nextCactusTime = CACTUS_INTERVAL_MIN;
  cacti.forEach(cactus => cactus.remove());
  cacti = [];
}

function updateCactus(delta, speedScale) {
  cacti.forEach(cactus => {
    incrementCustomProperty(cactus, "--left", delta * speedScale * CACTUS_SPEED * -1);
    if (getCustomProperty(cactus, "--left") <= -100) {
      cactus.remove();
    }
  });
  cacti = cacti.filter(cactus => cactus.parentElement !== null);

  if (nextCactusTime <= 0) {
    createCactus();
    nextCactusTime = randomizer(CACTUS_INTERVAL_MIN, CACTUS_INTERVAL_MAX) / speedScale;
  }
  nextCactusTime -= delta;
}

function getCactusRects() {
  return cacti.map(cactus => cactus.getBoundingClientRect());
}

function createCactus() {
  const cactus = document.createElement("img");
  cactus.src = "imgs/cactus.png";
  cactus.classList.add("cactus");
  setCustomProperty(cactus, "--left", 100);
  game.append(cactus);
  cacti.push(cactus);
}

function getNextCactusDistance(dino) {
  const dinoRect = getDinoRect(dino);
  const nextCactus = cacti.find(cactus => cactus.getBoundingClientRect().left > dinoRect.right);
  if (!nextCactus) return 100;
  return nextCactus.getBoundingClientRect().left - dinoRect.right;
}

function randomizer(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/* Função para desenhar a rede neural */
function drawNetwork(ctx, genome, startX, startY, neuronSize) {
  // Organize os neurônios por camadas
  const inputNodes = genome.nodes.filter(node => node.type === 'input');
  const hiddenNodes = genome.nodes.filter(node => node.type === 'hidden');
  const outputNodes = genome.nodes.filter(node => node.type === 'output');

  // Organize as camadas dinamicamente
  const layers = [inputNodes, hiddenNodes, outputNodes];

  const layerPositions = [];
  const neuronRadius = neuronSize / 2;
  const margin = neuronSize * 1.5;

  // Calcula posições dos neurônios e desenha-os
  layers.forEach((layer, layerIndex) => {
    layerPositions[layerIndex] = [];
    const x = startX + layerIndex * margin * 2;
    const height = layer.length * margin;
    const yStart = startY + (ctx.canvas.height / 2 - height / 2);

    layer.forEach((node, index) => {
      const y = yStart + index * margin;
      layerPositions[layerIndex].push({ x, y });

      const activation = node.activation || 0; // Garantir valor padrão para ativação
      const colorValue = Math.floor((1 - activation) * 255);
      ctx.fillStyle = `rgb(${colorValue}, 0, 0)`;
      ctx.beginPath();
      ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = `${neuronSize / 3}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(activation.toFixed(2), x, y);
    });
  });

  // Desenha conexões
  ctx.globalAlpha = 0.85; // Transparência para conexões
  genome.connections.forEach(conn => {
    if (conn.from.type === 'input' || conn.from.type === 'hidden') {
      const fromLayerIndex = layers.findIndex(layer => layer.includes(conn.from));
      const toLayerIndex = layers.findIndex(layer => layer.includes(conn.to));
      const fromPositionIndex = layers[fromLayerIndex].indexOf(conn.from);
      const toPositionIndex = layers[toLayerIndex].indexOf(conn.to);

      const fromPosition = layerPositions[fromLayerIndex][fromPositionIndex];
      const toPosition = layerPositions[toLayerIndex][toPositionIndex];

      ctx.beginPath();
      ctx.moveTo(fromPosition.x + neuronRadius, fromPosition.y);
      ctx.lineTo(toPosition.x - neuronRadius, toPosition.y);

      ctx.strokeStyle = 'rgba(0, 0, 0, 1)'; // Preta para conexões
      ctx.lineWidth = 1; // Espessura da linha
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1; // Resetar transparência após desenhar
}

function updateNetworkVisualization(genome) {
  const canvas = document.getElementById("network-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawNetwork(ctx, genome, 20, 20, 20);
}
