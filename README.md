# Repaso

Repaso es una aplicación web para practicar con cuestionarios, revisar cada respuesta y seguir tu progreso por subtema. Podés cargar un cuestionario propio, importar uno que te compartan o empezar con el ejemplo de álgebra incluido.

**[Abrir Repaso](https://matiascersosimo.github.io/repaso/)**

## Cómo funciona

1. En **Crear**, elegí un tema, la dificultad, la cantidad de preguntas y sus tipos. La app arma una guía que podés copiar o descargar para preparar un archivo compatible.
2. En **Importar**, pegá el contenido del cuestionario o cargá un archivo JSON. Repaso lo valida antes de guardarlo en tu biblioteca. También podés usar **Cargar JSON de ejemplo**.
3. En **Biblioteca**, elegí **Rendir** para empezar. Podés navegar entre las preguntas y revisar cuáles faltan antes de entregar.
4. En **Resultados**, consultá el puntaje, los aciertos por subtema y la explicación de cada respuesta. Con **Preparar repaso adaptado** podés exportar una guía para armar otro cuestionario centrado en los temas donde tuviste menos aciertos.

**Historial** reúne tus intentos anteriores. Los cuestionarios y resultados se guardan en el navegador, sin cuenta. En **Biblioteca → Copia de seguridad** podés exportarlos juntos o restaurar una copia en otro navegador o dispositivo.

El botón **Sonido** activa un clic sutil al pasar el cursor por tarjetas y controles. El efecto empieza apagado y el navegador recuerda tu elección.

## Formato de los cuestionarios

Los archivos usan JSON 1.0. Cada pregunta incluye un subtema, un enunciado, opciones, los índices de las respuestas correctas y una explicación.

```json
{
  "version": "1.0",
  "title": "Álgebra",
  "questions": [
    {
      "type": "single",
      "topic": "Ecuaciones",
      "prompt": "¿Cuánto vale $x$ si $2x = 6$?",
      "options": ["$2$", "$3$", "$6$"],
      "correct": [1],
      "explanation": "Al dividir por 2, obtenemos $x = 3$."
    }
  ]
}
```

Se admiten entre 1 y 50 preguntas por cuestionario. Los índices de las opciones empiezan en cero.

| Tipo | Regla de corrección |
| --- | --- |
| `single` | Entre 2 y 8 opciones, con una sola correcta. |
| `multiple` | Entre 3 y 8 opciones, con al menos dos correctas y un distractor. La selección debe coincidir con el conjunto correcto. |
| `boolean` | Las opciones son `["Verdadero", "Falso"]`, en ese orden, con una sola correcta. |

Los enunciados, las opciones y las explicaciones admiten Markdown y fórmulas con `$...$` o `$$...$$`. En JSON, duplicá la barra invertida de los comandos LaTeX, como en `"$\\frac{1}{2}$"`.

## Desarrollo local

El proyecto usa React, TypeScript, Vite, Tailwind y KaTeX. Necesitás Node.js 24 y npm.

```sh
git clone https://github.com/matiascersosimo/repaso.git
cd repaso
npm ci
npm run dev
```

Abrí la dirección que indique Vite. `npm test` comprueba la validación, la corrección y la importación de copias. `npm run build` verifica los tipos y genera el sitio en `dist/`. Para probar esa compilación localmente, usá `npm run preview`.

## Publicación

GitHub Actions ejecuta las pruebas y compila el proyecto antes de publicar `dist/` en GitHub Pages con los cambios de `main`. Si publicás una copia del repositorio, seleccioná **GitHub Actions** en **Settings → Pages → Build and deployment** y ejecutá el workflow **GitHub Pages**.

## Licencia

[MIT](LICENSE).
