import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscription }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voicenote.webm');
      
      const res = await api.post('/media/audio-transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data && res.data.text) {
        onTranscription(res.data.text);
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.response?.data?.error || 'Error al transcribir el audio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Nota de Voz (Asistente IA)</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Graba un audio y la IA lo transcribirá automáticamente en el cajón de abajo.
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isTranscribing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--clr-primary)', fontSize: '0.85rem' }}>
              <Loader2 size={16} className="spinner" /> Transcribiendo...
            </div>
          ) : isRecording ? (
            <button 
              type="button" 
              onClick={stopRecording}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--clr-danger)', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              <Square size={16} fill="currentColor" /> Detener
            </button>
          ) : (
            <button 
              type="button" 
              onClick={startRecording}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
            >
              <Mic size={16} /> Grabar
            </button>
          )}
        </div>
      </div>
      
      {isRecording && (
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--clr-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--clr-danger)', animation: 'pulse 1.5s infinite' }} />
          Grabando... Habla claro y describe los detalles.
        </div>
      )}
      
      {error && (
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--clr-danger)' }}>
          {error}
        </div>
      )}
    </div>
  );
};
