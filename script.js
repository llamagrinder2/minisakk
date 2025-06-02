// Globális változók a játék állapotához és a táblához
var board = null;
var game = new Chess(); // Létrehozzuk a Chess.js játék példányát

// AI Beállítások
// A nehézséget a Web Worker-nek küldjük el.
var ai_depth = 2; // Alapértelmezett nehézség
var ai_enabled = false; // AI kikapcsolva alapból

// Sunfish Web Worker változó (az index.html-ben definiált)
// Előfordulhat, hogy ez nem elérhető azonnal, ha a script.js hamarabb fut le.
// Kérlek, győződj meg róla, hogy a script.js a Sunfish Worker után töltődik be az index.html-ben.
// Az "if (window.sunfishWorker)" ellenőrzés segít, ha az index.html globális változóként hozta létre.
var sunfishWorker; // deklaráljuk, hogy globális legyen, de az index.html fogja inicializálni

// Várjuk meg, amíg a DOM teljesen betöltődik
$(document).ready(function() {
    // A SunfishWorker az index.html-ben van inicializálva.
    // Itt hivatkozunk rá, feltételezve, hogy globálisan elérhető.
    if (window.sunfishWorker) {
        sunfishWorker = window.sunfishWorker;

        // Üzenetek fogadása a Web Workertől
        sunfishWorker.onmessage = function(event) {
            var message = event.data;
            if (message.startsWith("bestmove")) {
                var bestmove = message.split(" ")[1];
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
                        }
                    } else {
                        console.error("AI érvénytelen lépést küldött: ", bestmove);
                    }
                }
            } else if (message.startsWith("info")) {
                console.log("AI info: ", message);
            }
        };

        // Kezdeti kommunikáció az AI-val
        sunfishWorker.postMessage("uci");
        sunfishWorker.postMessage("isready");
        sunfishWorker.postMessage("ucinewgame");

        console.log("AI kezdetben: " + (ai_enabled ? "bekapcsolva" : "kikapcsolva") + ", Nehézség: " + ai_depth);
    } else {
        console.error("Sunfish Web Worker nem elérhető. Kérjük, ellenőrizze az index.html fájlt.");
    }

    board = Chessboard('board', config);
});

// A lépések kezelése
function onDrop (source, target) {
  // Próbáljuk meg végrehajtani a lépést
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // Mindig vezért választunk, ha gyalog ér az ellenfél alapvonalára
  });

  // Érvénytelen lépés esetén visszavontatjuk a bábut
  if (move === null) return 'snapback';

  // Frissítjük a tábla pozícióját a játék állapotához igazítva
  board.position(game.fen());

  // Ellenőrizzük, vége van-e a játéknak
  if (game.game_over()) {
    displayGameOver();
    return;
  }

  // Ha az AI be van kapcsolva és az ellenfél lépett (vagyis most az AI következik)
  if (ai_enabled && sunfishWorker) {
    // Elküldjük az AI-nak az aktuális pozíciót
    // UCI "position startpos moves ..." formátum
    var moves_history = game.history({ verbose: true });
    var uci_moves = moves_history.map(m => m.from + m.to + (m.promotion || '')).join(' ');
    sunfishWorker.postMessage("position startpos moves " + uci_moves);
    
    // Elküldjük a "go depth X" parancsot, ahol X az ai_depth
    sunfishWorker.postMessage("go depth " + ai_depth);
  }
}

// Játék vége üzenet megjelenítése
function displayGameOver() {
  alert('Játék vége! ' + (game.in_checkmate() ? 'Sakk-matt!' : 'Döntetlen.'));
}

// A bábu mozgatásának animációja utáni esemény
function onSnapEnd () {
  // Ezt már az onDrop-ban hívjuk, itt nem kell újra
}

// A chessboard.js konfigurációja
var config = {
  draggable: true, // Lehet-e húzni a bábukat
  position: 'start', // Kezdő pozíció
  onDrop: onDrop, // Ha eldobnak egy bábut
  onSnapEnd: onSnapEnd, // Ha befejeződik a snapback animáció (a bábu "helyre pattan")
  pieceTheme: 'img/{piece}.png' // Ez megmondja, hogy az 'img' mappában keresse a "{piece}.png" nevű fájlokat
};


// ---------- Diszkrécióhoz kapcsolódó funkciók és AI vezérlés ----------

document.addEventListener('keydown', function(event) {
    // Diszkréciós billentyű
    if (event.ctrlKey && event.altKey && event.key === 's') {
        const boardElement = document.getElementById('board');
        if (boardElement.classList.contains('hidden-board')) {
            boardElement.classList.remove('hidden-board');
            boardElement.classList.add('small-board');
        } else {
            boardElement.classList.add('hidden-board');
            boardElement.classList.remove('small-board');
        }
        event.preventDefault();
    }
    // Gyorsbillentyű az AI be-/kikapcsolására (pl. Ctrl + Alt + A)
    if (event.ctrlKey && event.altKey && event.key === 'a') {
        ai_enabled = !ai_enabled;
        alert('AI ' + (ai_enabled ? 'bekapcsolva' : 'kikapcsolva') + ', Aktuális nehézség: ' + ai_depth);
        // Ha az AI bekapcsolódik és épp az ő köre van (fekete), akkor lép
        if (ai_enabled && game.turn() === 'b' && sunfishWorker) { // Feltételezzük, hogy az AI a fekete
            var moves_history = game.history({ verbose: true });
            var uci_moves = moves_history.map(m => m.from + m.to + (m.promotion || '')).join(' ');
            sunfishWorker.postMessage("position startpos moves " + uci_moves);
            sunfishWorker.postMessage("go depth " + ai_depth);
        }
        event.preventDefault();
    }
    // Gyorsbillentyű a nehézség növelésére (pl. Ctrl + Alt + ArrowUp)
    if (event.ctrlKey && event.altKey && event.key === 'ArrowUp') {
        ai_depth = Math.min(ai_depth + 1, 5); // Max 5-ös mélység (kerüljük a túl lassú számítást)
        alert('AI nehézség növelve: ' + ai_depth);
        event.preventDefault();
    }
    // Gyorsbillentyű a nehézség csökkentésére (pl. Ctrl + Alt + ArrowDown)
    if (event.ctrlKey && event.altKey && event.key === 'ArrowDown') {
        ai_depth = Math.max(ai_depth - 1, 1); // Min 1-es mélység
        alert('AI nehézség csökkentve: ' + ai_depth);
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

// A játék újraindítása
function resetGame() {
    game.reset();
    board.position('start');
    ai_enabled = false; // AI kikapcsolása újraindításkor
    ai_depth = 2; // Nehézség alaphelyzetbe állítása
    if (sunfishWorker) {
        sunfishWorker.postMessage("ucinewgame"); // Értesítjük az AI-t is
    }
    console.log("Játék újraindítva. AI kikapcsolva, nehézség alaphelyzetben.");
}
