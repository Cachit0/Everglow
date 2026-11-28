// ==================================================
// COMPAT: lo que Java/Processing traía "de fábrica" y JavaScript no
// ==================================================
// Así el resto del código se parece lo más posible al de Processing (Java):
//   lista.add(x), lista.get(i), lista.size(), lista.remove(i), texto.equals(otro)...
// Este archivo se carga primero (ver index.html).

// ---------- Arreglos ----------
// new int[n]         -> arreglo(n, 0)
// new int[ancho][alto] -> matriz(ancho, alto, 0)
function arreglo(n, valor) {
  return new Array(n).fill(valor);
}

function matriz(ancho, alto, valor) {
  const m = new Array(ancho);
  for (let i = 0; i < ancho; i++) m[i] = new Array(alto).fill(valor);
  return m;
}

// ---------- ArrayList -> Array ----------
function agregarMetodo(clase, nombre, funcion) {
  // enumerable: false = no aparece al recorrer el arreglo con for...in
  Object.defineProperty(clase.prototype, nombre, { value: funcion, writable: true, configurable: true, enumerable: false });
}

agregarMetodo(Array, "add", function (a, b) {
  if (b === undefined) this.push(a);   // add(x)
  else this.splice(a, 0, b);           // add(indice, x)
  return true;
});
agregarMetodo(Array, "get", function (i) { return this[i]; });
agregarMetodo(Array, "set", function (i, v) { this[i] = v; return v; });
agregarMetodo(Array, "size", function () { return this.length; });
agregarMetodo(Array, "isEmpty", function () { return this.length === 0; });
agregarMetodo(Array, "clear", function () { this.length = 0; });
agregarMetodo(Array, "contains", function (x) { return this.includes(x); });
// remove(indice) o remove(objeto), como en Java
agregarMetodo(Array, "remove", function (x) {
  const i = (typeof x === "number") ? x : this.indexOf(x);
  if (i < 0 || i >= this.length) return null;
  return this.splice(i, 1)[0];
});

// ---------- HashSet / HashMap ----------
agregarMetodo(Set, "contains", function (x) { return this.has(x); });
agregarMetodo(Set, "retainAll", function (coleccion) {
  const quedan = new Set(coleccion);
  for (const x of [...this]) if (!quedan.has(x)) this.delete(x);
});
agregarMetodo(Map, "put", function (k, v) { this.set(k, v); return v; });
agregarMetodo(Map, "containsKey", function (k) { return this.has(k); });
agregarMetodo(Map, "retainKeys", function (coleccion) {
  const quedan = new Set(coleccion);
  for (const k of [...this.keys()]) if (!quedan.has(k)) this.delete(k);
});

// ---------- String ----------
agregarMetodo(String, "equals", function (otro) { return this.valueOf() === otro; });
agregarMetodo(String, "contains", function (x) { return this.includes(x); });
agregarMetodo(String, "isEmpty", function () { return this.length === 0; });

// ---------- Números y letras ----------
const Float = {
  MAX_VALUE: Number.MAX_VALUE,
  compare: (a, b) => (a < b ? -1 : (a > b ? 1 : 0))
};

const Character = {
  isLetterOrDigit: (c) => /^[\p{L}\p{N}]$/u.test(c)
};

// ---------- java.util.Random (con semilla) ----------
// Misma semilla = misma secuencia. Se usa para que cada hada tenga su ADN fijo.
class AleatorioJava {
  constructor(semilla) {
    this.estado = (Math.floor(semilla) ^ 0x9E3779B9) >>> 0;
    this.gaussGuardado = null;
  }
  // número entre 0 y 1 (algoritmo mulberry32)
  nextFloat() {
    let t = (this.estado += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(n) {
    return Math.floor(this.nextFloat() * n);
  }
  // número con distribución normal (media 0, desviación 1)
  nextGaussian() {
    if (this.gaussGuardado !== null) {
      const g = this.gaussGuardado;
      this.gaussGuardado = null;
      return g;
    }
    let u, v, s;
    do {
      u = this.nextFloat() * 2 - 1;
      v = this.nextFloat() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    this.gaussGuardado = v * m;
    return u * m;
  }
}

// ---------- PriorityQueue (la usan A* y Dijkstra en Herramientas) ----------
// Montículo binario: poll() saca siempre el nodo de menor prioridad.
class PriorityQueue {
  constructor() {
    this.datos = [];
  }
  menor(a, b) {
    return this.datos[a].compareTo(this.datos[b]) < 0;
  }
  add(nodo) {
    const d = this.datos;
    d.push(nodo);
    let i = d.length - 1;
    while (i > 0) {
      const padre = (i - 1) >> 1;
      if (!this.menor(i, padre)) break;
      [d[i], d[padre]] = [d[padre], d[i]];
      i = padre;
    }
    return true;
  }
  poll() {
    const d = this.datos;
    if (d.length === 0) return null;
    const arriba = d[0];
    const ultimo = d.pop();
    if (d.length > 0) {
      d[0] = ultimo;
      let i = 0;
      while (true) {
        const izq = 2 * i + 1, der = izq + 1;
        let m = i;
        if (izq < d.length && this.menor(izq, m)) m = izq;
        if (der < d.length && this.menor(der, m)) m = der;
        if (m === i) break;
        [d[i], d[m]] = [d[m], d[i]];
        i = m;
      }
    }
    return arriba;
  }
  isEmpty() { return this.datos.length === 0; }
  size() { return this.datos.length; }
}

// ---------- Colores con transparencia ----------
// En Processing se puede escribir fill(COLOR_HADA, 120). En p5.js, fill() con un
// color y una transparencia no existe: aquí se agrega, igual que en stroke() y tint().
function permitirColorConAlfa(nombre) {
  const original = p5.prototype[nombre];
  p5.prototype[nombre] = function (...args) {
    if (args.length === 2 && args[0] instanceof p5.Color) {
      const c = args[0];
      return original.call(this, red(c), green(c), blue(c), args[1]);
    }
    return original.apply(this, args);
  };
}
permitirColorConAlfa("fill");
permitirColorConAlfa("stroke");
permitirColorConAlfa("color");   // color(COLOR_HADA, 120) = el mismo color con transparencia

// ---------- tint() rápido ----------
// En el juego casi siempre se usa tint(255, alfa): solo hacer la imagen transparente.
// p5.js hace eso muy lento (recalcula la imagen cada vez), así que aquí se usa
// la transparencia del lienzo, que es instantánea. Los otros tint() siguen igual.
const tintOriginal = p5.prototype.tint;
const noTintOriginal = p5.prototype.noTint;
const imageOriginal = p5.prototype.image;

p5.prototype.tint = function (...args) {
  if (args.length === 2 && args[0] === 255 && typeof args[1] === "number") {
    noTintOriginal.call(this);
    this._alfaDeImagen = constrain(args[1], 0, 255) / 255;
    return;
  }
  this._alfaDeImagen = null;
  if (args.length === 2 && args[0] instanceof p5.Color) {
    const c = args[0];
    return tintOriginal.call(this, red(c), green(c), blue(c), args[1]);
  }
  return tintOriginal.apply(this, args);
};

p5.prototype.noTint = function () {
  this._alfaDeImagen = null;
  return noTintOriginal.call(this);
};

p5.prototype.image = function (...args) {
  if (this._alfaDeImagen == null) return imageOriginal.apply(this, args);
  const ctx = this.drawingContext;
  const antes = ctx.globalAlpha;
  ctx.globalAlpha = antes * this._alfaDeImagen;
  imageOriginal.apply(this, args);
  ctx.globalAlpha = antes;
};

// ---------- Teclas como en Processing ----------
// Processing usa key == CODED para las flechas y ESC para la tecla Escape.
// Main traduce la tecla de p5 a estos valores (ver traducirTecla en Main).
const CODED = 65535;
const ESC = 27;

// ---------- JSONObject (como el de Processing) ----------
// Envuelve un objeto de JavaScript para poder escribir datos.getString("nombre", "")
class JSONObject {
  constructor(datos) {
    this.datos = datos || {};
  }
  hasKey(k) { return Object.prototype.hasOwnProperty.call(this.datos, k) && this.datos[k] != null; }
  leer(k, porDefecto) { return this.hasKey(k) ? this.datos[k] : porDefecto; }
  getString(k, porDefecto = "") { return String(this.leer(k, porDefecto)); }
  getInt(k, porDefecto = 0) { return Math.trunc(Number(this.leer(k, porDefecto))); }
  getLong(k, porDefecto = 0) { return this.getInt(k, porDefecto); }
  getFloat(k, porDefecto = 0) { return Number(this.leer(k, porDefecto)); }
  getBoolean(k, porDefecto = false) { return this.leer(k, porDefecto) === true; }
  setBoolean(k, v) { this.datos[k] = (v == true); return this; }
  getJSONObject(k) {
    const v = this.datos[k];
    return (v != null && typeof v === "object") ? new JSONObject(v) : null;
  }
  setString(k, v) { this.datos[k] = String(v); return this; }
  setInt(k, v) { this.datos[k] = Math.trunc(v); return this; }
  setLong(k, v) { return this.setInt(k, v); }
  setFloat(k, v) { this.datos[k] = v; return this; }
  setJSONObject(k, o) { this.datos[k] = o.datos; return this; }
  keys() { return Object.keys(this.datos); }
  toString() { return JSON.stringify(this.datos); }
}

function parseJSONObject(texto) {
  try {
    const v = JSON.parse(texto);
    return (v != null && typeof v === "object") ? new JSONObject(v) : null;
  } catch (e) {
    return null;
  }
}
