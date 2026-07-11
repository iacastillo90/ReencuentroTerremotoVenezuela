/**
 * components/modals/AudioRecorder.tsx — Grabación de voz con transcripción
 *
 * PROPÓSITO:
 *   Permite al usuario grabar audio para describir a una persona desaparecida.
 *   Soporta dos caminos:
 *     1. Web Speech API (navegador → texto en tiempo real, sin servidor)
 *     2. Backend fallback (MediaRecorder → Gemini/Whisper → texto)
 *
 * ¿POR QUÉ DOS CAMINOS?
 *   - Web Speech API: gratuito, instantáneo, offline. Pero falla en iOS/Safari
 *     y en algunos navegadores móviles.
 *   - Backend: más preciso (Gemini), funciona donde falla Web Speech, pero
 *     requiere conexión y un viaje HTTP.
 *
 * FILTRO DE RESPUESTAS BASURA (AI_JUNK_PHRASES):
 *   El backend Gemini a veces responde con texto meta como
 *   "Como soy un modelo de lenguaje..." en vez de transcribir el audio.
 *   Detectamos y descartamos esas respuestas automáticamente.
 *
 * ÉTICA:
 *   - Nunca guardamos el audio bruto en el frontend (solo el texto).
 *   - El usuario ve exactamente lo que se va a enviar.
 *   - Puede editar la transcripción manualmente antes de continuar.
 */
import React, { useEffect, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, Square, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  onStartRecording?: () => void;
  currentText?: string;
}

// Frases que la IA del servidor devuelve cuando no entiende el audio
// en vez de transcribirlo correctamente. Las descartamos silenciosamente.
const AI_JUNK_PHRASES = [
  'hola quetal', 'hola que tal', 'pues aqui en mi casa',
  'subtitulos realizados por', 'subtitulos por la comunidad',
  'amara.org', 'como soy un modelo de lenguaje',
  'no tengo la capacidad', 'no puedo procesar',
  'no se detecto voz', 'voz clara en el audio',
  'por favor adjunta', 'no puedo escuchar',
];

const isJunk = (text: string) => {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return AI_JUNK_PHRASES.some(phrase => lower.includes(phrase));
};

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscription,
  onStartRecording,
  currentText = '',
}) => {
  const { transcript, listening, browserSupportsSpeechRecognition, resetTranscript } =
    useSpeechRecognition();

  const [useBackend, setUseBackend] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Referencias para el MediaRecorder (backend fallback)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const baseTextRef = useRef<string>('');

  // ─── Detectar si el navegador soporta Web Speech ───
  // Si no, cambiamos automáticamente al backend fallback.
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      setUseBackend(true);
    }
  }, [browserSupportsSpeechRecognition]);

  // ─── Sincronizar transcripción en tiempo real al padre ───
  // Cada vez que el transcript cambia (Web Speech), lo enviamos al padre
  // combinado con el texto que había antes (para grabaciones continuas).
  useEffect(() => {
    if (transcript && !useBackend) {
      const combined = baseTextRef.current
        ? baseTextRef.current + ' ' + transcript
        : transcript;
      onTranscription(combined.trim());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  // ─── Iniciar grabación por Web Speech ───
  const startBrowserRecording = () => {
    setErrorMsg('');
    baseTextRef.current = '';
    onTranscription('');
    resetTranscript();
    SpeechRecognition.startListening({
      continuous: true,
      language: 'es-VE',
    });
    if (onStartRecording) onStartRecording();
  };

  const stopBrowserRecording = () => {
    SpeechRecognition.stopListening();
  };

  // ─── Iniciar grabación por backend (MediaRecorder + API) ───
  const startBackendRecording = async () => {
    setErrorMsg('');
    onTranscription('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeWithBackend(blob);
      };

      recorder.start();
      if (onStartRecording) onStartRecording();
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopBackendRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  // ─── Enviar audio al backend para transcripción ───
  const transcribeWithBackend = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');
      const res = await api.post('/media/audio-transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const txt = (res.data?.text || '').trim();
      if (txt && !isJunk(txt)) {
        const combined = currentText ? currentText + ' ' + txt : txt;
        onTranscription(combined.trim());
      } else {
        setErrorMsg('No se pudo procesar el audio. Intenta nuevamente o escribe manualmente.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al procesar el audio. Verifica tu conexión.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Controles unificados (detectan qué camino usar) ───
  const isRecording = useBackend ? !!(mediaRecorderRef.current?.state === 'recording') : listening;

  const handleStart = () => useBackend ? startBackendRecording() : startBrowserRecording();
  const handleStop = () => useBackend ? stopBackendRecording() : stopBrowserRecording();

  return (
    <div className="audio-recorder-box">
      <div className="audio-recorder-header">
        <div>
          <strong className="audio-recorder-title">Nota de Voz</strong>
          <span className="audio-recorder-subtitle">
            {useBackend
              ? 'Graba tu descripción y se transcribirá al terminar.'
              : 'Graba tu voz — el texto aparece en tiempo real abajo.'}
          </span>
        </div>

        <div className="audio-recorder-controls">
          {isTranscribing ? (
            <div className="report-modal-analyzing-msg">
              <Loader2 size={16} className="spinner" /> Procesando...
            </div>
          ) : listening || isRecording ? (
            <Button type="button" variant="danger" size="sm" onClick={handleStop} className="flex-center gap-2">
              <Square size={16} fill="currentColor" /> Detener
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={handleStart} className="flex-center gap-2">
              <Mic size={16} /> Grabar
            </Button>
          )}
        </div>
      </div>

      {/* Indicador visual de grabación activa */}
      {(listening || isRecording) && !isTranscribing && (
        <div className="audio-recorder-status">
          <div className="audio-recorder-pulse" />
          Grabando... Habla claro y describe los detalles.
        </div>
      )}

      {errorMsg && (
        <div className="audio-recorder-error">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
