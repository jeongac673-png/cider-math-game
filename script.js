/* =========================================================
   🥤 4학년 사이다반 | 톡톡이들의 분수 탐험대 - CORE LOGIC
   ========================================================= */

// --- 1. GAME STATE & CONSTANTS ---
let state = {
    playerName: "사이다톡톡이",
    gold: 0, // Initial Gold 0G
    clears: 0,
    activeMinigame: 0,
    gameTimer: null,
    score: 0,
    currentQuestion: null,
    // Minigame 2 Pizza state
    pizzaWholeTarget: 1,
    pizzaWholeSelected: 0,
    pizzaSliceTarget: 2,
    pizzaSliceSelected: 0,
    pizzaTotalSlices: 4,
    // Minigame 3 Bridge state
    bridgeStep: 0,
    // Boss Battle state (Teacher Jung-Ah)
    bossHp: 100,
    playerHp: 3,
    bossQIndex: 0,
    bossTurnTimer: null,
    bossQuestions: [],
    // Firebase status
    isFirebaseActive: false,
    currentUser: null
};

// Clean Empty Leaderboard
const DEFAULT_LEADERBOARD = [];

// --- 2. FIREBASE INTEGRATION SETUP ---
// firebaseConfig is declared in firebaseConfig.js (loaded before this script)
try {
    if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        state.isFirebaseActive = true;
        console.log("✅ Firebase 연결 성공! (cider-math project)");
    }
} catch (e) {
    console.warn("⚠️ Firebase 연결 실패 - LocalStorage 모드로 실행합니다.", e);
}

// --- 3. AUDIO SYNTHESIZER ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'click') {
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'correct') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.2);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

// --- 4. STORAGE & INIT ---
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateUI();
});

function loadData() {
    const savedName = localStorage.getItem('cider_player_name');
    const savedGold = localStorage.getItem('cider_player_gold');
    const savedClears = localStorage.getItem('cider_player_clears');

    if (savedName) state.playerName = savedName;
    if (savedGold !== null) state.gold = parseInt(savedGold, 10);
    if (savedClears !== null) state.clears = parseInt(savedClears, 10);

    if (!localStorage.getItem('cider_hof_data')) {
        localStorage.setItem('cider_hof_data', JSON.stringify([]));
    }
}

function saveData() {
    localStorage.setItem('cider_player_name', state.playerName);
    localStorage.setItem('cider_player_gold', state.gold);
    localStorage.setItem('cider_player_clears', state.clears);
    updateHofData();
}

function updateHofData() {
    let hofList = JSON.parse(localStorage.getItem('cider_hof_data')) || [];
    const existingIndex = hofList.findIndex(item => item.name === state.playerName);

    if (existingIndex !== -1) {
        hofList[existingIndex].gold = Math.max(hofList[existingIndex].gold, state.gold);
        hofList[existingIndex].clears = Math.max(hofList[existingIndex].clears, state.clears);
    } else {
        hofList.push({ name: state.playerName, gold: state.gold, clears: state.clears });
    }

    localStorage.setItem('cider_hof_data', JSON.stringify(hofList));

    if (state.isFirebaseActive) {
        firebase.firestore().collection("cider_class_hof").doc(state.playerName).set({
            name: state.playerName,
            gold: state.gold,
            clears: state.clears,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
}

// --- 5. AUTHENTICATION ---
function loginAnonymous() {
    const nick = document.getElementById('input-nickname').value.trim();
    if (nick) state.playerName = nick;

    if (state.isFirebaseActive) {
        firebase.auth().signInAnonymously().then((userCredential) => {
            state.currentUser = userCredential.user;
            document.getElementById('auth-status-msg').innerText = "✅ 익명 로그인 완료!";
        }).catch(err => { console.error("Firebase auth error:", err); });
    }

    saveData();
    updateUI();
    playSound('click');
    showScreen('screen-lobby');
}

function loginGoogle() {
    const nick = document.getElementById('input-nickname').value.trim();
    if (nick) state.playerName = nick;

    if (state.isFirebaseActive) {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then((result) => {
            state.currentUser = result.user;
            state.playerName = result.user.displayName || state.playerName;
            document.getElementById('auth-status-msg').innerText = `✅ ${state.playerName}님 로그인 완료!`;
            saveData();
            updateUI();
            showScreen('screen-lobby');
        }).catch((error) => {
            alert("Google 로그인 처리 중 예외가 발생했습니다: " + error.message);
        });
    } else {
        alert("Google 로그인용 Firebase 설정(apiKey)이 활성화되면 작동합니다! 지금은 로컬 톡톡이 닉네임으로 시작합니다.");
        saveData();
        updateUI();
        showScreen('screen-lobby');
    }
}

// --- 6. NAVIGATION & SCREEN MANAGER ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');

    const statusBar = document.getElementById('status-bar');
    if (screenId === 'screen-start' || screenId === 'screen-result' || screenId === 'screen-hall-of-fame') {
        statusBar.classList.add('hidden');
    } else {
        statusBar.classList.remove('hidden');
        updateUI();
    }
}

function updateUI() {
    document.getElementById('player-name-display').innerText = state.playerName;
    document.getElementById('player-gold').innerText = state.gold;
    document.getElementById('player-clears').innerText = state.clears;

    const bossBtn = document.getElementById('btn-challenge-boss');
    if (bossBtn) {
        if (state.gold < 100) {
            bossBtn.innerText = `🔒 골드 부족 (100G 필요 / 현재 ${state.gold}G)`;
            bossBtn.style.opacity = '0.7';
            bossBtn.style.cursor = 'not-allowed';
        } else {
            bossBtn.innerText = `정아쌤 도전하기 (100G 소모)`;
            bossBtn.style.opacity = '1';
            bossBtn.style.cursor = 'pointer';
        }
    }
}

// --- 7. MATH QUESTION GENERATOR ---
function generateMathQuestion(type = 'proper') {
    const denom = Math.floor(Math.random() * 6) + 3; // Denominator 3~8

    if (type === 'proper') {
        const isAdd = Math.random() > 0.5;
        let n1, n2, resNum;
        if (isAdd) {
            n1 = Math.floor(Math.random() * (denom - 2)) + 1;
            n2 = Math.floor(Math.random() * (denom - n1 - 1)) + 1;
            resNum = n1 + n2;
            return {
                isMixed: false,
                typeLabel: "진분수 덧셈",
                questionText: `${n1}/${denom} + ${n2}/${denom}`,
                answerStr: `${resNum}/${denom}`,
                denom, resNum
            };
        } else {
            n1 = Math.floor(Math.random() * (denom - 2)) + 2;
            n2 = Math.floor(Math.random() * (n1 - 1)) + 1;
            resNum = n1 - n2;
            return {
                isMixed: false,
                typeLabel: "진분수 뺄셈",
                questionText: `${n1}/${denom} - ${n2}/${denom}`,
                answerStr: `${resNum}/${denom}`,
                denom, resNum
            };
        }
    } else if (type === 'mixed_add') {
        const w1 = Math.floor(Math.random() * 2) + 1; // 1~2
        const w2 = Math.floor(Math.random() * 2) + 1; // 1~2
        const n1 = Math.floor(Math.random() * (denom - 2)) + 1;
        const n2 = Math.floor(Math.random() * (denom - n1 - 1)) + 1;

        const resW = w1 + w2; // max 4
        const resN = n1 + n2;

        return {
            isMixed: true,
            typeLabel: "대분수 덧셈",
            questionText: `${w1} ${n1}/${denom} + ${w2} ${n2}/${denom}`,
            answerStr: `${resW} ${resN}/${denom}`,
            wholeTarget: resW,
            sliceTarget: resN,
            denom
        };
    } else if (type === 'mixed_sub') {
        const w1 = Math.floor(Math.random() * 2) + 2; // 2~3
        const w2 = Math.floor(Math.random() * (w1 - 1)) + 1;
        const n1 = Math.floor(Math.random() * (denom - 2)) + 2;
        const n2 = Math.floor(Math.random() * (n1 - 1)) + 1;

        const resW = w1 - w2;
        const resN = n1 - n2;

        return {
            isMixed: true,
            typeLabel: "대분수 뺄셈",
            questionText: `${w1} ${n1}/${denom} - ${w2} ${n2}/${denom}`,
            answerStr: `${resW} ${resN}/${denom}`,
            wholeTarget: resW,
            sliceTarget: resN,
            denom
        };
    }
}

function generateChoices(q) {
    const choices = [q.answerStr];
    let attempts = 0;

    while (choices.length < 4 && attempts < 50) {
        attempts++;
        let fakeStr = "";

        if (q.isMixed) {
            const [wPart, fracPart] = q.answerStr.split(' ');
            const [nPart, dPart] = fracPart.split('/');
            const correctW = parseInt(wPart, 10);
            const correctN = parseInt(nPart, 10);
            const d = parseInt(dPart, 10);

            let fakeW = correctW + (Math.floor(Math.random() * 3) - 1);
            let fakeN = correctN + (Math.floor(Math.random() * 3) - 1);

            if (fakeW < 1) fakeW = 1;
            if (fakeN < 1) fakeN = 1;
            if (fakeN >= d) fakeN = d - 1;

            fakeStr = `${fakeW} ${fakeN}/${d}`;
        } else {
            const [nPart, dPart] = q.answerStr.split('/');
            const correctN = parseInt(nPart, 10);
            const d = parseInt(dPart, 10);

            let fakeN = correctN + (Math.floor(Math.random() * 5) - 2);
            if (fakeN < 1 || fakeN === correctN) {
                fakeN = (correctN % (d - 1)) + 1;
                if (fakeN === correctN) fakeN = correctN + 1;
            }

            fakeStr = `${fakeN}/${d}`;
        }

        if (!choices.includes(fakeStr)) {
            choices.push(fakeStr);
        }
    }

    while (choices.length < 4) {
        choices.push(`${choices.length + 1} 1/${q.denom || 5}`);
    }

    return choices.sort(() => Math.random() - 0.5);
}

// --- 8. MINIGAME MANAGER ---
function startGame(gameId) {
    playSound('click');
    state.activeMinigame = gameId;
    state.score = 0;
    clearInterval(state.gameTimer);

    if (gameId === 1) {
        setupGame1();
        showScreen('screen-game1');
    } else if (gameId === 2) {
        setupGame2();
        showScreen('screen-game2');
    } else if (gameId === 3) {
        setupGame3();
        showScreen('screen-game3');
    }
}

function quitGame() {
    playSound('click');
    clearInterval(state.gameTimer);
    showScreen('screen-lobby');
}

function finishMinigame(success, earnedGold = 50) {
    clearInterval(state.gameTimer);
    if (success) {
        playSound('win');
        state.gold += earnedGold;
        state.clears += 1;
        saveData();
        updateUI();

        document.getElementById('result-icon').innerText = '🎉';
        document.getElementById('result-title').innerText = '미니게임 클리어!';
        document.getElementById('result-desc').innerText = `사이다반 톡톡이 최고! 미니게임을 성공적으로 마쳤습니다.`;
        document.getElementById('result-gold-earned').innerText = `+${earnedGold} G`;
    } else {
        playSound('wrong');
        document.getElementById('result-icon').innerText = '⏱️';
        document.getElementById('result-title').innerText = '시간 초과!';
        document.getElementById('result-desc').innerText = `시간이 다 되었습니다. 다시 도전해보세요!`;
        document.getElementById('result-gold-earned').innerText = `+0 G`;
    }
    showScreen('screen-result');
}

// --- 9. MINIGAME 1: JELLY POP ---
function setupGame1() {
    let timeLeft = 20;
    document.getElementById('g1-timer').innerText = timeLeft;
    document.getElementById('g1-score').innerText = 0;

    nextGame1Question();

    state.gameTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('g1-timer').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(state.gameTimer);
            const reward = Math.min(50, Math.max(40, state.score * 10));
            finishMinigame(state.score >= 3, reward);
        }
    }, 1000);
}

function nextGame1Question() {
    state.currentQuestion = generateMathQuestion('proper');
    document.getElementById('g1-question').innerText = `${state.currentQuestion.questionText} = ?`;

    const container = document.getElementById('g1-jelly-container');
    container.innerHTML = '';

    const options = generateChoices(state.currentQuestion);

    options.forEach((opt, index) => {
        const btn = document.createElement('div');
        btn.className = 'jelly-btn';
        btn.innerText = opt;
        btn.style.left = `${10 + index * 22}%`;
        btn.style.animationDelay = `${index * 0.3}s`;

        btn.onclick = () => {
            if (opt === state.currentQuestion.answerStr) {
                playSound('correct');
                state.score += 1;
                document.getElementById('g1-score').innerText = state.score;
                nextGame1Question();
            } else {
                playSound('wrong');
                btn.style.background = '#ff7675';
            }
        };
        container.appendChild(btn);
    });
}

// --- 10. MINIGAME 2: PIZZA FILL ---
function setupGame2() {
    let timeLeft = 25;
    document.getElementById('g2-timer').innerText = timeLeft;
    document.getElementById('g2-score').innerText = 0;

    nextGame2Question();

    state.gameTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('g2-timer').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(state.gameTimer);
            const reward = Math.min(80, Math.max(70, state.score * 20 + 50));
            finishMinigame(state.score >= 2, reward);
        }
    }, 1000);
}

function nextGame2Question() {
    state.currentQuestion = generateMathQuestion('mixed_add');
    document.getElementById('g2-question').innerText = `${state.currentQuestion.questionText} = ?`;

    state.pizzaWholeTarget = state.currentQuestion.wholeTarget;
    state.pizzaSliceTarget = state.currentQuestion.sliceTarget;
    state.pizzaTotalSlices = state.currentQuestion.denom;
    state.pizzaWholeSelected = 0;
    state.pizzaSliceSelected = 0;

    document.getElementById('pizza-selected-count').innerText = 0;
    document.getElementById('pizza-total-count').innerText = state.pizzaTotalSlices;

    renderMixedPizzaBoard();
}

function renderMixedPizzaBoard() {
    const wholeContainer = document.getElementById('whole-pizza-container');
    wholeContainer.innerHTML = '';

    for (let i = 1; i <= 4; i++) {
        const item = document.createElement('div');
        item.className = 'whole-pizza-item';
        item.innerText = '🍕';
        item.title = `전체 피자 ${i}판`;
        item.style.opacity = '0.3';

        item.onclick = () => {
            playSound('click');
            if (item.style.opacity === '0.3') {
                item.style.opacity = '1';
                item.classList.add('active-whole');
                state.pizzaWholeSelected++;
            } else {
                item.style.opacity = '0.3';
                item.classList.remove('active-whole');
                state.pizzaWholeSelected--;
            }
        };
        wholeContainer.appendChild(item);
    }

    const board = document.getElementById('pizza-board');
    board.innerHTML = '';

    const slicesCount = state.pizzaTotalSlices;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("class", "pizza-svg");

    const crust = document.createElementNS(svgNS, "circle");
    crust.setAttribute("cx", "100");
    crust.setAttribute("cy", "100");
    crust.setAttribute("r", "96");
    crust.setAttribute("fill", "#fdcb6e");
    crust.setAttribute("stroke", "#e17055");
    crust.setAttribute("stroke-width", "6");
    svg.appendChild(crust);

    const innerBase = document.createElementNS(svgNS, "circle");
    innerBase.setAttribute("cx", "100");
    innerBase.setAttribute("cy", "100");
    innerBase.setAttribute("r", "88");
    innerBase.setAttribute("fill", "#ffeaa7");
    svg.appendChild(innerBase);

    const angleStep = 360 / slicesCount;
    for (let i = 0; i < slicesCount; i++) {
        const startAngle = (i * angleStep - 90) * (Math.PI / 180);
        const endAngle = ((i + 1) * angleStep - 90) * (Math.PI / 180);

        const x1 = 100 + 88 * Math.cos(startAngle);
        const y1 = 100 + 88 * Math.sin(startAngle);
        const x2 = 100 + 88 * Math.cos(endAngle);
        const y2 = 100 + 88 * Math.sin(endAngle);

        const largeArcFlag = angleStep > 180 ? 1 : 0;
        const pathData = `M 100 100 L ${x1} ${y1} A 88 88 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        const slicePath = document.createElementNS(svgNS, "path");
        slicePath.setAttribute("d", pathData);
        slicePath.setAttribute("class", "svg-slice");
        slicePath.setAttribute("fill", "rgba(225, 112, 85, 0.15)");
        slicePath.setAttribute("stroke", "#d63031");
        slicePath.setAttribute("stroke-width", "3");

        slicePath.onclick = () => {
            playSound('click');
            if (slicePath.getAttribute("fill") === "rgba(225, 112, 85, 0.15)") {
                slicePath.setAttribute("fill", "#e17055");
            } else {
                slicePath.setAttribute("fill", "rgba(225, 112, 85, 0.15)");
            }
            state.pizzaSliceSelected = svg.querySelectorAll('.svg-slice[fill="#e17055"]').length;
            document.getElementById('pizza-selected-count').innerText = state.pizzaSliceSelected;
        };

        svg.appendChild(slicePath);
    }

    board.appendChild(svg);
}

function submitPizza() {
    if (state.pizzaWholeSelected === state.pizzaWholeTarget && state.pizzaSliceSelected === state.pizzaSliceTarget) {
        playSound('correct');
        state.score += 1;
        document.getElementById('g2-score').innerText = state.score;
        nextGame2Question();
    } else {
        playSound('wrong');
    }
}

// --- 11. MINIGAME 3: OX BRIDGE ---
function setupGame3() {
    let timeLeft = 30;
    state.bridgeStep = 0;
    document.getElementById('g3-timer').innerText = timeLeft;
    document.getElementById('g3-step').innerText = 0;

    renderBridgeTrack();
    nextGame3Question();

    state.gameTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('g3-timer').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(state.gameTimer);
            finishMinigame(false, 0);
        }
    }, 1000);
}

function renderBridgeTrack() {
    const track = document.getElementById('bridge-track');
    track.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const tile = document.createElement('div');
        tile.className = `step-tile ${i <= state.bridgeStep ? 'active' : ''}`;
        tile.innerText = i;
        track.appendChild(tile);
    }
}

function nextGame3Question() {
    const q = generateMathQuestion('mixed_sub');
    const isTrue = Math.random() > 0.4;

    if (isTrue) {
        state.currentQuestion = { text: `${q.questionText} = ${q.answerStr}`, isCorrect: true };
    } else {
        const fakeW = parseInt(q.answerStr.split(' ')[0], 10) + (Math.random() > 0.5 ? 1 : -1);
        const validFakeW = fakeW < 1 ? 1 : fakeW;
        const fakeStr = `${validFakeW} ${q.sliceTarget}/${q.denom}`;
        state.currentQuestion = { text: `${q.questionText} = ${fakeStr}`, isCorrect: false };
    }

    document.getElementById('g3-question').innerText = state.currentQuestion.text;
}

function chooseOX(userChoice) {
    if (userChoice === state.currentQuestion.isCorrect) {
        playSound('correct');
        state.bridgeStep += 1;
        document.getElementById('g3-step').innerText = state.bridgeStep;
        renderBridgeTrack();

        if (state.bridgeStep >= 5) {
            clearInterval(state.gameTimer);
            finishMinigame(true, 90);
        } else {
            nextGame3Question();
        }
    } else {
        playSound('wrong');
        const char = document.getElementById('bridge-character');
        char.style.transform = 'scale(0.8) rotate(-20deg)';
        setTimeout(() => { char.style.transform = 'none'; }, 300);
    }
}

// --- 12. BOSS BATTLE (NO SCREEN SHAKE, SINGLE CHARACTER, 50G REWARD) ---
function startBossRaid() {
    playSound('click');

    if (state.gold < 100) {
        alert(`🔒 골드가 부족합니다!\n보스전에 입장하려면 100 Gold가 필요합니다. (현재 보유: ${state.gold} G)\n미니게임에서 골드를 먼저 모아오세요!`);
        return;
    }

    // Deduct 100 Gold on Entry
    state.gold -= 100;
    saveData();
    updateUI();

    state.bossHp = 100;
    state.playerHp = 3;
    state.bossQIndex = 0;

    state.bossQuestions = [];
    const types = ['proper', 'mixed_add', 'mixed_sub'];
    for (let i = 0; i < 10; i++) {
        const selectedType = types[i % types.length];
        state.bossQuestions.push(generateMathQuestion(selectedType));
    }

    updateBossHpBar();
    updatePlayerHearts();
    showScreen('screen-boss');
    nextBossQuestion();
}

function updateBossHpBar() {
    const percent = Math.max(0, state.bossHp);
    document.getElementById('boss-hp-bar').style.width = `${percent}%`;
    document.getElementById('boss-hp-text').innerText = `${state.bossHp} / 100`;
}

function updatePlayerHearts() {
    let heartsStr = "";
    for (let i = 0; i < state.playerHp; i++) heartsStr += "❤️";
    document.getElementById('player-hearts').innerText = heartsStr || "💀";
}

function nextBossQuestion() {
    if (state.bossQIndex >= 10 || state.bossHp <= 0) {
        finishBossBattle(true);
        return;
    }

    if (state.playerHp <= 0) {
        finishBossBattle(false);
        return;
    }

    state.bossQIndex++;
    document.getElementById('boss-q-index').innerText = state.bossQIndex;

    const q = state.bossQuestions[state.bossQIndex - 1];
    document.getElementById('boss-question-type').innerText = `🔥 보스 퀴즈 [${q.typeLabel}]`;
    document.getElementById('boss-question').innerText = `${q.questionText} = ?`;

    const quotes = [
        "우리 사이다반 톡톡이! 이번 문제도 맞힐 수 있지?",
        "우와, 제법이구나! 정아쌤의 다음 분수 문제다!",
        "사이다처럼 상큼하게 풀어보자!",
        "마지막까지 집중하는 톡톡이가 사이다반 에이스!"
    ];
    document.getElementById('boss-speech').innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;

    const optionsGrid = document.getElementById('boss-options');
    optionsGrid.innerHTML = '';

    const choices = generateChoices(q);

    choices.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-choice boss-choice';
        btn.innerText = opt;
        btn.onclick = () => handleBossAnswer(opt === q.answerStr);
        optionsGrid.appendChild(btn);
    });

    clearInterval(state.bossTurnTimer);
    const timerFill = document.getElementById('boss-turn-timer');
    timerFill.style.width = '100%';
    let start = Date.now();
    const duration = 12000;

    state.bossTurnTimer = setInterval(() => {
        let elapsed = Date.now() - start;
        let remaining = Math.max(0, 100 - (elapsed / duration * 100));
        timerFill.style.width = `${remaining}%`;

        if (elapsed >= duration) {
            clearInterval(state.bossTurnTimer);
            handleBossAnswer(false);
        }
    }, 100);
}

function handleBossAnswer(isCorrect) {
    clearInterval(state.bossTurnTimer);

    if (isCorrect) {
        playSound('hit');
        state.bossHp -= 15;
        if (state.bossHp < 0) state.bossHp = 0;
        updateBossHpBar();

        // Smooth pulse without annoying screen shake
        const bossSprite = document.getElementById('boss-sprite');
        bossSprite.classList.add('boss-damaged');
        setTimeout(() => { bossSprite.classList.remove('boss-damaged'); }, 300);

        nextBossQuestion();
    } else {
        playSound('wrong');
        state.playerHp -= 1;
        updatePlayerHearts();

        if (state.playerHp <= 0) {
            finishBossBattle(false);
        } else {
            nextBossQuestion();
        }
    }
}

function finishBossBattle(victory) {
    clearInterval(state.bossTurnTimer);

    if (victory) {
        playSound('win');

        // Balanced Reward: +50 Gold (Requires playing minigames to reach 100G again!)
        const prizeGold = 50;
        state.gold += prizeGold;
        state.clears += 3;
        saveData();
        updateUI();

        document.getElementById('result-icon').innerText = '👑';
        document.getElementById('result-title').innerText = '정아쌤 보스전 통과!';
        document.getElementById('result-desc').innerText = '축하합니다! 정아쌤의 10문제를 멋지게 통과하셨습니다!';
        document.getElementById('result-gold-earned').innerText = `+${prizeGold} G (미니게임에서 추가 골드를 모으세요!)`;
    } else {
        playSound('wrong');
        document.getElementById('result-icon').innerText = '👩‍🏫';
        document.getElementById('result-title').innerText = '보스전 실패!';
        document.getElementById('result-desc').innerText = '정아쌤: "괜찮아 톡톡아! 미니게임에서 조금 더 연습하고 도전하렴!"';
        document.getElementById('result-gold-earned').innerText = `+0 G`;
    }
    showScreen('screen-result');
}

// --- 13. HALL OF FAME ---
function openHallOfFame() {
    playSound('click');
    updateHofData();
    renderHofList('gold');
    document.getElementById('screen-hall-of-fame').classList.remove('hidden');
}

function closeHallOfFame() {
    playSound('click');
    document.getElementById('screen-hall-of-fame').classList.add('hidden');
}

function switchHofTab(type) {
    playSound('click');
    document.getElementById('tab-gold').classList.toggle('active', type === 'gold');
    document.getElementById('tab-clear').classList.toggle('active', type === 'clear');
    renderHofList(type);
}

function renderHofList(sortBy = 'gold') {
    const listBody = document.getElementById('hof-list-body');
    listBody.innerHTML = '';

    let hofList = JSON.parse(localStorage.getItem('cider_hof_data')) || [];

    if (sortBy === 'gold') {
        document.getElementById('hof-value-header').innerText = '보유 골드';
        hofList.sort((a, b) => b.gold - a.gold);
    } else {
        document.getElementById('hof-value-header').innerText = '클리어 횟수';
        hofList.sort((a, b) => b.clears - a.clears);
    }

    if (hofList.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="4" style="padding: 24px; color: #636e72; font-size: 1.1rem;">
                🎈 아직 명예의 전당에 등록된 톡톡이가 없어요!<br><strong>첫 번째 주인공이 되어보세요!</strong>
            </td>
        `;
        listBody.appendChild(tr);
    } else {
        const top10 = hofList.slice(0, 10);
        top10.forEach((item, index) => {
            const tr = document.createElement('tr');
            if (item.name === state.playerName) {
                tr.style.background = '#ffeaa7';
                tr.style.fontWeight = 'bold';
            }

            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}위`;

            tr.innerHTML = `
                <td>${medal}</td>
                <td>${item.name}</td>
                <td>${sortBy === 'gold' ? item.gold + ' G' : item.clears + '회'}</td>
                <td>${item.clears}회</td>
            `;
            listBody.appendChild(tr);
        });
    }

    document.getElementById('my-hof-name').innerText = state.playerName;
    document.getElementById('my-hof-gold').innerText = `${state.gold}G`;
    document.getElementById('my-hof-clears').innerText = `${state.clears}회`;
}
