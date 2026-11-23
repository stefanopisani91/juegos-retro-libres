#!/usr/bin/env node
/**
 * Comprueba que cada enlace de datos/juegos.json responde.
 *
 * Uso: node scripts/comprobar-enlaces.mjs [datos/juegos.json] [informe.md]
 *
 * - Abre cada dirección distinta (ficha, página del autor y código) con una petición GET normal.
 * - Un enlace cuenta como roto si, tras tres intentos, responde con un error (400 o más) o no responde.
 * - Escribe un informe en Markdown (segundo argumento) y, en GitHub Actions, el número de enlaces rotos en
 *   GITHUB_OUTPUT (`rotos`, `total`).
 * - NUNCA modifica la lista: solo lee el archivo y avisa.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const RUTA_DATOS = process.argv[2] ?? 'datos/juegos.json';
const RUTA_INFORME = process.argv[3] ?? 'enlaces-informe.md';
const INTENTOS = 3;
const ESPERA_ENTRE_INTENTOS_MS = [3000, 8000];
const PAUSA_ENTRE_ENLACES_MS = 400;
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

async function pedir(url) {
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

async function comprobar(url) {
  let ultimo = '';
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const { estado, texto } = await pedir(url);
      ultimo = texto;
      if (estado < 400) return { ok: true, detalle: texto };
      // 404 y 410 son definitivos: no merece la pena insistir mucho, pero un segundo intento evita un fallo puntual.
      if ((estado === 404 || estado === 410) && intento >= 2) return { ok: false, detalle: texto };
    } catch (error) {
      ultimo = error?.name === 'AbortError' ? 'sin respuesta (tiempo agotado)' : `sin respuesta (${error?.cause?.code ?? error?.message ?? 'error de red'})`;
    }
    if (intento < INTENTOS) await dormir(ESPERA_ENTRE_INTENTOS_MS[intento - 1] ?? 8000);
  }
  return { ok: false, detalle: ultimo };
}

const rotos = [];
let revisados = 0;
for (const [url, usos] of enlaces) {
  const resultado = await comprobar(url);
  revisados++;
  const marca = resultado.ok ? 'ok ' : 'MAL';
  console.log(`${marca} ${resultado.detalle.padEnd(28)} ${url}`);
  if (!resultado.ok) rotos.push({ url, usos, detalle: resultado.detalle });
  await dormir(PAUSA_ENTRE_ENLACES_MS);
}

const fecha = new Date().toISOString().slice(0, 10);
const lineas = [];
if (rotos.length === 0) {
  lineas.push(`Comprobación del ${fecha}: los ${revisados} enlaces de \`datos/juegos.json\` responden.`);
} else {
  lineas.push(`Comprobación del ${fecha}: **${rotos.length} de ${revisados} enlaces no responden.**`, '');
  lineas.push('| Juego · enlace | Dirección | Respuesta |', '|---|---|---|');
  for (const r of rotos) {
    lineas.push(`| ${r.usos.join('<br>')} | ${r.url} | ${r.detalle} |`);
  }
  lineas.push('', 'Esta comprobación no cambia la lista. Revisa cada enlace a mano y, si hace falta, corrígelo en `datos/juegos.json` y en `README.md`.');
}
writeFileSync(RUTA_INFORME, lineas.join('\n') + '\n');

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `rotos=${rotos.length}\ntotal=${revisados}\n`);
}

console.log('');
console.log(rotos.length === 0 ? `Todo en orden: ${revisados} enlaces responden.` : `${rotos.length} de ${revisados} enlaces no responden. Informe en ${RUTA_INFORME}.`);
