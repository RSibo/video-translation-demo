import React, { useState, useRef, useEffect } from "react";
import { 
  Youtube, 
  Flame, 
  Zap, 
  Volume2, 
  Play, 
  Pause, 
  RotateCcw, 
  Languages, 
  HelpCircle, 
  FileText, 
  Sparkles, 
  Activity, 
  Clock, 
  CheckCircle, 
  ChevronRight, 
  Sliders, 
  Info,
  ExternalLink,
  MessageSquareCode,
  Square
} from "lucide-react";
import { PresetVideo, TargetLanguage } from "./types";

const PRESET_VIDEOS: PresetVideo[] = [
  {
    title: "10 Min HIIT Cardio Workout (High Energy)",
    url: "https://www.youtube.com/watch?v=MCo7947M_q0",
    instructor: "Joe Wicks (Body Coach)",
    type: "Cardio & HIIT"
  },
  {
    title: "Tae Bo Ultimate Cardio Burn Exercise",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Standard URL format, will fetch/render perfectly
    instructor: "Billy Blanks",
    type: "Kickboxing Martial Arts"
  },
  {
    title: "Peloton 20 Min Hype Jump Start Workout",
    url: "https://www.youtube.com/watch?v=pAnTby6FjV4",
    instructor: "Robin Arzón",
    type: "Hype Sprint"
  }
];

const PRESET_VOICES = [
  { name: "Zephyr", gender: "Male", cue: "Warm, authoritative, and epic. Great for intense military drills." },
  { name: "Kore", gender: "Female", cue: "Energetic, bright, and motivating. Ideal for standard cardio & dancing." },
  { name: "Puck", gender: "Male", cue: "Highly rapid, sharp speaker. Excellent for intense high-speed HIIT sprints." },
  { name: "Fenrir", gender: "Male", cue: "Heavy, commanding, and deep. Perfect for strength and powerlifting hype." },
  { name: "Charon", gender: "Male", cue: "Resonant, clear, and steady. Good for pacing workouts." }
];

// Help convert raw L16 PCM byte stream into standard playable WAV format
function convertRawPcmToWavBlob(pcmBytes: Uint8Array, sampleRate: number = 24000): Blob {
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.length;
  const headerSize = 44;
  const wavBytes = new Uint8Array(headerSize + dataSize);

  // RIFF identifier
  wavBytes[0] = 0x52; // R
  wavBytes[1] = 0x49; // I
  wavBytes[2] = 0x46; // F
  wavBytes[3] = 0x46; // F

  // Overall size (44 + dataSize - 8)
  const totalSize = headerSize + dataSize - 8;
  wavBytes[4] = totalSize & 0xff;
  wavBytes[5] = (totalSize >> 8) & 0xff;
  wavBytes[6] = (totalSize >> 16) & 0xff;
  wavBytes[7] = (totalSize >> 24) & 0xff;

  // WAVE identifier
  wavBytes[8] = 0x57; // W
  wavBytes[9] = 0x41; // A
  wavBytes[10] = 0x56; // V
  wavBytes[11] = 0x45; // E

  // fmt chunk
  wavBytes[12] = 0x66; // f
  wavBytes[13] = 0x6d; // m
  wavBytes[14] = 0x74; // t
  wavBytes[15] = 0x20; // ' '

  // Chunk size (16 for PCM)
  wavBytes[16] = 16;
  wavBytes[17] = 0;
  wavBytes[18] = 0;
  wavBytes[19] = 0;

  // Audio format (1 for uncompressed PCM)
  wavBytes[20] = 1;
  wavBytes[21] = 0;

  // Channels
  wavBytes[22] = numChannels;
  wavBytes[23] = 0;

  // Sample Rate (e.g., 24000)
  wavBytes[24] = sampleRate & 0xff;
  wavBytes[25] = (sampleRate >> 8) & 0xff;
  wavBytes[26] = (sampleRate >> 16) & 0xff;
  wavBytes[27] = (sampleRate >> 24) & 0xff;

  // Byte Rate
  wavBytes[28] = byteRate & 0xff;
  wavBytes[29] = (byteRate >> 8) & 0xff;
  wavBytes[30] = (byteRate >> 16) & 0xff;
  wavBytes[31] = (byteRate >> 24) & 0xff;

  // Block Align
  wavBytes[32] = blockAlign & 0xff;
  wavBytes[33] = (blockAlign >> 8) & 0xff;

  // Bits per Sample
  wavBytes[34] = bitsPerSample;
  wavBytes[35] = 0;

  // "data" chunk identifier
  wavBytes[36] = 0x64; // d
  wavBytes[37] = 0x61; // a
  wavBytes[38] = 0x74; // t
  wavBytes[39] = 0x61; // a

  // Chunk size
  wavBytes[40] = dataSize & 0xff;
  wavBytes[41] = (dataSize >> 8) & 0xff;
  wavBytes[42] = (dataSize >> 16) & 0xff;
  wavBytes[43] = (dataSize >> 24) & 0xff;

  // Write actual PCM data
  wavBytes.set(pcmBytes, headerSize);

  return new Blob([wavBytes], { type: "audio/wav" });
}

function safePlayAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.play().catch(err => {
    if (err.name !== "AbortError") {
      console.warn("Audio playback aborted or failed:", err);
    }
  });
}

export default function App() {
  // Input states
  const [videoUrl, setVideoUrl] = useState<string>(PRESET_VIDEOS[0].url);
  const [targetLang, setTargetLang] = useState<TargetLanguage>("Spanish (Latin American)");
  const [targetVoice, setTargetVoice] = useState<string>("Kore");

  // API loading states
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result and editor states
  const [processedResult, setProcessedResult] = useState<{
    videoTitle: string;
    videoId: string;
    thumbnailUrl: string;
    transcriptSource: "scraped" | "synthetic";
    originalEnglish: string;
    baselineTranslation: string;
    plainTranslation: string;
    expressiveTranslation: string;
  } | null>(null);

  // Users can custom edit the English, baseline, plain or expressive transcripts to play with the TTS tags!
  const [englishEditorText, setEnglishEditorText] = useState<string>(" ");
  const [baselineEditorText, setBaselineEditorText] = useState<string>("");
  const [plainEditorText, setPlainEditorText] = useState<string>("");
  const [expressiveEditorText, setExpressiveEditorText] = useState<string>("");

  // Audio Playback states
  const [playingEnglish, setPlayingEnglish] = useState<boolean>(false);
  const [loadingEnglishAudio, setLoadingEnglishAudio] = useState<boolean>(false);
  const [englishAudioUrl, setEnglishAudioUrl] = useState<string | null>(null);

  const [playingBaseline, setPlayingBaseline] = useState<boolean>(false);
  const [loadingBaselineAudio, setLoadingBaselineAudio] = useState<boolean>(false);
  const [baselineAudioUrl, setBaselineAudioUrl] = useState<string | null>(null);

  const [playingPlain, setPlayingPlain] = useState<boolean>(false);
  const [loadingPlainAudio, setLoadingPlainAudio] = useState<boolean>(false);
  const [plainAudioUrl, setPlainAudioUrl] = useState<string | null>(null);

  const [playingExpressive, setPlayingExpressive] = useState<boolean>(false);
  const [loadingExpressiveAudio, setLoadingExpressiveAudio] = useState<boolean>(false);
  const [expressiveAudioUrl, setExpressiveAudioUrl] = useState<string | null>(null);

  const [playOriginalVideo, setPlayOriginalVideo] = useState<boolean>(false);

  // Refs for audio instances
  const englishAudioRef = useRef<HTMLAudioElement | null>(null);
  const baselineAudioRef = useRef<HTMLAudioElement | null>(null);
  const plainAudioRef = useRef<HTMLAudioElement | null>(null);
  const expressiveAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevVideoId = useRef<string | null>(null);

  // Clean up audio objects on unmount and clear helper URLs
  useEffect(() => {
    return () => {
      if (englishAudioRef.current) englishAudioRef.current.pause();
      if (baselineAudioRef.current) baselineAudioRef.current.pause();
      if (plainAudioRef.current) plainAudioRef.current.pause();
      if (expressiveAudioRef.current) expressiveAudioRef.current.pause();

      if (englishAudioUrl) URL.revokeObjectURL(englishAudioUrl);
      if (baselineAudioUrl) URL.revokeObjectURL(baselineAudioUrl);
      if (plainAudioUrl) URL.revokeObjectURL(plainAudioUrl);
      if (expressiveAudioUrl) URL.revokeObjectURL(expressiveAudioUrl);
    };
  }, [englishAudioUrl, baselineAudioUrl, plainAudioUrl, expressiveAudioUrl]);

  // Handle Preset Video Clicks
  const handleSelectPreset = (preset: PresetVideo) => {
    setVideoUrl(preset.url);
    setPlayOriginalVideo(false);
  };

  // Helper to pause all other audio playbacks
  const stopAllOtherAudios = (activeMode: 'english' | 'baseline' | 'plain' | 'expressive' | 'originalVideo') => {
    if (activeMode !== 'english' && englishAudioRef.current && playingEnglish) {
      englishAudioRef.current.pause();
      setPlayingEnglish(false);
    }
    if (activeMode !== 'baseline' && baselineAudioRef.current && playingBaseline) {
      baselineAudioRef.current.pause();
      setPlayingBaseline(false);
    }
    if (activeMode !== 'plain' && plainAudioRef.current && playingPlain) {
      plainAudioRef.current.pause();
      setPlayingPlain(false);
    }
    if (activeMode !== 'expressive' && expressiveAudioRef.current && playingExpressive) {
      expressiveAudioRef.current.pause();
      setPlayingExpressive(false);
    }
    if (activeMode !== 'originalVideo') {
      setPlayOriginalVideo(false);
    }
  };

  // Hook up to stop TTS when playing original video
  useEffect(() => {
    if (playOriginalVideo) {
      if (englishAudioRef.current) { englishAudioRef.current.pause(); setPlayingEnglish(false); }
      if (baselineAudioRef.current) { baselineAudioRef.current.pause(); setPlayingBaseline(false); }
      if (plainAudioRef.current) { plainAudioRef.current.pause(); setPlayingPlain(false); }
      if (expressiveAudioRef.current) { expressiveAudioRef.current.pause(); setPlayingExpressive(false); }
    }
  }, [playOriginalVideo]);

  // Run translation on backend
  const handleProcessVideo = async () => {
    if (!videoUrl) return;
    setIsProcessingVideo(true);
    setErrorMsg(null);
    setProcessedResult(null);
    setEnglishAudioUrl(null);
    setBaselineAudioUrl(null);
    setPlainAudioUrl(null);
    setExpressiveAudioUrl(null);
    setPlayOriginalVideo(false);
    if (englishAudioRef.current) { englishAudioRef.current.pause(); setPlayingEnglish(false); }
    if (baselineAudioRef.current) { baselineAudioRef.current.pause(); setPlayingBaseline(false); }
    if (plainAudioRef.current) { plainAudioRef.current.pause(); setPlayingPlain(false); }
    if (expressiveAudioRef.current) { expressiveAudioRef.current.pause(); setPlayingExpressive(false); }

    const steps = [
      "🔍 Analyzing YouTube link...",
      "⚡ Extracting video info & transcript (first 30s)...",
      "🌍 Running hyper-motivation translator...",
      "📝 Structuring plain text and director's notes..."
    ];

    let stepIndex = 0;
    setProcessingStep(steps[0]);
    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        setProcessingStep(steps[stepIndex]);
      }
    }, 1800);

    try {
      const response = await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, language: targetLang }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();
      setProcessedResult(data);
      setEnglishEditorText(data.originalEnglish || "");
      setBaselineEditorText(data.baselineTranslation || "");
      setPlainEditorText(data.plainTranslation || "");
      setExpressiveEditorText(data.expressiveTranslation || "");
    } catch (e: any) {
      clearInterval(stepInterval);
      console.error(e);
      setErrorMsg(e.message || "An unexpected error occurred while processing the video URL.");
    } finally {
      setIsProcessingVideo(false);
    }
  };

  // Preheat/Preload function to run WAV synthesis calls in the background!
  const preloadAudioForMode = async (
    mode: 'english' | 'baseline' | 'plain' | 'expressive',
    textToSpeak: string,
    voiceToUse: string,
    langToUse: string
  ) => {
    if (!textToSpeak || !textToSpeak.trim()) return;

    if (mode === 'english') setLoadingEnglishAudio(true);
    else if (mode === 'baseline') setLoadingBaselineAudio(true);
    else if (mode === 'plain') setLoadingPlainAudio(true);
    else setLoadingExpressiveAudio(true);

    try {
      const response = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: textToSpeak, 
          voice: voiceToUse, 
          language: mode === 'english' ? 'English' : langToUse 
        }),
      });

      if (!response.ok) {
        throw new Error(`Prefetch TTS failed (${response.status})`);
      }

      const data = await response.json();
      const binaryString = window.atob(data.audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const isRawPcm = !data.mimeType || data.mimeType.toLowerCase().includes("l16") || data.mimeType.toLowerCase().includes("pcm");
      const blob = isRawPcm 
        ? convertRawPcmToWavBlob(bytes, 24000)
        : new Blob([bytes], { type: data.mimeType });

      const blobUrl = URL.createObjectURL(blob);

      if (mode === 'english') {
        setEnglishAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        englishAudioRef.current = audio;
        audio.onended = () => setPlayingEnglish(false);
      } else if (mode === 'baseline') {
        setBaselineAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        baselineAudioRef.current = audio;
        audio.onended = () => setPlayingBaseline(false);
      } else if (mode === 'plain') {
        setPlainAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        plainAudioRef.current = audio;
        audio.onended = () => setPlayingPlain(false);
      } else {
        setExpressiveAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        expressiveAudioRef.current = audio;
        audio.onended = () => setPlayingExpressive(false);
      }
    } catch (err) {
      console.warn(`Pre-loading background audio skipped or failed for mode ${mode}:`, err);
    } finally {
      if (mode === 'english') setLoadingEnglishAudio(false);
      else if (mode === 'baseline') setLoadingBaselineAudio(false);
      else if (mode === 'plain') setLoadingPlainAudio(false);
      else setLoadingExpressiveAudio(false);
    }
  };

  // Automatically pre-build wav files for each of the 4 panels whenever a new processedResult is loaded, the voice changes, or the language changes!
  useEffect(() => {
    if (processedResult) {
      const isNewVideo = processedResult.videoId !== prevVideoId.current;
      prevVideoId.current = processedResult.videoId;

      // Clean up previous loaded element audio URLs to prevent memory leaks
      if (englishAudioUrl) URL.revokeObjectURL(englishAudioUrl);
      if (baselineAudioUrl) URL.revokeObjectURL(baselineAudioUrl);
      if (plainAudioUrl) URL.revokeObjectURL(plainAudioUrl);
      if (expressiveAudioUrl) URL.revokeObjectURL(expressiveAudioUrl);

      // Reset state URL variables
      setEnglishAudioUrl(null);
      setBaselineAudioUrl(null);
      setPlainAudioUrl(null);
      setExpressiveAudioUrl(null);

      if (englishAudioRef.current) { englishAudioRef.current.pause(); setPlayingEnglish(false); }
      if (baselineAudioRef.current) { baselineAudioRef.current.pause(); setPlayingBaseline(false); }
      if (plainAudioRef.current) { plainAudioRef.current.pause(); setPlayingPlain(false); }
      if (expressiveAudioRef.current) { expressiveAudioRef.current.pause(); setPlayingExpressive(false); }

      // Fire prefetch synth requests in parallel for all 4 panels
      // If a brand new video was processed, we use the raw data from processedResult directly 
      // instead of relying on stale editor text values in React's asynchronous render pass.
      const textEnglish = isNewVideo ? processedResult.originalEnglish : englishEditorText;
      const textBaseline = isNewVideo ? processedResult.baselineTranslation : baselineEditorText;
      const textPlain = isNewVideo ? processedResult.plainTranslation : plainEditorText;
      const textExpressive = isNewVideo ? processedResult.expressiveTranslation : expressiveEditorText;

      preloadAudioForMode('english', textEnglish, targetVoice, targetLang);
      preloadAudioForMode('baseline', textBaseline, targetVoice, targetLang);
      preloadAudioForMode('plain', textPlain, targetVoice, targetLang);
      preloadAudioForMode('expressive', textExpressive, targetVoice, targetLang);
    }
  }, [processedResult, targetVoice, targetLang]);

  // Run speech synthesis on backend ('english', 'baseline', 'plain', or 'expressive')
  const handleGenerateAndPlayTTS = async (mode: 'english' | 'baseline' | 'plain' | 'expressive') => {
    let textToSpeak = "";
    if (mode === 'english') textToSpeak = englishEditorText;
    else if (mode === 'baseline') textToSpeak = baselineEditorText;
    else if (mode === 'plain') textToSpeak = plainEditorText;
    else if (mode === 'expressive') textToSpeak = expressiveEditorText;

    if (!textToSpeak || !textToSpeak.trim()) return;

    // Fast-track playback if audio is already pre-built!
    if (mode === 'english') {
      if (playingEnglish) {
        englishAudioRef.current?.pause();
        setPlayingEnglish(false);
        return;
      }
      if (englishAudioUrl && englishAudioRef.current) {
        stopAllOtherAudios('english');
        safePlayAudio(englishAudioRef.current);
        setPlayingEnglish(true);
        return;
      }
    } else if (mode === 'baseline') {
      if (playingBaseline) {
        baselineAudioRef.current?.pause();
        setPlayingBaseline(false);
        return;
      }
      if (baselineAudioUrl && baselineAudioRef.current) {
        stopAllOtherAudios('baseline');
        safePlayAudio(baselineAudioRef.current);
        setPlayingBaseline(true);
        return;
      }
    } else if (mode === 'plain') {
      if (playingPlain) {
        plainAudioRef.current?.pause();
        setPlayingPlain(false);
        return;
      }
      if (plainAudioUrl && plainAudioRef.current) {
        stopAllOtherAudios('plain');
        safePlayAudio(plainAudioRef.current);
        setPlayingPlain(true);
        return;
      }
    } else {
      if (playingExpressive) {
        expressiveAudioRef.current?.pause();
        setPlayingExpressive(false);
        return;
      }
      if (expressiveAudioUrl && expressiveAudioRef.current) {
        stopAllOtherAudios('expressive');
        safePlayAudio(expressiveAudioRef.current);
        setPlayingExpressive(true);
        return;
      }
    }

    // Dynamic Fallback Generator: synthesize on-the-fly (useful when a user edits text inside any of the 4 textareas)
    if (mode === 'english') setLoadingEnglishAudio(true);
    else if (mode === 'baseline') setLoadingBaselineAudio(true);
    else if (mode === 'plain') setLoadingPlainAudio(true);
    else setLoadingExpressiveAudio(true);

    try {
      const response = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: textToSpeak, 
          voice: targetVoice, 
          language: mode === 'english' ? 'English' : targetLang 
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS server error (${response.status})`);
      }

      const data = await response.json();
      const binaryString = window.atob(data.audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const isRawPcm = !data.mimeType || data.mimeType.toLowerCase().includes("l16") || data.mimeType.toLowerCase().includes("pcm");
      const blob = isRawPcm 
        ? convertRawPcmToWavBlob(bytes, 24000)
        : new Blob([bytes], { type: data.mimeType });

      const blobUrl = URL.createObjectURL(blob);

      // Stop other audios right before firing playback
      stopAllOtherAudios(mode);

      if (mode === 'english') {
        setEnglishAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        englishAudioRef.current = audio;
        safePlayAudio(audio);
        setPlayingEnglish(true);
        audio.onended = () => setPlayingEnglish(false);
      } else if (mode === 'baseline') {
        setBaselineAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        baselineAudioRef.current = audio;
        safePlayAudio(audio);
        setPlayingBaseline(true);
        audio.onended = () => setPlayingBaseline(false);
      } else if (mode === 'plain') {
        setPlainAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        plainAudioRef.current = audio;
        safePlayAudio(audio);
        setPlayingPlain(true);
        audio.onended = () => setPlayingPlain(false);
      } else {
        setExpressiveAudioUrl(blobUrl);
        const audio = new Audio(blobUrl);
        expressiveAudioRef.current = audio;
        safePlayAudio(audio);
        setPlayingExpressive(true);
        audio.onended = () => setPlayingExpressive(false);
      }
    } catch (err: any) {
      console.error(err);
      alert("Voice Over Generation Failed: Make sure you have setup your GEMINI_API_KEY in Settings.");
    } finally {
      if (mode === 'english') setLoadingEnglishAudio(false);
      else if (mode === 'baseline') setLoadingBaselineAudio(false);
      else if (mode === 'plain') setLoadingPlainAudio(false);
      else setLoadingExpressiveAudio(false);
    }
  };

  // Helper inside manual template editing to insert a voice instruction tag
  const insertVoiceTag = (tag: string, mode: 'english' | 'baseline' | 'plain' | 'expressive') => {
    if (mode === 'expressive') {
      setExpressiveEditorText(prev => prev + ` ${tag} `);
      setExpressiveAudioUrl(null);
    } else if (mode === 'plain') {
      setPlainEditorText(prev => prev + ` ${tag} `);
      setPlainAudioUrl(null);
    } else if (mode === 'baseline') {
      setBaselineEditorText(prev => prev + ` ${tag} `);
      setBaselineAudioUrl(null);
    } else {
      setEnglishEditorText(prev => prev + ` ${tag} `);
      setEnglishAudioUrl(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white font-sans flex flex-col antialiased selection:bg-[#FF4D00] selection:text-white">
      {/* Background radial effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#FF4D00]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col justify-between p-4 md:p-8" id="app-root">
        
        {/* Header Section in Vibrant Palette style: high energy orange */}
        <header className="bg-[#FF4D00] p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center shadow-2xl border border-white/10 mb-6 gap-4" id="app-header">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2.5 rounded-full flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4D00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-2" />
                <path d="M2 12h10" />
                <path d="m9 15 3-3-3-3" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none text-white">
                GYMDUB <span className="opacity-90 font-mono text-xl not-italic ml-1 border-l border-white/30 pl-2">VIBESYNC AI</span>
              </h1>
              <p className="text-xs text-orange-100 mt-1 font-medium">
                High-intensity voice translation dubbing with expressive chest-gasp & emotion synthesis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-white w-full md:w-auto justify-between md:justify-end">
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[10px] uppercase font-bold text-orange-200 tracking-wider">Target Language</span>
              <select 
                id="language-select-header"
                className="bg-transparent border-b-2 border-white font-bold text-base focus:outline-none cursor-pointer py-1 pr-4"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value as TargetLanguage)}
              >
                <optgroup label="English" className="text-black bg-white font-sans">
                  <option value="English (US Accent)">English (US Accent)</option>
                  <option value="English (UK Accent)">English (UK Accent)</option>
                  <option value="English (Canadian Accent)">English (Canadian Accent)</option>
                  <option value="English (Australian Accent)">English (Australian Accent)</option>
                  <option value="English (Indian Accent)">English (Indian Accent)</option>
                  <option value="English (Irish Accent)">English (Irish Accent)</option>
                </optgroup>
                <optgroup label="Spanish" className="text-black bg-white font-sans">
                  <option value="Spanish (Castilian)">Spanish (Castilian)</option>
                  <option value="Spanish (Latin American)">Spanish (Latin American)</option>
                  <option value="Spanish (Mexican)">Spanish (Mexican)</option>
                </optgroup>
                <optgroup label="French" className="text-black bg-white font-sans">
                  <option value="French (European)">French (European)</option>
                  <option value="French (Canadian)">French (Canadian)</option>
                </optgroup>
                <optgroup label="Other" className="text-black bg-white font-sans">
                  <option value="German">German (Deutsch)</option>
                  <option value="Italian">Italian (Italiano)</option>
                  <option value="Portuguese">Portuguese (Português)</option>
                </optgroup>
              </select>
            </div>

            <button 
              id="analyze-clip-header-btn"
              onClick={handleProcessVideo}
              disabled={isProcessingVideo || !videoUrl}
              className="bg-white text-[#FF4D00] px-5 py-2.5 rounded-full font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform disabled:opacity-50 cursor-pointer"
            >
              {isProcessingVideo ? "Analyzing..." : "Analyze Clip"}
            </button>
          </div>
        </header>

        {/* Input & Config Section - Merged and Collapsed */}
        <section className="bg-[#1E293B] p-5 rounded-2xl border border-white/10 mb-8 space-y-4 shadow-xl" id="input-bar">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex-1 space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#FF4D00]">
                <Youtube className="w-4 h-4 text-red-500" /> YouTube Video Connection
              </span>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  id="youtube-url-input"
                  className="flex-1 bg-[#334155] border-2 border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:border-[#FF4D00] outline-none font-medium transition-all"
                  placeholder="Paste YouTube link (e.g., https://youtube.com/watch?v=workout)..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <div className="flex items-center gap-2 px-3 py-1 bg-[#334155] rounded-xl border border-white/10 shrink-0 select-none">
                  <span className="text-[9px] font-bold uppercase text-slate-400">Segment Span</span>
                  <span className="text-[#FF4D00] font-mono font-bold text-xs">00:00 - 00:30</span>
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-3 pt-2 lg:pt-5 items-end shrink-0">
              <div className="flex flex-col shrink-0 min-w-[120px]">
                <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Speaker profile</span>
                <select
                  id="sidebar-voice-select"
                  className="bg-[#334155] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF4D00] cursor-pointer"
                  value={targetVoice}
                  onChange={(e) => setTargetVoice(e.target.value)}
                >
                  {PRESET_VOICES.map((v, i) => (
                    <option key={i} value={v.name}>{v.name} ({v.gender})</option>
                  ))}
                </select>
              </div>

              <button
                id="process-video-btn-bar"
                onClick={handleProcessVideo}
                disabled={isProcessingVideo || !videoUrl}
                className="bg-[#FF4D00] hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-xs shadow-xl transition disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer h-[38px]"
              >
                {isProcessingVideo ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Loading Transcript...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Render Target Vibe</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Collapsed Workout Presets chips line */}
          <div className="border-t border-white/5 pt-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF4D00] block">⚡ Workout Presets Switcher</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {PRESET_VIDEOS.map((preset, index) => {
                  const isActive = videoUrl === preset.url;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`text-2xs px-3 py-1.5 rounded-full border transition font-bold flex items-center gap-1 cursor-pointer ${
                        isActive
                          ? "bg-[#FF4D00] border-[#FF4D00] text-white shadow-md shadow-[#FF4D00]/25"
                          : "bg-[#0F172A]/40 border-slate-700 text-slate-300 hover:bg-[#334155]/30 hover:text-white"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                      <span>{preset.instructor} • {preset.type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 italic font-mono pr-2 hidden lg:block border-l border-white/5 pl-4 shrink-0 max-w-xs">
              <strong>Gait:</strong> {PRESET_VOICES.find(v => v.name === targetVoice)?.cue}
            </div>
          </div>
        </section>

        {/* Content Comparison Area or Waiting Screen */}
        <main className="w-full mb-8">
          <div className="w-full space-y-6">
            {errorMsg && (
              <div className="bg-red-950/40 border border-red-500/20 text-red-100 p-5 rounded-xl flex items-start gap-3" id="error-alert">
                <span className="bg-red-950 text-red-400 p-1 rounded-md shrink-0 border border-red-500/35">⚠️</span>
                <div>
                  <h3 className="text-xs font-semibold text-red-300">Target Action Alert</h3>
                  <p className="text-2xs text-red-200/80 mt-1">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Empty UI display */}
            {!processedResult && !isProcessingVideo && (
              <div className="bg-[#1E293B]/40 border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#1E293B]/80 border-2 border-dashed border-[#FF4D00] flex items-center justify-center text-[#FF4D00] animate-pulse">
                  <Youtube className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-base font-black uppercase tracking-wider text-white">READY FOR ENERGETIC TRANSCRIPTION DUBBING</h3>
                  <p className="text-xs text-slate-400 mt-2">
                    Click "Render Target Vibe" or select from the high-energy workout presets above to instantly fetch, translate, compare, and play high fidelity sport voice-overs.
                  </p>
                </div>
              </div>
            )}

            {/* Simulating translation process */}
            {isProcessingVideo && (
              <div className="bg-[#1E293B]/40 border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-6">
                <div className="flex items-center gap-1.5 py-4">
                  <span className="w-2 h-8 bg-[#FF4D00] rounded animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-14 bg-[#FF4D00] rounded animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-16 bg-[#FF4D00] rounded animate-bounce"></span>
                  <span className="w-2 h-12 bg-[#FF4D00] rounded animate-bounce [animation-delay:-0.1s]"></span>
                  <span className="w-2 h-6 bg-[#FF4D00] rounded animate-bounce [animation-delay:-0.3s]"></span>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-[#FF4D00] animate-pulse">
                    VibeSync Analyzer Working...
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5">{processingStep}</p>
                </div>
              </div>
            )}

            {processedResult && !isProcessingVideo && (
              <div className="space-y-6">
                {/* Active Info */}
                <div className="bg-[#1E293B] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-5 items-stretch md:items-center">
                  <div className="relative w-full md:w-56 aspect-video rounded-xl overflow-hidden bg-black shrink-0 border border-white/10 group">
                    {playOriginalVideo ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${processedResult.videoId}?start=0&end=30&autoplay=1&enablejsapi=1`}
                        title="Original Snippet Video"
                        className="w-full h-full border-none"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="relative w-full h-full cursor-pointer h-full" onClick={() => setPlayOriginalVideo(true)}>
                        <img
                          src={processedResult.thumbnailUrl}
                          alt={processedResult.videoTitle}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-50 transition duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition duration-300">
                          <span className="bg-[#FF4D00] text-white p-3 rounded-full hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-[#FF4D00]/20 flex items-center justify-center">
                            <Play className="w-5 h-5 fill-white" />
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                      <span className="text-[10px] bg-[#FF4D00]/20 text-[#FF4D00] border border-[#FF4D00]/40 uppercase font-black tracking-widest px-2 py-0.5 rounded-md text-slate-300 flex items-center gap-1 w-fit mb-2">
                        ★ Active Gym Dub Segment (30s Workout)
                      </span>
                      <h2 className="text-sm font-bold text-white truncate-2-lines-alternative leading-tight">
                        {processedResult.videoTitle}
                      </h2>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        Detected high energy intensity coach snippet. Press play to hear the original workout voice guide.
                      </p>
                    </div>

                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <button
                        onClick={() => setPlayOriginalVideo(!playOriginalVideo)}
                        className="px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold bg-[#334155] hover:bg-[#475569] border border-white/10 text-white flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                      >
                        {playOriginalVideo ? (
                          <>
                            <Square className="w-3 h-3 text-red-400 fill-red-400" />
                            <span>Stop Original Snippet</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-orange-400 fill-orange-400" />
                            <span>Listen to Original (0:00 - 0:30)</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`https://www.youtube.com/watch?v=${processedResult.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold bg-[#0F172A]/80 hover:bg-[#0F172A] border border-white/5 text-slate-300 flex items-center gap-1 transition"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Subtitle toggle */}
                <details className="bg-[#1E293B]/50 border border-white/10 rounded-xl px-4 py-3 text-xs">
                  <summary className="font-bold text-slate-300 hover:text-white cursor-pointer select-none flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#FF4D00]" />
                      Original English Source Transcript (Scraped first 30s)
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">TAP TO EXPAND</span>
                  </summary>
                  <p className="mt-3 text-[#FF4D00] leading-relaxed bg-[#0F172A] p-4 rounded-lg border border-white/5 font-mono text-xs">
                    "{processedResult.originalEnglish}"
                  </p>
                </details>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Column 1: Original English Coach Vibe (NEW!) */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-400 w-3 h-3 rounded-full"></span>
                      <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">
                        1) Original English Translation
                      </h2>
                    </div>

                    <div className="flex-1 bg-white/5 rounded-3xl p-5 border border-white/10 flex flex-col justify-between min-h-[360px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                          <span className="uppercase tracking-wider font-bold">Inject Voice Tag:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {["[excited]", "[shouting]", "[gasp]", "[very fast]", "[laughs]", "[serious]"].map((tag, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => insertVoiceTag(tag, 'english')}
                              className="text-[9px] font-mono bg-[#1E293B] text-slate-300 hover:text-white hover:bg-slate-500 border border-white/5 rounded px-1.5 py-0.5 transition cursor-pointer"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>

                        <textarea
                          className="w-full bg-[#1E293B]/40 focus:bg-[#1E293B]/90 border border-white/10 focus:border-slate-500 rounded-xl p-3.5 text-xs text-slate-300 font-medium leading-relaxed min-h-[140px] focus:outline-none resize-none"
                          value={englishEditorText}
                          onChange={(e) => {
                            setEnglishEditorText(e.target.value);
                            setEnglishAudioUrl(null); // clear prebuilt URL so it dynamic regens
                          }}
                        />
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
                        <span className="text-[10px] text-slate-400 block text-right font-mono">Original coach read</span>
                        <button
                          onClick={() => handleGenerateAndPlayTTS('english')}
                          disabled={loadingEnglishAudio || !englishEditorText}
                          className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-xs border transition-colors cursor-pointer ${
                            playingEnglish 
                              ? "bg-slate-950 border-white/30 text-white" 
                              : "bg-white/5 border-slate-500/20 hover:bg-white/10 text-slate-200"
                          }`}
                        >
                          {loadingEnglishAudio ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : playingEnglish ? (
                            <Pause className="w-4 h-4 text-slate-400" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          <span>{playingEnglish ? "Pause English" : "Play English Coach"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Baseline #1 */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-500 w-3 h-3 rounded-full"></span>
                      <h2 className="text-xs font-black uppercase tracking-widest text-[#A855F7]">
                        2) Baseline (Gemini 2.5)
                      </h2>
                    </div>

                    <div className="flex-1 bg-white/5 rounded-3xl p-5 border border-white/10 flex flex-col justify-between min-h-[360px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                          <span className="uppercase tracking-wider font-bold">Inject Voice Tag:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {["[excited]", "[shouting]", "[gasp]", "[very fast]", "[laughs]", "[serious]"].map((tag, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => insertVoiceTag(tag, 'baseline')}
                              className="text-[9px] font-mono bg-[#1E293B] text-purple-200 hover:text-white hover:bg-purple-500 border border-white/5 rounded px-1.5 py-0.5 transition cursor-pointer"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>

                        <textarea
                          className="w-full bg-[#1E293B]/40 focus:bg-[#1E293B]/90 border border-white/10 focus:border-purple-500 rounded-xl p-3.5 text-xs text-slate-300 font-medium leading-relaxed min-h-[140px] focus:outline-none resize-none"
                          value={baselineEditorText}
                          onChange={(e) => {
                            setBaselineEditorText(e.target.value);
                            setBaselineAudioUrl(null);
                          }}
                        />
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
                        <span className="text-[10px] text-slate-400 block text-right font-mono">Dry raw translation copy</span>
                        <button
                          onClick={() => handleGenerateAndPlayTTS('baseline')}
                          disabled={loadingBaselineAudio || !baselineEditorText}
                          className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-xs border transition-colors cursor-pointer ${
                            playingBaseline 
                              ? "bg-slate-950 border-white/30 text-white" 
                              : "bg-white/5 border-[#A855F7]/20 hover:bg-white/10 text-slate-200"
                          }`}
                        >
                          {loadingBaselineAudio ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : playingBaseline ? (
                            <Pause className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          <span>{playingBaseline ? "Pause Baseline Dub" : "Play Baseline Dub"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Plain literal translation */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-500 w-3 h-3 rounded-full"></span>
                      <h2 className="text-xs font-black uppercase tracking-widest text-[#3B82F6]">
                        3) Latest Out of Box (Gemini 3.1)
                      </h2>
                    </div>

                    <div className="flex-1 bg-white/5 rounded-3xl p-5 border border-white/10 flex flex-col justify-between min-h-[360px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                          <span className="uppercase tracking-wider font-bold">Inject Voice Tag:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {["[excited]", "[shouting]", "[gasp]", "[very fast]", "[laughs]", "[serious]"].map((tag, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => insertVoiceTag(tag, 'plain')}
                              className="text-[9px] font-mono bg-[#1E293B] text-blue-200 hover:text-white hover:bg-blue-500 border border-white/5 rounded px-1.5 py-0.5 transition cursor-pointer"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>

                        <textarea
                          className="w-full bg-[#1E293B]/40 focus:bg-[#1E293B]/90 border border-white/10 focus:border-blue-500 rounded-xl p-3.5 text-xs text-slate-300 font-medium leading-relaxed min-h-[140px] focus:outline-none resize-none"
                          value={plainEditorText}
                          onChange={(e) => {
                            setPlainEditorText(e.target.value);
                            setPlainAudioUrl(null);
                          }}
                        />
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
                        <span className="text-[10px] text-slate-400 block text-right font-mono">Standard Out of Box Delivery</span>
                        <button
                          onClick={() => handleGenerateAndPlayTTS('plain')}
                          disabled={loadingPlainAudio || !plainEditorText}
                          className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-xs border transition-colors cursor-pointer ${
                            playingPlain 
                              ? "bg-slate-950 border-white/30 text-white" 
                              : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-200"
                          }`}
                        >
                          {loadingPlainAudio ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : playingPlain ? (
                            <Pause className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          <span>{playingPlain ? "Pause Out of Box" : "Play Latest Out of Box"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Expressive emotional translation with glowing Vibrant Theme and animated pulse dots */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#FF4D00] w-3 h-3 rounded-full animate-pulse"></span>
                      <h2 className="text-xs font-black uppercase tracking-widest text-[#FF4D00]">
                        4) Emotional Markup
                      </h2>
                    </div>

                    <div className="flex-1 bg-white/10 rounded-3xl p-5 border-2 border-[#FF4D00] shadow-[0_0_30px_rgba(255,77,0,0.15)] flex flex-col justify-between min-h-[360px]">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                          <span className="uppercase tracking-wider font-bold">Inject Voice Tag:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {["[excited]", "[shouting]", "[gasp]", "[very fast]", "[laughs]", "[sighs]", "[serious]"].map((tag, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => insertVoiceTag(tag, 'expressive')}
                              className="text-[9px] font-mono bg-[#1E293B] text-orange-200 hover:text-white hover:bg-[#FF4D00] border border-white/10 rounded px-1.5 py-0.5 transition cursor-pointer"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>

                        <textarea
                          className="w-full bg-[#1E293B]/70 focus:bg-[#1E293B] border border-white/20 focus:border-[#FF4D00] rounded-xl p-3.5 text-xs text-white font-mono leading-relaxed min-h-[140px] focus:outline-none resize-none"
                          value={expressiveEditorText}
                          onChange={(e) => {
                            setExpressiveEditorText(e.target.value);
                            setExpressiveAudioUrl(null);
                          }}
                        />
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2">
                        <span className="text-[10px] text-orange-300 block text-right font-mono font-bold">Full emotional markup rendering</span>
                        <button
                          onClick={() => handleGenerateAndPlayTTS('expressive')}
                          disabled={loadingExpressiveAudio || !expressiveEditorText}
                          className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-wider text-xs transition duration-300 cursor-pointer ${
                            playingExpressive 
                              ? "bg-white text-slate-950 shadow-xl" 
                              : "bg-[#FF4D00] hover:bg-orange-500 text-white shadow-lg shadow-[#FF4D00]/25"
                          }`}
                        >
                          {loadingExpressiveAudio ? (
                            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          ) : playingExpressive ? (
                            <Pause className="w-4 h-4 text-orange-600 animate-bounce" />
                          ) : (
                            <Play className="w-4 h-4 fill-white animate-pulse" />
                          )}
                          <span>{playingExpressive ? "Pause Emotional Markup" : "Play Emotional Markup"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </main>

        {/* Bottom Banner Section of Vibrant Palette Theme: Audio Profile, Director Notes, Mic Wave Icon panel */}
        <footer className="bg-[#111827] border-t-4 border-[#FF4D00] rounded-3xl p-6 grid grid-cols-1 md:grid-cols-12 gap-6 mt-8 shadow-2xl">
          <div className="md:col-span-4 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#FF4D00]">Audio Profile Metadata</h3>
            <div className="bg-[#1E293B] p-4 rounded-xl border border-white/5 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase">Persona Role</span>
                <span className="font-bold text-white text-xs">{targetVoice}, Elite Cardio Coach</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase">Translation Accent</span>
                <span className="font-bold text-white text-xs">Gym Environment Accent</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase">Target Speech Gait</span>
                <span className="font-bold text-white text-xs">High-Intensity interval pacing</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#FF4D00]">Director's Notes Guidance</h3>
            <div className="bg-[#1E293B] p-4 rounded-xl border border-white/5 min-h-[105px] flex flex-col justify-between">
              <p className="text-xs text-gray-300 italic">
                "Infectious high-action gym enthusiasm. Starts explosive and energetic; includes minor gasp commands to replicate sweat and intensive workout exercise."
              </p>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-bold uppercase text-slate-300">Style: HYPER-ACTIVE</span>
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-bold uppercase text-slate-300">Vibe: MULTI-LEVEL DUP</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 flex flex-col justify-center items-center gap-3">
            <div className="w-20 h-20 rounded-full border-4 border-[#FF4D00] flex items-center justify-center relative shadow-lg shadow-[#FF4D00]/15 bg-[#1E293B]/60">
              <svg width="32" height="32" fill="#FF4D00" viewBox="0 0 24 24" className="animate-pulse">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              <div className="absolute -bottom-2.5 bg-[#FF4D00] px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider">REC AUTO</div>
            </div>
            
            <button 
              onClick={handleProcessVideo}
              disabled={isProcessingVideo || !videoUrl}
              className="w-full py-2.5 bg-white hover:bg-orange-50 text-black rounded-lg font-black uppercase text-xs shadow-lg duration-200 cursor-pointer"
            >
              Render Vibe
            </button>
          </div>
        </footer>

        {/* Global Footer info */}
        <footer className="mt-8 border-t border-white/5 pt-4 text-center text-slate-500 text-[11px]" id="app-footer-info">
          <p>
            GYMDUB translates 30 seconds of video via a cloud-based Python scraper & Gemini 3.1 TTS performance dubber.
          </p>
        </footer>
      </div>
    </div>
  );
}
