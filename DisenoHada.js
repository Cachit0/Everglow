// ==================================================
// DISEÑO DE LA HADA: el jugador define el estilo de su familia
// ==================================================
// Cuatro sliders (Cuerpo, Alas, Brillo, Variedad) cambian la Familia (ADN.pde).
// El jugador tiene PUNTOS_CREACION (20) puntos para repartir: un rasgo solo puede
// subir si quedan puntos libres, así que hay que elegir qué le conviene más.
// A la derecha se ve una muestra de 10 hadas de esa familia: se parecen entre
// sí, pero ninguna es igual. Al mover un slider, la muestra se transforma
// (las semillas no cambian). "Remezclar" saca hadas distintas del mismo estilo.
// "Al azar" tira los dados con los sliders.

let slidersHada;
let arrastrandoHada = -1;                       // slider que se está moviendo (-1 = ninguno)
let muestraHadas = arreglo(10, null);
let semillasMuestra = arreglo(10, 0);
let mediaHada;                                  // el hada "promedio" de la familia (para mostrar sus stats)

let botonHadaDiseno;                          // en el inicio
let botonHadaAzar, botonHadaRemezclar, botonHadaListo;

const HADA_PANEL_X = 50, HADA_PANEL_Y = 100, HADA_PANEL_ANCHO = 500, HADA_PANEL_ALTO = 490;
const ALTO_FILA_RASGO = 62;               // separación entre sliders del diseño
let avisoSinPuntosHasta = 0;                    // millis() hasta el que se muestra "sin puntos"


// ---------- Entrar y salir ----------

function irAlDisenoHada() {
  pantalla = PANTALLA_HADA;
  arrastrandoHada = -1;
  if (slidersHada == null) {
    crearSlidersHada();
    remezclarMuestra();
  } else {
    // Por si la familia cambió desde afuera (por ejemplo al cargar usuario.json)
    ponerSlidersDesdeFamilia();
    regenerarMuestra();
  }
}

function terminarDisenoHada() {
  guardarUsuario();   // Red: guarda el nombre y el estilo de la familia en usuario.json
  irAlInicio();
}

// ---------- Sliders ----------

function crearSlidersHada() {
  let nombres = [ "Cuerpo", "Alas", "Brillo", "Variedad" ];
  let ayudas = [
    "GRANDE: MÁS LUZ Y DURA MÁS, PERO ES LENTA",
    "LARGAS: RÁPIDA, PERO GASTA MÁS LUZ",
    "ALTO: ENTREGA MÁS LUZ, PERO SE VE DE LEJOS",
    "ALTA: NACEN MÁS BARATAS, PERO MÁS DISPAREJAS"
  ];
  let tonos = [ COLOR_HADA, COLOR_LUZ, COLOR_ARBOL, COLOR_FLOR ];
  slidersHada = arreglo(4, null);
  for (let i = 0; i < 4; i++) {
    slidersHada[i] = new Slider(nombres[i], ayudas[i], 5, tonos[i]);
    slidersHada[i].x = HADA_PANEL_X + 16 + ANCHO_ETIQUETA_SLIDER;
    slidersHada[i].y = HADA_PANEL_Y + 56 + i * ALTO_FILA_RASGO;
    slidersHada[i].ancho = HADA_PANEL_ANCHO - 32 - ANCHO_ETIQUETA_SLIDER - 26;
  }
  ponerSlidersDesdeFamilia();
}

function ponerSlidersDesdeFamilia() {
  familia.ajustarAPresupuesto();   // ADN: por si venía con más puntos de los permitidos
  slidersHada[0].valor = round(familia.cuerpo   * MAX_PUNTOS_RASGO);
  slidersHada[1].valor = round(familia.alas     * MAX_PUNTOS_RASGO);
  slidersHada[2].valor = round(familia.brillo   * MAX_PUNTOS_RASGO);
  slidersHada[3].valor = round(familia.variedad * MAX_PUNTOS_RASGO);
  actualizarMediaHada();
}

// ---------- Puntos de creación ----------

function puntosUsados() {
  let suma = 0;
  for (const s of slidersHada) suma += s.valor;
  return suma;
}

function puntosLibres() {
  return PUNTOS_CREACION - puntosUsados();
}

// Mueve el slider i hacia el valor pedido, sin gastar más puntos de los que quedan
function moverRasgo(i, pedido) {
  let tope = slidersHada[i].valor + puntosLibres();   // lo máximo que se puede pagar
  let nuevo = min(pedido, tope);
  if (pedido > tope) avisoSinPuntosHasta = millis() + 1500;
  if (nuevo != slidersHada[i].valor) {
    slidersHada[i].valor = nuevo;
    leerSlidersHada();
  }
}

// Los sliders cambiaron: actualizar la familia y la muestra
function leerSlidersHada() {
  familia.cuerpo   = slidersHada[0].valor / MAX_PUNTOS_RASGO;
  familia.alas     = slidersHada[1].valor / MAX_PUNTOS_RASGO;
  familia.brillo   = slidersHada[2].valor / MAX_PUNTOS_RASGO;
  familia.variedad = slidersHada[3].valor / MAX_PUNTOS_RASGO;
  actualizarMediaHada();
  regenerarMuestra();
}

// El hada sin variación: la que representa a la familia (se usa para los stats)
function actualizarMediaHada() {
  mediaHada = new ADN();
  mediaHada.cuerpo = familia.cuerpo;
  mediaHada.alas = familia.alas;
  mediaHada.brillo = familia.brillo;
  mediaHada.construir();
}

function regenerarMuestra() {
  for (let i = 0; i < muestraHadas.length; i++) muestraHadas[i] = new ADN(familia, semillasMuestra[i]);
}

function remezclarMuestra() {
  for (let i = 0; i < semillasMuestra.length; i++) semillasMuestra[i] = int(random(999999));
  regenerarMuestra();
}

// Tira los dados: reparte los 20 puntos al azar, de uno en uno
function hadaAlAzar() {
  for (const s of slidersHada) s.valor = 0;
  for (let p = 0; p < PUNTOS_CREACION; p++) {
    let i;
    do { i = int(random(slidersHada.length)); } while (slidersHada[i].valor >= MAX_PUNTOS_RASGO);
    slidersHada[i].valor++;
  }
  leerSlidersHada();
}

// ---------- Entrada ----------

function crearBotonesHada() {
  let y = 606;
  botonHadaAzar      = new Boton("Al azar",   130, y, 240, 44, COLOR_ARBOL);
  botonHadaRemezclar = new Boton("Remezclar", 480, y, 240, 44, COLOR_LUZ);
  botonHadaListo     = new Boton("Listo",     830, y, 240, 44, COLOR_HADA);
}

function clicEnHada() {
  crearBotonesHada();
  for (let i = 0; i < slidersHada.length; i++) {
    if (slidersHada[i].contiene(mouseX, mouseY)) {
      arrastrandoHada = i;
      moverRasgo(i, slidersHada[i].valorEn(mouseX));
      return;
    }
  }
  if (botonHadaAzar.contiene(mouseX, mouseY))           hadaAlAzar();
  else if (botonHadaRemezclar.contiene(mouseX, mouseY)) remezclarMuestra();
  else if (botonHadaListo.contiene(mouseX, mouseY))     terminarDisenoHada();
}

function arrastrarEnHada() {
  if (arrastrandoHada < 0) return;
  moverRasgo(arrastrandoHada, slidersHada[arrastrandoHada].valorEn(mouseX));
}

function soltarEnHada() {
  arrastrandoHada = -1;
}

function teclaEnHada() {
  if (key == ESC || key == ENTER || key == RETURN) terminarDisenoHada();
  if (key == ' ') remezclarMuestra();
  if (key == 'a' || key == 'A') hadaAlAzar();
}

// ---------- Dibujo ----------

function dibujarDisenoHada() {
  dibujarFondoMenu();
  crearBotonesHada();

  tituloArcade("CREA TU HADA", width / 2, 24, 32, COLOR_HADA);
  textoPixel("TU ESTILO DEFINE A LA FAMILIA · CADA HADA SALE UN POCO DISTINTA", width / 2, 72, 8, COLOR_GRIS, CENTER);

  // ----- Panel izquierdo: estilo y stats -----
  marcoArcade(HADA_PANEL_X, HADA_PANEL_Y, HADA_PANEL_ANCHO, HADA_PANEL_ALTO, COLOR_LUZ);
  textoPixel("ESTILO DE LA FAMILIA", HADA_PANEL_X + 16, HADA_PANEL_Y + 18, 8, COLOR_LUZ);
  // Puntos libres (arriba a la derecha); parpadea en rojo si se intentó gastar de más
  let libres = puntosLibres();
  let sinPuntos = millis() < avisoSinPuntosHasta;
  let tonoPuntos = sinPuntos ? COLOR_CAZADOR : (libres > 0 ? COLOR_ARBOL : COLOR_GRIS);
  let textoPuntos = sinPuntos ? "SIN PUNTOS: BAJA OTRO RASGO" : "PUNTOS LIBRES " + libres + "/" + PUNTOS_CREACION;
  if (!sinPuntos || parpadeo(8)) textoPixel(textoPuntos, HADA_PANEL_X + HADA_PANEL_ANCHO - 16, HADA_PANEL_Y + 18, 8, tonoPuntos, RIGHT);
  for (const s of slidersHada) {
    s.dibujar();
    textoPixel(s.ayudaAlta, s.x - ANCHO_ETIQUETA_SLIDER, s.y + 22, 8, COLOR_GRIS);
  }

  let sx = HADA_PANEL_X + 16;
  let sy = HADA_PANEL_Y + 56 + 4 * ALTO_FILA_RASGO + 4;
  textoPixel("TU HADA PROMEDIO", sx, sy, 8, COLOR_LUZ);
  let ratioVel = mediaHada.velocidad / VELOCIDAD_HADA;
  estadisticaHada("Velocidad",   "x" + nf(ratioVel, 1, 2),                    map(ratioVel, 0.55, 1.45, 0, 1),                 sx, sy + 22, COLOR_LUZ);
  estadisticaHada("Luz máxima",  str(round(mediaHada.luzMax)),                  map(mediaHada.luzMax, 70, 130, 0, 1),            sx, sy + 46, COLOR_HADA);
  estadisticaHada("Duración",    str(round(mediaHada.duracion())) + "S",        map(mediaHada.duracion(), 15, 65, 0, 1),         sx, sy + 70, COLOR_HADA);
  estadisticaHada("Entrega",     "x" + nf(mediaHada.rendimiento, 1, 2),       map(mediaHada.rendimiento, 0.7, 1.3, 0, 1),      sx, sy + 94, COLOR_ARBOL);
  estadisticaHada("Nacer cuesta", str(round(costoNacerBase())),                     map(costoNacerBase(), 180, 120, 0, 1),               sx, sy + 118, COLOR_FLOR);
  estadisticaHada("Visibilidad", "x" + nf(mediaHada.visibilidad, 1, 2),       map(mediaHada.visibilidad, 0.8, 1.2, 0, 1),      sx, sy + 142, COLOR_CAZADOR);

  // ----- Panel derecho: la familia -----
  let rx = 580, ry = 100, rancho = 570, ralto = 490;
  marcoArcade(rx, ry, rancho, ralto, COLOR_HADA);
  textoPixel("TU FAMILIA", rx + rancho / 2, ry + 18, 8, COLOR_HADA, CENTER);
  for (let i = 0; i < muestraHadas.length; i++) {
    let g = muestraHadas[i];
    let gx = rx + 5 + (i % 5) * 112;
    let gy = ry + 44 + floor(i / 5) * 218;
    let cx = gx + 56;
    let cy = gy + 56;
    let bob = sin(frameCount * g.frecAleteo + i * 1.7) * 4;
    dibujarBrillo(cx, cy + bob, 110 * g.escalaBrillo, g.colorBrillo, 90);
    image(g.sprBrillo, cx - 48, cy - 48 + bob, 96, 96);
    textoPixel("VEL " + nf(g.velocidad / VELOCIDAD_HADA, 1, 2), cx, gy + 122, 8, COLOR_GRIS, CENTER);
    textoPixel("DUR " + str(round(g.duracion())) + "S", cx, gy + 138, 8, COLOR_GRIS, CENTER);
  }

  botonHadaAzar.dibujar();
  botonHadaRemezclar.dibujar();
  botonHadaListo.dibujar();
  textoPixel("[A] AL AZAR  [ESPACIO] REMEZCLAR  [ENTER] LISTO", width / 2, height - 24, 8, COLOR_GRIS, CENTER);
  lineasCRT();
}

// Una línea de stat: NOMBRE  [■■■■□□□□□□]  valor
function estadisticaHada(nombre, valor, progreso, x, y, c) {
  let anchoBarra = HADA_PANEL_ANCHO - 32 - ANCHO_ETIQUETA_SLIDER - 70;
  textoPixel(nombre.toUpperCase(), x, y + 1, 8, c);
  barraSegmentada(x + ANCHO_ETIQUETA_SLIDER, y, anchoBarra, 10, progreso, 10, c);
  textoPixel(valor, x + HADA_PANEL_ANCHO - 32, y + 1, 8, COLOR_INTERFAZ, RIGHT);
}
