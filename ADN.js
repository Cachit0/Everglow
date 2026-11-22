// ==================================================
// ADN: hadas generativas por parámetros
// ==================================================
// El jugador define el ESTILO de su familia (clase Familia) con cuatro
// parámetros. De ahí sale el ADN de cada hada:
//
//   Familia (parámetros del jugador)
//        |  + variación individual (semilla propia de cada hada)
//        v
//   ADN (genes de 0 a 1: cuerpo, alas, brillo + rasgos: figura, forma de ala, manchas, tono)
//        |
//        +--> FENOTIPO VISUAL: sprite pixel-art dibujado por código
//        +--> FENOTIPO DE JUEGO: velocidad, luz máxima, gasto, etc.
//
// Las hadas NO son personitas: son orbes de luz con alas.
// El cuerpo es una figura geométrica (círculo, cuadrado, triángulo o rombo)
// con un núcleo que brilla, un borde claro y un halo alrededor.
//
// Consistencia: todas comparten paleta, estilo pixel-art y simetría, y sus
// genes giran alrededor del estilo de la familia.
// Diferencia: cada hada suma una variación propia (genes, figura, forma de ala,
// manchas y tono), así que nunca hay dos iguales.

// ---------- Ajustes ----------
const LADO_SPRITE        = 24;     // el sprite es de 24x24 px (más grande que una celda para que quepan las alas)
const HEREDAR_ADN      = true;   // true: las hadas nuevas heredan el ADN de una hada viva (con mutación)
const ATRACCION_FAMILIA  = 0.15;   // cuánto vuelve cada generación hacia el estilo de la familia (0 = deriva libre)
const MUTACION_HIJO_MIN  = 0.03;   // mutación de un hijo con Variedad = 0
const MUTACION_HIJO_MAX  = 0.12;   // mutación de un hijo con Variedad = 1
const VARIACION_MIN      = 0.06;   // desviación entre hadas fundadoras con Variedad = 0
const VARIACION_MAX      = 0.30;   // desviación entre hadas fundadoras con Variedad = 1

// ---------- Figura del cuerpo ----------
const FIG_CIRCULO = 0, FIG_CUADRADO = 1, FIG_TRIANGULO = 2, FIG_ROMBO = 3;
const TOTAL_FIGURAS = 4;

// ---------- Forma de ala ----------
const ALA_GOTA = 0, ALA_PUNTA = 1, ALA_DOBLE = 2;

// ==================================================
// La familia: lo que el jugador elige (valores de 0 a 1)
// ==================================================
// Se eligen con PUNTOS_CREACION puntos (0 a 10 por rasgo; el valor guardado es puntos / 10).
class Familia {
  cuerpo = 0.5;   // tamaño del cuerpo: grande = más luz y dura más, pero es lenta
  alas = 0.5;   // largo de las alas: largas = rápida, pero gasta más luz
  brillo = 0.5;   // intensidad: alto = cada luz que entrega vale más y come más rápido, pero los cazadores la ven más
  variedad = 0.5;   // diversidad: alta = nacer cuesta menos (vigor híbrido), pero las hadas salen más disparejas

  // Si los valores guardados gastan más puntos que el presupuesto
  // (por ejemplo, un usuario.json de antes), se bajan los más altos hasta cumplirlo.
  ajustarAPresupuesto() {
    let p = [ round(this.cuerpo * MAX_PUNTOS_RASGO), round(this.alas * MAX_PUNTOS_RASGO),
                round(this.brillo * MAX_PUNTOS_RASGO), round(this.variedad * MAX_PUNTOS_RASGO) ];
    let suma = p[0] + p[1] + p[2] + p[3];
    while (suma > PUNTOS_CREACION) {
      let mayor = 0;
      for (let i = 1; i < 4; i++) if (p[i] > p[mayor]) mayor = i;
      p[mayor]--;
      suma--;
    }
    this.cuerpo   = p[0] / MAX_PUNTOS_RASGO;
    this.alas     = p[1] / MAX_PUNTOS_RASGO;
    this.brillo   = p[2] / MAX_PUNTOS_RASGO;
    this.variedad = p[3] / MAX_PUNTOS_RASGO;
  }
}

// Variedad: una familia diversa nace más fácil. Con 5 puntos cuesta lo de siempre (150);
// con 10 cuesta un 15 % menos y con 0 un 15 % más.
function costoNacerBase() {
  return COSTO_HADA * (1 + 0.30 * (0.5 - familia.variedad));
}

// Lo que cuesta ahora: de noche, un 50 % más (el Capullo necesita el calor del día)
function costoNacer() {
  return costoNacerBase() * (esDeNoche() ? NACER_DE_NOCHE : 1);
}

let familia = new Familia();

// ==================================================
// El ADN de una hada
// ==================================================
class ADN {
  // Genes (0 a 1)
  cuerpo = 0;alas = 0;brillo = 0;
  // Rasgos
  figura = 0;       // FIG_CIRCULO, FIG_CUADRADO, FIG_TRIANGULO o FIG_ROMBO
  forma = 0;        // ALA_GOTA, ALA_PUNTA o ALA_DOBLE
  manchas = 0;      // 0, 1 o 2 manchas en cada ala
  tono = 0;       // -1 a 1: desplaza los colores dentro de la paleta del juego
  semilla = 0;     // identidad: la misma semilla y familia dan siempre la misma hada

  // Fenotipo de juego (lo que usa la simulación)
  velocidad = 0;       // píxeles del mundo por segundo
  luzMax = 0;          // tamaño de su barra de luz
  gasto = 0;           // luz que gasta por segundo
  tasaComer = 0;       // luz por segundo que toma de una flor
  visibilidad = 0;     // multiplica su luz cuando los cazadores buscan la más brillante
  rendimiento = 0;     // multiplica la luz que entrega al Árbol o al Capullo (Brillo)

  // Fenotipo visual
  frecAleteo = 0;amplitudAleteo = 0;escalaBrillo = 0;
  colorBrillo = null;
  sprNormal = null;sprBrillo = null;sprApagada = null;

  // Sin argumentos: ADN vacío (lo llena hijoDe).
  // Con (familia, semilla): hada fundadora = estilo de la familia + variación propia (determinista por semilla).
  // (En Java eran dos constructores; JavaScript solo permite uno.)
  constructor(f, semilla) {
    if (f === undefined) return;
    this.semilla = semilla;
    let r = new AleatorioJava(semilla);
    let v = lerp(VARIACION_MIN, VARIACION_MAX, f.variedad);
    this.cuerpo = constrain(f.cuerpo + r.nextGaussian() * v, 0, 1);
    this.alas   = constrain(f.alas   + r.nextGaussian() * v, 0, 1);
    this.brillo = constrain(f.brillo + r.nextGaussian() * v, 0, 1);
    // Con poca variedad casi todas son círculos con alas de gota y sin manchas
    this.figura  = (r.nextFloat() < 0.15 + 0.85 * f.variedad) ? r.nextInt(TOTAL_FIGURAS) : FIG_CIRCULO;
    this.forma   = (r.nextFloat() < 0.1 + 0.9 * f.variedad) ? r.nextInt(3) : ALA_GOTA;
    this.manchas = (r.nextFloat() < f.variedad) ? r.nextInt(3) : 0;
    this.tono    = constrain(r.nextGaussian() * 0.55 * f.variedad, -1, 1);
    this.construir();
  }

  // Calcula el fenotipo (stats y sprites) a partir de los genes.
  // La figura es solo visual: no cambia los stats.
  // Con genes en 0.5 todo vale lo mismo que antes. Subir un rasgo cuesta puntos
  // de creación; Cuerpo y Alas además tienen un costo dentro del juego, y Brillo se ve más.
  construir() {
    this.velocidad    = VELOCIDAD_HADA * (1.0 + 0.60 * (this.alas - 0.5) - 0.30 * (this.cuerpo - 0.5));        // alas largas = rápida; cuerpo grande = lenta
    this.luzMax       = LUZ_MAX_HADA * (1.0 + 0.60 * (this.cuerpo - 0.5));                                 // cuerpo grande = más reserva
    this.gasto        = GASTO_LUZ_HADA * (1.0 + 0.50 * (this.alas - 0.5));                                 // alas largas gastan más
    this.tasaComer    = TASA_COMER * (1.0 + 0.40 * (this.brillo - 0.5));
    this.visibilidad  = 1.0 + 0.40 * (this.brillo - 0.5);                                                  // brillo alto: los cazadores la prefieren
    this.rendimiento  = 1.0 + 0.50 * (this.brillo - 0.5);                                                  // brillo alto: entrega hasta un 25 % más de luz
    this.escalaBrillo = 1.0 + 0.60 * (this.brillo - 0.5);
    this.frecAleteo     = lerp(0.24, 0.10, this.alas);   // alas cortas aletean rápido, largas lento
    this.amplitudAleteo = lerp(1.0, 2.0, this.alas);
    this.colorBrillo  = conAlfa(this.colorAla(0), 255);
    this.sprNormal  = this.generarSprite(0);
    this.sprBrillo  = this.generarSprite(1);
    this.sprApagada = this.generarSprite(2);
  }

  // Cuántos segundos aguanta sin comer
  duracion() {
    return this.luzMax / this.gasto;
  }

  // ---------- Colores (siempre dentro de la paleta del juego) ----------
  colorCuerpo(modo) {
    let c = (this.tono < 0) ? lerpColor(COLOR_HADA, COLOR_ARBOL, -this.tono * 0.7)
                         : lerpColor(COLOR_HADA, COLOR_LUZ, this.tono * 0.5);
    if (modo == 1) return lerpColor(c, COLOR_ARBOL, 0.45);   // encendida: más luminosa
    if (modo == 2) return color(90, 84, 100);                 // apagada: gris
    return c;
  }

  colorAla(modo) {
    let c = (this.tono < 0) ? lerpColor(COLOR_LUZ, COLOR_FLOR, -this.tono * 0.5)
                         : lerpColor(COLOR_LUZ, COLOR_HADA, this.tono * 0.6);
    if (modo == 1) return conAlfa(lerpColor(c, COLOR_INTERFAZ, 0.45), 235);
    if (modo == 2) return color(120, 114, 130, 110);
    return conAlfa(c, 175);
  }

  // ---------- El sprite, dibujado pixel por pixel ----------
  // modo 0 = normal, 1 = encendida (brilla), 2 = apagada
  // Capas, de atrás hacia adelante: halo -> alas -> borde -> cuerpo -> núcleo -> destello
  generarSprite(modo) {
    let L = LADO_SPRITE;
    let img = createImage(L, L);
    img.loadPixels();

    let cx = L / 2.0;
    let cy = L / 2.0 + 2;                 // más abajo: las alas van arriba
    let R = lerp(2.8, 5.2, this.cuerpo);         // tamaño del cuerpo
    let largo = lerp(3.5, 8.0, this.alas);       // largo de cada ala
    let altoAla = lerp(1.6, 2.8, this.alas);     // alto de cada ala
    let raiz = R * 0.7;                     // dónde nacen las alas (en el borde de arriba del cuerpo)
    let rNucleo = R * lerp(0.35, 0.6, this.brillo);   // más brillo = núcleo más grande

    let cCuerpo = this.colorCuerpo(modo);
    let cBorde  = lerpColor(cCuerpo, COLOR_INTERFAZ, 0.45);
    let cNucleo = lerpColor(cCuerpo, COLOR_INTERFAZ, modo == 1 ? 0.9 : 0.7);
    let cHalo   = conAlfa(lerpColor(cCuerpo, COLOR_INTERFAZ, 0.5), modo == 1 ? 190 : 120);
    let cAla    = this.colorAla(modo);
    let cMancha = conAlfa(lerpColor(this.colorCuerpo(modo), COLOR_INTERFAZ, 0.25), 235);

    for (let y = 0; y < L; y++) {
      for (let x = 0; x < L; x++) {
        let px = x + 0.5 - cx;
        let py = y + 0.5 - cy;
        let ax = abs(px) - raiz;     // distancia horizontal desde la raíz del ala
        let c = null;                // transparente

        if (modo != 2 && this.dentroDeFigura(px, py, R + 1.1)) c = cHalo;   // halo de luz (1 pixel alrededor)
        if (this.alaContiene(ax, py, largo, altoAla, R) && !this.dentroDeFigura(px, py, R + 1.1)) {   // las alas no tocan el cuerpo
          c = cAla;
          if (modo != 2 && this.esMancha(ax, py, largo, R)) c = cMancha;
        }
        if (this.dentroDeFigura(px, py, R)) {
          c = cBorde;                                                  // borde claro
          if (this.dentroDeFigura(px, py, R - 1)) c = cCuerpo;              // cuerpo
          if (modo != 2 && this.dentroDeFigura(px, py, rNucleo)) c = cNucleo;   // núcleo de luz
        }
        ponerPixel(img, y * L + x, c);
      }
    }

    // Destello: un pixel blanco arriba a la izquierda del núcleo (se ve como una gema)
    if (modo != 2) {
      let dx = round(cx - R * 0.35 - 0.5), dy = round(cy - R * 0.35 - 0.5);
      if (dx >= 0 && dy >= 0 && dx < L && dy < L && this.dentroDeFigura(dx + 0.5 - cx, dy + 0.5 - cy, R - 1))
        ponerPixel(img, dy * L + dx, COLOR_INTERFAZ);
    }
    img.updatePixels();
    return img;
  }

  // ¿El punto (px, py) cae dentro de la figura del cuerpo de tamaño R?
  dentroDeFigura(px, py, R) {
    if (R <= 0) return false;
    switch (this.figura) {
      case FIG_CUADRADO:
        return max(abs(px), abs(py)) < R * 0.82;
      case FIG_TRIANGULO: {
        // Triángulo con la punta hacia arriba
        let arriba = -R * 1.05, abajo = R * 0.8;
        if (py < arriba || py > abajo) return false;
        let t = (py - arriba) / (abajo - arriba);   // 0 en la punta, 1 en la base
        return abs(px) < R * 1.05 * t + 0.35;
      }
      case FIG_ROMBO:
        return abs(px) / (R * 0.95) + abs(py) / (R * 1.2) < 1;
      default:   // FIG_CIRCULO
        return sq(px) + sq(py) < sq(R);
    }
  }

  // ¿Este punto pertenece a un ala? (ax = distancia desde la raíz, py = altura desde el centro)
  // Las alas salen de arriba del cuerpo y apuntan hacia arriba y afuera, como las de una libélula.
  alaContiene(ax, py, largo, altoAla, R) {
    let y0 = -R * 0.45;   // altura de la raíz del ala
    if (this.forma == ALA_PUNTA) {
      // Ala larga y puntiaguda, muy inclinada hacia arriba
      let ang = -0.95;
      let u = ax * cos(ang) + (py - y0) * sin(ang);    // a lo largo del ala
      let v = -ax * sin(ang) + (py - y0) * cos(ang);   // a lo ancho
      if (u < -0.3 || u > largo * 1.1) return false;
      let t = u / (largo * 1.1);
      let ancho = altoAla * pow(max(0, 1 - t), 0.7) * min(1, (u + 1) / (largo * 0.35));
      return abs(v) < ancho + 0.3;
    }
    if (this.forma == ALA_DOBLE) {
      // Un ala grande hacia arriba y una pequeña hacia abajo
      let arriba = this.elipseGirada(ax, py - y0, largo * 0.5, -0.7, largo * 0.5 + 0.4, altoAla);
      let abajo  = this.elipseGirada(ax, py - R * 0.05, largo * 0.33, 0.55, largo * 0.33 + 0.4, altoAla * 0.6);
      return arriba || abajo;
    }
    // Ala de gota (ovalada), inclinada hacia arriba
    return this.elipseGirada(ax, py - y0, largo * 0.5, -0.6, largo * 0.5 + 0.4, altoAla);
  }

  // Elipse cuyo centro está a "d" pixeles de la raíz en la dirección "ang"
  // (ang negativo = hacia arriba), con semiejes a (largo) y b (ancho)
  elipseGirada(x, y, d, ang, a, b) {
    let dx = x - d * cos(ang), dy = y - d * sin(ang);
    let u = dx * cos(ang) + dy * sin(ang);
    let v = -dx * sin(ang) + dy * cos(ang);
    return sq(u / a) + sq(v / b) < 1;
  }

  // Manchas en las alas (1 o 2 puntos a lo largo del ala)
  esMancha(ax, py, largo, R) {
    if (this.manchas == 0) return false;
    if (this.puntoMancha(ax, py, largo * 0.62, R)) return true;
    if (this.manchas == 2 && this.puntoMancha(ax, py, largo * 0.3, R)) return true;
    return false;
  }

  puntoMancha(ax, py, d, R) {
    let ang = (this.forma == ALA_PUNTA) ? -0.95 : (this.forma == ALA_DOBLE) ? -0.7 : -0.6;
    let y0 = -R * 0.45;
    return sq(ax - d * cos(ang)) + sq(py - y0 - d * sin(ang)) < 1.0;
  }
}

// ==================================================
// Funciones de apoyo
// ==================================================

// En p5.js cada pixel de una imagen ocupa 4 casillas seguidas: rojo, verde, azul y transparencia.
// c = null deja el pixel transparente.
function ponerPixel(img, i, c) {
  const p = i * 4;
  if (c === null) {
    img.pixels[p] = img.pixels[p + 1] = img.pixels[p + 2] = img.pixels[p + 3] = 0;
    return;
  }
  const v = c.levels;   // [rojo, verde, azul, transparencia] de 0 a 255
  img.pixels[p]     = v[0];
  img.pixels[p + 1] = v[1];
  img.pixels[p + 2] = v[2];
  img.pixels[p + 3] = v[3];
}

// El mismo color con otra opacidad
function conAlfa(c, alfa) {
  return color(red(c), green(c), blue(c), alfa);
}

function nombreFigura(figura) {
  if (figura == FIG_CUADRADO)  return "cuadrado";
  if (figura == FIG_TRIANGULO) return "triángulo";
  if (figura == FIG_ROMBO)     return "rombo";
  return "círculo";
}

// Un hijo hereda los genes del padre, un poco atraídos hacia el estilo
// de la familia, y con una mutación pequeña.
function hijoDe(padre, f, semilla) {
  let h = new ADN();
  h.semilla = semilla;
  let r = new AleatorioJava(semilla);
  let m = lerp(MUTACION_HIJO_MIN, MUTACION_HIJO_MAX, f.variedad);
  h.cuerpo = constrain(lerp(padre.cuerpo, f.cuerpo, ATRACCION_FAMILIA) + r.nextGaussian() * m, 0, 1);
  h.alas   = constrain(lerp(padre.alas,   f.alas,   ATRACCION_FAMILIA) + r.nextGaussian() * m, 0, 1);
  h.brillo = constrain(lerp(padre.brillo, f.brillo, ATRACCION_FAMILIA) + r.nextGaussian() * m, 0, 1);
  let saltoRasgo = 0.05 + 0.15 * f.variedad;   // probabilidad de que cambie un rasgo discreto
  h.figura  = (r.nextFloat() < saltoRasgo) ? r.nextInt(TOTAL_FIGURAS) : padre.figura;   // la figura se hereda
  h.forma   = (r.nextFloat() < saltoRasgo) ? r.nextInt(3) : padre.forma;
  h.manchas = (r.nextFloat() < saltoRasgo) ? r.nextInt(3) : padre.manchas;
  h.tono    = constrain(lerp(padre.tono, 0, 0.1) + r.nextGaussian() * 0.2 * f.variedad, -1, 1);
  h.construir();
  return h;
}

// ADN para un hada que nace del Capullo: hijo de una hada viva (si hay)
// o hada nueva de la familia.
function adnParaNacimiento() {
  let s = int(random(999999));
  if (!HEREDAR_ADN) return new ADN(familia, s);
  let vivas = [];
  for (const h of hadas) if (h.estado != MUERTA) vivas.add(h);
  if (vivas.size() == 0) return new ADN(familia, s);
  let padre = vivas.get(int(random(vivas.size())));
  return hijoDe(padre.adn, familia, s);
}
