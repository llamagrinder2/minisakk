// Globális változók a játék állapotához és a táblához
var board = null;
var game = new Chess(); // Létrehozzuk a Chess.js játék példányát

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

  // Játék vége ellenőrzése
  if (game.game_over()) {
    // Alert helyett ide írhatnánk valami diszkrétebb üzenetet a tábla alá
    alert('Játék vége! ' + (game.in_checkmate() ? 'Sakk-matt!' : 'Döntetlen.'));
    // Itt lehetne újraindító gombot megjeleníteni, vagy automatikusan újraindítani
  }
}

// A bábu mozgatásának animációja utáni esemény
function onSnapEnd () {
  board.position(game.fen()); // Frissítjük a tábla pozícióját a játék állapotához igazítva
}

// A chessboard.js konfigurációja
var config = {
  draggable: true, // Lehet-e húzni a bábukat
  position: 'start', // Kezdő pozíció
  onDrop: onDrop, // Ha eldobnak egy bábut
  onSnapEnd: onSnapEnd, // Ha befejeződik a snapback animáció (a bábu "helyre pattan")
  // EZ AZ ÚJ SOR: Itt adjuk meg, hol találja a bábuk képeit
  pieceTheme: 'img/{piece}.png' // Ez megmondja, hogy az 'img' mappában keresse a "{piece}.png" nevű fájlokat
};

// A tábla inicializálása, ha a DOM készen áll
$(document).ready(function() {
    board = Chessboard('board', config);
    // Beállítjuk a tábla alapértelmezett méretét a .small-board CSS osztály szerint
    // Ezt a CSS már kezeli, de ha dinamikusan akarnánk állítani, akkor itt lehetne:
    // board.resize(); 
});

// ---------- Diszkrécióhoz kapcsolódó funkciók (fejlettebb, de hasznos lehet) ----------

// Példa egy gyorsbillentyűre az ablak elrejtéséhez/megjelenítéséhez
// Ezt a böngésző biztonsági beállításai miatt korlátozhatják, de érdemes próbálkozni.
// Alternatívaként egy kis ikonra kattintás lehet jobb.
document.addEventListener('keydown', function(event) {
    // Példa: Ctrl + Alt + S billentyűkombináció az elrejtésre/megjelenítésre
    if (event.ctrlKey && event.altKey && event.key === 's') {
        const boardElement = document.getElementById('board');
        if (boardElement.classList.contains('hidden-board')) {
            boardElement.classList.remove('hidden-board');
            boardElement.classList.add('small-board'); // Visszaállítjuk a kis méretet
        } else {
            boardElement.classList.add('hidden-board');
            boardElement.classList.remove('small-board');
        }
        event.preventDefault(); // Megakadályozza a böngésző alapértelmezett viselkedését
    }
});

// A tábla elrejtése/megjelenítése egy gombnyomásra (ha hozzáadnánk egy gombot)
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

// Ezt a funkciót hozzáadhatod egy gombhoz a HTML-ben, pl:
// <button onclick="toggleBoardVisibility()">Elrejt / Megjelenít</button>
