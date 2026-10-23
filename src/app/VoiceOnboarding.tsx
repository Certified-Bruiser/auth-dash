import { useEffect, useRef, useState } from "react";
import { AlertCircle, AudioLines, Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface BusinessProfile {
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

export interface AgentFields {
  name: string;
  description: string;
  purpose: string;
  goals: string;
  tone: string;
  language: string;
  businessContext: string;
}

interface OnboardingSessionSummary {
  id: string;
  profile: BusinessProfile;
  created_at: string;
  updated_at: string;
  agent_id: string | null;
  completion_recorded?: boolean;
}

type TranscriptTurn = string | { role: "user" | "assistant"; content: string };
type ConversationMessage = { role: "user" | "assistant"; content: string };

interface VoiceOnboardingProps {
  onCreateAgent: (
    sessionId: string,
    fields: AgentFields,
    profile: BusinessProfile,
    associatedAgentId?: string | null,
  ) => Promise<{ id: string }>;
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

const greeting = "Hi! I'd love to learn about your business. Tell me a little about what you do.";
export const editableProfileFields = [
  "business_name", "description", "industry", "location", "brands", "products_services",
  "target_customers", "customer_needs", "agent_purpose", "agent_responsibilities",
  "communication_tone", "language", "business_rules",
] as const;
export const listProfileFields = new Set<string>([
  "brands", "products_services", "target_customers", "customer_needs",
  "agent_responsibilities", "business_rules",
]);

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export default function VoiceOnboarding({ onCreateAgent }: VoiceOnboardingProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [consented, setConsented] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [assistantReply, setAssistantReply] = useState("");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [completionRecorded, setCompletionRecorded] = useState(false);
  const [research, setResearch] = useState<ResearchJob[]>([]);
  const [savedSessions, setSavedSessions] = useState<OnboardingSessionSummary[]>([]);
  const [associatedAgentId, setAssociatedAgentId] = useState<string | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const researchPollInFlightRef = useRef(false);
  const transcriptRef = useRef("");
  const lastSubmittedTurnRef = useRef("");
  const turnQueueRef = useRef<Promise<void>>(Promise.resolve());
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

  const replayAssistantReply = () => speakText(assistantReply || greeting);

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
      const firstReply = typeof data.assistant_reply === "string" && data.assistant_reply.trim()
        ? data.assistant_reply
        : greeting;
      setConversationMessages([{ role: "assistant", content: firstReply }]);
      setAssistantReply(firstReply);
      speakText(firstReply);
      setCompletionRecorded(false);
      setSavedSessions(current => [
        {
          id: data.id,
          profile: data.profile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          agent_id: null,
        },
        ...current.filter(item => item.id !== data.id),
      ]);
      setTranscript("");
      transcriptRef.current = "";
      lastSubmittedTurnRef.current = "";
      setResearch([]);
      setAssociatedAgentId(null);
      setProfileDirty(false);
      setConsented(true);
      setVoiceMessage("Onboarding is ready. Start speaking when you are.");
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "Could not start onboarding.");
    } finally {
      setIsStarting(false);
    }
  };

  const resumeOnboarding = async (id: string) => {
    setIsStarting(true);
    setVoiceMessage("");
    try {
      const data = await onboardingRequest(`/sessions/${id}`);
      const savedTranscript: TranscriptTurn[] = data.transcript || [];
      const savedMessages: ConversationMessage[] = savedTranscript.flatMap(turn => {
        if (typeof turn === "string") return [{ role: "user", content: turn }];
        if ((turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string") {
          return [{ role: turn.role, content: turn.content }];
        }
        return [];
      });
      const latestAssistantReply = [...savedTranscript].reverse().find(
        (turn): turn is { role: "assistant"; content: string } =>
          typeof turn !== "string" && turn.role === "assistant",
      )?.content || data.assistant_reply || "";
      setSessionId(data.id);
      setProfile(data.profile);
      setCompletionRecorded(Boolean(data.completion_recorded));
      setTranscript("");
      transcriptRef.current = "";
      setConversationMessages(savedMessages);
      setAssistantReply(latestAssistantReply);
      lastSubmittedTurnRef.current = "";
      setResearch(data.research || []);
      setAssociatedAgentId(data.agent_id || null);
      setProfileDirty(false);
      endedRef.current = false;
      setIsEnded(false);
      setConsented(true);
      setVoiceMessage("Onboarding session resumed.");
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "This onboarding session could not be reopened.");
    } finally {
      setIsStarting(false);
    }
  };

  const updateProfileField = (field: typeof editableProfileFields[number], value: string) => {
    setProfile(current => {
      if (!current) return current;
      const parsedValue = listProfileFields.has(field)
        ? value.split("\n").map(item => item.trim()).filter(Boolean)
        : value.trim() || null;
      return { ...current, [field]: parsedValue };
    });
    setProfileDirty(true);
  };

  const continueToDraft = async () => {
    if (!sessionId || !profile) return;
    setIsSavingReview(true);
    setVoiceMessage("");
    try {
      const payload = Object.fromEntries(
        editableProfileFields.map(field => [field, profile[field]]),
      );
      const reviewed = await onboardingRequest(`/sessions/${sessionId}/profile`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProfile(reviewed.profile);
      setCompletionRecorded(Boolean(reviewed.completion_recorded));
      setProfileDirty(false);
      const agent = await onCreateAgent(sessionId, reviewed.agent_fields, reviewed.profile, associatedAgentId);
      setAssociatedAgentId(agent.id);
      setSavedSessions(current => current.map(item =>
        item.id === sessionId ? { ...item, agent_id: agent.id } : item,
      ));
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "The reviewed profile could not be saved.");
    } finally {
      setIsSavingReview(false);
    }
  };

  const submitTurn = async (text: string) => {
    const normalizedText = text.trim();
    if (!sessionId || endedRef.current || !normalizedText || lastSubmittedTurnRef.current === normalizedText) return;
    lastSubmittedTurnRef.current = normalizedText;
    setAssistantReply("");
    setIsProcessing(true);
    try {
      const data = await onboardingRequest(`/sessions/${sessionId}/turns`, {
        method: "POST",
        body: JSON.stringify({ text: normalizedText }),
      });
      setProfile(data.profile);
      setCompletionRecorded(Boolean(data.completion_recorded));
      setResearch(data.research || []);
      const assistantMessage = typeof data.assistant_reply === "string" ? data.assistant_reply.trim() : "";
      setConversationMessages(current => [
        ...current,
        { role: "user", content: normalizedText },
        ...(assistantMessage ? [{ role: "assistant" as const, content: assistantMessage }] : []),
      ]);
      setTranscript(current => current.trim() === normalizedText ? "" : current);
      if (typeof data.assistant_reply === "string" && data.assistant_reply.trim()) {
        setAssistantReply(data.assistant_reply);
        speakText(data.assistant_reply);
        setVoiceMessage("Your profile is updated.");
      } else {
        setVoiceMessage("Your answer was saved, but no reply was returned. You can continue or resume this session later.");
      }
    } catch (error) {
      lastSubmittedTurnRef.current = "";
      setVoiceMessage(error instanceof Error ? error.message : "This turn could not be processed.");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [conversationMessages, transcript, isProcessing]);

  useEffect(() => {
    let active = true;
    onboardingRequest("/sessions")
      .then(data => {
        if (active) setSavedSessions(data.items || []);
      })
      .catch(error => {
        if (active) setVoiceMessage(error instanceof Error ? error.message : "Saved sessions could not be loaded.");
      });
    return () => {
      active = false;
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
          if (!profileDirty) setProfile(data.profile);
          setCompletionRecorded(Boolean(data.completion_recorded));
          setResearch(data.research || []);
          setAssociatedAgentId(data.agent_id || null);
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
  }, [sessionId, research, profileDirty]);

  const startListening = () => {
    if (!Recognition || isEnded || !consented || !sessionId) return;

    const recognition = new Recognition();
    transcriptRef.current = "";
    setTranscript("");
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
      setTranscript(spokenText);
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
        setTranscript(transcriptRef.current);
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
            {consented && (
              <div ref={conversationRef} className="max-h-[min(50vh,30rem)] space-y-4 overflow-y-auto pr-1" aria-live="polite" aria-label="Conversation">
                {conversationMessages.map((message, index) => (
                  <div
                    key={`${index}-${message.role}`}
                    className={`w-fit max-w-[90%] rounded-lg border p-4 sm:max-w-2xl sm:p-5 ${message.role === "user"
                      ? "ml-auto border-[rgba(56,189,248,0.18)] bg-[rgba(56,189,248,0.06)]"
                      : "mr-auto border-[rgba(99,102,241,0.14)] bg-[#111520]"}`}
                  >
                    <p className={`mb-2 text-xs font-medium uppercase tracking-wider ${message.role === "user" ? "text-[#7dd3fc]" : "text-[#a78bfa]"}`}>
                      {message.role === "user" ? "You" : "Assistant"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#e2e4ef]">{message.content}</p>
                  </div>
                ))}

                {transcript && (
                  <div className="ml-auto w-fit max-w-[90%] rounded-lg border border-[rgba(56,189,248,0.18)] bg-[rgba(56,189,248,0.06)] p-4 sm:max-w-2xl sm:p-5">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#7dd3fc]">You</p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#c5c7d5]">{transcript}</p>
                  </div>
                )}

                {isProcessing && <p className="text-xs text-[#a0a3b8]" role="status">Updating profile...</p>}
              </div>
            )}

            {!consented ? (
              <div className="rounded-lg border border-[rgba(240,173,121,0.2)] bg-[rgba(240,173,121,0.06)] p-4">
                <p className="text-sm font-semibold text-[#f0c59f]">Before you begin</p>
                <p className="mt-1 text-sm leading-6 text-[#c5a98e]">
                  Your recognized speech will be sent to our backend and AI provider and saved with your business profile.
                </p>
                <button
                  type="button"
                  onClick={beginOnboarding}
                  disabled={isStarting}
                  className="mt-4 rounded-md bg-[#7357e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#6448d5] disabled:opacity-50"
                >
                  {isStarting ? "Starting..." : "I agree and start"}
                </button>
                {savedSessions.length > 0 && (
                  <div className="mt-5 border-t border-[rgba(240,173,121,0.14)] pt-4">
                    <h2 className="text-sm font-semibold text-[#f0c59f]">Resume onboarding</h2>
                    <ul className="mt-2 space-y-2">
                      {savedSessions.map(savedSession => (
                        <li key={savedSession.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-[#c5a98e]">
                            {savedSession.profile.business_name || "Business profile in progress"} · {new Date(savedSession.updated_at).toLocaleDateString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => void resumeOnboarding(savedSession.id)}
                            disabled={isStarting}
                            className="shrink-0 rounded-md border border-[rgba(240,173,121,0.25)] px-3 py-1.5 text-xs text-[#f0c59f] hover:bg-[rgba(240,173,121,0.08)] disabled:opacity-50"
                          >
                            {savedSession.agent_id ? "Open linked draft" : "Resume"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                {profile && completionRecorded && (
                  <section className="border-t border-[rgba(99,102,241,0.12)] pt-5" aria-label="Business profile">
                    <h2 className="text-sm font-semibold text-[#e2e4ef]">Review business profile</h2>
                    <p className="mt-1 text-xs text-[#a0a3b8]">Correct any details before they are used to configure the draft.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {editableProfileFields.map(field => {
                        const value = profile[field];
                        const label = field.replace(/_/g, " ").replace(/^./, (char: string) => char.toUpperCase());
                        const textValue = Array.isArray(value) ? value.join("\n") : value || "";
                        return (
                          <label key={field} className="text-xs capitalize text-[#a0a3b8]">
                            {label}
                            {listProfileFields.has(field) ? (
                              <textarea
                                rows={2}
                                value={textValue}
                                onChange={event => updateProfileField(field, event.target.value)}
                                className="mt-1 block w-full rounded-md border border-[rgba(99,102,241,0.18)] bg-[#111520] px-3 py-2 text-sm normal-case text-[#d5d7e2] outline-none focus:ring-1 focus:ring-[#6366f1]"
                              />
                            ) : (
                              <input
                                value={textValue}
                                onChange={event => updateProfileField(field, event.target.value)}
                                className="mt-1 block w-full rounded-md border border-[rgba(99,102,241,0.18)] bg-[#111520] px-3 py-2 text-sm normal-case text-[#d5d7e2] outline-none focus:ring-1 focus:ring-[#6366f1]"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {profile.unresolved_questions.length > 0 && <p className="mt-3 text-xs text-[#a0a3b8]">Open details: {profile.unresolved_questions.join(" · ")}</p>}
                    {profile.conflicts.length > 0 && <p className="mt-2 text-xs text-[#f0ad79]">Conflicting statements: {profile.conflicts.map(conflict => conflict.statement).join(" · ")}</p>}
                  </section>
                )}

                {profile && completionRecorded && (
                  <div className="border-t border-[rgba(99,102,241,0.12)] pt-4">
                    <button
                      type="button"
                      onClick={() => void continueToDraft()}
                      disabled={isSavingReview || (!completionRecorded && !associatedAgentId)}
                      className="rounded-md bg-[#7357e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#6448d5] disabled:opacity-50"
                    >
                      {isSavingReview ? "Creating agent..." : associatedAgentId ? "Open linked agent testing" : "Create agent and start testing"}
                    </button>
                  </div>
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
                  onClick={replayAssistantReply}
                  disabled={!consented || !speechOutputAvailable || isEnded}
                  aria-label={assistantReply ? "Replay assistant reply" : "Play greeting aloud"}
                  title={assistantReply ? "Replay assistant reply" : "Play greeting aloud"}
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
