export const kinds = ['single', 'multiple', 'boolean'] as const
export type Kind = typeof kinds[number]
export const labels = { single: 'Opción única', multiple: 'Selección múltiple', boolean: 'Verdadero o falso' }
export type Question = { type: Kind; topic: string; prompt: string; options: string[]; correct: number[]; explanation: string }
export type Quiz = { version: '1.0'; title: string; questions: Question[] }
export type Config = { tema: string; cantidad: number; dificultad: string; tipos: Kind[]; indicaciones: string }
export type Attempt = { id: string; quizId: string; date: string; answers: number[][] }
export type Library = { version: 1; quizzes: { id: string; quiz: Quiz }[]; attempts: Attempt[] }
export const empty: Library = { version: 1, quizzes: [], attempts: [] }
export const maxQuizBytes = 1_000_000
export const maxBackupBytes = 10_000_000

function fail(path: string, message: string): never { throw new Error(path + ' · ' + message) }
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'se esperaba un objeto.')
  return value as Record<string, unknown>
}
function list(value: unknown, min: number, max: number, path: string): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, 'se esperaba una lista de ' + min + ' a ' + max + ' elementos.')
  return value
}
function str(value: unknown, max: number, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(path, 'se esperaba un texto de 1 a ' + max + ' caracteres.')
  return value.trim()
}
function indices(value: unknown, min: number, max: number, size: number, path: string): number[] {
  const values = list(value, min, max, path).map(entry => {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry >= size) fail(path, 'los índices deben ser enteros entre 0 y ' + (size - 1) + '.')
    return entry
  })
  if (new Set(values).size !== values.length) fail(path, 'hay índices repetidos.')
  return values
}
export function validateQuiz(value: unknown, path = 'Cuestionario'): Quiz {
  const root = record(value, path)
  if (root.version !== '1.0') fail(path + '.version', 'la versión debe ser "1.0".')
  const title = str(root.title, 120, path + '.title')
  const questions = list(root.questions, 1, 50, path + '.questions').map((value, index): Question => {
    const at = path + '.questions[' + index + ']'
    const q = record(value, at)
    const type = q.type
    if (type !== 'single' && type !== 'multiple' && type !== 'boolean') fail(at + '.type', 'usá single, multiple o boolean.')
    const count = type === 'multiple' ? 3 : 2
    const options = list(q.options, count, type === 'boolean' ? 2 : 8, at + '.options').map((v, i) => str(v, 1200, at + '.options[' + i + ']'))
    if (new Set(options.map(option => option.toLowerCase())).size !== options.length) fail(at + '.options', 'las opciones deben ser distintas.')
    if (type === 'boolean' && (options[0] !== 'Verdadero' || options[1] !== 'Falso')) fail(at + '.options', 'usá ["Verdadero", "Falso"] en este orden.')
    return {
      type, options,
      topic: str(q.topic, 100, at + '.topic'),
      prompt: str(q.prompt, 4000, at + '.prompt'),
      correct: indices(q.correct, type === 'multiple' ? 2 : 1, type === 'multiple' ? options.length - 1 : 1, options.length, at + '.correct'),
      explanation: str(q.explanation, 4000, at + '.explanation'),
    }
  })
  return { version: '1.0', title, questions }
}
function parse(text: string, max: number, fenced = false): unknown {
  if (new TextEncoder().encode(text).length > max) fail('Archivo', 'excede el límite de ' + max / 1000 + ' KB.')
  const clean = text.trim()
  const match = fenced && clean.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i)
  try { return JSON.parse(match ? match[1] : clean) as unknown }
  catch { return fail('JSON', 'revisá las comillas, las comas y que el contenido esté completo.') }
}
export function parseQuiz(text: string): Quiz { return validateQuiz(parse(text, maxQuizBytes, true)) }
export function parseBackup(text: string): Library {
  const root = record(parse(text, maxBackupBytes), 'Copia')
  if (root.version !== 1) fail('Copia.version', 'la versión debe ser 1.')
  const byId = new Map<string, Quiz>()
  const quizzes = list(root.quizzes, 0, 10_000, 'Copia.quizzes').map((value, index) => {
    const path = 'Copia.quizzes[' + index + ']'
    const row = record(value, path)
    const id = str(row.id, 100, path + '.id')
    if (byId.has(id)) fail(path + '.id', 'identificador repetido.')
    const quiz = validateQuiz(row.quiz, path + '.quiz')
    byId.set(id, quiz)
    return { id, quiz }
  })
  const seen = new Set<string>()
  const attempts = list(root.attempts, 0, 50_000, 'Copia.attempts').map((value, index) => {
    const path = 'Copia.attempts[' + index + ']'
    const row = record(value, path)
    const id = str(row.id, 100, path + '.id')
    if (seen.has(id)) fail(path + '.id', 'identificador repetido.')
    seen.add(id)
    const quizId = str(row.quizId, 100, path + '.quizId')
    const quiz = byId.get(quizId)
    if (!quiz) fail(path + '.quizId', 'el cuestionario no está en la copia.')
    const date = str(row.date, 32, path + '.date')
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date) fail(path + '.date', 'fecha ISO inválida.')
    const answers = list(row.answers, quiz.questions.length, quiz.questions.length, path + '.answers').map((value, i) => {
      const q = quiz.questions[i]
      return indices(value, 0, q.type === 'multiple' ? q.options.length : 1, q.options.length, path + '.answers[' + i + ']')
    })
    return { id, quizId, date, answers }
  })
  return { version: 1, quizzes, attempts }
}
export function grade(quiz: Quiz, answers: number[][]) {
  const topics = new Map<string, { name: string; correct: number; total: number }>()
  const items = quiz.questions.map((q, i) => {
    const selected = answers[i] ?? []
    const correct = selected.length === q.correct.length && q.correct.every(answer => selected.includes(answer))
    const key = q.topic.normalize('NFC').toLowerCase()
    const topic = topics.get(key) ?? { name: q.topic, correct: 0, total: 0 }
    topic.total++
    if (correct) topic.correct++
    topics.set(key, topic)
    return { question: q, selected, correct }
  })
  const correct = items.filter(item => item.correct).length
  return { items, correct, total: items.length, percent: Math.round(correct / items.length * 100), topics: Array.from(topics.values()) }
}
const contract = String.raw`Entregá únicamente un objeto JSON válido, sin texto ni bloques Markdown alrededor. Usá esta forma exacta:
{"version":"1.0","title":"Título","questions":[{"type":"single","topic":"Subtema","prompt":"Enunciado","options":["Opción A","Opción B"],"correct":[0],"explanation":"Justificación"}]}
Límites: title 120, topic 100, prompt y explanation 4000, cada opción 1200 caracteres. Usá 1 a 50 preguntas y opciones distintas. Los índices de correct empiezan en 0 y no se repiten. single: 2 a 8 opciones y una correcta. multiple: 3 a 8 opciones, al menos dos correctas y un distractor. boolean: exactamente ["Verdadero","Falso"] y una correcta. Usá Markdown sin HTML ni imágenes y fórmulas con $...$ o $$...$$. Escapá las barras invertidas de LaTeX en JSON (ejemplo: "$\\frac{1}{2}$"). Escribí en español salvo indicación contraria y usá nombres de subtema consistentes.`
export function creationPrompt(config: Config) {
  return ['Creá un cuestionario educativo a partir de esta configuración. Respetá la cantidad exacta y usá solo los tipos seleccionados.', JSON.stringify(config, null, 2), contract].join('\n\n')
}
export function feedbackPrompt(quiz: Quiz, attempt: Attempt) {
  const result = grade(quiz, attempt.answers)
  const context = {
    cuestionario: quiz.title, aciertos: result.correct, total: result.total, subtemas: result.topics,
    errores: result.items.filter(item => !item.correct).map(({ question, selected }) => ({
      subtema: question.topic, pregunta: question.prompt, respuesta: selected.map(i => question.options[i]),
      solucion: question.correct.map(i => question.options[i]),
    })),
  }
  return [
    'Creá un nuevo cuestionario de ' + result.total + ' preguntas. Reforzá los subtemas con menor proporción de aciertos, con ejercicios nuevos. Si hubo puntaje perfecto, avanzá a aplicaciones más difíciles. Usá los datos siguientes como evidencia del desempeño.',
    JSON.stringify(context, null, 2), contract,
  ].join('\n\n')
}
