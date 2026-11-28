// ==================================================
// INTERFAZ: cámara (paso 2), herramientas del Guardián (pasos 4 y 5),
//           sliders de prioridades (paso 6) y pantallas de inicio y "Cómo jugar"
// ==================================================
// Más adelante aquí también irán los sliders, los botones
// de defensas y las pantallas (intro, login, resultado).
//
// La cámara guarda QUÉ parte del mundo se ve y CON CUÁNTO zoom.
//   pantalla = (mundo - cam) * zoom
//   mundo    = pantalla / zoom + cam

let camX = 0, camY = 0;   // punto del mundo (en px) que queda en la esquina superior izquierda
let zoom = 1;             // zoom actual (se anima poco a poco)
let zoomObjetivo = 1;     // zoom al que se quiere llegar

// Para que el zoom se haga hacia el mouse (como en WorldBox):
let anclaPantallaX, anclaPantallaY;  // dónde estaba el mouse al girar la rueda
let anclaMundoX, anclaMundoY;        // qué punto del mundo había debajo del mouse

function anchoMundo() { return COLUMNAS * TAM_CELDA; }
function altoMundo() { return FILAS * TAM_CELDA; }

// ---------- Aplicar la cámara antes de dibujar el mundo ----------
function aplicarCamara() {
  scale(zoom);
  translate(-camX, -camY);
}

// ---------- Se llama una vez por frame ----------
// La cámara se maneja solo con el mouse: clic derecho + arrastrar para moverla
// (arrastrarCamara) y la rueda para el zoom (zoomConRueda).
function actualizarCamara() {
  // Zoom suave hacia el objetivo, dejando fijo el punto que está bajo el mouse
  if (abs(zoom - zoomObjetivo) > 0.001) {
    zoom = lerp(zoom, zoomObjetivo, SUAVIDAD_ZOOM);
    if (abs(zoom - zoomObjetivo) < 0.001) zoom = zoomObjetivo;
    camX = anclaMundoX - anclaPantallaX / zoom;
    camY = anclaMundoY - anclaPantallaY / zoom;
  }

  limitarCamara();
}

// ---------- Acciones de la cámara ----------

// pasos > 0 = alejar, pasos < 0 = acercar (así lo entrega la rueda del mouse)
function zoomConRueda(pasos) {
  anclaPantallaX = mouseX;
  anclaPantallaY = mouseY;
  anclaMundoX = pantallaAMundoX(mouseX);
  anclaMundoY = pantallaAMundoY(mouseY);
  zoomObjetivo = constrain(zoomObjetivo * pow(VELOCIDAD_ZOOM, -pasos), zoomMinimo(), ZOOM_MAX);
}

// Mueve la cámara en píxeles del mundo
function moverCamara(dx, dy) {
  camX += dx;
  camY += dy;
  anclaMundoX += dx;
  anclaMundoY += dy;
}

// Arrastrar con el mouse: el mundo sigue al cursor
function arrastrarCamara() {
  moverCamara(-(mouseX - pmouseX) / zoom, -(mouseY - pmouseY) / zoom);
}

// Pone un punto del mundo en el centro de la pantalla
function centrarEn(mundoX, mundoY) {
  camX = mundoX - width / (2 * zoom);
  camY = mundoY - height / (2 * zoom);
  anclaPantallaX = width / 2;
  anclaPantallaY = height / 2;
  anclaMundoX = mundoX;
  anclaMundoY = mundoY;
  limitarCamara();
}

// Vuelve a ver todo el mapa
function vistaInicial() {
  zoom = zoomObjetivo = zoomMinimo();
  camX = camY = 0;
}

// El zoom más lejano posible: el que hace que el mapa llene la ventana
function zoomMinimo() {
  return max(width / anchoMundo(), height / altoMundo());
}

// Evita que la cámara se salga del mapa
function limitarCamara() {
  camX = constrain(camX, 0, max(0, anchoMundo() - width / zoom));
  camY = constrain(camY, 0, max(0, altoMundo() - height / zoom));
}

// ---------- Conversiones pantalla <-> mundo ----------
// Las vamos a necesitar en el paso 4 para saber dónde se hace clic al poner un hongo.

function pantallaAMundoX(x) { return x / zoom + camX; }
function pantallaAMundoY(y) { return y / zoom + camY; }

function columnaBajoMouse() { return floor(pantallaAMundoX(mouseX) / TAM_CELDA); }
function filaBajoMouse() { return floor(pantallaAMundoY(mouseY) / TAM_CELDA); }

// ---------- Qué celdas se ven (para no dibujar las que están fuera) ----------
function primeraColumnaVisible() { return max(0, floor(camX / TAM_CELDA)); }
function ultimaColumnaVisible() { return min(COLUMNAS - 1, floor((camX + width / zoom) / TAM_CELDA)); }
function primeraFilaVisible() { return max(0, floor(camY / TAM_CELDA)); }
function ultimaFilaVisible() { return min(FILAS - 1, floor((camY + height / zoom) / TAM_CELDA)); }

// ==================================================
// Herramientas del Guardián: hongos (paso 4) y faroles (paso 5)
// ==================================================
// Tecla 1 = hongo, tecla 2 = farol. Se usan con clic izquierdo.
// HONGO: clic en una celda libre lo pone (cuesta luz del Árbol); clic en un hongo lo quita.
//        Arrastrando se pintan o borran varios seguidos.
// FAROL: clic pone un señuelo que atrae a los cazadores por unos segundos.
// CAPULLO: clic compra otro nido donde nacen hadas.
// FLOR: clic planta una flor llena de luz (la compra más cara).

const HERRAMIENTA_HONGO = 1, HERRAMIENTA_FAROL = 2, HERRAMIENTA_CAPULLO = 3, HERRAMIENTA_FLOR = 4;
const TOTAL_HERRAMIENTAS = 4;
let herramienta = HERRAMIENTA_HONGO;

function costoHerramienta(h) {
  if (h == HERRAMIENTA_FAROL)   return COSTO_FAROL;
  if (h == HERRAMIENTA_CAPULLO) return COSTO_CAPULLO;
  if (h == HERRAMIENTA_FLOR)  return COSTO_FLOR;
  return COSTO_HONGO;
}

function nombreHerramienta(h) {
  if (h == HERRAMIENTA_FAROL)   return "FAROL · SEÑUELO";
  if (h == HERRAMIENTA_CAPULLO) return "CAPULLO · MÁS HADAS (" + capullos.size() + "/" + MAX_CAPULLOS + ")";
  if (h == HERRAMIENTA_FLOR)  return "FLOR · ALIMENTO";
  return "HONGO · MURO POR " + int(DURACION_HONGO) + " S";
}

const PINTAR_NADA = 0, PINTAR_PONER = 1, PINTAR_QUITAR = 2;
let modoPintar = PINTAR_NADA;

let mensaje = "";     // aviso corto en pantalla (por ejemplo, "falta luz")
let mensajeHasta = 0;    // millis() hasta cuando se muestra

function empezarAPintar() {
  modoPintar = PINTAR_NADA;
  if (sobreInterfaz()) return;
  let c = columnaBajoMouse();
  let f = filaBajoMouse();
  if (!dentroDelMundo(c, f)) return;

  if (herramienta == HERRAMIENTA_FAROL) {
    let resultado = ponerFarol(c, f);     // Modelo
    if (resultado == FALTA_LUZ) mostrarMensaje("Falta luz en el Árbol: un farol cuesta " + int(COSTO_FAROL));
    if (resultado == NO_PERMITIDO) mostrarMensaje("Ahí no se puede poner un farol");
    return;                               // el farol no se arrastra
  }
  if (herramienta == HERRAMIENTA_CAPULLO) {
    let resultado = ponerCapullo(c, f);   // Modelo
    if (resultado == FALTA_LUZ) mostrarMensaje("Falta luz en el Árbol: un capullo cuesta " + int(COSTO_CAPULLO));
    if (resultado == SIN_ESPACIO) mostrarMensaje("Ya tienes " + MAX_CAPULLOS + " capullos");
    if (resultado == NO_PERMITIDO) mostrarMensaje("El capullo va en una celda vacía");
    if (resultado == COLOCADO) mostrarAviso("Nuevo capullo: las hadas cercanas le llevarán luz", 2000);
    return;
  }
  if (herramienta == HERRAMIENTA_FLOR) {
    let resultado = ponerFlor(c, f);      // Modelo
    if (resultado == FALTA_LUZ) mostrarMensaje("Falta luz en el Árbol: una flor cuesta " + int(COSTO_FLOR));
    if (resultado == NO_PERMITIDO) mostrarMensaje("La flor va en una celda vacía o sobre una flor destruida");
    return;
  }

  // Lo que haya en la primera celda decide si este arrastre pone o quita
  modoPintar = (mundo[c][f] == HONGO) ? PINTAR_QUITAR : PINTAR_PONER;
  pintarCelda();
}

function pintarCelda() {
  if (modoPintar == PINTAR_NADA || sobreInterfaz()) return;
  let c = columnaBajoMouse();
  let f = filaBajoMouse();
  if (modoPintar == PINTAR_QUITAR) {
    quitarHongo(c, f);                    // Modelo
  } else if (celda(c, f) != HONGO) {
    let resultado = ponerHongo(c, f);     // Modelo
    if (resultado == FALTA_LUZ) mostrarMensaje("Falta luz en el Árbol: un hongo cuesta " + int(COSTO_HONGO));
  }
}

function terminarDePintar() {
  modoPintar = PINTAR_NADA;
}

// El marcador se esconde hacia el borde izquierdo con su botón de flecha
let plegableMarcador;   // se crea en iniciarInterfaz()

function xMarcador() { return plegableMarcador.ubicar(PANEL_X, PANEL_ANCHO, PANEL_Y); }

function sobrePanel() {
  let x = xMarcador();
  if (plegableMarcador.sobreBoton()) return true;
  if (plegableMarcador.escondido()) return false;
  return mouseX >= x && mouseX <= x + PANEL_ANCHO && mouseY >= PANEL_Y && mouseY <= PANEL_Y + PANEL_ALTO;
}

let colorMensaje = COLOR_CAZADOR;

// Aviso de error o problema (en rojo)
function mostrarMensaje(texto) {
  mensaje = texto;
  colorMensaje = COLOR_CAZADOR;
  mensajeHasta = millis() + 2000;
}

// Aviso informativo (en amarillo), por ejemplo el objetivo al empezar
function mostrarAviso(texto, milisegundos) {
  mensaje = texto;
  colorMensaje = COLOR_ARBOL;
  mensajeHasta = millis() + milisegundos;
}

// ¿El mouse está sobre algún panel? (ahí los clics no tocan el mundo)
function sobreInterfaz() {
  if (mostrarAyuda) return true;
  let sobreFase = mouseX >= width - ANCHO_PANEL_FASE - 10 && mouseX <= width - 10 && mouseY >= 10 && mouseY <= 10 + ALTO_PANEL_FASE;
  let sobreAlgoritmos = mostrarRutas && mouseX >= PANEL_X && mouseX <= PANEL_X + PANEL_ANCHO
                            && mouseY >= PANEL_Y + PANEL_ALTO + 10 && mouseY <= PANEL_Y + PANEL_ALTO + 10 + ALTO_PANEL_ALGORITMOS;
  return sobrePanel() || sobreFase || sobreAlgoritmos || sobreBarraHerramientas() || sobrePanelRivales() || prioridades.contiene(mouseX, mouseY)
         || sobreCajaTutorial();   // Tutorial
}

// ---------- Barra de herramientas (abajo al centro) ----------
const LADO_RANURA = 64;
let mostrarAyuda = false;   // tecla H

function xRanura(i) { return width / 2 - (TOTAL_HERRAMIENTAS * LADO_RANURA + (TOTAL_HERRAMIENTAS - 1) * 16) / 2 + i * (LADO_RANURA + 16); }
function yRanuras() { return height - LADO_RANURA - 14; }

function sobreBarraHerramientas() {
  return mouseX >= xRanura(0) && mouseX <= xRanura(TOTAL_HERRAMIENTAS - 1) + LADO_RANURA && mouseY >= yRanuras() && mouseY <= yRanuras() + LADO_RANURA;
}

// Clic en una ranura: elige esa herramienta. Devuelve true si el clic fue ahí.
function clicEnBarraHerramientas() {
  for (let i = 0; i < TOTAL_HERRAMIENTAS; i++) {
    if (mouseX >= xRanura(i) && mouseX <= xRanura(i) + LADO_RANURA && mouseY >= yRanuras() && mouseY <= yRanuras() + LADO_RANURA) {
      herramienta = i + 1;   // HERRAMIENTA_HONGO = 1 ... HERRAMIENTA_FLOR = 4
      return true;
    }
  }
  return false;
}

// ==================================================
// Sliders de prioridades (paso 6)
// ==================================================
// Clase propia en vez de ControlP5: no hay que instalar librerías
// y se puede dibujar con el mismo estilo del juego.
// Los sliders comparten un presupuesto de PRESUPUESTO_PRIORIDADES puntos (ver
// PanelPrioridades.mover): bajar uno deja puntos libres; subir uno usa los libres
// y, si no alcanzan, le quita al que tenga más.

class Slider {
  nombre = null;
  ayudaAlta = null;     // qué pasa con el valor alto
  valor = 0;            // puntos asignados (0 a PRESUPUESTO_PRIORIDADES)
  tono = null;
  x = 0;y = 0;ancho = 0;    // posición de la barra en pantalla

  constructor(nombre, ayudaAlta, valor, tono) {
    this.nombre = nombre;
    this.ayudaAlta = ayudaAlta;
    this.valor = valor;
    this.tono = tono;
  }

  contiene(mx, my) {
    return mx >= this.x - 4 && mx <= this.x + this.ancho + 4 && my >= this.y - 5 && my <= this.y + 15;
  }

  // Qué valor corresponde a una posición x del mouse
  valorEn(mx) {
    return round(constrain((mx - this.x) / this.ancho, 0, 1) * PRESUPUESTO_PRIORIDADES);
  }

  // Versión compacta, en una sola línea: NOMBRE  [■■■■□□□□□□]  4
  // (la explicación aparece en el título del panel al pasar el mouse)
  dibujar() {
    textoPixel(this.nombre.toUpperCase(), this.x - ANCHO_ETIQUETA_SLIDER, this.y + 1, 8, this.tono);
    barraSegmentada(this.x, this.y, this.ancho, 10, this.valor / PRESUPUESTO_PRIORIDADES, PRESUPUESTO_PRIORIDADES, this.tono);
    textoPixel(str(this.valor), this.x + this.ancho + 22, this.y + 1, 8, COLOR_INTERFAZ, RIGHT);
  }
}

class PanelPrioridades {
  sliders = null;
  arrastrando = -1;   // índice del slider que se está moviendo (-1 = ninguno)
  donante = -1;       // de qué slider se sacan los puntos mientras se arrastra
  x = 0;y = 0;ancho = 0;alto = 0;

  constructor(sliders) {
    this.sliders = sliders;
  }

  // Se recalcula cada vez por si cambia el tamaño de la ventana
  ubicar() {
    this.ancho = 330;
    this.alto = 34 + this.sliders.length * ALTO_FILA_SLIDER + 6;
    this.y = height - this.alto - 10;
    // Se esconde hacia la izquierda; el botón queda alineado abajo
    this.x = plegablePrioridades.ubicar(10, this.ancho, this.y + this.alto - LADO_BOTON_PLEGAR - 3);
    for (let i = 0; i < this.sliders.length; i++) {
      this.sliders[i].x = this.x + 14 + ANCHO_ETIQUETA_SLIDER;
      this.sliders[i].y = this.y + 32 + i * ALTO_FILA_SLIDER;
      this.sliders[i].ancho = this.ancho - 28 - ANCHO_ETIQUETA_SLIDER - 26;
    }
  }

  contiene(mx, my) {
    this.ubicar();
    if (plegablePrioridades.sobreBoton()) return true;
    if (plegablePrioridades.escondido()) return false;
    return mx >= this.x && mx <= this.x + this.ancho && my >= this.y && my <= this.y + this.alto;
  }

  // Devuelve true si el clic cayó en un slider
  presionar(mx, my) {
    this.ubicar();
    for (let i = 0; i < this.sliders.length; i++) {
      if (this.sliders[i].contiene(mx, my)) {
        this.arrastrando = i;
        this.mover(i, this.sliders[i].valorEn(mx));
        return true;
      }
    }
    return false;
  }

  arrastrar(mx) {
    if (this.arrastrando >= 0) this.mover(this.arrastrando, this.sliders[this.arrastrando].valorEn(mx));
  }

  soltar() {
    this.arrastrando = -1;
    this.donante = -1;   // el próximo cambio vuelve a elegir al más alto
  }

  // Puntos que nadie está usando
  puntosLibres() {
    let usados = 0;
    for (const s of this.sliders) usados += s.valor;
    return PRESUPUESTO_PRIORIDADES - usados;
  }

  // El slider con más puntos, sin contar el que se está moviendo (-1 si todos están en 0)
  masAlto(sinContar) {
    let elegido = -1;
    for (let j = 0; j < this.sliders.length; j++) {
      if (j == sinContar || this.sliders[j].valor == 0) continue;
      if (elegido < 0 || this.sliders[j].valor > this.sliders[elegido].valor) elegido = j;
    }
    return elegido;
  }

  // Cambia un slider:
  //   - Si BAJA: solo baja. Los puntos quedan libres y los demás no se tocan.
  //   - Si SUBE: primero usa los puntos libres. Si no alcanzan, le quita al slider
  //     que tenga más puntos (siempre al mismo mientras se arrastra; si llega a 0,
  //     sigue con el siguiente más alto).
  mover(i, nuevo) {
    let s = this.sliders[i];
    if (nuevo <= s.valor) {
      s.valor = nuevo;
      aplicarPrioridades();
      return;
    }
    let falta = nuevo - s.valor;
    let libres = min(falta, this.puntosLibres());
    s.valor += libres;
    falta -= libres;
    while (falta > 0) {
      if (this.donante < 0 || this.donante == i || this.sliders[this.donante].valor == 0) this.donante = this.masAlto(i);
      if (this.donante < 0) break;   // ya no hay de dónde sacar
      this.sliders[this.donante].valor--;
      s.valor++;
      falta--;
    }
    aplicarPrioridades();
  }

  dibujar() {
    plegablePrioridades.animar();
    this.ubicar();
    plegablePrioridades.dibujarBoton();
    if (plegablePrioridades.escondido()) return;   // solo queda el botón
    marcoArcade(this.x, this.y, this.ancho, this.alto, COLOR_LUZ);
    // Título; al pasar el mouse por un slider, muestra qué hace
    let encima = null;
    for (const s of this.sliders) if (s.contiene(mouseX, mouseY)) encima = s;
    if (encima == null) {
      textoPixel("PRIORIDADES", this.x + 14, this.y + 12, 8, COLOR_INTERFAZ);
      let libres = this.puntosLibres();
      if (libres > 0) textoPixel("LIBRES " + libres, this.x + this.ancho - 14, this.y + 12, 8, COLOR_ARBOL, RIGHT);
      else            textoPixel(PRESUPUESTO_PRIORIDADES + " PTS", this.x + this.ancho - 14, this.y + 12, 8, COLOR_GRIS, RIGHT);
    } else {
      textFont(fuenteTexto);
      textSize(12);
      fill(encima.tono);
      text(encima.nombre + ": " + encima.ayudaAlta, this.x + 14, this.y + 8);
    }
    for (const s of this.sliders) s.dibujar();
  }
}

let plegablePrioridades;   // se crea en iniciarInterfaz()

const ANCHO_ETIQUETA_SLIDER = 112;   // espacio para el nombre ("REPRODUCIRSE")
const ALTO_FILA_SLIDER = 22;

let prioridades;   // se crea en iniciarInterfaz()

// Pasa los valores de los sliders a las variables que lee la Simulacion
function aplicarPrioridades() {
  puntosAlimentarse  = prioridades.sliders[0].valor;
  puntosCuidar       = prioridades.sliders[1].valor;
  puntosReproducirse = prioridades.sliders[2].valor;
  puntosHuir         = prioridades.sliders[3].valor;
}

// ==================================================
// PANTALLAS: inicio, cómo jugar (tutorial) y juego
// ==================================================
// El tutorial deja clara la CONDICIÓN para cumplir el objetivo:
// el bosque sigue vivo mientras quede al menos un hada encendida.
// Estados del usuario que cubre el juego:
//   comprensión -> pantalla de inicio y "Cómo jugar"
//   logro       -> sobrevivir rondas, nuevas hadas, cazadores encerrados
//   frustración -> hadas atrapadas o apagadas, "El bosque se apagó"

// "Cómo jugar" ya no es una pantalla aparte: es un tutorial interactivo
// que se juega dentro de la pantalla de juego (ver Tutorial.js).
const PANTALLA_INICIO = 0, PANTALLA_JUEGO = 2, PANTALLA_LOGIN = 3, PANTALLA_HADA = 4;
let pantalla = PANTALLA_INICIO;
let hayPartidaEnCurso = false;   // para mostrar "Continuar" en el inicio

// ---------- Botones ----------
class Boton {
  texto = null;
  x = 0;y = 0;ancho = 0;alto = 0;
  tono = null;
  RELIEVE = 6;   // grosor del costado del botón (efecto 3D)

  constructor(texto, x, y, ancho, alto, tono) {
    this.texto = texto;
    this.x = x;
    this.y = y;
    this.ancho = ancho;
    this.alto = alto;
    this.tono = tono;
  }

  contiene(mx, my) {
    return mx >= this.x && mx <= this.x + this.ancho && my >= this.y && my <= this.y + this.alto + this.RELIEVE;
  }

  // Botón arcade: contorno negro con esquinas recortadas, cara de color con brillo
  // arriba y sombra abajo, y un costado oscuro que da relieve. Al presionarlo se hunde.
  dibujar() {
    let encima = this.contiene(mouseX, mouseY);
    let apretado = encima && mouseIsPressed;
    let dy = apretado ? this.RELIEVE - 2 : 0;
    noStroke();
    fill(color('#000000'));                                     // contorno
    rect(this.x - 3, this.y, this.ancho + 6, this.alto + this.RELIEVE);
    rect(this.x, this.y - 3, this.ancho, this.alto + this.RELIEVE + 6);
    fill(oscurecer(this.tono, 0.55));                       // costado
    rect(this.x, this.y + this.RELIEVE, this.ancho, this.alto);
    let cara = encima ? aclarar(this.tono, 0.25) : this.tono;
    fill(cara);                                        // cara
    rect(this.x, this.y + dy, this.ancho, this.alto);
    fill(aclarar(cara, 0.55));                         // brillo
    rect(this.x, this.y + dy, this.ancho, 3);
    rect(this.x, this.y + dy, 3, this.alto);
    fill(oscurecer(cara, 0.3));                        // sombra interior
    rect(this.x, this.y + dy + this.alto - 3, this.ancho, 3);
    rect(this.x + this.ancho - 3, this.y + dy, 3, this.alto);

    // Texto: 16 px si cabe, si no 8 px
    textFont(fuentePixel);
    textSize(16);
    let tam = (textWidth(quitarTildes(this.texto.toUpperCase())) > this.ancho - 28) ? 8 : 16;
    textoPixel(this.texto.toUpperCase(), this.x + this.ancho / 2 + 2, this.y + dy + this.alto / 2 - tam / 2 + 2, tam, oscurecer(this.tono, 0.45), CENTER);
    textoPixel(this.texto.toUpperCase(), this.x + this.ancho / 2, this.y + dy + this.alto / 2 - tam / 2, tam, COLOR_PANEL, CENTER);
    // Flechitas a los lados cuando el mouse está encima
    if (encima && parpadeo(12)) {
      textoPixel(">", this.x - 22, this.y + dy + this.alto / 2 - 4, 8, this.tono);
      textoPixel("<", this.x + this.ancho + 14, this.y + dy + this.alto / 2 - 4, 8, this.tono);
    }
  }
}

// Botones del inicio (se ubican cada vez que se dibujan)
let botonJugar, botonContinuar, botonComoJugar;

function crearBotonesInicio() {
  let ancho = 340, alto = 46, x = width / 2 - ancho / 2, y = 326;
  let paso = 64;
  if (hayPartidaEnCurso) {
    botonContinuar = new Boton("Continuar", x, y, ancho, alto, COLOR_FLOR);
    y += paso;
  } else {
    botonContinuar = null;
  }
  botonJugar     = new Boton(hayPartidaEnCurso ? "Partida nueva" : "Jugar", x, y, ancho, alto, COLOR_HADA);
  botonComoJugar = new Boton("Cómo jugar", x, y + paso, ancho, alto, COLOR_LUZ);
  botonHadaDiseno = new Boton("Crear hada", 24, 164, 250, 40, COLOR_ARBOL);   // DisenoHada
  ubicarPanelSonido(x, botonComoJugar.y + alto + 20, ancho);   // debajo de "Cómo jugar"
}

// ==================================================
// Panel SONIDO (en el inicio, debajo de "Cómo jugar")
// ==================================================
// Una barra de 10 bloques, como las de las prioridades, para el volumen de los
// efectos (el juego no tiene música). Con Esc se vuelve al inicio (la partida
// queda en pausa) y desde aquí se ajusta el volumen.
let sliderEfectos;   // se crea en iniciarInterfaz()
let panelSonidoX, panelSonidoY, panelSonidoAncho;
const ALTO_PANEL_SONIDO = 56;
let arrastrandoSonido = false;

function ubicarPanelSonido(x, y, ancho) {
  panelSonidoX = x;
  panelSonidoY = y;
  panelSonidoAncho = ancho;
  sliderEfectos.x = x + 14 + ANCHO_ETIQUETA_SLIDER;
  sliderEfectos.y = y + 32;
  sliderEfectos.ancho = ancho - 28 - ANCHO_ETIQUETA_SLIDER - 26;
  // El nivel de Audio es el que manda (puede venir de lo guardado)
  sliderEfectos.valor = nivelEfectos;
}

function dibujarPanelSonido() {
  marcoArcade(panelSonidoX, panelSonidoY, panelSonidoAncho, ALTO_PANEL_SONIDO, COLOR_LUZ);
  textoPixel("SONIDO", panelSonidoX + 14, panelSonidoY + 12, 8, COLOR_INTERFAZ);
  let modo = sonidoEncendido ? "[X] ENCENDIDO" : "[X] SILENCIO";
  textoPixel(modo, panelSonidoX + panelSonidoAncho - 14, panelSonidoY + 12, 8, sonidoEncendido ? COLOR_GRIS : COLOR_ARBOL, RIGHT);
  sliderEfectos.dibujar();
}

// Devuelve true si el clic cayó en la barra
function clicEnSonido() {
  if (!sliderEfectos.contiene(mouseX, mouseY)) return false;
  arrastrandoSonido = true;
  arrastrarSonido();
  return true;
}

function arrastrarSonido() {
  if (!arrastrandoSonido) return;
  let nuevo = sliderEfectos.valorEn(mouseX);
  if (nuevo != nivelEfectos) {
    nivelEfectos = nuevo;
    sonar("tick", 1, 0);      // Audio: una muestra del volumen nuevo
  }
  sliderEfectos.valor = nivelEfectos;
}

function soltarSonido() {
  if (!arrastrandoSonido) return;
  arrastrandoSonido = false;
  guardarUsuario();   // Red: se recuerda para la próxima vez
}

// Botones de la pantalla de resultado
let botonOtraVez, botonMenu;

function crearBotonesFin() {
  let y = 70 + 560 - 104;
  botonOtraVez = new Boton("Otra vez", 110 + 70, y, 190, 44, COLOR_HADA);
  botonMenu    = new Boton("Menú", 110 + 560 - 70 - 190, y, 190, 44, COLOR_LUZ);
}

// Devuelve true si el clic cayó en un botón del resultado
function clicEnFin() {
  crearBotonesFin();
  if (botonOtraVez.contiene(mouseX, mouseY)) { empezarJuego(); return true; }
  if (botonMenu.contiene(mouseX, mouseY))    { irAlInicio();   return true; }
  return false;
}

// ---------- Navegación ----------

function irAlInicio() {
  if (modoTutorial) salirDelTutorial();   // Tutorial: se deja el bosque de práctica
  pantalla = PANTALLA_INICIO;
  hayPartidaEnCurso = !finDelJuego() && tiempoJuego > 0;
  vistaInicial();   // de fondo se ve todo el bosque
  pedirRanking();   // Red: actualiza el top del bosque del día
}

// El último nombre aparece ya escrito: Enter para seguir con él.
// Si se empieza a escribir, se borra y se escribe uno nuevo (computador compartido, web).
let nombrePrecargado = false;

function irAlLogin() {
  pantalla = PANTALLA_LOGIN;
  textoLogin = nombreJugador;
  nombrePrecargado = !nombreJugador.equals("");
}

function empezarJuego() {
  if (modoTutorial) salirDelTutorial();   // Tutorial
  nuevaPartida(semillaDelDia);   // Main: el bosque del día (el que se ve de fondo); entra al ranking
  pantalla = PANTALLA_JUEGO;
  mostrarAviso("Objetivo: que no se apague la última hada. Cuantas más sigan encendidas, mejor.", 6000);
}

function continuarJuego() {
  pantalla = PANTALLA_JUEGO;
  zoom = zoomObjetivo = 1;
  centrarEn(centroX(arbolCol), centroY(arbolFila));
}

// ---------- Entrada en las pantallas de menú ----------

function clicEnMenu() {
  if (pantalla == PANTALLA_INICIO) {
    crearBotonesInicio();
    if (clicEnSonido()) return;   // barras de volumen
    if (botonContinuar != null && botonContinuar.contiene(mouseX, mouseY)) continuarJuego();
    else if (botonJugar.contiene(mouseX, mouseY)) empezarJuego();
    else if (botonComoJugar.contiene(mouseX, mouseY)) empezarTutorial();   // Tutorial
    else if (botonHadaDiseno.contiene(mouseX, mouseY)) irAlDisenoHada();
  } else if (pantalla == PANTALLA_HADA) {
    clicEnHada();   // DisenoHada
  }
}

function teclaEnMenu() {
  if (pantalla == PANTALLA_LOGIN) {
    teclaEnLogin();
    return;
  }
  if (pantalla == PANTALLA_INICIO) {
    if (key == 'n' || key == 'N') irAlLogin();
    if (key == ENTER || key == RETURN || key == ' ') {
      if (hayPartidaEnCurso) continuarJuego(); else empezarJuego();
    }
    if (key == 'h' || key == 'H') empezarTutorial();   // Tutorial
    if (key == 'c' || key == 'C') irAlDisenoHada();   // crear la hada
  } else if (pantalla == PANTALLA_HADA) {
    teclaEnHada();   // DisenoHada
  }
}


// ==================================================
// LOGIN: el nombre del Guardián (viaja en el JSON del puntaje)
// ==================================================
let textoLogin = "";
const LARGO_NOMBRE = 14;

function teclaEnLogin() {
  if (key == BACKSPACE) {
    nombrePrecargado = false;
    if (textoLogin.length > 0) textoLogin = textoLogin.substring(0, textoLogin.length - 1);
  } else if (key == ENTER || key == RETURN) {
    let limpio = textoLogin.trim();
    if (limpio.length >= 2) {
      nombreJugador = limpio;
      guardarUsuario();   // Red
      irAlInicio();
    } else {
      mostrarMensaje("El nombre debe tener al menos 2 letras");
    }
  } else if (key == ESC) {
    if (!nombreJugador.equals("")) irAlInicio();   // cancelar si ya tenía nombre
  } else if (key != CODED && caracterValido(key)) {
    if (nombrePrecargado) {   // otra persona: empieza un nombre nuevo
      textoLogin = "";
      nombrePrecargado = false;
    }
    if (textoLogin.length < LARGO_NOMBRE) textoLogin += key;
  }
}

function caracterValido(c) {
  return Character.isLetterOrDigit(c) || c == ' ' || c == '_' || c == '-';
}

function dibujarLogin() {
  dibujarFondoMenu();
  let bob = sin(frameCount * 0.05) * 3;
  tituloArcade(NOMBRE_JUEGO, width / 2, 150 + bob, 48, COLOR_HADA);
  textoPixel(nombrePrecargado ? "¿QUIÉN JUEGA HOY, GUARDIÁN?" : "INGRESA TU NOMBRE, GUARDIÁN", width / 2, 290, 16, COLOR_INTERFAZ, CENTER);

  // Caja de texto con cursor de bloque que parpadea
  let ancho = 460, alto = 64, x = width / 2 - ancho / 2, y = 330;
  marcoArcade(x, y, ancho, alto, COLOR_LUZ);
  let mostrado = textoLogin.toUpperCase();
  textFont(fuentePixel);
  textSize(24);
  let anchoTexto = textWidth(quitarTildes(mostrado));
  textoPixel(mostrado, width / 2 - 12, y + 20, 24, COLOR_LUZ, CENTER);
  if (parpadeo(20)) {
    fill(COLOR_LUZ);
    noStroke();
    rect(width / 2 - 12 + anchoTexto / 2 + 4, y + 20, 18, 24);
  }

  textoPixel("ENTER PARA CONFIRMAR  ·  DE 2 A " + LARGO_NOMBRE + " LETRAS", width / 2, 420, 8, COLOR_GRIS, CENTER);
  textoPixel("TU NOMBRE APARECERÁ EN EL RANKING DEL BOSQUE DEL DÍA", width / 2, 440, 8, COLOR_GRIS, CENTER);
  if (nombrePrecargado && parpadeo(40))
    textoPixel("¿ERES " + nombreJugador.toUpperCase() + "? ENTER PARA SEGUIR  ·  O ESCRIBE OTRO NOMBRE", width / 2, 472, 8, COLOR_ARBOL, CENTER);
  if (millis() < mensajeHasta) textoPixel(mensaje.toUpperCase(), width / 2, 500, 8, colorMensaje, CENTER);
  lineasCRT();
}

// ==================================================
// Ranking (se dibuja en el inicio y al final de la partida)
// ==================================================
function dibujarRanking(x, y, ancho, filas, subtitulo) {
  let alto = 120 + filas * 22;
  marcoArcade(x, y, ancho, alto, COLOR_ARBOL);
  textoMulticolor("RANKING", x + ancho / 2, y + 18, 24);
  textoPixel(subtitulo, x + ancho / 2, y + 52, 8, COLOR_GRIS, CENTER);
  if (!estadoRanking.equals("")) {
    textFont(fuenteTexto);
    textSize(11);
    textAlign(CENTER, TOP);
    fill(COLOR_INTERFAZ, 110);
    text(estadoRanking, x + ancho / 2, y + 64);
    textAlign(LEFT, TOP);
  }

  // Columnas
  let cPuesto = x + 22, cPuntaje = x + 92, cNombre = x + 190;
  textoPixel("PUESTO", cPuesto, y + 86, 8, COLOR_ARBOL);
  textoPixel("PUNTAJE", cPuntaje, y + 86, 8, COLOR_ARBOL);
  textoPixel("NOMBRE", cNombre, y + 86, 8, COLOR_ARBOL);

  let lista = rankingCompleto;
  if (lista.size() == 0) {
    textoPixel("NADIE HA JUGADO HOY", x + ancho / 2, y + 120, 8, COLOR_GRIS, CENTER);
    if (parpadeo(30)) textoPixel("¡SÉ EL PRIMERO!", x + ancho / 2, y + 142, 8, COLOR_HADA, CENTER);
    return;
  }
  let colores = [ COLOR_INTERFAZ, COLOR_LUZ, COLOR_HADA, COLOR_FLOR, COLOR_ARBOL ];
  for (let i = 0; i < min(filas, lista.size()); i++) {
    let p = lista.get(i);
    let fy = y + 110 + i * 22;
    let c = colores[i % colores.length];
    let soyYo = p.getString("nombre", "").equals(nombreJugador);
    if (soyYo && parpadeo(15)) textoPixel(">", x + 8, fy, 8, c);
    textoPixel((i + 1) + "º", cPuesto + 6, fy, 8, c);
    textoPixel(nf(p.getInt("puntaje", 0), 5), cPuntaje, fy, 8, c);
    let nombre = p.getString("nombre", "?").toUpperCase();
    if (nombre.length > 12) nombre = nombre.substring(0, 12);
    textoPixel(nombre, cNombre, fy, 8, c);
  }
}

// ==================================================
// Dibujo de las pantallas de menú
// ==================================================

// De fondo: el bosque completo, oscurecido, con hadas que revolotean
function dibujarFondoMenu() {
  push();
  aplicarCamara();
  dibujarMundo();      // Renderizado
  pop();
  noStroke();
  fill(COLOR_FONDO, 175);
  rect(0, 0, width, height);
  // Hadas decorativas que flotan por la pantalla
  for (let i = 0; i < 7; i++) {
    let t = frameCount * 0.004 + i * 1.7;
    let x = width / 2 + cos(t * 1.3 + i) * (380 + 120 * sin(t * 0.7));
    let y = height / 2 + sin(t * 1.1 + i * 2) * 260;
    dibujarBrillo(x, y, 70, COLOR_LUZ, 120);
    if (sprHadaBrillo != null) image(sprHadaBrillo, x - 16, y - 16, 32, 32);
  }
}

function dibujarInicio() {
  dibujarFondoMenu();
  crearBotonesInicio();

  // Título que flota con brillo detrás
  let bob = sin(frameCount * 0.05) * 3;
  dibujarBrillo(width / 2, 150, 620, COLOR_HADA, 60);
  tituloArcade(NOMBRE_JUEGO, width / 2, 120 + bob, 48, COLOR_HADA);
  textoPixelSombra(SUBTITULO_JUEGO, width / 2, 192, 16, COLOR_LUZ, COLOR_SOMBRA, CENTER);

  // El objetivo, en una línea clara
  textFont(fuenteTexto);
  textSize(16);
  textAlign(CENTER, TOP);
  fill(COLOR_INTERFAZ);
  text("Eres el Guardián del Bosque. Mantén encendida al menos un hada el mayor", width / 2, 240);
  text("tiempo posible: si se apaga la última, el bosque se apaga.", width / 2, 262);
  textAlign(LEFT, TOP);

  if (botonContinuar != null) botonContinuar.dibujar();
  botonJugar.dibujar();
  botonComoJugar.dibujar();
  dibujarPanelSonido();
  botonHadaDiseno.dibujar();
  if (parpadeo(30)) textoPixel("PRESIONA ENTER", width / 2, 624, 16, COLOR_ARBOL, CENTER);

  // Guardián y bosque del día (arriba a la izquierda)
  textoPixel("GUARDIÁN", 24, 22, 8, COLOR_GRIS);
  textoPixel(nombreJugador.toUpperCase(), 24, 38, 16, COLOR_LUZ);
  textoPixel("[N] CAMBIAR", 24, 62, 8, COLOR_GRIS);
  textoPixel("BOSQUE DEL DÍA", 24, 92, 8, COLOR_GRIS);
  textoPixel(nf(day(), 2) + "/" + nf(month(), 2) + "/" + year(), 24, 108, 16, COLOR_ARBOL);
  textoPixel("TODOS JUEGAN ESTE BOSQUE HOY", 24, 132, 8, COLOR_GRIS);

  // Ranking del día (a la derecha)
  dibujarRanking(width - 360, 300, 340, 10, "HOY");

  textoPixel("[ENTER] JUGAR  [H] CÓMO JUGAR  [N] NOMBRE  [C] HADA  [X] SONIDO", width / 2, height - 24, 8, COLOR_GRIS, CENTER);
  lineasCRT();
}

// ==================================================
// Panel de RIVALES EN LÍNEA (debajo del recuadro de fase)
// ==================================================
// Cada rival tiene tres íconos: clic en uno le manda ese cazador (Red).
const MAX_FILAS_RIVALES = 5;
const ALTO_FILA_RIVAL = 32, LADO_BOTON_ENVIO = 24;

// Se esconde hacia el borde derecho con su botón de flecha (clase Plegable, abajo)
let plegableRivales;   // se crea en iniciarInterfaz()

function xPanelRivales() { return plegableRivales.ubicar(width - ANCHO_PANEL_FASE - 10, ANCHO_PANEL_FASE, yPanelRivales()); }
function yPanelRivales() { return 10 + ALTO_PANEL_FASE + 10; }
function filasRivales() { return min(MAX_FILAS_RIVALES, rivales.size()); }
function altoPanelRivales() { return 36 + max(1, filasRivales()) * ALTO_FILA_RIVAL + 24; }

function sobrePanelRivales() {
  if (!hayFirebase()) return false;
  if (modoTutorial && !tutorialMuestraRivales()) return false;   // en el tutorial solo se ve en su paso
  xPanelRivales();   // deja el botón en su lugar
  if (plegableRivales.sobreBoton()) return true;
  if (plegableRivales.escondido()) return false;
  return mouseX >= xPanelRivales() && mouseX <= xPanelRivales() + ANCHO_PANEL_FASE
         && mouseY >= yPanelRivales() && mouseY <= yPanelRivales() + altoPanelRivales();
}

// Posición del ícono de un cazador (0 Veloz, 1 Trampero, 2 Rastreador) en una fila
function xBotonEnvio(tipo) { return xPanelRivales() + ANCHO_PANEL_FASE - 14 - (3 - tipo) * (LADO_BOTON_ENVIO + 6) + 6; }
function yBotonEnvio(fila) { return yPanelRivales() + 36 + fila * ALTO_FILA_RIVAL + 2; }

function clicEnRivales() {
  if (!sobrePanelRivales()) return false;
  if (plegableRivales.clic()) return true;   // mostrar u ocultar el panel
  if (modoTutorial) return true;             // en la práctica no se envía nada de verdad
  let lista = rivales;
  for (let i = 0; i < min(MAX_FILAS_RIVALES, lista.size()); i++) {
    for (let tipo = 0; tipo < 3; tipo++) {
      let bx = xBotonEnvio(tipo), by = yBotonEnvio(i);
      if (mouseX >= bx && mouseX <= bx + LADO_BOTON_ENVIO && mouseY >= by && mouseY <= by + LADO_BOTON_ENVIO) {
        enviarCazador(lista.get(i), tipo);   // Red
        return true;
      }
    }
  }
  return true;   // el clic fue en el panel: no tocar el mundo
}

// ==================================================
// Paneles plegables (marcador, prioridades y rivales)
// ==================================================
// Un botón cuadrado con flecha al costado del panel. Al pulsarlo, el panel se
// desliza hacia su borde de la pantalla y solo queda el botón para traerlo de vuelta.
const LADO_BOTON_PLEGAR = 28;
const SEPARACION_BOTON_PLEGAR = 6;

class Plegable {
  haciaDerecha = false;        // hacia qué borde se esconde
  tono = null;
  oculto = false;
  desplazamiento = 0;    // 0 = visible; recorrido = escondido (se anima)
  recorrido = 0;
  bx = 0;by = 0;                // posición del botón

  constructor(haciaDerecha, tono) {
    this.haciaDerecha = haciaDerecha;
    this.tono = tono;
  }

  // Recibe dónde va el panel normalmente y devuelve dónde dibujarlo ahora.
  // El botón queda pegado al costado del panel que mira al centro de la pantalla.
  ubicar(xNormal, ancho, yBoton) {
    this.recorrido = ancho + SEPARACION_BOTON_PLEGAR;
    let x = this.haciaDerecha ? xNormal + this.desplazamiento : xNormal - this.desplazamiento;
    this.bx = this.haciaDerecha ? x - LADO_BOTON_PLEGAR - SEPARACION_BOTON_PLEGAR : x + ancho + SEPARACION_BOTON_PLEGAR;
    this.by = yBoton;
    return x;
  }

  // Una vez por cuadro: acerca el desplazamiento a su objetivo (deslizamiento suave)
  animar() {
    let objetivo = this.oculto ? this.recorrido : 0;
    this.desplazamiento = lerp(this.desplazamiento, objetivo, 0.25);
    if (abs(this.desplazamiento - objetivo) < 0.5) this.desplazamiento = objetivo;
  }

  escondido() { return this.oculto && this.desplazamiento >= this.recorrido - 1; }

  sobreBoton() {
    return mouseX >= this.bx - 3 && mouseX <= this.bx + LADO_BOTON_PLEGAR + 3
           && mouseY >= this.by - 3 && mouseY <= this.by + LADO_BOTON_PLEGAR + 6;
  }

  clic() {
    if (!this.sobreBoton()) return false;
    this.oculto = !this.oculto;
    return true;
  }

  // Botón con relieve (como los del menú) y una flecha triangular de pixeles
  dibujarBoton() {
    let x = this.bx, y = this.by, l = LADO_BOTON_PLEGAR;
    let encima = this.sobreBoton();
    let dy = (encima && mouseIsPressed) ? 2 : 0;   // se hunde al apretar
    noStroke();
    fill(color('#000000'));                                 // contorno con esquinas recortadas
    rect(x - 3, y, l + 6, l + 3);
    rect(x, y - 3, l, l + 9);
    fill(oscurecer(this.tono, 0.55));                   // costado
    rect(x, y + 3, l, l);
    let cara = encima ? aclarar(this.tono, 0.25) : this.tono;
    fill(cara);                                    // cara
    rect(x, y + dy, l, l);
    fill(aclarar(cara, 0.55));                     // brillo
    rect(x, y + dy, l, 2);
    rect(x, y + dy, 2, l);
    fill(oscurecer(cara, 0.3));                    // sombra interior
    rect(x, y + dy + l - 2, l, 2);
    rect(x + l - 2, y + dy, 2, l);

    // Flecha: 4 columnas de pixeles de 2x2 (alturas 7, 5, 3, 1).
    // Apunta hacia donde se moverá el panel al pulsar.
    let derecha = (this.haciaDerecha != this.oculto);
    fill(COLOR_PANEL);
    let p = 2, cx = x + l / 2, cy = y + dy + l / 2;
    for (let k = 0; k < 4; k++) {
      let alto = (7 - 2 * k) * p;
      let col = derecha ? cx - 4 + k * p           // ▶
                          : cx + 4 - (k + 1) * p;    // ◀
      rect(col, cy - alto / 2, p, alto);
    }
  }
}

// ==================================================
// Crear los paneles (lo llama setup en Main)
// ==================================================
// En JavaScript las clases (Plegable, Slider...) y los colores recién existen
// cuando el programa ya arrancó, por eso se crean aquí y no arriba del archivo.
function iniciarInterfaz() {
  plegableMarcador    = new Plegable(false, COLOR_HADA);
  plegablePrioridades = new Plegable(false, COLOR_LUZ);
  plegableRivales     = new Plegable(true, COLOR_LUZ);
  prioridades = new PanelPrioridades([
    new Slider("Alimentarse",  "más reserva, más brillo", puntosAlimentarse, COLOR_FLOR),
    new Slider("Cuidar",       "reviven y recargan flores", puntosCuidar, COLOR_ARBOL),
    new Slider("Reproducirse", "más hadas, menos luz al Árbol", puntosReproducirse, COLOR_HADA),
    new Slider("Huir",         "huyen antes de los cazadores", puntosHuir, COLOR_LUZ)
  ]);
  sliderEfectos = new Slider("Efectos", "", 8, COLOR_LUZ);
}
