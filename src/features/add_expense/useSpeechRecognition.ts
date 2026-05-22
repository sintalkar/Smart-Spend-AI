import { useState, useRef, useCallback } from 'react';

export type SpeechState = 'Idle' | 'Listening' | 'Transcribing' | 'Parsing' | 'PreFilled' | 'Error';

export interface UseVoiceEntryReturn {
  state: SpeechState;
  transcript: string;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  setState: (state: SpeechState) => void;
  setTranscript: (text: string) => void;
  setErrorMessage: (msg: string | null) => void;
}

export function useSpeechRecognition(onFinalResult: (text: string) => void): UseVoiceEntryReturn {
  const [state, setState] = useState<SpeechState>('Idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      stopListening();
    }, 3000); // 3 seconds of silence auto-stops
  }, []);

  const handleResult = useCallback(
    (event: any) => {
      let currentTranscript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          isFinal = true;
          currentTranscript += result[0].transcript;
        } else {
          currentTranscript += result[0].transcript;
        }
      }

      setTranscript(currentTranscript);
      resetSilenceTimer();

      if (isFinal) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        onFinalResult(currentTranscript);
      }
    },
    [onFinalResult, resetSilenceTimer]
  );

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      setState('Error');
      return;
    }

    setErrorMessage(null);
    setTranscript('');
    setState('Listening');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Default to Indian English

    recognition.onresult = handleResult;

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setErrorMessage(`Error: ${event.error}`);
      setState('Error');
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      resetSilenceTimer();
    } catch (e) {
      console.error(e);
      setErrorMessage('Failed to start microphone.');
      setState('Error');
    }
  }, [handleResult, resetSilenceTimer]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setState('Transcribing');
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  return {
    state,
    transcript,
    errorMessage,
    startListening,
    stopListening,
    setState,
    setTranscript,
    setErrorMessage,
  };
}
