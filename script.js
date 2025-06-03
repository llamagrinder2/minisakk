// Globális változók a játék állapotához és a táblához
var board = null;
var game = new Chess(); // Létrehozzuk a Chess.js játék példányát

// AI Beállítások
var ai_depth = 2; // Alapértelmezett nehézség
var ai_enabled = true; // AI alapból BEKAPCSOLVA!

// ÚJ VÁLTOZÓK A KATTINTÁSOS LÉPÉSHEZ
var selectedSquare = null; // Tárolja az aktuálisan kijelölt mezőt

// Kiemelés CSS osztály
const HIGHLIGHT_CLASS = 'highlight-move'; // Új CSS osztály a lehetséges lépések kiemeléséhez

// Referencia az AI log display elemre
var aiLogDisplay = null; // Inicializálás document ready-ben

// ÚJ FÜGGVÉNY: Üzenet hozzáadása az AI log displayhez ÉS a konzolhoz
function log(message, toConsole = true) {
    if (aiLogDisplay) {
        // Hozzáadjuk a log üzenetet egy új span elemben
        // Mivel a flex-direction: column-reverse, a legújabb elemek kerülnek alulra
        aiLogDisplay.append('<span>' + message + '</span><br>');
        // Nincs szükség scrollTop-ra, a flexbox elrendezi a gördülést
    }
    if (toConsole) {
        console.log(message);
    }
}


// Játék vége üzenet megjelenítése
function displayGameOver() {
    alert('Játék vége! ' + (game.in_checkmate() ? 'Sakk-matt!' : 'Döntetlen.'));
}

// Törli az összes kiemelést
function removeHighlights() {
    $('#board .square-55d63').removeClass(HIGHLIGHT_CLASS);
    $('#board .square-55d63').removeClass('highlight-square'); // A kijelölt bábu mezőjének kiemelését is törli
}

// Kiemeli a lehetséges lépéseket
function highlightValidMoves(square) {
    var moves = game.moves({
        square: square,
        verbose: true
    });

    // Ne legyen kiemelés, ha nincs hova lépni
    if (moves.length === 0) return;

    // Kiemeljük magát a kijelölt mezőt (az alap 'highlight-square' osztállyal)
    $('#board .square-' + square).addClass('highlight-square');

    // Kiemeljük a lehetséges célmezőket az új osztállyal
    for (var i = 0; i < moves.length; i++) {
        $('#board .square-' + moves[i].to).addClass(HIGHLIGHT_CLASS);
    }
}

// Kezeli a mezőre kattintásokat
function onSquareClick(square) {
    // Ha már van kiválasztott bábu
    if (selectedSquare) {
        // Próbáljuk meg végrehajtani a lépést a kijelölt báburól a kattintott mezőre
        var move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q' // Mindig vezért választunk, ha gyalog ér az ellenfél alapvonalára
        });

        // Ha a lépés érvényes
        if (move !== null) {
            board.position(game.fen()); // Frissítjük a táblát
            removeHighlights(); // Töröljük az összes kiemelést
            selectedSquare = null; // Reseteljük a kijelölt mezőt
            log("Játékos lépett: " + move.from + move.to);
            // Ellenőrizzük, vége van-e a játéknak
            if (game.game_over()) {
                displayGameOver();
            } else if (ai_enabled && window.sunfishWorker) {
                log("AI gondolkodik...");
                makeAiMove(); // Ha AI, AI lép
            }
        } else {
            // Érvénytelen lépés
            removeHighlights();
            
            // Csak akkor jelölünk ki új bábut, ha a kattintott mezőn saját bábu van
            var piece = game.get(square);
            if (piece && piece.color === game.turn()) {
                selectedSquare = square; // Az új kattintás egy új kijelölést jelent
                highlightValidMoves(square);
            } else {
                selectedSquare = null;
            }
        }
    } else {
        // Nincs kiválasztott bábu, most jelölünk ki egyet
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { // Csak akkor jelöljünk ki, ha saját bábu
            selectedSquare = square;
            highlightValidMoves(square);
        } else {
            selectedSquare = null;
        }
    }
}

// A lépések kezelése húzással (marad az onDrop)
function onDrop(source, target) {
    log("onDrop called!");

    removeHighlights();
    selectedSquare = null;

    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) {
        log("Érvénytelen lépés, snapback.");
        return 'snapback';
    }

    board.position(game.fen());

    if (game.game_over()) {
        displayGameOver();
        return;
    }

    if (ai_enabled && window.sunfishWorker) {
        log("AI gondolkodik...");
        makeAiMove();
    }
}

// A chessboard.js konfigurációja
var config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop,
    onSnapEnd: function() {
        // Ezt a Chessboard.js visszahívását nem használjuk aktívan, de lehet hagyni.
    },
    pieceTheme: 'img/{piece}.png'
};


// Várjuk meg, amíg a DOM teljesen betöltődik
$(document).ready(function() {
    aiLogDisplay = $('#ai-log-display'); // Inicializáljuk itt a DOM elem referenciáját

    // Web Worker inicializálása
    if (window.sunfishWorker) {
        window.sunfishWorker.onmessage = function(event) {
            var message = event.data;
            if (message.startsWith("bestmove")) {
                var bestmove = message.split(" ")[1];
                log("AI lépés: " + bestmove);
                if (bestmove && bestmove !== "(none)") {
                    var source = bestmove.substring(0, 2);
                    var target = bestmove.substring(2, 4);
                    var promotion = bestmove.substring(4, 5) || '';

                    var move = game.move({
                        from: source,
                        to: target,
                        promotion: promotion
                    });

                    if (move) {
                        board.position(game.fen());
                        if (game.game_over()) {
                            displayGameOver();
                        }
                    } else {
                        log("AI érvénytelen lépést küldött: " + bestmove, true);
                    }
                }
            } else if (message.startsWith("info")) {
                log("AI info: " + message, false); // NE legyen konzolban, csak a háttérben
            } else {
                log("AI üzenet: " + message, false); // Egyéb AI üzenetek is csak UI-ban
            }
        };

        window.sunfishWorker.onerror = function(error) {
            log("Sunfish Web Worker hiba: " + (error.message || error), true);
        };

        window.sunfishWorker.postMessage("uci");
        window.sunfishWorker.postMessage("isready");
        window.sunfishWorker.postMessage("ucinewgame");

        log("AI alapból bekapcsolva, nehézség: " + ai_depth);
    } else {
        log("A Sunfish Web Worker nem elérhető. Az AI funkciók nem lesznek elérhetők.", true);
    }

    // Tábla inicializálása
    board = Chessboard('board', config);

    // Hozzáadjuk a kattintás eseményfigyelőt a tábla minden mezőjéhez
    $('#board').on('click', '.square-55d63', function() {
        var square = $(this).attr('data-square');
        onSquareClick(square);
    });

    // Nehézség kijelző frissítése
    updateDifficultyDisplay();

    // Gomb eseménykezelők
    $('#increaseDifficulty').on('click', function() {
        ai_depth = Math.min(ai_depth + 1, 5);
        updateDifficultyDisplay();
        log('AI nehézség növelve: ' + ai_depth);
    });

    $('#decreaseDifficulty').on('click', function() {
        ai_depth = Math.max(ai_depth - 1, 1);
        updateDifficultyDisplay();
        log('AI nehézség csökkentve: ' + ai_depth);
    });

    $('#resetGame').on('click', function() {
        resetGame();
    });
});

// AI lépés kérése
function makeAiMove() {
    var moves_history = game.history({ verbose: true });
    var uci_moves = moves_history.map(m => m.from + m.to + (m.promotion || '')).join(' ');
    log("AI-nak küldött parancs: position startpos moves " + uci_moves);
    window.sunfishWorker.postMessage("position startpos moves " + uci_moves);

    log("AI-nak küldött parancs: go depth " + ai_depth);
    window.sunfishWorker.postMessage("go depth " + ai_depth);
}

// Tábla láthatóságának váltása (Ctrl+Alt+S)
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.altKey && event.key === 's') {
        toggleBoardVisibility();
        event.preventDefault();
    }
});

function toggleBoardVisibility() {
    const boardElement = document.getElementById('board');
    if (boardElement.classList.contains('hidden-board')) {
        boardElement.classList.remove('hidden-board');
        boardElement.classList.add('small-board');
    } else {
        boardElement.classList.add('hidden-board');
        boardElement.classList.remove('small-board');
    }
}

// Nehézség kijelző frissítése
function updateDifficultyDisplay() {
    $('#ai-difficulty-display').text(ai_depth);
}

// Játék újraindítása
function resetGame() {
    game.reset();
    board.position('start');
    ai_depth = 2;
    updateDifficultyDisplay();
    if (window.sunfishWorker) {
        window.sunfishWorker.postMessage("ucinewgame");
    }
    log("Játék újraindítva.");
    removeHighlights();
    selectedSquare = null;
    aiLogDisplay.empty(); // Töröljük a logokat is
}
