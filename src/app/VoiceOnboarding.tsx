import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Mic, MicOff, Paperclip, PhoneOff, Send, Volume2 } from "lucide-react";
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
  systemInstructions?: string;
  allowedTopics?: string[];
  restrictedTopics?: string[];
  escalationRules?: string;
  humanHandoffConditions?: string;
}

type TranscriptTurn = string | { role: "user" | "assistant"; content: string; sent_at?: string };
type ConversationMessage = { role: "user" | "assistant"; content: string; sentAt?: string };
type UploadedDocument = { id: string; filename: string; processed: boolean };

const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024;

interface VoiceOnboardingProps {
  active?: boolean;
  resumeSessionId?: string | null;
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

const greeting = "Hi! What would you like your agent to do?";
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

export default function VoiceOnboarding({
  active = true,
  resumeSessionId = null,
  onCreateAgent,
}: VoiceOnboardingProps) {
  const [mode, setMode] = useState<"chat" | "voice">("voice");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [consented, setConsented] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [textMessage, setTextMessage] = useState("");
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [assistantReply, setAssistantReply] = useState("");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [completionRecorded, setCompletionRecorded] = useState(false);
  const [research, setResearch] = useState<ResearchJob[]>([]);
  const [associatedAgentId, setAssociatedAgentId] = useState<string | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const researchPollInFlightRef = useRef(false);
  const resumeSessionInFlightRef = useRef<string | null>(null);
  const transcriptRef = useRef("");
  const turnInFlightRef = useRef(false);
  const sessionStartInFlightRef = useRef(false);
  const firstAssistantTimingRef = useRef<number | null>(null);
  const creationInFlightRef = useRef(false);
  const recognitionErrorRef = useRef(false);
  const endedRef = useRef(false);
  const activeRef = useRef(active);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const playbackGenerationRef = useRef(0);
  const modeRef = useRef<"chat" | "voice">("voice");
  const modeEpochRef = useRef(0);
  const Recognition = getRecognitionConstructor();
  const speechOutputAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

  const stopVoicePlayback = useCallback(() => {
    playbackGenerationRef.current += 1;
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;

    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const switchMode = (nextMode: "chat" | "voice") => {
    if (modeRef.current === nextMode) return;
    modeRef.current = nextMode;
    modeEpochRef.current += 1;
    stopVoicePlayback();
    setMode(nextMode);
  };

  const speakWithBrowser = (text: string, generation: number) => {
    if (
      generation !== playbackGenerationRef.current
      || modeRef.current !== "voice"
      || endedRef.current
      || !activeRef.current
    ) return;
    if (!speechOutputAvailable || isEnded) {
      setVoiceMessage("Speech playback is unavailable in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => {
      if (utteranceRef.current === utterance && generation === playbackGenerationRef.current) setIsSpeaking(true);
    };
    utterance.onend = () => {
      if (utteranceRef.current === utterance) {
        setIsSpeaking(false);
        utteranceRef.current = null;
      }
    };
    utterance.onerror = () => {
      if (utteranceRef.current === utterance) {
        setIsSpeaking(false);
        utteranceRef.current = null;
        if (generation === playbackGenerationRef.current && modeRef.current === "voice") {
          setVoiceMessage("The greeting could not be played. Use the replay control to try again.");
        }
      }
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const speakText = async (text: string) => {
    if (modeRef.current !== "voice" || endedRef.current || !activeRef.current) return;
    stopVoicePlayback();
    const generation = playbackGenerationRef.current;
    const fallback = () => speakWithBrowser(text, generation);

    try {
      const audioBlob = await onboardingRequest("/speech", {
        method: "POST",
        body: JSON.stringify({ text }),
      }, "blob") as Blob;
      if (
        generation !== playbackGenerationRef.current
        || modeRef.current !== "voice"
        || endedRef.current
        || !activeRef.current
      ) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audioUrlRef.current = audioUrl;
      const releaseAudio = () => {
        if (audioRef.current !== audio) return false;
        audioRef.current = null;
        audioUrlRef.current = null;
        URL.revokeObjectURL(audioUrl);
        return true;
      };
      audio.onplay = () => {
        if (generation === playbackGenerationRef.current) setIsSpeaking(true);
      };
      audio.onended = () => {
        if (releaseAudio()) setIsSpeaking(false);
      };
      audio.onerror = () => {
        if (releaseAudio()) fallback();
      };
      try {
        await audio.play();
      } catch {
        if (releaseAudio()) fallback();
      }
    } catch {
      fallback();
    }
  };

  const replayAssistantReply = () => speakText(assistantReply || greeting);

  const onboardingRequest = async (
    path: string,
    init: RequestInit = {},
    responseType: "json" | "blob" = "json",
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Your sign-in session has expired. Sign in again to continue.");

    const response = await fetch(`${API_BASE_URL}/api/v1/onboarding${path}`, {
      ...init,
      headers: {
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${session.access_token}`,
        ...(init.headers || {}),
      },
    });
    const data = responseType === "blob"
      ? await response.blob().catch(() => null)
      : await response.json().catch(() => null);
    if (!response.ok) {
      let detail = responseType === "json" ? data?.detail : undefined;
      if (responseType === "blob" && data instanceof Blob) {
        try {
          detail = JSON.parse(await data.text())?.detail;
        } catch {
          detail = undefined;
        }
      }
      throw new Error(detail || "Onboarding could not be saved.");
    }
    return data;
  };

  const beginOnboarding = async () => {
    if (sessionStartInFlightRef.current || sessionId) return;
    sessionStartInFlightRef.current = true;
    const clickedAt = performance.now();
    setConsented(true);
    setIsStarting(true);
    setVoiceMessage("");
    requestAnimationFrame(() => {
      console.info("[ONBOARDING START TIMING] chat_shell_visible_ms", Math.round(performance.now() - clickedAt));
    });
    try {
      const requestStartedAt = performance.now();
      const data = await onboardingRequest("/sessions", { method: "POST" });
      const sessionReceivedAt = performance.now();
      console.info("[ONBOARDING START TIMING] session_request_ms", Math.round(sessionReceivedAt - requestStartedAt));
      console.info("[ONBOARDING START TIMING] click_to_session_ms", Math.round(sessionReceivedAt - clickedAt));
      setSessionId(data.id);
      setProfile(data.profile);
      const firstReply = typeof data.assistant_reply === "string" && data.assistant_reply.trim()
        ? data.assistant_reply
        : greeting;
      firstAssistantTimingRef.current = sessionReceivedAt;
      setConversationMessages([{ role: "assistant", content: firstReply, sentAt: data.assistant_sent_at }]);
      setUploadedDocuments([]);
      setAssistantReply(firstReply);
      if (modeRef.current === "voice") speakText(firstReply);
      setCompletionRecorded(false);
      setTranscript("");
      transcriptRef.current = "";
      setResearch([]);
      setAssociatedAgentId(null);
      setProfileDirty(false);
      setConsented(true);
      setVoiceMessage("Onboarding is ready. Start speaking when you are.");
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "Could not start onboarding.");
    } finally {
      sessionStartInFlightRef.current = false;
      setIsStarting(false);
    }
  };

  const resumeOnboarding = async (id: string) => {
    if (resumeSessionInFlightRef.current === id) return;
    resumeSessionInFlightRef.current = id;
    setIsStarting(true);
    setVoiceMessage("");
    setSessionId("");
    setProfile(null);
    setConversationMessages([]);
    setUploadedDocuments([]);
    setAssociatedAgentId(null);
    setConsented(false);
    setCompletionRecorded(false);
    setTranscript("");
    transcriptRef.current = "";
    setAssistantReply("");
    setResearch([]);
    setProfileDirty(false);
    endedRef.current = false;
    try {
      const data = await onboardingRequest(`/sessions/${id}`);
      const savedTranscript: TranscriptTurn[] = data.transcript || [];
      const savedMessages: ConversationMessage[] = savedTranscript.flatMap<ConversationMessage>(turn => {
        if (typeof turn === "string") return [{ role: "user", content: turn }];
        if ((turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string") {
          return [{ role: turn.role, content: turn.content, sentAt: turn.sent_at }];
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
      setUploadedDocuments(data.documents || []);
      setAssistantReply(latestAssistantReply);
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
      if (resumeSessionInFlightRef.current === id) {
        resumeSessionInFlightRef.current = null;
        setIsStarting(false);
      }
    }
  };

  useEffect(() => {
    if (
      active
      && resumeSessionId
      && resumeSessionId !== sessionId
      && resumeSessionInFlightRef.current !== resumeSessionId
    ) {
      void resumeOnboarding(resumeSessionId);
    }
  }, [active, resumeSessionId, sessionId]);

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

  const createAgent = async () => {
    if (!sessionId || !profile || creationInFlightRef.current) return;
    creationInFlightRef.current = true;
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
      const fields = {
        ...reviewed.agent_fields,
        ...await onboardingRequest(`/sessions/${sessionId}/agent-fields`, { method: "POST" }),
      };
      const agent = await onCreateAgent(sessionId, fields, reviewed.profile, associatedAgentId);
      setAssociatedAgentId(agent.id);
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "The reviewed profile could not be saved.");
    } finally {
      creationInFlightRef.current = false;
      setIsSavingReview(false);
    }
  };

  const submitTurn = async (text: string) => {
    const normalizedText = text.trim();
    if (!sessionId || endedRef.current || !normalizedText || turnInFlightRef.current) return;
    const submittedMode = modeRef.current;
    const submittedModeEpoch = modeEpochRef.current;
    const sentAt = new Date().toISOString();
    turnInFlightRef.current = true;
    setConversationMessages(current => [...current, { role: "user", content: normalizedText, sentAt }]);
    setTranscript("");
    transcriptRef.current = "";
    setTextMessage("");
    setAssistantReply("");
    setIsProcessing(true);
    try {
      const data = await onboardingRequest(`/sessions/${sessionId}/turns`, {
        method: "POST",
        body: JSON.stringify({ text: normalizedText, sent_at: sentAt }),
      });
      setProfile(data.profile);
      setCompletionRecorded(Boolean(data.completion_recorded));
      setResearch(data.research || []);
      const assistantMessage = typeof data.assistant_reply === "string" ? data.assistant_reply.trim() : "";
      if (assistantMessage) {
        setConversationMessages(current => [...current, {
          role: "assistant",
          content: assistantMessage,
          sentAt: data.assistant_sent_at,
        }]);
      }
      if (typeof data.assistant_reply === "string" && data.assistant_reply.trim()) {
        setAssistantReply(data.assistant_reply);
        if (
          submittedMode === "voice"
          && modeRef.current === "voice"
          && modeEpochRef.current === submittedModeEpoch
          && !endedRef.current
          && activeRef.current
        ) {
          speakText(data.assistant_reply);
        }
        setVoiceMessage("Your profile is updated.");
      } else {
        setVoiceMessage("Your answer was saved, but no reply was returned. You can continue or resume this session later.");
      }
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "This turn could not be processed.");
    } finally {
      turnInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const submitTextMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitTurn(textMessage);
  };

  const uploadDocuments = async (files: FileList | null) => {
    if (!sessionId || !files?.length) return;
    setIsUploadingDocument(true);
    for (const file of Array.from(files)) {
      const extension = file.name.toLowerCase().split(".").pop();
      if (!["pdf", "doc", "docx"].includes(extension || "")) {
        setVoiceMessage("Only PDF and Word documents are supported.");
        continue;
      }
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        setVoiceMessage("Each document must be 2 MB or smaller.");
        continue;
      }
      const formData = new FormData();
      formData.append("file", file);
      try {
        const data = await onboardingRequest(`/sessions/${sessionId}/documents`, {
          method: "POST",
          body: formData,
        });
        setUploadedDocuments(current => [...current, {
          id: data.id,
          filename: data.filename,
          processed: Boolean(data.processed),
        }]);
        setVoiceMessage(data.processed
          ? `${file.name} added to the onboarding context.`
          : `${file.name} is stored for this session; its text could not be extracted.`);
      } catch (error) {
        setVoiceMessage(error instanceof Error ? error.message : "The document could not be uploaded.");
      }
    }
    setIsUploadingDocument(false);
    if (documentInputRef.current) documentInputRef.current.value = "";
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopVoicePlayback();
    };
  }, [stopVoicePlayback]);

  useEffect(() => {
    activeRef.current = active;
    if (active) {
      if (endedRef.current) {
        endedRef.current = false;
        setIsEnded(false);
        setVoiceMessage("Onboarding session resumed.");
      }
      return;
    }
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    transcriptRef.current = "";
    setTranscript("");
    setIsListening(false);
    stopVoicePlayback();
  }, [active, stopVoicePlayback]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [conversationMessages, transcript, isProcessing]);

  useEffect(() => {
    if (firstAssistantTimingRef.current === null || !conversationMessages.some(message => message.role === "assistant")) return;
    console.info(
      "[ONBOARDING START TIMING] session_to_first_assistant_render_ms",
      Math.round(performance.now() - firstAssistantTimingRef.current),
    );
    firstAssistantTimingRef.current = null;
  }, [conversationMessages]);

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
      if (endedRef.current || !activeRef.current) return;
      if (transcriptRef.current) {
        setTranscript(transcriptRef.current);
        setVoiceMessage("Processing your latest turn...");
        const turn = transcriptRef.current;
        void submitTurn(turn);
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
    stopVoicePlayback();
    setIsListening(false);
    setIsEnded(true);
    setVoiceMessage("Session ended. Your saved onboarding profile remains available.");
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background px-0 py-0 text-foreground sm:px-5 sm:py-5" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-5xl flex-col overflow-hidden bg-card shadow-sm sm:min-h-[calc(100vh-6rem)] sm:rounded-xl sm:border sm:border-border">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1e3a8a] bg-[#172554] px-4 py-3 text-white sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/favicon.svg" alt="VoxAgent" className="h-11 w-11 shrink-0 rounded-full bg-white object-contain" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-white sm:text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>
                VoxAgent
              </h1>
              <p className="text-xs text-blue-100/80">{isStarting ? "Starting your conversation" : sessionId ? "Configure your agent" : "Design an agent for your needs"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="relative grid h-9 grid-cols-2 rounded-full bg-[#1e3a8a] p-1 text-xs" role="group" aria-label="Conversation mode">
              <span className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-[#1d4ed8] shadow-sm transition-transform duration-200 ${mode === "voice" ? "translate-x-full" : "translate-x-0"}`} aria-hidden="true" />
              <button
                type="button"
                onClick={() => switchMode("chat")}
                aria-pressed={mode === "chat"}
                className={`relative z-10 min-w-[4.25rem] rounded-full px-3 font-medium transition-colors ${mode === "chat" ? "text-white" : "text-blue-100"}`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => switchMode("voice")}
                aria-pressed={mode === "voice"}
                className={`relative z-10 min-w-[4.25rem] rounded-full px-3 font-medium transition-colors ${mode === "voice" ? "text-white" : "text-blue-100"}`}
              >
                Voice
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-100" role="status">
              {isStarting || isProcessing ? <span className="h-2 w-2 animate-pulse rounded-full bg-chart-5" /> : <span className={`h-2 w-2 rounded-full ${sessionId && !isEnded ? "bg-blue-300" : "bg-blue-100/50"}`} />}
              <span className="hidden text-[11px] sm:inline sm:text-xs">{isStarting ? "Starting" : isProcessing ? "Updating" : isListening ? "Listening" : isSpeaking ? "Speaking" : isEnded ? "Ended" : sessionId ? "Active" : "Not connected"}</span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {consented && (
            <div
              ref={conversationRef}
              className="min-h-[18rem] flex-1 space-y-3 overflow-y-auto bg-[#efeae2] px-3 py-5 sm:px-7 sm:py-7"
              aria-live="polite"
              aria-label="Conversation"
            >
              {conversationMessages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && <img src="/favicon.svg" alt="" className="mt-1 h-7 w-7 shrink-0 rounded-full bg-[#dbeafe] object-contain" />}
                  <div
                    className={`w-fit max-w-[88%] rounded-xl border px-3.5 py-2.5 shadow-sm sm:max-w-[75%] sm:px-4 ${message.role === "user"
                      ? "rounded-tr-sm border-[#bfdbfe] bg-[#dbeafe] text-[#172554]"
                      : "rounded-tl-sm border-white bg-white text-[#172554]"}`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                    <p className="mt-1 text-right text-[10px] text-slate-600">
                      {[message.role === "assistant" ? "VoxAgent" : "", message.sentAt
                        ? new Date(message.sentAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                        : ""].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}

              {!sessionId && isStarting && (
                <div className="flex items-start gap-2" role="status" aria-live="polite">
                  <img src="/favicon.svg" alt="" className="mt-1 h-7 w-7 shrink-0 rounded-full bg-[#dbeafe] object-contain" />
                  <div className="w-fit rounded-xl rounded-tl-sm border border-white bg-white px-3.5 py-2.5 text-sm text-[#334e68] shadow-sm">
                    Starting your secure onboarding session...
                  </div>
                </div>
              )}

              {!sessionId && !isStarting && voiceMessage && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#fecaca] bg-[#fff1f2] p-3" role="alert">
                  <p className="min-w-0 flex-1 text-sm text-[#9f1239]">{voiceMessage}</p>
                  <button
                    type="button"
                    onClick={() => void beginOnboarding()}
                    disabled={isStarting}
                    className="rounded-md bg-[#0369a1] px-3 py-2 text-sm font-medium text-white hover:bg-[#075985] disabled:opacity-50"
                  >
                    Retry
                  </button>
                </div>
              )}

              {transcript && (
                <div className="ml-auto w-fit max-w-[88%] rounded-xl rounded-tr-sm border border-[#bfdbfe] bg-[#dbeafe] px-3.5 py-2.5 opacity-80 shadow-sm sm:max-w-[75%] sm:px-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#172554]">{transcript}</p>
                  <p className="mt-1 text-right text-[10px] text-slate-600">Listening</p>
                </div>
              )}

              {isProcessing && (
                <div className="mr-auto w-fit rounded-xl rounded-tl-sm border border-white bg-white px-4 py-3 text-xs text-slate-600 shadow-sm" role="status">
                  Updating your profile...
                </div>
              )}
            </div>
          )}

          {consented && (
            <div className="shrink-0 border-t border-[#d6d3d1] bg-[#f8fafc] px-3 py-3 sm:px-5">
              <form onSubmit={submitTextMessage} className="flex items-end gap-1.5 sm:gap-2">
                <div className="flex min-h-12 min-w-0 flex-1 items-end gap-1 rounded-3xl bg-white px-2 shadow-sm ring-1 ring-[#cbd5e1] sm:px-3">
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  className="hidden"
                  onChange={event => void uploadDocuments(event.currentTarget.files)}
                />
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  disabled={!sessionId || isEnded || isProcessing || isUploadingDocument}
                  aria-label="Attach PDF or Word document"
                  title="Attach PDF or Word document"
                  className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748b] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Paperclip className="h-5 w-5" aria-hidden="true" />
                </button>
                <textarea
                  rows={1}
                  value={textMessage}
                  onChange={event => setTextMessage(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  disabled={!sessionId || isEnded || isProcessing || isListening}
                  placeholder="Type a message"
                  aria-label="Type a message"
                  className="max-h-32 min-h-12 min-w-0 flex-1 resize-y bg-transparent px-2 py-3 text-sm leading-5 text-[#172554] outline-none placeholder:text-[#64748b] disabled:cursor-not-allowed disabled:opacity-50"
                />
                </div>
                <button
                  type="button"
                  onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
                  disabled={!Recognition || isEnded || !sessionId || isProcessing}
                  aria-label={isListening ? "Stop listening" : "Start speaking"}
                  title={isListening ? "Stop listening" : "Start speaking"}
                  className={`mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isListening ? "bg-[#fee2e2] text-[#b91c1c]" : "bg-white text-[#1d4ed8] hover:bg-[#eff6ff]"}`}
                >
                  {isListening ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
                </button>
                <button
                  type="submit"
                  disabled={!sessionId || isEnded || isProcessing || !textMessage.trim()}
                  aria-label="Send message"
                  title="Send message"
                  className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] text-white transition-colors hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
              {uploadedDocuments.length > 0 && (
                <p className="mt-2 truncate px-2 text-xs text-[#64748b]" title={uploadedDocuments.map(document => document.filename).join(", ")}>
                  {uploadedDocuments.map(document => document.filename).join(" · ")}
                </p>
              )}
            </div>
          )}

            {!consented ? (
              <div className="flex flex-1 items-center justify-center px-4 py-10">
                <button
                  type="button"
                  onClick={beginOnboarding}
                  disabled={isStarting}
                  className="min-w-40 rounded-md bg-[#1d4ed8] px-8 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStarting ? "Starting..." : "Start"}
                </button>
              </div>
            ) : (
              <>
                {profile && completionRecorded && (
                  <section className="mx-3 mb-4 rounded-lg border border-[#93c5fd] bg-[#eaf6ff] p-4 text-[#102a43] shadow-sm sm:mx-5 sm:p-5" aria-label="Business profile">
                    <h2 className="text-sm font-semibold text-[#102a43]">Review agent profile</h2>
                    <p className="mt-1 text-xs text-[#334e68]">Correct any details before they are used to configure the agent.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {editableProfileFields.map(field => {
                        const value = profile[field];
                        const label = field.replace(/_/g, " ").replace(/^./, (char: string) => char.toUpperCase());
                        const textValue = Array.isArray(value) ? value.join("\n") : value || "";
                        return (
                          <label key={field} className="text-xs capitalize text-[#24415f]">
                            {label}
                            {listProfileFields.has(field) ? (
                              <textarea
                                rows={2}
                                value={textValue}
                                onChange={event => updateProfileField(field, event.target.value)}
                                className="mt-1 block w-full rounded-md border border-[#93c5fd] bg-white px-3 py-2 text-sm normal-case text-[#102a43] outline-none placeholder:text-[#627d98] focus:border-[#0284c7] focus:ring-2 focus:ring-[#7dd3fc]"
                              />
                            ) : (
                              <input
                                value={textValue}
                                onChange={event => updateProfileField(field, event.target.value)}
                                className="mt-1 block w-full rounded-md border border-[#93c5fd] bg-white px-3 py-2 text-sm normal-case text-[#102a43] outline-none placeholder:text-[#627d98] focus:border-[#0284c7] focus:ring-2 focus:ring-[#7dd3fc]"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {profile.unresolved_questions.length > 0 && <p className="mt-3 text-xs text-[#334e68]">Open details: {profile.unresolved_questions.join(" · ")}</p>}
                    {profile.conflicts.length > 0 && <p className="mt-2 text-xs text-[#b42318]">Conflicting statements: {profile.conflicts.map(conflict => conflict.statement).join(" · ")}</p>}
                  </section>
                )}

                {profile && completionRecorded && (
                  <div className="mx-3 mb-4 rounded-lg border border-[#93c5fd] bg-[#dbeeff] px-4 py-3 sm:mx-5">
                    <button
                      type="button"
                      onClick={() => void createAgent()}
                      disabled={isSavingReview || (!completionRecorded && !associatedAgentId)}
                      className="rounded-md bg-[#0284c7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0369a1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#dbeeff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingReview ? "Saving profile..." : associatedAgentId ? "Save profile and choose voice" : "Confirm profile and choose voice"}
                    </button>
                  </div>
                )}

              </>
            )}

            <div className="flex flex-col items-center gap-3 border-t border-[#d6d3d1] bg-[#f8fafc] px-4 py-4">
              <p aria-live="polite" className={`min-h-5 text-center text-sm ${voiceMessage && /failed|unavailable|could not|denied|error|expired/i.test(voiceMessage) ? "text-[#b91c1c]" : "text-[#475569]"}`}>
                {voiceMessage || (!Recognition
                  ? "Speech recognition is not supported here. You can type instead."
                  : !consented
                    ? "Ready to begin."
                    : isStarting
                      ? "Preparing your secure onboarding session..."
                      : !sessionId
                        ? "Onboarding could not start. Retry to continue."
                    : "Speak naturally; your agent profile updates as you share details.")}
              </p>
              {consented && mode === "voice" && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={replayAssistantReply}
                    disabled={!assistantReply || !consented || !speechOutputAvailable || isEnded || isStarting}
                    aria-label={assistantReply ? "Replay assistant reply" : "Play greeting aloud"}
                    title={assistantReply ? "Replay assistant reply" : "Play greeting aloud"}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-[#1e3a8a] transition-colors hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={endSession}
                    disabled={isEnded || !sessionId || isStarting}
                    className="flex h-10 items-center gap-2 rounded-full border border-[#fecaca] bg-[#fef2f2] px-4 text-sm font-medium text-[#b91c1c] transition-colors hover:bg-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PhoneOff className="h-4 w-4" aria-hidden="true" />
                    End Session
                  </button>
                </div>
              )}
              <p className="max-w-2xl text-center text-xs text-[#64748b]">Browser speech recognition may use its own service. Only recognized text is sent for onboarding; microphone audio is not uploaded.</p>
            </div>
        </div>
      </section>
    </main>
  );
}
