import { StrictMode, Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/dm-sans'
import './style.css'
import draftPhoto from './assets/graphite-study.webp'
import { example } from './example.ts'
import { creationPrompt, empty, feedbackPrompt, grade, kinds, labels, maxBackupBytes, maxQuizBytes, parseBackup, parseQuiz } from './model.ts'
import type { Attempt, Config, Library, Quiz } from './model.ts'
import { useHoverSound } from './useHoverSound.ts'

const Rich = lazy(() => import('./Rich.tsx'))

const storageKey = 'repaso-local:v1'
type Page = 'inicio' | 'crear' | 'importar' | 'biblioteca' | 'historial' | 'rendir' | 'resultado'
const navigation = [
  ['inicio', 'Inicio'], ['crear', 'Crear'], ['importar', 'Importar'], ['biblioteca', 'Biblioteca'], ['historial', 'Historial'],
] as const
const titles: Record<Page, string> = { inicio: 'Tu espacio de práctica', crear: 'Creá un cuestionario', importar: 'Importá un cuestionario', biblioteca: 'Mis cuestionarios', historial: 'Historial de práctica', rendir: 'Responder cuestionario', resultado: 'Resultados del intento' }
const defaults: Config = { tema: '', cantidad: 10, dificultad: 'Intermedia', tipos: ['single', 'multiple', 'boolean'], indicaciones: '' }
const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

function loadLibrary() {
  try {
    const raw = localStorage.getItem(storageKey)
    return { data: raw ? parseBackup(raw) : empty, readable: true, error: '' }
  } catch {
    return { data: empty, readable: false, error: 'No se pudo leer la biblioteca local. La sesión queda en modo temporal. Podés importar una copia y exportar tus cambios.' }
  }
}
function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Prompt({ value, feedback = false }: { value: string; feedback?: boolean }) {
  const field = useRef<HTMLTextAreaElement>(null)
  const [message, setMessage] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setMessage('Prompt copiado.')
    } catch {
      field.current?.focus()
      field.current?.select()
      setMessage('Texto seleccionado. Usá el comando de copiar de tu dispositivo.')
    }
  }
  return <section className="panel prompt-panel">
    <h2>{feedback ? 'Prompt para tu próximo repaso' : 'Prompt listo para copiar'}</h2>
    <p>{feedback ? 'Pegalo en tu IA para generar ejercicios a partir de tu desempeño.' : 'Pegalo en la IA que elijas y traé el JSON de vuelta a Repaso.'}</p>
    <textarea aria-label={feedback ? 'Prompt de retroalimentación' : 'Prompt de creación'} rows={7} readOnly value={value} ref={field} />
    <div className="actions"><button className="primary" onClick={copy}>Copiar prompt</button>
      <button onClick={() => download(feedback ? 'repaso-adaptado.txt' : 'crear-cuestionario.txt', value, 'text/plain;charset=utf-8')}>Descargar prompt</button></div>
    <div role="status">{message}</div>
  </section>
}

function App() {
  const hoverSound = useHoverSound()
  const [initial] = useState(loadLibrary)
  const [library, setLibrary] = useState(initial.data)
  const [storageError, setStorageError] = useState(initial.error)
  const [page, setPage] = useState<Page>('inicio')
  const [config, setConfig] = useState(defaults)
  const [prompt, setPrompt] = useState('')
  const [json, setJson] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [quizId, setQuizId] = useState('')
  const [answers, setAnswers] = useState<number[][]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [review, setReview] = useState(false)
  const [attempt, setAttempt] = useState<Attempt>()
  const [showFeedback, setShowFeedback] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const questionHeading = useRef<HTMLHeadingElement>(null)
  const quiz = library.quizzes.find(item => item.id === quizId)?.quiz
  const results = quiz && attempt ? grade(quiz, attempt.answers) : undefined
  const answered = answers.filter(selection => selection.length > 0).length

  useEffect(() => { heading.current?.focus() }, [page])
  useEffect(() => { if (page === 'rendir') questionHeading.current?.focus() }, [page, questionIndex, review])

  function persist(next: Library) {
    if (initial.readable) {
      try {
        const raw = JSON.stringify(next)
        if (new TextEncoder().encode(raw).length > maxBackupBytes) throw new Error()
        localStorage.setItem(storageKey, raw)
        setStorageError('')
      } catch {
        setStorageError('El navegador no pudo guardar los cambios. Exportá una copia antes de cerrar la página.')
      }
    }
    setLibrary(next)
  }
  function go(next: Page) {
    setFormError('')
    setNotice('')
    setPage(next)
    if (page === next) heading.current?.focus()
    window.scrollTo(0, 0)
  }
  function start(id: string, nextQuiz: Quiz) {
    setQuizId(id)
    setAnswers(nextQuiz.questions.map(() => []))
    setQuestionIndex(0)
    setReview(false)
    go('rendir')
  }
  function addQuiz(nextQuiz: Quiz, play = false) {
    const existing = library.quizzes.find(row => JSON.stringify(row.quiz) === JSON.stringify(nextQuiz))
    const id = existing?.id ?? crypto.randomUUID()
    if (!existing) persist({ ...library, quizzes: [...library.quizzes, { id, quiz: nextQuiz }] })
    if (play) start(id, nextQuiz)
    else {
      setJson('')
      go('biblioteca')
      setNotice(existing ? 'El cuestionario ya estaba en tu biblioteca.' : 'Cuestionario importado.')
    }
  }
  function finish() {
    const result = { id: crypto.randomUUID(), quizId, date: new Date().toISOString(), answers }
    persist({ ...library, attempts: [...library.attempts, result] })
    openResult(result)
  }
  function openResult(result: Attempt) {
    setQuizId(result.quizId)
    setAttempt(result)
    setShowFeedback(false)
    go('resultado')
  }
  async function importFile(file: File, backup: boolean) {
    setFormError('')
    setNotice('')
    try {
      if (file.size > (backup ? maxBackupBytes : maxQuizBytes)) throw new Error('El archivo supera el tamaño permitido.')
      const text = await file.text()
      if (!backup) {
        setJson(text)
        parseQuiz(text)
        setNotice('JSON válido. Seleccioná Importar cuestionario para guardarlo.')
        return
      }
      const incoming = parseBackup(text)
      // Remap foreign identifiers so restored attempts always reference their original quiz.
      const remapped = new Map<string, string>()
      const quizzes = [...library.quizzes]
      for (const row of incoming.quizzes) {
        const existing = quizzes.find(item => JSON.stringify(item.quiz) === JSON.stringify(row.quiz))
        const id = existing?.id ?? (quizzes.some(item => item.id === row.id) ? crypto.randomUUID() : row.id)
        remapped.set(row.id, id)
        if (!existing) quizzes.push({ id, quiz: row.quiz })
      }
      const attempts = [...library.attempts]
      for (const row of incoming.attempts) {
        const restored = { ...row, quizId: remapped.get(row.quizId)! }
        const collision = attempts.find(item => item.id === row.id)
        if (collision && JSON.stringify(collision) === JSON.stringify(restored)) continue
        if (collision && attempts.some(item => item.quizId === restored.quizId && item.date === restored.date && JSON.stringify(item.answers) === JSON.stringify(restored.answers))) continue
        attempts.push({ ...restored, id: collision ? crypto.randomUUID() : restored.id })
      }
      const next = { ...empty, quizzes, attempts }
      // Apply the same size and integrity rules used when reopening the library.
      parseBackup(JSON.stringify(next))
      persist(next)
      setNotice('Copia incorporada. Tu biblioteca incluye ' + quizzes.length + ' cuestionarios y ' + attempts.length + ' intentos.')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo leer el archivo.')
    }
  }
  function submitConfig(event: FormEvent) {
    event.preventDefault()
    if (!config.tema.trim() || !config.tipos.length) {
      setFormError('Ingresá un tema y elegí al menos un tipo de pregunta.')
      return
    }
    setFormError('')
    setPrompt(creationPrompt({ ...config, tema: config.tema.trim(), indicaciones: config.indicaciones.trim() }))
  }
  function choose(index: number, multiple: boolean) {
    setAnswers(previous => previous.map((selection, i) => {
      if (i !== questionIndex) return selection
      if (!multiple) return [index]
      return selection.includes(index) ? selection.filter(value => value !== index) : [...selection, index]
    }))
  }

  const question = quiz?.questions[questionIndex]
  const displayTitle = page === 'rendir' ? quiz?.title ?? titles.rendir : titles[page]

  return <>
    <a className="skip" href="#contenido">Ir al contenido</a>
    <header className="top"><div className="shell header-content">
      <button className="brand" onClick={() => go('inicio')}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Repaso</button>
      <nav aria-label="Navegación principal">{navigation.map(([key, label]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => go(key)}>{label}</button>)}</nav>
      {hoverSound.available && <button
        type="button" className="sound-toggle" data-sound-toggle aria-pressed={hoverSound.enabled}
        aria-label="Sonido al pasar el cursor" title={hoverSound.enabled ? 'Desactivar sonido al pasar el cursor' : 'Activar sonido al pasar el cursor'}
        onClick={hoverSound.toggle}
      ><span className="sound-mark" aria-hidden="true"><i /><i /><i /></span>Sonido</button>}
    </div></header>
    <main id="contenido" className="shell">
      {storageError && <p className="alert" role="alert">{storageError}</p>}
      {page !== 'inicio' && <div className="page-heading">
        <h1 tabIndex={-1} ref={heading}>{displayTitle}</h1>
        {page === 'crear' && <p>Elegí qué practicar y generá las instrucciones para la IA que uses.</p>}
        {page === 'importar' && <p>Pegá el JSON que devolvió tu IA o cargá un archivo de cuestionario versión 1.0.</p>}
        {page === 'biblioteca' && <p>Volvé a practicar con tus cuestionarios guardados y gestioná tus copias.</p>}
        {page === 'historial' && <p>Consultá tus intentos y retomá el repaso donde más lo necesitás.</p>}
        {page === 'resultado' && quiz && <p>{quiz.title}</p>}
      </div>}
      {formError && <p role="alert" className="alert">{formError}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {page === 'inicio' && <>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <h1 id="hero-title" tabIndex={-1} ref={heading}>Tu espacio<br /> de <span>práctica.</span></h1>
            <p>Convertí cualquier tema en un cuestionario. Practicá y prepará el próximo repaso a partir de tus respuestas.</p>
            <div className="actions"><button className="primary" onClick={() => go('crear')}>Crear cuestionario <span aria-hidden="true">→</span></button>
              <button onClick={() => addQuiz(example, true)}>Probar un ejemplo</button></div>
          </div>
          <div className="hero-art" aria-hidden="true"><img src={draftPhoto} alt="" width={1120} height={747} /></div>
        </section>
        <div className="home-heading"><h2>Tu práctica</h2></div>
        <div className="home-grid grid gap-4 md:grid-cols-3">
          <section className="panel" data-hover-card><span className="card-icon" aria-hidden="true">↳</span><h3>Importar JSON</h3><p>Guardá un cuestionario generado por tu IA.</p><button onClick={() => go('importar')}>Importar</button></section>
          <section className="panel" data-hover-card><span className="card-icon" aria-hidden="true">▤</span><h3>Mis cuestionarios</h3><p>{library.quizzes.length} en tu biblioteca local.</p><button onClick={() => go('biblioteca')}>Ver biblioteca</button></section>
          <section className="panel" data-hover-card><span className="card-icon" aria-hidden="true">↗</span><h3>Mi historial</h3><p>{library.attempts.length} intentos registrados.</p><button onClick={() => go('historial')}>Ver historial</button></section>
        </div>
      </>}
      {page === 'crear' && <>
        <form className="panel flow" onSubmit={submitConfig}>
          <label>Tema<input required maxLength={120} placeholder="Ej. Derivadas y sus aplicaciones" value={config.tema} onChange={event => setConfig({ ...config, tema: event.target.value })} /></label>
          <div className="form-grid grid gap-4 sm:grid-cols-2">
            <label>Cantidad de preguntas<input required type="number" min={1} max={50} value={Number.isNaN(config.cantidad) ? '' : config.cantidad} onChange={event => setConfig({ ...config, cantidad: event.target.valueAsNumber })} /></label>
            <label>Dificultad<select value={config.dificultad} onChange={event => setConfig({ ...config, dificultad: event.target.value })}>{['Inicial', 'Intermedia', 'Avanzada'].map(value => <option key={value}>{value}</option>)}</select></label>
          </div>
          <fieldset><legend>Tipos de pregunta</legend><div className="choices">{kinds.map(kind => <label key={kind}><input type="checkbox" checked={config.tipos.includes(kind)} onChange={event => setConfig({ ...config, tipos: event.target.checked ? [...config.tipos, kind] : config.tipos.filter(value => value !== kind) })} />{labels[kind]}</label>)}</div></fieldset>
          <label>Indicaciones opcionales<textarea rows={3} maxLength={2000} value={config.indicaciones} placeholder="Ej. Incluí problemas de aplicación y justificá cada solución." onChange={event => setConfig({ ...config, indicaciones: event.target.value })} /></label>
          <div className="actions"><button className="primary" type="submit">Generar prompt</button>{prompt && <button type="button" onClick={() => go('importar')}>Ya tengo el JSON →</button>}</div>
        </form>
        {prompt && <Prompt key={prompt} value={prompt} />}
      </>}
      {page === 'importar' && <form className="panel flow" onSubmit={event => {
        event.preventDefault()
        try { addQuiz(parseQuiz(json)) } catch (error) { setNotice(''); setFormError((error as Error).message) }
      }}>
        <label>Archivo JSON <span className="hint">(hasta 1 MB)</span><input type="file" accept=".json,application/json" onChange={event => {
          const file = event.target.files?.[0]
          if (file) void importFile(file, false)
          event.target.value = ''
        }} /></label>
        <label>Contenido JSON<textarea required rows={12} spellCheck={false} value={json} placeholder={'{ "version": "1.0", "title": "...", "questions": [...] }'} onChange={event => {
          setJson(event.target.value); setFormError(''); setNotice('')
        }} /></label>
        <div className="actions"><button type="submit" className="primary">Importar cuestionario</button><button type="button" onClick={() => {
          setJson(JSON.stringify(example, null, 2)); setFormError(''); setNotice('')
        }}>Cargar JSON de ejemplo</button></div>
      </form>}
      {page === 'biblioteca' && <>
        <section className="panel flow"><h2>Cuestionarios guardados</h2>
          {!library.quizzes.length && <><p>Tu biblioteca está vacía.</p><div className="actions"><button className="primary" onClick={() => go('importar')}>Importar un cuestionario</button></div></>}
          {library.quizzes.map(({ id, quiz: row }) => <div className="entry" key={id}><div><h3>{row.title}</h3><p>{row.questions.length} preguntas · {library.attempts.filter(item => item.quizId === id).length} intentos</p></div><div className="actions">
            <button className="primary" onClick={() => start(id, row)}>Rendir</button>
            <button aria-label={'Descargar JSON de ' + row.title} onClick={() => download('cuestionario.json', JSON.stringify(row, null, 2))}>JSON ↓</button></div></div>)}
        </section>
        <section className="panel flow"><h2>Copia de seguridad</h2><p>Exportá cuestionarios e intentos juntos. Al importar una copia, se integra con tu biblioteca actual.</p>
          <div className="actions"><button onClick={() => download('repaso-backup.json', JSON.stringify(library))}>Exportar copia</button></div>
          <label>Importar copia <span className="hint">(hasta 10 MB)</span><input type="file" accept=".json,application/json" onChange={event => {
            const file = event.target.files?.[0]
            if (file) void importFile(file, true)
            event.target.value = ''
          }} /></label>
        </section>
      </>}
      {page === 'historial' && <section className="panel flow">
        {!library.attempts.length && <><h2>Todavía no hay intentos</h2><p>Cuando termines un cuestionario, vas a encontrar el resultado acá.</p><div className="actions"><button className="primary" onClick={() => go('biblioteca')}>Ir a biblioteca</button></div></>}
        {[...library.attempts].sort((a, b) => b.date.localeCompare(a.date)).map(item => {
          const row = library.quizzes.find(entry => entry.id === item.quizId)?.quiz
          if (!row) return null
          const score = grade(row, item.answers)
          return <div className="entry" key={item.id}><div><h3>{row.title}</h3><p>{dateFormat.format(new Date(item.date))} · {score.correct}/{score.total} aciertos</p></div>
            <button onClick={() => openResult(item)}>Ver resultado · {score.percent}%</button></div>
        })}
      </section>}
      {page === 'rendir' && quiz && question && <section className="panel flow">
        <div className="progress-header"><span>{answered} de {quiz.questions.length} respondidas</span><progress aria-label="Preguntas respondidas" value={answered} max={quiz.questions.length} /></div>
        <div className="question-nav" aria-label="Navegar preguntas">{quiz.questions.map((_, index) => <button type="button" key={index} className={answers[index].length ? 'answered' : ''} aria-current={!review && index === questionIndex ? 'step' : undefined} aria-label={'Pregunta ' + (index + 1) + (answers[index].length ? ', respondida' : ', pendiente')} onClick={() => { setReview(false); setQuestionIndex(index) }}>{index + 1}</button>)}</div>
        {review ? <>
          <h2 ref={questionHeading} tabIndex={-1}>Entregar cuestionario</h2>
          <p>{answered === quiz.questions.length ? 'Respondiste todas las preguntas.' : 'Quedan ' + (quiz.questions.length - answered) + ' sin responder. Se contarán como incorrectas.'}</p>
          <div className="actions"><button onClick={() => setReview(false)}>Seguir respondiendo</button><button className="primary" onClick={finish}>Entregar y ver resultados</button></div>
        </> : <>
          <h2 ref={questionHeading} tabIndex={-1}>Pregunta {questionIndex + 1} <span className="hint">· {question.topic}</span></h2>
          <Rich content={question.prompt} />
          <fieldset key={questionIndex}><legend>{question.type === 'multiple' ? 'Marcá todas las opciones correctas' : 'Elegí una opción'}</legend>
            <div className="option-list">{question.options.map((option, index) => <label key={index}>
              <input type={question.type === 'multiple' ? 'checkbox' : 'radio'} name="answer" checked={answers[questionIndex].includes(index)} onChange={() => choose(index, question.type === 'multiple')} />
              <Rich content={option} />
            </label>)}</div>
          </fieldset>
          <div className="actions"><button disabled={questionIndex === 0} onClick={() => setQuestionIndex(questionIndex - 1)}>Anterior</button>
            {questionIndex < quiz.questions.length - 1 && <button onClick={() => setQuestionIndex(questionIndex + 1)}>Siguiente</button>}
            <button className="primary" onClick={() => setReview(true)}>Revisar entrega</button></div>
        </>}
      </section>}
      {page === 'resultado' && quiz && attempt && results && <>
        <section className="panel score">
          <div className="score-number">{results.percent}%</div>
          <div><h2>{results.correct} de {results.total} aciertos</h2><p>{dateFormat.format(new Date(attempt.date))}</p></div>
          <div className="actions"><button className="primary" aria-expanded={showFeedback} onClick={() => setShowFeedback(!showFeedback)}>Preparar repaso adaptado</button>
            <button onClick={() => start(quizId, quiz)}>Rendir de nuevo</button></div>
        </section>
        {showFeedback && <Prompt value={feedbackPrompt(quiz, attempt)} feedback />}
        <section className="panel flow"><h2>Desempeño por subtema</h2>
          <ul className="topics">{results.topics.map(topic => <li key={topic.name}><span>{topic.name}</span><progress aria-label={topic.name} value={topic.correct} max={topic.total} /><span>{topic.correct}/{topic.total}</span></li>)}</ul>
        </section>
        <section className="panel flow"><h2>Corrección y explicaciones</h2>
          {results.items.map(({ question: q, correct, selected }, index) => <details key={index}><summary><span className={correct ? 'correct' : 'incorrect'}>{correct ? 'Correcta' : selected.length ? 'Incorrecta' : 'Sin responder'}</span> Pregunta {index + 1} · {q.topic}</summary>
            <div className="detail"><Rich content={q.prompt} /><h3>Tu respuesta</h3>
              {selected.length ? <ul>{selected.map(i => <li key={i}><Rich content={q.options[i]} /></li>)}</ul> : <p>Sin responder.</p>}
              <h3>Respuesta correcta</h3><ul>{q.correct.map(i => <li key={i}><Rich content={q.options[i]} /></li>)}</ul>
              <h3>Explicación</h3><Rich content={q.explanation} /></div></details>)}
        </section>
      </>}
    </main>
    <footer className="shell footer"><strong>Repaso</strong><span>Tus cuestionarios quedan en este navegador.</span></footer>
  </>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Suspense fallback={<p className="shell" role="status">Cargando cuestionario…</p>}><App /></Suspense></StrictMode>)
