#!/usr/bin/env node
/**
 * Comprueba que cada enlace de datos/juegos.json responde.
 *
 * Uso: node scripts/comprobar-enlaces.mjs [datos/juegos.json] [informe.md]
 *
 * - Abre cada dirección distinta (ficha, página del autor y código) con una petición GET normal, despacio y sin
 *   insistir sobre el mismo sitio (algunos, como itch.io, limitan las peticiones seguidas).
 * - Un enlace cuenta como roto si, tras tres intentos, responde con un error (400 o más) o no responde.
 * - Si un sitio contesta «429 Too Many Requests» aunque esperemos, el enlace queda «sin comprobar»: no es un enlace
 *   roto, y se vuelve a intentar en la siguiente comprobación.
 * - Escribe un informe en Markdown (segundo argumento) y, en GitHub Actions, los totales en GITHUB_OUTPUT
 *   (`rotos`, `sin_comprobar`, `total`).
 * - NUNCA modifica la lista: solo lee el archivo y avisa.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const RUTA_DATOS = process.argv[2] ?? 'datos/juegos.json';
const RUTA_INFORME = process.argv[3] ?? 'enlaces-informe.md';
const INTENTOS = 3;
const ESPERA_ENTRE_INTENTOS_MS = [3000, 8000];
const ESPERA_TRAS_429_MS = [12000, 30000];
const PAUSA_ENTRE_ENLACES_MS = 400;
const PAUSA_MISMO_SITIO_MS = 3500;
const TIEMPO_MAXIMO_MS = 25000;
const USER_AGENT = 'juegos-retro-libres (comprobacion mensual de enlaces; +https://github.com/stefanopisani91/juegos-retro-libres)';

const CAMPOS = [
  ['jugar_y_descargar', 'Jugar y descargar'],
  ['pagina_del_autor', 'Autor'],
  ['codigo_fuente', 'Código'],
];

const datos = JSON.parse(readFileSync(RUTA_DATOS, 'utf8'));
const juegos = Array.isArray(datos.juegos) ? datos.juegos : [];

// Cada dirección distinta, con los juegos y campos que la usan.
const enlaces = new Map();
for (const juego of juegos) {
  for (const [campo, etiqueta] of CAMPOS) {
    const url = typeof juego[campo] === 'string' ? juego[campo].trim() : '';
    if (!url) continue;
    if (!enlaces.has(url)) enlaces.set(url, []);
    enlaces.get(url).push(`${juego.titulo} · ${etiqueta}`);
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const sitioDe = (url) => new URL(url).hostname.replace(/^[^.]+\.(?=[^.]+\.[^.]+$)/, '');
const ultimaPeticion = new Map();

async function pedir(url) {
  // Entre dos peticiones al mismo sitio, una pausa: así no nos toman por un programa que lo aporrea.
  const sitio = sitioDe(url);
  const espera = PAUSA_MISMO_SITIO_MS - (Date.now() - (ultimaPeticion.get(sitio) ?? 0));
  if (espera > 0) await dormir(espera);
  ultimaPeticion.set(sitio, Date.now());

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
  try {
    const respuesta = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: control.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'es,en;q=0.8' },
    });
    // No hace falta leer el cuerpo: basta el estado.
    await respuesta.body?.cancel().catch(() => {});
    return { estado: respuesta.status, texto: `${respuesta.status} ${respuesta.statusText}`.trim() };
  } finally {
    clearTimeout(temporizador);
  }
}

/** Devuelve { ok, limitado, detalle }: limitado = el sitio no ha dejado comprobarlo (429). */
async function comprobar(url) {
  let ultimo = '';
  let limitado = false;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const { estado, texto } = await pedir(url);
      ultimo = texto;
      limitado = estado === 429;
      if (estado < 400) return { ok: true, limitado: false, detalle: texto };
      // 404 y 410 son definitivos: un segundo intento solo descarta un fallo puntual.
      if ((estado === 404 || estado === 410) && intento >= 2) return { ok: false, limitado: false, detalle: texto };
    } catch (error) {
      limitado = false;
      ultimo = error?.name === 'AbortError' ? 'sin respuesta (tiempo agotado)' : `sin respuesta (${error?.cause?.code ?? error?.message ?? 'error de red'})`;
    }
    if (intento < INTENTOS) await dormir((limitado ? ESPERA_TRAS_429_MS : ESPERA_ENTRE_INTENTOS_MS)[intento - 1] ?? 8000);
  }
  return { ok: false, limitado, detalle: ultimo };
}

const rotos = [];
const sinComprobar = [];
let revisados = 0;
for (const [url, usos] of enlaces) {
  const resultado = await comprobar(url);
  revisados++;
  const marca = resultado.ok ? 'ok ' : resultado.limitado ? '?? ' : 'MAL';
  console.log(`${marca} ${resultado.detalle.padEnd(28)} ${url}`);
  if (resultado.limitado) sinComprobar.push({ url, usos, detalle: resultado.detalle });
  else if (!resultado.ok) rotos.push({ url, usos, detalle: resultado.detalle });
  await dormir(PAUSA_ENTRE_ENLACES_MS);
}

const fecha = new Date().toISOString().slice(0, 10);
const tabla = (filas) => ['| Juego · enlace | Dirección | Respuesta |', '|---|---|---|', ...filas.map((r) => `| ${r.usos.join('<br>')} | ${r.url} | ${r.detalle} |`)];
const lineas = [];
if (rotos.length === 0) {
  lineas.push(`Comprobación del ${fecha}: los ${revisados - sinComprobar.length} enlaces comprobados de \`datos/juegos.json\` responden.`);
} else {
  lineas.push(`Comprobación del ${fecha}: **${rotos.length} de ${revisados} enlaces no responden.**`, '', ...tabla(rotos));
  lineas.push('', 'Esta comprobación no cambia la lista. Revisa cada enlace a mano y, si hace falta, corrígelo en `datos/juegos.json` y en `README.md`.');
}
if (sinComprobar.length > 0) {
  lineas.push('', `**${sinComprobar.length} enlaces sin comprobar**: el sitio ha limitado nuestras peticiones (429). No es señal de que estén rotos; se vuelven a probar en la siguiente comprobación.`, '', ...tabla(sinComprobar));
}
writeFileSync(RUTA_INFORME, lineas.join('\n') + '\n');

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `rotos=${rotos.length}\nsin_comprobar=${sinComprobar.length}\ntotal=${revisados}\n`);
}

console.log('');
if (rotos.length === 0 && sinComprobar.length === 0) console.log(`Todo en orden: ${revisados} enlaces responden.`);
else if (rotos.length === 0) console.log(`${revisados - sinComprobar.length} enlaces responden; ${sinComprobar.length} sin comprobar (límite de peticiones del sitio). Informe en ${RUTA_INFORME}.`);
else console.log(`${rotos.length} de ${revisados} enlaces no responden (${sinComprobar.length} sin comprobar). Informe en ${RUTA_INFORME}.`);
