const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDefaultProducers,
  createDefaultNuggetUpgrades,
  createInitialState,
  producerCost,
  totalEps,
  isNuggetSectionUnlocked,
  flameEggCost,
  clickFlame,
  applyNuggetPassiveGain,
  buyNuggetUpgrade,
  applyClick,
  buyProducer,
} = require("../game-core.js");

test("clicking adds the correct amount and respects click milestones", () => {
  const state = createInitialState();

  for (let i = 0; i < 49; i += 1) {
    applyClick(state);
  }

  assert.equal(state.eggs, 49);
  assert.equal(state.eggsPerClick, 1);

  applyClick(state);
  assert.equal(state.eggs, 50);
  assert.equal(state.totalClicks, 50);
  assert.equal(state.eggsPerClick, 2);

  applyClick(state);
  assert.equal(state.eggs, 52);
});

test("buying a producer reduces eggs by cost but does not reset egg count", () => {
  const state = createInitialState();
  const producers = createDefaultProducers();

  const hen = producers.find((item) => item.id === "hen");
  const cost = producerCost(hen);

  state.eggs = 1000;
  const purchased = buyProducer(state, producers, "hen");

  assert.equal(purchased, true);
  assert.equal(state.eggs, 1000 - cost);
  assert.equal(state.eggs > 0, true);
  assert.equal(hen.owned, 1);
});

test("total EPS is calculated correctly across producer combinations", () => {
  const scenarios = [
    { owned: { nest: 1 }, expected: 0.1 },
    { owned: { nest: 10, hen: 2 }, expected: 3 },
    { owned: { coop: 3, farm: 1 }, expected: 71 },
    { owned: { hatchery: 4, maurice: 2 }, expected: 25040 },
    { owned: { nest: 3, hen: 5, coop: 2, farm: 1, hatchery: 1, maurice: 1 }, expected: 12328.3 },
  ];

  for (const scenario of scenarios) {
    const producers = createDefaultProducers();

    for (const item of producers) {
      item.owned = scenario.owned[item.id] || 0;
    }

    assert.equal(totalEps(producers), scenario.expected);
  }
});

test("nugget section unlocks only after owning Maurice", () => {
  const producers = createDefaultProducers();
  assert.equal(isNuggetSectionUnlocked(producers), false);

  const maurice = producers.find((item) => item.id === "maurice");
  maurice.owned = 1;
  assert.equal(isNuggetSectionUnlocked(producers), true);
});

test("flame click consumes eggs and adds nuggets", () => {
  const state = createInitialState();
  const producers = createDefaultProducers();

  state.eggs = 1000;
  const beforeEggs = state.eggs;
  const cost = flameEggCost(state);

  const clicked = clickFlame(state, producers);
  assert.equal(clicked, true);
  assert.equal(state.eggs, beforeEggs - cost);
  assert.equal(state.nuggets > 0, true);
  assert.equal(state.totalFlameClicks, 1);
});

test("nugget passive gain scales with nugget upgrades", () => {
  const lowState = createInitialState();
  const highState = createInitialState();
  lowState.eggs = 100000;
  highState.eggs = 100000;
  const upgradesA = createDefaultNuggetUpgrades();
  const upgradesB = createDefaultNuggetUpgrades();
  upgradesA.find((item) => item.id === "fryer").owned = 1;
  upgradesB.find((item) => item.id === "fryer").owned = 8;

  const eggProducers = createDefaultProducers();
  const lowGain = applyNuggetPassiveGain(lowState, eggProducers, upgradesA, 5);
  const highGain = applyNuggetPassiveGain(highState, eggProducers, upgradesB, 5);
  assert.equal(highGain > lowGain, true);
});

test("passive nugget generation consumes eggs", () => {
  const state = createInitialState();
  const eggProducers = createDefaultProducers();
  const upgrades = createDefaultNuggetUpgrades();

  state.eggs = 1000;
  eggProducers.find((item) => item.id === "hen").owned = 5;
  upgrades.find((item) => item.id === "fryer").owned = 4;

  const beforeEggs = state.eggs;
  const passiveFlameCost = flameEggCost(state);
  const gain = applyNuggetPassiveGain(state, eggProducers, upgrades, 2);

  assert.equal(gain > 0, true);
  assert.equal(state.eggs < beforeEggs, true);
  assert.equal(
    beforeEggs - state.eggs >= gain * passiveFlameCost - 1e-9,
    true
  );
});

test("paused nugget upgrades do not generate or spend", () => {
  const state = createInitialState();
  const eggProducers = createDefaultProducers();
  const upgrades = createDefaultNuggetUpgrades();

  state.eggs = 50000;
  eggProducers.find((item) => item.id === "hen").owned = 20;
  upgrades.find((item) => item.id === "fryer").owned = 10;
  upgrades.find((item) => item.id === "fryer").paused = true;

  const beforeEggs = state.eggs;
  const gain = applyNuggetPassiveGain(state, eggProducers, upgrades, 3);

  assert.equal(gain, 0);
  assert.equal(state.eggs, beforeEggs);
});

test("flame cost increases when buying nugget upgrades", () => {
  const state = createInitialState();
  const upgrades = createDefaultNuggetUpgrades();
  state.nuggets = 100000;

  const before = flameEggCost(state);
  const bought = buyNuggetUpgrade(state, upgrades, "fryer");
  const after = flameEggCost(state);

  assert.equal(bought, true);
  assert.equal(after > before, true);
});
