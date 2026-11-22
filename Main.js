// ==================================================
// MAIN: ciclo setup/draw y entrada de mouse y teclado
// ==================================================
// Main solo coordina: llama a los demás módulos.
// Los sprites, la fuente y los sonidos (.wav) van en la carpeta data.
// El orden en que se cargan los archivos está en index.html.

// p5 llama a preload() antes que a setup() y espera a que termine de cargar todo
function preload() {
  cargarFuentes();   // Renderizado: Press Start 2P para títulos y marcadores
  cargarSprites();   // Renderizado
}

function setup() {
  let lienzo = createCanvas(1200, 700);
  lienzo.parent("juego");                 // index.html: el recuadro donde va el juego
  lienzo.elt.oncontextmenu = () => false; // clic derecho = mover la cámara (sin menú del navegador)
  document.title = NOMBRE_JUEGO;   // título de la pestaña (se cambia en Globales)
  noSmooth();        // pixel art nítido y sin líneas entre celdas al hacer zoom
  iniciarColores();       // Globales: la paleta
  iniciarColoresPanel();  // Renderizado: colores de los paneles
  iniciarInterfaz();      // Interfaz: paneles, sliders y botones plegables
  semillaDelDia = calcularSemillaDelDia();   // Red: hoy todos juegan este bosque
  nuevaPartida(semillaDelDia);
  cargarUsuario();   // Red: el nombre guardado de la última vez
  iniciarCicloDeRed();   // Red: rivales en línea y cazadores enviados (en segundo plano)
  irAlLogin();       // Interfaz: siempre se pregunta quién juega (con el último nombre ya escrito)
  iniciarAudio();    // Audio: efectos y música de 8 bits ([X] cambia el sonido)
}

function nuevaPartida(nuevaSemilla) {
  generarMundo(nuevaSemilla);   // Modelo
  iniciarSimulacion();          // Simulacion
  reiniciarEstadoRed(nuevaSemilla == semillaDelDia);   // Red: solo el bosque del día entra al ranking
  zoom = zoomObjetivo = 1;      // con zoom 1 los sprites se ven a su tamaño real
  centrarEn(centroX(arbolCol), centroY(arbolFila));   // Interfaz
}

function draw() {
  background(COLOR_FONDO);

  // Pantallas de menú (Interfaz): la simulación queda quieta mientras tanto
  if (pantalla == PANTALLA_LOGIN)    { dibujarLogin();    return; }
  if (pantalla == PANTALLA_INICIO)   { dibujarInicio();   return; }
  if (pantalla == PANTALLA_TUTORIAL) { dibujarTutorial(); return; }
  if (pantalla == PANTALLA_HADA)     { dibujarDisenoHada(); return; }   // DisenoHada

  actualizarCamara();      // Interfaz
  procesarCazadoresRecibidos();   // Red: avisa si un rival te mandó un cazador
  actualizarSimulacion();  // Simulacion

  push();
  aplicarCamara();         // Interfaz: desde aquí se dibuja en coordenadas del mundo
  dibujarMundo();          // Renderizado
  dibujarNoche();          // Renderizado: velo oscuro de noche (lo que brilla va encima)
  dibujarFaroles();        // Renderizado
  dibujarRutas();          // Renderizado (tecla V)
  dibujarHadas();          // Renderizado
  dibujarCazadores();      // Renderizado
  dibujarCursor();         // Renderizado
  pop();

  dibujarEstado();         // Renderizado: en coordenadas de pantalla
  // Los sonidos los toca Audio solo, después de cada draw() (mira qué cambió en el juego)
}

// ---------- Teclado ----------
// p5 llama a las teclas por su nombre ("Enter", "ArrowLeft"...). Esto las deja
// como en Processing, para que el resto del código compare igual:
//   key == ENTER, key == BACKSPACE, key == ESC, y key == CODED para flechas, Shift, etc.
function traducirTecla() {
  if (keyCode == ENTER || keyCode == RETURN) key = ENTER;
  else if (keyCode == BACKSPACE) key = BACKSPACE;
  else if (keyCode == ESCAPE) key = ESC;
  else if (key.length > 1) key = CODED;
}

function keyPressed() {
  traducirTecla();
  if (pantalla != PANTALLA_JUEGO) {
    teclaEnMenu();       // Interfaz
    return false;        // false = el navegador no hace nada más (por ejemplo, no baja la página)
  }
  if (key == ESC) {      // Esc: volver al inicio (la partida queda guardada)
    mostrarAyuda = false;
    irAlInicio();        // Interfaz
    return false;
  }
  if (key == 'h' || key == 'H') mostrarAyuda = !mostrarAyuda;   // Interfaz: controles
  // Pantalla de resultado: Enter = jugar otra vez el bosque del día
  if (finDelJuego() && key == ENTER) {
    empezarJuego();
    return false;
  }

  if (key == 'r' || key == 'R') {
    // Bosque al azar = partida de práctica (no entra al ranking del bosque del día)
    nuevaPartida(int(millis()) % 100000 + 1);
    mostrarAviso("Bosque al azar: partida de práctica, no entra al ranking", 3500);
  }
  if (key == 'g' || key == 'G') mostrarReticula = !mostrarReticula;
  if (key == 'p' || key == 'P') pausa = !pausa;
  if (key == 'v' || key == 'V') mostrarRutas = !mostrarRutas;
  if (key == 'c' || key == 'C') centrarEn(centroX(arbolCol), centroY(arbolFila));
  if (key == '0') vistaInicial();
  if (key == '1') herramienta = HERRAMIENTA_HONGO;   // Interfaz
  if (key == '2') herramienta = HERRAMIENTA_FAROL;   // Interfaz
  if (key == '3') herramienta = HERRAMIENTA_CAPULLO; // Interfaz
  if (key == '4') herramienta = HERRAMIENTA_FLOR;  // Interfaz
  // Hacer aparecer cazadores a mano (para probar o mostrar en la exposición)
  if (key == 'e' || key == 'E') pedirCazador(VELOZ);
  if (key == 't' || key == 'T') pedirCazador(TRAMPERO);
  if (key == 'b' || key == 'B') pedirCazador(RASTREADOR);
  teclaCamara(true);       // Interfaz: empieza a mover con WASD/flechas
  return false;
}

function pedirCazador(tipo) {
  if (aparecerCazador(tipo) == null) mostrarMensaje("Ya hay " + MAX_CAZADORES + " cazadores en el bosque");   // Simulacion / Interfaz
}

function keyReleased() {
  traducirTecla();
  teclaCamara(false);      // Interfaz: deja de mover
  return false;
}

// ---------- Mouse ----------
function mouseWheel(evento) {
  if (pantalla != PANTALLA_JUEGO) return;
  zoomConRueda(Math.sign(evento.delta));     // Interfaz: +1 = alejar, -1 = acercar
  return false;   // que la página no se desplace
}

function mousePressed() {
  if (mouseButton != LEFT) return;
  if (pantalla != PANTALLA_JUEGO) {
    clicEnMenu();       // Interfaz: botones del inicio y del tutorial
    return;
  }
  if (finDelJuego()) {          // pantalla de resultado
    clicEnFin();                    // Interfaz
    return;
  }
  if (mostrarAyuda) {               // un clic cierra la ayuda
    mostrarAyuda = false;
    return;
  }
  if (plegableMarcador.clic()) return;                 // Interfaz: esconder/mostrar el marcador
  if (plegablePrioridades.clic()) return;              // Interfaz: esconder/mostrar las prioridades
  if (clicEnBarraHerramientas()) return;               // Interfaz: elegir hongo o farol
  if (clicEnRivales()) return;                         // Interfaz: enviar un cazador a un rival
  if (prioridades.presionar(mouseX, mouseY)) return;   // Interfaz: clic en un slider
  empezarAPintar();                                    // Interfaz: usar la herramienta (hongo o farol)
}

function mouseDragged() {
  if (pantalla == PANTALLA_HADA) { arrastrarEnHada(); return; }   // DisenoHada: mover un slider
  if (pantalla == PANTALLA_INICIO) { arrastrarSonido(); return; }  // Interfaz: barras de volumen
  if (pantalla != PANTALLA_JUEGO) return;
  if (mouseButton == LEFT) {
    if (prioridades.arrastrando >= 0) prioridades.arrastrar(mouseX);   // Interfaz: mover el slider
    else pintarCelda();                                                // Interfaz: seguir pintando hongos
  }
  if (mouseButton == RIGHT || mouseButton == CENTER) arrastrarCamara(); // Interfaz: mover la cámara
}

function mouseReleased() {
  soltarEnHada();          // DisenoHada
  soltarSonido();          // Interfaz: guarda el volumen
  prioridades.soltar();    // Interfaz
  terminarDePintar();      // Interfaz
}

// ---------- Cargas que p5 debe esperar (la fuente) ----------
function esperarCarga() { p5.instance._incrementPreload(); }
function terminoCarga() { p5.instance._decrementPreload(); }
