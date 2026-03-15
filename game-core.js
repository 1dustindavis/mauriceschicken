(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ChickenClickerCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_PRODUCERS = [
    { id: "nest", name: "Nest", baseCost: 15, eps: 0.1, owned: 0, blurb: "A cozy nest lays eggs slowly." },
    { id: "hen", name: "Hen", baseCost: 100, eps: 1, owned: 0, blurb: "A hardworking hen lays eggs all day." },
    { id: "coop", name: "Coop", baseCost: 1100, eps: 8, owned: 0, blurb: "A full coop of hens speeds production." },
    { id: "farm", name: "Chicken Farm", baseCost: 12000, eps: 47, owned: 0, blurb: "Poultry power." },
    { id: "hatchery", name: "Hatchery", baseCost: 130000, eps: 260, owned: 0, blurb: "Hatch chicks, grow output fast." },
    {
      id: "maurice",
      name: "Maurice",
      baseCost: 5000000,
      costMultiplier: 2,
      eps: 12000,
      owned: 0,
      blurb: "A farmer with a suspiciously polished supply chain. What's he going to do with all these chickens?",
      secret: true,
      unlockAtLifetimeEggs: 2500000,
    },
  ];

  const DEFAULT_NUGGET_UPGRADES = [
    {
      id: "fryer",
      name: "Auto Fryer",
      baseCost: 75,
      nps: 0.3,
      owned: 0,
      paused: false,
      blurb: "Entry-level fryer drums out small batches.",
    },
    {
      id: "belt",
      name: "Conveyor Belt",
      baseCost: 500,
      nps: 1.7,
      owned: 0,
      paused: false,
      blurb: "Moves trays continuously through the oil.",
    },
    {
      id: "vat",
      name: "Industrial Vat",
      baseCost: 4000,
      nps: 9,
      owned: 0,
      paused: false,
      blurb: "Massive vats for serious nugget throughput.",
    },
    {
      id: "line",
      name: "Mega Line",
      baseCost: 25000,
      nps: 38,
      owned: 0,
      paused: false,
      blurb: "Full production line built for scale.",
    },
    {
      id: "reactor",
      name: "Golden Reactor",
      baseCost: 180000,
      nps: 170,
      owned: 0,
      paused: false,
      blurb: "Turns egg surplus into premium nugget flow.",
    },
  ];

  function createDefaultProducers() {
    return DEFAULT_PRODUCERS.map((item) => ({ ...item }));
  }

  function createDefaultNuggetUpgrades() {
    return DEFAULT_NUGGET_UPGRADES.map((item) => ({ ...item }));
  }

  function createInitialState() {
    return {
      eggs: 0,
      lifetimeEggs: 0,
      eggsPerClick: 1,
      totalClicks: 0,
      nuggets: 0,
      totalNuggets: 0,
      totalFlameClicks: 0,
      totalNuggetUpgradesPurchased: 0,
      revealedSecrets: 0,
      lastTick: Date.now(),
    };
  }

  function producerCost(item) {
    const growth = item.costMultiplier || 1.15;
    return Math.floor(item.baseCost * Math.pow(growth, item.owned));
  }

  function totalEps(producers) {
    return producers.reduce((sum, item) => sum + item.eps * item.owned, 0);
  }

  function getProducerOwned(producers, id) {
    const producer = producers.find((item) => item.id === id);
    return producer ? producer.owned : 0;
  }

  function isNuggetSectionUnlocked(producers) {
    return getProducerOwned(producers, "maurice") > 0;
  }

  function isUnlocked(item, state) {
    if (!item.secret) return true;
    return state.lifetimeEggs >= item.unlockAtLifetimeEggs;
  }

  function countRevealedSecrets(producers, state) {
    return producers.filter((item) => item.secret && isUnlocked(item, state)).length;
  }

  function applyClick(state) {
    state.eggs += state.eggsPerClick;
    state.lifetimeEggs += state.eggsPerClick;
    state.totalClicks += 1;

    if (state.totalClicks >= 1000) state.eggsPerClick = 10;
    else if (state.totalClicks >= 250) state.eggsPerClick = 5;
    else if (state.totalClicks >= 50) state.eggsPerClick = 2;
  }

  function applyPassiveGain(state, producers, seconds) {
    const gain = totalEps(producers) * seconds;
    state.eggs += gain;
    state.lifetimeEggs += gain;
    return gain;
  }

  function nuggetUpgradeCost(item) {
    return Math.floor(item.baseCost * Math.pow(1.2, item.owned));
  }

  function totalNps(upgrades) {
    return upgrades.reduce((sum, item) => {
      if (item.paused) return sum;
      return sum + item.nps * item.owned;
    }, 0);
  }

  function flameEggCost(state) {
    return Math.floor(
      30 +
      state.totalFlameClicks * 1.2 +
      state.totalNuggetUpgradesPurchased * 2
    );
  }

  function flameNuggetYield(state) {
    const base = 1 + Math.floor(state.totalFlameClicks / 25) * 0.2;
    return base;
  }

  function clickFlame(state, producers) {
    const eggCost = flameEggCost(state);
    if (state.eggs < eggCost) return false;

    const gain = flameNuggetYield(state);
    state.eggs -= eggCost;
    state.nuggets += gain;
    state.totalNuggets += gain;
    state.totalFlameClicks += 1;
    return true;
  }

  function buyNuggetUpgrade(state, upgrades, id) {
    const item = upgrades.find((entry) => entry.id === id);
    if (!item) return false;

    const cost = nuggetUpgradeCost(item);
    if (state.nuggets < cost) return false;

    state.nuggets -= cost;
    item.owned += 1;
    state.totalNuggetUpgradesPurchased += 1;
    return true;
  }

  function applyNuggetPassiveGain(state, eggProducers, upgrades, seconds) {
    const potentialGain = totalNps(upgrades) * seconds;
    if (potentialGain <= 0) return 0;

    const eggCost = flameEggCost(state);
    const maxAffordableGain = state.eggs / eggCost;
    const gain = Math.min(potentialGain, maxAffordableGain);
    if (gain <= 0) return 0;

    state.eggs -= gain * eggCost;
    state.nuggets += gain;
    state.totalNuggets += gain;
    return gain;
  }

  function buyProducer(state, producers, id) {
    const item = producers.find((entry) => entry.id === id);
    if (!item) return false;
    if (!isUnlocked(item, state)) return false;

    const cost = producerCost(item);
    if (state.eggs < cost) return false;

    state.eggs -= cost;
    item.owned += 1;
    return true;
  }

  return {
    DEFAULT_PRODUCERS,
    DEFAULT_NUGGET_UPGRADES,
    createDefaultProducers,
    createDefaultNuggetUpgrades,
    createInitialState,
    producerCost,
    totalEps,
    getProducerOwned,
    isNuggetSectionUnlocked,
    isUnlocked,
    countRevealedSecrets,
    applyClick,
    applyPassiveGain,
    nuggetUpgradeCost,
    totalNps,
    flameEggCost,
    flameNuggetYield,
    clickFlame,
    buyNuggetUpgrade,
    applyNuggetPassiveGain,
    buyProducer,
  };
});
