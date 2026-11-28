// ==================================================
// RENDERIZADO: retícula, componentes, etiquetas y estado
// ==================================================
// Aquí solo se dibuja: se LEEN los datos del Modelo y la Simulación,
// nunca se cambian.
//
// Sprites: van en la carpeta "data" dentro de Main (16x16 px).
// Si falta alguno, ese componente se dibuja con triángulos como antes,
// así pueden ir agregando sprites de a uno.

let sprHada, sprHadaBrillo, sprHadaApagada;
let sprFlor, sprFlorApagada, sprHongo, sprNiebla;
let sprArbol, sprCapullo;
let sprVeloz, sprTrampero, sprRastreador, sprFarol;
let sprFlorLuna, sprSol, sprLuna, sprSemilla;
let oscuridad = 0;   // 0 = día, se acerca poco a poco al valor de la noche

function cargarSprites() {
  sprHada        = cargarSprite("hada.png");
  sprHadaBrillo  = cargarSprite("hada_brillo.png");
  sprHadaApagada = cargarSprite("hada_apagada.png");
  sprFlor        = cargarSprite("flor.png");
  sprFlorApagada = cargarSprite("flor_apagada.png");
  sprHongo       = cargarSprite("hongo.png");
  sprNiebla      = cargarSprite("niebla.png");
  sprArbol       = cargarSprite("arbol_madre.png");
  sprCapullo     = cargarSprite("capullo.png");
  sprVeloz       = cargarSprite("cazador_veloz_Astar.png");
  sprTrampero    = cargarSprite("cazador_trampero_Dijkstra.png");
  sprRastreador  = cargarSprite("cazador_rastreador_BFS.png");
  sprFarol       = cargarSprite("farol.png");
  sprFlorLuna    = cargarSprite("flor_luna.png");
  sprSol         = cargarSprite("sol.png");
  sprLuna        = cargarSprite("luna.png");
  sprSemilla     = cargarSprite("semilla.png");   // flor destruida: queda el brote
}

// Se llama desde preload() en Main: p5 espera a que estén todas antes de setup().
// loadImage devuelve la imagen enseguida y p5 la llena cuando termina de descargarla.
function cargarSprite(archivo) {
  return loadImage("data/" + archivo, () => {},
    () => console.log("Falta el sprite " + archivo + " en la carpeta data."));
}

// Círculo del color pedido que se desvanece hacia los bordes.
// (En Processing se pintaba uno blanco con tint(); en el navegador tint() es lento,
// así que se crea uno por color y se guarda para reutilizarlo.)
function crearImagenBrillo(lado, c = COLOR_INTERFAZ) {
  let img = createImage(lado, lado);
  img.loadPixels();
  let r = red(c), g = green(c), b = blue(c);
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      let d = dist(px, py, lado / 2.0, lado / 2.0) / (lado / 2.0);
      let a = pow(max(0, 1 - d), 2) * 255;
      let i = (py * lado + px) * 4;   // cada pixel ocupa 4 casillas: rojo, verde, azul, transparencia
      img.pixels[i]     = r;
      img.pixels[i + 1] = g;
      img.pixels[i + 2] = b;
      img.pixels[i + 3] = a;
    }
  }
  img.updatePixels();
  return img;
}

let brillosPorColor = new Map();

function brilloDeColor(c) {
  let clave = red(c) * 65536 + green(c) * 256 + blue(c);
  let img = brillosPorColor.get(clave);
  if (img == null) {
    if (brillosPorColor.size > 400) brillosPorColor.clear();   // no guardar demasiados
    img = crearImagenBrillo(64, c);
    brillosPorColor.set(clave, img);
  }
  return img;
}

// ==================================================
// El mundo
// ==================================================
// Se dibuja en coordenadas del MUNDO: Main aplica la cámara antes de llamar esto.
// Solo se dibujan las celdas que la cámara está viendo.
function dibujarMundo() {
  noStroke();
  for (let c = primeraColumnaVisible(); c <= ultimaColumnaVisible(); c++) {
    for (let f = primeraFilaVisible(); f <= ultimaFilaVisible(); f++) {
      let x = c * TAM_CELDA;
      let y = f * TAM_CELDA;

      // 1) El suelo, sombreado según la densidad del bosque
      fill(colorSuelo(c, f));
      rect(x, y, TAM_CELDA, TAM_CELDA);

      // 2) Lo que haya encima
      switch (mundo[c][f]) {
        case FLOR:   dibujarFlor(x, y, florConLuz(c, f)); break;
        case FLOR_LUNA: dibujarFlorLuna(x, y); break;
        case FLOR_DESTRUIDA: dibujarFlorDestruida(x, y, progresoRebrote[c][f]); break;
        case HONGO:
          // Hongo del jugador: parpadea en sus últimos 3 segundos
          if (vidaHongo[c][f] > 0 && vidaHongo[c][f] < 3 && parpadeo(6)) tint(255, 90);
          dibujarHongo(x, y);
          noTint();
          break;
        case NIEBLA: dibujarNiebla(x, y); break;
      }
    }
  }

  dibujarArbolMadre();
  for (const cap of capullos) dibujarCapullo(cap);
  if (mostrarReticula) dibujarReticula();
}

// Más denso = más morado. Así el bosque se lee como manchas, estilo WorldBox.
function colorSuelo(c, f) {
  return lerpColor(COLOR_SUELO, COLOR_SOMBRA, terreno[c][f] * 0.55);
}

// --------------------------------------------------
// Triángulo base (dibujo de respaldo cuando falta un sprite):
// cada celda se parte con sus dos diagonales en 4 triángulos
// (0 arriba, 1 derecha, 2 abajo, 3 izquierda).
// --------------------------------------------------
function trianguloCelda(x, y, lado, cual) {
  let cx = x + lado / 2;
  let cy = y + lado / 2;
  switch (cual) {
    case 0: triangle(x, y, x + lado, y, cx, cy);               break; // arriba
    case 1: triangle(x + lado, y, x + lado, y + lado, cx, cy); break; // derecha
    case 2: triangle(x, y + lado, x + lado, y + lado, cx, cy); break; // abajo
    case 3: triangle(x, y, x, y + lado, cx, cy);               break; // izquierda
  }
}

// ---------- Componentes del mapa ----------

function dibujarFlor(x, y, conLuz) {
  let spr = conLuz ? sprFlor : sprFlorApagada;
  if (spr != null) {
    image(spr, x, y, TAM_CELDA, TAM_CELDA);
    return;
  }
  for (let i = 0; i < 4; i++) {
    if (conLuz) fill(i % 2 == 0 ? COLOR_FLOR : COLOR_ARBOL);
    else        fill(i % 2 == 0 ? color('#8A8A8A') : color('#464646'));
    trianguloCelda(x, y, TAM_CELDA, i);
  }
}

// Flor destruida por el Trampero: el brote, y una barrita si las hadas la están haciendo rebrotar
function dibujarFlorDestruida(x, y, progreso) {
  if (sprSemilla != null) image(sprSemilla, x, y, TAM_CELDA, TAM_CELDA);
  else {
    fill(color('#78502A'));
    rect(x + 2, y + TAM_CELDA - 5, TAM_CELDA - 4, 4);
    fill(COLOR_FLOR);
    rect(x + TAM_CELDA / 2 - 1, y + 5, 2, TAM_CELDA - 10);
  }
  if (progreso > 0) {
    fill(0, 160);
    rect(x, y + TAM_CELDA - 2, TAM_CELDA, 2);
    fill(COLOR_FLOR);
    rect(x, y + TAM_CELDA - 2, TAM_CELDA * progreso, 2);
  }
}

function dibujarFlorLuna(x, y) {
  if (sprFlorLuna != null) {
    image(sprFlorLuna, x, y, TAM_CELDA, TAM_CELDA);
    return;
  }
  fill(COLOR_LUZ);
  for (let i = 0; i < 4; i++) trianguloCelda(x, y, TAM_CELDA, i);
}

// ==================================================
// Noche (paso 6)
// ==================================================
// Un velo azul oscuro sobre el mundo. Lo que brilla (hadas, faroles,
// flores de luna) se dibuja DESPUÉS, así resalta en la oscuridad.
function dibujarNoche() {
  let objetivo = 0;
  if (esDeNoche()) objetivo = 165;
  oscuridad = lerp(oscuridad, objetivo, 0.03);   // anochece y amanece de a poco
  if (oscuridad < 1) return;

  noStroke();
  fill(color('#05031A'), oscuridad);
  rect(camX, camY, width / zoom, height / zoom);

  // El Árbol Madre (y su Capullo) brillan por encima de la oscuridad, como las hadas
  dibujarArbolDeNoche(oscuridad / 165.0);

  // Las flores de luna brillan por encima de la oscuridad
  for (let c = primeraColumnaVisible(); c <= ultimaColumnaVisible(); c++) {
    for (let f = primeraFilaVisible(); f <= ultimaFilaVisible(); f++) {
      if (mundo[c][f] != FLOR_LUNA) continue;
      let pulso = 1 + 0.15 * sin(frameCount * 0.07 + c + f);
      dibujarBrillo(centroX(c), centroY(f), TAM_CELDA * 4 * pulso, COLOR_LUZ, 170);
      dibujarFlorLuna(c * TAM_CELDA, f * TAM_CELDA);
    }
  }
}

function dibujarHongo(x, y) {
  if (sprHongo != null) {
    image(sprHongo, x, y, TAM_CELDA, TAM_CELDA);
    return;
  }
  fill(COLOR_SOMBRA);
  rect(x, y, TAM_CELDA, TAM_CELDA);
  fill(lerpColor(COLOR_SOMBRA, COLOR_HADA, 0.35));
  trianguloCelda(x, y, TAM_CELDA, 0);
}

// Niebla: velo blanco al 20 % y, si hay sprite, la nube encima semitransparente
function dibujarNiebla(x, y) {
  fill(COLOR_INTERFAZ, 40);
  rect(x, y, TAM_CELDA, TAM_CELDA);
  if (sprNiebla != null) {
    tint(255, 140);
    image(sprNiebla, x, y, TAM_CELDA, TAM_CELDA);
    noTint();
  }
}

// Árbol Madre: ocupa 3x3 celdas, así que el sprite se dibuja 3 veces más grande
function dibujarArbolMadre() {
  let x = (arbolCol - 1) * TAM_CELDA;
  let y = (arbolFila - 1) * TAM_CELDA;
  let lado = TAM_CELDA * 3;
  // El brillo crece con la luz guardada
  let extra = constrain(luzArbol / 1000, 0, 1);
  dibujarBrillo(x + lado / 2, y + lado / 2, lado * (2.5 + 2 * extra), COLOR_ARBOL, 150);

  if (sprArbol != null) {
    image(sprArbol, x, y, lado, lado);
  } else {
    for (let dc = 0; dc < 3; dc++)
      for (let df = 0; df < 3; df++)
        for (let i = 0; i < 4; i++) {
          fill((i + dc + df) % 2 == 0 ? COLOR_ARBOL : lerpColor(COLOR_ARBOL, COLOR_FLOR, 0.5));
          trianguloCelda(x + dc * TAM_CELDA, y + df * TAM_CELDA, TAM_CELDA, i);
        }
  }
}

// Capullo: palpita, y su brillo crece a medida que junta luz para la próxima hada
function dibujarCapullo(cap) {
  let x = cap.c * TAM_CELDA;
  let y = cap.f * TAM_CELDA;
  let carga = cap.carga();
  let pulso = 1 + 0.2 * sin(frameCount * (0.05 + 0.15 * carga));
  dibujarBrillo(x + TAM_CELDA / 2, y + TAM_CELDA / 2, TAM_CELDA * (2 + 3 * carga) * pulso, COLOR_HADA, 160);

  if (sprCapullo != null) {
    image(sprCapullo, x, y, TAM_CELDA, TAM_CELDA);
  } else {
    fill(COLOR_LUZ);
    for (let i = 0; i < 4; i++) trianguloCelda(x, y, TAM_CELDA, i);
  }
}

// De noche: el Árbol se dibuja encima del velo oscuro, con un halo que respira
// y motas de luz que suben de su copa. "k" va de 0 (día) a 1 (noche cerrada),
// así el brillo aparece de a poco al anochecer y se va al amanecer.
function dibujarArbolDeNoche(k) {
  k = constrain(k, 0, 1);
  let x = (arbolCol - 1) * TAM_CELDA;
  let y = (arbolFila - 1) * TAM_CELDA;
  let lado = TAM_CELDA * 3;
  let cx = x + lado / 2, cy = y + lado / 2;
  let extra = constrain(luzArbol / 1000, 0, 1);       // más luz guardada, más brillo
  let respira = 1 + 0.08 * sin(frameCount * 0.03);    // pulso lento

  // Halo grande y suave, y un núcleo más intenso
  dibujarBrillo(cx, cy, lado * (4.5 + 2.5 * extra) * respira, COLOR_ARBOL, 120 * k);
  dibujarBrillo(cx, cy, lado * 2.2 * respira, lerpColor(COLOR_ARBOL, COLOR_INTERFAZ, 0.3), 170 * k);

  // El sprite, iluminado (no oscurecido por la noche)
  if (sprArbol != null) {
    tint(255, 255 * k);
    image(sprArbol, x, y, lado, lado);
    noTint();
  }

  // Motas de luz que suben desde la copa y se desvanecen
  noStroke();
  for (let i = 0; i < 10; i++) {
    let t = (frameCount * 0.004 + i / 10.0) % 1;             // 0 = nace, 1 = se apaga
    let mx = cx + sin(i * 2.3 + t * 6) * lado * 0.55;
    let my = cy - lado * 0.2 - t * lado * 1.6;
    let alfa = (1 - t) * 230 * k;
    dibujarBrillo(mx, my, 10, COLOR_ARBOL, alfa * 0.6);
    fill(COLOR_ARBOL, alfa);
    rect(round(mx) - 1, round(my) - 1, 2, 2);                  // un pixel de luz
  }

  // Los Capullos también se ven en la oscuridad
  for (const cap of capullos) {
    let px = cap.c * TAM_CELDA, py = cap.f * TAM_CELDA;
    let carga = cap.carga();
    let pulso = 1 + 0.2 * sin(frameCount * (0.05 + 0.15 * carga));
    dibujarBrillo(px + TAM_CELDA / 2, py + TAM_CELDA / 2, TAM_CELDA * (2 + 3 * carga) * pulso, COLOR_HADA, 150 * k);
    if (sprCapullo != null) {
      tint(255, 255 * k);
      image(sprCapullo, px, py, TAM_CELDA, TAM_CELDA);
      noTint();
    }
  }
}

// Brillo: el degradado circular pintado del color pedido
function dibujarBrillo(x, y, diametro, c, opacidad) {
  imageMode(CENTER);
  tint(255, opacidad);   // Compat: solo transparencia (rápido)
  image(brilloDeColor(c), x, y, diametro, diametro);
  noTint();
  imageMode(CORNER);
}

// ==================================================
// Las hadas
// ==================================================
// El brillo es una mecánica: cuanta más luz carga, más grande y fuerte es su brillo
// (en el paso 5 los cazadores van a perseguir la luz más fuerte).
function dibujarHadas() {
  for (const h of hadas) {
    let g = h.adn;   // cada hada se dibuja con su propio sprite (ADN.pde)
    let p = h.porcentajeLuz();
    // Aletea según sus alas: las cortas rápido y poco, las largas lento y amplio
    let aleteo = (h.estado == MUERTA) ? 0 : sin(frameCount * g.frecAleteo + h.fase) * g.amplitudAleteo;
    let x = h.x - LADO_SPRITE / 2;
    let y = h.y - LADO_SPRITE / 2 + aleteo;

    if (h.estado == MUERTA) {
      // Se desvanece de a poco
      let alfa = 255 * (1 - h.tiempoMuerta / TIEMPO_CUERPO);
      tint(255, alfa);
      image(g.sprApagada, x, y, LADO_SPRITE, LADO_SPRITE);
      noTint();
      continue;
    }

    dibujarBrillo(h.x, h.y + aleteo, TAM_CELDA * (1 + 3 * p) * g.escalaBrillo, g.colorBrillo, 60 + 150 * p);

    let spr = (p > 0.7) ? g.sprBrillo : g.sprNormal;
    // Con poca luz el hada parpadea, como una luz que se está apagando
    let parpadeo = p < 0.2 && floor(frameCount / 6) % 2 == 0;
    if (parpadeo) tint(255, 110);
    image(spr, x, y, LADO_SPRITE, LADO_SPRITE);
    noTint();
  }
}

// ==================================================
// Faroles y cazadores (paso 5)
// ==================================================
function dibujarFaroles() {
  for (const fa of faroles) {
    let x = fa.c * TAM_CELDA;
    let y = fa.f * TAM_CELDA;
    // En los últimos 3 segundos parpadea: se está apagando
    let parpadeo = fa.restante < 3 && floor(frameCount / 5) % 2 == 0;
    dibujarBrillo(x + TAM_CELDA / 2, y + TAM_CELDA / 2, TAM_CELDA * 7, COLOR_ARBOL, parpadeo ? 60 : 170);
    if (sprFarol != null) {
      image(sprFarol, x, y, TAM_CELDA, TAM_CELDA);
    } else {
      fill(COLOR_ARBOL);
      rect(x + 4, y + 2, TAM_CELDA - 8, TAM_CELDA - 4);
    }
  }
}

function dibujarCazadores() {
  for (const cz of cazadores) {
    let alfa = 255 * constrain(cz.alfa, 0, 1);
    // Encerrado: tiembla, atrapado entre los hongos
    let temblor = cz.encerrado ? random(-2, 2) : 0;
    let x = cz.x - TAM_CELDA / 2 + temblor;
    let y = cz.y - TAM_CELDA / 2;

    dibujarBrillo(cz.x, cz.y, TAM_CELDA * 2.5, COLOR_CAZADOR, 90 * cz.alfa);
    let spr = (cz.tipo == VELOZ) ? sprVeloz : (cz.tipo == TRAMPERO) ? sprTrampero : sprRastreador;
    if (spr != null) {
      tint(255, alfa);
      image(spr, x, y, TAM_CELDA, TAM_CELDA);
      noTint();
    } else {
      fill(COLOR_CAZADOR, alfa);
      triangle(cz.x, cz.y - 7, cz.x - 7, cz.y + 6, cz.x + 7, cz.y + 6);
    }

    // Un "?" encima cuando el Veloz está confundido o cuando quedó encerrado
    if (cz.confundido() || cz.encerrado) {
      textoPixel("?", cz.x, y - 10, 8, color(255, alfa), CENTER);
    } else if (cz.ladron) {
      // Va por la luz del Árbol: se marca en rojo para que el Guardián lo vea venir (también de noche)
      textoPixel("LADRON", cz.x, y - 10, 8, color(COLOR_CAZADOR, alfa), CENTER);
    } else if (!cz.enviadoPor.equals("")) {
      // Lo mandó otro jugador: su nombre encima
      textoPixel(cz.enviadoPor.toUpperCase(), cz.x, y - 10, 8, color(COLOR_CAZADOR, alfa), CENTER);
    }
  }
}

// ==================================================
// Rutas y cursor (pasos 4 y 5)
// ==================================================
// Tecla V: dibuja el camino que le falta recorrer a cada hada (cian) y a cada cazador (rojo).
function dibujarRutas() {
  if (!mostrarRutas) return;
  noFill();
  strokeWeight(1.5 / zoom);
  for (const cz of cazadores) {
    if (!cz.activo() || cz.ruta == null) continue;
    stroke(COLOR_CAZADOR, 140);
    beginShape();
    vertex(cz.x, cz.y);
    for (let i = cz.paso; i < cz.ruta.size(); i++) vertex(cz.ruta.get(i).x, cz.ruta.get(i).y);
    endShape();
  }
  for (const h of hadas) {
    if (h.estado == MUERTA || h.ruta == null) continue;
    stroke(COLOR_LUZ, 110);
    beginShape();
    vertex(h.x, h.y);
    for (let i = h.paso; i < h.ruta.size(); i++) vertex(h.ruta.get(i).x, h.ruta.get(i).y);
    endShape();
    // marca la celda destino
    stroke(COLOR_LUZ, 200);
    rect(h.rutaC * TAM_CELDA, h.rutaF * TAM_CELDA, TAM_CELDA, TAM_CELDA);
  }
  noStroke();
}

// Recuadro en la celda bajo el mouse: blanco si se puede usar la herramienta ahí, rojo si no
function dibujarCursor() {
  if (sobreInterfaz()) return;
  let c = columnaBajoMouse();
  let f = filaBajoMouse();
  if (!dentroDelMundo(c, f)) return;
  let tipo = mundo[c][f];
  let lugarValido = tipo != ARBOL_MADRE && tipo != CAPULLO;
  let sePuede;
  if (herramienta == HERRAMIENTA_FAROL)        sePuede = lugarValido && tipo != HONGO && luzArbol >= COSTO_FAROL;
  else if (herramienta == HERRAMIENTA_CAPULLO) sePuede = tipo == VACIO && capullos.size() < MAX_CAPULLOS && luzArbol >= COSTO_CAPULLO;
  else if (herramienta == HERRAMIENTA_FLOR)  sePuede = puedePlantar(c, f) && luzArbol >= COSTO_FLOR;
  else                                         sePuede = tipo == HONGO || (lugarValido && luzArbol >= COSTO_HONGO);
  noFill();
  strokeWeight(2 / zoom);
  stroke(sePuede ? COLOR_INTERFAZ : COLOR_CAZADOR);
  rect(c * TAM_CELDA, f * TAM_CELDA, TAM_CELDA, TAM_CELDA);
  noStroke();
}

// ---------- Retícula ----------
// Con zoom, strokeWeight también se agranda; por eso se divide entre el zoom
// para que las líneas sigan midiendo 1 px en pantalla.
function dibujarReticula() {
  let c0 = primeraColumnaVisible(), c1 = ultimaColumnaVisible() + 1;
  let f0 = primeraFilaVisible(),    f1 = ultimaFilaVisible() + 1;
  strokeWeight(1 / zoom);
  for (let c = c0; c <= c1; c++) {
    stroke(COLOR_INTERFAZ, c % CELDAS_POR_MODULO == 0 ? 30 : 8);
    line(c * TAM_CELDA, f0 * TAM_CELDA, c * TAM_CELDA, f1 * TAM_CELDA);
  }
  for (let f = f0; f <= f1; f++) {
    stroke(COLOR_INTERFAZ, f % CELDAS_POR_MODULO == 0 ? 30 : 8);
    line(c0 * TAM_CELDA, f * TAM_CELDA, c1 * TAM_CELDA, f * TAM_CELDA);
  }
  noStroke();
}

// ==================================================
// Etiquetas y estado
// ==================================================
// Se dibuja en coordenadas de PANTALLA (fuera de la cámara), así no se mueve ni se agranda.
function dibujarEstado() {
  // ---------- Marcador (arriba a la izquierda) ----------
  plegableMarcador.animar();          // Interfaz: se esconde con su botón de flecha
  let x = xMarcador(), y = PANEL_Y;
  plegableMarcador.dibujarBoton();
  if (!plegableMarcador.escondido()) dibujarMarcador(x, y);

  if (mostrarRutas) dibujarPanelAlgoritmos();
  dibujarFase();
  if (hayFirebase() && (!modoTutorial || tutorialMuestraRivales())) dibujarRivales();   // Tutorial
  prioridades.dibujar();          // Interfaz: sliders
  dibujarAvisosColonia();         // qué está bajo presión
  dibujarBarraHerramientas();
  dibujarMensaje();
  if (mostrarAyuda) dibujarAyuda();
  if (finDelJuego()) dibujarFinDePartida();
}

// Hadas, luz del Árbol, capullo, cazadores, puntaje y tiempo
function dibujarMarcador(x, y) {
  marcoArcade(x, y, PANEL_ANCHO, PANEL_ALTO, COLOR_HADA);
  let c1 = x + 16, c2 = x + 156, c3 = x + 296;

  etiquetaValor(sprHada, "HADAS", nf(hadasVivas(), 2), c1, y + 14, COLOR_HADA);
  etiquetaValor(sprArbol, "LUZ ÁRBOL", str(int(luzArbol)), c2, y + 14, COLOR_ARBOL);
  textoPixel("CAPULLO", c3, y + 14, 8, COLOR_GRIS);
  if (sprCapullo != null) image(sprCapullo, c3, y + 27, 16, 16);
  barraSegmentada(c3 + 22, y + 31, 106, 10, cargaMaximaCapullos(), 6, COLOR_HADA);   // el capullo más avanzado
  if (capullos.size() > 1) textoPixel("x" + capullos.size(), c3 + 128, y + 14, 8, COLOR_HADA, RIGHT);

  etiquetaValor(sprVeloz, "CAZADORES", nf(cazadoresActivos(), 2), c1, y + 56, COLOR_CAZADOR);
  etiquetaValor(null, "PUNTAJE", nf(puntaje(), 5), c2, y + 56, COLOR_INTERFAZ);
  etiquetaValor(null, "TIEMPO", formatoTiempo(tiempoJuego), c3, y + 56, COLOR_INTERFAZ);

  let pie = "[H] AYUDA   [ESC] MENÚ";
  if (!partidaClasificatoria) pie += "   PRÁCTICA";
  textoPixel(pie, c1, y + PANEL_ALTO - 20, 8, COLOR_GRIS);
  if (pausa && parpadeo(20)) textoPixel("PAUSA", x + PANEL_ANCHO - 16, y + PANEL_ALTO - 20, 8, COLOR_ARBOL, RIGHT);
}

// Con [V]: cuántas celdas revisó cada algoritmo y qué hay bajo el mouse
function dibujarPanelAlgoritmos() {
  let x = PANEL_X, y = PANEL_Y + PANEL_ALTO + 10;
  marcoArcade(x, y, PANEL_ANCHO, ALTO_PANEL_ALGORITMOS, COLOR_LUZ);
  textoPixel("CELDAS REVISADAS EN LA ÚLTIMA BÚSQUEDA", x + 16, y + 14, 8, COLOR_GRIS);
  etiquetaValor(null, "A*", str(exploradasAEstrella), x + 16, y + 30, COLOR_LUZ);
  etiquetaValor(null, "DIJKSTRA", str(exploradasDijkstra), x + 156, y + 30, COLOR_FLOR);
  etiquetaValor(null, "BFS", str(exploradasBFS), x + 296, y + 30, COLOR_ARBOL);

  let c = columnaBajoMouse();
  let f = filaBajoMouse();
  let bajoMouse = dentroDelMundo(c, f) ? "Celda (" + c + ", " + f + "): " + nombreTipo(mundo[c][f]) : "Fuera del mapa";
  if (esFlor(c, f)) bajoMouse += "  ·  luz " + int(luzFlor[c][f]) + "/" + int(luzMaximaFlor(c, f)) + (florApagada[c][f] ? " (recargando)" : "");
  bajoMouse += "   ·   zoom x" + nf(zoom, 1, 2);
  textFont(fuenteTexto);
  textSize(12);
  fill(COLOR_INTERFAZ, 170);
  text(bajoMouse, x + 16, y + 72);
}

// Barra de herramientas abajo al centro: [1] hongo, [2] farol
function dibujarBarraHerramientas() {
  let iconos = [ sprHongo, sprFarol, sprCapullo, sprFlor ];
  for (let i = 0; i < TOTAL_HERRAMIENTAS; i++) {
    let h = i + 1;
    let x = xRanura(i), y = yRanuras();
    let elegida = (herramienta == h);
    let costo = costoHerramienta(h);   // Interfaz
    marcoArcade(x, y, LADO_RANURA, LADO_RANURA, elegida ? COLOR_ARBOL : COLOR_GRIS);
    if (elegida) dibujarBrillo(x + LADO_RANURA / 2, y + LADO_RANURA / 2, LADO_RANURA * 1.3, COLOR_ARBOL, 70);
    let spr = iconos[i];
    if (spr != null) image(spr, x + LADO_RANURA / 2 - 16, y + LADO_RANURA / 2 - 18, 32, 32);
    textoPixel(str(i + 1), x + 8, y + 8, 8, elegida ? COLOR_ARBOL : COLOR_GRIS);
    textoPixel(str(int(costo)), x + LADO_RANURA - 8, y + LADO_RANURA - 16, 8, luzArbol >= costo ? COLOR_ARBOL : COLOR_CAZADOR, RIGHT);
  }
  // Nombre de la herramienta elegida, arriba de las ranuras
  let nombre = nombreHerramienta(herramienta);   // Interfaz
  textoPixelSombra(nombre, width / 2, yRanuras() - 18, 8, COLOR_ARBOL, color('#000000'), CENTER);
}

// Aviso corto (rojo = problema, amarillo = información), arriba de las herramientas
function dibujarMensaje() {
  if (millis() >= mensajeHasta) return;
  textFont(fuentePixel);
  textSize(8);
  let ancho = textWidth(quitarTildes(mensaje)) + 40;
  // Centrado a la derecha del panel de prioridades, para no taparlo
  let centro = max(width / 2, prioridades.x + prioridades.ancho + 20 + ancho / 2);
  let x = centro - ancho / 2, y = yRanuras() - 64;
  marcoArcade(x, y, ancho, 32, colorMensaje);
  textoPixel(mensaje, centro, y + 12, 8, colorMensaje, CENTER);
}

// Tecla H: todos los controles
function dibujarAyuda() {
  let ancho = 640, alto = 456;
  let x = width / 2 - ancho / 2, y = height / 2 - alto / 2 - 20;
  marcoArcade(x, y, ancho, alto, COLOR_LUZ);
  tituloArcade("CONTROLES", width / 2, y + 22, 16, COLOR_INTERFAZ);
  let filas = [
    [ "CLIC IZQ.",     "Usar la herramienta (o mover los sliders)" ],
    [ "1 a 4",         "Hongo, farol, capullo o flor" ],
    [ "CLIC DER.",     "Arrastrar para mover la vista" ],
    [ "RUEDA",         "Acercar y alejar" ],
    [ "C / 0",         "Centrar en el árbol / ver todo el bosque" ],
    [ "V",             "Ver las rutas de los algoritmos y cuántas celdas revisan" ],
    [ "G",             "Mostrar u ocultar la retícula" ],
    [ "P",             "Pausa" ],
    [ "X",             "Sonido: encender o apagar los efectos" ],
    [ "R",             "Bosque al azar (práctica: no entra al ranking)" ],
    [ "E / T / B",     "Hacer aparecer un Veloz / Trampero / Rastreador" ],
    [ "RIVALES",       "Clic en un cazador junto a un rival: se lo envías (de día)" ],
    [ "ESC",           "Volver al menú (la partida queda guardada)" ]
  ];
  for (let i = 0; i < filas.length; i++) {
    let fy = y + 66 + i * 26;
    textoPixel(filas[i][0], x + 30, fy + 2, 8, COLOR_ARBOL);
    textFont(fuenteTexto);
    textSize(14);
    fill(COLOR_INTERFAZ);
    text(filas[i][1], x + 170, fy - 2);
  }
  if (parpadeo(30)) textoPixel("PRESIONA H PARA CERRAR", width / 2, y + alto - 26, 8, COLOR_GRIS, CENTER);
}

// Recuadro arriba a la derecha: en qué fase estamos y cuánto falta
function dibujarFase() {
  let ancho = ANCHO_PANEL_FASE, alto = ALTO_PANEL_FASE;
  let x = width - ancho - 10, y = 10;
  let amenaza = (fase == AMENAZA);
  let tono = amenaza ? COLOR_CAZADOR : COLOR_ARBOL;
  marcoArcade(x, y, ancho, alto, tono);

  let icono = amenaza ? sprLuna : sprSol;
  if (icono != null) image(icono, x + 14, y + 16, 32, 32);
  // De día: qué trae la noche. De noche: cuántos cazadores faltan por llegar
  let tipo = nombreTipoNoche(tipoNoche).toUpperCase();
  let info = amenaza ? "POR LLEGAR: " + cazadoresPorAparecer + " " + tipo
                        : "ESTA NOCHE: " + cazadoresDeLaNoche(ronda) + " " + tipo;
  textoPixel(info, x + 58, y + 16, 8, (amenaza && cazadoresPorAparecer > 0) ? COLOR_CAZADOR : COLOR_INTERFAZ);
  dibujarIconoNoche(tipoNoche, x + ancho - 14, y + 32);
  textoPixelSombra(nombreFase().toUpperCase(), x + 58, y + 32, 16, tono, oscurecer(tono, 0.7), LEFT);

  barraSegmentada(x + 14, y + 60, ancho - 28, 8, tiempoFase / duracionFase, 20, tono);
  textoPixel("QUEDAN " + int(segundosRestantesFase()) + "S", x + 14, y + 76, 8, COLOR_INTERFAZ);
  // A la derecha: cuánto más rápidos son los cazadores de esta ronda
  let extra = round((fuerzaCazadores(ronda) - 1) * 100);
  if (extra > 0) textoPixel("CAZADORES +" + extra + "%", x + ancho - 14, y + 76, 8, COLOR_CAZADOR, RIGHT);
}

// Ícono del tipo de noche (alineado a la derecha en xDer); la mixta muestra los tres
function dibujarIconoNoche(t, xDer, y) {
  let iconos = [ sprRastreador, sprVeloz, sprTrampero ];   // mismo orden que NOCHE_RASTREADORES, VELOCES, TRAMPEROS
  if (t == NOCHE_MIXTA) {
    for (let i = 0; i < 3; i++) if (iconos[i] != null) image(iconos[i], xDer - 16 * (3 - i) - 2 * (2 - i), y + 4, 16, 16);
  } else if (iconos[t] != null) {
    image(iconos[t], xDer - 24, y, 24, 24);
  }
}

// ==================================================
// Avisos de la colonia (encima del panel de prioridades)
// ==================================================
// Dicen qué está bajo presión, pero no qué valor poner: eso lo decide el jugador.
function dibujarAvisosColonia() {
  let textos = [];
  let tonos = [];

  if (luzArbol < ARBOL_BAJO) {
    textos.add("ÁRBOL BAJO: " + int(luzArbol) + " DE LUZ");
    tonos.add(COLOR_CAZADOR);
  }
  let destruidas = 0;
  for (let c = 0; c < COLUMNAS; c++)
    for (let f = 0; f < FILAS; f++)
      if (mundo[c][f] == FLOR_DESTRUIDA) destruidas++;
  if (destruidas >= 3) {
    textos.add(destruidas + " FLORES DESTRUIDAS");
    tonos.add(COLOR_ARBOL);
  }
  let vivas = 0, hambre = 0, sinFlor = 0;
  for (const h of hadas) {
    if (h.estado == MUERTA) continue;
    vivas++;
    if (h.porcentajeLuz() < 0.3) hambre++;
    if (h.estado == IR_A_FLOR && h.florC < 0) sinFlor++;
  }
  if (hambre >= max(2, floor(vivas / 3))) {
    textos.add(hambre + " HADAS CON HAMBRE");
    tonos.add(COLOR_FLOR);
  }
  if (sinFlor >= 2) {
    textos.add(sinFlor + " HADAS SIN FLORES A SU ALCANCE");
    tonos.add(COLOR_LUZ);
  }
  let veloces = 0, rastreadores = 0;
  for (const cz of cazadores) {
    if (!cz.activo()) continue;
    if (cz.tipo == VELOZ) veloces++;
    if (cz.tipo == RASTREADOR) rastreadores++;
  }
  if (veloces > 0) {
    textos.add(veloces + (veloces == 1 ? " VELOZ" : " VELOCES") + " EN EL BOSQUE");
    tonos.add(COLOR_CAZADOR);
  }
  if (rastreadores > 0) {
    textos.add(rastreadores + (rastreadores == 1 ? " RASTREADOR" : " RASTREADORES") + " EN EL BOSQUE");
    tonos.add(COLOR_CAZADOR);
  }
  if (esDeNoche() && puntosReproducirse >= 3) {
    textos.add("DE NOCHE NACER CUESTA +" + round((NACER_DE_NOCHE - 1) * 100) + "%");
    tonos.add(COLOR_HADA);
  }

  // Se apilan hacia arriba, desde el borde superior del panel de prioridades
  prioridades.ubicar();
  let x = 10;
  let y = prioridades.y - 8;
  textFont(fuentePixel);
  textSize(8);
  for (let i = 0; i < min(5, textos.size()); i++) {
    let t = quitarTildes(textos.get(i));
    let tono = tonos.get(i);
    let ancho = textWidth(t) + 20;
    y -= 22;
    noStroke();
    fill(COLOR_PANEL, 230);
    rect(x, y, ancho, 18);
    fill(tono);
    rect(x, y, 3, 18);                       // franja de color a la izquierda
    let urgente = (tono == COLOR_CAZADOR && i == 0 && luzArbol < ARBOL_BAJO);
    if (!urgente || parpadeo(15)) textoPixel(t, x + 11, y + 5, 8, tono);
  }
}

function dibujarFinDePartida() {
  noStroke();
  fill(0, 215);
  rect(0, 0, width, height);
  crearBotonesFin();   // Interfaz

  // ---------- Resultado (izquierda) ----------
  let x = 110, y = 70, ancho = 560, alto = 560;
  let cx = x + ancho / 2;
  marcoArcade(x, y, ancho, alto, COLOR_HADA);
  tituloArcade("RESULTADO", cx, y + 30, 32, COLOR_INTERFAZ);
  textoPixel("¡GRACIAS POR JUGAR, " + nombreJugador.toUpperCase() + "!", cx, y + 82, 8, COLOR_INTERFAZ, CENTER);
  let causa = "SE APAGÓ LA ÚLTIMA HADA";
  textoPixel(causa + "  ·  " + hadasAtrapadas + " ATRAPADAS  ·  " + hadasDeHambre + " DE HAMBRE", cx, y + 100, 8, COLOR_GRIS, CENTER);

  // Caja del tiempo
  noFill();
  stroke(COLOR_GRIS);
  strokeWeight(2);
  rect(x + 90, y + 126, ancho - 180, 46);
  noStroke();
  textoPixel("TIEMPO", x + 112, y + 141, 16, COLOR_GRIS);
  textoPixel(formatoTiempo(tiempoJuego), x + ancho - 112, y + 141, 16, COLOR_INTERFAZ, RIGHT);

  if (puestoObtenido == 1 && parpadeo(15)) textoPixel("¡NUEVO RÉCORD!", cx, y + 190, 16, COLOR_CAZADOR, CENTER);

  // Estadísticas, cada una de un color
  let etiquetas = [ "RONDAS", "RÉCORD DE HADAS", "PUNTOS POR TIEMPO", "PUNTOS POR HADAS" ];
  let valores = [ str(ronda), str(recordHadas), str(int(tiempoJuego)), str(PUNTOS_POR_HADA * recordHadas) ];
  let colores = [ COLOR_LUZ, COLOR_HADA, COLOR_FLOR, COLOR_ARBOL ];
  for (let i = 0; i < etiquetas.length; i++) {
    let fy = y + 230 + i * 28;
    textoPixel(etiquetas[i], x + 100, fy, 8, colores[i]);
    textoPixel(valores[i], x + ancho - 100, fy, 8, COLOR_INTERFAZ, RIGHT);
  }
  fill(COLOR_INTERFAZ, 90);
  rect(x + 100, y + 344, ancho - 200, 2);
  textoPixel("PUNTAJE", x + 100, y + 358, 16, COLOR_INTERFAZ);
  textoPixel(nf(puntaje(), 5), x + ancho - 100, y + 358, 16, COLOR_ARBOL, RIGHT);

  // Estado del envío a Firebase y puesto
  textFont(fuenteTexto);
  textSize(13);
  textAlign(CENTER, TOP);
  fill(estadoEnvio.startsWith("¡") ? COLOR_FLOR : COLOR_GRIS);
  text(estadoEnvio, cx, y + 394);
  textAlign(LEFT, TOP);
  if (puestoObtenido > 0) textoPixel("PUESTO #" + puestoObtenido + " DE " + rankingCompleto.size() + " HOY", cx, y + 418, 8, COLOR_LUZ, CENTER);

  botonOtraVez.dibujar();
  botonMenu.dibujar();
  textoPixel("[R] BOSQUE AL AZAR (PRÁCTICA)", cx, y + alto - 26, 8, COLOR_GRIS, CENTER);

  // ---------- Ranking (derecha) ----------
  if (partidaClasificatoria) dibujarRanking(width - 480, 70, 400, 10, "HOY");
  else {
    marcoArcade(width - 480, 70, 400, 120, COLOR_GRIS);
    textoPixel("PARTIDA DE PRÁCTICA", width - 280, 110, 8, COLOR_GRIS, CENTER);
    textoPixel("NO ENTRA AL RANKING", width - 280, 132, 8, COLOR_GRIS, CENTER);
  }
}

function formatoTiempo(segundos) {
  let s = int(segundos);
  return nf(floor(s / 60), 2) + ":" + nf(s % 60, 2);
}

function nombreTipo(tipo) {
  switch (tipo) {
    case FLOR:        return "flor";
    case HONGO:       return "hongo";
    case NIEBLA:      return "niebla";
    case ARBOL_MADRE: return "Árbol Madre";
    case CAPULLO:     return "Capullo";
    case FLOR_LUNA:   return "flor de luna";
    case FLOR_DESTRUIDA: return "flor destruida (rebrota con Cuidar)";
    default:          return "vacío";
  }
}

// ==================================================
// ESTILO ARCADE: fuentes, marcos, barras y textos pixelados
// ==================================================
// Títulos, botones y marcadores usan "Press Start 2P" (data/PressStart2P-Regular.ttf).
// Esa fuente está dibujada en una cuadrícula de 8 px: se ve nítida en tamaños
// 8, 16, 24, 32, 48... El texto largo (tutorial) usa una fuente normal para leerse bien.

let fuentePixel;
let fuenteTexto;
let COLOR_PANEL;   // fondo de los paneles (casi negro, un poco morado)
let COLOR_GRIS;    // etiquetas secundarias

// Se llama desde preload() en Main.
// La fuente se registra en el navegador (como las de una página web): así el texto
// se dibuja rápido. p5 espera a que termine de cargar antes de setup().
function cargarFuentes() {
  fuentePixel = "PressStart2P";
  fuenteTexto = "sans-serif";
  fuente = fuenteTexto;
  esperarCarga();   // Main: p5 no llama a setup() hasta que avise que terminó
  let archivo = new FontFace("PressStart2P", "url(data/PressStart2P-Regular.ttf)");
  archivo.load()
    .then((f) => document.fonts.add(f))
    .catch(() => {
      console.log("Falta data/PressStart2P-Regular.ttf: se usa una fuente monoespaciada.");
      fuentePixel = "monospace";
    })
    .finally(terminoCarga);
}

function iniciarColoresPanel() {
  COLOR_PANEL = color('#0B0614');
  COLOR_GRIS  = color('#8A8299');
}

function oscurecer(c, cuanto) { return lerpColor(c, color('#000000'), cuanto); }
function aclarar(c, cuanto) { return lerpColor(c, color('#FFFFFF'), cuanto); }

// Press Start 2P dibuja las MAYÚSCULAS con tilde como minúsculas (Ó se ve "ó"),
// así que en los textos pixelados se quitan las tildes de las mayúsculas, como en los arcades.
function quitarTildes(s) {
  return s.replaceAll('Á', 'A').replaceAll('É', 'E').replaceAll('Í', 'I').replaceAll('Ó', 'O').replaceAll('Ú', 'U');
}

// Texto pixelado; alineación como textAlign (si no se da, LEFT)
function textoPixel(s, x, y, tam, c, alineacion = LEFT) {
  s = quitarTildes(s);
  textFont(fuentePixel);
  textSize(tam);
  textAlign(alineacion, TOP);
  fill(c);
  text(s, x, y);
  textAlign(LEFT, TOP);
}

// Texto pixelado con sombra dura (desplazada en diagonal), como en los arcades
function textoPixelSombra(s, x, y, tam, c, sombra, alineacion) {
  let d = max(2, tam / 8);
  textoPixel(s, x + d, y + d, tam, sombra, alineacion);
  textoPixel(s, x, y, tam, c, alineacion);
}

// Título grande con tres capas: sombra morada, contorno cian y color principal
function tituloArcade(s, cx, y, tam, principal) {
  let d = tam / 8;
  textoPixel(s, cx + d * 2, y + d * 2, tam, COLOR_SOMBRA, CENTER);
  textoPixel(s, cx + d, y + d, tam, COLOR_LUZ, CENTER);
  textoPixel(s, cx, y, tam, principal, CENTER);
}

// Cada letra de un color distinto de la paleta (como el "RANKING" de los arcades)
function textoMulticolor(s, cx, y, tam) {
  let colores = [ COLOR_FLOR, COLOR_ARBOL, COLOR_HADA, COLOR_LUZ ];
  s = quitarTildes(s);
  textFont(fuentePixel);
  textSize(tam);
  let x = cx - textWidth(s) / 2;
  for (let i = 0; i < s.length; i++) {
    let letra = s.substring(i, i + 1);
    textoPixel(letra, x + tam / 8, y + tam / 8, tam, COLOR_SOMBRA);
    textoPixel(letra, x, y, tam, colores[i % colores.length]);
    textFont(fuentePixel);
    textSize(tam);
    x += textWidth(letra);
  }
}

// Marco de panel: sombra, fondo oscuro, borde grueso con esquinas recortadas y filete interior
function marcoArcade(x, y, ancho, alto, borde) {
  noStroke();
  fill(0, 150);
  rect(x + 5, y + 5, ancho, alto);                // sombra
  fill(COLOR_PANEL, 235);
  rect(x + 3, y + 3, ancho - 6, alto - 6);        // fondo
  fill(borde);                                    // borde de 3 px sin esquinas (efecto pixel)
  rect(x + 3, y, ancho - 6, 3);
  rect(x + 3, y + alto - 3, ancho - 6, 3);
  rect(x, y + 3, 3, alto - 6);
  rect(x + ancho - 3, y + 3, 3, alto - 6);
  fill(oscurecer(borde, 0.55));                   // filete interior
  rect(x + 6, y + 6, ancho - 12, 1);
  rect(x + 6, y + alto - 7, ancho - 12, 1);
  rect(x + 6, y + 6, 1, alto - 12);
  rect(x + ancho - 7, y + 6, 1, alto - 12);
}

// Barra hecha de bloques (como una barra de vida)
function barraSegmentada(x, y, ancho, alto, progreso, segmentos, c) {
  let hueco = 2;
  let anchoBloque = (ancho - hueco * (segmentos - 1)) / segmentos;
  let llenos = round(constrain(progreso, 0, 1) * segmentos);
  noStroke();
  for (let i = 0; i < segmentos; i++) {
    let bx = x + i * (anchoBloque + hueco);
    fill(i < llenos ? c : color(255, 30));
    rect(bx, y, anchoBloque, alto);
    if (i < llenos) {
      fill(aclarar(c, 0.5));
      rect(bx, y, anchoBloque, 2);   // brillo arriba de cada bloque
    }
  }
}

// Líneas horizontales finas sobre toda la pantalla: efecto de monitor CRT (solo en los menús)
function lineasCRT() {
  noStroke();
  fill(0, 45);
  for (let y = 0; y < height; y += 3) rect(0, y, width, 1);
}

// Etiqueta chica + valor grande, con ícono opcional (para el marcador)
function etiquetaValor(icono, etiqueta, valor, x, y, c) {
  textoPixel(etiqueta, x, y, 8, COLOR_GRIS);
  let vx = x;
  if (icono != null) {
    image(icono, x, y + 13, 16, 16);
    vx += 22;
  }
  textoPixel(valor, vx, y + 14, 16, c);
}

function parpadeo(velocidad) {
  return floor(frameCount / velocidad) % 2 == 0;
}

// ==================================================
// Panel de rivales en línea (Red)
// ==================================================
// (el botón de flecha que lo esconde es la clase Plegable, en Interfaz)
function dibujarRivales() {
  plegableRivales.animar();   // Interfaz: se desliza al ocultar/mostrar
  let lista = rivales;
  let x = xPanelRivales();
  plegableRivales.dibujarBoton();
  if (plegableRivales.escondido()) return;   // solo queda el botón
  let y = yPanelRivales(), ancho = ANCHO_PANEL_FASE, alto = altoPanelRivales();
  marcoArcade(x, y, ancho, alto, COLOR_LUZ);
  textoPixel("RIVALES EN LINEA", x + 14, y + 14, 8, COLOR_INTERFAZ);
  textoPixel(str(lista.size()), x + ancho - 14, y + 14, 8, COLOR_LUZ, RIGHT);

  if (lista.size() == 0) {
    textoPixel("NADIE MAS JUGANDO AHORA", x + 14, y + 44, 8, COLOR_GRIS);
  }
  let sePuede = motivoNoPuedoEnviar().equals("");   // Red
  let iconos = [ sprVeloz, sprTrampero, sprRastreador ];
  for (let i = 0; i < filasRivales(); i++) {
    let r = lista.get(i);
    let fy = y + 36 + i * ALTO_FILA_RIVAL;
    let nombre = r.getString("nombre", "?").toUpperCase();
    if (nombre.length > 10) nombre = nombre.substring(0, 10);
    let enAmenaza = r.getString("fase", "").equals("amenaza");
    textoPixel(nombre, x + 14, fy + 4, 8, enAmenaza ? COLOR_CAZADOR : COLOR_INTERFAZ);
    textFont(fuenteTexto);
    textSize(11);
    fill(COLOR_INTERFAZ, 140);
    text("Ronda " + r.getInt("ronda", 1) + " · " + r.getInt("hadas", 0) + " hadas · " + (enAmenaza ? "de noche" : "de día"), x + 14, fy + 14);

    // Íconos para enviar cada cazador
    for (let tipo = 0; tipo < 3; tipo++) {
      let bx = xBotonEnvio(tipo), by = yBotonEnvio(i);
      let encima = mouseX >= bx && mouseX <= bx + LADO_BOTON_ENVIO && mouseY >= by && mouseY <= by + LADO_BOTON_ENVIO;
      noStroke();
      fill(encima && sePuede ? COLOR_CAZADOR : color(255, 25));
      rect(bx, by, LADO_BOTON_ENVIO, LADO_BOTON_ENVIO);
      if (iconos[tipo] != null) {
        if (!sePuede) tint(255, 70);
        image(iconos[tipo], bx + 4, by + 4, 16, 16);
        noTint();
      }
    }
  }
  // Pie: la regla, o por qué no se puede ahora
  let pie = "ENVIAR CAZADOR: " + int(COSTO_ENVIO_CAZADOR) + " DE LUZ";
  if (fase != CALMA)                         pie = "ENVIOS SOLO DE DIA";
  else if (rondaUltimoEnvio == ronda)        pie = "YA ENVIASTE EN ESTA RONDA";
  else if (luzArbol - COSTO_ENVIO_CAZADOR < LUZ_MINIMA_ARBOL) pie = "FALTA LUZ (CUESTA " + int(COSTO_ENVIO_CAZADOR) + ")";
  textoPixel(pie, x + 14, y + alto - 18, 8, sePuede ? COLOR_ARBOL : COLOR_GRIS);
}
