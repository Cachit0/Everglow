// ==================================================
// RED: login, ranking, bosque del día y rivales en línea (Firebase)
// ==================================================
// Multijugador: cada jugador juega su propio bosque y lo único que se
// comparte en red son DATOS, como pide el profe.
//
//   1. LOGIN: el jugador escribe su nombre; se guarda en el navegador (localStorage).
//   2. BOSQUE DEL DÍA: la semilla sale de la fecha, así que ese día todos
//      juegan el mismo bosque y el ranking es justo.
//   3. RANKING: UN registro por jugador, con su MEJOR puntaje del día.
//   4. RIVALES EN LÍNEA: mientras juegas, cada 4 s se publica tu estado
//      (ronda, hadas, fase) y se descarga el de los demás.
//   5. ENVIAR CAZADORES: en la calma puedes pagar luz del Árbol para mandarle
//      un cazador a un rival; le llega en su siguiente amenaza.
//
// Estructura en Firebase (Realtime Database, API REST, sin librerías):
//   ranking  / <semilla> / B / <jugador>      = { nombre, puntaje, tiempo, rondas, partidas, ... }
//   jugadores / <jugador>                       = { nombre, ronda, hadas, fase, opcion, ultimaVez }
//   envios   / <jugador destino> / <id>         = { de, cazador, hora }
//   (<jugador> = el nombre en minúsculas, sin espacios: "Luna" y "luna" son la misma persona)
//
// Sin FIREBASE_URL o sin internet: el ranking se guarda en este navegador
// y lo de rivales simplemente no aparece.
// En Java esto iba en hilos aparte (thread()). En JavaScript se usa "async/await":
// el juego sigue dibujando mientras se espera la respuesta de la red.

let nombreJugador = "";
let semillaDelDia = 0;
let partidaClasificatoria = false;   // true = bosque del día (entra al ranking); false = bosque al azar (práctica)
let partidaTerminada = false;

// Lo que se muestra en pantalla
let estadoEnvio = "";
let estadoRanking = "";
let puestoObtenido = -1;
let recordPersonal = false;
let rankingCompleto = [];   // ordenado de mayor a menor puntaje (JSONObject)

// Rivales y envíos
let rivales = [];            // otros jugadores en línea ahora
let recibidos = [];          // cazadores que me mandaron (los llena el ciclo de red)
let cazadoresEnCamino = [];  // ya avisados: llegan en la próxima amenaza
let rondaUltimoEnvio = -1;   // para permitir un solo envío por ronda
let cicloDeRedIniciado = false;

// ---------- Rutas ----------

function calcularSemillaDelDia() {
  return year() * 10000 + month() * 100 + day();   // por ejemplo 20261108
}

// Antes había dos modos (A y B); quedó solo el de día y noche ("B").
// Se mantiene "B" en las rutas para no cambiar las reglas de Firebase.
function letraOpcion() {
  return "B";
}

function hayFirebase() {
  return FIREBASE_URL != null && FIREBASE_URL.trim().length > 0;
}

function urlFirebase(ruta) {
  let base = FIREBASE_URL.trim();
  if (base.endsWith("/")) base = base.substring(0, base.length - 1);
  return base + "/" + ruta + ".json";
}

// La clave de un jugador en Firebase: minúsculas y sin espacios, segura para una URL
function claveJugador(nombre) {
  let clave = nombre.trim().toLowerCase().replaceAll(" ", "_");
  return encodeURIComponent(clave);
}

function rutaRanking() {
  return urlFirebase("ranking/" + semillaDelDia + "/" + letraOpcion());
}

// ---------- Dónde se guardan los datos ----------
// En la web no hay carpeta del sketch: se guardan en el navegador (localStorage),
// que los conserva entre visitas. Cada computador/navegador tiene los suyos.
function leerGuardado(nombre) {
  try {
    return localStorage.getItem("everglow_" + nombre);
  } catch (e) {
    return null;   // navegador en modo privado o con el guardado bloqueado
  }
}

function escribirGuardado(nombre, texto) {
  try {
    localStorage.setItem("everglow_" + nombre, texto);
  } catch (e) {
    console.log("Red: no se pudo guardar " + nombre + " en este navegador");
  }
}

// ---------- Usuario (login) ----------

function cargarUsuario() {
  let texto = leerGuardado("usuario.json");
  if (texto == null) return;
  let datos = parseJSONObject(texto);
  if (datos == null) return;
  nombreJugador = datos.getString("nombre", "");
  // Estilo de la hada (DisenoHada / ADN): si no hay, queda el de por defecto
  hadaCreada = datos.getBoolean("hadaCreada", false);   // DisenoHada: si es false, empieza con 0 puntos repartidos
  if (datos.hasKey("hada")) {
    let h = datos.getJSONObject("hada");
    familia.cuerpo   = constrain(h.getFloat("cuerpo", 0.5), 0, 1);
    familia.alas     = constrain(h.getFloat("alas", 0.5), 0, 1);
    familia.brillo   = constrain(h.getFloat("brillo", 0.5), 0, 1);
    familia.variedad = constrain(h.getFloat("variedad", 0.5), 0, 1);
    familia.ajustarAPresupuesto();   // ADN: nunca más de PUNTOS_CREACION puntos
  }
  // Volumen elegido en el panel SONIDO (Audio)
  if (datos.hasKey("sonido")) {
    let s = datos.getJSONObject("sonido");
    nivelEfectos = constrain(s.getInt("efectos", nivelEfectos), 0, 10);
  }
}

function guardarUsuario() {
  let datos = new JSONObject();
  datos.setString("nombre", nombreJugador);
  let h = new JSONObject();
  h.setFloat("cuerpo", familia.cuerpo);
  h.setFloat("alas", familia.alas);
  h.setFloat("brillo", familia.brillo);
  h.setFloat("variedad", familia.variedad);
  datos.setJSONObject("hada", h);
  datos.setBoolean("hadaCreada", hadaCreada);
  let s = new JSONObject();
  s.setInt("efectos", nivelEfectos);
  datos.setJSONObject("sonido", s);
  escribirGuardado("usuario.json", datos.toString());
}

// ---------- Al empezar una partida ----------

function reiniciarEstadoRed(clasificatoria) {
  partidaClasificatoria = clasificatoria;
  partidaTerminada = false;
  estadoEnvio = "";
  puestoObtenido = -1;
  recordPersonal = false;
  rondaUltimoEnvio = -1;
  cazadoresEnCamino.clear();
}

// ==================================================
// RANKING: un registro por jugador con su mejor puntaje
// ==================================================

// Al apagarse el bosque (lo llama la Simulacion)
function registrarFinDePartida() {
  if (!partidaClasificatoria) {
    estadoEnvio = "Bosque al azar: partida de práctica, no entra al ranking";
    return;
  }
  // El JSON que viaja a Firebase: solo datos
  let nuevo = new JSONObject();
  nuevo.setString("nombre", nombreJugador);
  nuevo.setInt("puntaje", puntaje());          // Simulacion
  nuevo.setFloat("tiempo", round(tiempoJuego * 10) / 10.0);
  nuevo.setInt("rondas", ronda);
  nuevo.setInt("recordHadas", recordHadas);
  nuevo.setString("opcion", letraOpcion());
  nuevo.setInt("semilla", semillaDelDia);
  nuevo.setString("fecha", year() + "-" + nf(month(), 2) + "-" + nf(day(), 2) + " " + nf(hour(), 2) + ":" + nf(minute(), 2) + ":" + nf(second(), 2));

  estadoEnvio = "Guardando puntaje...";
  enviarPuntajeEnSegundoPlano(nuevo);
}

// "async" = corre en segundo plano; "await" espera la respuesta sin congelar el juego
async function enviarPuntajeEnSegundoPlano(nuevo) {
  let clave = claveJugador(nuevo.getString("nombre", ""));
  try {
    if (!hayFirebase()) throw new Error("No hay URL de Firebase");
    let ruta = urlFirebase("ranking/" + semillaDelDia + "/" + letraOpcion() + "/" + clave);
    // 1) Leer el registro que ya tenga este jugador (o "null")
    let respuesta = await pedirHTTP("GET", ruta, null);
    let anterior = (respuesta == null || respuesta.trim().equals("null")) ? null : parseJSONObject(respuesta);
    // 2) Quedarse con el mejor y sumar la partida
    let guardar = combinarConAnterior(nuevo, anterior);
    await pedirHTTP("PUT", ruta, guardar.toString());
    await descargarRanking();
    estadoRanking = "en línea";
  } catch (e) {
    console.log("Red: no se pudo usar Firebase (" + e.message + "). Se guarda en este navegador.");
    guardarPuntajeLocal(nuevo);
    cargarRankingLocal();
    estadoRanking = hayFirebase() ? "sin conexión: ranking de este navegador" : "ranking de este navegador";
  }
  puestoObtenido = buscarPuesto(nuevo.getString("nombre", ""));
  let donde = hayFirebase() && estadoRanking.equals("en línea") ? "" : " (en este navegador)";
  if (recordPersonal) estadoEnvio = "¡Nuevo récord personal guardado" + donde + "!";
  else estadoEnvio = "Tu récord de hoy sigue siendo " + mejorPuntajeDe(nuevo.getString("nombre", "")) + " puntos" + donde;
}

// Devuelve lo que hay que guardar: el mejor de los dos puntajes, con las partidas sumadas
function combinarConAnterior(nuevo, anterior) {
  let partidas = (anterior == null) ? 1 : anterior.getInt("partidas", 1) + 1;
  let guardar;
  if (anterior == null || nuevo.getInt("puntaje", 0) > anterior.getInt("puntaje", 0)) {
    guardar = parseJSONObject(nuevo.toString());   // copia del nuevo
    recordPersonal = true;
  } else {
    guardar = anterior;                             // se mantiene el récord
    recordPersonal = false;
  }
  guardar.setInt("partidas", partidas);
  return guardar;
}

function pedirRanking() {
  estadoRanking = "Cargando ranking...";
  cargarRankingEnSegundoPlano();
}

async function cargarRankingEnSegundoPlano() {
  try {
    if (!hayFirebase()) throw new Error("No hay URL de Firebase");
    await descargarRanking();
    estadoRanking = "en línea";
  } catch (e) {
    cargarRankingLocal();
    estadoRanking = hayFirebase() ? "sin conexión: ranking de este navegador" : "ranking de este navegador";
  }
}

// GET a Firebase: devuelve un objeto { jugador: datos, jugador: datos, ... } o "null" si está vacío
async function descargarRanking() {
  let respuesta = await pedirHTTP("GET", rutaRanking(), null);
  let lista = [];
  if (respuesta != null && !respuesta.trim().equals("null")) {
    let todos = parseJSONObject(respuesta);
    if (todos != null) {
      for (const clave of todos.keys()) {
        let p = todos.getJSONObject(clave);
        if (p != null) lista.add(p);
      }
    }
  }
  rankingCompleto = ordenarPorPuntaje(lista);
}

// ---------- Respaldo local (sin Firebase o sin internet): misma regla, un registro por jugador ----------

function guardarPuntajeLocal(nuevo) {
  let todos = leerArchivoLocal();
  let clave = claveJugador(nuevo.getString("nombre", ""));
  let encontrado = -1;
  for (let i = 0; i < todos.size(); i++) {
    let p = todos.get(i);
    if (p.getInt("semilla", 0) == nuevo.getInt("semilla", 0) && p.getString("opcion", "").equals(nuevo.getString("opcion", ""))
        && claveJugador(p.getString("nombre", "")).equals(clave)) encontrado = i;
  }
  let anterior = (encontrado >= 0) ? todos.get(encontrado) : null;
  let guardar = combinarConAnterior(nuevo, anterior);
  if (encontrado >= 0) todos.set(encontrado, guardar);
  else todos.add(guardar);
  escribirGuardado("ranking_local.json", JSON.stringify(todos.map(p => p.datos)));
}

function cargarRankingLocal() {
  let todos = leerArchivoLocal();
  let lista = [];
  for (const p of todos) {
    // Solo los del bosque del día
    if (p.getInt("semilla", 0) == semillaDelDia && p.getString("opcion", "").equals(letraOpcion())) lista.add(p);
  }
  rankingCompleto = ordenarPorPuntaje(lista);
}

// Lista de JSONObject guardada en el navegador (vacía si no hay nada)
function leerArchivoLocal() {
  let texto = leerGuardado("ranking_local.json");
  if (texto == null) return [];
  try {
    let datos = JSON.parse(texto);
    return Array.isArray(datos) ? datos.map(d => new JSONObject(d)) : [];
  } catch (e) {
    return [];
  }
}

// ==================================================
// RIVALES EN LÍNEA Y ENVÍO DE CAZADORES
// ==================================================

// Se llama una vez en setup(): cada INTERVALO_RED segundos
// publica mi estado, descarga el de los demás y revisa si me mandaron cazadores.
function iniciarCicloDeRed() {
  if (cicloDeRedIniciado) return;
  cicloDeRedIniciado = true;
  cicloDeRed();
}

async function cicloDeRed() {
  try {
    let jugando = pantalla == PANTALLA_JUEGO && !finDelJuego() && !modoTutorial;
    if (hayFirebase() && jugando && !nombreJugador.equals("")) {
      await publicarMiEstado();
      await descargarRivales();
      await revisarCazadoresRecibidos();
    } else if (!jugando) {
      rivales = [];
    }
  } catch (e) {
    console.log("Red (rivales): " + e.message);
  }
  setTimeout(cicloDeRed, INTERVALO_RED * 1000);   // otra vuelta en unos segundos
}

async function publicarMiEstado() {
  let yo = new JSONObject();
  yo.setString("nombre", nombreJugador);
  yo.setInt("ronda", ronda);
  yo.setInt("hadas", hadasVivas());
  yo.setString("fase", fase == CALMA ? "calma" : "amenaza");
  yo.setString("opcion", letraOpcion());
  yo.setInt("semilla", semilla);
  yo.setLong("ultimaVez", Date.now());
  await pedirHTTP("PUT", urlFirebase("jugadores/" + claveJugador(nombreJugador)), yo.toString());
}

// Los demás jugadores que publicaron su estado hace menos de TIEMPO_EN_LINEA segundos
async function descargarRivales() {
  let respuesta = await pedirHTTP("GET", urlFirebase("jugadores"), null);
  let lista = [];
  if (respuesta != null && !respuesta.trim().equals("null")) {
    let todos = parseJSONObject(respuesta);
    let ahora = Date.now();
    let mia = claveJugador(nombreJugador);
    for (const clave of todos.keys()) {
      if (clave.equals(mia)) continue;
      let j = todos.getJSONObject(clave);
      if (j == null) continue;
      let edad = ahora - j.getLong("ultimaVez", 0);
      if (abs(edad) < TIEMPO_EN_LINEA * 1000 && j.getInt("hadas", 0) > 0) lista.add(j);
    }
  }
  rivales = lista;
}

// Lee envios/<yo>, pasa cada cazador a "recibidos" y lo borra de Firebase
async function revisarCazadoresRecibidos() {
  let mia = claveJugador(nombreJugador);
  let respuesta = await pedirHTTP("GET", urlFirebase("envios/" + mia), null);
  if (respuesta == null || respuesta.trim().equals("null")) return;
  let todos = parseJSONObject(respuesta);
  let ahora = Date.now();
  for (const id of todos.keys()) {
    let envio = todos.getJSONObject(id);
    await pedirHTTP("DELETE", urlFirebase("envios/" + mia + "/" + id), null);
    if (envio == null) continue;
    if (abs(ahora - envio.getLong("hora", 0)) > 10 * 60 * 1000) continue;   // envíos viejos (más de 10 min) se descartan
    recibidos.add(envio);
  }
}

// Desde Main.draw: avisa de los cazadores que llegaron
function procesarCazadoresRecibidos() {
  for (const envio of recibidos) {
    cazadoresEnCamino.add(envio);
    mostrarAviso("¡" + envio.getString("de", "Alguien") + " te envió un " + nombreCortoCazador(envio.getInt("cazador", VELOZ))
                 + "! Llega la próxima noche", 4500);
  }
  recibidos.clear();
}

// Lo llama la Simulacion al empezar cada amenaza: aparecen los cazadores enviados
function soltarCazadoresEnviados() {
  for (let i = cazadoresEnCamino.size() - 1; i >= 0; i--) {
    let envio = cazadoresEnCamino.get(i);
    let cz = aparecerCazador(envio.getInt("cazador", VELOZ), true);   // Simulacion: llega aunque haya tope
    if (cz != null) {
      cz.enviadoPor = envio.getString("de", "");
      cazadoresEnCamino.remove(i);
    }
  }
}

// ¿Puedo mandarle un cazador a alguien ahora? Devuelve "" si sí, o el motivo si no.
function motivoNoPuedoEnviar() {
  if (fase != CALMA) return "Solo se envían cazadores de día";
  if (rondaUltimoEnvio == ronda) return "Ya enviaste un cazador en esta ronda";
  if (luzArbol - COSTO_ENVIO_CAZADOR < LUZ_MINIMA_ARBOL) return "Falta luz: enviar cuesta " + int(COSTO_ENVIO_CAZADOR);
  return "";
}

// Al hacer clic en un ícono de cazador junto a un rival (Interfaz)
function enviarCazador(rival, tipo) {
  let motivo = motivoNoPuedoEnviar();
  if (!motivo.equals("")) {
    mostrarMensaje(motivo);
    return;
  }
  luzArbol -= COSTO_ENVIO_CAZADOR;
  rondaUltimoEnvio = ronda;
  let envio = new JSONObject();
  envio.setString("de", nombreJugador);
  envio.setString("para", rival.getString("nombre", ""));
  envio.setInt("cazador", tipo);
  envio.setLong("hora", Date.now());
  mostrarAviso("Enviando un " + nombreCortoCazador(tipo) + " a " + rival.getString("nombre", "") + "...", 2000);
  enviarCazadorEnSegundoPlano(envio);
}

async function enviarCazadorEnSegundoPlano(envio) {
  try {
    await pedirHTTP("POST", urlFirebase("envios/" + claveJugador(envio.getString("para", ""))), envio.toString());
    mostrarAviso("¡Le enviaste un " + nombreCortoCazador(envio.getInt("cazador", VELOZ)) + " a " + envio.getString("para", "") + "!", 3000);
  } catch (e) {
    luzArbol += COSTO_ENVIO_CAZADOR;   // no salió: se devuelve la luz
    rondaUltimoEnvio = -1;
    mostrarMensaje("No se pudo enviar (sin conexión)");
  }
}

function nombreCortoCazador(tipo) {
  if (tipo == VELOZ) return "Veloz";
  if (tipo == TRAMPERO) return "Trampero";
  return "Rastreador";
}

// ==================================================
// Ayudas
// ==================================================

// Ordena de mayor a menor puntaje (inserción: la lista es corta)
function ordenarPorPuntaje(lista) {
  let ordenada = [];
  for (const p of lista) {
    let i = 0;
    while (i < ordenada.size() && ordenada.get(i).getInt("puntaje", 0) >= p.getInt("puntaje", 0)) i++;
    ordenada.add(i, p);
  }
  return ordenada;
}

function buscarPuesto(nombre) {
  let lista = rankingCompleto;
  let clave = claveJugador(nombre);
  for (let i = 0; i < lista.size(); i++) {
    if (claveJugador(lista.get(i).getString("nombre", "")).equals(clave)) return i + 1;
  }
  return -1;
}

function mejorPuntajeDe(nombre) {
  let puesto = buscarPuesto(nombre);
  return puesto > 0 ? rankingCompleto.get(puesto - 1).getInt("puntaje", 0) : 0;
}

// Petición HTTP (GET, POST, PUT o DELETE) con fetch, que ya trae el navegador.
// Devuelve el texto de la respuesta; si falla, lanza un error (lo atrapa el try/catch de quien llama).
async function pedirHTTP(metodo, direccion, cuerpo) {
  let opciones = { method: metodo, signal: AbortSignal.timeout(6000) };
  if (cuerpo != null) {
    opciones.headers = { "Content-Type": "application/json; charset=utf-8" };
    opciones.body = cuerpo;
  }
  let respuesta = await fetch(direccion, opciones);
  let texto = await respuesta.text();
  if (!respuesta.ok) throw new Error("HTTP " + respuesta.status + ": " + texto);
  return texto;
}
