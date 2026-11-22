// ==================================================
// HERRAMIENTAS: distancias, contacto, componente más cercano
//               y búsqueda de caminos (A*, Dijkstra y BFS)
// ==================================================
// Funciones de apoyo que usan los demás módulos.
//   A*       -> hadas (ir a flores y volver) y cazador Veloz
//   Dijkstra -> cazador Trampero (la flor "más barata" de alcanzar, esquivando niebla)
//   BFS      -> cazador Rastreador y hadas cuando huyen
// (A* usa PriorityQueue de Java: el import está arriba de Main.pde)

// ---------- Conversión celda <-> píxeles del mundo ----------
function centroX(c) { return (c + 0.5) * TAM_CELDA; }
function centroY(f) { return (f + 0.5) * TAM_CELDA; }
function celdaX(x) { return floor(x / TAM_CELDA); }
function celdaY(y) { return floor(y / TAM_CELDA); }

// ---------- Componente más cercano ----------
// Busca las flores con luz más cercanas a (x, y) y devuelve una de las 3 más cercanas
// al azar, para que no vayan todas las hadas a la misma. Devuelve null si no hay ninguna.
function florCercana(x, y) {
  let mejores = arreglo(3, null);
  let distancias = [ Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE ];

  for (let c = 0; c < COLUMNAS; c++) {
    for (let f = 0; f < FILAS; f++) {
      if (!florConLuz(c, f)) continue;
      if (distanciaAlArbol(c, f) > radioBusqueda()) continue;   // Simulacion: con Huir alto no se alejan del Árbol
      let d = dist(x, y, centroX(c), centroY(f));
      // insertar en la lista de las 3 más cercanas
      for (let i = 0; i < 3; i++) {
        if (d < distancias[i]) {
          for (let j = 2; j > i; j--) {
            distancias[j] = distancias[j - 1];
            mejores[j] = mejores[j - 1];
          }
          distancias[i] = d;
          mejores[i] = [ c, f ];
          break;
        }
      }
    }
  }

  let encontradas = 0;
  for (let i = 0; i < 3; i++) if (mejores[i] != null) encontradas++;
  if (encontradas == 0) return null;
  return mejores[int(random(encontradas))];
}

// Flor para CUIDAR más cercana: prefiere las destruidas (cuentan como más cerca).
// Devuelve null si no hay ninguna a menos de RADIO_CUIDAR celdas.
function florParaCuidar(x, y) {
  let mejor = null;
  let mejorPuntaje = Number.MAX_VALUE;
  let c0 = celdaX(x), f0 = celdaY(y);
  let r = int(RADIO_CUIDAR);
  for (let c = max(0, c0 - r); c <= min(COLUMNAS - 1, c0 + r); c++) {
    for (let f = max(0, f0 - r); f <= min(FILAS - 1, f0 + r); f++) {
      if (!necesitaCuidado(c, f)) continue;
      let d = dist(c0, f0, c, f);
      if (d > RADIO_CUIDAR) continue;
      let puntaje = (mundo[c][f] == FLOR_DESTRUIDA) ? d * 0.35 : d;   // las destruidas primero
      if (puntaje < mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = [ c, f ];
      }
    }
  }
  return mejor;
}

// ==================================================
// A* (A estrella) sobre la matriz del mundo
// ==================================================
// Idea: explorar primero las celdas que parecen más prometedoras.
// Para cada celda se suman dos cosas:
//   g = lo que ya costó llegar hasta ella desde el inicio
//   h = una estimación de lo que falta hasta la meta (la heurística)
// Siempre se expande la celda con menor g + h. Por eso A* va "directo"
// y explora muchas menos celdas que BFS o Dijkstra.
//
// Movimiento en 8 direcciones (recto cuesta 1, diagonal cuesta √2),
// sin cortar esquinas entre dos hongos.

// Memoria que se reutiliza en cada búsqueda (así no se crean arreglos nuevos cada vez)
let costoG   = arreglo(COLUMNAS * FILAS, 0);
let vieneDe  = arreglo(COLUMNAS * FILAS, 0);
let marcaVisto   = arreglo(COLUMNAS * FILAS, 0);   // en qué búsqueda se vio cada celda
let marcaCerrado = arreglo(COLUMNAS * FILAS, 0);   // en qué búsqueda se terminó cada celda
let numeroBusqueda = 0;
let exploradasAEstrella = 0;   // se muestran en el panel: cuántas celdas revisó
let exploradasDijkstra  = 0;   // cada algoritmo en su última búsqueda
let exploradasBFS       = 0;

// Un nodo de la cola de prioridad: la celda (como índice) y su g + h
class Nodo {
  indice = 0;
  prioridad = 0;
  constructor(indice, prioridad) {
    this.indice = indice;
    this.prioridad = prioridad;
  }
  compareTo(otro) {
    return Float.compare(this.prioridad, otro.prioridad);
  }
}

function indiceCelda(c, f) { return f * COLUMNAS + c; }

// Heurística: distancia "octil", la real si no hubiera obstáculos y se mueve en 8 direcciones
function heuristica(c, f, metaC, metaF) {
  let dx = abs(c - metaC);
  let dy = abs(f - metaF);
  return (dx + dy) + (COSTO_DIAGONAL - 2) * min(dx, dy);
}

// Devuelve la lista de puntos (centros de celda, en píxeles del mundo) desde
// (c0, f0) hasta (c1, f1), sin incluir la celda de inicio.
// Devuelve null si no hay camino.
function aEstrella(c0, f0, c1, f1) {
  exploradasAEstrella = 0;
  if (!dentroDelMundo(c0, f0) || !transitable(c1, f1)) return null;

  numeroBusqueda++;
  let inicio = indiceCelda(c0, f0);
  let meta   = indiceCelda(c1, f1);

  let abiertos = new PriorityQueue();
  costoG[inicio] = 0;
  vieneDe[inicio] = -1;
  marcaVisto[inicio] = numeroBusqueda;
  abiertos.add(new Nodo(inicio, heuristica(c0, f0, c1, f1)));

  while (!abiertos.isEmpty()) {
    let actual = abiertos.poll();
    let i = actual.indice;
    if (marcaCerrado[i] == numeroBusqueda) continue;   // ya se procesó por un camino mejor
    marcaCerrado[i] = numeroBusqueda;
    exploradasAEstrella++;

    if (i == meta) return reconstruirCamino(meta);

    let c = i % COLUMNAS;
    let f = floor(i / COLUMNAS);
    for (let dc = -1; dc <= 1; dc++) {
      for (let df = -1; df <= 1; df++) {
        if (dc == 0 && df == 0) continue;
        let nc = c + dc;
        let nf = f + df;
        if (!transitable(nc, nf)) continue;
        let diagonal = (dc != 0 && df != 0);
        // No cortar esquinas: para ir en diagonal, las dos celdas rectas tienen que estar libres
        if (diagonal && (!transitable(c + dc, f) || !transitable(c, f + df))) continue;

        let vecino = indiceCelda(nc, nf);
        if (marcaCerrado[vecino] == numeroBusqueda) continue;

        let g = costoG[i] + (diagonal ? COSTO_DIAGONAL : 1);
        if (marcaVisto[vecino] != numeroBusqueda || g < costoG[vecino]) {
          marcaVisto[vecino] = numeroBusqueda;
          costoG[vecino] = g;
          vieneDe[vecino] = i;
          abiertos.add(new Nodo(vecino, g + heuristica(nc, nf, c1, f1)));
        }
      }
    }
  }
  return null;   // se exploró todo lo alcanzable y la meta no estaba
}

// Recorre "vieneDe" desde la meta hacia atrás y lo da vuelta
function reconstruirCamino(meta) {
  let camino = [];
  let i = meta;
  while (vieneDe[i] != -1) {
    camino.add(0, createVector(centroX(i % COLUMNAS), centroY(floor(i / COLUMNAS))));
    i = vieneDe[i];
  }
  return camino;
}

// ==================================================
// Ayudas comunes para las búsquedas
// ==================================================

// ¿Se puede dar el paso (dc, df) desde (c, f)? 8 direcciones, sin cortar esquinas.
function pasoValido(c, f, dc, df) {
  if (!transitable(c + dc, f + df)) return false;
  if (dc != 0 && df != 0 && (!transitable(c + dc, f) || !transitable(c, f + df))) return false;
  return true;
}

// ==================================================
// DIJKSTRA: la flor con luz más BARATA de alcanzar
// ==================================================
// Como A*, pero sin heurística: no sabe hacia dónde está la meta, así que
// se expande en todas direcciones ordenando solo por el costo acumulado.
// La ventaja: tiene en cuenta el costo del terreno. Cruzar niebla cuesta
// COSTO_NIEBLA_DIJKSTRA veces más, por eso el Trampero la esquiva.
// Y como no necesita una meta fija, encuentra "la flor más cercana por costo"
// entre todas las flores del mapa en una sola búsqueda.
function dijkstraAFlor(c0, f0) {
  exploradasDijkstra = 0;
  if (!dentroDelMundo(c0, f0)) return null;

  numeroBusqueda++;
  let inicio = indiceCelda(c0, f0);
  let abiertos = new PriorityQueue();
  costoG[inicio] = 0;
  vieneDe[inicio] = -1;
  marcaVisto[inicio] = numeroBusqueda;
  abiertos.add(new Nodo(inicio, 0));

  while (!abiertos.isEmpty()) {
    let actual = abiertos.poll();
    let i = actual.indice;
    if (marcaCerrado[i] == numeroBusqueda) continue;
    marcaCerrado[i] = numeroBusqueda;
    exploradasDijkstra++;

    let c = i % COLUMNAS;
    let f = floor(i / COLUMNAS);
    if (florConLuz(c, f)) return reconstruirCamino(i);   // la primera flor que sale es la más barata

    for (let dc = -1; dc <= 1; dc++) {
      for (let df = -1; df <= 1; df++) {
        if (dc == 0 && df == 0) continue;
        if (!pasoValido(c, f, dc, df)) continue;
        let nc = c + dc;
        let nf = f + df;
        let vecino = indiceCelda(nc, nf);
        if (marcaCerrado[vecino] == numeroBusqueda) continue;

        let paso = (dc != 0 && df != 0) ? COSTO_DIAGONAL : 1;
        if (mundo[nc][nf] == NIEBLA) paso *= COSTO_NIEBLA_DIJKSTRA;   // el terreno importa
        let g = costoG[i] + paso;
        if (marcaVisto[vecino] != numeroBusqueda || g < costoG[vecino]) {
          marcaVisto[vecino] = numeroBusqueda;
          costoG[vecino] = g;
          vieneDe[vecino] = i;
          abiertos.add(new Nodo(vecino, g));
        }
      }
    }
  }
  return null;   // no queda ninguna flor con luz alcanzable
}

// ==================================================
// BFS: búsqueda en anchura
// ==================================================
// Explora por capas: primero todas las celdas a 1 paso, después a 2, a 3...
// No usa heurística ni costos, así que revisa muchas más celdas que A*
// (es lento), pero si existe un camino, siempre lo encuentra.
let colaBFS = arreglo(COLUMNAS * FILAS, 0);

function bfs(c0, f0, c1, f1) {
  exploradasBFS = 0;
  if (!dentroDelMundo(c0, f0) || !transitable(c1, f1)) return null;

  numeroBusqueda++;
  let inicio = indiceCelda(c0, f0);
  let meta = indiceCelda(c1, f1);
  let frente = 0, fin = 0;
  colaBFS[fin++] = inicio;
  marcaVisto[inicio] = numeroBusqueda;
  vieneDe[inicio] = -1;

  while (frente < fin) {
    let i = colaBFS[frente++];
    exploradasBFS++;
    if (i == meta) return reconstruirCamino(meta);
    let c = i % COLUMNAS;
    let f = floor(i / COLUMNAS);
    for (let dc = -1; dc <= 1; dc++) {
      for (let df = -1; df <= 1; df++) {
        if (dc == 0 && df == 0) continue;
        if (!pasoValido(c, f, dc, df)) continue;
        let vecino = indiceCelda(c + dc, f + df);
        if (marcaVisto[vecino] == numeroBusqueda) continue;
        marcaVisto[vecino] = numeroBusqueda;
        vieneDe[vecino] = i;
        colaBFS[fin++] = vecino;
      }
    }
  }
  return null;
}

// BFS para HUIR: busca, por capas desde el hada, la celda más cercana que quede
// a "radioSeguro" celdas o más del cazador. Devuelve el camino hasta ella, o null.
function bfsLugarSeguro(c0, f0, cazadorX, cazadorY, radioSeguro) {
  exploradasBFS = 0;
  if (!dentroDelMundo(c0, f0)) return null;

  numeroBusqueda++;
  let inicio = indiceCelda(c0, f0);
  let frente = 0, fin = 0;
  colaBFS[fin++] = inicio;
  marcaVisto[inicio] = numeroBusqueda;
  vieneDe[inicio] = -1;
  costoG[inicio] = 0;   // aquí guarda cuántos pasos lleva

  let cazC = cazadorX / TAM_CELDA;
  let cazF = cazadorY / TAM_CELDA;
  let distanciaInicial = dist(c0 + 0.5, f0 + 0.5, cazC, cazF);
  let masLejana = -1;               // por si no hay lugar seguro: la celda más alejada del cazador
  let dMasLejana = distanciaInicial;

  while (frente < fin) {
    let i = colaBFS[frente++];
    exploradasBFS++;
    let c = i % COLUMNAS;
    let f = floor(i / COLUMNAS);
    let d = dist(c + 0.5, f + 0.5, cazC, cazF);
    if (d >= radioSeguro && d > distanciaInicial) return reconstruirCamino(i);
    if (d > dMasLejana) {
      dMasLejana = d;
      masLejana = i;
    }
    if (costoG[i] >= BUSQUEDA_HUIDA) continue;   // no buscar demasiado lejos

    for (let dc = -1; dc <= 1; dc++) {
      for (let df = -1; df <= 1; df++) {
        if (dc == 0 && df == 0) continue;
        if (!pasoValido(c, f, dc, df)) continue;
        let vecino = indiceCelda(c + dc, f + df);
        if (marcaVisto[vecino] == numeroBusqueda) continue;
        marcaVisto[vecino] = numeroBusqueda;
        vieneDe[vecino] = i;
        costoG[vecino] = costoG[i] + 1;
        colaBFS[fin++] = vecino;
      }
    }
  }
  // No hay lugar seguro a su alcance: huye al punto más alejado que encontró
  if (masLejana >= 0) return reconstruirCamino(masLejana);
  return null;
}

// Cuenta cuántas celdas se pueden alcanzar desde (c, f), hasta "limite".
// Sirve para saber si un cazador quedó ENCERRADO entre hongos.
function contarRegion(c0, f0, limite) {
  if (!dentroDelMundo(c0, f0)) return 0;
  numeroBusqueda++;
  let inicio = indiceCelda(c0, f0);
  let frente = 0, fin = 0;
  colaBFS[fin++] = inicio;
  marcaVisto[inicio] = numeroBusqueda;
  while (frente < fin && fin < limite) {
    let i = colaBFS[frente++];
    let c = i % COLUMNAS;
    let f = floor(i / COLUMNAS);
    for (let dc = -1; dc <= 1; dc++) {
      for (let df = -1; df <= 1; df++) {
        if (dc == 0 && df == 0) continue;
        if (!pasoValido(c, f, dc, df)) continue;
        let vecino = indiceCelda(c + dc, f + df);
        if (marcaVisto[vecino] == numeroBusqueda) continue;
        marcaVisto[vecino] = numeroBusqueda;
        colaBFS[fin++] = vecino;
      }
    }
  }
  return fin;
}
