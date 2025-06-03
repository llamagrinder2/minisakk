// Globális változók a játék állapotához és a táblához asdasd
var board = null;
var game = new Chess(); // Létrehozzuk a Chess.js játék példányát

// AI Beállítások
var ai_depth = 2; // Alapértelmezett nehézség
var ai_enabled = true; // AI alapból BEKAPCSOLVA!

// Sunfish Web Worker változó
var sunfishWorker;

// ÚJ VÁLTOZÓK A KATTINTÁSOS LÉPÉSHEZ
var selectedSquare = null; // Tárolja az aktuálisan kijelölt mezőt

// Kiemelés CSS osztály
const HIGHLIGHT_CLASS = 'highlight-move'; // Új CSS osztály a lehetséges lépések kiemeléséhez

// Játék vége üzenet megjelenítése
function displayGameOver() {
    alert('Játék vége! ' + (game.in_checkmate() ? 'Sakk-matt!' : 'Döntetlen.'));
}

// ÚJ FÜGGVÉNY: Törli az összes kiemelést
function removeHighlights() {
    $('#board .square-55d63').removeClass(HIGHLIGHT_CLASS);
    $('#board .square-55d63').removeClass('highlight-square'); // A kijelölt bábu mezőjének kiemelését is törli
    // selectedSquare = null; // Ezt az onSquareClick kezeli intelligensen
}

// ÚJ FÜGGVÉNY: Kiemeli a lehetséges lépéseket
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

// ÚJ FÜGGVÉNY: Kezeli a mezőre kattintásokat
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
            // Ellenőrizzük, vége van-e a játéknak
            if (game.game_over()) {
                displayGameOver();
            } else if (ai_enabled && sunfishWorker) {
                makeAiMove(); // Ha AI, AI lép
            }
        } else {
            // Érvénytelen lépés (pl. nem oda lépett, ahova lehetett volna, vagy ellenfél bábujára kattintott újra)
            removeHighlights(); // Töröljük a régi kijelöléseket
            
            // Csak akkor jelölünk ki új bábut, ha a kattintott mezőn saját bábu van
            var piece = game.get(square);
            if (piece && piece.color === game.turn()) {
                selectedSquare = square; // Az új kattintás egy új kijelölést jelent
                highlightValidMoves(square);
            } else {
                selectedSquare = null; // Nincs bábu, vagy nem saját bábu, töröljük a kijelölést
            }
        }
    } else {
        // Nincs kiválasztott bábu, most jelölünk ki egyet
        var piece = game.get(square);
        if (piece && piece.color === game.turn()) { // Csak akkor jelöljünk ki, ha saját bábu
            selectedSquare = square;
            highlightValidMoves(square);
        } else {
            // Nincs bábu, vagy nem saját bábu, nem teszünk semmit
            selectedSquare = null;
        }
    }
}

// A lépések kezelése húzással (marad az onDrop)
function onDrop(source, target) {
    console.log("onDrop called!");

    removeHighlights(); // Töröljük a kiemeléseket, ha húzással léptünk
    selectedSquare = null; // Reseteljük a kijelölt mezőt húzás esetén is

    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) {
        console.log("Érvénytelen lépés, snapback.");
        return 'snapback';
    }

    board.position(game.fen());

    if (game.game_over()) {
        displayGameOver();
        return;
    }

    if (ai_enabled && sunfishWorker) {
        console.log("onDrop: AI makeAiMove() hívás feltétel teljesült.");
        makeAiMove();
    } else {
        console.log("onDrop: AI feltétel NEM teljesült. ai_enabled:", ai_enabled, " sunfishWorker:", sunfishWorker);
    }
}

// A chessboard.js konfigurációja
var config = {
    draggable: true, // Lehet-e húzni a bábukat (ezt meghagyjuk)
    position: 'start', // Kezdő pozíció
    onDrop: onDrop, // Ha eldobnak egy bábut
    onSnapEnd: function() {
        // A Chessboard.js visszahívása, amikor egy bábu mozgás animációja befejeződik
        // Itt általában a board.position(game.fen()) hívást szokták elhelyezni,
        // de az onDrop vagy onSquareClick már frissíti a táblát, így itt nem feltétlen szükséges.
    },
    onSquareClick: onSquareClick, // ÚJ: Kezeli a mezőre kattintásokat
    pieceTheme: 'img/{piece}.png'
};


// Várjuk meg, amíg a DOM teljesen betöltődik
$(document).ready(function() {
    // Web Worker inicializálása
    // Ellenőrizni kell, hogy létezik-e window.Worker (Web Worker támogatás)
    if (window.Worker) {
        // Itt a sunfish.js fájlnév kisbetűsre javítva, ahogy korábban megbeszéltük
        sunfishWorker = new Worker('lib/sunfish.js');
        console.log("Sunfish Web Worker indítva.");

        sunfishWorker.onmessage = function(event) {
            var message = event.data;
            if (message.startsWith("bestmove")) {
                var bestmove = message.split(" ")[1];
                console.log("AI returned bestmove: ", bestmove);
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
                        console.error("AI érvénytelen lépést küldött: ", bestmove);
                    }
                }
            } else if (message.startsWith("info")) {
                // console.log("AI info: ", message); // UNCOMMENT THIS FOR MORE VERBOSE AI LOGS
            }
        };

        sunfishWorker.onerror = function(error) {
            console.error("Sunfish Web Worker hiba: ", error);
        };

        sunfishWorker.postMessage("uci");
        sunfishWorker.postMessage("isready");
        sunfishWorker.postMessage("ucinewgame");

        console.log("AI alapból bekapcsolva, nehézség: " + ai_depth);
    } else {
        console.error("A böngésző nem támogatja a Web Workereket, vagy a Sunfish Web Worker nem elérhető.");
    }

    // Tábla inicializálása
    board = Chessboard('board', config);

    // Nehézség kijelző frissítése
    updateDifficultyDisplay();

    // Gomb eseménykezelők
    $('#increaseDifficulty').on('click', function() {
        ai_depth = Math.min(ai_depth + 1, 5); // Max 5-ös nehézség
        updateDifficultyDisplay();
        alert('AI nehézség növelve: ' + ai_depth);
    });

    $('#decreaseDifficulty').on('click', function() {
        ai_depth = Math.max(ai_depth - 1, 1); // Min 1-es nehézség
        updateDifficultyDisplay();
        alert('AI nehézség csökkentve: ' + ai_depth);
    });

    $('#resetGame').on('click', function() {
        resetGame();
    });
});

// AI lépés kérése
function makeAiMove() {
    var moves_history = game.history({ verbose: true });
    var uci_moves = moves_history.map(m => m.from + m.to + (m.promotion || '')).join(' ');
    console.log("Sending to AI: position startpos moves " + uci_moves);
    sunfishWorker.postMessage("position startpos moves " + uci_moves);
    
    console.log("Sending to AI: go depth " + ai_depth);
    sunfishWorker.postMessage("go depth " + ai_depth);
}

// Tábla láthatóságának váltása (Ctrl+Alt+S)
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.altKey && event.key === 's') {
        toggleBoardVisibility();
        event.preventDefault(); // Megakadályozza az alapértelmezett böngésző funkciót
    }
});

function toggleBoardVisibility() {
    const boardElement = document.getElementById('board');
    // Itt a 'small-board' osztályt használjuk, hogy visszatérjünk a normál kis mérethez, ha látható
    if (boardElement.classList.contains('hidden-board')) {
        boardElement.classList.remove('hidden-board');
        boardElement.classList.add('small-board'); // Alapértelmezett "kis" méret
    } else {
        boardElement.classList.add('hidden-board');
        boardElement.classList.remove('small-board'); // Töröljük a "kis" méretet, ha elrejtjük
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
    ai_depth = 2; // AI nehézség visszaállítása az alapértelmezettre
    updateDifficultyDisplay();
    if (sunfishWorker) {
        sunfishWorker.postMessage("ucinewgame"); // Értesítjük az AI-t az új játékról
    }
    console.log("Játék újraindítva. AI bekapcsolva, nehézség alaphelyzetben.");
    removeHighlights(); // Resetnél is töröljük a kijelöléseket
    selectedSquare = null; // Reseteljük a kijelölt mezőt is
}
