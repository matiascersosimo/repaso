import assert from 'node:assert/strict'
import { test } from 'node:test'
import { example } from '../src/example.ts'
import { creationPrompt, feedbackPrompt, grade, parseBackup, parseQuiz, validateQuiz } from '../src/model.ts'

const candidate = () => structuredClone(example)
const attempt = { id: 'result', quizId: 'quiz', date: '2026-11-22T12:00:00.000Z', answers: [[1], [1, 0], []] }
const backup = () => ({ version: 1, quizzes: [{ id: 'quiz', quiz: candidate() }], attempts: [structuredClone(attempt)] })

test('acepta JSON simple, BOM y bloque Markdown', () => {
  const raw = JSON.stringify(example)
  assert.deepEqual(parseQuiz(raw), example)
  assert.deepEqual(parseQuiz('\uFEFF' + raw), example)
  assert.deepEqual(parseQuiz('```json\r\n' + raw + '\r\n```'), example)
})

test('rechaza sintaxis, versiones desconocidas y cargas demasiado grandes', () => {
  assert.throws(() => parseQuiz('{} trailing'), /JSON/)
  assert.throws(() => validateQuiz({ ...example, version: '2.0' }), /version/)
  assert.throws(() => parseQuiz('á'.repeat(500_001)), /límite/)
})

test('verifica opciones e índices con una ruta precisa', () => {
  const quiz = candidate()
  quiz.questions[1].correct = [1, 1]
  assert.throws(() => validateQuiz(quiz), /questions\[1\]\.correct.*repetidos/)
  quiz.questions[1].correct = [0, 20]
  assert.throws(() => validateQuiz(quiz), /índices/)
  quiz.questions[1].correct = [0, 1]
  quiz.questions[2].options.reverse()
  assert.throws(() => validateQuiz(quiz), /este orden/)
})

test('puntúa por conjunto exacto y agrega por subtema', () => {
  const result = grade(example, attempt.answers)
  assert.equal(result.percent, 67)
  assert.deepEqual(result.topics, [
    { name: 'Ecuaciones', correct: 1, total: 2 },
    { name: 'Potencias', correct: 1, total: 1 },
  ])
  assert.equal(grade(example, [[1], [0], [1]]).correct, 2)
  assert.equal(grade(example, [[1], [0, 1, 2], [1]]).correct, 2)
})

test('las copias validan fechas, referencias e índices de cada intento', () => {
  const original = backup()
  assert.deepEqual(parseBackup(JSON.stringify(original)), original)
  original.attempts[0].quizId = 'missing'
  assert.throws(() => parseBackup(JSON.stringify(original)), /quizId/)
  original.attempts[0].quizId = 'quiz'
  original.attempts[0].answers[2] = [5]
  assert.throws(() => parseBackup(JSON.stringify(original)), /answers\[2\]/)
  original.attempts[0].answers[2] = []
  original.attempts[0].date = '2026-02-31T12:00:00.000Z'
  assert.throws(() => parseBackup(JSON.stringify(original)), /fecha ISO/)
})

test('ambos prompts llevan el contrato y el adaptado incluye el error', () => {
  const prompt = creationPrompt({ tema: 'Álgebra', cantidad: 5, dificultad: 'Inicial', tipos: ['boolean'], indicaciones: '' })
  assert.match(prompt, /"cantidad": 5/)
  assert.match(prompt, /"version":"1.0"/)
  const feedback = feedbackPrompt(example, attempt)
  assert.match(feedback, /"version":"1.0"/)
  assert.match(feedback, /única solución real/)
  assert.doesNotMatch(feedback, /expresiones valen/)
})
