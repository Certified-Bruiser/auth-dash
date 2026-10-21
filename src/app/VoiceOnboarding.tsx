import { useEffect, useRef, useState } from "react";
import { AlertCircle, AudioLines, Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface BusinessProfile {
  business_name: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  brands: string[];
  products_services: string[];
  target_customers: string[];
  customer_needs: string[];
  agent_purpose: string | null;
  agent_responsibilities: string[];
  communication_tone: string | null;
  language: string | null;
  business_rules: string[];
  unknowns: string[];
  unresolved_questions: string[];
  conflicts: Array<{ field: string; statement: string; quote: string; source: string }>;
}

interface ResearchJob {
  id: string;
  target: string;
  status: "pending" | "running" | "complete" | "failed";
  findings: Array<{ claim: string; sources: string[]; verification_status: string; uncertainty: string }>;
  missing_details: string[];
  error: string | null;
  retrieved_at: string | null;
}

interface RecognitionResult {
  readonly 0: { readonly transcript: string };
  readonly length: number;
}

interface RecognitionEvent extends Event {
  readonly results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const greeting = "Hi! I'm here to understand your business and what you'd like help with. Tell me a little about what you do.";

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export default function VoiceOnboarding() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [consented, setConsented] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [research, setResearch] = useState<ResearchJob[]>([]);
  const [researchNotice, setResearchNotice] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const researchPollInFlightRef = useRef(false);
  const transcriptRef = useRef("");
  const turnQueueRef = useRef<Promise<void>>(Promise.resolve());
  const capturedSpeechRef = useRef("");
  const recognitionErrorRef = useRef(false);
  const endedRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const Recognition = getRecognitionConstructor();
  const speechOutputAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

  const speakText = (text: string) => {
    if (!speechOutputAvailable || isEnded) {
      setVoiceMessage("Speech playback is unavailable in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
      setVoiceMessage("The greeting could not be played. Use the replay control to try again.");
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const speakGreeting = () => speakText(greeting);

  const onboardingRequest = async (path: string, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Your sign-in session has expired. Sign in again to continue.");

    const response = await fetch(`${API_BASE_URL}/api/v1/onboarding${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(init.headers || {}),
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.detail || "Onboarding could not be saved.");
    return data;
  };

  const beginOnboarding = async () => {
    setIsStarting(true);
    setVoiceMessage("");
    try {
      const data = await onboardingRequest("/sessions", { method: "POST" });
      setSessionId(data.id);
      setProfile(data.profile);
      setConsented(true);
      setVoiceMessage("Onboarding is ready. Start speaking when you are.");
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "Could not start onboarding.");
    } finally {
      setIsStarting(false);
    }
  };

  const submitTurn = async (text: string) => {
    if (!sessionId || endedRef.current) return;
    setIsProcessing(true);
    try {
      const data = await onboardingRequest(`/sessions/${sessionId}/turns`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setProfile(data.profile);
      setResearch(data.research || []);
      setResearchNotice(data.research_notice || "");
      if (data.assistant_reply) {
        setAssistantReply(data.assistant_reply);
        speakText(data.assistant_reply);
      }
      setVoiceMessage(data.research_notice || "Your profile is updated. Relevant public-source research continues in the background.");
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "This turn could not be processed.");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    speakGreeting();
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !research.some(job => job.status === "pending" || job.status === "running")) return;
    let active = true;
    const refresh = async () => {
      if (researchPollInFlightRef.current) return;
      researchPollInFlightRef.current = true;
      try {
        const data = await onboardingRequest(`/sessions/${sessionId}`);
        if (active) {
          setProfile(data.profile);
          setResearch(data.research || []);
        }
      } catch {
        // Research status refreshes must not interrupt the voice session.
      } finally {
        researchPollInFlightRef.current = false;
      }
    };
    const timer = window.setInterval(refresh, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId, research]);

  const startListening = () => {
    if (!Recognition || isEnded || !consented || !sessionId) return;

    const recognition = new Recognition();
    transcriptRef.current = "";
    recognitionErrorRef.current = false;
    setVoiceMessage("");
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = event => {
      const spokenText = Array.from(event.results)
        .map(result => result[0].transcript)
        .join(" ")
        .trim();
      transcriptRef.current = spokenText;
      setTranscript([capturedSpeechRef.current, spokenText].filter(Boolean).join("\n"));
    };
    recognition.onerror = event => {
      recognitionErrorRef.current = true;
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceMessage("Microphone permission was denied. Allow microphone access in your browser and retry.");
      } else if (event.error === "audio-capture") {
        setVoiceMessage("No microphone is available. Connect a microphone and retry.");
      } else if (event.error === "no-speech") {
        setVoiceMessage("No speech was detected. Try speaking again.");
      } else if (event.error !== "aborted") {
        setVoiceMessage("Speech recognition failed. Check your connection and microphone, then retry.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      if (endedRef.current) return;
      if (transcriptRef.current) {
        capturedSpeechRef.current = [capturedSpeechRef.current, transcriptRef.current]
          .filter(Boolean)
          .join("\n");
        setTranscript(capturedSpeechRef.current);
        setVoiceMessage("Processing your latest turn...");
        const turn = transcriptRef.current;
        turnQueueRef.current = turnQueueRef.current
          .then(() => submitTurn(turn))
          .catch(() => undefined);
      } else if (!recognitionErrorRef.current) {
        setVoiceMessage("No speech was captured. Try again when you're ready.");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceMessage("Could not start speech recognition. Check microphone access and retry.");
    }
  };

  const endSession = () => {
    endedRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setIsListening(false);
    setIsSpeaking(false);
    setIsEnded(true);
    setVoiceMessage("Session ended. Your saved onboarding profile remains available.");
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-6 sm:py-12" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#a78bfa]">Voice Mode</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#e2e4ef] sm:text-3xl" style={{ fontFamily: "Outfit, sans-serif" }}>
              Let's understand your business
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#a0a3b8]" role="status">
            {isStarting || isProcessing ? <span className="h-2 w-2 animate-pulse rounded-full bg-[#f0ad79]" /> : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
            {isStarting ? "Starting" : isProcessing ? "Updating profile" : sessionId ? "Onboarding active" : "Consent required"}
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-[rgba(99,102,241,0.18)] bg-[#0d1018]">
          <div className="flex items-center justify-between border-b border-[rgba(99,102,241,0.12)] px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#c5c7d5]">
              <AudioLines className="h-4 w-4 text-[#a78bfa]" aria-hidden="true" /> Voice session
            </div>
            <div className="flex min-h-5 items-center gap-2 text-xs text-[#a0a3b8]" aria-live="polite">
              {isListening && <><span className="h-2 w-2 animate-pulse rounded-full bg-[#f87171]" /> Listening</>}
              {isSpeaking && <><span className="h-2 w-2 animate-pulse rounded-full bg-[#38bdf8]" /> Speaking</>}
              {!isListening && !isSpeaking && (isEnded ? "Ended" : isProcessing ? "Processing" : "Ready")}
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-8">
            <div className="max-w-2xl rounded-lg border border-[rgba(99,102,241,0.14)] bg-[#111520] p-4 sm:p-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#a78bfa]">Assistant</p>
              <p className="text-base leading-7 text-[#e2e4ef]">{greeting}</p>
            </div>

            {transcript && (
              <div className="ml-auto max-w-2xl rounded-lg border border-[rgba(56,189,248,0.18)] bg-[rgba(56,189,248,0.06)] p-4 sm:p-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#7dd3fc]">Recognized speech</p>
                <p className="text-sm leading-6 text-[#c5c7d5]">{transcript}</p>
              </div>
            )}

            {assistantReply && (
              <div className="max-w-2xl rounded-lg border border-[rgba(99,102,241,0.14)] bg-[#111520] p-4 sm:p-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#a78bfa]">Assistant</p>
                <p className="text-sm leading-6 text-[#e2e4ef]">{assistantReply}</p>
              </div>
            )}

            {!consented ? (
              <div className="rounded-lg border border-[rgba(240,173,121,0.2)] bg-[rgba(240,173,121,0.06)] p-4">
                <p className="text-sm font-semibold text-[#f0c59f]">Before you begin</p>
                <p className="mt-1 text-sm leading-6 text-[#c5a98e]">
                  Your recognized speech will be sent to our backend and AI provider and saved with your business profile. Relevant details may also be researched using public web sources and saved to your account.
                </p>
                <button
                  type="button"
                  onClick={beginOnboarding}
                  disabled={isStarting}
                  className="mt-4 rounded-md bg-[#7357e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#6448d5] disabled:opacity-50"
                >
                  {isStarting ? "Starting..." : "I agree and start"}
                </button>
              </div>
            ) : (
              <>
                {profile && (
                  <section className="border-t border-[rgba(99,102,241,0.12)] pt-5" aria-label="Business profile">
                    <h2 className="text-sm font-semibold text-[#e2e4ef]">Business profile</h2>
                    <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      {(["business_name", "description", "industry", "location", "brands", "products_services", "target_customers", "agent_purpose"] as const).map(field => {
                        const value = profile[field];
                        if (!value || (Array.isArray(value) && value.length === 0)) return null;
                        const label = field.replace(/_/g, " ").replace(/^./, (char: string) => char.toUpperCase());
                        return <div key={field}><dt className="text-xs capitalize text-[#a0a3b8]">{label}</dt><dd className="mt-1 text-[#d5d7e2]">{Array.isArray(value) ? value.join(", ") : value}</dd></div>;
                      })}
                    </dl>
                    {profile.unresolved_questions.length > 0 && <p className="mt-3 text-xs text-[#a0a3b8]">Open details: {profile.unresolved_questions.join(" · ")}</p>}
                    {profile.unknowns.length > 0 && <p className="mt-2 text-xs text-[#71748a]">Not yet covered: {profile.unknowns.map(field => field.replace(/_/g, " ")).join(" · ")}</p>}
                    {profile.conflicts.length > 0 && <p className="mt-2 text-xs text-[#f0ad79]">Conflicting statements: {profile.conflicts.map(conflict => conflict.statement).join(" · ")}</p>}
                    {researchNotice && <p className="mt-2 text-xs text-[#f0ad79">{researchNotice}</p>}
                  </section>
                )}

                {research.length > 0 && (
                  <section className="border-t border-[rgba(99,102,241,0.12)] pt-5" aria-label="Public-source research">
                    <h2 className="text-sm font-semibold text-[#e2e4ef]">Public-source research</h2>
                    <div className="mt-3 space-y-4">
                      {research.map(job => (
                        <article key={job.id || job.target} className="border-l-2 border-[#7357e8] pl-3">
                          <p className="text-xs text-[#a0a3b8]">{job.status === "running" || job.status === "pending" ? "Researching" : job.status === "failed" ? "Research unavailable" : "Research complete"}: {job.target}</p>
                          {job.findings?.map((finding, index) => (
                            <div key={`${finding.claim}-${index}`} className="mt-2">
                              <p className="text-sm leading-6 text-[#d5d7e2]">{finding.claim}</p>
                              {finding.uncertainty && <p className="text-xs text-[#a0a3b8]">Uncertainty: {finding.uncertainty}</p>}
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                {finding.sources.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[#7dd3fc] underline underline-offset-2">{new URL(url).hostname}</a>)}
                                <span className="text-[#71748a]">{finding.verification_status.replace(/_/g, " ")}</span>
                              </div>
                            </div>
                          ))}
                          {job.missing_details?.length > 0 && <p className="mt-2 text-xs text-[#a0a3b8]">Still unknown: {job.missing_details.join(" · ")}</p>}
                          {job.error && <p className="mt-2 text-xs text-[#f0ad79]">{job.error}</p>}
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            <div className="flex flex-col items-center gap-4 border-t border-[rgba(99,102,241,0.12)] pt-5">
              <p aria-live="polite" className="min-h-5 text-center text-sm text-[#a0a3b8]">
                {voiceMessage || (!Recognition
                  ? "Speech recognition is not supported in this browser."
                  : !consented
                    ? "Review consent to begin."
                    : "Speak naturally; your profile updates as you share details.")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={speakGreeting}
                  disabled={!speechOutputAvailable || isEnded}
                  aria-label="Play greeting aloud"
                  title="Play greeting aloud"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(99,102,241,0.22)] bg-[#171d2e] text-[#b4b8cc] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
                  disabled={!Recognition || isEnded || !consented || !sessionId}
                  aria-label={isListening ? "Stop listening" : "Start listening"}
                  title={isListening ? "Stop listening" : "Start listening"}
                  className={`flex h-16 w-16 items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#a78bfa] disabled:cursor-not-allowed disabled:opacity-40 ${isListening ? "border-[#f87171] bg-[rgba(248,113,113,0.14)] text-[#f87171]" : "border-[rgba(139,107,255,0.5)] bg-[#7357e8] text-white hover:bg-[#6448d5]"}`}
                >
                  {isListening ? <MicOff className="h-6 w-6" aria-hidden="true" /> : <Mic className="h-6 w-6" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={endSession}
                  disabled={isEnded}
                  aria-label="End voice session"
                  title="End voice session"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] text-[#fca5a5] transition-colors hover:bg-[rgba(248,113,113,0.16)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PhoneOff className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs text-[#71748a]">Browser speech recognition may use its own service. Only recognized text is sent for onboarding; microphone audio is not uploaded.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
