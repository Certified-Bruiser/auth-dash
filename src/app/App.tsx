import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from '../lib/supabase'
import {
  Mic, Volume2, Brain, Database, MessageSquare, Wrench, Shield,
  Play, Upload, Search, Plus, Trash2, Copy, CheckCircle, Clock,
  AlertCircle, X, ArrowLeft, ArrowRight, Globe, Lock, Zap,
  Phone, StopCircle, Send, BookOpen, Link, FileText, Tag,
  Code, Calendar, Star, Activity, Headphones, Check,
  ChevronDown, ChevronRight, ChevronUp, Info, MoreVertical,
  Sparkles, Eye, BarChart2, RefreshCw, User, Key, Layers,
  SlidersHorizontal, Settings, Radio, Filter, ExternalLink,
  Cpu, Wand2, PlayCircle, PauseCircle, Mic2, Bot, Gauge,
  ToggleLeft, ToggleRight, Hash, Bell, Power, Download
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type AgentStatus = "draft" | "testing" | "published";
type View = "dashboard" | "wizard" | "use-agent";

interface Agent {
  id: string;
  name: string;
  description: string;
  agentType: string;
  status: AgentStatus;
  sttProvider: string;
  sttModel: string;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  ttsModel: string;
  voice: string;
  language: string;
  lastUpdated: string;
  totalCalls: number;
  personality: string;
  tone: string;
}

interface AgentForm {
  name: string;
  description: string;
  agentType: string;
  purpose: string;
  systemInstructions: string;
  personality: string;
  tone: string;
  conversationStyle: string;
  goals: string;
  sttProvider: string;
  sttModel: string;
  llmProvider: string;
  llmModel: string;
  llmTemperature: number;
  llmMaxTokens: number;
  ttsProvider: string;
  ttsModel: string;
  voice: string;
  language: string;
  accent: string;
  speakingSpeed: number;
  pitch: number;
  voiceStyle: string;
  knowledgeSources: KnowledgeSource[];
  greeting: string;
  fallbackMessage: string;
  fallbackBehavior: string;
  interruptionHandling: string;
  responseDelayMs: number;
  silenceTimeoutSec: number;
  maxConversationMin: number;
  endMessage: string;
  enabledTools: string[];
  memoryType: string;
  persistentMemory: boolean;
  userMemory: boolean;
  retentionDays: number;
  allowedTopics: string[];
  restrictedTopics: string[];
  escalationRules: string;
  humanHandoffConditions: string;
  requireConfirmation: boolean;
  gdprCompliant: boolean;
  status: AgentStatus;
}

interface KnowledgeSource {
  id: string;
  type: "document" | "url" | "faq";
  name: string;
  value: string;
  status: "processing" | "ready" | "error";
}

interface TestMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  latency?: number;
}

interface GeneratedPrompt {
  purpose: string;
  systemInstructions: string;
  goals: string;
  allowedTopics?: string[];
  restrictedTopics?: string[];
  escalationRules?: string;
  humanHandoffConditions?: string;
  suggestions: string[];
}

// ─── PROVIDER DATA ────────────────────────────────────────────────────────────

let STT_PROVIDERS: Record<string, { name: string; badge: string; models: { id: string; name: string }[] }> = {
  openai: {
    name: "OpenAI Whisper", badge: "OAI",
    models: [{ id: "whisper-1", name: "Whisper-1" }, { id: "whisper-large-v3", name: "Whisper Large v3" }],
  },
  deepgram: {
    name: "Deepgram", badge: "DG",
    models: [
      { id: "nova-2", name: "Nova-2" },
      { id: "nova-2-general", name: "Nova-2 General" },
      { id: "nova-2-phonecall", name: "Nova-2 Phone Call" },
      { id: "enhanced-general", name: "Enhanced General" },
    ],
  },
  assemblyai: {
    name: "AssemblyAI", badge: "AAI",
    models: [{ id: "best", name: "Conformer-2 (Best)" }, { id: "nano", name: "Conformer-1 (Nano)" }],
  },
  google_stt: {
    name: "Google Speech", badge: "GCP",
    models: [{ id: "latest_long", name: "Latest Long" }, { id: "latest_short", name: "Latest Short" }],
  },
  azure_stt: {
    name: "Azure Speech", badge: "AZ",
    models: [{ id: "standard", name: "Standard" }, { id: "premium", name: "Neural Premium" }],
  },
};

let LLM_PROVIDERS: Record<string, { name: string; badge: string; models: { id: string; name: string; context: string }[] }> = {
  openai: {
    name: "OpenAI", badge: "OAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", context: "128K" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", context: "128K" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", context: "128K" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", context: "16K" },
    ],
  },
  anthropic: {
    name: "Anthropic", badge: "ANT",
    models: [
      { id: "claude-opus-5", name: "Claude Opus 5", context: "200K" },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", context: "200K" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", context: "200K" },
    ],
  },
  google: {
    name: "Google Gemini", badge: "GEM",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context: "1M" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", context: "1M" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", context: "1M" },
    ],
  },
  mistral: {
    name: "Mistral AI", badge: "MST",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large", context: "128K" },
      { id: "mistral-medium-latest", name: "Mistral Medium", context: "32K" },
      { id: "mistral-small-latest", name: "Mistral Small", context: "32K" },
    ],
  },
  groq: {
    name: "Groq", badge: "GRQ",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", context: "128K" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", context: "32K" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B", context: "8K" },
    ],
  },
};

interface VoiceOption { id: string; name: string; gender: string; accent: string; style: string }
let TTS_PROVIDERS: Record<string, {
  name: string; badge: string;
  models: { id: string; name: string }[];
  voices: Record<string, VoiceOption[]>;
}> = {
  elevenlabs: {
    name: "ElevenLabs", badge: "EL",
    models: [
      { id: "eleven_monolingual_v1", name: "Monolingual v1" },
      { id: "eleven_multilingual_v2", name: "Multilingual v2" },
      { id: "eleven_turbo_v2", name: "Turbo v2" },
    ],
    voices: {
      eleven_monolingual_v1: [
        { id: "rachel", name: "Rachel", gender: "Female", accent: "American", style: "Calm" },
        { id: "bella", name: "Bella", gender: "Female", accent: "American", style: "Soft" },
        { id: "elli", name: "Elli", gender: "Female", accent: "American", style: "Expressive" },
        { id: "adam", name: "Adam", gender: "Male", accent: "American", style: "Deep" },
        { id: "josh", name: "Josh", gender: "Male", accent: "American", style: "Warm" },
        { id: "sam", name: "Sam", gender: "Male", accent: "American", style: "Raspy" },
        { id: "arnold", name: "Arnold", gender: "Male", accent: "American", style: "Crisp" },
        { id: "domi", name: "Domi", gender: "Female", accent: "American", style: "Strong" },
      ],
      eleven_multilingual_v2: [
        { id: "freya", name: "Freya", gender: "Female", accent: "American", style: "Energetic" },
        { id: "grace", name: "Grace", gender: "Female", accent: "Southern US", style: "Gentle" },
        { id: "serena", name: "Serena", gender: "Female", accent: "American", style: "Pleasant" },
        { id: "nicole", name: "Nicole", gender: "Female", accent: "American", style: "Whisper" },
        { id: "liam", name: "Liam", gender: "Male", accent: "American", style: "Articulate" },
        { id: "daniel", name: "Daniel", gender: "Male", accent: "British", style: "Deep" },
        { id: "jeremy", name: "Jeremy", gender: "Male", accent: "Irish", style: "Casual" },
        { id: "michael", name: "Michael", gender: "Male", accent: "American", style: "Neutral" },
        { id: "charlotte", name: "Charlotte", gender: "Female", accent: "British", style: "Professional" },
      ],
      eleven_turbo_v2: [
        { id: "rachel", name: "Rachel", gender: "Female", accent: "American", style: "Calm" },
        { id: "adam", name: "Adam", gender: "Male", accent: "American", style: "Deep" },
        { id: "bella", name: "Bella", gender: "Female", accent: "American", style: "Soft" },
        { id: "josh", name: "Josh", gender: "Male", accent: "American", style: "Warm" },
      ],
    },
  },
  openai_tts: {
    name: "OpenAI TTS", badge: "OAI",
    models: [
      { id: "tts-1", name: "TTS-1 (Standard)" },
      { id: "tts-1-hd", name: "TTS-1-HD (High Quality)" },
    ],
    voices: {
      "tts-1": [
        { id: "alloy", name: "Alloy", gender: "Neutral", accent: "American", style: "Balanced" },
        { id: "echo", name: "Echo", gender: "Male", accent: "American", style: "Smooth" },
        { id: "fable", name: "Fable", gender: "Male", accent: "British", style: "Expressive" },
        { id: "onyx", name: "Onyx", gender: "Male", accent: "American", style: "Deep" },
        { id: "nova", name: "Nova", gender: "Female", accent: "American", style: "Energetic" },
        { id: "shimmer", name: "Shimmer", gender: "Female", accent: "American", style: "Soft" },
      ],
      "tts-1-hd": [
        { id: "alloy", name: "Alloy", gender: "Neutral", accent: "American", style: "Balanced" },
        { id: "echo", name: "Echo", gender: "Male", accent: "American", style: "Smooth" },
        { id: "fable", name: "Fable", gender: "Male", accent: "British", style: "Expressive" },
        { id: "onyx", name: "Onyx", gender: "Male", accent: "American", style: "Deep" },
        { id: "nova", name: "Nova", gender: "Female", accent: "American", style: "Energetic" },
        { id: "shimmer", name: "Shimmer", gender: "Female", accent: "American", style: "Soft" },
      ],
    },
  },
  google_tts: {
    name: "Google Cloud TTS", badge: "GCP",
    models: [
      { id: "standard", name: "Standard" },
      { id: "wavenet", name: "WaveNet" },
      { id: "neural2", name: "Neural2" },
    ],
    voices: {
      standard: [
        { id: "en-US-Std-A", name: "US Standard A", gender: "Female", accent: "American", style: "Standard" },
        { id: "en-US-Std-B", name: "US Standard B", gender: "Male", accent: "American", style: "Standard" },
        { id: "en-GB-Std-A", name: "GB Standard A", gender: "Female", accent: "British", style: "Standard" },
        { id: "en-GB-Std-B", name: "GB Standard B", gender: "Male", accent: "British", style: "Standard" },
      ],
      wavenet: [
        { id: "en-US-Wav-A", name: "US WaveNet A", gender: "Female", accent: "American", style: "Natural" },
        { id: "en-US-Wav-B", name: "US WaveNet B", gender: "Male", accent: "American", style: "Natural" },
        { id: "en-GB-Wav-A", name: "GB WaveNet A", gender: "Female", accent: "British", style: "Natural" },
        { id: "en-AU-Wav-A", name: "AU WaveNet A", gender: "Female", accent: "Australian", style: "Natural" },
      ],
      neural2: [
        { id: "en-US-N2-A", name: "US Neural2 A", gender: "Female", accent: "American", style: "Advanced" },
        { id: "en-US-N2-C", name: "US Neural2 C", gender: "Female", accent: "American", style: "Advanced" },
        { id: "en-US-N2-D", name: "US Neural2 D", gender: "Male", accent: "American", style: "Advanced" },
      ],
    },
  },
  azure_tts: {
    name: "Azure Neural TTS", badge: "AZ",
    models: [
      { id: "neural", name: "Neural" },
      { id: "neural-hd", name: "Neural HD" },
    ],
    voices: {
      neural: [
        { id: "en-US-AriaNeural", name: "Aria", gender: "Female", accent: "American", style: "Friendly" },
        { id: "en-US-GuyNeural", name: "Guy", gender: "Male", accent: "American", style: "Friendly" },
        { id: "en-US-JennyNeural", name: "Jenny", gender: "Female", accent: "American", style: "Casual" },
        { id: "en-US-DavisNeural", name: "Davis", gender: "Male", accent: "American", style: "Casual" },
        { id: "en-GB-LibbyNeural", name: "Libby", gender: "Female", accent: "British", style: "Friendly" },
        { id: "en-GB-RyanNeural", name: "Ryan", gender: "Male", accent: "British", style: "Professional" },
      ],
      "neural-hd": [
        { id: "en-US-AriaNeural", name: "Aria", gender: "Female", accent: "American", style: "Friendly" },
        { id: "en-US-JennyNeural", name: "Jenny", gender: "Female", accent: "American", style: "Casual" },
        { id: "en-US-DavisNeural", name: "Davis", gender: "Male", accent: "American", style: "Casual" },
      ],
    },
  },
  playht: {
    name: "PlayHT", badge: "PHT",
    models: [
      { id: "PlayDialog", name: "PlayDialog" },
      { id: "Play3.0-mini", name: "Play 3.0 Mini" },
    ],
    voices: {
      PlayDialog: [
        { id: "donna", name: "Donna", gender: "Female", accent: "American", style: "Professional" },
        { id: "dexter", name: "Dexter", gender: "Male", accent: "American", style: "Professional" },
        { id: "valentino", name: "Valentino", gender: "Male", accent: "Italian", style: "Expressive" },
        { id: "theodora", name: "Theodora", gender: "Female", accent: "British", style: "Warm" },
      ],
      "Play3.0-mini": [
        { id: "donna", name: "Donna", gender: "Female", accent: "American", style: "Professional" },
        { id: "dexter", name: "Dexter", gender: "Male", accent: "American", style: "Professional" },
      ],
    },
  },
};

function applyProviderCatalog(catalog: {
  stt: { id: string; name: string; models?: string[] }[];
  llm: { id: string; name: string; models?: string[] }[];
  tts: { id: string; name: string; models?: string[]; voices?: string[] }[];
}) {
  STT_PROVIDERS = Object.fromEntries(catalog.stt.map(provider => [provider.id, {
    name: provider.name,
    badge: provider.id.toUpperCase().slice(0, 3),
    models: (provider.models || []).map(id => ({ id, name: id })),
  }]));

  LLM_PROVIDERS = Object.fromEntries(catalog.llm.map(provider => [provider.id, {
    name: provider.name,
    badge: provider.id.toUpperCase().slice(0, 3),
    models: (provider.models || []).map(id => ({ id, name: id, context: "" })),
  }]));

  TTS_PROVIDERS = Object.fromEntries(catalog.tts.map(provider => [provider.id, {
    name: provider.name,
    badge: provider.id.toUpperCase().slice(0, 3),
    models: (provider.models || []).map(id => ({ id, name: id })),
    voices: (provider.models || []).reduce<Record<string, VoiceOption[]>>((voices, model) => {
      voices[model] = (provider.voices || []).map(id => ({
        id,
        name: id,
        gender: "",
        accent: "",
        style: "",
      }));
      return voices;
    }, {}),
  }]));
}

applyProviderCatalog({
  stt: [{ id: "sarvam", name: "Sarvam Streaming", models: ["saaras:v3"] }],
  llm: [{ id: "perplexity", name: "Perplexity Sonar", models: ["sonar"] }],
  tts: [
    { id: "piper", name: "Piper", models: [], voices: [] },
    { id: "sarvam", name: "Sarvam Streaming", models: ["bulbul:v3"], voices: ["rahul"] },
  ],
});

const AVAILABLE_TOOLS = [
  { id: "calendar", name: "Calendar & Scheduling", icon: Calendar, description: "Book meetings, check availability, manage appointments", badge: "Popular" },
  { id: "crm", name: "CRM Integration", icon: User, description: "Sync contacts, log calls, update records in Salesforce/HubSpot", badge: "" },
  { id: "webhook", name: "Webhooks", icon: Zap, description: "Trigger custom HTTP requests on conversation events", badge: "" },
  { id: "database", name: "Database Lookup", icon: Database, description: "Query SQL/NoSQL databases for real-time data", badge: "" },
  { id: "api", name: "Custom REST API", icon: Code, description: "Call any external REST API with custom auth headers", badge: "" },
  { id: "email", name: "Email", icon: Send, description: "Send transactional emails during conversations", badge: "" },
  { id: "knowledge", name: "Web Search", icon: Search, description: "Search the web for up-to-date information", badge: "" },
  { id: "documents", name: "Document Generation", icon: FileText, description: "Generate and send PDFs, contracts, quotes", badge: "" },
];

const WIZARD_STEPS = [
  { id: 0, label: "Basics", icon: Wand2, group: "configure" },
  { id: 1, label: "AI Models", icon: Cpu, group: "configure" },
  { id: 2, label: "Voice", icon: Volume2, group: "configure" },
  { id: 3, label: "Knowledge", icon: BookOpen, group: "configure" },
  { id: 4, label: "Conversation", icon: MessageSquare, group: "configure" },
  { id: 5, label: "Tools", icon: Wrench, group: "configure" },
  { id: 6, label: "Memory", icon: Brain, group: "configure" },
  { id: 7, label: "Security", icon: Shield, group: "configure" },
  { id: 8, label: "Test", icon: PlayCircle, group: "test" },
  { id: 9, label: "Publish", icon: Zap, group: "publish" },
];

const defaultForm: AgentForm = {
  name: "", description: "", agentType: "customer-support", purpose: "",
  systemInstructions: "",
  personality: "friendly", tone: "warm", conversationStyle: "conversational", goals: "",
  sttProvider: "sarvam", sttModel: "saaras:v3",
  llmProvider: "perplexity", llmModel: "sonar", llmTemperature: 0.7, llmMaxTokens: 512,
  ttsProvider: "sarvam", ttsModel: "bulbul:v3",
  voice: "rahul", language: "en", accent: "american", speakingSpeed: 1.0, pitch: 0, voiceStyle: "conversational",
  knowledgeSources: [],
  greeting: "Hi there! How can I help you today?", fallbackMessage: "I'm sorry, I didn't catch that. Could you say that again?",
  fallbackBehavior: "ask-again", interruptionHandling: "pause-and-listen",
  responseDelayMs: 300, silenceTimeoutSec: 8, maxConversationMin: 20,
  endMessage: "Thanks for reaching out! Have a great day.",
  enabledTools: [],
  memoryType: "short-term", persistentMemory: false, userMemory: false, retentionDays: 7,
  allowedTopics: [], restrictedTopics: [], escalationRules: "", humanHandoffConditions: "",
  requireConfirmation: false, gdprCompliant: true,
  status: "draft",
};

// ─── UI UTILITIES ─────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const API_BASE_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";
const AOS_USER_ID_KEY = "aos_user_id";

function generateAosUserId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * alphabet.length);
    }
  }

  let value = "AOS-";
  for (let index = 0; index < bytes.length; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }

  return value;
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "Backend request failed");
  }

  return data;
}

function mapAgent(data: any): Agent {
  return {
    ...data,
    status: String(data.status || "draft").toLowerCase() as AgentStatus,
    lastUpdated: data.updated_at?.split("T")[0] || data.lastUpdated || "",
    totalCalls: data.totalCalls || 0,
  } as Agent;
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const map = {
    draft: "bg-[#1a2030] text-[#636680] border border-[rgba(99,102,241,0.2)]",
    testing: "bg-[#1c1a08] text-[#f59e0b] border border-[rgba(245,158,11,0.25)]",
    published: "bg-[#071a12] text-[#22c55e] border border-[rgba(34,197,94,0.25)]",
  };
  const icons = { draft: Clock, testing: AlertCircle, published: CheckCircle };
  const Icon = icons[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium font-mono", map[status])}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("block text-sm font-medium text-[#b4b8cc] mb-1.5", className)}>{children}</label>;
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full px-3 py-2 bg-[#111520] border border-[rgba(99,102,241,0.18)] rounded-md text-[#e2e4ef] placeholder-[#3d4060]",
        "text-sm focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors",
        className
      )}
    />
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full px-3 py-2 bg-[#111520] border border-[rgba(99,102,241,0.18)] rounded-md text-[#e2e4ef] placeholder-[#3d4060]",
        "text-sm focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors resize-none",
        className
      )}
    />
  );
}

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full px-3 py-2 bg-[#111520] border border-[rgba(99,102,241,0.18)] rounded-md text-[#e2e4ef]",
        "text-sm focus:outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors appearance-none",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_10px_center]",
        className
      )}
    />
  );
}

function RangeSlider({ label, value, min, max, step = 0.1, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="mb-0">{label}</Label>
        <span className="text-xs font-mono text-[#6366f1]">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-[#1a2030] cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#6366f1] [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-[rgba(99,102,241,0.3)]"
      />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[#3d4060]">{min}{unit}</span>
        <span className="text-xs text-[#3d4060]">{max}{unit}</span>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex items-center gap-2 cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={cn(
        "w-10 h-5 rounded-full transition-colors duration-200 relative",
        checked ? "bg-[#6366f1]" : "bg-[#1a2030] border border-[rgba(99,102,241,0.2)]"
      )}>
        <div className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0.5"
        )} />
      </div>
      {label && <span className="text-sm text-[#b4b8cc]">{label}</span>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 rounded-lg bg-[#1a2030] border border-[rgba(99,102,241,0.2)] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#6366f1]" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h3>
        {subtitle && <p className="text-sm text-[#636680] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function ProviderCard({ id, name, badge, selected, onClick }: {
  id: string; name: string; badge: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all",
        selected
          ? "border-[#6366f1] bg-[rgba(99,102,241,0.12)] text-[#e2e4ef]"
          : "border-[rgba(99,102,241,0.14)] bg-[#111520] text-[#636680] hover:border-[rgba(99,102,241,0.3)] hover:text-[#b4b8cc]"
      )}
    >
      <span className={cn(
        "w-8 h-8 rounded flex items-center justify-center text-xs font-bold font-mono flex-shrink-0",
        selected ? "bg-[#6366f1] text-white" : "bg-[#1a2030] text-[#636680]"
      )}>{badge}</span>
      <span className="text-sm font-medium">{name}</span>
      {selected && <Check className="w-3.5 h-3.5 text-[#6366f1] ml-auto" />}
    </button>
  );
}

function TagInput({ tags, onAdd, onRemove, placeholder }: {
  tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const handleKey = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  };
  return (
    <div className="min-h-[42px] flex flex-wrap gap-1.5 px-2 py-2 bg-[#111520] border border-[rgba(99,102,241,0.18)] rounded-md focus-within:ring-1 focus-within:ring-[#6366f1] focus-within:border-[#6366f1] transition-colors">
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[rgba(99,102,241,0.15)] text-[#a78bfa] text-xs rounded">
          {t}
          <button onClick={() => onRemove(t)} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
        </span>
      ))}
      <input
        value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-[#e2e4ef] placeholder-[#3d4060] outline-none"
      />
    </div>
  );
}

// ─── WIZARD STEPS ─────────────────────────────────────────────────────────────

interface StepProps { form: AgentForm; onChange: (updates: Partial<AgentForm>) => void; onGenerate?: () => void }

function PromptGeneratorModal({
  form,
  open,
  onClose,
  onApply,
}: {
  form: AgentForm;
  open: boolean;
  onClose: () => void;
  onApply: (prompt: GeneratedPrompt) => void;
}) {
  const [mode, setMode] = useState<"generate" | "improve" | null>(null);
  const [result, setResult] = useState<GeneratedPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateResult = <K extends keyof GeneratedPrompt>(field: K, value: GeneratedPrompt[K]) => {
    setResult(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  useEffect(() => {
    if (open) {
      setMode(null);
      setResult(null);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const generate = async (selectedMode: "generate" | "improve") => {
    setMode(selectedMode);
    setLoading(true);
    setError("");
    try {
      const generated = await apiRequest("/prompt-generator", {
        method: "POST",
        body: JSON.stringify({ mode: selectedMode, configuration: form }),
      });
      setResult(generated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate prompt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal="true" aria-labelledby="prompt-generator-title">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d101a] border border-[rgba(99,102,241,0.3)] rounded-xl shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(99,102,241,0.14)]">
          <Sparkles className="w-5 h-5 text-[#a78bfa]" />
          <h2 id="prompt-generator-title" className="text-base font-semibold text-[#e2e4ef]">Prompt Generator</h2>
          <button onClick={onClose} className="ml-auto text-[#636680] hover:text-[#e2e4ef]" aria-label="Close prompt generator"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!result && !loading && (
            <>
              <p className="text-sm text-[#b4b8cc]">Use your Agent Basics fields to create or refine the three prompt sections.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => void generate("generate")} className="p-4 text-left bg-[#111520] border border-[rgba(99,102,241,0.18)] rounded-lg hover:border-[#6366f1] transition-colors">
                  <span className="block text-sm font-medium text-[#e2e4ef]">Generate from scratch</span>
                  <span className="block mt-1 text-xs text-[#636680]">Create all three sections from your agent context.</span>
                </button>
                <button onClick={() => void generate("improve")} className="p-4 text-left bg-[#111520] border border-[rgba(99,102,241,0.18)] rounded-lg hover:border-[#6366f1] transition-colors">
                  <span className="block text-sm font-medium text-[#e2e4ef]">Improve existing prompt</span>
                  <span className="block mt-1 text-xs text-[#636680]">Clarify and strengthen your current sections.</span>
                </button>
              </div>
            </>
          )}
          {loading && <p className="py-8 text-center text-sm text-[#b4b8cc]">Generating with your selected LLM...</p>}
          {error && <p className="text-sm text-[#f87171]">{error}</p>}
          {result && !loading && (
            <>
              <p className="text-xs text-[#636680]">Review the generated content before applying it to your form.</p>
              {(["purpose", "systemInstructions", "goals"] as const).map(field => (
                <div key={field}>
                  <Label>{field === "purpose" ? "Purpose & Context" : field === "systemInstructions" ? "System Instructions" : "Goals & Success Criteria"}</Label>
                  <Textarea rows={field === "systemInstructions" ? 6 : 3} value={result[field]} onChange={event => updateResult(field, event.target.value)} />
                </div>
              ))}
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Allowed Topics</Label>
                  <TagInput
                    tags={result.allowedTopics || []}
                    onAdd={t => updateResult("allowedTopics", [...(result.allowedTopics || []), t])}
                    onRemove={t => updateResult("allowedTopics", (result.allowedTopics || []).filter(x => x !== t))}
                    placeholder="e.g. appointment availability, rescheduling"
                  />
                </div>
                <div>
                  <Label>Restricted Topics</Label>
                  <TagInput
                    tags={result.restrictedTopics || []}
                    onAdd={t => updateResult("restrictedTopics", [...(result.restrictedTopics || []), t])}
                    onRemove={t => updateResult("restrictedTopics", (result.restrictedTopics || []).filter(x => x !== t))}
                    placeholder="e.g. legal advice, unrelated financial matters"
                  />
                </div>
                <div>
                  <Label>Escalation Rules</Label>
                  <Textarea rows={3} value={result.escalationRules || ""} onChange={event => updateResult("escalationRules", event.target.value)} placeholder="e.g. Escalate when the user requests a human or if a policy issue is outside the agent's scope." />
                </div>
                <div>
                  <Label>Human Handoff Conditions</Label>
                  <Textarea rows={2} value={result.humanHandoffConditions || ""} onChange={event => updateResult("humanHandoffConditions", event.target.value)} placeholder="e.g. Transfer the user to a live agent when they say 'speak to a person' or if the issue is sensitive or escalated." />
                </div>
              </div>
              {result.suggestions.length > 0 && <div className="p-3 bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] rounded-md"><p className="text-xs font-medium text-[#fbbf24]">Suggestions</p><ul className="mt-1 space-y-1 text-xs text-[#b4b8cc]">{result.suggestions.map(suggestion => <li key={suggestion}>- {suggestion}</li>)}</ul></div>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setResult(null); void generate(mode || "generate"); }} className="px-3 py-2 text-sm text-[#b4b8cc] hover:text-white">Regenerate</button>
                <button onClick={() => onApply(result)} className="px-4 py-2 bg-[#6366f1] text-white text-sm rounded-md hover:bg-[#4f46e5]">Use / Apply</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BasicsStep({ form, onChange, onGenerate }: StepProps) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Wand2} title="Agent Basics" subtitle="Define who your voice agent is, what it does, and how it should behave." />
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <Label>Agent Name *</Label>
          <Input value={form.name} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. Aria — Customer Support" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label>Agent Type</Label>
          <Select value={form.agentType} onChange={e => onChange({ agentType: e.target.value })}>
            <option value="customer-support">Customer Support</option>
            <option value="sales">Sales Assistant</option>
            <option value="onboarding">Onboarding Guide</option>
            <option value="technical">Technical Support</option>
            <option value="hr">HR & Recruiting</option>
            <option value="scheduling">Appointment Booking</option>
            <option value="information">Information Desk</option>
            <option value="custom">Custom</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>Short Description</Label>
        <Input value={form.description} onChange={e => onChange({ description: e.target.value })} placeholder="One-line description of what this agent does" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="mb-0">Purpose & Context</Label>
          <button onClick={onGenerate} className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(99,102,241,0.16)] border border-[rgba(99,102,241,0.3)] rounded-md text-xs text-[#c4b5fd] hover:bg-[rgba(99,102,241,0.25)] transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Generate / Improve Prompt
          </button>
        </div>
        <Textarea
          rows={3} value={form.purpose}
          onChange={e => onChange({ purpose: e.target.value })}
          placeholder="Describe the agent's role, target audience, and what it's meant to accomplish..."
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="mb-0">System Instructions</Label>
          <span className="text-xs text-[#636680] font-mono">{form.systemInstructions.length} chars</span>
        </div>
        <Textarea
          rows={5} value={form.systemInstructions}
          onChange={e => onChange({ systemInstructions: e.target.value })}
          className="font-mono text-xs"
          placeholder="You are a helpful AI voice agent. Be concise and friendly..."
        />
        <p className="text-xs text-[#636680] mt-1.5">This is the core instruction prompt sent to the LLM. Be specific about role, constraints, and behaviors.</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Personality</Label>
          <Select value={form.personality} onChange={e => onChange({ personality: e.target.value })}>
            {["Friendly", "Professional", "Casual", "Formal", "Technical", "Empathetic", "Persuasive", "Neutral"].map(p => (
              <option key={p} value={p.toLowerCase()}>{p}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Tone</Label>
          <Select value={form.tone} onChange={e => onChange({ tone: e.target.value })}>
            {["Warm", "Neutral", "Assertive", "Playful", "Serious", "Formal", "Casual"].map(t => (
              <option key={t} value={t.toLowerCase()}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Conversation Style</Label>
          <Select value={form.conversationStyle} onChange={e => onChange({ conversationStyle: e.target.value })}>
            {["Conversational", "Concise", "Detailed", "Guided", "Q&A", "Socratic"].map(s => (
              <option key={s} value={s.toLowerCase()}>{s}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Goals & Success Criteria</Label>
        <Textarea rows={2} value={form.goals} onChange={e => onChange({ goals: e.target.value })}
          placeholder="e.g. Resolve 80% of tier-1 support issues without escalation. Collect contact info. Schedule follow-ups." />
      </div>
    </div>
  );
}

function AIModelsStep({ form, onChange }: StepProps) {
  const sttModels = STT_PROVIDERS[form.sttProvider]?.models || [];
  const llmModels = LLM_PROVIDERS[form.llmProvider]?.models || [];
  const ttsModels = TTS_PROVIDERS[form.ttsProvider]?.models || [];

  return (
    <div className="space-y-8">
      <SectionHeader icon={Cpu} title="AI Model Pipeline" subtitle="Choose independent STT, LLM, and TTS providers. Mix and match for best cost-performance." />

      {/* STT */}
      <div className="p-4 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="w-4 h-4 text-[#a78bfa]" />
          <h4 className="text-sm font-semibold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>Speech-to-Text (STT)</h4>
          <span className="ml-auto text-xs text-[#636680]">Transcribes user speech to text</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {Object.entries(STT_PROVIDERS).map(([id, p]) => (
            <ProviderCard key={id} id={id} name={p.name} badge={p.badge} selected={form.sttProvider === id}
              onClick={() => onChange({ sttProvider: id, sttModel: p.models[0]?.id || "" })} />
          ))}
        </div>
        <div>
          <Label>Model</Label>
          <Select value={form.sttModel} onChange={e => onChange({ sttModel: e.target.value })}>
            {sttModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
      </div>

      {/* LLM */}
      <div className="p-4 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-[#6366f1]" />
          <h4 className="text-sm font-semibold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>Language Model (LLM)</h4>
          <span className="ml-auto text-xs text-[#636680]">Generates intelligent responses</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {Object.entries(LLM_PROVIDERS).map(([id, p]) => (
            <ProviderCard key={id} id={id} name={p.name} badge={p.badge} selected={form.llmProvider === id}
              onClick={() => onChange({ llmProvider: id, llmModel: p.models[0]?.id || "" })} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Model</Label>
            <Select value={form.llmModel} onChange={e => onChange({ llmModel: e.target.value })}>
              {llmModels.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.context})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Max Tokens</Label>
            <Input type="number" value={form.llmMaxTokens} min={64} max={4096}
              onChange={e => onChange({ llmMaxTokens: parseInt(e.target.value) || 512 })} />
          </div>
        </div>
        <div className="mt-4">
          <RangeSlider label="Temperature" value={form.llmTemperature} min={0} max={1} step={0.05}
            onChange={v => onChange({ llmTemperature: v })} />
          <p className="text-xs text-[#636680] mt-1">Lower = more focused. Higher = more creative.</p>
        </div>
      </div>

      {/* TTS */}
      <div className="p-4 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-4 h-4 text-[#34d399]" />
          <h4 className="text-sm font-semibold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>Text-to-Speech (TTS)</h4>
          <span className="ml-auto text-xs text-[#636680]">Converts response text to voice</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {Object.entries(TTS_PROVIDERS).map(([id, p]) => (
            <ProviderCard key={id} id={id} name={p.name} badge={p.badge} selected={form.ttsProvider === id}
              onClick={() => {
                const firstModel = p.models[0]?.id || "";
                const firstVoice = p.voices[firstModel]?.[0]?.id || "";
                onChange({ ttsProvider: id, ttsModel: firstModel, voice: firstVoice });
              }} />
          ))}
        </div>
        <div>
          <Label>Model</Label>
          <Select value={form.ttsModel} onChange={e => {
            const newModel = e.target.value;
            const firstVoice = TTS_PROVIDERS[form.ttsProvider]?.voices[newModel]?.[0]?.id || "";
            onChange({ ttsModel: newModel, voice: firstVoice });
          }}>
            {ttsModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
      </div>
    </div>
  );
}

function VoiceStep({ form, onChange }: StepProps) {
  const voices = TTS_PROVIDERS[form.ttsProvider]?.voices[form.ttsModel] || [];
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePreview = (voiceId: string) => {
    setPlayingId(voiceId);
    setTimeout(() => setPlayingId(null), 2000);
  };

  const selectedVoice = voices.find(v => v.id === form.voice);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Volume2} title="Voice Configuration" subtitle="Select a voice and fine-tune how your agent sounds." />

      <div className="p-3 bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.2)] rounded-lg flex items-center gap-2">
        <Info className="w-4 h-4 text-[#6366f1] flex-shrink-0" />
        <span className="text-xs text-[#b4b8cc]">
          Showing voices for <strong className="text-[#6366f1]">{TTS_PROVIDERS[form.ttsProvider]?.name}</strong> — {form.ttsModel}.
          Change TTS provider or model in the AI Models step.
        </span>
      </div>

      {/* Voice grid */}
      <div>
        <Label>Voice Selection</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {voices.map(voice => (
            <div
              key={voice.id}
              onClick={() => onChange({ voice: voice.id })}
              className={cn(
                "relative p-3 rounded-lg border cursor-pointer transition-all group",
                form.voice === voice.id
                  ? "border-[#6366f1] bg-[rgba(99,102,241,0.12)]"
                  : "border-[rgba(99,102,241,0.14)] bg-[#111520] hover:border-[rgba(99,102,241,0.3)]"
              )}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: `hsl(${voice.name.charCodeAt(0) * 7 % 360}, 60%, 25%)`, color: `hsl(${voice.name.charCodeAt(0) * 7 % 360}, 80%, 75%)` }}>
                  {voice.name[0]}
                </div>
                {form.voice === voice.id && <Check className="w-3.5 h-3.5 text-[#6366f1]" />}
              </div>
              <p className="text-sm font-medium text-[#e2e4ef]">{voice.name}</p>
              <p className="text-xs text-[#636680]">{voice.gender} · {voice.accent}</p>
              <span className="text-xs text-[#3d4060] mt-0.5 block">{voice.style}</span>
              <button
                onClick={e => { e.stopPropagation(); handlePreview(voice.id); }}
                className={cn(
                  "absolute bottom-2 right-2 w-6 h-6 rounded flex items-center justify-center transition-all",
                  playingId === voice.id
                    ? "bg-[#6366f1] text-white"
                    : "bg-[#1a2030] text-[#636680] opacity-0 group-hover:opacity-100 hover:text-[#6366f1]"
                )}
              >
                {playingId === voice.id ? <PauseCircle className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
        {selectedVoice && (
          <div className="mt-3 p-2.5 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-lg flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: `hsl(${selectedVoice.name.charCodeAt(0) * 7 % 360}, 60%, 25%)`, color: `hsl(${selectedVoice.name.charCodeAt(0) * 7 % 360}, 80%, 75%)` }}>
              {selectedVoice.name[0]}
            </div>
            <div className="flex-1">
              <p className="text-sm text-[#e2e4ef] font-medium">{selectedVoice.name}</p>
              <p className="text-xs text-[#636680]">{selectedVoice.gender} · {selectedVoice.accent} · {selectedVoice.style}</p>
            </div>
            <button
              onClick={() => handlePreview(selectedVoice.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.3)] text-[#a78bfa] text-xs rounded-md hover:bg-[rgba(99,102,241,0.25)] transition-colors"
            >
              {playingId === selectedVoice.id ? <><PauseCircle className="w-3 h-3" /> Playing...</> : <><Play className="w-3 h-3" /> Preview</>}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Language</Label>
          <Select value={form.language} onChange={e => onChange({ language: e.target.value })}>
            {[
              ["en", "English"],["hi", "Hindi"],
            ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div>
          <Label>Voice Style</Label>
          <Select value={form.voiceStyle} onChange={e => onChange({ voiceStyle: e.target.value })}>
            {["Conversational", "Newscast", "Customer Service", "Empathetic", "Cheerful", "Narration", "Whispering"].map(s => (
              <option key={s} value={s.toLowerCase()}>{s}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-5">
        <RangeSlider label="Speaking Speed" value={form.speakingSpeed} min={0.5} max={2.0} step={0.05} unit="×"
          onChange={v => onChange({ speakingSpeed: v })} />
        <RangeSlider label="Pitch" value={form.pitch} min={-20} max={20} step={1} unit=" st"
          onChange={v => onChange({ pitch: v })} />
      </div>
    </div>
  );
}

function KnowledgeStep({ form, onChange }: StepProps) {
  const [urlInput, setUrlInput] = useState("");
  const [faqQ, setFaqQ] = useState("");
  const [faqA, setFaqA] = useState("");

  const addSource = (type: KnowledgeSource["type"], name: string, value: string) => {
    const src: KnowledgeSource = { id: Date.now().toString(), type, name, value, status: "processing" };
    onChange({ knowledgeSources: [...form.knowledgeSources, src] });
    setTimeout(() => {
      onChange({
        knowledgeSources: form.knowledgeSources.concat(src).map(s =>
          s.id === src.id ? { ...s, status: "ready" } : s
        ),
      });
    }, 1500);
  };

  const removeSource = (id: string) => onChange({ knowledgeSources: form.knowledgeSources.filter(s => s.id !== id) });

  return (
    <div className="space-y-6">
      <SectionHeader icon={BookOpen} title="Knowledge Base" subtitle="Connect documents, websites, and FAQs to give your agent contextual knowledge." />

      {/* File upload */}
      <div className="border-2 border-dashed border-[rgba(99,102,241,0.25)] rounded-xl p-8 text-center hover:border-[rgba(99,102,241,0.5)] transition-colors cursor-pointer group">
        <div className="w-12 h-12 rounded-xl bg-[rgba(99,102,241,0.1)] flex items-center justify-center mx-auto mb-3 group-hover:bg-[rgba(99,102,241,0.2)] transition-colors">
          <Upload className="w-5 h-5 text-[#6366f1]" />
        </div>
        <p className="text-sm text-[#e2e4ef] font-medium mb-1">Drop files here or click to upload</p>
        <p className="text-xs text-[#636680]">PDF, DOCX, TXT, CSV, JSON — up to 50MB each</p>
        <button onClick={() => addSource("document", "product-manual.pdf", "uploaded")}
          className="mt-3 text-xs text-[#6366f1] hover:text-[#a78bfa]">Add sample document</button>
      </div>

      {/* URL */}
      <div>
        <Label>Add Website or URL</Label>
        <div className="flex gap-2">
          <Input
            value={urlInput} onChange={e => setUrlInput(e.target.value)}
            placeholder="https://docs.example.com or https://yoursite.com/help"
            onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) { addSource("url", urlInput, urlInput); setUrlInput(""); } }}
          />
          <button
            onClick={() => { if (urlInput.trim()) { addSource("url", urlInput, urlInput); setUrlInput(""); } }}
            className="px-3 py-2 bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.3)] text-[#a78bfa] rounded-md text-sm hover:bg-[rgba(99,102,241,0.25)] transition-colors whitespace-nowrap"
          >
            Add URL
          </button>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <Label>Add FAQ Pair</Label>
        <div className="space-y-2">
          <Input value={faqQ} onChange={e => setFaqQ(e.target.value)} placeholder="Question: What are your hours?" />
          <div className="flex gap-2">
            <Input value={faqA} onChange={e => setFaqA(e.target.value)} placeholder="Answer: We're open 9am–5pm Monday through Friday." />
            <button
              onClick={() => { if (faqQ && faqA) { addSource("faq", faqQ, faqA); setFaqQ(""); setFaqA(""); } }}
              className="px-3 py-2 bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.3)] text-[#a78bfa] rounded-md text-sm hover:bg-[rgba(99,102,241,0.25)] transition-colors whitespace-nowrap"
            >
              Add FAQ
            </button>
          </div>
        </div>
      </div>

      {/* Source list */}
      {form.knowledgeSources.length > 0 && (
        <div>
          <Label>Connected Sources ({form.knowledgeSources.length})</Label>
          <div className="space-y-2">
            {form.knowledgeSources.map(src => {
              const icons = { document: FileText, url: Link, faq: Hash };
              const Icon = icons[src.type];
              return (
                <div key={src.id} className="flex items-center gap-3 p-3 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-lg">
                  <div className="w-7 h-7 rounded bg-[#1a2030] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#6366f1]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#e2e4ef] truncate">{src.name}</p>
                    <span className="text-xs text-[#636680] capitalize">{src.type}</span>
                  </div>
                  <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded",
                    src.status === "ready" ? "text-[#22c55e] bg-[#071a12]" :
                    src.status === "processing" ? "text-[#f59e0b] bg-[#1c1a08]" :
                    "text-[#ef4444] bg-[#1a0808]"
                  )}>
                    {src.status}
                  </span>
                  <button onClick={() => removeSource(src.id)} className="text-[#3d4060] hover:text-[#ef4444] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationStep({ form, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={MessageSquare} title="Conversation Settings" subtitle="Control how your agent starts, responds, and ends conversations." />
      <div>
        <Label>Greeting Message</Label>
        <Textarea rows={2} value={form.greeting} onChange={e => onChange({ greeting: e.target.value })}
          placeholder="Hi there! How can I help you today?" />
        <p className="text-xs text-[#636680] mt-1">Spoken when a new conversation starts.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Fallback Behavior</Label>
          <Select value={form.fallbackBehavior} onChange={e => onChange({ fallbackBehavior: e.target.value })}>
            <option value="ask-again">Ask to Repeat</option>
            <option value="rephrase">Ask to Rephrase</option>
            <option value="escalate">Escalate to Human</option>
            <option value="end">End Conversation</option>
          </Select>
        </div>
        <div>
          <Label>Interruption Handling</Label>
          <Select value={form.interruptionHandling} onChange={e => onChange({ interruptionHandling: e.target.value })}>
            <option value="pause-and-listen">Pause & Listen</option>
            <option value="finish-then-listen">Finish Speaking First</option>
            <option value="immediate">Immediately Stop</option>
            <option value="ignore">Ignore</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>Fallback Message</Label>
        <Input value={form.fallbackMessage} onChange={e => onChange({ fallbackMessage: e.target.value })}
          placeholder="I'm sorry, I didn't catch that. Could you say that again?" />
      </div>
      <div className="space-y-5">
        <RangeSlider label="Response Delay" value={form.responseDelayMs} min={0} max={1000} step={50} unit=" ms"
          onChange={v => onChange({ responseDelayMs: v })} />
        <RangeSlider label="Silence Timeout" value={form.silenceTimeoutSec} min={3} max={30} step={1} unit=" sec"
          onChange={v => onChange({ silenceTimeoutSec: v })} />
        <RangeSlider label="Max Conversation Duration" value={form.maxConversationMin} min={1} max={60} step={1} unit=" min"
          onChange={v => onChange({ maxConversationMin: v })} />
      </div>
      <div>
        <Label>End-of-Conversation Message</Label>
        <Input value={form.endMessage} onChange={e => onChange({ endMessage: e.target.value })}
          placeholder="Thanks for calling. Have a great day!" />
      </div>
    </div>
  );
}

function ToolsStep({ form, onChange }: StepProps) {
  const toggle = (toolId: string) => {
    const enabled = form.enabledTools.includes(toolId)
      ? form.enabledTools.filter(t => t !== toolId)
      : [...form.enabledTools, toolId];
    onChange({ enabledTools: enabled });
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon={Wrench} title="Tools & Integrations" subtitle="Connect external services your agent can use during conversations." />
      <div className="grid grid-cols-1 gap-3">
        {AVAILABLE_TOOLS.map(tool => {
          const enabled = form.enabledTools.includes(tool.id);
          const Icon = tool.icon;
          return (
            <div key={tool.id} className={cn(
              "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
              enabled
                ? "border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.06)]"
                : "border-[rgba(99,102,241,0.1)] bg-[#0a0d16] hover:border-[rgba(99,102,241,0.2)]"
            )} onClick={() => toggle(tool.id)}>
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                enabled ? "bg-[rgba(99,102,241,0.2)]" : "bg-[#1a2030]"
              )}>
                <Icon className={cn("w-4 h-4", enabled ? "text-[#a78bfa]" : "text-[#636680]")} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#e2e4ef]">{tool.name}</p>
                  {tool.badge && (
                    <span className="text-xs px-1.5 py-0.5 bg-[rgba(99,102,241,0.15)] text-[#6366f1] rounded">{tool.badge}</span>
                  )}
                </div>
                <p className="text-xs text-[#636680] mt-0.5">{tool.description}</p>
              </div>
              <Toggle checked={enabled} onChange={() => toggle(tool.id)} />
            </div>
          );
        })}
      </div>
      {form.enabledTools.length > 0 && (
        <div className="p-3 bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.2)] rounded-lg">
          <p className="text-xs text-[#b4b8cc]">
            <strong className="text-[#a78bfa]">{form.enabledTools.length} tool{form.enabledTools.length > 1 ? "s" : ""} enabled.</strong>{" "}
            Configure API keys and credentials in your project settings before publishing.
          </p>
        </div>
      )}
    </div>
  );
}

function MemoryStep({ form, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Brain} title="Memory Configuration" subtitle="Control what your agent remembers within and across conversations." />
      <div>
        <Label>Conversation Memory Type</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { id: "none", label: "None", desc: "No memory between turns" },
            { id: "short-term", label: "Short-term", desc: "Current conversation only" },
            { id: "long-term", label: "Long-term", desc: "Across all conversations" },
          ].map(type => (
            <button key={type.id} onClick={() => onChange({ memoryType: type.id })}
              className={cn(
                "p-3 rounded-lg border text-left transition-all",
                form.memoryType === type.id
                  ? "border-[#6366f1] bg-[rgba(99,102,241,0.12)]"
                  : "border-[rgba(99,102,241,0.14)] bg-[#111520] hover:border-[rgba(99,102,241,0.3)]"
              )}>
              <p className="text-sm font-medium text-[#e2e4ef]">{type.label}</p>
              <p className="text-xs text-[#636680] mt-0.5">{type.desc}</p>
              {form.memoryType === type.id && <Check className="w-3.5 h-3.5 text-[#6366f1] mt-1.5" />}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-4 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#e2e4ef]">Persistent Memory</p>
            <p className="text-xs text-[#636680] mt-0.5">Remember context across sessions for returning users</p>
          </div>
          <Toggle checked={form.persistentMemory} onChange={v => onChange({ persistentMemory: v })} />
        </div>
        <div className="border-t border-[rgba(99,102,241,0.1)] pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#e2e4ef]">User-Specific Memory</p>
            <p className="text-xs text-[#636680] mt-0.5">Store individual preferences, name, past issues</p>
          </div>
          <Toggle checked={form.userMemory} onChange={v => onChange({ userMemory: v })} />
        </div>
      </div>
      {(form.persistentMemory || form.userMemory) && (
        <div>
          <Label>Memory Retention Period</Label>
          <Select value={form.retentionDays.toString()} onChange={e => onChange({ retentionDays: parseInt(e.target.value) })}>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="0">Forever</option>
          </Select>
        </div>
      )}
      <div className="p-3 bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.2)] rounded-lg">
        <p className="text-xs text-[#b4b8cc]">
          Memory data is encrypted at rest and in transit. Users can request data deletion per GDPR/CCPA.
        </p>
      </div>
    </div>
  );
}

function SecurityStep({ form, onChange, onGenerate }: StepProps) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Shield} title="Security & Guardrails" subtitle="Define what your agent can and cannot discuss, and how to handle edge cases." />
      {onGenerate && (
        <div className="flex justify-end">
          <button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(99,102,241,0.16)] border border-[rgba(99,102,241,0.3)] rounded-md text-xs text-[#c4b5fd] hover:bg-[rgba(99,102,241,0.25)] transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Generate with AI
          </button>
        </div>
      )}
      <div>
        <Label>Allowed Topics</Label>
        <TagInput
          tags={form.allowedTopics}
          onAdd={t => onChange({ allowedTopics: [...form.allowedTopics, t] })}
          onRemove={t => onChange({ allowedTopics: form.allowedTopics.filter(x => x !== t) })}
          placeholder="e.g. billing, product features, account settings (press Enter)"
        />
        <p className="text-xs text-[#636680] mt-1">Leave empty to allow all topics not in the restricted list.</p>
      </div>
      <div>
        <Label>Restricted Topics</Label>
        <TagInput
          tags={form.restrictedTopics}
          onAdd={t => onChange({ restrictedTopics: [...form.restrictedTopics, t] })}
          onRemove={t => onChange({ restrictedTopics: form.restrictedTopics.filter(x => x !== t) })}
          placeholder="e.g. competitors, politics, medical advice (press Enter)"
        />
      </div>
      <div>
        <Label>Escalation Rules</Label>
        <Textarea rows={3} value={form.escalationRules} onChange={e => onChange({ escalationRules: e.target.value })}
          placeholder="e.g. Escalate to human agent if user mentions billing dispute over $500, expresses frustration 3+ times, or requests to speak with a person." />
      </div>
      <div>
        <Label>Human Handoff Conditions</Label>
        <Textarea rows={2} value={form.humanHandoffConditions} onChange={e => onChange({ humanHandoffConditions: e.target.value })}
          placeholder="e.g. Transfer call if user says 'speak to agent' or 'human' or 'manager'" />
      </div>
      <div className="space-y-4 p-4 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#e2e4ef]">Require Confirmation for Actions</p>
            <p className="text-xs text-[#636680] mt-0.5">Ask user to confirm before booking, submitting, or changing data</p>
          </div>
          <Toggle checked={form.requireConfirmation} onChange={v => onChange({ requireConfirmation: v })} />
        </div>
        <div className="border-t border-[rgba(99,102,241,0.1)] pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#e2e4ef]">GDPR Compliant Mode</p>
            <p className="text-xs text-[#636680] mt-0.5">Add consent disclosure, enable data deletion requests</p>
          </div>
          <Toggle checked={form.gdprCompliant} onChange={v => onChange({ gdprCompliant: v })} />
        </div>
      </div>
    </div>
  );
}

const MOCK_RESPONSES = [
  "Thanks for reaching out! I'd be happy to help with that. Could you give me a bit more context?",
  "Got it! Let me look that up for you right now.",
  "That's a great question. Based on our knowledge base, the answer is that you can find this in your account settings under the Billing tab.",
  "I understand your concern. I'm pulling up your account information now.",
  "Absolutely! I can help you with that. Just to confirm, you're asking about the Pro plan pricing?",
];

function TestStep({ form, agentId }: { form: AgentForm; agentId?: string }) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipeline, setPipeline] = useState<"idle" | "stt" | "llm" | "tts">("idle");
  const [sessionActive, setSessionActive] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const responseIdx = useRef(0);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const startSession = () => {
    setSessionActive(true);
    setMessages([{ id: "0", role: "agent", content: form.greeting || "Hi! How can I help you today?", timestamp: new Date().toLocaleTimeString() }]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    const userMsg: TestMessage = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);
    setPipeline("llm");
    if (!agentId) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "agent", content: "Save and publish this agent before testing it.", timestamp: new Date().toLocaleTimeString() }]);
      setIsProcessing(false);
      setPipeline("idle");
      return;
    }
    try {
      const data = await apiRequest("/chat", {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId, message: text }),
      });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "agent", content: data.response, timestamp: new Date().toLocaleTimeString() }]);
    } catch (error) {
      console.error("Chat request failed:", error);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "agent", content: error instanceof Error ? error.message : "Chat request failed", timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setIsProcessing(false);
      setPipeline("idle");
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      sendMessage("I have a question about my billing statement.");
    } else {
      setIsRecording(true);
      setTimeout(() => { setIsRecording(false); sendMessage("I have a question about my billing statement."); }, 2500);
    }
  };

  const reset = () => { setMessages([]); setSessionActive(false); setPipeline("idle"); setIsProcessing(false); setIsRecording(false); };

  const pipelineSteps = [
    { id: "stt", label: STT_PROVIDERS[form.sttProvider]?.badge || "STT", name: "Speech → Text" },
    { id: "llm", label: LLM_PROVIDERS[form.llmProvider]?.badge || "LLM", name: "LLM Response" },
    { id: "tts", label: TTS_PROVIDERS[form.ttsProvider]?.badge || "TTS", name: "Text → Voice" },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader icon={PlayCircle} title="Live Voice Playground" subtitle="Test your agent end-to-end before publishing. Speak or type to interact." />

      {/* Pipeline status */}
      <div className="flex items-center gap-2 p-3 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl">
        {pipelineSteps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono flex-1 justify-center transition-all",
              pipeline === step.id ? "bg-[rgba(99,102,241,0.25)] text-[#a78bfa] border border-[rgba(99,102,241,0.4)]" :
              pipeline === "idle" && sessionActive ? "bg-[rgba(34,197,94,0.08)] text-[#22c55e] border border-[rgba(34,197,94,0.2)]" :
              "bg-[#111520] text-[#636680] border border-transparent"
            )}>
              <span className="font-bold">{step.label}</span>
              <span className="hidden sm:block text-[10px] opacity-70">{step.name}</span>
              {pipeline === step.id && <div className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />}
            </div>
            {i < 2 && <ChevronRight className="w-3 h-3 text-[#3d4060] flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl overflow-hidden" style={{ height: 380 }}>
        {!sessionActive ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] flex items-center justify-center">
              <Bot className="w-7 h-7 text-[#6366f1]" />
            </div>
            <div className="text-center">
              <p className="text-sm text-[#e2e4ef] font-medium">{form.name || "Voice Agent"} is ready to test</p>
              <p className="text-xs text-[#636680] mt-1">Voice: {TTS_PROVIDERS[form.ttsProvider]?.voices[form.ttsModel]?.find(v => v.id === form.voice)?.name || form.voice} · {LLM_PROVIDERS[form.llmProvider]?.name}</p>
            </div>
            <button onClick={startSession}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#6366f1] text-white text-sm rounded-lg hover:bg-[#4f46e5] transition-colors font-medium">
              <PlayCircle className="w-4 h-4" /> Start Test Session
            </button>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(99,102,241,0.14)]">
              <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-xs text-[#636680]">Session active — {messages.length} messages</span>
              <button onClick={reset} className="ml-auto text-[#636680] hover:text-[#ef4444] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "")}>
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs",
                    msg.role === "user" ? "bg-[#1a2030] text-[#636680]" : "bg-[rgba(99,102,241,0.2)] text-[#6366f1]"
                  )}>
                    {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={cn("max-w-[75%]", msg.role === "user" ? "items-end" : "items-start", "flex flex-col gap-1")}>
                    <div className={cn(
                      "px-3 py-2 rounded-xl text-sm",
                      msg.role === "user"
                        ? "bg-[#1a2030] text-[#b4b8cc]"
                        : "bg-[rgba(99,102,241,0.12)] text-[#e2e4ef] border border-[rgba(99,102,241,0.15)]"
                    )}>
                      {msg.content}
                    </div>
                    <div className={cn("flex items-center gap-2", msg.role === "user" ? "flex-row-reverse" : "")}>
                      <span className="text-[10px] text-[#3d4060] font-mono">{msg.timestamp}</span>
                      {msg.latency && <span className="text-[10px] text-[#636680] font-mono">{msg.latency}ms</span>}
                    </div>
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[rgba(99,102,241,0.2)] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-[#6366f1]" />
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.15)] flex items-center gap-1.5">
                    <span className="text-xs text-[#636680] font-mono capitalize">{pipeline}...</span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-[rgba(99,102,241,0.14)] flex items-center gap-2">
              <button
                onClick={toggleRecording}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                  isRecording
                    ? "bg-[#ef4444] text-white animate-pulse"
                    : "bg-[rgba(99,102,241,0.15)] text-[#6366f1] hover:bg-[rgba(99,102,241,0.25)]"
                )}
              >
                {isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(input); }}
                placeholder={isRecording ? "Recording..." : "Type or hold mic to speak..."}
                disabled={isRecording || isProcessing}
                className="flex-1 px-3 py-2 bg-[#111520] border border-[rgba(99,102,241,0.18)] rounded-lg text-sm text-[#e2e4ef] placeholder-[#3d4060] outline-none focus:ring-1 focus:ring-[#6366f1] disabled:opacity-50"
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isProcessing}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-40 transition-colors flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PublishStep({ form, onPublish, onSaveDraft }: { form: AgentForm; onPublish: () => void; onSaveDraft: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const agentId = `ag_${Math.random().toString(36).slice(2, 8)}`;
  const embedCode = `<script src="https://voiceagent.ai/embed.js" data-agent="${agentId}" async></script>`;
  const apiEndpoint = `POST https://api.voiceagent.ai/v1/agents/${agentId}/call`;

  const copyToClipboard = (text: string, key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const configSummary = [
    { label: "STT", value: `${STT_PROVIDERS[form.sttProvider]?.name} · ${form.sttModel}`, icon: Mic },
    { label: "LLM", value: `${LLM_PROVIDERS[form.llmProvider]?.name} · ${form.llmModel}`, icon: Brain },
    { label: "TTS", value: `${TTS_PROVIDERS[form.ttsProvider]?.name} · ${form.ttsModel}`, icon: Volume2 },
    { label: "Voice", value: TTS_PROVIDERS[form.ttsProvider]?.voices[form.ttsModel]?.find(v => v.id === form.voice)?.name || form.voice, icon: Headphones },
    { label: "Knowledge", value: `${form.knowledgeSources.length} source${form.knowledgeSources.length !== 1 ? "s" : ""}`, icon: BookOpen },
    { label: "Tools", value: `${form.enabledTools.length} enabled`, icon: Wrench },
    { label: "Memory", value: form.memoryType, icon: Brain },
    { label: "Security", value: `${form.restrictedTopics.length} restrictions`, icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader icon={Zap} title="Save & Publish" subtitle="Review your configuration and publish your agent to production." />

      {/* Config summary */}
      <div className="p-4 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-xl">
        <h4 className="text-sm font-semibold text-[#e2e4ef] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Configuration Summary</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {configSummary.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-[#636680] flex-shrink-0" />
                <span className="text-xs text-[#636680]">{item.label}:</span>
                <span className="text-xs text-[#b4b8cc] font-medium capitalize truncate">{item.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deployment */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>Deployment Options</h4>
        <div className="p-3 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#636680]">Embed Code</span>
            <button onClick={() => copyToClipboard(embedCode, "embed")}
              className="flex items-center gap-1 text-xs text-[#6366f1] hover:text-[#a78bfa] transition-colors">
              {copied === "embed" ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <code className="block text-xs text-[#636680] font-mono bg-[#07090f] px-2.5 py-2 rounded break-all">{embedCode}</code>
        </div>
        <div className="p-3 bg-[#0a0d16] border border-[rgba(99,102,241,0.14)] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#636680]">REST API Endpoint</span>
            <button onClick={() => copyToClipboard(apiEndpoint, "api")}
              className="flex items-center gap-1 text-xs text-[#6366f1] hover:text-[#a78bfa] transition-colors">
              {copied === "api" ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <code className="block text-xs text-[#636680] font-mono bg-[#07090f] px-2.5 py-2 rounded">{apiEndpoint}</code>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onSaveDraft}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#171d2e] border border-[rgba(99,102,241,0.2)] text-[#b4b8cc] rounded-xl hover:border-[rgba(99,102,241,0.4)] hover:text-[#e2e4ef] transition-all text-sm font-medium">
          <Clock className="w-4 h-4" /> Save as Draft
        </button>
        <button onClick={onPublish}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#6366f1] text-white rounded-xl hover:bg-[#4f46e5] transition-colors text-sm font-semibold shadow-lg shadow-[rgba(99,102,241,0.3)]">
          <Zap className="w-4 h-4" /> Publish Agent
        </button>
      </div>
    </div>
  );
}

// ─── WIZARD ───────────────────────────────────────────────────────────────────

interface WizardProps {
  initialForm: AgentForm;
  onBack: () => void;
  onSave: (form: AgentForm) => void;
  isEditing: boolean;
  editingId?: string;
}

function AgentWizard({ initialForm, onBack, onSave, isEditing, editingId }: WizardProps) {
  const [form, setForm] = useState<AgentForm>(initialForm);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [promptGeneratorOpen, setPromptGeneratorOpen] = useState(false);

  const onChange = useCallback((updates: Partial<AgentForm>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSave = (status: AgentStatus = form.status) => {
    onSave({ ...form, status });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePublish = () => {
    onSave({ ...form, status: "published" });
    onBack();
  };

  const applyGeneratedPrompt = (generated: GeneratedPrompt) => {
    onChange({
      purpose: form.purpose || generated.purpose,
      systemInstructions: form.systemInstructions || generated.systemInstructions,
      goals: form.goals || generated.goals,
      allowedTopics: form.allowedTopics.length > 0 ? form.allowedTopics : (generated.allowedTopics || []),
      restrictedTopics: form.restrictedTopics.length > 0 ? form.restrictedTopics : (generated.restrictedTopics || []),
      escalationRules: form.escalationRules || generated.escalationRules || "",
      humanHandoffConditions: form.humanHandoffConditions || generated.humanHandoffConditions || "",
    });
    setPromptGeneratorOpen(false);
  };

  const steps = [
    <BasicsStep key={0} form={form} onChange={onChange} onGenerate={() => setPromptGeneratorOpen(true)} />,
    <AIModelsStep key={1} form={form} onChange={onChange} />,
    <VoiceStep key={2} form={form} onChange={onChange} />,
    <KnowledgeStep key={3} form={form} onChange={onChange} />,
    <ConversationStep key={4} form={form} onChange={onChange} />,
    <ToolsStep key={5} form={form} onChange={onChange} />,
    <MemoryStep key={6} form={form} onChange={onChange} />,
    <SecurityStep key={7} form={form} onChange={onChange} onGenerate={() => setPromptGeneratorOpen(true)} />,
    <TestStep key={8} form={form} agentId={editingId} />,
    <PublishStep key={9} form={form} onPublish={handlePublish} onSaveDraft={() => handleSave("draft")} />,
  ];

  const groups = [
    { label: "Configure", steps: [0, 1, 2, 3, 4, 5, 6, 7], color: "text-[#a78bfa]" },
    { label: "Test", steps: [8], color: "text-[#38bdf8]" },
    { label: "Publish", steps: [9], color: "text-[#22c55e]" },
  ];

  const statusForStep = (i: number) => {
    if (i < step) return "done";
    if (i === step) return "active";
    return "pending";
  };

  return (
    <div className="flex flex-col h-full min-h-screen" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <PromptGeneratorModal form={form} open={promptGeneratorOpen} onClose={() => setPromptGeneratorOpen(false)} onApply={applyGeneratedPrompt} />
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3.5 border-b border-[rgba(99,102,241,0.14)] bg-[#09090f] sticky top-0 z-30">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#636680] hover:text-[#e2e4ef] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Agents
        </button>
        <div className="w-px h-4 bg-[rgba(99,102,241,0.2)]" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>
            {form.name || (isEditing ? "Edit Agent" : "New Agent")}
          </span>
          <StatusBadge status={form.status} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {saved && <span className="text-xs text-[#22c55e] flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
          {form.status === "published" && (
            <button
              onClick={() => alert("Opening live agent...")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] text-[#22c55e] text-xs rounded-lg hover:bg-[rgba(34,197,94,0.2)] transition-colors font-medium"
            >
              <Phone className="w-3 h-3" /> Use Agent
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-[rgba(99,102,241,0.14)] bg-[#09090f] overflow-y-auto">
          <nav className="p-3 space-y-1">
            {groups.map(group => (
              <div key={group.label} className="mb-2">
                <p className={cn("text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5 font-mono", group.color)}>{group.label}</p>
                {group.steps.map(i => {
                  const s = WIZARD_STEPS[i];
                  const Icon = s.icon;
                  const status = statusForStep(i);
                  return (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all",
                        status === "active" ? "bg-[rgba(99,102,241,0.15)] text-[#e2e4ef]" :
                        status === "done" ? "text-[#636680] hover:text-[#b4b8cc] hover:bg-[#111520]" :
                        "text-[#3d4060] hover:text-[#636680] hover:bg-[#0d1018]"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all",
                        status === "active" ? "bg-[#6366f1] text-white" :
                        status === "done" ? "bg-[rgba(34,197,94,0.2)] text-[#22c55e]" :
                        "bg-[#1a2030] text-[#636680]"
                      )}>
                        {status === "done" ? <Check className="w-2.5 h-2.5" /> : <Icon className="w-2.5 h-2.5" />}
                      </div>
                      <span className="text-xs">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {steps[step]}
          </div>
        </main>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-52 right-0 z-20 bg-[#09090f] border-t border-[rgba(99,102,241,0.14)] px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#111520] border border-[rgba(99,102,241,0.2)] text-[#636680] text-sm rounded-lg hover:text-[#b4b8cc] disabled:opacity-30 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex-1 h-1 bg-[#111520] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#6366f1] to-[#a78bfa] rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }} />
        </div>
        <span className="text-xs text-[#3d4060] font-mono w-12 text-right">{step + 1}/{WIZARD_STEPS.length}</span>
        <button
          onClick={() => handleSave()}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#171d2e] border border-[rgba(99,102,241,0.2)] text-[#b4b8cc] text-sm rounded-lg hover:border-[rgba(99,102,241,0.4)] transition-all"
        >
          <Clock className="w-3.5 h-3.5" /> Save Draft
        </button>
        <button
          onClick={() => setStep(8)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.25)] text-[#38bdf8] text-sm rounded-lg hover:bg-[rgba(56,189,248,0.15)] transition-all"
        >
          <PlayCircle className="w-3.5 h-3.5" /> Test
        </button>
        {step < WIZARD_STEPS.length - 1 ? (
          <button
            onClick={() => setStep(Math.min(WIZARD_STEPS.length - 1, step + 1))}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#6366f1] text-white text-sm rounded-lg hover:bg-[#4f46e5] transition-colors font-medium"
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handlePublish}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#22c55e] text-white text-sm rounded-lg hover:bg-[#16a34a] transition-colors font-medium"
          >
            <Zap className="w-3.5 h-3.5" /> Publish
          </button>
        )}
      </div>
    </div>
  );
}

// ─── USE AGENT MODAL ──────────────────────────────────────────────────────────

function UseAgentModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [aosUserId, setAosUserId] = useState("");
  const [aosUserIdError, setAosUserIdError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const playbackGenerationRef = useRef(0);
  const ttsCompleteGenerationRef = useRef<number | null>(null);
  const playbackCompleteSentRef = useRef(false);
  const acceptingAudioRef = useRef(true);

  const sendPlaybackCompleteIfReady = (generation: number) => {
    if (
      generation !== playbackGenerationRef.current ||
      generation !== ttsCompleteGenerationRef.current ||
      audioSourcesRef.current.size !== 0 ||
      !acceptingAudioRef.current ||
      playbackCompleteSentRef.current
    ) {
      return;
    }

    playbackCompleteSentRef.current = true;
    socketRef.current?.send(JSON.stringify({
      event: "playback_complete",
      data: { generation },
    }));
  };

  const stopScheduledAudio = () => {
    console.log("[BARGE-IN DEBUG] stopping scheduled audio", {
      activeSourcesBefore: audioSourcesRef.current.size,
      playbackGeneration: playbackGenerationRef.current,
    });
    for (const source of audioSourcesRef.current) {
      try {
        console.log("[AUDIO DEBUG] AudioBufferSourceNode.stop() called", {
          activeSourcesBefore: audioSourcesRef.current.size,
          playbackGeneration: playbackGenerationRef.current,
        });
        source.stop();
      } catch {
        // Ignore sources that have already ended.
      }
    }
    audioSourcesRef.current.clear();
    if (audioContextRef.current) {
      nextAudioTimeRef.current = audioContextRef.current.currentTime;
    }
    console.log("[BARGE-IN DEBUG] interruption cleanup complete", {
      sourcesRemaining: audioSourcesRef.current.size,
      playbackGeneration: playbackGenerationRef.current,
      nextAudioTime: nextAudioTimeRef.current,
    });
  };

  useEffect(() => {
    try {
      const storedUserId = window.localStorage.getItem(AOS_USER_ID_KEY);
      if (storedUserId) {
        setAosUserId(storedUserId);
      }
    } catch {
      // Local storage access can be unavailable in some browser contexts.
    }
  }, []);

  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callActive]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => () => {
    stopScheduledAudio();
    socketRef.current?.close();
    void audioContextRef.current?.close();
    void apiRequest("/stop", { method: "POST" }).catch(() => undefined);
  }, []);

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const normalizedUserId = aosUserId.trim().toUpperCase();

  const handleGenerateAosUserId = () => {
    const generated = generateAosUserId();
    setAosUserId(generated);
    setAosUserIdError("");
    try {
      window.localStorage.setItem(AOS_USER_ID_KEY, generated);
    } catch {
      // Ignore storage failures and keep the in-memory value.
    }
  };

  const startCall = () => {
    const trimmedUserId = normalizedUserId;
    if (!trimmedUserId || trimmedUserId === "AOS-") {
      setAosUserIdError("AOS User ID is required");
      return;
    }

    setAosUserId(trimmedUserId);
    try {
      window.localStorage.setItem(AOS_USER_ID_KEY, trimmedUserId);
    } catch {
      // Ignore storage failures and keep the in-memory value.
    }
    setAosUserIdError("");
    setCallActive(true);
    setMessages([{ id: "0", role: "agent", content: "Hello! Thanks for calling. How can I assist you today?", timestamp: new Date().toLocaleTimeString() }]);
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    console.log(`[BROWSER AUDIO] AudioContext created state=${audioContext.state} sampleRate=${audioContext.sampleRate}`);
    void audioContext.resume().then(() => {
      console.log(`[BROWSER AUDIO] AudioContext state after resume=${audioContext.state}`);
    }).catch(error => {
      console.error("[BROWSER AUDIO] AudioContext resume FAILED", error);
    });
    nextAudioTimeRef.current = audioContext.currentTime;

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    socket.binaryType = "arraybuffer";
    socket.onmessage = event => {
      console.log("[BROWSER AUDIO] MESSAGE RECEIVED", {
        type: typeof event.data,
        isArrayBuffer: event.data instanceof ArrayBuffer,
        byteLength: event.data instanceof ArrayBuffer ? event.data.byteLength : undefined,
      });
      if (event.data instanceof ArrayBuffer) {
        try {
          console.log("[AUDIO DEBUG] binary audio chunk received", {
            byteLength: event.data.byteLength,
            activeSources: audioSourcesRef.current.size,
            playbackGeneration: playbackGenerationRef.current,
            acceptingAudio: acceptingAudioRef.current,
          });
          const playbackGeneration = playbackGenerationRef.current;
          if (!acceptingAudioRef.current) return;
          const context = audioContextRef.current;
          if (!context) return;
          console.log("[BROWSER AUDIO] AUDIOCONTEXT", {
            state: context.state,
            currentTime: context.currentTime,
            sampleRate: context.sampleRate,
          });
          console.log(`[BROWSER AUDIO] websocket binary received bytes=${event.data.byteLength}`);
          console.log(`[BROWSER AUDIO] decoding PCM bytes=${event.data.byteLength}`);
          console.log(`[AUDIO] browser audio chunk received bytes=${event.data.byteLength}`);
          const samples = new Int16Array(event.data);
          let minimumSample = 0;
          let maximumSample = 0;
          if (samples.length > 0) {
            minimumSample = samples[0];
            maximumSample = samples[0];
            for (let index = 1; index < samples.length; index += 1) {
              minimumSample = Math.min(minimumSample, samples[index]);
              maximumSample = Math.max(maximumSample, samples[index]);
            }
          }
          console.log("[BROWSER AUDIO] PCM INPUT", {
            byteLength: event.data.byteLength,
            sampleCount: samples.length,
            firstSample: samples[0],
            minimumSample,
            maximumSample,
            allZeroSamples: minimumSample === 0 && maximumSample === 0,
          });
          const audioBuffer = context.createBuffer(1, samples.length, 16000);
          console.log("[BROWSER AUDIO] AUDIOBUFFER CREATED", {
            channels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration,
          });
          const channel = audioBuffer.getChannelData(0);
          for (let index = 0; index < samples.length; index += 1) {
            channel[index] = samples[index] / 32768;
          }
          if (playbackGeneration !== playbackGenerationRef.current || !acceptingAudioRef.current) {
            console.log("[GENERATION DEBUG] stale/late audio chunk rejected", {
              chunkGeneration: playbackGeneration,
              currentGeneration: playbackGenerationRef.current,
              acceptingAudio: acceptingAudioRef.current,
            });
            return;
          }
          const source = context.createBufferSource();
          console.log("[AUDIO DEBUG] AudioBufferSourceNode created", {
            playbackGeneration,
            activeSources: audioSourcesRef.current.size,
          });
          source.buffer = audioBuffer;
          source.connect(context.destination);
          source.onended = () => {
            audioSourcesRef.current.delete(source);
            console.log("[AUDIO DEBUG] AudioBufferSourceNode naturally finished", {
              activeSourcesRemaining: audioSourcesRef.current.size,
              playbackGeneration: playbackGenerationRef.current,
            });
            console.log("[BROWSER AUDIO] SOURCE ENDED");
            sendPlaybackCompleteIfReady(playbackGeneration);
          };
          audioSourcesRef.current.add(source);
          console.log("[AUDIO DEBUG] source added to tracked collection", {
            activeSources: audioSourcesRef.current.size,
            playbackGeneration,
          });
          const startTime = Math.max(context.currentTime, nextAudioTimeRef.current);
          console.log("[AUDIO DEBUG] binary audio chunk about to be scheduled", {
            playbackGeneration,
            currentGeneration: playbackGenerationRef.current,
            activeSources: audioSourcesRef.current.size,
            startTime,
          });
          console.log("[BROWSER AUDIO] PLAYBACK SCHEDULE", {
            contextCurrentTime: context.currentTime,
            nextAudioTime: nextAudioTimeRef.current,
            startTime,
            scheduledDelay: startTime - context.currentTime,
            bufferDuration: audioBuffer.duration,
            contextState: context.state,
          });
          console.log("[BROWSER AUDIO] SOURCE STARTING");
          source.start(startTime);
          console.log("[BROWSER AUDIO] SOURCE START CALLED");
          nextAudioTimeRef.current = startTime + audioBuffer.duration;
          console.log("[AUDIO] browser playback started");
        } catch (error) {
          console.error("[BROWSER AUDIO] PLAYBACK ERROR", error);
        }
        return;
      }
      const message = JSON.parse(event.data);
      if (message.event === "interruption") {
        console.log("[BARGE-IN DEBUG] backend interruption event received", {
          activeSourcesBefore: audioSourcesRef.current.size,
          generationBefore: playbackGenerationRef.current,
          acceptingAudioBefore: acceptingAudioRef.current,
        });
        playbackGenerationRef.current = message.data.generation;
        console.log("[GENERATION DEBUG] playback generation invalidated", {
          generationBefore: playbackGenerationRef.current - 1,
          generationAfter: playbackGenerationRef.current,
        });
        acceptingAudioRef.current = false;
        ttsCompleteGenerationRef.current = null;
        playbackCompleteSentRef.current = false;
        stopScheduledAudio();
        return;
      }
      if (message.event === "transcript") {
        setIsListening(false);
        setProcessing(true);
        setMessages(prev => [...prev, { id: `${Date.now()}-user`, role: "user", content: message.data.text, timestamp: new Date().toLocaleTimeString() }]);
      }
      if (message.event === "assistant") {
        playbackGenerationRef.current = message.data.generation;
        ttsCompleteGenerationRef.current = null;
        playbackCompleteSentRef.current = false;
        audioSourcesRef.current.clear();
        acceptingAudioRef.current = true;
        setProcessing(false);
        setMessages(prev => [...prev, { id: `${Date.now()}-agent`, role: "agent", content: message.data.text, timestamp: new Date().toLocaleTimeString() }]);
      }
      if (message.event === "tts_complete") {
        ttsCompleteGenerationRef.current = message.data.generation;
        sendPlaybackCompleteIfReady(message.data.generation);
      }
    };
    socket.onopen = () => {
      apiRequest("/start", {
        method: "POST",
        body: JSON.stringify({ agent_id: agent.id, user_id: normalizedUserId }),
      }).catch(error => {
        console.error("Audio session start failed:", error);
        setCallActive(false);
        setMessages(prev => [...prev, { id: `${Date.now()}-error`, role: "agent", content: error instanceof Error ? error.message : "Audio session start failed", timestamp: new Date().toLocaleTimeString() }]);
      });
    };
    socket.onerror = () => {
      setCallActive(false);
      setProcessing(false);
      setIsListening(false);
      void audioContext.close();
      audioContextRef.current = null;
    };
  };

  const endCall = () => {
    setCallActive(false);
    setIsListening(false);
    setProcessing(false);
    setCallDuration(0);
    stopScheduledAudio();
    socketRef.current?.close();
    socketRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    void apiRequest("/stop", { method: "POST" }).catch(error => console.error("Audio session stop failed:", error));
  };

  const handleMic = () => {
    if (!callActive || processing) return;
    setIsListening(true);
  };

  const buildTranscriptText = useCallback(() => {
    const transcriptMessages = messages.filter(msg => msg.content && msg.content.trim().length > 0);

    if (transcriptMessages.length === 0) {
      return null;
    }

    const headingParts = ["AgentOS Conversation Transcript"];

    if (agent.name) {
      headingParts.push(`Agent: ${agent.name}`);
    }

    const header = `${headingParts.join("\n")}\n\n==================================================\n\n`;

    const body = transcriptMessages
      .map(msg => {
        const label = msg.role === "user" ? "User" : "Agent";
        return `${label}:\n${msg.content.trim()}\n`;
      })
      .join("\n");

    return `${header}${body}\n`;
  }, [agent.name, messages]);

  const handleDownloadTranscript = useCallback(() => {
    const transcriptText = buildTranscriptText();

    if (!transcriptText) {
      window.alert("No conversation transcript available to download.");
      return;
    }

    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "conversation-transcript.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }, [buildTranscriptText]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d1018] border border-[rgba(99,102,241,0.2)] rounded-2xl overflow-hidden shadow-2xl shadow-[rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[rgba(99,102,241,0.14)]">
          <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.15)] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#e2e4ef] truncate" style={{ fontFamily: "Outfit, sans-serif" }}>{agent.name}</p>
            <p className="text-xs text-[#636680]">{LLM_PROVIDERS[agent.llmProvider]?.name} · {TTS_PROVIDERS[agent.ttsProvider]?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {callActive && (
              <span className="text-xs font-mono text-[#22c55e] bg-[rgba(34,197,94,0.1)] px-2 py-0.5 rounded">
                {formatDuration(callDuration)}
              </span>
            )}
            <button onClick={onClose} className="text-[#636680] hover:text-[#e2e4ef] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transcript */}
        <div className="h-64 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: "none" }}>
          {!callActive ? (
            <div className="h-full flex flex-col justify-center gap-4 p-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.15)] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-[#6366f1]" />
                </div>
                <div>
                  <p className="text-sm text-[#e2e4ef] font-medium">Talk to {agent.name}</p>
                  <p className="text-xs text-[#636680] mt-0.5">Voice: {agent.voice} · {agent.language.toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-[0.2em] text-[#636680]">AOS User ID</label>
                <Input
                  value={aosUserId}
                  onChange={event => {
                    setAosUserId(event.target.value);
                    if (aosUserIdError) setAosUserIdError("");
                  }}
                  placeholder="AOS-7F29K4"
                  className="bg-[#111520]"
                />
                {aosUserIdError && <p className="text-xs text-[#ef4444]">{aosUserIdError}</p>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateAosUserId}
                  className="flex-1 px-3 py-2 bg-[#171d2e] border border-[rgba(99,102,241,0.2)] text-[#b4b8cc] text-sm rounded-lg hover:border-[rgba(99,102,241,0.4)] transition-colors"
                >
                  Generate ID
                </button>
                <button
                  onClick={startCall}
                  className="flex-1 px-3 py-2 bg-[#6366f1] text-white text-sm rounded-lg hover:bg-[#4f46e5] transition-colors font-medium"
                >
                  Continue
                </button>
              </div>

              <p className="text-[11px] text-[#636680]">Don&apos;t have an AOS User ID?</p>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "")}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs",
                    msg.role === "user" ? "bg-[#1a2030] text-[#636680]" : "bg-[rgba(99,102,241,0.2)] text-[#6366f1]"
                  )}>
                    {msg.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div className={cn(
                    "px-3 py-2 rounded-xl text-xs max-w-[75%]",
                    msg.role === "user" ? "bg-[#1a2030] text-[#b4b8cc]" : "bg-[rgba(99,102,241,0.1)] text-[#e2e4ef] border border-[rgba(99,102,241,0.15)]"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {(processing || isListening) && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-[rgba(99,102,241,0.2)] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-[#6366f1]" />
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.15)] flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-[rgba(99,102,241,0.14)]">
          {!callActive ? (
            <button onClick={startCall}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#22c55e] text-white text-sm font-semibold rounded-xl hover:bg-[#16a34a] transition-colors shadow-lg shadow-[rgba(34,197,94,0.25)]">
              <Phone className="w-4 h-4" /> Start Conversation
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button onClick={endCall}
                className="w-12 h-12 rounded-full bg-[#ef4444] text-white flex items-center justify-center hover:bg-[#dc2626] transition-colors">
                <StopCircle className="w-5 h-5" />
              </button>
              <button
                onClick={handleDownloadTranscript}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#171d2e] border border-[rgba(99,102,241,0.2)] text-[#b4b8cc] text-[11px] font-medium rounded-xl hover:border-[rgba(99,102,241,0.4)] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Transcript
              </button>
              <button
                onClick={handleMic}
                disabled={isListening || processing}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg",
                  isListening
                    ? "bg-[#ef4444] animate-pulse shadow-[rgba(239,68,68,0.4)]"
                    : processing
                    ? "bg-[#374151] text-[#636680] cursor-not-allowed"
                    : "bg-[#6366f1] text-white hover:bg-[#4f46e5] shadow-[rgba(99,102,241,0.4)]"
                )}
              >
                {isListening ? <Mic className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6" />}
              </button>
              <div className="w-12 h-12 rounded-full bg-[#1a2030] flex items-center justify-center">
                <Volume2 className="w-4 h-4 text-[#636680]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

interface DashboardProps {
  agents: Agent[];
  onCreateAgent: () => void;
  onEditAgent: (agent: Agent) => void;
  onUseAgent: (agent: Agent) => void;
  onDuplicateAgent: (agent: Agent) => void;
  onDeleteAgent: (id: string) => void;
}

function Dashboard({ agents, onCreateAgent, onEditAgent, onUseAgent, onDuplicateAgent, onDeleteAgent }: DashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AgentStatus>("all");
  const [sortBy, setSortBy] = useState<"name" | "lastUpdated" | "totalCalls">("lastUpdated");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  const filtered = agents
    .filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
          !a.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "totalCalls") return b.totalCalls - a.totalCalls;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = [
    { label: "Total Agents", value: agents.length, icon: Bot, color: "text-[#6366f1]", bg: "bg-[rgba(99,102,241,0.1)]" },
    { label: "Published", value: agents.filter(a => a.status === "published").length, icon: CheckCircle, color: "text-[#22c55e]", bg: "bg-[rgba(34,197,94,0.1)]" },
    { label: "Total Calls", value: agents.reduce((acc, a) => acc + a.totalCalls, 0).toLocaleString(), icon: Phone, color: "text-[#38bdf8]", bg: "bg-[rgba(56,189,248,0.1)]" },
    { label: "In Testing", value: agents.filter(a => a.status === "testing").length, icon: Activity, color: "text-[#f59e0b]", bg: "bg-[rgba(245,158,11,0.1)]" },
  ];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>Voice Agents</h1>
          <p className="text-sm text-[#636680] mt-1">Create, configure, and manage your AI voice agents</p>
        </div>
        <button
          onClick={onCreateAgent}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#6366f1] text-white text-sm font-semibold rounded-xl hover:bg-[#4f46e5] transition-all shadow-lg shadow-[rgba(99,102,241,0.3)] hover:shadow-[rgba(99,102,241,0.4)] hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Create Voice Agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-4 bg-[#0d1018] border border-[rgba(99,102,241,0.14)] rounded-xl">
              <div className="flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.bg)}>
                  <Icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>{stat.value}</p>
                  <p className="text-xs text-[#636680]">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d4060]" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search agents by name or description..."
            className="w-full pl-9 pr-3 py-2 bg-[#0d1018] border border-[rgba(99,102,241,0.18)] rounded-lg text-sm text-[#e2e4ef] placeholder-[#3d4060] outline-none focus:ring-1 focus:ring-[#6366f1] focus:border-[#6366f1] transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "published", "testing", "draft"] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "px-3 py-2 text-xs rounded-lg border transition-colors",
                statusFilter === s
                  ? "bg-[rgba(99,102,241,0.15)] border-[rgba(99,102,241,0.4)] text-[#a78bfa]"
                  : "bg-[#0d1018] border-[rgba(99,102,241,0.14)] text-[#636680] hover:border-[rgba(99,102,241,0.3)] hover:text-[#b4b8cc]"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <select
            value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-2 bg-[#0d1018] border border-[rgba(99,102,241,0.14)] rounded-lg text-xs text-[#636680] outline-none appearance-none pr-6"
          >
            <option value="lastUpdated">Latest</option>
            <option value="name">Name</option>
            <option value="totalCalls">Most Calls</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0d1018] border border-[rgba(99,102,241,0.14)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(99,102,241,0.1)]">
                {["Agent", "Models", "Voice", "Status", "Calls", "Updated", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs text-[#3d4060] font-medium uppercase tracking-wider font-mono whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#3d4060] text-sm">
                    No agents found. <button onClick={onCreateAgent} className="text-[#6366f1] hover:text-[#a78bfa]">Create your first agent</button>
                  </td>
                </tr>
              ) : paged.map((agent, idx) => (
                <tr key={agent.id} className={cn(
                  "border-b border-[rgba(99,102,241,0.06)] hover:bg-[rgba(99,102,241,0.04)] transition-colors",
                  idx === paged.length - 1 ? "border-b-0" : ""
                )}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[rgba(99,102,241,0.12)] flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-[#6366f1]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#e2e4ef] text-sm leading-tight">{agent.name}</p>
                        <p className="text-xs text-[#3d4060] truncate max-w-[220px]">{agent.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-0.5">
                      <span className="block text-xs text-[#636680] font-mono">{STT_PROVIDERS[agent.sttProvider]?.badge || agent.sttProvider}</span>
                      <span className="block text-xs text-[#636680] font-mono">{LLM_PROVIDERS[agent.llmProvider]?.badge || agent.llmProvider} · {agent.llmModel.split("-").slice(0, 2).join("-")}</span>
                      <span className="block text-xs text-[#636680] font-mono">{TTS_PROVIDERS[agent.ttsProvider]?.badge || agent.ttsProvider}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="text-xs text-[#b4b8cc] capitalize">{agent.voice}</p>
                      <p className="text-xs text-[#3d4060]">{agent.language.toUpperCase()}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-[#b4b8cc] font-mono">{agent.totalCalls.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-[#636680] font-mono whitespace-nowrap">{agent.lastUpdated}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      {agent.status === "published" && (
                        <button
                          onClick={() => onUseAgent(agent)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] text-[#22c55e] text-xs rounded-lg hover:bg-[rgba(34,197,94,0.2)] transition-colors whitespace-nowrap"
                        >
                          <Phone className="w-3 h-3" /> Use
                        </button>
                      )}
                      <button
                        onClick={() => onEditAgent(agent)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] text-[#a78bfa] text-xs rounded-lg hover:bg-[rgba(99,102,241,0.2)] transition-colors"
                      >
                        <Settings className="w-3 h-3" /> Edit
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === agent.id ? null : agent.id)}
                          className="p-1.5 rounded-lg text-[#3d4060] hover:text-[#636680] hover:bg-[#171d2e] transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {activeMenu === agent.id && (
                          <div className="absolute right-0 top-8 w-36 bg-[#0d1018] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl z-10 overflow-hidden">
                            <button
                              onClick={() => { onDuplicateAgent(agent); setActiveMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#b4b8cc] hover:bg-[#171d2e] transition-colors"
                            >
                              <Copy className="w-3 h-3" /> Duplicate
                            </button>
                            <button
                              onClick={() => { onDeleteAgent(agent.id); setActiveMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(99,102,241,0.1)]">
            <span className="text-xs text-[#636680] font-mono">{filtered.length} agents</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs text-[#636680] hover:text-[#b4b8cc] disabled:opacity-30 transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={cn(
                    "w-6 h-6 text-xs rounded transition-colors",
                    p === page ? "bg-[#6366f1] text-white" : "text-[#636680] hover:text-[#b4b8cc]"
                  )}>{p}</button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs text-[#636680] hover:text-[#b4b8cc] disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {agents.filter(a => a.status === "published").length > 0 && (
        <div className="mt-6 p-4 bg-[rgba(34,197,94,0.05)] border border-[rgba(34,197,94,0.2)] rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#22c55e]" style={{ fontFamily: "Outfit, sans-serif" }}>
              {agents.filter(a => a.status === "published").length} agent{agents.filter(a => a.status === "published").length > 1 ? "s" : ""} live in production
            </p>
            <p className="text-xs text-[#636680] mt-0.5">Click "Use" on any published agent to start a conversation</p>
          </div>
          <button onClick={() => onUseAgent(agents.find(a => a.status === "published")!)}
            className="flex items-center gap-2 px-4 py-2 bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[#22c55e] text-sm rounded-lg hover:bg-[rgba(34,197,94,0.25)] transition-colors font-medium">
            <Phone className="w-4 h-4" /> Use Agent
          </button>
        </div>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [view, setView] = useState<View>("dashboard");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [, setProviderCatalogVersion] = useState(0);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [useAgentTarget, setUseAgentTarget] = useState<Agent | null>(null);


  useEffect(() => {
  let mounted = true;


  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!mounted) return;


    setSession(session);
    setAuthLoading(false);
  });


  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    setAuthLoading(false);
  });


  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);

  useEffect(() => {
    let mounted = true;

    apiRequest("/providers")
      .then(data => {
        if (!mounted) return;
        applyProviderCatalog(data);
        setProviderCatalogVersion(version => version + 1);
      })
      .catch(error => {
        console.error("Failed to load providers:", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let mounted = true;

    apiRequest("/agents?page=1&page_size=100")
      .then(data => {
        if (mounted) setAgents((data.items || []).map(mapAgent));
      })
      .catch(error => {
        console.error("Failed to load agents:", error);
      });

    return () => {
      mounted = false;
    };
  }, [session]);


if (authLoading) {
  return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
      <p className="text-[#e2e4ef]">
        Checking authentication...
      </p>
    </div>
  );
}

if (!session) {
  window.location.href = "http://localhost:5173";
  return null;
}






    const handleLogout = async () => {
  console.log("LOGOUT BUTTON CLICKED");

  const { data, error } = await supabase.auth.signOut();

  console.log("SIGN OUT RESULT:", { data, error });

  const { data: sessionData } = await supabase.auth.getSession();

  console.log("SESSION AFTER LOGOUT:", sessionData.session);
};



  // EVERYTHING ELSE YOU ALREADY HAVE



  const handleCreateAgent = () => {
    setEditingAgent(null);
    setView("wizard");
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setView("wizard");
  };

  const handleSaveAgent = async (form: AgentForm) => {
    try {
      const data = await apiRequest(
        editingAgent ? `/agents/${editingAgent.id}` : "/agents",
        {
          method: editingAgent ? "PATCH" : "POST",
          body: JSON.stringify(form),
        },
      );
      const savedAgent = mapAgent(data);

      setAgents(prev => editingAgent
        ? prev.map(agent => agent.id === savedAgent.id ? savedAgent : agent)
        : [savedAgent, ...prev]);
    } catch (error) {
      console.error("Failed to save agent:", error);
      window.alert(error instanceof Error ? error.message : "Failed to save agent");
    }
  };

  const handleDuplicateAgent = async (agent: Agent) => {
    try {
      const data = await apiRequest("/agents", {
        method: "POST",
        body: JSON.stringify({ ...agent, name: `${agent.name} (Copy)`, status: "draft" }),
      });
      setAgents(prev => [mapAgent(data), ...prev]);
    } catch (error) {
      console.error("Failed to duplicate agent:", error);
      window.alert(error instanceof Error ? error.message : "Failed to duplicate agent");
    }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await apiRequest(`/agents/${id}`, { method: "DELETE" });
      setAgents(prev => prev.filter(agent => agent.id !== id));
    } catch (error) {
      console.error("Failed to delete agent:", error);
      window.alert(error instanceof Error ? error.message : "Failed to delete agent");
    }
  };

  const getInitialForm = (): AgentForm => {
    if (!editingAgent) return { ...defaultForm };
    return {
      ...defaultForm,
      name: editingAgent.name, description: editingAgent.description,
      agentType: editingAgent.agentType, status: editingAgent.status,
      sttProvider: editingAgent.sttProvider, sttModel: editingAgent.sttModel,
      llmProvider: editingAgent.llmProvider, llmModel: editingAgent.llmModel,
      ttsProvider: editingAgent.ttsProvider, ttsModel: editingAgent.ttsModel,
      voice: editingAgent.voice, language: editingAgent.language,
      personality: editingAgent.personality, tone: editingAgent.tone,
    };
  };

  return (
    <div className="min-h-screen bg-[#07090f]">
      {/* Global nav */}
      <header className="sticky top-0 z-40 border-b border-[rgba(99,102,241,0.14)] bg-[#09090f]/95 backdrop-blur-sm">
        <div className="flex items-center gap-4 px-6 h-14">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-7 h-7 rounded-lg bg-[#6366f1] flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-[#e2e4ef]" style={{ fontFamily: "Outfit, sans-serif" }}>VoxAgent</span>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { label: "Agents", active: true },
              { label: "Templates", active: false },
              { label: "Analytics", active: false },
              { label: "Docs", active: false },
            ].map(item => (
              <button key={item.label}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors",
                  item.active && view === "dashboard"
                    ? "text-[#e2e4ef] bg-[rgba(99,102,241,0.12)]"
                    : "text-[#636680] hover:text-[#b4b8cc] hover:bg-[#111520]"
                )}
                onClick={() => { if (item.label === "Agents") setView("dashboard"); }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button
  onClick={handleLogout}
  className="px-3 py-1.5 text-sm rounded-lg text-[#b4b8cc] hover:bg-[#111520]"
>
  Logout
</button>

            <button className="p-1.5 rounded-lg text-[#636680] hover:text-[#b4b8cc] hover:bg-[#111520] transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg text-[#636680] hover:text-[#b4b8cc] hover:bg-[#111520] transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a78bfa] flex items-center justify-center text-xs font-bold text-white">
              A
            </div>
          </div>
        </div>
      </header>

      {/* Views */}
      {view === "dashboard" && (
        <Dashboard
          agents={agents}
          onCreateAgent={handleCreateAgent}
          onEditAgent={handleEditAgent}
          onUseAgent={setUseAgentTarget}
          onDuplicateAgent={handleDuplicateAgent}
          onDeleteAgent={handleDeleteAgent}
        />
      )}

      {view === "wizard" && (
        <AgentWizard
          key={editingAgent?.id || "new"}
          initialForm={getInitialForm()}
          onBack={() => setView("dashboard")}
          onSave={handleSaveAgent}
          isEditing={!!editingAgent}
          editingId={editingAgent?.id}
        />
      )}

      {useAgentTarget && (
        <UseAgentModal agent={useAgentTarget} onClose={() => setUseAgentTarget(null)} />
      )}
    </div>
  );
}
