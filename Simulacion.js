// ==================================================
// SIMULACION: evolución temporal y reglas de los agentes
// ==================================================
// Aquí viven las reglas del ecosistema:
//   AGENTE    -> las hadas (clase Hada)
//   RECURSO   -> la luz de las flores (se gasta y se recarga)
//   GENERADOR -> el Árbol Madre (guarda luz y recarga más rápido las flores cercanas)
//   ORIGEN    -> el Capullo (con suficiente luz crea hadas nuevas)
//   CONTINGENCIAS -> los cazadores (clase Cazador): Veloz (A*), Trampero (Dijkstra), Rastreador (BFS)
// Aquí se produce la emergencia: nadie le dice a cada hada qué hacer,
// cada una sigue sus reglas y el comportamiento del bosque sale de ahí.

// ---------- Estados de un hada ----------
const IR_A_FLOR = 0;   // busca una flor con luz y vuela hacia ella
const COMER     = 1;   // pasa luz de la flor a su barra
const VOLVER    = 2;   // lleva el sobrante al Árbol Madre o al Capullo
const MUERTA    = 3;   // se quedó sin luz o la atrapó un cazador
const HUIR      = 4;   // un cazador está cerca: busca con BFS un lugar seguro
const CUIDAR    = 5;   // cuida una flor: hace rebrotar una destruida o recarga una apagada
const REFUGIO   = 6;   // tiene hambre y no hay flores a su alcance: toma luz del Árbol

let hadas = [];
let cazadores = [];
let tiempoJuego = 0;     // segundos sobrevividos
let recordHadas = 0;       // máximo de hadas vivas a la vez en esta partida (cuenta para el puntaje)
let pausa = false;     // tecla P

// ---------- Inicio y ciclo ----------

function iniciarSimulacion() {
  hadas.clear();
  cazadores.clear();
  tiempoJuego = 0;
  hadasAtrapadas = 0;
  hadasDeHambre = 0;
  recordHadas = HADAS_INICIALES;
  for (let i = 0; i < HADAS_INICIALES; i++) {
    let x = centroX(arbolCol) + random(-3, 3) * TAM_CELDA;
    let y = centroY(arbolFila) + random(-3, 3) * TAM_CELDA;
    hadas.add(new Hada(x, y, new ADN(familia, int(random(999999))), random(0.6, 0.9)));   // ADN.pde: hada de la familia del jugador
  }
  iniciarFases();
}

// ---------- Prioridades (las cambian los sliders) ----------
// Alimentarse: cuánta luz se guarda cada hada al entregar
function reservaHada() {
  return map(puntosAlimentarse, 0, PRESUPUESTO_PRIORIDADES, RESERVA_MIN, RESERVA_MAX);
}
// Cuidar: probabilidad de ir a cuidar una flor después de entregar
function probabilidadCuidar() {
  return map(puntosCuidar, 0, PRESUPUESTO_PRIORIDADES, 0, CUIDAR_MAX);
}
// Reproducirse: probabilidad de llevar el sobrante al Capullo en vez de al Árbol
function probabilidadCapullo() {
  return map(puntosReproducirse, 0, PRESUPUESTO_PRIORIDADES, 0, 1);
}
// Huir: a cuántas celdas de un cazador empieza a huir
function radioPeligro() {
  return map(puntosHuir, 0, PRESUPUESTO_PRIORIDADES, PELIGRO_MIN, PELIGRO_MAX);
}
// ...y su costo: con Huir alto son miedosas y solo buscan flores cerca del Árbol
function radioBusqueda() {
  return map(puntosHuir, 0, PRESUPUESTO_PRIORIDADES, RADIO_BUSQUEDA_MAX, RADIO_BUSQUEDA_MIN);
}

// ---------- Fin de la partida ----------
// Se pierde cuando se apaga la última hada
let hadasAtrapadas = 0;   // cuántas apagó un cazador (se muestra en el resultado)
let hadasDeHambre  = 0;   // cuántas se quedaron sin luz

function finDelJuego() {
  return hadasVivas() == 0;
}

function actualizarSimulacion() {
  if (finDelJuego()) {
    // FIN: se apagó la última hada -> se manda el puntaje una sola vez (Red)
    if (!partidaTerminada) {
      partidaTerminada = true;
      registrarFinDePartida();
    }
    return;
  }
  if (pausa) return;
  tiempoJuego += DT;

  actualizarFases();                      // calma / amenaza
  recargarFlores();                       // RECURSO + GENERADOR
  for (const h of hadas) h.actualizar();    // AGENTES
  actualizarFaroles();
  actualizarCazadores();                  // CONTINGENCIAS
  actualizarHongos();                     // Modelo: los hongos del jugador desaparecen a los 10 s

  // Quitar los cuerpos de las hadas que llevan un rato apagadas
  for (let i = hadas.size() - 1; i >= 0; i--) {
    let h = hadas.get(i);
    if (h.estado == MUERTA && h.tiempoMuerta > TIEMPO_CUERPO) hadas.remove(i);
  }

  // ORIGEN: cada Capullo junta un poco de luz solo y crea un hada cuando llega a costoNacer()
  for (const cap of capullos) {
    cap.luz += CALOR_CAPULLO * DT;
    if (cap.luz >= costoNacer() && hadasVivas() < MAX_HADAS) {   // ADN: la Variedad abarata nacer
      cap.luz -= costoNacer();
      hadas.add(new Hada(centroX(cap.c), centroY(cap.f), adnParaNacimiento(), 0.6));   // ADN.pde: hereda de un hada viva
    }
  }

  recordHadas = max(recordHadas, hadasVivas());
}

// Las flores se recargan solas; cerca del Árbol Madre, un poco más rápido.
// Cuando una flor se apaga, queda apagada hasta llenarse por completo.
// De noche se recargan más lento. Las flores de luna no se recargan.
function recargarFlores() {
  let factorNoche = esDeNoche() ? RECARGA_NOCHE : 1;
  for (let c = 0; c < COLUMNAS; c++) {
    for (let f = 0; f < FILAS; f++) {
      if (mundo[c][f] != FLOR) continue;
      let cercania = max(0, 1 - distanciaAlArbol(c, f) / RADIO_BONO_ARBOL);   // 1 junto al árbol, 0 lejos
      let tiempoLlenado = lerp(TIEMPO_RECARGA_LEJOS, TIEMPO_RECARGA_CERCA, cercania);
      luzFlor[c][f] = min(LUZ_MAX_FLOR, luzFlor[c][f] + LUZ_MAX_FLOR / tiempoLlenado * factorNoche * DT);
      if (florApagada[c][f] && luzFlor[c][f] >= LUZ_MAX_FLOR) florApagada[c][f] = false;   // vuelve a encenderse
    }
  }
}

// Puntaje de la partida
function puntaje() {
  return int(tiempoJuego) + PUNTOS_POR_HADA * recordHadas;
}

function hadasVivas() {
  let n = 0;
  for (const h of hadas) if (h.estado != MUERTA) n++;
  return n;
}

// ==================================================
// El agente: Hada
// ==================================================
class Hada {
  x = 0;y = 0;              // posición en píxeles del mundo
  luz = 0;               // su barra de luz
  adn = null;                 // sus genes: de aquí salen su forma y sus stats (ADN.pde)
  estado = IR_A_FLOR;
  florC = -1;florF = -1;   // flor a la que va (-1 = ninguna)
  vaAlCapullo = false;     // al volver: ¿lleva la luz a un Capullo o al Árbol?
  capulloDestino = null;  // a qué capullo (el más cercano cuando se llenó)
  tiempoMuerta = 0;
  fase = random(TWO_PI);  // para que cada una aletee distinto
  vagarC = 0;vagarF = 0;      // celda a la que vaga cuando no encuentra flores
  esperaBusqueda = 0;

  // Ruta calculada con A* (Herramientas)
  ruta = null;
  paso = 0;                  // a qué punto de la ruta va ahora
  rutaC = -1;rutaF = -1;    // celda destino de la ruta actual
  versionRuta = -1;          // versionMapa cuando se revisó la ruta por última vez
  sinCamino = false;     // A* no encontró camino al destino
  esperaRuta = 0;          // tras fallar, espera un poco antes de volver a intentar

  constructor(x, y, adn, fraccionLuz) {
    this.x = x;
    this.y = y;
    this.adn = adn;
    this.luz = adn.luzMax * fraccionLuz;
    this.vagarC = celdaX(x);
    this.vagarF = celdaY(y);
  }

  actualizar() {
    if (this.estado == MUERTA) {
      this.tiempoMuerta += DT;
      return;
    }

    // Regla 1: vivir gasta luz. Sin luz, el hada se apaga.
    this.luz -= this.adn.gasto * DT;
    if (this.luz <= 0) {
      this.luz = 0;
      this.estado = MUERTA;
      hadasDeHambre++;
      return;
    }

    // Regla 2: si un cazador está cerca, huir es lo primero
    if (this.estado != HUIR) {
      let peligro = cazadorCercano(this.x, this.y, radioPeligro() * TAM_CELDA);
      if (peligro != null) this.empezarAHuir(peligro);
    }

    // Regla 3: qué hacer depende de su estado
    switch (this.estado) {
      case IR_A_FLOR: this.irAFlor(); break;
      case COMER:     this.comer();   break;
      case VOLVER:    this.volver();  break;
      case HUIR:      this.huir();    break;
      case CUIDAR:    this.cuidar();  break;
      case REFUGIO:   this.refugiarse(); break;
    }
  }

  // ---------- Huir (BFS) ----------
  // Busca por capas la celda libre más cercana que quede lejos del cazador.
  empezarAHuir(peligro) {
    let camino = bfsLugarSeguro(celdaX(this.x), celdaY(this.y), peligro.x, peligro.y, radioPeligro() + MARGEN_SEGURO);   // Herramientas
    if (camino == null || camino.size() == 0) {
      if (this.estado == HUIR) this.estado = IR_A_FLOR;   // no hay a dónde huir
      return;
    }
    this.florC = -1;
    this.florF = -1;
    this.ruta = camino;
    this.paso = 0;
    let ultimo = camino.get(camino.size() - 1);
    this.rutaC = celdaX(ultimo.x);
    this.rutaF = celdaY(ultimo.y);
    this.versionRuta = versionMapa;
    this.sinCamino = false;
    this.estado = HUIR;
  }

  huir() {
    let llego = this.irA(this.rutaC, this.rutaF, 1);
    if (llego || this.sinCamino) {
      let peligro = cazadorCercano(this.x, this.y, radioPeligro() * TAM_CELDA * 1.5);
      if (peligro != null) {
        this.empezarAHuir(peligro);              // sigue cerca: huir otra vez
      } else {
        this.ruta = null;
        this.estado = (this.luz > this.adn.luzMax * 0.8) ? VOLVER : IR_A_FLOR;   // a salvo: retoma lo suyo
      }
    }
  }

  // Un Veloz la alcanzó: pierde luz; si le queda algo, escapa
  golpeada(cantidad, cz) {
    this.luz -= cantidad;
    if (this.luz <= 0) {
      this.atrapada();
      return;
    }
    this.empezarAHuir(cz);
  }

  // La atrapó un cazador
  atrapada() {
    hadasAtrapadas++;
    this.luz = 0;
    this.ruta = null;
    this.estado = MUERTA;
  }

  // ---------- Estados ----------

  irAFlor() {
    // Si no tiene flor, o su flor se apagó (otra hada se la comió), busca otra
    if (this.florC < 0 || !florConLuz(this.florC, this.florF)) {
      this.esperaBusqueda -= DT;
      if (this.esperaBusqueda <= 0) {
        this.elegirFlor();
        this.esperaBusqueda = 1;   // si no encuentra, vuelve a intentar en 1 segundo
      }
      if (this.florC < 0) {
        // Sin flores a su alcance y con hambre: se refugia en el Árbol Madre
        if (this.luz < this.adn.luzMax * HAMBRE_REFUGIO && luzArbol > LUZ_MINIMA_ARBOL) {
          this.ruta = null;
          this.estado = REFUGIO;
          return;
        }
        this.vagar();
        return;
      }
    }
    let llego = this.irA(this.florC, this.florF, 1);
    if (this.sinCamino) {
      this.soltarFlor();            // la flor quedó encerrada: buscar otra más tarde
      this.esperaBusqueda = 1;
      return;
    }
    if (llego) this.estado = COMER;
  }

  comer() {
    if (!esFlor(this.florC, this.florF)) {         // la flor ya no existe
      this.soltarFlor();
      return;
    }
    let bocado = min(this.adn.tasaComer * DT, luzFlor[this.florC][this.florF], this.adn.luzMax - this.luz);
    luzFlor[this.florC][this.florF] -= bocado;
    this.luz += bocado;
    if (luzFlor[this.florC][this.florF] <= LUZ_MAX_FLOR * FLOR_APAGADA) apagarFlor(this.florC, this.florF);   // Modelo: se apagó

    if (this.luz >= this.adn.luzMax - 0.01) {
      // Llena: decide a dónde lleva su sobrante
      this.vaAlCapullo = random(1) < probabilidadCapullo();   // slider Reproducirse
      this.capulloDestino = capulloMasCercano(this.x, this.y);           // Modelo: el nido más cerca
      this.florC = -1;
      this.estado = VOLVER;
    } else if (!florConLuz(this.florC, this.florF)) {
      this.soltarFlor();                       // la flor se apagó y todavía tiene hambre
    }
  }

  // ---------- Refugio: el Árbol alimenta a las hadas hambrientas ----------
  // Así la luz del Árbol (la base) se convierte en supervivencia: si se gasta toda, nadie se salva.
  refugiarse() {
    let llego = this.irA(arbolCol, arbolFila, TAM_CELDA * 1.5);
    if (!llego) return;
    let disponible = max(0, luzArbol - LUZ_MINIMA_ARBOL);
    let sorbo = min(TASA_COMER * DT, disponible, this.adn.luzMax - this.luz);
    this.luz += sorbo;
    luzArbol -= sorbo;
    if (this.luz >= this.adn.luzMax * SALE_DEL_REFUGIO || disponible <= 0) {
      this.ruta = null;
      this.estado = IR_A_FLOR;
      this.esperaBusqueda = 0;
    }
  }

  volver() {
    let llego;
    if (this.vaAlCapullo && this.capulloDestino == null) this.capulloDestino = capulloMasCercano(this.x, this.y);
    if (this.vaAlCapullo) llego = this.irA(this.capulloDestino.c, this.capulloDestino.f, TAM_CELDA * 0.6);
    else             llego = this.irA(arbolCol, arbolFila, TAM_CELDA * 1.5);
    // Si no hay camino (la encerraron), irA lo vuelve a intentar cada segundo
    if (llego) {
      this.entregar();
      // Slider Cuidar: a veces, en vez de ir a comer, va a cuidar una flor
      if (random(1) < probabilidadCuidar() && this.elegirFlorParaCuidar()) this.estado = CUIDAR;
      else this.estado = IR_A_FLOR;
    }
  }

  // ---------- Cuidar ----------
  cuidarC = -1;cuidarF = -1;
  tiempoCuidando = 0;

  elegirFlorParaCuidar() {
    let flor = florParaCuidar(this.x, this.y);   // Herramientas
    if (flor == null) return false;
    this.cuidarC = flor[0];
    this.cuidarF = flor[1];
    this.tiempoCuidando = 0;
    return true;
  }

  cuidar() {
    // Ya no hace falta (rebrotó, se recargó o la aplastó un hongo), o el hada tiene hambre: a comer
    if (!necesitaCuidado(this.cuidarC, this.cuidarF) || this.luz < this.adn.gasto * 5) {   // le quedan menos de 5 s de luz
      this.terminarDeCuidar();
      return;
    }
    let llego = this.irA(this.cuidarC, this.cuidarF, 1);
    if (this.sinCamino) {
      this.terminarDeCuidar();
      return;
    }
    if (!llego) return;

    this.tiempoCuidando += DT;
    if (mundo[this.cuidarC][this.cuidarF] == FLOR_DESTRUIDA) {
      progresoRebrote[this.cuidarC][this.cuidarF] += DT / TIEMPO_REBROTE;
      if (progresoRebrote[this.cuidarC][this.cuidarF] >= 1) {
        rebrotarFlor(this.cuidarC, this.cuidarF);   // Modelo
        this.terminarDeCuidar();
        return;
      }
    } else {
      luzFlor[this.cuidarC][this.cuidarF] += LUZ_MAX_FLOR / TIEMPO_CUIDAR_RECARGA * DT;
      if (luzFlor[this.cuidarC][this.cuidarF] >= LUZ_MAX_FLOR) {
        luzFlor[this.cuidarC][this.cuidarF] = LUZ_MAX_FLOR;
        florApagada[this.cuidarC][this.cuidarF] = false;   // vuelve a encenderse
        this.terminarDeCuidar();
        return;
      }
    }
    if (this.tiempoCuidando > TIEMPO_MAX_CUIDANDO) this.terminarDeCuidar();
  }

  terminarDeCuidar() {
    this.cuidarC = -1;
    this.cuidarF = -1;
    this.ruta = null;
    this.estado = IR_A_FLOR;
  }

  // Se queda con su reserva y entrega el resto
  entregar() {
    let sobrante = max(0, this.luz - reservaHada() * this.adn.luzMax / LUZ_MAX_HADA);   // slider Alimentarse (escalado al tamaño de su barra)
    this.luz -= sobrante;
    sobrante *= this.adn.rendimiento;   // ADN: las hadas brillantes entregan luz que vale más
    if (this.vaAlCapullo) this.capulloDestino.luz += sobrante;
    else             luzArbol   += sobrante;
  }

  // ---------- Ayudas ----------

  elegirFlor() {
    let flor = florCercana(this.x, this.y);   // Herramientas
    if (flor == null) {
      this.florC = -1;
      this.florF = -1;
    } else {
      this.florC = flor[0];
      this.florF = flor[1];
    }
  }

  soltarFlor() {
    this.florC = -1;
    this.florF = -1;
    this.esperaBusqueda = 0;
    this.estado = IR_A_FLOR;
  }

  // Sin flores con luz: da vueltas cerca del Árbol esperando que se recarguen
  vagar() {
    let llego = this.irA(this.vagarC, this.vagarF, 2);
    if (llego || this.sinCamino || !transitable(this.vagarC, this.vagarF)) {
      this.vagarC = arbolCol + int(random(-6, 7));
      this.vagarF = arbolFila + int(random(-6, 7));
    }
  }

  // ---------- Movimiento con A* ----------
  // Lleva al hada hasta el centro de la celda (c, f) siguiendo la ruta de A*.
  // Devuelve true cuando llegó (a menos de "radio" píxeles).
  // Si no hay camino, deja sinCamino = true y devuelve false.
  irA(c, f, radio) {
    let tx = centroX(c);
    let ty = centroY(f);
    if (dist(this.x, this.y, tx, ty) <= radio) {
      this.ruta = null;
      this.sinCamino = false;
      return true;
    }

    // ¿Hay que calcular una ruta nueva?
    let recalcular = (this.ruta == null || c != this.rutaC || f != this.rutaF);
    if (!recalcular && this.versionRuta != versionMapa) {
      // Cambió un obstáculo: solo recalcula si su camino quedó bloqueado
      recalcular = this.rutaBloqueada();
      this.versionRuta = versionMapa;
    }

    if (recalcular) {
      if (this.esperaRuta > 0 && c == this.rutaC && f == this.rutaF) {   // falló hace poco con este mismo destino
        this.esperaRuta -= DT;
        return false;
      }
      this.ruta = aEstrella(celdaX(this.x), celdaY(this.y), c, f);       // Herramientas
      this.rutaC = c;
      this.rutaF = f;
      this.versionRuta = versionMapa;
      this.paso = 0;
      if (this.ruta == null) {
        this.sinCamino = true;
        this.esperaRuta = 1;
        return false;
      }
      this.sinCamino = false;
      if (this.ruta.size() == 0) this.ruta.add(createVector(tx, ty));   // ya estaba en la celda destino
    }

    // Seguir la ruta punto por punto
    let punto = this.ruta.get(this.paso);
    if (this.moverHacia(punto.x, punto.y, 0.5)) {
      this.paso++;
      if (this.paso >= this.ruta.size()) {
        this.ruta = null;
        return dist(this.x, this.y, tx, ty) <= radio + TAM_CELDA;
      }
    }
    return false;
  }

  // ¿Alguna celda que le falta recorrer se volvió hongo?
  rutaBloqueada() {
    for (let i = this.paso; i < this.ruta.size(); i++) {
      let p = this.ruta.get(i);
      if (!transitable(celdaX(p.x), celdaY(p.y))) return true;
    }
    return false;
  }

  // Vuela en línea recta hasta un punto (se usa entre punto y punto de la ruta).
  // Devuelve true cuando llegó (está a menos de "radio" píxeles).
  moverHacia(tx, ty, radio) {
    let d = dist(this.x, this.y, tx, ty);
    if (d <= radio) return true;
    let paso = this.adn.velocidad * DT;
    if (paso >= d) {
      this.x = tx;
      this.y = ty;
      return true;
    }
    this.x += (tx - this.x) / d * paso;
    this.y += (ty - this.y) / d * paso;
    return false;
  }

  porcentajeLuz() {
    return this.luz / this.adn.luzMax;
  }

  // Lo que ven los cazadores: más luz guardada y más gen de brillo = se ve de más lejos
  brillo() {
    return this.luz * this.adn.visibilidad;
  }
}

// ==================================================
// CONTINGENCIAS: los cazadores
// ==================================================
//   VELOZ (A*)          -> va directo al hada más brillante. Rápido, pero un hongo
//                          en su camino lo deja confundido y la niebla lo frena.
//   TRAMPERO (Dijkstra) -> no ataca hadas: busca la flor más barata de alcanzar
//                          (esquiva la niebla) y la DESTRUYE (queda un brote).
//                          Las hadas en "Cuidar" la hacen rebrotar.
//   RASTREADOR (BFS)    -> persigue al hada más brillante recalculando todo el tiempo.
//                          Lento, pero siempre la encuentra. Se lo distrae con faroles.
// Los que persiguen luz prefieren un farol a cualquier hada.
// Si el Guardián los encierra con hongos, desaparecen.

function actualizarCazadores() {
  for (const cz of cazadores) cz.actualizar();
  for (let i = cazadores.size() - 1; i >= 0; i--) {
    if (cazadores.get(i).terminado()) cazadores.remove(i);
  }
}

function actualizarFaroles() {
  for (let i = faroles.size() - 1; i >= 0; i--) {
    let fa = faroles.get(i);
    fa.restante -= DT;
    if (fa.restante <= 0) faroles.remove(i);
  }
}

function cazadoresActivos() {
  let n = 0;
  for (const cz of cazadores) if (cz.activo()) n++;
  return n;
}

function contarCazadores(tipo) {
  let n = 0;
  for (const cz of cazadores) if (cz.activo() && cz.tipo == tipo) n++;
  return n;
}

// Aparece en un borde del mapa. Devuelve null si ya hay demasiados.
// "nocturno" = apareció durante la amenaza (se va cuando termina);
// si no, apareció de día (se va al anochecer).
function aparecerCazador(tipo) {
  return aparecerCazador(tipo, false);
}

// sinTope = true: los cazadores que envía otro jugador llegan aunque el bosque ya tenga MAX_CAZADORES
function aparecerCazador(tipo, sinTope) {
  if (!sinTope && cazadoresActivos() >= MAX_CAZADORES) return null;
  let p = puntoDeAparicion();
  if (p == null) return null;
  let nuevo = new Cazador(tipo, p.x, p.y);
  nuevo.nocturno = (fase == AMENAZA);
  nuevo.fuerza = fuerzaCazadores(ronda);   // también se vuelven más rápidos con las rondas
  cazadores.add(nuevo);
  return nuevo;
}

// Un punto libre en el borde del mapa (en píxeles del mundo), o null si no encuentra
function puntoDeAparicion() {
  for (let intento = 0; intento < 300; intento++) {
    let c, f;
    if (random(1) < 0.5) {
      c = random(1) < 0.5 ? 0 : COLUMNAS - 1;
      f = int(random(FILAS));
    } else {
      c = int(random(COLUMNAS));
      f = random(1) < 0.5 ? 0 : FILAS - 1;
    }
    if (!transitable(c, f) || mundo[c][f] == NIEBLA) continue;
    if (contarRegion(c, f, REGION_ENCERRADO) < REGION_ENCERRADO) continue;   // no aparecer encerrado
    return createVector(centroX(c), centroY(f));
  }
  return null;
}

// El cazador más cercano que persigue hadas (Veloz o Rastreador), dentro de un radio en píxeles
function cazadorCercano(x, y, radio) {
  let mejor = null;
  let mejorDist = radio;
  for (const cz of cazadores) {
    if (!cz.activo() || cz.tipo == TRAMPERO) continue;
    let d = dist(x, y, cz.x, cz.y);
    if (d < mejorDist) {
      mejorDist = d;
      mejor = cz;
    }
  }
  return mejor;
}

function nombreCazador(tipo) {
  if (tipo == VELOZ) return "Veloz (A*)";
  if (tipo == TRAMPERO) return "Trampero (Dijkstra)";
  return "Rastreador (BFS)";
}

class Cazador {
  tipo = 0;
  x = 0;y = 0;
  nocturno = true;      // apareció de noche (huye al amanecer)
  fuerza = 1;             // multiplica su velocidad: crece con cada ronda
  tiempoPersiguiendo = 0; // segundos detrás de la misma hada
  hadaPerdida = null;      // el hada que se le escapó (el Rastreador ya no la busca)
  enviadoPor = "";       // si lo mandó otro jugador (Red), su nombre
  pausa = 0;              // > 0: está confundido (Veloz) y no se mueve
  esperaReplan = 0;       // segundos hasta recalcular la ruta
  encerrado = false;    // el Guardián lo encerró con hongos
  tiempoEncerrado = 0;
  retirandose = false;  // se le acabó el tiempo: se desvanece
  alfa = 1;               // opacidad al dibujarlo
  atrapadas = 0;            // hadas que apagó (o flores, el Trampero)

  ruta = null;
  paso = 0;
  versionRuta = -1;

  objetivoHada = null;     // a quién persigue (Veloz y Rastreador)
  objetivoFarol = null;   // ...o qué farol lo distrajo
  florC = -1;florF = -1;   // qué flor va a destruir (Trampero)

  constructor(tipo, x, y) {
    this.tipo = tipo;
    this.x = x;
    this.y = y;
  }

  activo() { return !this.encerrado && !this.retirandose; }
  terminado() { return this.retirandose && this.alfa <= 0; }
  confundido() { return this.pausa > 0; }
  retirarse() { this.retirandose = true; }   // al amanecer se van, aunque estén encerrados

  actualizar() {
    if (this.retirandose) {
      this.alfa -= DT / 2;
      return;
    }
    // Encerrado entre hongos: queda atrapado (no se mueve ni ataca), pero no muere.
    // Cuando un hongo desaparece y se abre el paso, vuelve a cazar.
    if (this.encerrado) {
      this.tiempoEncerrado += DT;
      if (this.versionRuta != versionMapa) {
        this.versionRuta = versionMapa;
        if (contarRegion(celdaX(this.x), celdaY(this.y), REGION_ENCERRADO) >= REGION_ENCERRADO) {
          this.encerrado = false;
          this.tiempoEncerrado = 0;
          this.ruta = null;
          this.esperaReplan = 0;
          this.florC = -1;
        }
      }
      return;
    }
    if (this.pausa > 0) {
      this.pausa -= DT;
      return;
    }
    if (this.tipo == TRAMPERO) this.destruirFlores();
    else this.perseguir();
  }

  // ---------- Veloz y Rastreador ----------

  perseguir() {
    // ¿Llegó al Árbol Madre? Le roba luz y desaparece (como un enemigo que llega a la base)
    if (dist(this.x, this.y, centroX(arbolCol), centroY(arbolFila)) < RADIO_ROBO * TAM_CELDA) {
      this.robarAlArbol();
      return;
    }
    if (!this.objetivoValido()) {
      this.elegirObjetivo();
      this.esperaReplan = 0;
    }

    // El Rastreador se cansa: si el hada huye bien durante un rato, la deja ir
    if (this.objetivoHada != null) {
      this.tiempoPersiguiendo += DT;
      if (this.tipo == RASTREADOR && this.tiempoPersiguiendo > CANSANCIO_RASTREADOR) {
        this.hadaPerdida = this.objetivoHada;
        this.objetivoHada = null;
        this.ruta = null;
        this.esperaReplan = 0;
      }
    }

    // ¿Atrapó al hada?
    if (this.objetivoHada != null && dist(this.x, this.y, this.objetivoHada.x, this.objetivoHada.y) < RADIO_ATRAPAR * TAM_CELDA) {
      if (this.tipo == VELOZ) {
        // El Veloz le roba un golpe de luz: si el hada guardaba suficiente (Alimentarse), sobrevive y huye
        this.objetivoHada.golpeada(GOLPE_VELOZ * this.fuerza, this);
        this.pausa = PAUSA_GOLPE;
      } else {
        this.objetivoHada.atrapada();   // el Rastreador la apaga
      }
      this.atrapadas++;
      this.objetivoHada = null;
      this.ruta = null;
      return;
    }

    // ¿Un hongo le cortó el camino?
    if (this.ruta != null && this.versionRuta != versionMapa) {
      this.versionRuta = versionMapa;
      if (this.rutaBloqueada()) {
        this.ruta = null;
        if (this.tipo == VELOZ) {
          this.pausa = PAUSA_VELOZ;    // el Veloz se confunde
          return;
        }
        this.esperaReplan = 0;         // el Rastreador recalcula en el acto
      }
    }

    // Recalcular cada cierto tiempo o al terminar la ruta
    this.esperaReplan -= DT;
    if (this.esperaReplan <= 0 || (this.ruta != null && this.paso >= this.ruta.size())) {
      this.elegirObjetivo();           // vuelve a mirar qué luz tiene a la vista
      let metaC = arbolCol;       // si no ve a nadie, marcha hacia el Árbol
      let metaF = arbolFila;
      if (this.objetivoHada != null || this.objetivoFarol != null) {
        metaC = celdaX(this.objetivoX());
        metaF = celdaY(this.objetivoY());
      }
      if (this.tipo == VELOZ) this.ruta = aEstrella(celdaX(this.x), celdaY(this.y), metaC, metaF);   // Herramientas
      else               this.ruta = bfs(celdaX(this.x), celdaY(this.y), metaC, metaF);         // Herramientas
      this.paso = 0;
      this.versionRuta = versionMapa;
      this.esperaReplan = (this.tipo == VELOZ) ? REPLANEAR_VELOZ : REPLANEAR_RASTREADOR;
      if (this.ruta == null) {
        this.revisarSiEstaEncerrado();
        this.esperaReplan = 1;
        return;
      }
    }
    this.seguirRuta();
  }

  // Hasta dónde ve una luz de cierto brillo (en píxeles)
  radioVision(brillo) {
    return brillo * VISION_POR_BRILLO * TAM_CELDA;
  }

  // Elige la luz más fuerte QUE ALCANZA A VER: un farol o un hada.
  // Las hadas con poca luz brillan poco y pasan desapercibidas.
  elegirObjetivo() {
    // Un farol a la vista siempre gana: es el señuelo del Guardián
    let farolCerca = null;
    let dFarol = Number.MAX_VALUE;
    for (const fa of faroles) {
      let d = dist(this.x, this.y, centroX(fa.c), centroY(fa.f));
      if (d < this.radioVision(BRILLO_FAROL) && d < dFarol) {
        dFarol = d;
        farolCerca = fa;
      }
    }
    if (farolCerca != null) {
      this.objetivoFarol = farolCerca;
      this.objetivoHada = null;
      return;
    }
    this.objetivoFarol = null;

    if (this.objetivoHada != null && this.objetivoHada.estado != MUERTA) {
      // El Rastreador no suelta a su presa (hasta que se cansa: ver perseguir)
      if (this.tipo == RASTREADOR) return;
      // El Veloz la sigue mientras no se le escape de la vista
      let d = dist(this.x, this.y, this.objetivoHada.x, this.objetivoHada.y);
      if (d < this.radioVision(this.objetivoHada.brillo()) * VISION_PERDER) return;
    }

    this.objetivoHada = null;
    this.tiempoPersiguiendo = 0;
    let mejorBrillo = -1;
    for (const h of hadas) {
      if (h.estado == MUERTA || h == this.hadaPerdida) continue;
      let b = h.brillo();
      if (dist(this.x, this.y, h.x, h.y) > this.radioVision(b)) continue;   // no la alcanza a ver
      if (b > mejorBrillo) {
        mejorBrillo = b;
        this.objetivoHada = h;
      }
    }
  }

  // Llegó a la base: le roba luz al Árbol y se desvanece
  robarAlArbol() {
    let robo = ROBO_CAZADOR * this.fuerza;
    luzArbol = max(0, luzArbol - robo);   // no baja de 0
    this.retirandose = true;
    mostrarMensaje("¡Un " + nombreCortoCazador(this.tipo) + " le robó " + round(robo) + " de luz al Árbol!");   // Interfaz
  }

  objetivoValido() {
    if (this.objetivoFarol != null) return faroles.contains(this.objetivoFarol);
    if (this.objetivoHada != null) return this.objetivoHada.estado != MUERTA;
    return false;
  }

  objetivoX() { return this.objetivoFarol != null ? centroX(this.objetivoFarol.c) : this.objetivoHada.x; }
  objetivoY() { return this.objetivoFarol != null ? centroY(this.objetivoFarol.f) : this.objetivoHada.y; }

  // ---------- Trampero ----------

  destruirFlores() {
    // Su flor ya se apagó (se la comieron o la aplastó un hongo): buscar otra
    if (this.florC >= 0 && !florConLuz(this.florC, this.florF)) {
      this.florC = -1;
      this.ruta = null;
    }
    // ¿Un hongo le cortó el camino? Busca otra flor
    if (this.ruta != null && this.versionRuta != versionMapa) {
      this.versionRuta = versionMapa;
      if (this.rutaBloqueada()) {
        this.florC = -1;
        this.ruta = null;
        this.esperaReplan = 0;
      }
    }
    if (this.florC < 0) {
      this.esperaReplan -= DT;
      if (this.esperaReplan > 0) return;
      this.ruta = dijkstraAFlor(celdaX(this.x), celdaY(this.y));   // Herramientas
      this.paso = 0;
      this.versionRuta = versionMapa;
      if (this.ruta == null) {
        this.revisarSiEstaEncerrado();
        this.esperaReplan = 1;
        return;
      }
      if (this.ruta.size() == 0) {
        this.florC = celdaX(this.x);
        this.florF = celdaY(this.y);
      } else {
        let ultimo = this.ruta.get(this.ruta.size() - 1);
        this.florC = celdaX(ultimo.x);
        this.florF = celdaY(ultimo.y);
      }
    }
    // Llegó: le va sacando la luz hasta apagarla
    if (dist(this.x, this.y, centroX(this.florC), centroY(this.florF)) < TAM_CELDA * 0.6) {
      luzFlor[this.florC][this.florF] -= LUZ_MAX_FLOR / TIEMPO_DESTRUIR_FLOR * DT;
      if (luzFlor[this.florC][this.florF] <= 0) {
        // Modelo: queda solo el brote, y la trampa alcanza a las flores vecinas
        for (let dc = -RADIO_TRAMPA; dc <= RADIO_TRAMPA; dc++)
          for (let df = -RADIO_TRAMPA; df <= RADIO_TRAMPA; df++)
            if (esFlor(this.florC + dc, this.florF + df)) destruirFlor(this.florC + dc, this.florF + df);
        this.atrapadas++;
        this.florC = -1;
        this.ruta = null;
        this.esperaReplan = 0.5;
      }
      return;
    }
    this.seguirRuta();
  }

  // ---------- Movimiento ----------

  seguirRuta() {
    if (this.ruta == null || this.paso >= this.ruta.size()) return;
    let p = this.ruta.get(this.paso);
    let paso1 = this.velocidad() * DT;
    let d = dist(this.x, this.y, p.x, p.y);
    if (d <= paso1) {
      this.x = p.x;
      this.y = p.y;
      this.paso++;
    } else {
      this.x += (p.x - this.x) / d * paso1;
      this.y += (p.y - this.y) / d * paso1;
    }
  }

  velocidad() {
    let v = (this.tipo == VELOZ) ? VELOCIDAD_VELOZ : (this.tipo == TRAMPERO) ? VELOCIDAD_TRAMPERO : VELOCIDAD_RASTREADOR;
    if (this.tipo != TRAMPERO && celda(celdaX(this.x), celdaY(this.y)) == NIEBLA) v *= FRENO_NIEBLA;   // la niebla frena
    return v * this.fuerza;
  }

  rutaBloqueada() {
    for (let i = this.paso; i < this.ruta.size(); i++) {
      let p = this.ruta.get(i);
      if (!transitable(celdaX(p.x), celdaY(p.y))) return true;
    }
    return false;
  }

  // Si no encontró camino, puede ser porque está encerrado entre hongos
  revisarSiEstaEncerrado() {
    if (contarRegion(celdaX(this.x), celdaY(this.y), REGION_ENCERRADO) < REGION_ENCERRADO) {
      this.encerrado = true;
      this.versionRuta = versionMapa;
      this.ruta = null;
    }
  }
}

// ==================================================
// DÍA Y NOCHE (paso 6)
// ==================================================
// Día (CALMA): se recoge luz y se preparan defensas. Desde el día 2 un Trampero
//              ataca las flores (y uno más cada 3 días).
// Noche (AMENAZA): llegan los cazadores en tandas desde un mismo punto del borde,
//              las flores se recargan lento y abren las flores de luna.
//              Al amanecer, los cazadores de la noche huyen.
// Dificultad incremental (como un tower defense): ver Globales.

const CALMA = 0, AMENAZA = 1;
let fase = CALMA;
let ronda = 1;
let tiempoFase = 0;       // segundos desde que empezó la fase
let duracionFase = 0;
let cazadoresPorAparecer = 0;   // cazadores de esta noche que todavía no llegaron
let esperaTanda = 0;          // segundos hasta la próxima tanda
let intervaloTanda = 0;       // segundos entre tandas en esta noche
let avisoAnochecer = false; // ya se avisó que la noche está por llegar
let tipoNoche = NOCHE_RASTREADORES;   // qué trae la próxima noche (se anuncia de día)

// ---------- Cómo crece la dificultad (n = número de ronda) ----------
function duracionDia(n) { return max(DIA_MINIMO, DIA_BASE - DIA_MENOS * (n - 1)); }
function duracionNoche(n) { return min(NOCHE_MAXIMA, NOCHE_BASE + NOCHE_MAS * (n - 1)); }
function cazadoresDeLaNoche(n) { return CAZADORES_NOCHE_BASE + CAZADORES_NOCHE_MAS * (n - 1); }
function tamanoTanda(n) { return 1 + floor((n - 1) / 2); }                       // 1, 1, 2, 2, 3, 3...
function tandasDeLaNoche(n) { return ceil(cazadoresDeLaNoche(n) / tamanoTanda(n)); }
function fuerzaCazadores(n) { return 1 + min(VELOCIDAD_EXTRA_MAX, VELOCIDAD_POR_NOCHE * (n - 1)); }
function tramperosDeDia(n) { return n < 2 ? 0 : 1 + floor((n - 2) / 3); }           // día 2-4: 1, día 5-7: 2...

function iniciarFases() {
  ronda = 1;
  tipoNoche = -1;
  empezarFase(CALMA);
}

// ---------- Tipos de noche ----------
function elegirTipoNoche(n, anterior) {
  if (n == 1) return NOCHE_RASTREADORES;
  if (n == 2) return NOCHE_VELOCES;
  if (n == 3) return NOCHE_TRAMPEROS;
  if (n >= 5 && anterior != NOCHE_MIXTA && random(1) < PROB_NOCHE_MIXTA) return NOCHE_MIXTA;
  let t;
  do { t = int(random(3)); } while (t == anterior);   // no repetir la anterior
  return t;
}

function nombreTipoNoche(t) {
  if (t == NOCHE_RASTREADORES) return "Rastreadores";
  if (t == NOCHE_VELOCES)      return "Veloces";
  if (t == NOCHE_TRAMPEROS)    return "Tramperos";
  return "de todo tipo";
}

// Una pista de cómo es cada noche (no dice qué prioridad poner: eso lo decide el jugador)
function pistaTipoNoche(t) {
  if (t == NOCHE_RASTREADORES) return "casi tan rápidos como las hadas: solo escapan las que huyen a tiempo";
  if (t == NOCHE_VELOCES)      return "más rápidos que las hadas: cada golpe les quita " + int(GOLPE_VELOZ) + " de luz";
  if (t == NOCHE_TRAMPEROS)    return "no cazan hadas: destruyen las flores";
  return "llegan cazadores de todos los tipos";
}

function actualizarFases() {
  tiempoFase += DT;

  // Noche: los cazadores llegan en tandas
  if (fase == AMENAZA && cazadoresPorAparecer > 0) {
    esperaTanda -= DT;
    if (esperaTanda <= 0) {
      let pedidos = min(tamanoTanda(ronda), cazadoresPorAparecer);
      let llegaron = soltarTanda(pedidos);
      cazadoresPorAparecer -= llegaron;
      // Si el bosque está lleno (MAX_CAZADORES), los que faltan esperan y lo intentan en 1 s
      esperaTanda = (llegaron < pedidos) ? 1 : intervaloTanda;
    }
  }

  // Día: avisar 5 segundos antes de que anochezca
  if (fase == CALMA && !avisoAnochecer && segundosRestantesFase() <= 5) {
    avisoAnochecer = true;
    mostrarAviso("Anochece en 5 s: llegan " + cazadoresDeLaNoche(ronda) + " " + nombreTipoNoche(tipoNoche), 2500);   // Interfaz
  }

  if (tiempoFase >= duracionFase) {
    if (fase == CALMA) {
      empezarFase(AMENAZA);
    } else {
      ronda++;
      empezarFase(CALMA);
    }
  }
}

function empezarFase(nueva) {
  if (nueva == CALMA) {
    // Amanece: los cazadores de la noche huyen del sol
    for (const cz of cazadores) if (cz.nocturno) cz.retirarse();
    quitarFloresLuna();   // Modelo
  } else {
    // Anochece: los Tramperos de día se van
    for (const cz of cazadores) if (!cz.nocturno) cz.retirarse();
  }

  fase = nueva;
  tiempoFase = 0;
  avisoAnochecer = false;

  if (nueva == CALMA) {
    duracionFase = duracionDia(ronda);
    cazadoresPorAparecer = 0;
    for (let i = 0; i < tramperosDeDia(ronda); i++) aparecerCazador(TRAMPERO);
    // Se decide y se anuncia qué trae la noche, para que el jugador se prepare
    let primerDia = (tipoNoche < 0);
    tipoNoche = elegirTipoNoche(ronda, tipoNoche);
    if (!primerDia) mostrarAviso("Amanece. Esta noche: " + nombreTipoNoche(tipoNoche) + " (" + pistaTipoNoche(tipoNoche) + ")", 5000);   // Interfaz
  } else {
    duracionFase = duracionNoche(ronda);
    cazadoresPorAparecer = cazadoresDeLaNoche(ronda);
    intervaloTanda = duracionFase * PARTE_NOCHE_CON_TANDAS / tandasDeLaNoche(ronda);
    esperaTanda = 2;   // la primera tanda llega a los 2 s
    soltarCazadoresEnviados();   // Red: llegan los cazadores que mandaron otros jugadores
    ponerFloresLuna(FLORES_LUNA_BASE + FLORES_LUNA_POR_RONDA * (ronda - 1));   // Modelo
    mostrarAviso("¡Noche " + ronda + ": " + nombreTipoNoche(tipoNoche) + "! Llegan " + cazadoresPorAparecer + " en " + tandasDeLaNoche(ronda) + " tandas", 3500);   // Interfaz
  }
}

// Una tanda: varios cazadores que entran juntos por el mismo punto del borde.
// Devuelve cuántos llegaron (menos si el bosque ya tiene MAX_CAZADORES).
function soltarTanda(cantidad) {
  let entrada = puntoDeAparicion();
  if (entrada == null) return 0;
  let llegaron = 0;
  for (let i = 0; i < cantidad; i++) {
    if (cazadoresActivos() >= MAX_CAZADORES) break;
    let nuevo = new Cazador(tipoDeLaNoche(ronda), entrada.x + random(-5, 5), entrada.y + random(-5, 5));
    nuevo.nocturno = true;
    nuevo.fuerza = fuerzaCazadores(ronda);
    cazadores.add(nuevo);
    llegaron++;
  }
  return llegaron;
}

// Qué cazador llega según el tipo de noche (la mayoría es del tipo anunciado)
function tipoDeLaNoche(n) {
  let r = random(1);
  if (tipoNoche == NOCHE_RASTREADORES) return (n >= 4 && r < 0.15) ? VELOZ : RASTREADOR;
  if (tipoNoche == NOCHE_VELOCES)      return r < 0.8 ? VELOZ : RASTREADOR;
  if (tipoNoche == NOCHE_TRAMPEROS)    return r < 0.65 ? TRAMPERO : RASTREADOR;
  return tipoAlAzar();
}

// El Trampero es menos frecuente porque destruye flores para siempre
function tipoAlAzar() {
  if (random(1) < PROB_TRAMPERO) return TRAMPERO;
  return random(1) < 0.5 ? VELOZ : RASTREADOR;
}

function esDeNoche() {
  return fase == AMENAZA;
}

function segundosRestantesFase() {
  return max(0, duracionFase - tiempoFase);
}

function nombreFase() {
  return fase == CALMA ? "Día " + ronda : "Noche " + ronda;
}
