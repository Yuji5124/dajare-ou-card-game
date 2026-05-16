const SAVE_KEY = "dajare-ou-save-v1";
const OWNED_NORI = ["041", "042", "044", "047", "059"];
const state = {
  cards: [],
  owned: [],
  deck: [],
  enemy: null,
  battle: null
};

const $ = (id) => document.getElementById(id);

init();

async function init() {
  state.cards = await fetch("data/cards.json").then((res) => res.json());
  loadSave();
  bindEvents();
  show("titleScreen");
}

function bindEvents() {
  $("startBtn").addEventListener("click", () => show("enemyScreen"));
  $("enemyBtn").addEventListener("click", () => {
    state.enemy = { name: "はじめくん" };
    renderDeck();
    show("deckScreen");
  });
  $("autoDeckBtn").addEventListener("click", autoDeck);
  $("battleBtn").addEventListener("click", startBattle);
  $("judgeBtn").addEventListener("click", () => {
    if (state.battle?.selectedPun) resolveTurn();
  });
  $("resetBtn").addEventListener("click", resetSave);
  $("againBtn").addEventListener("click", () => {
    renderDeck();
    show("deckScreen");
  });
  $("homeBtn").addEventListener("click", () => show("titleScreen"));
  document.querySelectorAll(".back").forEach((button) => {
    button.addEventListener("click", () => show(button.dataset.to));
  });
}

function loadSave() {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
  if (saved) {
    state.owned = saved.owned || initialOwned();
    state.deck = saved.deck || [];
    return;
  }
  state.owned = initialOwned();
  state.deck = [];
  save();
}

function initialOwned() {
  return state.cards
    .filter((card) => card.type === "pun" ? card.power <= 6 : OWNED_NORI.includes(card.id))
    .map((card) => card.id);
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ owned: state.owned, deck: state.deck }));
}

function resetSave() {
  localStorage.removeItem(SAVE_KEY);
  state.owned = initialOwned();
  state.deck = [];
  save();
  $("battleLog").textContent = "セーブをリセットしました。";
  show("titleScreen");
}

function show(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  $(id).classList.add("active");
}

function renderDeck() {
  $("deckCount").textContent = `${state.deck.length} / 30`;
  $("cardList").innerHTML = "";
  state.cards.forEach((card) => {
    const owned = state.owned.includes(card.id);
    const inDeck = state.deck.includes(card.id);
    const node = cardNode(card, { locked: !owned, selected: inDeck });
    node.addEventListener("click", () => toggleDeck(card, owned));
    $("cardList").appendChild(node);
  });
}

function toggleDeck(card, owned) {
  if (!owned) return;
  const index = state.deck.indexOf(card.id);
  if (index >= 0) {
    state.deck.splice(index, 1);
  } else if (state.deck.length < 30) {
    state.deck.push(card.id);
  }
  save();
  renderDeck();
}

function autoDeck() {
  const ownedCards = cardsByIds(state.owned);
  const puns = ownedCards.filter((card) => card.type === "pun").sort((a, b) => b.power - a.power);
  const reactions = ownedCards.filter((card) => card.type === "reaction");
  state.deck = [...puns.slice(0, 25), ...reactions.slice(0, 5)].map((card) => card.id).slice(0, 30);
  save();
  renderDeck();
}

function startBattle() {
  if (state.deck.length !== 30) {
    $("deckCount").textContent = `${state.deck.length} / 30 にしてください`;
    return;
  }
  const playerDeck = shuffle(cardsByIds(state.deck));
  const enemyDeck = buildEnemyDeck();
  state.battle = {
    playerDeck,
    enemyDeck,
    playerHand: draw(playerDeck, 5),
    enemyHand: draw(enemyDeck, 5),
    playerScore: 0,
    enemyScore: 0,
    usedReaction: false,
    selectedPun: null,
    selectedReaction: null,
    nextBonus: 0
  };
  $("turnHint").textContent = "ダジャレ札を選択";
  $("judgeBtn").disabled = true;
  updateBattle("ダジャレ札を1枚えらんでください。ノリカードは1ターン1枚まで。");
  show("battleScreen");
}

function buildEnemyDeck() {
  const puns = state.cards.filter((card) => card.type === "pun").sort((a, b) => b.power - a.power);
  const reactions = state.cards.filter((card) => card.type === "reaction");
  return shuffle([...puns.slice(0, 20), ...puns.slice(20, 30), ...reactions.slice(0, 10)]).slice(0, 30);
}

function updateBattle(message) {
  const b = state.battle;
  $("playerScore").textContent = b.playerScore;
  $("enemyScore").textContent = b.enemyScore;
  $("battleLog").textContent = message;
  $("turnHint").textContent = "ダジャレ札を選択";
  $("judgeBtn").disabled = !b.selectedPun;
  renderPlayed("playerPlay", b.selectedPun, b.selectedReaction);
  renderPlayed("enemyPlay");
  renderHand();
}

function renderHand() {
  const b = state.battle;
  $("hand").innerHTML = "";
  b.playerHand.forEach((card) => {
    const selected = b.selectedPun?.id === card.id || b.selectedReaction?.id === card.id;
    const node = cardNode(card, { selected });
    if (card.type === "reaction" && b.usedReaction && !selected) node.disabled = true;
    node.addEventListener("click", () => playFromHand(card));
    $("hand").appendChild(node);
  });
}

function playFromHand(card) {
  const b = state.battle;
  if (card.type === "pun") {
    if (b.selectedPun?.id === card.id) {
      resolveTurn();
      return;
    }
    b.selectedPun = card;
  } else if (!b.usedReaction) {
    b.selectedReaction = card;
    b.usedReaction = true;
  }
  renderHand();
  renderPlayed("playerPlay", b.selectedPun, b.selectedReaction);
  if (b.selectedPun) {
    $("turnHint").textContent = b.usedReaction ? "同じダジャレ札で勝負" : "ノリカード任意";
    $("judgeBtn").disabled = false;
    $("battleLog").textContent = "ノリカードを使うなら1枚えらんでください。同じダジャレ札か勝負ボタンで判定します。";
  }
}

function resolveTurn() {
  const b = state.battle;
  const enemyPun = pickEnemyPun();
  const enemyReaction = pickEnemyReaction(enemyPun);
  let playerPower = b.selectedPun.power + b.nextBonus;
  let enemyPower = enemyPun.power;
  b.nextBonus = 0;

  const playerEffect = applyReaction(b.selectedReaction, playerPower, enemyPower);
  playerPower = playerEffect.self;
  enemyPower = playerEffect.enemy;

  const enemyEffect = applyReaction(enemyReaction, enemyPower, playerPower);
  enemyPower = enemyEffect.self;
  playerPower = enemyEffect.enemy;

  let message = `自分「${b.selectedPun.name}」${playerPower}P vs 相手「${enemyPun.name}」${enemyPower}P。`;
  if (b.selectedReaction) message += ` 自分は「${b.selectedReaction.name}」。`;
  if (enemyReaction) message += ` 相手は「${enemyReaction.name}」。`;

  if (b.selectedReaction?.id === "047") {
    playerPower = b.selectedPun.power + rand(1, 3);
    enemyPower = enemyPun.power + rand(0, 2);
    message += " 判定をやり直し。";
  }

  if (playerPower > enemyPower) {
    b.playerScore += 1;
    const won = stealCard();
    message += ` 勝ち！${won ? `「${won.name}」を入手。` : ""}`;
  } else if (playerPower < enemyPower) {
    b.enemyScore += 1;
    message += " 負け。";
  } else {
    message += " 引き分け。";
  }

  discardPlayed(enemyPun, enemyReaction);
  drawUp();
  renderPlayed("enemyPlay", enemyPun, enemyReaction);
  finishOrNext(message);
}

function applyReaction(card, self, enemy) {
  if (!card) return { self, enemy };
  if (card.id === "041") self += 2;
  if (card.id === "042" && self <= 3) self += 4;
  if (card.id === "043") self += 4;
  if (card.id === "049" && enemy >= 7) enemy -= 3;
  if (card.id === "055" && enemy >= 8) enemy = Math.ceil(enemy / 2);
  if (card.id === "056" && self <= 3) self += 5;
  if (card.id === "058") self += self % 2 === 0 ? 2 : 1;
  if (card.id === "059") self += 2;
  return { self, enemy: Math.max(0, enemy) };
}

function pickEnemyPun() {
  const b = state.battle;
  let index = b.enemyHand.findIndex((card) => card.type === "pun");
  if (index < 0) {
    b.enemyHand.push(...draw(b.enemyDeck, 2));
    index = b.enemyHand.findIndex((card) => card.type === "pun");
  }
  return b.enemyHand.splice(Math.max(0, index), 1)[0];
}

function pickEnemyReaction(enemyPun) {
  const b = state.battle;
  const index = b.enemyHand.findIndex((card) => card.type === "reaction" && enemyPun.power <= 6);
  return index >= 0 ? b.enemyHand.splice(index, 1)[0] : null;
}

function discardPlayed(enemyPun, enemyReaction) {
  const b = state.battle;
  b.playerHand = b.playerHand.filter((card) => card !== b.selectedPun && card !== b.selectedReaction);
  b.enemyHand = b.enemyHand.filter((card) => card !== enemyPun && card !== enemyReaction);
  b.selectedPun = null;
  b.selectedReaction = null;
  b.usedReaction = false;
}

function drawUp() {
  const b = state.battle;
  while (b.playerHand.length < 5 && b.playerDeck.length) b.playerHand.push(b.playerDeck.pop());
  while (b.enemyHand.length < 5 && b.enemyDeck.length) b.enemyHand.push(b.enemyDeck.pop());
}

function stealCard() {
  const b = state.battle;
  if (!b.enemyDeck.length) return null;
  const index = rand(0, b.enemyDeck.length - 1);
  const card = b.enemyDeck.splice(index, 1)[0];
  if (!state.owned.includes(card.id)) {
    state.owned.push(card.id);
    save();
  }
  return card;
}

function finishOrNext(message) {
  const b = state.battle;
  $("playerScore").textContent = b.playerScore;
  $("enemyScore").textContent = b.enemyScore;
  $("battleLog").textContent = message;
  $("turnHint").textContent = "次のダジャレ札を選択";
  $("judgeBtn").disabled = true;
  renderHand();
  if (b.playerScore >= 5 || b.enemyScore >= 5) {
    setTimeout(() => {
      const win = b.playerScore >= 5;
      $("resultSub").textContent = win ? "5P先取" : "ざんねん";
      $("resultTitle").textContent = win ? "勝利！" : "敗北";
      $("resultText").textContent = win ? "新しいカードを集めて、もっと強いデッキへ。" : "デッキを組み直して再挑戦しよう。";
      show("resultScreen");
    }, 900);
  }
}

function renderPlayed(target, pun, reaction) {
  const area = $(target);
  area.innerHTML = "";
  if (pun) area.appendChild(cardNode(pun));
  if (reaction) area.appendChild(cardNode(reaction));
}

function cardNode(card, opts = {}) {
  const node = document.createElement("button");
  node.className = `toy-card ${card.type} ${card.id === "040" ? "rare" : ""} ${opts.locked ? "locked" : ""} ${opts.selected ? "selected" : ""}`;
  node.type = "button";
  node.setAttribute("aria-label", `${card.name}${card.type === "pun" ? ` ${card.power}P` : ""}`);
  node.innerHTML = `
    <span class="id">${card.id}</span>
    ${opts.locked ? '<span class="lock">LOCK</span>' : ""}
    <span class="name">${card.name}</span>
    ${card.type === "pun" ? `<span class="power">${card.power}</span>` : `<span class="effect">${card.effect}</span>`}
  `;
  return node;
}

function cardsByIds(ids) {
  return ids.map((id) => state.cards.find((card) => card.id === id)).filter(Boolean);
}

function draw(deck, count) {
  return deck.splice(0, count);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
