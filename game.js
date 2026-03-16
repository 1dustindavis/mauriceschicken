const SAVE_KEY = "chicken_clicker_save_v1";

const {
  createDefaultProducers,
  createDefaultNuggetUpgrades,
  createInitialState,
  producerCost,
  totalEps,
  isNuggetSectionUnlocked,
  isUnlocked,
  countRevealedSecrets,
  applyClick,
  applyPassiveGain,
  nuggetUpgradeCost,
  totalNps,
  flameEggCost,
  clickFlame: applyFlameClick,
  buyNuggetUpgrade,
  applyNuggetPassiveGain,
  buyProducer,
} = window.ChickenClickerCore;

const producers = createDefaultProducers();
const nuggetUpgrades = createDefaultNuggetUpgrades();
const state = createInitialState();
let autosaveTimerId;
let isResetting = false;

const eggsEl = document.getElementById("eggs");
const epsEl = document.getElementById("eps");
const eggSpendStatEl = document.getElementById("egg-spend-stat");
const eggSpendEl = document.getElementById("egg-spend");
const storeListEl = document.getElementById("store-list");
const chickenBtn = document.getElementById("chicken");
const resetBtn = document.getElementById("reset");
const nestVisualEl = document.getElementById("nest-visual");
const henVisualEl = document.getElementById("hen-visual");
const upgradeVisualsEl = document.getElementById("upgrade-visuals");
const eggParticlesEl = document.getElementById("egg-particles");

const nuggetSectionEl = document.getElementById("nugget-section");
const nuggetStatusEl = document.querySelector(".nugget-status");
const nuggetHeadEl = document.querySelector(".nugget-head");
const nuggetsEl = document.getElementById("nuggets");
const npsEl = document.getElementById("nps");
const flameCostEl = document.getElementById("flame-cost");
const flameBtn = document.getElementById("flame-btn");
const forgeVisualsEl = document.getElementById("forge-visuals");
const nuggetParticlesEl = document.getElementById("nugget-particles");
const nuggetStoreListEl = document.getElementById("nugget-store-list");
const eggStatusEl = document.querySelector(".status");
let nuggetBarRafPending = false;

function formatNumber(value, options = {}) {
  const { preserveFractionBelowTen = false } = options;
  const absValue = Math.abs(value);
  const units = ["", "K", "M", "B", "T", "Qa", "Qi"];
  let unitIndex = 0;

  if (absValue >= 100000) {
    unitIndex = 1;
    while (
      unitIndex < units.length - 1 &&
      absValue >= Math.pow(1000, unitIndex + 1)
    ) {
      unitIndex += 1;
    }
  }

  if (unitIndex === 0) {
    if (preserveFractionBelowTen && absValue < 10) {
      return value.toFixed(1);
    }
    return Math.floor(value).toLocaleString("en-US");
  }

  const scaled = value / Math.pow(1000, unitIndex);
  let decimals = Math.abs(scaled) >= 100 ? 0 : 1;
  if (units[unitIndex] === "M" && Math.abs(scaled) < 100) {
    decimals = 2;
  }

  const factor = Math.pow(10, decimals);
  const rounded =
    scaled >= 0
      ? Math.floor(scaled * factor) / factor
      : Math.ceil(scaled * factor) / factor;

  const scaledText =
    Math.abs(rounded) >= 1000
      ? rounded.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : rounded.toFixed(decimals);
  return `${scaledText}${units[unitIndex]}`;
}

function formatProducerRate(value) {
  if (Number.isInteger(value)) {
    return formatNumber(value);
  }

  if (Math.abs(value) < 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  return formatNumber(value, { preserveFractionBelowTen: true });
}

function formatRawNumber(value, maxFractionDigits = 1) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

function maybeSetRawTooltip(element, formattedValue, rawValue, maxFractionDigits = 1) {
  if (/[A-Za-z]/.test(formattedValue)) {
    element.title = formatRawNumber(rawValue, maxFractionDigits);
  } else {
    element.removeAttribute("title");
  }
}

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildIconPile(count, icon, options = {}) {
  const {
    maxIcons = 24,
    width = 160,
    height = 44,
    seed = 1,
    sizeClass = "",
    spillX = 6,
    spillY = 4,
    zScale = 10,
    zCap = 9999,
  } = options;

  if (count <= 0) return "";
  const shown = Math.min(count, maxIcons);
  let html = `<span class="icon-pile ${sizeClass}" style="--pile-w:${width}px; --pile-h:${height}px;">`;

  for (let i = 0; i < shown; i += 1) {
    const xRand = pseudoRandom(seed * 97.13 + i * 12.9898);
    const yRand = pseudoRandom(seed * 57.31 + i * 78.233);
    const rRand = pseudoRandom(seed * 13.17 + i * 45.164);
    const sRand = pseudoRandom(seed * 71.83 + i * 19.191);

    const maxX = Math.max(4, width - 26);
    const maxY = Math.max(4, height - 26);
    const x = Math.round(-spillX + xRand * (maxX + spillX * 2));
    const y = Math.round(-spillY + (1 - Math.pow(yRand, 1.8)) * (maxY + spillY * 2));
    const rotation = Math.round((rRand - 0.5) * 28);
    const scale = (0.82 + sRand * 0.38).toFixed(2);
    const layer = Math.min(zCap, Math.round(y * zScale) + i);

    html += `<span class="pile-icon" style="--x:${x}px; --y:${y}px; --r:${rotation}deg; --s:${scale}; z-index:${layer};">${icon}</span>`;
  }

  html += "</span>";
  return html;
}

function renderStore() {
  storeListEl.innerHTML = "";

  for (const item of producers) {
    const unlocked = isUnlocked(item, state);
    const cost = producerCost(item);
    const canBuy = unlocked && state.eggs >= cost;

    const li = document.createElement("li");
    li.className = "item";

    const left = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = unlocked ? `${item.name} (${item.owned})` : "??? (Secret Upgrade)";

    const desc = document.createElement("p");
    if (unlocked) {
      const rateText = formatProducerRate(item.eps);
      const blurbText =
        item.id === "maurice" && item.owned >= 2
          ? "Slow down Maurice!!"
          : item.blurb;
      desc.textContent = `${blurbText} +${rateText} eggs/s`;
      maybeSetRawTooltip(desc, rateText, item.eps, 2);
    } else {
      const revealText = formatNumber(item.unlockAtLifetimeEggs);
      desc.textContent = `Details hidden. Reveal at ${revealText} lifetime eggs.`;
      maybeSetRawTooltip(desc, revealText, item.unlockAtLifetimeEggs, 0);
    }

    left.appendChild(title);
    left.appendChild(desc);

    const buy = document.createElement("button");
    buy.className = "buy";
    buy.disabled = !canBuy;

    if (unlocked) {
      const buyText = formatNumber(cost);
      buy.textContent = `Buy ${buyText}`;
      maybeSetRawTooltip(buy, buyText, cost, 0);
    } else {
      buy.textContent = "Locked";
      buy.removeAttribute("title");
    }

    buy.addEventListener("click", () => {
      if (buyProducer(state, producers, item.id)) {
        render();
        save();
      }
    });

    li.appendChild(left);
    li.appendChild(buy);
    storeListEl.appendChild(li);
  }
}

function getStoreSignature() {
  return producers
    .map((item) => {
      const unlocked = isUnlocked(item, state);
      const canBuy = unlocked && state.eggs >= producerCost(item);
      return `${item.id}:${unlocked ? 1 : 0}:${canBuy ? 1 : 0}`;
    })
    .join("|");
}

function getNuggetStoreSignature() {
  const unlocked = isNuggetSectionUnlocked(producers);
  if (!unlocked) return "locked";

  const flameCost = flameEggCost(state);
  const canFlame = state.eggs >= flameCost;
  const parts = [`f:${canFlame ? 1 : 0}`];

  for (const item of nuggetUpgrades) {
    const canBuy = state.nuggets >= nuggetUpgradeCost(item);
    parts.push(`${item.id}:${canBuy ? 1 : 0}`);
  }
  return parts.join("|");
}

function renderStats() {
  const eggsText = formatNumber(state.eggs);
  eggsEl.textContent = eggsText;
  maybeSetRawTooltip(eggsEl, eggsText, state.eggs, 1);

  const epsValue = totalEps(producers);
  const epsText = formatNumber(epsValue, { preserveFractionBelowTen: true });
  epsEl.textContent = epsText;
  maybeSetRawTooltip(epsEl, epsText, epsValue, 2);

  const nuggetPerSecond = totalNps(nuggetUpgrades);
  const showEggSpend = Number(nuggetPerSecond.toFixed(6)) > 1;
  eggSpendStatEl.hidden = !showEggSpend;
  eggStatusEl.classList.toggle("has-spend", showEggSpend);

  if (showEggSpend) {
    const cost = flameEggCost(state);
    const affordableNps = Math.min(nuggetPerSecond, state.eggs / cost);
    const spendPerSecond = Math.max(0, affordableNps * cost);
    const spendText = formatNumber(spendPerSecond, { preserveFractionBelowTen: true });
    eggSpendEl.textContent = spendText;
    maybeSetRawTooltip(eggSpendEl, spendText, spendPerSecond, 2);
  } else {
    eggSpendEl.removeAttribute("title");
  }
}

function renderNuggetStats() {
  const nuggetText = formatNumber(state.nuggets);
  nuggetsEl.textContent = nuggetText;
  maybeSetRawTooltip(nuggetsEl, nuggetText, state.nuggets, 1);

  const npsValue = totalNps(nuggetUpgrades);
  const npsText = formatNumber(npsValue, { preserveFractionBelowTen: true });
  npsEl.textContent = npsText;
  maybeSetRawTooltip(npsEl, npsText, npsValue, 2);

  const flameCostValue = flameEggCost(state);
  const flameCostText = `${formatNumber(flameCostValue)} eggs`;
  flameCostEl.textContent = flameCostText;
  maybeSetRawTooltip(flameCostEl, flameCostText, flameCostValue, 0);

  const canFlame = state.eggs >= flameCostValue;
  flameBtn.classList.toggle("disabled", !canFlame);
  flameBtn.disabled = !canFlame;
}

function renderNuggetStore() {
  nuggetStoreListEl.innerHTML = "";

  for (const item of nuggetUpgrades) {
    const cost = nuggetUpgradeCost(item);
    const canBuy = state.nuggets >= cost;

    const li = document.createElement("li");
    li.className = "nugget-item";

    const left = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = `${item.name} (${item.owned})`;

    const desc = document.createElement("p");
    const rateText = formatProducerRate(item.nps);
    desc.textContent = `${item.blurb} +${rateText} nuggets/s`;
    maybeSetRawTooltip(desc, rateText, item.nps, 2);

    left.appendChild(title);
    left.appendChild(desc);

    const buy = document.createElement("button");
    buy.className = "nugget-buy";
    buy.disabled = !canBuy;

    const buyText = formatNumber(cost);
    buy.textContent = `Buy ${buyText}`;
    maybeSetRawTooltip(buy, buyText, cost, 0);

    buy.addEventListener("click", () => {
      if (buyNuggetUpgrade(state, nuggetUpgrades, item.id)) {
        renderNuggetStats();
        renderNuggetStore();
        renderForgeVisuals();
        state.nuggetStoreSignature = getNuggetStoreSignature();
        save();
      }
    });

    const controls = document.createElement("div");
    controls.className = "nugget-controls";
    if (item.owned > 0) {
      const pause = document.createElement("button");
      pause.type = "button";
      pause.className = "nugget-pause";
      pause.setAttribute("aria-label", item.paused ? `Resume ${item.name}` : `Pause ${item.name}`);
      pause.title = item.paused ? "Resume production" : "Pause production";
      pause.textContent = item.paused ? "▶" : "⏸";
      pause.addEventListener("click", () => {
        item.paused = !item.paused;
        renderNuggetStats();
        renderNuggetStore();
        renderForgeVisuals();
        state.nuggetStoreSignature = getNuggetStoreSignature();
        save();
      });
      controls.appendChild(pause);
    } else {
      const pauseSlot = document.createElement("span");
      pauseSlot.className = "nugget-pause-slot";
      pauseSlot.setAttribute("aria-hidden", "true");
      controls.appendChild(pauseSlot);
    }
    controls.appendChild(buy);

    li.appendChild(left);
    li.appendChild(controls);
    nuggetStoreListEl.appendChild(li);
  }
}

function renderUpgradeVisuals() {
  const visualMap = [
    { id: "coop", label: "Coops", icon: "🏠", seed: 11 },
    { id: "farm", label: "Farms", icon: "🌾", seed: 17 },
    { id: "hatchery", label: "Hatcheries", icon: "🧪", seed: 23 },
    { id: "maurice", label: "Maurice", icon: "👨‍🌾", seed: 29 },
  ];

  let rows = "";
  for (const entry of visualMap) {
    const producer = producers.find((item) => item.id === entry.id);
    if (!producer || producer.owned <= 0) continue;

    rows += `
      <div class="upgrade-row">
        <span class="upgrade-label">${entry.label}</span>
        <span class="upgrade-icons">${buildIconPile(producer.owned, entry.icon, {
          maxIcons: 26,
          width: 132,
          height: 36,
          seed: entry.seed,
          sizeClass: "pile-upgrade",
          spillX: 4,
          spillY: 3,
        })}</span>
      </div>
    `;
  }

  upgradeVisualsEl.innerHTML = rows;
}

function renderNestVisual() {
  const nestProducer = producers.find((item) => item.id === "nest");
  const nestCount = nestProducer ? nestProducer.owned : 0;
  const nestScale = 1 + Math.min(nestCount, 20) * 0.045;
  nestVisualEl.style.setProperty("--nest-scale", nestScale.toFixed(3));

  nestVisualEl.setAttribute("aria-label", `Nest level ${nestCount}`);
  const eggCount = Math.max(1, Math.floor(nestCount * 0.9) + 1);
  const sparkle = nestCount >= 10 ? '<span class="nest-sparkle">✨</span>' : "";
  nestVisualEl.innerHTML = `
    <span class="nest-egg-slot">
      ${buildIconPile(eggCount, "🥚", {
        maxIcons: 90,
        width: 140,
        height: 62,
        seed: 41,
        sizeClass: "pile-nest-eggs",
        spillX: 9,
        spillY: 7,
      })}
      ${sparkle}
    </span>
  `;
}

function renderHenVisual() {
  const henProducer = producers.find((item) => item.id === "hen");
  const henCount = henProducer ? henProducer.owned : 0;
  henVisualEl.innerHTML = buildIconPile(henCount, "🐔", {
    maxIcons: 40,
    width: 420,
    height: 90,
    seed: 7,
    sizeClass: "pile-hens",
    spillX: 8,
    spillY: 6,
  });
}

function renderFarmVisuals() {
  renderNestVisual();
  renderHenVisual();
  renderUpgradeVisuals();
}

function renderForgeVisuals() {
  const visualMap = [
    { id: "fryer", label: "Fryers", icon: "🍳", seed: 51 },
    { id: "belt", label: "Belts", icon: "🧰", seed: 57 },
    { id: "vat", label: "Vats", icon: "🛢️", seed: 63 },
    { id: "line", label: "Lines", icon: "⚙️", seed: 69 },
    { id: "reactor", label: "Reactors", icon: "🟠", seed: 75 },
  ];

  let cards = "";
  for (const entry of visualMap) {
    const upgrade = nuggetUpgrades.find((item) => item.id === entry.id);
    if (!upgrade) continue;

    const moduleClass = upgrade.owned > 0 ? "forge-module active" : "forge-module idle";
    const pausedClass = upgrade.paused ? "paused" : "";
    cards += `
      <article class="${moduleClass} ${pausedClass}">
        <header class="forge-module-head">
          <span class="forge-label">${entry.label}</span>
          <span class="forge-count">${upgrade.owned}${upgrade.paused ? " · Paused" : ""}</span>
        </header>
        <div class="forge-lane">
          ${buildIconPile(Math.max(upgrade.owned, 1), entry.icon, {
            maxIcons: 24,
            width: 210,
            height: 46,
            seed: entry.seed,
            sizeClass: "pile-forge",
            spillX: upgrade.owned > 0 ? 2 : 0,
            spillY: 0,
            zScale: 1,
            zCap: 40,
          })}
        </div>
      </article>
    `;
  }

  if (!cards) {
    cards = `
      <article class="forge-module idle">
        <header class="forge-module-head">
          <span class="forge-label">Idle Line</span>
          <span class="forge-count">0</span>
        </header>
        <div class="forge-lane">
          ${buildIconPile(1, "⚙️", {
            maxIcons: 1,
            width: 210,
            height: 46,
            seed: 44,
            sizeClass: "pile-forge",
            spillX: 0,
            spillY: 0,
            zScale: 1,
            zCap: 40,
          })}
        </div>
      </article>
    `;
  }

  forgeVisualsEl.innerHTML = `
    <div class="forge-grid">
      ${cards}
    </div>
    <div class="forge-conveyor" aria-hidden="true">
      <span class="conveyor-belt"></span>
      <span class="conveyor-warning"></span>
    </div>
  `;
}

function renderNuggetSection() {
  const unlocked = isNuggetSectionUnlocked(producers);
  nuggetSectionEl.classList.toggle("hidden", !unlocked);
  state.nuggetUnlocked = unlocked;
  if (!unlocked) {
    nuggetStatusEl.classList.remove("is-floating-top", "is-floating-bottom");
    nuggetSectionEl.classList.remove("has-floating-nugget-top");
    return;
  }

  renderNuggetStats();
  renderNuggetStore();
  renderForgeVisuals();
  queueNuggetBarPositionUpdate();
}

function render() {
  state.revealedSecrets = countRevealedSecrets(producers, state);
  state.storeSignature = getStoreSignature();
  state.nuggetStoreSignature = getNuggetStoreSignature();

  renderStats();
  renderStore();
  renderFarmVisuals();
  renderNuggetSection();
  queueNuggetBarPositionUpdate();
}

function updateNuggetBarPosition() {
  if (!state.nuggetUnlocked) return;

  const sectionRect = nuggetSectionEl.getBoundingClientRect();
  const eggBarHeight = eggStatusEl.getBoundingClientRect().height;
  const nuggetHeadHeight = nuggetHeadEl ? nuggetHeadEl.getBoundingClientRect().height : 0;
  const topOffset = Math.round(eggBarHeight + 20);
  const naturalBarTop = sectionRect.top + nuggetHeadHeight + 12;

  nuggetStatusEl.style.setProperty("--nugget-float-left", `${Math.round(sectionRect.left)}px`);
  nuggetStatusEl.style.setProperty("--nugget-float-width", `${Math.round(sectionRect.width)}px`);
  nuggetStatusEl.style.setProperty("--nugget-float-top", `${topOffset}px`);

  const barHeight = nuggetStatusEl.getBoundingClientRect().height;
  const bottomOffset = 10;
  const bottomDockTop = window.innerHeight - barHeight - bottomOffset;
  const shouldFloatTop = naturalBarTop <= topOffset;
  const shouldFloatBottom = naturalBarTop > bottomDockTop;
  const hasNuggetProgress = state.totalNuggets > 1;

  nuggetStatusEl.classList.toggle("is-floating-top", shouldFloatTop);
  nuggetStatusEl.classList.toggle(
    "is-floating-bottom",
    !shouldFloatTop && shouldFloatBottom && hasNuggetProgress
  );
  nuggetSectionEl.classList.toggle("has-floating-nugget-top", shouldFloatTop);
}

function queueNuggetBarPositionUpdate() {
  if (nuggetBarRafPending) return;
  nuggetBarRafPending = true;
  requestAnimationFrame(() => {
    nuggetBarRafPending = false;
    updateNuggetBarPosition();
  });
}

function spawnEggParticles(event) {
  const particleRect = eggParticlesEl.getBoundingClientRect();
  const chickenRect = chickenBtn.getBoundingClientRect();
  const hasPointer =
    event &&
    typeof event.clientX === "number" &&
    typeof event.clientY === "number";
  const originX = hasPointer ? event.clientX : chickenRect.left + chickenRect.width * 0.5;
  const originY = hasPointer ? event.clientY : chickenRect.top + chickenRect.height * 0.35;

  for (let i = 0; i < 3; i += 1) {
    const egg = document.createElement("span");
    egg.className = "egg-pop";
    egg.textContent = "🥚";

    const dx = Math.round((Math.random() * 120 + 40) * (Math.random() > 0.5 ? 1 : -1));
    const arcLift = Math.round(Math.random() * 90 + 80);
    const dy = Math.round(Math.random() * 45 + 20);
    const mx = Math.round(dx * 0.45);
    const my = -arcLift;
    const duration = Math.round(Math.random() * 350 + 1200);

    egg.style.left = `${originX - particleRect.left - 8}px`;
    egg.style.top = `${originY - particleRect.top - 8}px`;
    egg.style.setProperty("--mx", `${mx}px`);
    egg.style.setProperty("--my", `${my}px`);
    egg.style.setProperty("--dx", `${dx}px`);
    egg.style.setProperty("--dy", `${dy}px`);
    egg.style.animationDuration = `${duration}ms`;

    egg.addEventListener("animationend", () => egg.remove(), { once: true });
    eggParticlesEl.appendChild(egg);
  }
}

function spawnNuggetParticles(event) {
  const particleRect = nuggetParticlesEl.getBoundingClientRect();
  const flameRect = flameBtn.getBoundingClientRect();
  const hasPointer =
    event &&
    typeof event.clientX === "number" &&
    typeof event.clientY === "number";
  const originX = hasPointer ? event.clientX : flameRect.left + flameRect.width * 0.5;
  const originY = hasPointer ? event.clientY : flameRect.top + flameRect.height * 0.35;

  for (let i = 0; i < 3; i += 1) {
    const nugget = document.createElement("span");
    nugget.className = "nugget-pop";
    nugget.textContent = "🍗";

    const dx = Math.round((Math.random() * 90 + 30) * (Math.random() > 0.5 ? 1 : -1));
    const mx = Math.round(dx * 0.4);
    const my = -Math.round(Math.random() * 70 + 40);
    const dy = Math.round(Math.random() * 45 + 20);

    nugget.style.left = `${originX - particleRect.left - 8}px`;
    nugget.style.top = `${originY - particleRect.top - 8}px`;
    nugget.style.setProperty("--mx", `${mx}px`);
    nugget.style.setProperty("--my", `${my}px`);
    nugget.style.setProperty("--dx", `${dx}px`);
    nugget.style.setProperty("--dy", `${dy}px`);

    nugget.addEventListener("animationend", () => nugget.remove(), { once: true });
    nuggetParticlesEl.appendChild(nugget);
  }
}

function clickChicken(event) {
  applyClick(state);
  spawnEggParticles(event);
  chickenBtn.classList.add("clicked");
  setTimeout(() => chickenBtn.classList.remove("clicked"), 90);

  const revealedSecrets = countRevealedSecrets(producers, state);
  const storeSignature = getStoreSignature();
  const nuggetStoreSignature = getNuggetStoreSignature();

  if (revealedSecrets !== state.revealedSecrets || state.nuggetUnlocked !== isNuggetSectionUnlocked(producers)) {
    render();
    return;
  }

  renderStats();
  if (storeSignature !== state.storeSignature) {
    state.storeSignature = storeSignature;
    renderStore();
  }

  if (state.nuggetUnlocked) {
    renderNuggetStats();
    if (nuggetStoreSignature !== state.nuggetStoreSignature) {
      state.nuggetStoreSignature = nuggetStoreSignature;
      renderNuggetStore();
    }
    queueNuggetBarPositionUpdate();
  }
}

function clickFlame(event) {
  if (!isNuggetSectionUnlocked(producers)) return;
  if (!applyFlameClick(state, producers)) return;

  spawnNuggetParticles(event);
  renderStats();
  renderNuggetStats();

  const storeSignature = getStoreSignature();
  if (storeSignature !== state.storeSignature) {
    state.storeSignature = storeSignature;
    renderStore();
  }

  const nuggetStoreSignature = getNuggetStoreSignature();
  if (nuggetStoreSignature !== state.nuggetStoreSignature) {
    state.nuggetStoreSignature = nuggetStoreSignature;
    renderNuggetStore();
  }
  queueNuggetBarPositionUpdate();
}

function tick() {
  const now = Date.now();
  const dt = (now - state.lastTick) / 1000;
  state.lastTick = now;

  const eggGain = totalEps(producers) > 0 ? applyPassiveGain(state, producers, dt) : 0;
  const nuggetGain = isNuggetSectionUnlocked(producers)
    ? applyNuggetPassiveGain(state, producers, nuggetUpgrades, dt)
    : 0;

  if (eggGain > 0 || nuggetGain > 0) {
    const revealedSecrets = countRevealedSecrets(producers, state);
    const storeSignature = getStoreSignature();
    const nuggetUnlocked = isNuggetSectionUnlocked(producers);
    const nuggetStoreSignature = getNuggetStoreSignature();

    if (revealedSecrets !== state.revealedSecrets || nuggetUnlocked !== state.nuggetUnlocked) {
      render();
    } else {
      renderStats();
      if (storeSignature !== state.storeSignature) {
        state.storeSignature = storeSignature;
        renderStore();
      }

      if (nuggetUnlocked) {
        renderNuggetStats();
        if (nuggetStoreSignature !== state.nuggetStoreSignature) {
          state.nuggetStoreSignature = nuggetStoreSignature;
          renderNuggetStore();
        }
        queueNuggetBarPositionUpdate();
      }
    }
  }

  requestAnimationFrame(tick);
}

function save() {
  if (isResetting) return;

  const payload = {
    eggs: state.eggs,
    lifetimeEggs: state.lifetimeEggs,
    eggsPerClick: state.eggsPerClick,
    totalClicks: state.totalClicks,
    nuggets: state.nuggets,
    totalNuggets: state.totalNuggets,
    totalFlameClicks: state.totalFlameClicks,
    totalNuggetUpgradesPurchased: state.totalNuggetUpgradesPurchased,
    lastSaved: Date.now(),
    producers: producers.map((item) => ({ id: item.id, owned: item.owned })),
    nuggetUpgrades: nuggetUpgrades.map((item) => ({
      id: item.id,
      owned: item.owned,
      paused: item.paused,
    })),
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.eggs = Number(parsed.eggs) || 0;
    state.lifetimeEggs = Number(parsed.lifetimeEggs) || state.eggs;
    state.eggsPerClick = Number(parsed.eggsPerClick) || 1;
    state.totalClicks = Number(parsed.totalClicks) || 0;
    state.nuggets = Number(parsed.nuggets) || 0;
    state.totalNuggets = Number(parsed.totalNuggets) || state.nuggets;
    state.totalFlameClicks = Number(parsed.totalFlameClicks) || 0;
    state.totalNuggetUpgradesPurchased = Number(parsed.totalNuggetUpgradesPurchased) || 0;

    if (Array.isArray(parsed.producers)) {
      for (const saved of parsed.producers) {
        const item = producers.find((entry) => entry.id === saved.id);
        if (item) item.owned = Math.max(0, Number(saved.owned) || 0);
      }
    }

    if (Array.isArray(parsed.nuggetUpgrades)) {
      for (const saved of parsed.nuggetUpgrades) {
        const item = nuggetUpgrades.find((entry) => entry.id === saved.id);
        if (item) {
          item.owned = Math.max(0, Number(saved.owned) || 0);
          item.paused = Boolean(saved.paused);
        }
      }
    }

    if (parsed.lastSaved) {
      const elapsed = Math.max(0, Date.now() - Number(parsed.lastSaved)) / 1000;
      const cappedElapsed = Math.min(elapsed, 60 * 60 * 8);
      applyPassiveGain(state, producers, cappedElapsed);
      applyNuggetPassiveGain(state, producers, nuggetUpgrades, cappedElapsed);
    }
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }
}

function resetSave() {
  isResetting = true;
  if (autosaveTimerId) clearInterval(autosaveTimerId);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  localStorage.removeItem(SAVE_KEY);

  const freshState = createInitialState();
  for (const key of Object.keys(freshState)) {
    state[key] = freshState[key];
  }
  for (const item of producers) {
    item.owned = 0;
  }
  for (const item of nuggetUpgrades) {
    item.owned = 0;
    item.paused = false;
  }

  eggParticlesEl.innerHTML = "";
  nuggetParticlesEl.innerHTML = "";

  isResetting = false;
  render();
  save();
  queueNuggetBarPositionUpdate();

  autosaveTimerId = setInterval(save, 5000);
  window.addEventListener("beforeunload", handleBeforeUnload);
}

function handleBeforeUnload() {
  save();
}

function handlePrimaryButtonPointerDown(handler) {
  return (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    handler(event);
  };
}

function handlePrimaryButtonKeyDown(handler) {
  return (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handler(event);
  };
}

chickenBtn.addEventListener("pointerdown", handlePrimaryButtonPointerDown(clickChicken));
flameBtn.addEventListener("pointerdown", handlePrimaryButtonPointerDown(clickFlame));
chickenBtn.addEventListener("keydown", handlePrimaryButtonKeyDown(clickChicken));
flameBtn.addEventListener("keydown", handlePrimaryButtonKeyDown(clickFlame));
resetBtn.addEventListener("click", resetSave);
autosaveTimerId = setInterval(save, 5000);
window.addEventListener("beforeunload", handleBeforeUnload);
window.addEventListener("scroll", queueNuggetBarPositionUpdate, { passive: true });
window.addEventListener("resize", queueNuggetBarPositionUpdate);

load();
render();
state.lastTick = Date.now();
tick();
