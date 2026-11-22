// ==================================================
// MODELO: los datos del mundo
// ==================================================
// Aquí solo se guardan y se crean datos. Nada se dibuja.
// Más adelante aquí también irán los datos del usuario
// (nombre, score) que se envían a Firebase.

let mundo   = matriz(COLUMNAS, FILAS, 0);    // qué hay en cada celda (VACIO, FLOR, HONGO...)
let terreno = matriz(COLUMNAS, FILAS, 0);  // densidad del bosque de 0 a 1 (sirve para sombrear el suelo)

let luzFlor = matriz(COLUMNAS, FILAS, 0);  // luz que le queda a cada flor (0 a LUZ_MAX_FLOR)
let florApagada = matriz(COLUMNAS, FILAS, false);  // true mientras se recarga (nadie la busca)
let progresoRebrote = matriz(COLUMNAS, FILAS, 0);  // flor destruida: de 0 a 1 mientras las hadas la cuidan

let arbolCol, arbolFila;      // celda central del Árbol Madre
let capulloCol, capulloFila;  // celda del Capullo original (junto al Árbol)
let totalFlores;              // cuántas flores generó el mundo

let luzArbol;               // luz guardada en el Árbol Madre (generador): servirá para defensas
// Capullos (origen): cada uno junta su propia luz; al llegar a costoNacer() nace un hada ahí.
// El primero está junto al Árbol; el jugador puede comprar más.
class Capullo {
  c = 0;f = 0;
  luz = 0;
  constructor(c, f) {
    this.c = c;
    this.f = f;
  }
  carga() { return constrain(this.luz / costoNacer(), 0, 1); }
}
let capullos = [];

function luzCapullos() {
  let total = 0;
  for (const cap of capullos) total += cap.luz;
  return total;
}

function capulloMasCercano(x, y) {
  let mejor = capullos.get(0);
  for (const cap of capullos)
    if (dist(x, y, centroX(cap.c), centroY(cap.f)) < dist(x, y, centroX(mejor.c), centroY(mejor.f))) mejor = cap;
  return mejor;
}

// El capullo más cerca de hacer nacer un hada (para la barra del marcador)
function cargaMaximaCapullos() {
  let m = 0;
  for (const cap of capullos) m = max(m, cap.carga());
  return m;
}

// Sube cada vez que cambia un obstáculo. Las hadas lo comparan con el de su ruta
// para saber si tienen que revisar si su camino quedó bloqueado.
let versionMapa = 0;

// Crea el bosque a partir de una semilla.
// Misma semilla = mismo bosque; otra semilla = otro bosque.
function generarMundo(nuevaSemilla) {
  semilla = nuevaSemilla;
  noiseSeed(semilla);
  randomSeed(semilla);

  arbolCol    = COLUMNAS / 2;
  arbolFila   = FILAS / 2;
  capulloCol  = arbolCol + 3;
  capulloFila = arbolFila;
  totalFlores = 0;
  luzArbol    = LUZ_INICIAL_ARBOL;
  faroles.clear();
  capullos.clear();
  hongosColocados.clear();
  versionMapa++;

  for (let c = 0; c < COLUMNAS; c++) {
    for (let f = 0; f < FILAS; f++) {
      // Tres capas de ruido Perlin: bosque, niebla y parches de flores
      let densidad = noise(c * ESCALA_TERRENO, f * ESCALA_TERRENO);
      let neblina  = noise(1000 + c * ESCALA_NIEBLA, 1000 + f * ESCALA_NIEBLA);
      let parche   = noise(2000 + c * ESCALA_FLORES, 2000 + f * ESCALA_FLORES);
      terreno[c][f] = densidad;
      luzFlor[c][f] = 0;
      florApagada[c][f] = false;
      progresoRebrote[c][f] = 0;
      vidaHongo[c][f] = 0;

      if (distanciaAlArbol(c, f) <= RADIO_CLARO) {
        mundo[c][f] = VACIO;                       // claro alrededor del Árbol Madre
      } else if (densidad > UMBRAL_HONGO) {
        mundo[c][f] = HONGO;                       // zonas muy densas = muros de hongos
      } else if (neblina > UMBRAL_NIEBLA) {
        mundo[c][f] = NIEBLA;
      } else if (parche > UMBRAL_FLORES && random(1) < PROB_FLOR * factorFloresPorDistancia(c, f)) {
        mundo[c][f] = FLOR;                        // las flores salen en parches, no sueltas
        luzFlor[c][f] = LUZ_MAX_FLOR * random(0.5, 1);
        totalFlores++;
      } else {
        mundo[c][f] = VACIO;
      }
    }
  }

  asegurarFloresCerca();

  // Árbol Madre: bloque de 3x3 celdas en el centro
  for (let dc = -1; dc <= 1; dc++) {
    for (let df = -1; df <= 1; df++) {
      mundo[arbolCol + dc][arbolFila + df] = ARBOL_MADRE;
    }
  }

  // Capullo: una celda al lado del árbol
  mundo[capulloCol][capulloFila] = CAPULLO;
  capullos.add(new Capullo(capulloCol, capulloFila));
}

// Cerca del árbol hay menos flores y lejos hay más.
// 0 en el borde del claro, 1 desde RADIO_BONO_ARBOL; en medio cambia suave.
function factorFloresPorDistancia(c, f) {
  let t = constrain((distanciaAlArbol(c, f) - RADIO_CLARO) / (RADIO_BONO_ARBOL - RADIO_CLARO), 0, 1);
  t = t * t * (3 - 2 * t);   // curva suave (smoothstep)
  return lerp(FACTOR_FLORES_CERCA, FACTOR_FLORES_LEJOS, t);
}

// Con pocas flores, algunas semillas dejan el árbol casi sin flores cerca
// y las hadas iniciales se mueren de hambre. Esto agrega flores sueltas
// alrededor del claro hasta llegar al mínimo.
function asegurarFloresCerca() {
  let cerca = 0;
  for (let c = 0; c < COLUMNAS; c++)
    for (let f = 0; f < FILAS; f++)
      if (mundo[c][f] == FLOR && distanciaAlArbol(c, f) <= RADIO_FLORES_CERCA) cerca++;

  let intentos = 0;
  while (cerca < FLORES_CERCA_MIN && intentos < 1000) {
    intentos++;
    let c = arbolCol + int(random(-RADIO_FLORES_CERCA, RADIO_FLORES_CERCA + 1));
    let f = arbolFila + int(random(-RADIO_FLORES_CERCA, RADIO_FLORES_CERCA + 1));
    let d = distanciaAlArbol(c, f);
    if (!dentroDelMundo(c, f) || mundo[c][f] != VACIO || d <= RADIO_CLARO || d > RADIO_FLORES_CERCA) continue;
    mundo[c][f] = FLOR;
    luzFlor[c][f] = LUZ_MAX_FLOR * random(0.5, 1);
    totalFlores++;
    cerca++;
  }
}

// ---------- Consultas sobre el mundo ----------

function dentroDelMundo(c, f) {
  return c >= 0 && c < COLUMNAS && f >= 0 && f < FILAS;
}

// Qué hay en una celda. Fuera del mapa cuenta como muro.
function celda(c, f) {
  if (!dentroDelMundo(c, f)) return HONGO;
  return mundo[c][f];
}

function distanciaAlArbol(c, f) {
  return dist(c, f, arbolCol, arbolFila);
}

// Por dónde se puede pasar: todo menos los hongos (y fuera del mapa)
function transitable(c, f) {
  return dentroDelMundo(c, f) && mundo[c][f] != HONGO;
}

// ---------- Cambios en el mapa (paso 4) ----------

// Resultado de intentar poner un hongo o un farol
const COLOCADO     = 0;
const FALTA_LUZ    = 1;
const NO_PERMITIDO = 2;   // encima del Árbol, del Capullo o de un hongo
const SIN_ESPACIO  = 3;   // ya se llegó al máximo (capullos)

// Hongos del jugador: duran DURACION_HONGO segundos y desaparecen.
// (Los del bosque, generados con el ruido, son permanentes.)
let vidaHongo = matriz(COLUMNAS, FILAS, 0);   // segundos que le quedan (0 = permanente)
let hongosColocados = [];

function actualizarHongos() {
  for (let i = hongosColocados.size() - 1; i >= 0; i--) {
    let h = hongosColocados.get(i);
    vidaHongo[h[0]][h[1]] -= DT;
    if (vidaHongo[h[0]][h[1]] <= 0) {
      vidaHongo[h[0]][h[1]] = 0;
      if (mundo[h[0]][h[1]] == HONGO) {
        mundo[h[0]][h[1]] = VACIO;
        versionMapa++;   // el camino se abre: los cazadores encerrados quedan libres
      }
      hongosColocados.remove(i);
    }
  }
}

function ponerHongo(c, f) {
  if (!dentroDelMundo(c, f)) return NO_PERMITIDO;
  let tipo = mundo[c][f];
  if (tipo == HONGO || tipo == ARBOL_MADRE || tipo == CAPULLO) return NO_PERMITIDO;
  if (luzArbol - COSTO_HONGO < LUZ_MINIMA_ARBOL) return FALTA_LUZ;   // el Árbol no puede quedar sin luz

  if (tipo == FLOR) totalFlores--;   // el hongo aplasta la flor (o la flor de luna)
  mundo[c][f] = HONGO;
  luzFlor[c][f] = 0;
  luzArbol -= COSTO_HONGO;
  vidaHongo[c][f] = DURACION_HONGO;    // desaparece en unos segundos
  hongosColocados.add([ c, f ]);
  versionMapa++;
  return COLOCADO;
}

function quitarHongo(c, f) {
  if (celda(c, f) != HONGO || !dentroDelMundo(c, f)) return false;
  mundo[c][f] = VACIO;   // no devuelve la luz
  vidaHongo[c][f] = 0;
  for (let i = hongosColocados.size() - 1; i >= 0; i--)
    if (hongosColocados.get(i)[0] == c && hongosColocados.get(i)[1] == f) hongosColocados.remove(i);
  versionMapa++;
  return true;
}

// ---------- Comprar un capullo ----------
function ponerCapullo(c, f) {
  if (!dentroDelMundo(c, f) || mundo[c][f] != VACIO) return NO_PERMITIDO;
  if (capullos.size() >= MAX_CAPULLOS) return SIN_ESPACIO;
  if (luzArbol - COSTO_CAPULLO < LUZ_MINIMA_ARBOL) return FALTA_LUZ;
  mundo[c][f] = CAPULLO;
  capullos.add(new Capullo(c, f));
  luzArbol -= COSTO_CAPULLO;
  return COLOCADO;
}

// ---------- Comprar una flor ----------
// Se planta en una celda libre o sobre una flor destruida, y nace llena de luz.
function puedePlantar(c, f) {
  return dentroDelMundo(c, f) && (mundo[c][f] == VACIO || mundo[c][f] == FLOR_DESTRUIDA);
}

function ponerFlor(c, f) {
  if (!puedePlantar(c, f)) return NO_PERMITIDO;
  if (luzArbol - COSTO_FLOR < LUZ_MINIMA_ARBOL) return FALTA_LUZ;
  mundo[c][f] = FLOR;
  luzFlor[c][f] = LUZ_MAX_FLOR;
  florApagada[c][f] = false;
  progresoRebrote[c][f] = 0;
  totalFlores++;
  luzArbol -= COSTO_FLOR;
  return COLOCADO;
}

// ---------- Faroles (paso 5) ----------
// Un farol es un señuelo: brilla más que cualquier hada, así que los
// cazadores que persiguen luz van hacia él. Dura unos segundos y se apaga.
class Farol {
  c = 0;f = 0;
  restante = DURACION_FAROL;   // segundos que le quedan encendido
  constructor(c, f) {
    this.c = c;
    this.f = f;
  }
}

let faroles = [];

function ponerFarol(c, f) {
  if (!transitable(c, f)) return NO_PERMITIDO;
  if (mundo[c][f] == ARBOL_MADRE || mundo[c][f] == CAPULLO) return NO_PERMITIDO;
  if (luzArbol - COSTO_FAROL < LUZ_MINIMA_ARBOL) return FALTA_LUZ;
  faroles.add(new Farol(c, f));
  luzArbol -= COSTO_FAROL;
  return COLOCADO;
}

// Una flor "tiene luz" si no está apagada recargándose
function florConLuz(c, f) {
  return esFlor(c, f) && !florApagada[c][f];
}

// Flor normal o flor de luna
function esFlor(c, f) {
  let t = celda(c, f);
  return t == FLOR || t == FLOR_LUNA;
}

// Luz máxima de la flor que haya en (c, f)
function luzMaximaFlor(c, f) {
  return celda(c, f) == FLOR_LUNA ? LUZ_FLOR_LUNA : LUZ_MAX_FLOR;
}

// ---------- Flores de luna (solo de noche) ----------
function ponerFloresLuna(cantidad) {
  let puestas = 0;
  for (let intento = 0; intento < 2000 && puestas < cantidad; intento++) {
    let c = int(random(COLUMNAS));
    let f = int(random(FILAS));
    if (mundo[c][f] != VACIO || distanciaAlArbol(c, f) < 10) continue;
    mundo[c][f] = FLOR_LUNA;
    luzFlor[c][f] = LUZ_FLOR_LUNA;
    florApagada[c][f] = false;
    puestas++;
  }
}

function quitarFloresLuna() {
  for (let c = 0; c < COLUMNAS; c++)
    for (let f = 0; f < FILAS; f++)
      if (mundo[c][f] == FLOR_LUNA) mundo[c][f] = VACIO;
}

// Cuando una flor se apaga: la normal se queda recargándose; la de luna desaparece
function apagarFlor(c, f) {
  luzFlor[c][f] = 0;
  florApagada[c][f] = true;
  if (mundo[c][f] == FLOR_LUNA) mundo[c][f] = VACIO;
}

// El Trampero destruye la flor: queda solo el brote, que no da luz ni se recarga solo.
// Las hadas con prioridad "Cuidar" la hacen rebrotar.
function destruirFlor(c, f) {
  if (mundo[c][f] == FLOR_LUNA) {
    mundo[c][f] = VACIO;
    return;
  }
  if (mundo[c][f] == FLOR) totalFlores--;
  mundo[c][f] = FLOR_DESTRUIDA;
  luzFlor[c][f] = 0;
  florApagada[c][f] = true;
  progresoRebrote[c][f] = 0;
}

// Terminó de rebrotar: vuelve a ser flor (vacía; se recarga sola como cualquier flor apagada)
function rebrotarFlor(c, f) {
  mundo[c][f] = FLOR;
  luzFlor[c][f] = 0;
  florApagada[c][f] = true;
  progresoRebrote[c][f] = 0;
  totalFlores++;
}

// ¿Esta flor necesita cuidado? (destruida, o apagada recargándose)
function necesitaCuidado(c, f) {
  let t = celda(c, f);
  return t == FLOR_DESTRUIDA || (t == FLOR && florApagada[c][f]);
}
