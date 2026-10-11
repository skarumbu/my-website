import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API's SpeechRecognition isn't in TS's bundled DOM types
// (still non-standard), and ships behind the `webkit` prefix in Chrome/
// Safari. Keep the shape minimal — just what this hook actually uses.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechToTextResult {
  /** False on browsers without the Web Speech API (e.g. Firefox desktop). */
  isSupported: boolean;
  isListening: boolean;
  /** Not-yet-final words spoken during the current utterance. */
  interimText: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Continuous speech-to-text dictation. Finalized phrases are reported via
 * `onFinalText` as they're recognized (not batched until stop()), so the
 * caller can append them straight into whatever it's editing.
 *
 * Chrome/Safari's recognizer ends itself after a few seconds of silence
 * even in continuous mode — this hook auto-restarts it behind the scenes
 * as long as the user hasn't explicitly called stop(), so dictation feels
 * continuous from the outside.
 */
export function useSpeechToText(onFinalText: (text: string) => void): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  const isSupported = getSpeechRecognitionCtor() !== null;

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('Voice entry isn’t supported in this browser.');
      return;
    }
    setError(null);
    wantListeningRef.current = true;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          onFinalTextRef.current(transcript.trim());
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access was denied.');
      } else {
        setError('Voice entry hit a problem — try again.');
      }
      wantListeningRef.current = false;
    };

    recognition.onend = () => {
      setInterimText('');
      // Browsers stop the recognizer after a pause in speech even in
      // continuous mode; restart it transparently unless the user (or an
      // unrecoverable error above) asked to stop.
      if (wantListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // already starting/started — ignore
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, []);

  // Stop listening if the component using this hook unmounts mid-dictation
  // (e.g. the block was deleted) so the mic doesn't keep running silently.
  useEffect(() => stop, [stop]);

  return { isSupported, isListening, interimText, error, start, stop };
}
