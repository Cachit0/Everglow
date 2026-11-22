// ==================================================
// GLOBALES: dimensiones, reglas y colores del juego
// ==================================================
// Todo lo que se quiera ajustar del mundo está aquí,
// así no hay que buscar números sueltos en otros módulos.

// ---------- Nombre del juego ----------
// Cambia el nombre AQUÍ y se actualiza en el login, el inicio y la ventana.
// Tip: en mayúsculas y de unas 20 letras como máximo (contando espacios) para que quepa.
const NOMBRE_JUEGO    = "EVERGLOW";
const SUBTITULO_JUEGO = "LUMORA: EL BOSQUE QUE SE APAGA";

// ---------- Retícula del mundo ----------
const COLUMNAS  = 120;   // celdas a lo ancho
const FILAS     = 70;    // celdas a lo alto
const TAM_CELDA = 16;    // tamaño de una celda en píxeles = tamaño de los sprites (16x16)
const CELDAS_POR_MODULO = 5;  // cada módulo agrupa 5x5 celdas (submódulos)

// ---------- Semilla (misma semilla = mismo bosque) ----------
let semilla = 2026;

// ---------- Tipos de celda ----------
const VACIO       = 0;
const FLOR        = 1;
const HONGO       = 2;
const NIEBLA      = 3;
const ARBOL_MADRE = 4;
const CAPULLO     = 5;
const FLOR_LUNA   = 6;
const FLOR_DESTRUIDA = 7;   // la destruyó el Trampero: no da luz ni se recarga; las hadas en "Cuidar" la hacen rebrotar   // solo en la opción B: abren de noche, dan el doble de luz y desaparecen al amanecer

// ---------- Reglas de generación ----------
const ESCALA_TERRENO = 0.06;  // tamaño de las manchas de bosque (más pequeño = manchas más grandes)
const ESCALA_NIEBLA  = 0.05;  // tamaño de las manchas de niebla
const UMBRAL_HONGO   = 0.66;  // terreno más denso que esto = hongos (muros naturales)
const UMBRAL_NIEBLA  = 0.64;  // niebla más densa que esto = celda de niebla
const ESCALA_FLORES  = 0.12;  // tamaño de los parches de flores
const UMBRAL_FLORES  = 0.62;  // solo hay flores donde el ruido de flores supera esto (parches)
const PROB_FLOR      = 0.30;  // dentro de un parche, probabilidad de que una celda tenga flor
const RADIO_CLARO    = 6;     // celdas libres alrededor del Árbol Madre
// Las flores crecen más lejos del árbol: cerca se recargan más rápido, así que ahí hay menos.
// La probabilidad de flor se multiplica por un factor que va de CERCA (al borde del claro)
// a LEJOS (desde RADIO_BONO_ARBOL celdas en adelante).
const FACTOR_FLORES_CERCA = 0.2;  // junto al claro: solo 1/5 de las flores normales
const FACTOR_FLORES_LEJOS = 1.1;  // lejos: un poco más que lo normal
const FLORES_CERCA_MIN = 8;    // como mínimo, estas flores cerca del árbol (para que el inicio no sea injusto)
const RADIO_FLORES_CERCA = 15; // qué tan cerca cuenta como "cerca" (en celdas)

// ---------- Cámara ----------
// El zoom mínimo se calcula solo (zoomMinimo() en Interfaz): es el que deja ver todo el mapa.
// Con zoom 1, 2, 3... los sprites se ven nítidos.
const ZOOM_MAX         = 6;     // acercamiento máximo
const VELOCIDAD_ZOOM   = 1.15;  // cuánto cambia el zoom por cada paso de la rueda
const SUAVIDAD_ZOOM    = 0.2;   // 0 a 1: más alto = zoom más rápido, más bajo = más suave
const VELOCIDAD_CAMARA = 12;    // píxeles de pantalla por frame al mover con el teclado

// ---------- Simulación: el ciclo de las hadas (paso 3) ----------
const DT                 = 1.0 / 60;  // segundos que avanza la simulación en cada frame
const HADAS_INICIALES    = 6;
const MAX_HADAS          = 60;    // tope para que la población no explote
const LUZ_MAX_HADA       = 100;   // barra de luz llena
const GASTO_LUZ_HADA     = 3;     // luz que gasta un hada por segundo (llena aguanta ~33 s sin comer)
const VELOCIDAD_HADA     = 48;    // píxeles del mundo por segundo (3 celdas por segundo)
const TASA_COMER         = 30;    // luz por segundo que pasa de la flor al hada
const COSTO_HADA         = 150;   // luz que necesita el Capullo para crear un hada nueva
const TIEMPO_CUERPO      = 4;     // segundos que se ve un hada apagada antes de desaparecer

const LUZ_MAX_FLOR       = 40;    // luz que tiene una flor llena
const FLOR_APAGADA       = 0.25;  // cuando baja de este % se apaga, y queda apagada hasta llenarse de nuevo

// Una flor apagada no vuelve a dar luz hasta recargarse COMPLETA.
// Así las hadas tienen que ir cada vez más lejos en vez de quedarse en una sola zona.
const TIEMPO_RECARGA_CERCA = 45;  // segundos que tarda en llenarse una flor vacía junto al Árbol Madre
const TIEMPO_RECARGA_LEJOS = 75;  // segundos que tarda una flor lejos del árbol
const RADIO_BONO_ARBOL     = 25;  // hasta cuántas celdas llega la ayuda del árbol


// ---------- Cazadores (paso 5) ----------
const VELOZ = 0, TRAMPERO = 1, RASTREADOR = 2;

const VELOCIDAD_VELOZ       = 58;   // más rápido que un hada (48): la alcanza si nada lo frena
const VELOCIDAD_TRAMPERO    = 40;
const VELOCIDAD_RASTREADOR  = 44;   // casi tan rápido como un hada (48): solo escapan las que huyen a tiempo
const FRENO_NIEBLA          = 0.4;  // dentro de la niebla, Veloz y Rastreador van al 40 % de su velocidad
const COSTO_NIEBLA_DIJKSTRA = 6;    // para Dijkstra cruzar niebla cuesta 6 veces más: por eso el Trampero la esquiva

const REPLANEAR_VELOZ       = 2.5;  // el Veloz calcula su ruta y va directo; la corrige cada 2.5 s
const PAUSA_VELOZ           = 1.5;  // segundos que el Veloz queda "confundido" si un hongo le corta el camino
const CANSANCIO_RASTREADOR  = 10;   // segundos que el Rastreador persigue a la misma hada antes de rendirse
const REPLANEAR_RASTREADOR  = 0.5;  // el Rastreador recalcula muy seguido: por eso siempre encuentra al hada
const RADIO_ATRAPAR         = 0.7;  // en celdas: a esta distancia el cazador alcanza al hada
const GOLPE_VELOZ           = 50;   // el Veloz no apaga de una vez: le quita esta luz (las que guardan más, aguantan)
const PAUSA_GOLPE           = 2;    // segundos que el Veloz se queda quieto después de golpear
const TIEMPO_DESTRUIR_FLOR  = 4;    // segundos que tarda el Trampero en destruir una flor llena
const RADIO_TRAMPA          = 1;    // al destruirla, también destruye las flores vecinas (parche de 3x3)

const MAX_CAZADORES         = 15;   // tope de cazadores del bosque (los que envía otro jugador llegan aunque se haya llegado al tope)
const REGION_ENCERRADO      = 40;   // si un cazador alcanza menos celdas que esto, quedó encerrado (atrapado, sin moverse)
const BUSQUEDA_HUIDA        = 18;   // pasos máximos que BFS busca un lugar seguro cuando un hada huye

// ---------- Prioridades de las hadas: sliders (paso 6) ----------
// El jugador reparte un presupuesto de puntos entre las prioridades.
// Subir una baja las otras: la suma siempre es PRESUPUESTO_PRIORIDADES.
const PRESUPUESTO_PRIORIDADES = 10;

// ---------- Creación de la hada (DisenoHada / ADN) ----------
// El jugador reparte 20 puntos entre Cuerpo, Alas, Brillo y Variedad (de 0 a 10 cada uno).
// Con 5 en todo, el hada es igual a la original. No se puede subir todo a la vez.
const PUNTOS_CREACION  = 20;
const MAX_PUNTOS_RASGO = 10;
let puntosAlimentarse  = 4;   // lo cambia el slider "Alimentarse"
let puntosCuidar       = 1;   // lo cambia el slider "Cuidar"
let puntosReproducirse = 1;   // lo cambia el slider "Reproducirse"
let puntosHuir         = 4;   // lo cambia el slider "Huir"

// ALIMENTARSE: cuánta luz se guarda cada hada para ella al entregar.
//   Alto = hadas con más reserva (aguantan el hambre) pero brillan más y llevan menos luz al Árbol.
const RESERVA_MIN = 25, RESERVA_MAX = 85;
// HUIR: a qué distancia de un cazador empieza a huir (en celdas).
//   Alto = huyen temprano (más seguras) pero dejan de comer más seguido.
const PELIGRO_MIN = 1.5, PELIGRO_MAX = 9;
const MARGEN_SEGURO = 5;   // huyen hasta quedar a (distancia de peligro + 5) celdas
// CUIDAR: probabilidad de que un hada, después de entregar su luz, vaya a cuidar una flor
//   (hacer rebrotar una destruida o recargar una apagada) en vez de ir a comer.
//   Alto = el bosque se recupera rápido, pero las hadas comen menos.
const CUIDAR_MAX       = 0.9;   // con 10 puntos, el 90 % de las veces
const TIEMPO_REBROTE   = 8;     // segundos de cuidado para que una flor destruida vuelva a crecer
const TIEMPO_CUIDAR_RECARGA = 12; // con un hada cuidándola, una flor apagada se llena en 12 s
const RADIO_CUIDAR     = 30;    // busca flores para cuidar hasta esta distancia (celdas)
const TIEMPO_MAX_CUIDANDO = 12; // después de esto vuelve a comer aunque no haya terminado
// REPRODUCIRSE: parte de las hadas que lleva su sobrante al Capullo (hadas nuevas)
//   en vez de al Árbol (luz para defensas). Con 10 puntos, todas van al Capullo.

// ---------- Día y noche (paso 6) ----------
// La partida alterna DÍA (calma: recoger luz y preparar defensas) y NOCHE
// (amenaza: llegan los cazadores). La dificultad sube cada ronda, como en un tower defense:
//   - cada noche dura más y trae más cazadores, en tandas cada vez más grandes;
//   - los cazadores de cada noche son un poco más rápidos;
//   - los días se acortan: hay menos tiempo para prepararse.
const DIA_BASE      = 45;   // el primer día dura 45 s...
const DIA_MENOS     = 3;    // ...cada día es 3 s más corto...
const DIA_MINIMO    = 25;   // ...hasta un mínimo de 25 s
const NOCHE_BASE    = 35;   // la primera noche dura 35 s...
const NOCHE_MAS     = 6;    // ...cada noche es 6 s más larga...
const NOCHE_MAXIMA  = 90;   // ...hasta un máximo de 90 s
const CAZADORES_NOCHE_BASE = 2;     // la primera noche llegan 2 cazadores...
const CAZADORES_NOCHE_MAS  = 2;     // ...y cada noche 2 más (2, 4, 6, 8...)
const PARTE_NOCHE_CON_TANDAS = 0.7; // las tandas llegan durante el primer 70 % de la noche
const VELOCIDAD_POR_NOCHE  = 0.04;  // los cazadores son un 4 % más rápidos cada noche...
const VELOCIDAD_EXTRA_MAX  = 0.40;  // ...hasta un 40 % más

const PROB_TRAMPERO = 0.25;  // desde la noche 3: 25 % Trampero; el resto, mitad Veloz y mitad Rastreador
const RECARGA_NOCHE = 0.4;   // de noche las flores se recargan al 40 %

// ---------- Tipos de noche (paso 7): cada uno pide otras prioridades ----------
// Se anuncia durante el día. Noche 1: Rastreadores, 2: Veloces, 3: Tramperos;
// desde la 4 al azar (sin repetir la anterior) y desde la 5 puede ser mixta.
const NOCHE_RASTREADORES = 0, NOCHE_VELOCES = 1, NOCHE_TRAMPEROS = 2, NOCHE_MIXTA = 3;
const PROB_NOCHE_MIXTA = 0.35;

// ---------- Visión de los cazadores ----------
// Un cazador solo ve a las hadas que brillan lo suficiente para su distancia:
// ve a (brillo x VISION_POR_BRILLO) celdas. Un hada llena (100) se ve a 28 celdas;
// una con 30 de luz, a 8. Por eso guardar mucha luz (Alimentarse) las delata.
const VISION_POR_BRILLO = 0.28;
const VISION_PERDER     = 1.25;  // el Veloz suelta a su presa si se aleja más de 1,25 veces lo que la ve
// Si no ven a nadie, marchan hacia el Árbol Madre (como en un tower defense)

// ---------- El Árbol Madre es la base ----------
// Los cazadores que lo alcanzan le roban luz y las hadas hambrientas se alimentan de él.
// Si se queda sin luz NO se pierde (solo se pierde sin hadas), pero ya no puede
// pagar hongos ni faroles ni alimentar a las hadas.
const ROBO_CAZADOR     = 15;    // luz que roba un cazador al llegar al Árbol (y luego desaparece)
const RADIO_ROBO       = 2.5;   // a cuántas celdas del centro del Árbol cuenta como "llegó"
const LUZ_MINIMA_ARBOL = 0;     // luz que hongos, faroles y envíos deben dejarle al Árbol (0 = se puede gastar toda)
const ARBOL_BAJO       = 40;    // por debajo de esto aparece el aviso "Árbol bajo"
// Un hada con poca luz que no encuentra flores vuelve al Árbol y toma luz de él (refugio)
const HAMBRE_REFUGIO   = 0.35;  // va al refugio con menos del 35 % de su luz...
const SALE_DEL_REFUGIO = 0.6;   // ...y sale cuando llega al 60 %

// ---------- Costos de cada prioridad cuando no toca ----------
// HUIR alto = hadas miedosas: solo buscan flores cerca del Árbol
const RADIO_BUSQUEDA_MAX = 60;  // con Huir en 0 (celdas desde el Árbol)
const RADIO_BUSQUEDA_MIN = 26;  // con Huir en 10
// REPRODUCIRSE de noche: el Capullo necesita el calor del día
const NACER_DE_NOCHE = 1.5;     // de noche, nacer cuesta un 50 % más

const FLORES_LUNA_BASE      = 6;   // flores de luna la primera noche
const FLORES_LUNA_POR_RONDA = 2;   // y 2 más cada noche
const LUZ_FLOR_LUNA   = 80;   // el doble que una flor normal; no se recargan: se apagan al amanecer

// ---------- Faroles ----------
const COSTO_FAROL    = 30;   // luz del Árbol
const DURACION_FAROL = 12;   // segundos que dura encendido
const BRILLO_FAROL   = 150;  // un hada llena brilla 100: los cazadores prefieren el farol

// ---------- Red: Firebase (multijugador) ----------
// Pega aquí la URL de su Realtime Database, por ejemplo:
//   "https://luz-de-hadas-default-rtdb.firebaseio.com"
// Si se deja vacía, el ranking se guarda solo en este computador (ranking_local.json).
let FIREBASE_URL = "https://everglow-d662b-default-rtdb.firebaseio.com/";

// Rivales en línea
const COSTO_ENVIO_CAZADOR = 60;  // luz del Árbol que cuesta mandarle un cazador a un rival
const INTERVALO_RED       = 4;   // cada cuántos segundos se publica el estado y se buscan rivales
const TIEMPO_EN_LINEA     = 15;  // un rival cuenta como "en línea" si publicó hace menos de esto (segundos)

// Puntaje = segundos sobrevividos + PUNTOS_POR_HADA x récord de hadas vivas a la vez
const PUNTOS_POR_HADA = 10;

// ---------- Paleta (5 colores + rojo + blanco y negro) ----------
let COLOR_FONDO;
let COLOR_INTERFAZ;
let COLOR_HADA;  // magenta
let COLOR_LUZ;  // cian
let COLOR_FLOR;  // verde lima
let COLOR_ARBOL;  // amarillo luz
let COLOR_SOMBRA;  // morado profundo
let COLOR_CAZADOR;  // rojo
let COLOR_SUELO;  // suelo del bosque (casi negro)

// p5.js solo deja usar color() después de que arranca (en setup),
// por eso los colores se crean aquí y Main llama a iniciarColores() en setup().
function iniciarColores() {
  COLOR_FONDO    = color('#000000');
  COLOR_INTERFAZ = color('#FFFFFF');
  COLOR_HADA     = color('#E22AF5');
  COLOR_LUZ      = color('#7CCDDE');
  COLOR_FLOR     = color('#BCFD18');
  COLOR_ARBOL    = color('#FCF49E');
  COLOR_SOMBRA   = color('#4E0E77');
  COLOR_CAZADOR  = color('#E00000');
  COLOR_SUELO    = color('#07020D');
}

// ---------- Opciones de vista ----------
let mostrarReticula = true;   // tecla G
let mostrarRutas    = false;  // tecla V: dibuja el camino que calculó A* para cada hada
let fuente;

// Panel de estado (arriba a la izquierda). Los clics sobre él no ponen hongos.
const PANEL_X = 10, PANEL_Y = 10, PANEL_ANCHO = 440, PANEL_ALTO = 112;
const ALTO_PANEL_ALGORITMOS = 92;                 // panel extra que aparece con [V]
const ANCHO_PANEL_FASE = 310, ALTO_PANEL_FASE = 96; // recuadro de la fase (arriba a la derecha)

// ---------- Obstáculos (paso 4) ----------
const COSTO_HONGO       = 10;   // luz del Árbol que cuesta poner un hongo (pon 0 para probar gratis)
const DURACION_HONGO    = 10;   // segundos que dura un hongo puesto por el jugador (los del bosque son permanentes)

// ---------- Comprar capullos y flores (las opciones más caras) ----------
const COSTO_CAPULLO     = 80;   // un capullo más: otro nido donde nacen hadas
const MAX_CAPULLOS      = 5;    // contando el original
const CALOR_CAPULLO     = 0.3;  // luz por segundo que cada capullo junta solo
const COSTO_FLOR        = 100;  // la más cara: planta una flor llena de luz
const LUZ_INICIAL_ARBOL = 100;  // luz con la que empieza el Árbol, para poder poner hongos desde el inicio
const COSTO_DIAGONAL    = 1.41421356;  // moverse en diagonal cuesta √2
