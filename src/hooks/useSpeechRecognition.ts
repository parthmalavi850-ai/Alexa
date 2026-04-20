import { useState, useEffect, useCallback, useRef } from 'react';

// Extend the window object to include the speech recognition APIs
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

export function useSpeechRecognition(onResult?: (text: string) => void): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recognitionObj, setRecognitionObj] = useState<any>(null);
  
  const onResultRef = useRef(onResult);
  
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // We want it to stop after a single utterance for conversational turn-taking
    recognition.interimResults = true; // Show words as they are spoken
    // Use hi-IN for Hindi/Indian English support
    recognition.lang = 'hi-IN';

    recognition.onresult = (event: any) => {
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

      if (isFinal && onResultRef.current) {
        onResultRef.current(currentTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      // Ignore 'no-speech' error as it happens naturally when the user is quiet
      // Ignore 'network' error as it frequently happens transiently in Chrome
      // Ignore 'aborted' error as it happens intentionally when we stop the mic to talk
      if (event.error !== 'no-speech' && event.error !== 'network' && event.error !== 'not-allowed' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
        setError(event.error);
      } else if (event.error === 'network') {
        console.warn('Transient network error encountered in speech recognition, ignoring...');
      } else if (event.error === 'not-allowed') {
        console.warn('Microphone access blocked (not-allowed). User gesture may be required.');
        setError('not-allowed');
      } else if (event.error === 'aborted') {
        console.log('Speech recognition aborted (usually intentional).');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setRecognitionObj(recognition);
  }, []); // Remove onResult from dependency array

  const startListening = useCallback(() => {
    if (recognitionObj && !isListening) {
      setError(null);
      setTranscript('');
      try {
        recognitionObj.start();
        setIsListening(true);
      } catch (err: any) {
        if (err.name === 'InvalidStateError' || (err.message && err.message.includes('already started'))) {
          // It's already started, let's just sync our state to match reality
          setIsListening(true);
        } else {
          console.error("Could not start recognition:", err);
        }
      }
    }
  }, [recognitionObj, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionObj && isListening) {
      recognitionObj.stop();
      setIsListening(false);
    }
  }, [recognitionObj, isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return { isListening, transcript, startListening, stopListening, resetTranscript, error };
}
