# Criterios de selección

## De dónde salen los juegos

Partimos de tres archivos públicos mantenidos por la comunidad:

- [gbdev/database](https://github.com/gbdev/database): 1.376 entradas, de las que 930 son juegos.
- [gbadev-org/games](https://github.com/gbadev-org/games): 255 entradas, de las que 243 son juegos.
- [Universal-Team/db](https://github.com/Universal-Team/db): 457 entradas, de las que 29 son juegos en formato .nds.

Datos consultados el 23 de noviembre de 2026.

## Filtro 1: licencia

Solo pasan los juegos con una licencia abierta declarada en el archivo de origen o con un repositorio de código público. Eso deja 150 candidatos en los dos primeros archivos. Para cada uno con repositorio hemos leído el archivo de licencia y lo hemos anotado en `datos/juegos.json`, en el campo `licencia_comprobada`.

La gran mayoría de los juegos de esos archivos no declara ninguna licencia. Muchos son gratuitos y de mucha calidad, pero no los incluimos mientras no conste en qué condiciones se pueden usar.

## Filtro 2: obra original

Descartamos, aunque su código tenga licencia abierta:

- versiones no oficiales, recreaciones y *demakes* de juegos, series o marcas comerciales;
- parches y modificaciones de juegos comerciales;
- herramientas, demos técnicas y música, que no son juegos.

Una licencia sobre el código no cubre las marcas ni los personajes de terceros. Por eso faltan aquí algunos de los homebrew más populares, sobre todo en formato .nds.

## Filtro 3: selección

Entre los que quedan, hemos dado prioridad a:

- los preseleccionados por el jurado de la GB Compo 2021;
- los juegos presentados a las GBA Jam;
- los juegos completos frente a los prototipos;
- la variedad de géneros.

Es una selección editorial, no una clasificación: el orden de las tablas no indica cuál es mejor.

## Lo que esta lista no es

No es asesoramiento legal. Cada juego se rige por su propia licencia, que puedes leer en el repositorio enlazado.
