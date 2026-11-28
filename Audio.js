// ==================================================
// AUDIO: efectos de sonido de 8 bits (estilo NES)
// ==================================================
// Sin librerías: usa la Web Audio API, que ya viene en todos los navegadores.
// Los sonidos están en data/ como .wav (se pueden reemplazar por otros .wav con el mismo nombre).
//
// Cómo se conecta con el juego:
//   - En setup() solo hay que llamar a iniciarAudio().
//   - Después, este módulo MIRA el estado del juego en cada frame
//     (hadas, cazadores, fase, hongos, mensajes, pantalla...) y cuando
//     algo cambia toca el sonido que corresponde. Así no hubo que meter
//     llamadas de sonido dentro de la Simulación ni de la Interfaz.
//
// El juego no tiene música de fondo: solo efectos (botones, menús y lo que pasa en el bosque).
//
// Ojo: los navegadores no dejan sonar nada hasta que el jugador hace clic o
// aprieta una tecla. Por eso el sonido empieza con la primera tecla del login.
//
// Tecla [X]: enciende o apaga los efectos.

// ---------- Ajustes ----------
// El jugador elige el volumen en el inicio (panel SONIDO): de 0 a 10 bloques.
// Se guarda junto con el usuario (Red).
const VOLUMEN_EFECTOS_MAX = 1.0;   // volumen con la barra llena (0 a 1)
let nivelEfectos = 8;   // 0 a 10

function volumenEfectos() { return VOLUMEN_EFECTOS_MAX * nivelEfectos / 10.0; }

let sonidoEncendido = true;   // [X] lo cambia

// Efectos: nombre del archivo (sin .wav)
const NOMBRES_EFECTOS = [
  "clic", "tick", "tecla", "pantalla", "pausa",
  "hongo", "quitar", "farol", "error", "aviso",
  "nace", "atrapada", "apagada", "entrega",
  "flor_destruida", "rebrote",
  "cazador", "alerta", "encerrado", "envio",
  "oleada", "calma", "noche", "inicio", "fin"
];

let sonidos = new Map();          // nombre -> sonido listo para tocar (AudioBuffer)
let ultimaVezSonido = new Map();  // nombre -> millis() de la última vez que sonó
let mezclador = null;
let observadorAudio;

// ---------- Inicio (lo llama setup) ----------
function iniciarAudio() {
  mezclador = new MezcladorChip();
  if (!mezclador.abrir()) {
    console.log("Audio: este navegador no tiene Web Audio. El juego sigue en silencio.");
    mezclador = null;
  } else {
    for (const n of NOMBRES_EFECTOS) cargarSonido(n);
  }
  // El observador se engancha a p5: corre después de cada draw() y escucha el teclado
  observadorAudio = new ObservadorAudio();
  p5.instance.registerMethod("post", () => observadorAudio.post());
  window.addEventListener("keydown", (e) => { despertarAudio(); observadorAudio.keyEvent(e); });
  window.addEventListener("mousedown", despertarAudio);
  window.addEventListener("touchstart", despertarAudio);
}

// El navegador deja sonar recién después del primer clic o tecla
function despertarAudio() {
  if (mezclador != null) mezclador.despertar();
}

// ---------- Tocar un efecto ----------
// esperaMinima: milisegundos que deben pasar antes de repetir el mismo sonido
// (evita el ruido cuando, por ejemplo, se pintan muchos hongos seguidos)
function sonar(nombre, volumen = 1, esperaMinima = 60) {
  if (mezclador == null || !sonidoEncendido) return;
  let antes = ultimaVezSonido.get(nombre);
  if (antes != null && millis() - antes < esperaMinima) return;
  let datos = sonidos.get(nombre);
  if (datos == null) return;
  ultimaVezSonido.put(nombre, millis());
  mezclador.tocar(datos, volumen * volumenEfectos());
}

function alternarSonido() {
  sonidoEncendido = !sonidoEncendido;
  if (sonidoEncendido) mostrarAviso("Sonido: encendido  [X]", 1800);
  else                 mostrarAviso("Sonido: silencio  [X]", 1800);
}

// ---------- Cargar un .wav de la carpeta data ----------
// El navegador lo descarga y lo decodifica solo (en segundo plano).
function cargarSonido(nombre) {
  fetch("data/" + nombre + ".wav")
    .then(respuesta => {
      if (!respuesta.ok) throw new Error("falta data/" + nombre + ".wav");
      return respuesta.arrayBuffer();
    })
    .then(bytes => mezclador.contexto.decodeAudioData(bytes))
    .then(buffer => sonidos.set(nombre, buffer))
    .catch(e => console.log("Audio: no se pudo cargar " + nombre + ".wav (" + e.message + ")"));
}

// ==================================================
// El mezclador: cada sonido es una "voz" que pasa por su propio volumen
// ==================================================
// En Java había que sumar las voces a mano en un hilo aparte;
// el navegador ya mezcla solo: aquí se lleva la cuenta de las voces.
const MAX_VOCES = 24;      // tope de voces: se corta la más vieja

class MezcladorChip {
  contexto = null;
  salida = null;     // volumen general
  voces = [];

  abrir() {
    const ClaseAudio = window.AudioContext || window.webkitAudioContext;
    if (!ClaseAudio) return false;
    this.contexto = new ClaseAudio();
    this.salida = this.contexto.createGain();
    this.salida.connect(this.contexto.destination);
    return true;
  }

  despertar() {
    if (this.contexto.state == "suspended") this.contexto.resume();
  }

  // Una voz = el sonido + su volumen
  crearVoz(buffer, volumen) {
    const fuente = this.contexto.createBufferSource();
    fuente.buffer = buffer;
    const gan = this.contexto.createGain();
    gan.gain.value = volumen;
    fuente.connect(gan);
    gan.connect(this.salida);
    fuente.start();
    return { fuente: fuente, volumen: gan };
  }

  tocar(buffer, volumen) {
    if (this.contexto.state != "running") return;   // todavía sin permiso del navegador
    if (this.voces.size() >= MAX_VOCES) {
      const vieja = this.voces.remove(0);
      try { vieja.fuente.stop(); } catch (e) {}
    }
    const voz = this.crearVoz(buffer, volumen);
    this.voces.add(voz);
    voz.fuente.onended = () => this.voces.remove(voz);
  }
}

// ==================================================
// El observador: compara el juego con el frame anterior y suena lo que cambió
// ==================================================
class ObservadorAudio {
  listo = false;

  // Lo que había en el frame anterior
  pantallaAnt = 0;herramientaAnt = 0;paginaAnt = 0;faseAnt = 0;rondaAnt = 0;semillaAnt = 0;
  puntosAnt = 0;largoLoginAnt = 0;mensajeHastaAnt = 0;
  hongosAnt = 0;floresAnt = 0;farolesAnt = 0;capullosAnt = 0;
  pausaAnt = false;rutasAnt = false;reticulaAnt = false;ayudaAnt = false;nocheAnt = false;terminadaAnt = false;
  tiempoAnt = 0;luzArbolAnt = 0;luzCapulloAnt = 0;familiaAnt = 0;
  hadasVistas = new Set();
  hadasMuertas = new Set();
  atrapadasPorCazador = new Map();
  encerrados = new Set();

  // ---------- Teclado: [X] cambia el modo de sonido ----------
  keyEvent(e) {
    if (e.repeat) return;   // solo cuando se aprieta, no mientras se mantiene
    if (pantalla == PANTALLA_LOGIN) return;   // ahí la X es una letra del nombre
    if (e.key == 'x' || e.key == 'X') {
      alternarSonido();
      sonar("clic");
    }
  }

  // ---------- Después de cada draw() ----------
  post() {
    if (!this.listo) {
      this.recordarTodo();
      this.listo = true;
      return;
    }

    let entroAJugar = (pantalla != this.pantallaAnt && pantalla == PANTALLA_JUEGO);
    let partidaNueva = (semilla != this.semillaAnt) || (tiempoJuego < this.tiempoAnt - 0.001) || (entroAJugar && tiempoJuego == 0);
    let sonoInicio = false;

    // Pantallas
    if (pantalla != this.pantallaAnt) {
      if (entroAJugar && partidaNueva) {
        sonar("inicio");
        sonoInicio = true;
      } else {
        sonar("pantalla");
      }
    } else if (partidaNueva && pantalla == PANTALLA_JUEGO) {
      sonar("inicio");   // [R] bosque al azar
      sonoInicio = true;
    }

    // Interfaz
    if (herramienta != this.herramientaAnt) sonar("clic");
    if (pasoTutorial != this.paginaAnt) sonar("clic");   // Tutorial: cambió de paso
    if (pausa != this.pausaAnt) sonar("pausa");
    if (mostrarRutas != this.rutasAnt || mostrarReticula != this.reticulaAnt || mostrarAyuda != this.ayudaAnt) sonar("tick");
    if (this.codigoPuntos() != this.puntosAnt) sonar("tick", 0.8, 50);
    if (textoLogin.length != this.largoLoginAnt) sonar("tecla", 1, 20);
    if (abs(this.sumaFamilia() - this.familiaAnt) > 0.0001) sonar("tick", 0.6, 70);

    // Mensajes en pantalla (errores y avisos)
    if (mensajeHasta != this.mensajeHastaAnt && millis() < mensajeHasta && !sonoInicio) {
      if (mensaje.contains("te envió")) sonar("alerta", 1, 500);
      else if (mensaje.contains("robó")) sonar("alerta", 1, 300);   // un cazador llegó al Árbol
      else if (mensaje.startsWith("Enviando")) sonar("envio");
      else if (colorMensaje == COLOR_CAZADOR) sonar("error", 1, 300);
      else if (!mensaje.startsWith("Sonido")) sonar("aviso", 1, 300);
    }

    // Simulación (solo si es la misma partida: si empezó otra, se vuelve a contar sin sonar)
    if (partidaNueva) this.recordarMundo();
    else if (pantalla == PANTALLA_JUEGO) this.escucharSimulacion();

    this.recordarTodo();
  }

  escucharSimulacion() {
    // Hongos, flores y faroles
    let hongos = this.contarCeldas(HONGO);
    let flores = this.contarCeldas(FLOR);
    if (hongos > this.hongosAnt) sonar("hongo", 1, 45);
    else if (hongos < this.hongosAnt) sonar("quitar", 1, 45);
    if (flores > this.floresAnt) sonar("rebrote", 1, 150);   // una flor solo aumenta cuando rebrota
    if (faroles.size() > this.farolesAnt) sonar("farol");
    if (capullos.size() > this.capullosAnt) sonar("nace");   // compraste un capullo

    // Cazadores: nuevos, this.encerrados, y lo que atraparon
    let hadasAtrapadas = 0;
    for (const cz of cazadores) {
      let antes = this.atrapadasPorCazador.get(cz);
      if (antes == null) {
        if (!cz.enviadoPor.equals("")) sonar("alerta", 1, 400);
        else sonar("cazador", 0.9, 250);
        antes = cz.atrapadas;
      }
      if (cz.atrapadas > antes) {
        if (cz.tipo == TRAMPERO) sonar("flor_destruida", 1, 120);
        else hadasAtrapadas += cz.atrapadas - antes;
      }
      this.atrapadasPorCazador.put(cz, cz.atrapadas);
      if (cz.encerrado && !this.encerrados.contains(cz)) {
        this.encerrados.add(cz);
        sonar("encerrado");
      }
    }
    this.atrapadasPorCazador.retainKeys(cazadores);
    this.encerrados.retainAll(cazadores);

    // Hadas: nacimientos y muertes
    let muertesNuevas = 0;
    for (const h of hadas) {
      if (!this.hadasVistas.contains(h)) {
        this.hadasVistas.add(h);
        if (h.estado != MUERTA) sonar("nace", 1, 120);
      }
      if (h.estado == MUERTA && !this.hadasMuertas.contains(h)) {
        this.hadasMuertas.add(h);
        muertesNuevas++;
      }
    }
    this.hadasVistas.retainAll(hadas);
    this.hadasMuertas.retainAll(hadas);
    if (hadasAtrapadas > 0) sonar("atrapada", 1, 100);
    if (muertesNuevas > hadasAtrapadas) sonar("apagada", 1, 200);   // se quedó sin luz

    // Luz que llega al Árbol o al Capullo: una monedita (suave y espaciada)
    if (luzArbol > this.luzArbolAnt + 0.5 || luzCapullos() > this.luzCapulloAnt + 0.5) sonar("entrega", 0.5, 400);

    // Fases
    if (fase != this.faseAnt) {
      if (fase == AMENAZA) sonar("oleada");   // anochece: llegan los cazadores
      else sonar("calma");                    // amanece
    }

    // Fin de la partida
    if (partidaTerminada && !this.terminadaAnt) sonar("fin");
  }

  // ---------- Recordar el estado actual ----------
  recordarTodo() {
    this.pantallaAnt = pantalla;
    this.herramientaAnt = herramienta;
    this.paginaAnt = pasoTutorial;
    this.pausaAnt = pausa;
    this.rutasAnt = mostrarRutas;
    this.reticulaAnt = mostrarReticula;
    this.ayudaAnt = mostrarAyuda;
    this.puntosAnt = this.codigoPuntos();
    this.largoLoginAnt = textoLogin.length;
    this.familiaAnt = this.sumaFamilia();
    this.mensajeHastaAnt = mensajeHasta;
    this.semillaAnt = semilla;
    this.tiempoAnt = tiempoJuego;
    this.faseAnt = fase;
    this.rondaAnt = ronda;
    this.nocheAnt = esDeNoche();
    this.terminadaAnt = partidaTerminada;
    this.luzArbolAnt = luzArbol;
    this.luzCapulloAnt = luzCapullos();
    this.hongosAnt = this.contarCeldas(HONGO);
    this.floresAnt = this.contarCeldas(FLOR);
    this.farolesAnt = faroles.size();
    this.capullosAnt = capullos.size();
  }

  // Partida nueva: se anotan las hadas y cazadores que ya están, sin sonar
  recordarMundo() {
    this.hadasVistas.clear();
    this.hadasMuertas.clear();
    this.atrapadasPorCazador.clear();
    this.encerrados.clear();
    for (const h of hadas) {
      this.hadasVistas.add(h);
      if (h.estado == MUERTA) this.hadasMuertas.add(h);
    }
    for (const cz of cazadores) {
      this.atrapadasPorCazador.put(cz, cz.atrapadas);
      if (cz.encerrado) this.encerrados.add(cz);
    }
  }

  codigoPuntos() {
    return puntosAlimentarse * 1000 + puntosCuidar * 100 + puntosReproducirse * 10 + puntosHuir;
  }

  sumaFamilia() {
    return familia.cuerpo + familia.alas * 3 + familia.brillo * 7 + familia.variedad * 13;
  }

  contarCeldas(tipo) {
    let n = 0;
    for (let c = 0; c < COLUMNAS; c++)
      for (let f = 0; f < FILAS; f++)
        if (mundo[c][f] == tipo) n++;
    return n;
  }
}
