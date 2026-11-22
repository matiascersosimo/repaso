import type { Quiz } from './model.ts'

export const example: Quiz = {
  version: '1.0',
  title: 'Fundamentos de álgebra',
  questions: [
    { type: 'single', topic: 'Ecuaciones', prompt: 'Si $2x + 4 = 12$, ¿cuánto vale $x$?', options: ['$2$', '$4$', '$6$', '$8$'], correct: [1], explanation: 'Restá $4$ a ambos miembros y dividí por $2$. Obtenés $x = 4$.' },
    { type: 'multiple', topic: 'Potencias', prompt: '¿Cuáles de estas expresiones valen $16$?', options: ['$2^4$', '$4^2$', '$8^2$', '$3^3$'], correct: [0, 1], explanation: '$2^4 = 2\\cdot 2\\cdot 2\\cdot 2$ y $4^2 = 4\\cdot4$. Ambas expresiones valen $16$.' },
    { type: 'boolean', topic: 'Ecuaciones', prompt: 'La ecuación $x^2 = 9$ tiene una única solución real.', options: ['Verdadero', 'Falso'], correct: [1], explanation: 'Hay dos soluciones reales, $3$ y $-3$, porque al elevar cualquiera al cuadrado obtenés $9$.' },
  ],
}
