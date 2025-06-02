// Globális változók a játék állapotához és a táblához
var board = null;
var game = new Chess(); // Létrehozzuk a Chess.js játék példányát

// AI Beállítások
var ai_depth = 2; // Alapértelmezett nehézség
var ai_enabled = true; // AI alapból BEKAPCSOLVA!

// Sunfish Web Worker változó
var sunfishWorker;

// Játék vége üzenet megjelenítése
function displayGameOver() {
    alert('Játék vége! ' + (game.in_checkmate() ? 'Sakk-matt!' : 'Döntetlen.'));
}

// A bábu mozgatásának animációja utáni esemény
function onSnapEnd () {
    // Ezt már az onDrop-ban hívjuk, itt nem kell újra
}

// A lépések kezelése
function onDrop (source, target) {
    console.log("onDrop called!"); // DEBUG LOG: Ellenőrizd, hogy ez megjelenik-e a konzolban

    // Próbáljuk meg végrehajtani a lépést
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Mindig vezért választunk, ha gyalog ér az ellenfél alapvonalára
    });

    // Érvénytelen lépés esetén visszavontatjuk a bábut
    if (move === null) {
        console.log("Érvénytelen lépés, snapback."); // DEBUG LOG
        return 'snapback';
    }

    // Frissítjük a tábla pozícióját a játék állapotához igazítva
    board.position(game.fen());

    // Ellenőrizzük, vége van-e a játéknak
    if (game.game_over()) {
        displayGameOver();
        console.log("Játék vége."); // DEBUG LOG
        return;
    }

    // Ha az AI be van kapcsolva és az ellenfél lépett (vagyis most az AI következik)
    if (ai_enabled && sunfishWorker) {
        console.log("onDrop: AI makeAiMove() hívás feltétel teljesült."); // DEBUG LOG
        makeAiMove();
    } else {
        console.log("onDrop: AI feltétel NEM teljesült. ai_enabled:", ai_enabled, " sunfishWorker:", sunfishWorker); // DEBUG LOG
    }
}

// A chessboard.js konfigurációja - FONTOS: Ez a blokk előrébb került!
var config = {
    draggable: true, // Lehet-e húzni a bábukat
    position: 'start', // Kezdő pozíció
    onDrop: onDrop, // Ha eldobnak egy bábut
    onSnapEnd: onSnapEnd, // Ha befejeződik a snapback animáció (a bábu "helyre pattan")
    pieceTheme: 'img/{piece}.png' // Ez megmondja, hogy az 'img' mappában keresse a "{piece}.png" nevű fájlokat
};


// Várjuk meg, amíg a DOM teljesen betöltődik
$(document).ready(function() {
    // A SunfishWorker az index.html-ben van inicializálva.
    // Győződj meg róla, hogy az index.html-ben a script.js betöltése ELŐTT inicializálod a Web Workert!
    // Példa: <script> var sunfishWorker = new Worker('lib/Sunfish.js'); </script>
    if (window.sunfishWorker) {
        sunfishWorker = window.sunfishWorker;

        // Üzenetek fogadása a Web Workertől
        sunfishWorker.onmessage = function(event) {
            var message = event.data;
            if (message.startsWith("bestmove")) {
                var bestmove = message.split(" ")[1];
                console.log("AI returned bestmove: ", bestmove); // DEBUG LOG
                if (bestmove && bestmove !== "(none)") {
                    // UCI formátumú lépés (pl. e2e4, g1f3, e7e8q) átalakítása Chess.js formátumra
                    var source = bestmove.substring(0, 2);
                    var target = bestmove.substring(2, 4);
                    var promotion = bestmove.substring(4, 5) || '';

                    var move = game.move({
                        from: source,
                        to: target,
                        promotion: promotion // Pl. 'q' a vezérpromócióhoz
                    });

                    if (move) {
                        board.position(game.fen());
                        if (game.game_over()) {
                            displayGameOver();
                        } else {
                            // Ha a játék még tart és az AI lépett, frissítjük a kijelzőt (opcionális)
                            updateDifficultyDisplay(); // Esetleg ez nem kellene itt, ha az AI lép, a nehézség nem változik
                        }
                    } else {
                        console.error("AI érvénytelen lépést küldött: ", bestmove);
                    }
                }
            } else if (message.startsWith("info")) {
                // Konzolra írjuk az AI info üzeneteit, ha szükséges
                // console.log("AI info: ", message); // UNCOMMENT THIS FOR MORE VERBOSE AI LOGS
            }
        };

        // Kezdeti kommunikáció az AI-val
        sunfishWorker.postMessage("uci");
        sunfishWorker.postMessage("isready");
        sunfishWorker.postMessage("ucinewgame");

        console.log("AI alapból bekapcsolva, nehézség: " + ai_depth);
    } else {
        console.error("Sunfish Web Worker nem elérhető. Kérjük, ellenőrizze az index.html fájlt.");
    }

    // A Chessboard inicializálása
    board = Chessboard('board', config);

    // Kezdetben frissítjük a nehézségi szint kijelzőjét
    updateDifficultyDisplay();

    // Eseménykezelők a gombokhoz
    $('#increaseDifficulty').on('click', function() {
        // AI könnyebb (nagyobb mélység)
        ai_depth = Math.min(ai_depth + 1, 5); // Max 5-ös mélység (kerüljük a túl lassú számítást)
        updateDifficultyDisplay();
        alert('AI nehézség növelve: ' + ai_depth);
    });

    $('#decreaseDifficulty').on('click', function() {
        // AI nehezebb (kisebb mélység)
        ai_depth = Math.max(ai_depth - 1, 1); // Min 1-es mélység
        updateDifficultyDisplay();
        alert('AI nehézség csökkentve: ' + ai_depth);
    });

    $('#resetGame').on('click', function() {
        resetGame();
    });
});

// Az AI lépésének kezdeményezése
function makeAiMove() {
    // Elküldjük az AI-nak az aktuális pozíciót
    // UCI "position startpos moves ..." formátum
    var moves_history = game.history({ verbose: true });
    var uci_moves = moves_history.map(m => m.from + m.to + (m.promotion || '')).join(' ');
    console.log("Sending to AI: position startpos moves " + uci_moves); // DEBUG LOG
    sunfishWorker.postMessage("position startpos moves " + uci_moves);
    
    // Elküldjük a "go depth X" parancsot, ahol X az ai_depth
    console.log("Sending to AI: go depth " + ai_depth); // DEBUG LOG
    sunfishWorker.postMessage("go depth " + ai_depth);
}


// ---------- Diszkrécióhoz kapcsolódó funkciók és AI vezérlés ----------

document.addEventListener('keydown', function(event) {
    // Diszkréciós billentyű (Ctrl + Alt + S)
    if (event.ctrlKey && event.altKey && event.key === 's') {
        toggleBoardVisibility();
        event.preventDefault();
    }
});

function toggleBoardVisibility() {
    const boardElement = document.getElementById('board');
    if (boardElement.classList.contains('hidden-board')) {
        boardElement.classList.remove('hidden-board');
        boardElement.classList.add('small-board'); // Ne feledd, a small-board osztály definiálva legyen a CSS-ben
    } else {
        boardElement.classList.add('hidden-board');
        boardElement.classList.remove('small-board');
    }
}

// Frissíti a nehézségi szint kijelzőjét
function updateDifficultyDisplay() {
    $('#ai-difficulty-display').text(ai_depth);
}

// A játék újraindítása
function resetGame() {
    game.reset();
    board.position('start');
    // AI már alapból bekapcsolva van, csak a nehézséget állítjuk vissza
    ai_depth = 2; // Nehézség alaphelyzetbe állítása
    updateDifficultyDisplay(); // Frissítjük a kijelzőt
    if (sunfishWorker) {
        sunfishWorker.postMessage("ucinewgame"); // Értesítjük az AI-t is
    }
    console.log("Játék újraindítva. AI bekapcsolva, nehézség alaphelyzetben.");
}
