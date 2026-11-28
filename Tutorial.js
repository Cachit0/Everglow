// ==================================================
// TUTORIAL: "Cómo jugar" interactivo, dentro del juego
// ==================================================
// En vez de páginas para leer, el jugador aprende HACIENDO en un bosque de práctica:
// una caja arriba al centro le pide una acción a la vez y resalta dónde está.
// Cuando la hace, pasa solo al siguiente paso.
//
//   - Bosque de práctica: no cuenta para el ranking, el día no avanza
//     y las hadas no se apagan (Simulacion revisa "modoTutorial").
//   - Los pasos "para leer" se pasan con [ENTER] o el botón SIGUIENTE.
//   - Los pasos "para hacer" también se pueden saltar.
//   - [ESC] sale del tutorial en cualquier momento.
//
// Cada paso es un objeto con:
//   titulo, texto  -> lo que dice la caja
//   resaltar()     -> rectángulo de pantalla [x, y, ancho, alto] que se marca (o null)
//   empezar()      -> se llama al llegar al paso (opcional)
//   listo()        -> true cuando el jugador hizo lo pedido (null = paso para leer)

const SEMILLA_TUTORIAL = 777;      // siempre el mismo bosque de práctica
const LUZ_TUTORIAL     = 400;      // luz del Árbol para probar las herramientas
const ESPERA_PASO_HECHO = 1200;    // ms que se muestra "¡BIEN HECHO!" antes de seguir

let modoTutorial = false;
let pasoTutorial = 0;
let pasosTutorial = [];
let pasoHechoEn = -1;          // millis() en que se cumplió el paso (-1 = todavía no)
let referenciaPaso = {};       // valores al empezar el paso, para saber si cambiaron
let cazadorTutorial = null;    // el cazador de práctica
let botonTutorialPrincipal, botonTutorialSecundario;

// ---------- Entrar y salir ----------

function empezarTutorial() {
  modoTutorial = true;
  nuevaPartida(SEMILLA_TUTORIAL);   // Main: no entra al ranking (no es el bosque del día)
  pantalla = PANTALLA_JUEGO;
  luzArbol = LUZ_TUTORIAL;
  pausa = false;
  mostrarAyuda = false;
  herramienta = HERRAMIENTA_HONGO;
  plegableMarcador.oculto = false;
  plegablePrioridades.oculto = false;
  // Prioridades de siempre (4/1/1/4)
  let iniciales = [ 4, 1, 1, 4 ];
  for (let i = 0; i < 4; i++) prioridades.sliders[i].valor = iniciales[i];
  aplicarPrioridades();
  zoom = zoomObjetivo = 1.5;
  centrarEn(centroX(arbolCol), centroY(arbolFila));
  mensajeHasta = 0;
  cazadorTutorial = null;
  crearPasosTutorial();
  irAlPaso(0);
}

// Deja el bosque de práctica y prepara el bosque del día (para que "Continuar" no siga el tutorial)
function salirDelTutorial() {
  modoTutorial = false;
  pasoTutorial = 0;
  cazadorTutorial = null;
  nuevaPartida(semillaDelDia);
}

function irAlPaso(n) {
  pasoTutorial = n;
  pasoHechoEn = -1;
  referenciaPaso = {
    camX: camX, camY: camY, movido: 0, zoom: zoomObjetivo,
    huir: puntosHuir, hongos: hongosColocados.size(), faroles: faroles.size(),
    flores: totalFlores, capullos: capullos.size()
  };
  let paso = pasosTutorial[n];
  if (paso.empezar != null) paso.empezar();
}

function siguientePaso() {
  if (pasoTutorial < pasosTutorial.length - 1) irAlPaso(pasoTutorial + 1);
}

// ---------- Los pasos ----------

function crearPasosTutorial() {
  pasosTutorial = [
    {
      titulo: "BIENVENIDO, GUARDIÁN",
      texto: "Este es un bosque de práctica: aquí no pierdes nada. Las hadas recogen luz de las flores verdes y la llevan al Árbol Madre. Tu objetivo: que nunca se apague la última hada.",
      resaltar: () => rectArbol(),
      listo: null
    },
    {
      titulo: "MUEVE LA VISTA",
      texto: "Mantén apretado el CLIC DERECHO y arrastra el mouse para recorrer el bosque.",
      resaltar: null,
      listo: () => referenciaPaso.movido > 120
    },
    {
      titulo: "ACERCA Y ALEJA",
      texto: "Gira la RUEDA del mouse para acercar o alejar la vista. Con [C] vuelves al Árbol.",
      resaltar: null,
      listo: () => abs(zoomObjetivo - referenciaPaso.zoom) > 0.05
    },
    {
      titulo: "TU MARCADOR",
      texto: "Aquí ves cuántas hadas tienes, la LUZ DEL ÁRBOL y el tiempo. La luz del Árbol es tu dinero: con ella compras herramientas.",
      resaltar: () => [ xMarcador(), PANEL_Y, PANEL_ANCHO, PANEL_ALTO ],
      listo: null
    },
    {
      titulo: "PRIORIDADES",
      texto: "Tú no mueves a las hadas: decides qué les importa más. Sube HUIR (haz clic en su barra) para que escapen antes de los cazadores.",
      resaltar: () => { prioridades.ubicar(); return [ prioridades.x, prioridades.y, prioridades.ancho, prioridades.alto ]; },
      listo: () => puntosHuir > referenciaPaso.huir
    },
    {
      titulo: "PON UN HONGO",
      texto: "Elige el HONGO (tecla 1) y haz clic en el bosque. Es un muro que dura 10 segundos y cuesta 10 de luz.",
      resaltar: () => rectRanura(0),
      empezar: () => { herramienta = HERRAMIENTA_HONGO; },
      listo: () => hongosColocados.size() > referenciaPaso.hongos
    },
    {
      titulo: "¡UN CAZADOR!",
      texto: "Los cazadores persiguen a las hadas que más brillan. Elige el FAROL (tecla 2) y ponlo cerca de él: brilla más que las hadas y lo distrae.",
      resaltar: () => rectRanura(1),
      empezar: () => { traerCazadorDePractica(); luzArbol = max(luzArbol, 200); },
      listo: () => faroles.size() > referenciaPaso.faroles
    },
    {
      titulo: "ENCIÉRRALO",
      texto: "Mientras mira el farol, rodéalo con HONGOS (tecla 1; mantén el clic y arrastra para poner varios). Encerrado no puede moverse.",
      resaltar: () => rectCazador(),
      empezar: () => { luzArbol = max(luzArbol, 200); },
      listo: () => cazadorEstaEncerrado()
    },
    {
      titulo: "MÁS HADAS Y MÁS FLORES",
      texto: "Con la luz del Árbol también compras CAPULLOS (tecla 3: nacen más hadas) y FLORES (tecla 4: más comida). Planta una flor o un capullo en un lugar vacío.",
      resaltar: () => { let a = rectRanura(2), b = rectRanura(3); return [ a[0], a[1], b[0] + b[2] - a[0], a[3] ]; },
      empezar: () => {
        if (cazadorTutorial != null) cazadorTutorial.retirarse();   // el cazador de práctica se va
        herramienta = HERRAMIENTA_FLOR;
        luzArbol = max(luzArbol, 200);
      },
      listo: () => totalFlores > referenciaPaso.flores || capullos.size() > referenciaPaso.capullos
    },
    {
      titulo: "DÍA Y NOCHE",
      texto: "Aquí ves la fase y qué cazadores traerá la noche. De noche llegan en tandas, y cada noche es más larga y difícil. Uno que otro es LADRÓN: va al Árbol a robarle luz.",
      resaltar: () => [ width - ANCHO_PANEL_FASE - 10, 10, ANCHO_PANEL_FASE, ALTO_PANEL_FASE ],
      listo: null
    },
    {
      titulo: "LOS AVISOS",
      texto: "Sobre las prioridades aparecen avisos: hadas con hambre, flores destruidas, cazadores en el bosque... Úsalos para decidir qué prioridad subir en cada noche.",
      resaltar: () => { prioridades.ubicar(); return [ 10, prioridades.y - 8 - 22 * 3, 300, 22 * 3 ]; },
      listo: null
    },
    {
      id: "rivales",   // en este paso se muestra el panel de rivales (en el resto del tutorial está oculto)
      titulo: "RIVALES EN LÍNEA",
      texto: "Aquí aparecen los otros jugadores conectados. De DÍA puedes sabotear a uno: haz clic en un cazador junto a su nombre y se lo envías (cuesta 60 de luz, uno por ronda). Le llega en su siguiente noche. ¡Ojo, a ti también te pueden enviar!",
      resaltar: () => hayFirebase() ? [ xPanelRivales(), yPanelRivales(), ANCHO_PANEL_FASE, altoPanelRivales() ] : null,
      empezar: () => { plegableRivales.oculto = false; },
      listo: null
    },
    {
      titulo: "¡LISTO, GUARDIÁN!",
      texto: "Ya sabes lo necesario. En el juego de verdad, si se apaga la última hada, el bosque se apaga. [H] muestra todos los controles cuando quieras. ¿Juegas el bosque del día?",
      resaltar: null,
      listo: null
    }
  ];
}

// Un Veloz lento que aparece cerca del Árbol (a la vista), solo para practicar
function traerCazadorDePractica() {
  for (let intento = 0; intento < 400; intento++) {
    let ang = random(TWO_PI);
    let d = random(12, 16);
    let c = round(arbolCol + cos(ang) * d), f = round(arbolFila + sin(ang) * d * 0.7);
    if (!transitable(c, f) || mundo[c][f] == NIEBLA) continue;
    if (contarRegion(c, f, 200) < 200) continue;   // que no aparezca ya encerrado
    let cz = new Cazador(VELOZ, centroX(c), centroY(f));
    cz.ladron = false;
    cz.nocturno = false;
    cz.fuerza = 0.7;   // más lento que uno de verdad
    cazadores.add(cz);
    cazadorTutorial = cz;
    centrarEn((centroX(c) + centroX(arbolCol)) / 2, (centroY(f) + centroY(arbolFila)) / 2);
    return;
  }
}

// ¿Los hongos ya lo rodean? Se revisa con BFS (contarRegion, Herramientas) en el acto,
// sin esperar a que el cazador intente moverse.
function cazadorEstaEncerrado() {
  let cz = cazadorTutorial;
  if (cz == null) return false;
  if (cz.encerrado) return true;
  if (contarRegion(celdaX(cz.x), celdaY(cz.y), REGION_ENCERRADO) < REGION_ENCERRADO) {
    cz.encerrado = true;           // queda atrapado como cualquier cazador encerrado
    cz.versionRuta = versionMapa;
    return true;
  }
  return false;
}

// ¿Estamos en el paso que muestra el panel de rivales?
function tutorialMuestraRivales() {
  return modoTutorial && pasosTutorial[pasoTutorial].id == "rivales";
}

// ---------- Cada frame (desde Main.draw) ----------

function actualizarTutorial() {
  // Cuánto se ha movido la cámara arrastrando (no cuenta el zoom)
  if (mouseIsPressed && mouseButton != LEFT) {
    referenciaPaso.movido += dist(camX, camY, referenciaPaso.camX, referenciaPaso.camY) * zoom;
  }
  referenciaPaso.camX = camX;
  referenciaPaso.camY = camY;

  let paso = pasosTutorial[pasoTutorial];
  if (paso.listo == null) return;
  if (pasoHechoEn < 0 && paso.listo()) {
    pasoHechoEn = millis();
    sonar("aviso");   // Audio
  }
  if (pasoHechoEn >= 0 && millis() - pasoHechoEn > ESPERA_PASO_HECHO) siguientePaso();
}

// ---------- Entrada ----------

// Devuelve true si la tecla era del tutorial
function teclaEnTutorial() {
  let paso = pasosTutorial[pasoTutorial];
  if (key == ENTER) {
    if (pasoTutorial == pasosTutorial.length - 1) empezarJuego();   // Interfaz: el bosque del día
    else if (paso.listo == null) siguientePaso();
    return true;
  }
  return false;
}

// Devuelve true si el clic cayó en la caja del tutorial
function clicEnTutorial() {
  if (!sobreCajaTutorial()) return false;
  ubicarCajaTutorial();
  let ultimo = (pasoTutorial == pasosTutorial.length - 1);
  if (botonTutorialPrincipal != null && botonTutorialPrincipal.contiene(mouseX, mouseY)) {
    if (ultimo) empezarJuego();   // Interfaz
    else siguientePaso();         // SIGUIENTE o SALTAR PASO
  } else if (botonTutorialSecundario != null && botonTutorialSecundario.contiene(mouseX, mouseY)) {
    irAlInicio();                 // Interfaz: también sale del tutorial
  }
  return true;   // los clics en la caja no ponen hongos
}

// ---------- La caja (arriba al centro, entre el marcador y el panel de la fase) ----------

let CAJA_TUTORIAL_ANCHO = 376;   // se recalcula: el espacio libre entre los dos paneles de arriba
let cajaX = 0, cajaY = 10, cajaAlto = 0;
let lineasCaja = [];

function sobreCajaTutorial() {
  if (!modoTutorial) return false;
  ubicarCajaTutorial();
  return mouseX >= cajaX && mouseX <= cajaX + CAJA_TUTORIAL_ANCHO && mouseY >= cajaY && mouseY <= cajaY + cajaAlto;
}

function ubicarCajaTutorial() {
  let paso = pasosTutorial[pasoTutorial];
  // Desde el botón del marcador hasta el panel de la fase
  cajaX = PANEL_X + PANEL_ANCHO + SEPARACION_BOTON_PLEGAR + LADO_BOTON_PLEGAR + 10;
  let borde = width - ANCHO_PANEL_FASE - 20;
  if (tutorialMuestraRivales()) borde = xPanelRivales() - LADO_BOTON_PLEGAR - SEPARACION_BOTON_PLEGAR - 10;   // no tapar su botón
  CAJA_TUTORIAL_ANCHO = borde - cajaX;
  textFont(fuenteTexto);
  textSize(14);
  lineasCaja = partirEnLineas(paso.texto, CAJA_TUTORIAL_ANCHO - 32);
  cajaAlto = 40 + lineasCaja.length * 18 + 64;

  let yBoton = cajaY + cajaAlto - 44;
  let ultimo = (pasoTutorial == pasosTutorial.length - 1);
  if (ultimo) {
    botonTutorialPrincipal  = new Boton("¡A jugar!", cajaX + 16, yBoton, 180, 30, COLOR_HADA);
    botonTutorialSecundario = new Boton("Menú", cajaX + CAJA_TUTORIAL_ANCHO - 16 - 120, yBoton, 120, 30, COLOR_LUZ);
  } else if (paso.listo == null) {
    botonTutorialPrincipal  = new Boton("Siguiente", cajaX + CAJA_TUTORIAL_ANCHO - 16 - 170, yBoton, 170, 30, COLOR_ARBOL);
    botonTutorialSecundario = null;
  } else {
    botonTutorialPrincipal  = new Boton("Saltar paso", cajaX + CAJA_TUTORIAL_ANCHO - 16 - 130, yBoton, 130, 30, COLOR_GRIS);
    botonTutorialSecundario = null;
  }
}

function dibujarTutorial() {
  let paso = pasosTutorial[pasoTutorial];
  let hecho = pasoHechoEn >= 0;

  // 1) Lo que hay que mirar: un recuadro que late
  if (paso.resaltar != null && !mostrarAyuda) {
    let r = paso.resaltar();
    if (r != null) dibujarResaltado(r[0], r[1], r[2], r[3], hecho ? COLOR_FLOR : COLOR_ARBOL);
  }

  // 2) La caja
  ubicarCajaTutorial();
  let tono = hecho ? COLOR_FLOR : COLOR_ARBOL;
  marcoArcade(cajaX, cajaY, CAJA_TUTORIAL_ANCHO, cajaAlto, tono);
  textoPixel("PASO " + (pasoTutorial + 1) + "/" + pasosTutorial.length, cajaX + 16, cajaY + 14, 8, COLOR_GRIS);
  textoPixel("[ESC] SALIR", cajaX + CAJA_TUTORIAL_ANCHO - 16, cajaY + 14, 8, COLOR_GRIS, RIGHT);
  textoPixel(paso.titulo, cajaX + 16, cajaY + 30, 8, tono);

  textFont(fuenteTexto);
  textSize(14);
  fill(COLOR_INTERFAZ);
  for (let i = 0; i < lineasCaja.length; i++) text(lineasCaja[i], cajaX + 16, cajaY + 46 + i * 18);

  // 3) Abajo: qué falta, o el botón para seguir
  let yPie = cajaY + cajaAlto - 44;
  if (hecho) {
    textoPixel("¡BIEN HECHO!", cajaX + 16, yPie + 11, 8, COLOR_FLOR);
  } else if (paso.listo != null) {
    if (parpadeo(30)) textoPixel("> HAZLO EN EL BOSQUE", cajaX + 16, yPie + 11, 8, COLOR_ARBOL);
    botonTutorialPrincipal.dibujar();
  } else {
    if (pasoTutorial < pasosTutorial.length - 1) textoPixel("[ENTER]", cajaX + 16, yPie + 11, 8, COLOR_GRIS);
    botonTutorialPrincipal.dibujar();
    if (botonTutorialSecundario != null) botonTutorialSecundario.dibujar();
  }
}

// Recuadro que late alrededor de algo de la pantalla
function dibujarResaltado(x, y, ancho, alto, tono) {
  let latido = 0.5 + 0.5 * sin(frameCount * 0.15);
  let margen = 6 + 3 * latido;
  noFill();
  stroke(tono, 140 + 115 * latido);
  strokeWeight(3);
  rect(x - margen, y - margen, ancho + margen * 2, alto + margen * 2);
  noStroke();
}

// ---------- Ayudas: dónde está cada cosa en la pantalla ----------

function aPantallaX(xMundo) { return (xMundo - camX) * zoom; }
function aPantallaY(yMundo) { return (yMundo - camY) * zoom; }

function rectArbol() {
  let lado = TAM_CELDA * 3 * zoom;
  return [ aPantallaX(centroX(arbolCol)) - lado / 2, aPantallaY(centroY(arbolFila)) - lado / 2, lado, lado ];
}

function rectRanura(i) {
  return [ xRanura(i), yRanuras(), LADO_RANURA, LADO_RANURA ];   // Interfaz
}

function rectCazador() {
  if (cazadorTutorial == null) return null;
  let lado = TAM_CELDA * 2 * zoom;
  return [ aPantallaX(cazadorTutorial.x) - lado / 2, aPantallaY(cazadorTutorial.y) - lado / 2, lado, lado ];
}

// Parte un texto en líneas que caben en "ancho" píxeles (con la fuente y tamaño actuales)
function partirEnLineas(texto, ancho) {
  let lineas = [];
  let actual = "";
  for (const palabra of texto.split(" ")) {
    let prueba = actual.length == 0 ? palabra : actual + " " + palabra;
    if (textWidth(prueba) > ancho && actual.length > 0) {
      lineas.add(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual.length > 0) lineas.add(actual);
  return lineas;
}
