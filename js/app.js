const SAVE_KEY = "dajare-ou-save-v1";
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
const OWNED_NORI = ["041", "042", "044", "047", "059"];
const CARD_ICONS = {
  "001": "🥦", "002": "🍅", "003": "🥕", "004": "🛏️", "005": "🍛",
  "006": "🐸", "007": "🐱", "008": "🐶", "009": "🐘", "010": "🐻",
  "011": "🐟", "012": "☎️", "013": "🍨", "014": "🍊", "015": "🍋",
  "016": "🍉", "017": "🐮", "018": "🐍", "019": "🐵", "020": "🦑",
  "021": "🐚", "022": "⭐", "023": "☀️", "024": "💧", "025": "✂️",
  "026": "📖", "027": "🎵", "028": "🍓", "029": "🍠", "030": "🥗",
  "031": "🍖", "032": "🍫", "033": "🥤", "034": "🐭", "035": "🐬",
  "036": "🛞", "037": "🚉", "038": "🛝", "039": "🍰", "040": "👑",
  "041": "✨", "042": "↗️", "043": "👑", "044": "🔄", "045": "🌱",
  "046": "❗", "047": "⏪", "048": "🎁", "049": "⬇️", "050": "🚫",
  "051": "🌶️", "052": "🛡️", "053": "💪", "054": "⚖️", "055": "⚡",
  "056": "💡", "057": "👏", "058": "🎉", "059": "⭐", "060": "🤫"
};
const ENEMIES = [
  {
    id: "hajime",
    name: "はじめくん",
    avatar: "は",
    level: "やさしい",
    desc: "OP6以下中心。最初の相手にちょうどいい。",
    pun: "easy",
    reactions: ["041", "042", "044", "047", "058"],
    reactionChance: 0.42
  },
  {
    id: "jiwari",
    name: "じわりちゃん",
    avatar: "じ",
    level: "ふつう",
    desc: "ノリカード多め。じわじわ強くなるタイプ。",
    pun: "balanced",
    reactions: ["041", "042", "045", "048", "051", "056", "057", "059"],
    reactionChance: 0.72
  },
  {
    id: "tsukkomi",
    name: "つっこみ先輩",
    avatar: "ツ",
    level: "手ごわい",
    desc: "相手を下げるノリカードを多く使う。",
    pun: "balanced",
    reactions: ["046", "049", "050", "052", "054", "055", "060"],
    reactionChance: 0.7
  },
  {
    id: "rare",
    name: "レア王",
    avatar: "王",
    level: "つよい",
    desc: "OP7以上やレアカードが多い。カード集め向け。",
    pun: "rare",
    reactions: ["043", "049", "053", "055", "057", "058", "060"],
    reactionChance: 0.62
  }
];
const state = {
  cards: [],
  ownedCounts: {},
  deck: [],
  enemy: null,
  battle: null,
  online: {
    app: null,
    db: null,
    roomRef: null,
    unsubscribe: null,
    roomId: "",
    role: "",
    resolvingTurn: null
  }
};

const $ = (id) => document.getElementById(id);

init();

async function init() {
  state.cards = await fetch("data/cards.json").then((res) => res.json());
  loadSave();
  bindEvents();
  renderEnemies();
  renderDeck();
  show("titleScreen");
}

function bindEvents() {
  $("startBtn").addEventListener("click", () => show("enemyScreen"));
  $("onlineBtn").addEventListener("click", openRoomScreen);
  $("roomForm").addEventListener("submit", (event) => event.preventDefault());
  $("createRoomBtn").addEventListener("click", () => enterRoom("create"));
  $("joinRoomBtn").addEventListener("click", () => enterRoom("join"));
  $("roomBackBtn").addEventListener("click", leaveOnlineRoom);
  $("roomResetBtn").addEventListener("click", resetOnlineRoom);
  $("autoDeckBtn").addEventListener("click", autoDeck);
  $("battleBtn").addEventListener("click", startBattle);
  $("judgeBtn").addEventListener("click", () => {
    if (state.battle?.selectedPun) resolveTurn();
  });
  $("resetBtn").addEventListener("click", resetSave);
  $("againBtn").addEventListener("click", () => {
    if (state.online.roomRef) {
      resetOnlineRoom();
      return;
    }
    renderDeck();
    show("deckScreen");
  });
  $("homeBtn").addEventListener("click", () => {
    if (state.online.roomRef) {
      leaveOnlineRoom();
      return;
    }
    show("titleScreen");
  });
  document.querySelectorAll(".back").forEach((button) => {
    button.addEventListener("click", () => show(button.dataset.to));
  });
}

function openRoomScreen() {
  $("roomStatus").textContent = "";
  if (!firebaseReady()) {
    $("roomStatus").textContent = "Firebase設定が必要です";
  }
  show("roomScreen");
}

function firebaseReady() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
}

function getDatabase() {
  if (!firebaseReady() || !window.firebase) return null;
  if (!state.online.app) {
    state.online.app = firebase.initializeApp(firebaseConfig);
    state.online.db = firebase.database();
  }
  return state.online.db;
}

async function enterRoom(mode) {
  const db = getDatabase();
  if (!db) {
    $("roomStatus").textContent = "Firebase設定が必要です";
    return;
  }
  const rawPassword = $("roomPassword").value.trim();
  if (!rawPassword) {
    $("roomStatus").textContent = "パスワードを入力してください";
    $("roomPassword").focus();
    return;
  }

  const roomId = roomIdFromPassword(rawPassword);
  const roomRef = db.ref(`rooms/${roomId}`);
  $("roomStatus").textContent = mode === "create" ? "ルーム作成中..." : "参加中...";

  try {
    const result = await roomRef.transaction((room) => {
      if (mode === "create") {
        if (room) return;
        return newOnlineRoom(roomId, "player1");
      }
      if (!room) return;
      room.players = room.players || {};
      if (!room.players.player1) {
        room.players.player1 = newOnlinePlayer("player1");
        room.status = "waiting";
        return room;
      }
      if (!room.players.player2) {
        room.players.player2 = newOnlinePlayer("player2");
        room.status = "playing";
        return room;
      }
      return;
    });

    if (!result.committed) {
      $("roomStatus").textContent = mode === "create"
        ? "同じパスワードのルームが既にあります"
        : "ルームがないか、満員です";
      return;
    }

    const room = result.snapshot.val();
    const role = !room.players?.player2 || mode === "create" ? "player1" : "player2";
    startOnlineWatch(roomRef, roomId, role);
  } catch (error) {
    $("roomStatus").textContent = `接続エラー: ${error.message}`;
  }
}

function roomIdFromPassword(password) {
  const encoded = btoa(unescape(encodeURIComponent(password)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function newOnlineRoom(roomId, role) {
  return {
    roomId,
    status: "waiting",
    turn: 1,
    resolvingTurn: 0,
    winner: "",
    lastResult: { result: "相手を待っています。" },
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
    players: {
      [role]: newOnlinePlayer(role)
    }
  };
}

function newOnlinePlayer(role) {
  const deck = buildOnlineInitialDeck().map((card) => card.id);
  const hand = deck.splice(0, 5);
  return {
    name: role,
    ready: true,
    score: 0,
    hand,
    deck,
    selectedCard: "",
    selectedNori: "",
    turn: 1,
    connected: true,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };
}

function buildOnlineInitialDeck() {
  const owned = initialOwnedCounts();
  const cards = state.cards.filter((card) => owned[card.id]);
  const puns = cards
    .filter((card) => card.type === "pun")
    .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id));
  const reactions = cards.filter((card) => card.type === "reaction");
  return shuffle([...puns.slice(0, 25), ...reactions.slice(0, 5)]).slice(0, 30);
}

function startOnlineWatch(roomRef, roomId, role) {
  if (state.online.unsubscribe) state.online.roomRef.off("value", state.online.unsubscribe);
  state.online.roomRef = roomRef;
  state.online.roomId = roomId;
  state.online.role = role;
  state.online.resolvingTurn = null;
  $("roomStatus").textContent = role === "player1" ? "作成しました。相手を待っています。" : "参加しました。";
  state.online.unsubscribe = (snapshot) => handleOnlineRoom(snapshot.val());
  roomRef.on("value", state.online.unsubscribe);
}

function leaveOnlineRoom() {
  if (state.online.roomRef && state.online.unsubscribe) {
    state.online.roomRef.off("value", state.online.unsubscribe);
  }
  state.online.roomRef = null;
  state.online.unsubscribe = null;
  state.online.roomId = "";
  state.online.role = "";
  show("titleScreen");
}

function handleOnlineRoom(room) {
  if (!room) {
    $("roomStatus").textContent = "ルームがリセットされました";
    show("roomScreen");
    return;
  }
  if (room.status === "waiting") {
    $("roomStatus").textContent = "相手を待っています...";
    show("roomScreen");
    return;
  }
  renderOnlineBattle(room);
  if (room.status === "finished") {
    showOnlineResult(room);
    return;
  }
  maybeResolveOnlineTurn(room);
  show("onlineBattleScreen");
}

function renderOnlineBattle(room) {
  const role = state.online.role;
  const otherRole = role === "player1" ? "player2" : "player1";
  const me = room.players?.[role];
  const other = room.players?.[otherRole];
  if (!me || !other) return;

  $("onlineMyScore").textContent = me.score || 0;
  $("onlineOpponentScore").textContent = other.score || 0;
  renderPips("onlineMyPips", me.score || 0);
  renderPips("onlineOpponentPips", other.score || 0);
  $("onlineSelectedCardName").textContent = me.selectedCard ? cardById(me.selectedCard)?.name || me.selectedCard : "なし";
  $("onlineOpponentReady").textContent = other.selectedCard ? "選択済み" : "未選択";
  $("onlineSelectedStatus").classList.toggle("ready", Boolean(me.selectedCard));
  $("onlineOpponentStatus").classList.toggle("ready", Boolean(other.selectedCard));
  renderOnlineLog(room.lastResult);
  renderOnlinePreview(me);
  renderOnlineHand(me, room.status);
}

function renderOnlineLog(lastResult) {
  renderLogTo("onlineLog", lastResult || { result: "カードを選んでください。" });
}

function renderOnlinePreview(me) {
  const preview = $("onlineSelectedPreview");
  preview.innerHTML = "";
  const selected = cardById(me.selectedCard);
  if (!selected) {
    preview.innerHTML = "<span>選んだカードがここに出ます</span>";
    return;
  }
  preview.appendChild(cardNode(selected, { selected: true }));
}

function renderOnlineHand(me, status) {
  $("onlineHand").innerHTML = "";
  cardsByIds(me.hand || []).forEach((card) => {
    const selected = me.selectedCard === card.id || me.selectedNori === card.id;
    const ready = card.type === "reaction" && me.selectedCard && !me.selectedNori;
    const node = cardNode(card, { selected, ready });
    if (status !== "playing" || (card.type === "reaction" && (!me.selectedCard || me.selectedNori))) {
      node.disabled = true;
    }
    node.addEventListener("click", () => selectOnlineCard(card));
    $("onlineHand").appendChild(node);
  });
}

function selectOnlineCard(card) {
  const role = state.online.role;
  if (!state.online.roomRef || !role) return;
  const updates = {
    [`players/${role}/updatedAt`]: firebase.database.ServerValue.TIMESTAMP
  };
  if (card.type === "pun") {
    updates[`players/${role}/selectedCard`] = card.id;
  } else {
    updates[`players/${role}/selectedNori`] = card.id;
  }
  state.online.roomRef.update(updates);
}

function maybeResolveOnlineTurn(room) {
  if (state.online.role !== "player1") return;
  const p1 = room.players?.player1;
  const p2 = room.players?.player2;
  if (!p1?.selectedCard || !p2?.selectedCard) return;
  if (state.online.resolvingTurn === room.turn) return;
  state.online.resolvingTurn = room.turn;
  state.online.roomRef.transaction((current) => {
    if (!current || current.status !== "playing") return current;
    if (current.resolvingTurn === current.turn) return current;
    const a = current.players?.player1;
    const b = current.players?.player2;
    if (!a?.selectedCard || !b?.selectedCard) return current;
    return resolveOnlineTurn(current);
  });
}

function resolveOnlineTurn(room) {
  const p1 = { ...room.players.player1 };
  const p2 = { ...room.players.player2 };
  const p1Card = cardById(p1.selectedCard);
  const p2Card = cardById(p2.selectedCard);
  const p1Nori = cardById(p1.selectedNori);
  const p2Nori = cardById(p2.selectedNori);
  if (!p1Card || !p2Card) return room;

  let p1Power = p1Card.power;
  let p2Power = p2Card.power;
  let p1Effect = applyReaction(p1Nori, p1Power, p2Power);
  p1Power = p1Effect.self;
  p2Power = p1Effect.enemy;
  let p2Effect = applyReaction(p2Nori, p2Power, p1Power);
  p2Power = p2Effect.self;
  p1Power = p2Effect.enemy;

  if (p1Nori?.id === "047" || p2Nori?.id === "047") {
    p1Power = p1Card.power + rand(0, 3);
    p2Power = p2Card.power + rand(0, 3);
  }

  let result = "引き分け。得点なし";
  if (p1Power > p2Power) {
    p1.score = (p1.score || 0) + 1;
    result = "player1が1P";
  } else if (p2Power > p1Power) {
    p2.score = (p2.score || 0) + 1;
    result = "player2が1P";
  }

  p1.hand = refillOnlineHand(removePlayedIds(p1.hand, [p1.selectedCard, p1.selectedNori]), p1.deck);
  p2.hand = refillOnlineHand(removePlayedIds(p2.hand, [p2.selectedCard, p2.selectedNori]), p2.deck);
  p1.selectedCard = "";
  p1.selectedNori = "";
  p2.selectedCard = "";
  p2.selectedNori = "";
  p1.turn = (room.turn || 1) + 1;
  p2.turn = (room.turn || 1) + 1;

  room.players.player1 = p1;
  room.players.player2 = p2;
  room.turn = (room.turn || 1) + 1;
  room.resolvingTurn = room.turn - 1;
  room.lastResult = {
    played: `player1: ${p1Card.name} ${p1Power}P / player2: ${p2Card.name} ${p2Power}P`,
    nori: `ノリ: ${p1Nori?.name || "なし"} / ${p2Nori?.name || "なし"}`,
    result
  };
  room.updatedAt = firebase.database.ServerValue.TIMESTAMP;
  if (p1.score >= 5 || p2.score >= 5) {
    room.status = "finished";
    room.winner = p1.score >= 5 ? "player1" : "player2";
  }
  return room;
}

function removePlayedIds(hand, playedIds) {
  const remove = new Set(playedIds.filter(Boolean));
  return (hand || []).filter((id) => !remove.has(id));
}

function refillOnlineHand(hand, deck) {
  const next = [...(hand || [])];
  while (next.length < 5 && deck.length) next.push(deck.shift());
  return next;
}

function showOnlineResult(room) {
  const win = room.winner === state.online.role;
  $("resultSub").textContent = "オンライン対戦";
  $("resultTitle").textContent = win ? "勝利！" : "敗北";
  $("resultText").textContent = "オンライン対戦ではカード入手はありません。";
  show("resultScreen");
}

function resetOnlineRoom() {
  if (!state.online.roomRef) return;
  state.online.roomRef.remove();
  leaveOnlineRoom();
}

function renderEnemies() {
  $("enemyList").innerHTML = "";
  ENEMIES.forEach((enemy) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "enemy-card";
    node.innerHTML = `
      <span class="avatar">${enemy.avatar}</span>
      <strong>${enemy.name}</strong>
      <small>${enemy.desc}</small>
      <em>${enemy.level}</em>
    `;
    node.addEventListener("click", () => {
      state.enemy = enemy;
      renderDeck();
      show("deckScreen");
    });
    $("enemyList").appendChild(node);
  });
}

function loadSave() {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
  if (saved) {
    state.ownedCounts = migrateOwnedCounts(saved);
    state.deck = uniqueDeck(saved.deck || []);
    save();
    return;
  }
  state.ownedCounts = initialOwnedCounts();
  state.deck = [];
  save();
}

function initialOwnedCounts() {
  return Object.fromEntries(state.cards
    .filter((card) => card.type === "pun" ? card.power <= 6 : OWNED_NORI.includes(card.id))
    .map((card) => [card.id, 1]));
}

function migrateOwnedCounts(saved) {
  const counts = {};
  const add = (id, amount = 1) => {
    const key = normalizeId(id);
    if (!key) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    counts[key] = (counts[key] || 0) + value;
  };
  if (saved.ownedCards && typeof saved.ownedCards === "object" && !Array.isArray(saved.ownedCards)) {
    Object.entries(saved.ownedCards).forEach(([id, count]) => add(id, count));
  } else if (Array.isArray(saved.owned)) {
    saved.owned.forEach((id) => add(id));
  } else if (saved.owned && typeof saved.owned === "object") {
    Object.entries(saved.owned).forEach(([id, count]) => add(id, count));
  }
  return Object.keys(counts).length ? counts : initialOwnedCounts();
}

function normalizeId(id) {
  const raw = String(id).trim();
  return state.cards.find((card) => card.id === raw)?.id
    || state.cards.find((card) => Number(card.id) === Number(raw))?.id
    || null;
}

function uniqueDeck(deck) {
  const seen = new Set();
  return deck.map(normalizeId).filter((id) => {
    if (!id || seen.has(id) || ownedCount(id) < 1) return false;
    seen.add(id);
    return true;
  }).slice(0, 30);
}

function ownedCount(id) {
  return state.ownedCounts[id] || 0;
}

function ownedIds() {
  return state.cards.filter((card) => ownedCount(card.id) > 0).map((card) => card.id);
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ownedCards: state.ownedCounts, deck: state.deck }));
}

function resetSave() {
  localStorage.removeItem(SAVE_KEY);
  state.ownedCounts = initialOwnedCounts();
  state.deck = [];
  save();
  $("battleLog").textContent = "セーブをリセットしました。";
  clearBurst();
  show("titleScreen");
}

function show(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  $(id).classList.add("active");
}

function renderDeck() {
  $("deckCount").textContent = `${state.deck.length} / 30`;
  renderCollectionStats();
  $("battleBtn").disabled = state.deck.length !== 30;
  $("deckHelp").textContent = state.deck.length === 30
    ? "準備OK。バトル開始できます。"
    : `あと${30 - state.deck.length}枚選ぶとバトルできます。`;
  $("cardList").innerHTML = "";
  state.cards.forEach((card) => {
    const count = ownedCount(card.id);
    const owned = count > 0;
    const inDeck = state.deck.includes(card.id);
    const node = cardNode(card, { locked: !owned, selected: inDeck, owned, inDeck, compact: true, count });
    node.addEventListener("click", () => toggleDeck(card, owned));
    $("cardList").appendChild(node);
  });
}

function renderCollectionStats() {
  const ownedTypes = state.cards.filter((card) => ownedCount(card.id) > 0).length;
  const total = Object.values(state.ownedCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  $("collectionStats").textContent = `所持カード種類数 ${ownedTypes}/${state.cards.length} / 総所持枚数 ${total}枚`;
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
  const ownedCards = cardsByIds(ownedIds());
  const puns = ownedCards
    .filter((card) => card.type === "pun")
    .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id));
  const reactions = ownedCards.filter((card) => card.type === "reaction");
  state.deck = [...puns.slice(0, 25), ...reactions.slice(0, 5)].map((card) => card.id).slice(0, 30);
  save();
  renderDeck();
}

function startBattle() {
  if (state.deck.length !== 30) {
    $("deckCount").textContent = `${state.deck.length} / 30 にしてください`;
    $("deckHelp").textContent = "30枚ちょうどでバトル開始できます。おすすめ編成が早いです。";
    return;
  }
  const playerDeck = shuffle(cardsByIds(state.deck));
  const enemyDeck = buildEnemyDeck();
  $("enemyName").textContent = state.enemy?.name || "相手";
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
  clearBurst();
  updateBattle("ダジャレ札を1枚えらんでください。ノリカードは1ターン1枚まで。");
  show("battleScreen");
}

function buildEnemyDeck() {
  const enemy = state.enemy || ENEMIES[0];
  const punPool = enemyPunPool(enemy);
  const reactions = cardsByIds(enemy.reactions);
  const punCount = Math.max(18, 30 - reactions.length);
  const deck = [...punPool.slice(0, punCount), ...reactions];
  const used = new Set(deck.map((card) => card.id));
  state.cards
    .filter((card) => card.type === "pun" && !used.has(card.id))
    .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id))
    .forEach((card) => {
      if (deck.length < 30) deck.push(card);
    });
  return shuffle(deck).slice(0, 30);
}

function enemyPunPool(enemy) {
  const puns = state.cards.filter((card) => card.type === "pun");
  if (enemy.pun === "easy") {
    return puns
      .filter((card) => card.power <= 6)
      .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id));
  }
  if (enemy.pun === "rare") {
    return puns
      .filter((card) => card.power >= 7)
      .concat(puns.filter((card) => card.power === 6).slice(0, 8))
      .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id));
  }
  return puns
    .filter((card) => card.power <= 7)
    .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id));
}

function updateBattle(message) {
  const b = state.battle;
  $("playerScore").textContent = b.playerScore;
  $("enemyScore").textContent = b.enemyScore;
  renderScorePips();
  renderBattleLog({ result: message });
  $("turnHint").textContent = "ダジャレ札を選択";
  $("judgeBtn").disabled = !b.selectedPun;
  updateBattleStatus();
  renderPlayed("playerPlay", b.selectedPun, b.selectedReaction);
  renderPlayed("enemyPlay");
  renderHand();
}

function renderHand() {
  const b = state.battle;
  $("hand").innerHTML = "";
  b.playerHand.forEach((card) => {
    const selected = b.selectedPun?.id === card.id || b.selectedReaction?.id === card.id;
    const ready = card.type === "reaction" && b.selectedPun && !b.usedReaction;
    const node = cardNode(card, { selected, ready });
    if (card.type === "reaction" && b.usedReaction && !selected) node.disabled = true;
    node.addEventListener("click", () => playFromHand(card));
    $("hand").appendChild(node);
  });
  updateBattleStatus();
}

function playFromHand(card) {
  const b = state.battle;
  clearBurst();
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
    renderBattleLog({
      played: `選択: ${b.selectedPun.name} / ${b.selectedPun.power}P`,
      nori: b.selectedReaction ? `ノリ: ${b.selectedReaction.name}` : "ノリ: 使うなら今選べます",
      result: "勝負ボタンで判定します"
    });
    updateBattleStatus();
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
  let outcomeText = "";
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
    outcomeText = won ? `勝ち！ ${won.name}を入手` : "勝ち！ 1Pゲット";
    showBurst(won ? `入手！ ${won.name}` : "勝ち！", won ? "gain" : "win");
  } else if (playerPower < enemyPower) {
    b.enemyScore += 1;
    message += " 負け。";
    outcomeText = "負け。相手が1P";
    showBurst("負け", "lose");
  } else {
    message += " 引き分け。";
    outcomeText = "引き分け。得点なし";
    showBurst("引き分け", "draw");
  }

  b.lastLog = {
    played: `札: ${b.selectedPun.name} ${playerPower}P / 相手 ${enemyPun.name} ${enemyPower}P`,
    nori: `ノリ: ${b.selectedReaction?.name || "なし"} / 相手 ${enemyReaction?.name || "なし"}`,
    result: outcomeText
  };

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
  const chance = state.enemy?.reactionChance ?? 0.45;
  if (Math.random() > chance) return null;
  const index = b.enemyHand.findIndex((card) => card.type === "reaction" && enemyPun.power <= 8);
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
  const before = ownedCount(card.id);
  state.ownedCounts[card.id] = before + 1;
  save();
  showGain(card, before === 0, state.ownedCounts[card.id]);
  return card;
}

function finishOrNext(message) {
  const b = state.battle;
  $("playerScore").textContent = b.playerScore;
  $("enemyScore").textContent = b.enemyScore;
  renderScorePips();
  renderBattleLog(b.lastLog || { result: message });
  $("turnHint").textContent = "次のダジャレ札を選択";
  $("judgeBtn").disabled = true;
  updateBattleStatus();
  renderHand();
  if (b.playerScore >= 5 || b.enemyScore >= 5) {
    setTimeout(() => {
      const win = b.playerScore >= 5;
      $("resultSub").textContent = win ? "5P先取" : "ざんねん";
      $("resultTitle").textContent = win ? "勝利！" : "敗北";
      $("resultText").textContent = win ? "新しいカードを集めて、もっと強いデッキへ。" : "デッキを組み直して再挑戦しよう。";
      show("resultScreen");
    }, 650);
  }
}

function showGain(card, isNew, count) {
  const banner = $("gainBanner");
  banner.textContent = isNew ? `NEW! ${card.name}を入手` : `${card.name} +1枚 / 所持${count}枚`;
  banner.className = "gain-banner show";
}

function renderPlayed(target, pun, reaction) {
  const area = $(target);
  area.innerHTML = "";
  if (pun) area.appendChild(cardNode(pun));
  if (reaction) area.appendChild(cardNode(reaction));
}

function updateBattleStatus() {
  const b = state.battle;
  if (!b) return;
  $("selectedCardName").textContent = b.selectedPun ? b.selectedPun.name : "なし";
  $("reactionState").textContent = b.usedReaction
    ? (b.selectedReaction ? `使用済み: ${b.selectedReaction.name}` : "使用済み")
    : "未使用";
  $("selectedStatus").classList.toggle("ready", Boolean(b.selectedPun));
  $("reactionStatus").classList.toggle("used", b.usedReaction);
  renderSelectedPreview();
}

function renderBattleLog(lines) {
  renderLogTo("battleLog", lines);
}

function renderLogTo(target, lines) {
  const log = $(target);
  log.innerHTML = "";
  [
    ["札", lines.played],
    ["ノリ", lines.nori],
    ["結果", lines.result]
  ].filter((line) => line[1]).forEach(([label, text]) => {
    const row = document.createElement("div");
    row.className = "log-row";
    row.innerHTML = `<span class="log-label">${label}</span><span>${text}</span>`;
    log.appendChild(row);
  });
}

function renderScorePips() {
  renderPips("playerPips", state.battle?.playerScore || 0);
  renderPips("enemyPips", state.battle?.enemyScore || 0);
}

function renderPips(target, score) {
  const area = $(target);
  area.innerHTML = "";
  for (let i = 0; i < 5; i += 1) {
    const pip = document.createElement("span");
    if (i < score) pip.className = "on";
    area.appendChild(pip);
  }
}

function renderSelectedPreview() {
  const b = state.battle;
  const preview = $("selectedPreview");
  preview.innerHTML = "";
  if (!b?.selectedPun) {
    preview.innerHTML = "<span>選んだカードがここに出ます</span>";
    return;
  }
  preview.appendChild(cardNode(b.selectedPun, { selected: true }));
}

function showBurst(text, type = "win") {
  const burst = $("resultBurst");
  burst.className = `result-burst show ${type}`;
  burst.textContent = text;
}

function clearBurst() {
  const burst = $("resultBurst");
  if (!burst) return;
  burst.className = "result-burst";
  burst.textContent = "";
  const banner = $("gainBanner");
  if (banner) {
    banner.className = "gain-banner";
    banner.textContent = "";
  }
}

function cardNode(card, opts = {}) {
  const node = document.createElement("button");
  const rarity = rarityOf(card);
  node.className = `toy-card ${opts.compact ? "deck-card" : ""} ${card.type} ${rarity.className} ${opts.locked ? "locked" : ""} ${opts.owned && !opts.locked ? "owned" : ""} ${opts.inDeck ? "in-deck" : ""} ${opts.ready ? "reaction-ready" : ""} ${opts.selected ? "selected" : ""}`;
  node.type = "button";
  node.setAttribute("aria-label", `${card.name}${card.type === "pun" ? ` ${card.power}P` : ""}`);
  node.innerHTML = `
    <span class="id">${card.id}</span>
    <span class="card-icon" aria-hidden="true">${CARD_ICONS[card.id] || "★"}</span>
    ${opts.locked ? '<span class="lock">LOCK</span>' : ""}
    ${opts.compact && opts.owned && !opts.inDeck ? '<span class="state-label own-label">所持</span>' : ""}
    ${opts.compact && opts.inDeck ? '<span class="state-label deck-label">デッキ入り</span>' : ""}
    <span class="name">${card.name}</span>
    <span class="rarity-label">${rarity.label}</span>
    ${opts.compact && card.type === "reaction" ? '<span class="type-label">ノリ</span>' : ""}
    ${opts.compact ? `<span class="owned-count">所持 ${opts.count || 0}枚</span>` : ""}
    ${card.type === "pun" ? `<span class="power">${card.power}</span>` : `<span class="effect">${card.effect}</span>`}
  `;
  return node;
}

function rarityOf(card) {
  if (card.id === "040") return { label: "ブラックレア", className: "rarity-black" };
  if (card.type === "pun") {
    if (card.power >= 8) return { label: "レア3", className: "rarity-3" };
    if (card.power >= 6) return { label: "レア2", className: "rarity-2" };
    return { label: "レア", className: "rarity-1" };
  }
  if (["043", "050", "052", "053", "054", "055", "057", "060"].includes(card.id)) return { label: "レア3", className: "rarity-3" };
  if (["045", "046", "048", "049", "051", "056", "058", "059"].includes(card.id)) return { label: "レア2", className: "rarity-2" };
  return { label: "レア", className: "rarity-1" };
}

function cardsByIds(ids) {
  return ids.map((id) => state.cards.find((card) => card.id === id)).filter(Boolean);
}

function cardById(id) {
  return state.cards.find((card) => card.id === id);
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
