import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

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
    <div className="audio-recorder-box">
      <div className="audio-recorder-header">
        <div>
          <strong className="audio-recorder-title">Nota de Voz (Asistente IA)</strong>
          <span className="audio-recorder-subtitle">
            Graba un audio y la IA lo transcribirá automáticamente en el cajón de abajo.
          </span>
        </div>
        
        <div className="audio-recorder-controls">
          {isTranscribing ? (
            <div className="report-modal-analyzing-msg">
              <Loader2 size={16} className="spinner" /> Transcribiendo...
            </div>
          ) : isRecording ? (
            <Button 
              type="button" 
              variant="danger"
              size="sm"
              onClick={stopRecording}
              className="flex-center gap-2"
            >
              <Square size={16} fill="currentColor" /> Detener
            </Button>
          ) : (
            <Button 
              type="button" 
              variant="outline"
              size="sm"
              onClick={startRecording}
              className="flex-center gap-2"
            >
              <Mic size={16} /> Grabar
            </Button>
          )}
        </div>
      </div>
      
      {isRecording && (
        <div className="audio-recorder-status">
          <div className="audio-recorder-pulse" />
          Grabando... Habla claro y describe los detalles.
        </div>
      )}
      
      {error && (
        <div className="audio-recorder-error">
          {error}
        </div>
      )}
    </div>
  );
};
