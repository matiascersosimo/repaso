import { useEffect, useRef, useState } from 'react'

const preferenceKey = 'repaso-local:hover-sound'
const clickBuffers = new WeakMap<AudioContext, AudioBuffer>()
const hoverTargets = [
  '[data-hover-card]', 'button:enabled:not([data-sound-toggle])', 'a[href]', 'summary',
  'input:enabled', 'select:enabled', 'textarea:enabled', '.choices label', '.option-list label',
].join(', ')

function readPreference() {
  try { return localStorage.getItem(preferenceKey) === 'on' }
  catch { return false }
}

function playCue(audio: AudioContext, card: boolean) {
  const start = audio.currentTime
  const end = start + (card ? 0.03 : 0.023)
  const click = audio.createBufferSource()
  const filter = audio.createBiquadFilter()
  const envelope = audio.createGain()

  let buffer = clickBuffers.get(audio)
  if (!buffer) {
    buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.035), audio.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
    clickBuffers.set(audio, buffer)
  }
  click.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(card ? 1050 : 1650, start)
  filter.Q.setValueAtTime(0.75, start)
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.linearRampToValueAtTime(card ? 0.065 : 0.048, start + 0.002)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)

  click.connect(filter).connect(envelope).connect(audio.destination)
  click.onended = () => {
    click.disconnect()
    filter.disconnect()
    envelope.disconnect()
  }
  click.start(start)
  click.stop(end)
}

export function useHoverSound() {
  const available = typeof window.AudioContext === 'function'
  const [enabled, setEnabled] = useState(readPreference)
  const preference = useRef(enabled)
  const context = useRef<AudioContext>(null)
  const lastCue = useRef(-Infinity)

  async function unlock() {
    try {
      const audio = context.current ?? new AudioContext()
      context.current = audio
      if (audio.state !== 'running') await audio.resume()
      return audio
    } catch {
      return null
    }
  }

  function sound(card: boolean) {
    const audio = context.current
    if (!preference.current || audio?.state !== 'running' || audio.currentTime - lastCue.current < 0.11) return
    lastCue.current = audio.currentTime
    playCue(audio, card)
  }

  function toggle() {
    const next = !preference.current
    preference.current = next
    setEnabled(next)
    try { localStorage.setItem(preferenceKey, next ? 'on' : 'off') }
    catch { /* The preference still applies to this session. */ }
    if (next) void unlock().then(() => sound(true))
  }

  useEffect(() => {
    if (!available || !enabled) return
    const prime = () => { void unlock() }
    function hover(event: PointerEvent) {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      if (!(event.target instanceof Element)) return
      const target = event.target.closest(hoverTargets)
      if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return
      sound(target.hasAttribute('data-hover-card'))
    }
    document.addEventListener('pointerdown', prime)
    document.addEventListener('keydown', prime)
    document.addEventListener('pointerover', hover)
    return () => {
      document.removeEventListener('pointerdown', prime)
      document.removeEventListener('keydown', prime)
      document.removeEventListener('pointerover', hover)
    }
  }, [available, enabled])

  useEffect(() => () => {
    const audio = context.current
    context.current = null
    if (audio && audio.state !== 'closed') void audio.close().catch(() => {})
  }, [])

  return { available, enabled, toggle }
}
