import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  MessageSquare, Phone, Sparkles, Gift, ImagePlus, LayoutDashboard,
  Send, CheckCircle, Trash2, Bell, BellOff, Mic, Pause, Play,
  LogOut, DollarSign, Star, RefreshCw, Instagram,
  Twitter, Music2, Globe, Zap, Github, Settings, Clock,
  ToggleLeft, ToggleRight, AlertCircle, ExternalLink,
  Crown, Lock, Save, Key, CreditCard, User, Paperclip,
  Eye, EyeOff, ChevronRight, ArrowLeft, X, CheckCheck, Camera,
  Brain, Video, Users, TrendingUp, Upload, BarChart2, Copy, Edit3, Check
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const logoHB = `${import.meta.env.BASE_URL}logo-hb.png`;
const GOLD = "#c9a84c";
const GOLD_GRAD = "linear-gradient(135deg,#c9a84c,#f0d080,#c9a84c)";

type Tab = "dashboard" | "earnings" | "chat" | "calls" | "requests" | "tips" | "feed" | "social" | "github" | "settings" | "ai-chat" | "personas" | "training" | "analytics" | "ai-generate" | "gift-cards" | "vip-members";
type GiftCard = { id: number; fanName: string; fanEmail: string; cardType: string; cardAmount: string; purpose: string; frontImageUrl: string; backImageUrl: string; note: string | null; status: string; adminNote: string | null; createdAt: string; verifiedAt: string | null; };

type ChatSession = { id: number; fanName: string; fanEmail: string; fanAvatarUrl?: string | null; freeUsed: number; lastMessageAt: string | null; createdAt: string; lastMessage?: { message: string; senderType: string } | null; unreadCount: number; };
type ChatMessage = { id: number; sessionId: number; senderType: "fan" | "hannah"; message: string; amountPaid: number; isRead: boolean; createdAt: string; };
type Call = { id: number; fanName: string; fanEmail: string; preferredDate: string; durationMinutes: number; amountPaid: number; status: string; notes: string | null; createdAt: string; };
type ContentRequest = { id: number; fanName: string; fanEmail: string; requestType: string; description: string; amountPaid: number; status: string; createdAt: string; };
type Tip = { id: number; fanName: string; fanEmail: string; amount: number; message: string | null; createdAt: string; };
type Post = { id: number; imageUrl: string; videoUrl?: string | null; thumbnailUrl?: string | null; mediaType?: string; caption: string | null; platform: string; isPrivate: boolean; watermark: boolean; createdAt: string; };
type Stats = { totalMessages: number; totalCalls: number; totalRequests: number; totalTips: number; totalRevenue: number; };
type Activity = { type: "message" | "call" | "request" | "tip"; fanName: string; amount: number; detail: string; timestamp: string; };
type SocialConfig = { enabled: boolean; intervalHours: number; xHandle: string; tiktokHandle: string; hasXToken: boolean; hasRapidApiKey: boolean; };
type PlatformSettings = Record<string, string | number | boolean>;

// ── Utils ─────────────────────────────────────────────────────────────────
function parseAttachment(msg: string) {
  if (!msg.startsWith("[ATTACHMENT]")) return null;
  try { return JSON.parse(msg.slice("[ATTACHMENT]".length)) as { type: string; url: string; name: string; size: number }; } catch { return null; }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    paid: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    free: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
    replied: "bg-green-500/20 text-green-300 border-green-500/30",
    pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    confirmed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    completed: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    handled: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  };
  return `inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${map[status] ?? "bg-white/10 text-white/60 border-white/20"}`;
}

function platformIcon(p: string) {
  const cls = "w-4 h-4";
  if (p === "instagram") return <Instagram className={cls} />;
  if (p === "twitter" || p === "x") return <Twitter className={cls} />;
  if (p === "tiktok") return <Music2 className={cls} />;
  return <Globe className={cls} />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── GoldCard ─────────────────────────────────────────────────────────────
function GoldCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(201,168,76,0.1)" }}>
      {children}
    </div>
  );
}

// ── Fan Avatar ────────────────────────────────────────────────────────────
function FanAvatar({ session, size = "sm" }: { session: { fanName: string; fanAvatarUrl?: string | null }; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-9 h-9 text-xs" : "w-12 h-12 text-sm";
  if (session.fanAvatarUrl) {
    const url = session.fanAvatarUrl.startsWith("http") ? session.fanAvatarUrl : `${BASE}${session.fanAvatarUrl}`;
    return <img src={url} alt={session.fanName} className={`${dim} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border border-white/10 flex items-center justify-center font-bold text-white shrink-0`}>
      {session.fanName.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Hannah Avatar ─────────────────────────────────────────────────────────
function HannahAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-9 h-9" : "w-12 h-12";
  return (
    <div className={`${dim} rounded-full shrink-0 overflow-hidden border border-amber-400/30 shadow-lg`}>
      <img src={logoHB} alt="Sophie" className="w-full h-full object-cover"
        onError={e => {
          const t = e.target as HTMLImageElement;
          t.style.display = "none";
          t.parentElement!.style.background = GOLD_GRAD;
          t.parentElement!.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:900;color:#000;font-size:11px;font-family:serif">SR</div>';
        }} />
    </div>
  );
}

// ── Voice Recorder ────────────────────────────────────────────────────────
function VoiceRecorder({ onRecorded, disabled }: { onRecorded: (blob: Blob) => void; disabled: boolean }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { onRecorded(new Blob(chunksRef.current, { type: "audio/webm" })); stream.getTracks().forEach((t) => t.stop()); };
      mr.start();
      mediaRef.current = mr;
      setRecording(true); setSecs(0);
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch { alert("Microphone permission required."); }
  };

  const stop = () => {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  if (recording) {
    return (
      <button onClick={stop} className="flex items-center gap-2 h-11 px-4 rounded-2xl font-semibold text-sm animate-pulse"
        style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)" }}>
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-red-400 text-xs">{formatDuration(secs)}</span>
        <span className="text-red-400 text-xs">Stop</span>
      </button>
    );
  }

  return (
    <button onClick={start} disabled={disabled}
      className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 hover:bg-white/10 disabled:opacity-30"
      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
      <Mic className="w-5 h-5" />
    </button>
  );
}

// ── Voice Player ──────────────────────────────────────────────────────────
function VoicePlayer({ url, isHannah }: { url: string; isHannah: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fullUrl = url.startsWith("http") ? url : `${BASE}${url}`;

  useEffect(() => {
    const audio = new Audio(fullUrl);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(Math.floor(audio.duration));
    audio.ontimeupdate = () => setCurrent(Math.floor(audio.currentTime));
    audio.onended = () => { setPlaying(false); setCurrent(0); };
    return () => { audio.pause(); };
  }, [fullUrl]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 min-w-[170px]">
      <button onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${isHannah ? "text-black" : "text-white bg-white/20"}`}
        style={isHannah ? { background: GOLD_GRAD } : {}}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={`h-1 rounded-full ${isHannah ? "bg-black/15" : "bg-white/20"}`}>
          <div className={`h-full rounded-full ${isHannah ? "bg-black/50" : "bg-white/70"}`} style={{ width: `${pct}%`, transition: "width 0.5s linear" }} />
        </div>
        <span className={`text-[10px] font-mono ${isHannah ? "text-black/50" : "text-white/50"}`}>{formatDuration(playing ? current : duration)}</span>
      </div>
      <div className="flex items-center gap-0.5 opacity-30">
        {[...Array(10)].map((_, i) => (
          <div key={i} className={`w-0.5 rounded-full ${isHannah ? "bg-black" : "bg-white"}`}
            style={{ height: `${4 + Math.sin(i) * 8 + 6}px` }} />
        ))}
      </div>
    </div>
  );
}

// ── Chat Bubble ───────────────────────────────────────────────────────────
function ChatBubble({ msg, session }: { msg: ChatMessage; session: ChatSession }) {
  const isHannah = msg.senderType === "hannah";
  const att = parseAttachment(msg.message);
  const time = new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const fullUrl = att?.url ? (att.url.startsWith("http") ? att.url : `${BASE}${att.url}`) : "";

  return (
    <div className={`flex items-end gap-2 mb-2 ${isHannah ? "justify-end" : "justify-start"}`}>
      {!isHannah && <FanAvatar session={session} size="sm" />}
      <div className={`max-w-[72%] flex flex-col gap-0.5 ${isHannah ? "items-end" : "items-start"}`}>
        {!isHannah && <span className="text-[11px] text-white/30 ml-1">{session.fanName}</span>}
        {isHannah && <span className="text-[11px] mr-1 font-semibold" style={{ color: GOLD }}>You (Sophie) ✨</span>}
        <div className={`rounded-2xl overflow-hidden shadow-md ${isHannah ? "rounded-br-sm" : "rounded-bl-sm"}`}
          style={isHannah
            ? { background: GOLD_GRAD, color: "#000" }
            : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}>
          {att ? (
            <div className="px-2 py-2">
              {att.type === "voice" && <VoicePlayer url={att.url} isHannah={isHannah} />}
              {att.type === "image" && <a href={fullUrl} target="_blank" rel="noreferrer"><img src={fullUrl} alt="" className="max-w-[200px] rounded-xl" /></a>}
              {att.type === "file" && (
                <a href={fullUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2">
                  <Paperclip className="w-4 h-4 shrink-0" />
                  <div><p className="text-sm font-medium truncate max-w-[140px]">{att.name}</p><p className="text-[10px] opacity-50">{Math.round(att.size / 1024)}KB</p></div>
                </a>
              )}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm leading-relaxed">{msg.message}</p>
          )}
        </div>
        <div className={`flex items-center gap-1 text-[10px] text-white/25 ${isHannah ? "mr-1 flex-row-reverse" : "ml-1"}`}>
          <span>{time}</span>
          {isHannah && <CheckCheck className="w-3 h-3" style={{ color: msg.isRead ? GOLD : "rgba(255,255,255,0.2)" }} />}
        </div>
      </div>
      {isHannah && <HannahAvatar size="sm" />}
    </div>
  );
}

// ── Main Admin Component ─────────────────────────────────────────────────
export default function Admin() {
  const { toast } = useToast();
  const [apiUrl, setApiUrl] = useState<string>(() => localStorage.getItem("hb_api_url") || "");
  const [connectInput, setConnectInput] = useState(() => window.location.origin.includes("localhost") ? "" : window.location.origin);
  const [connectError, setConnectError] = useState("");
  const [connectTesting, setConnectTesting] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const copyUrl = (url: string) => { navigator.clipboard.writeText(url).catch(() => {}); setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); };
  const API = apiUrl ? `${apiUrl.replace(/\/$/, "")}/api` : `${BASE}/api`;
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem("hb_admin_key"));
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("hb_admin_key") || "");
  const [pwInput, setPwInput] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  // ── AI Generate state ───────────────────────────────────────────────────
  const [aiGenPrompt, setAiGenPrompt] = useState("");
  const [aiGenSize, setAiGenSize] = useState("1024x1024");
  const [aiGenStyle, setAiGenStyle] = useState("vivid");
  const [aiGenPublish, setAiGenPublish] = useState(false);
  const [aiGenVip, setAiGenVip] = useState(false);
  const [aiGenCaption, setAiGenCaption] = useState("");
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenResult, setAiGenResult] = useState<{ imageUrl?: string; revisedPrompt?: string; status?: string; message?: string } | null>(null);
  const [aiVideoPrompt, setAiVideoPrompt] = useState("");
  const [aiVideoLoading, setAiVideoLoading] = useState(false);
  const [aiVideoResult, setAiVideoResult] = useState<{ imageUrl?: string; taskId?: string; status?: string; message?: string; provider?: string } | null>(null);
  const [aiSubTab, setAiSubTab] = useState<"image" | "video" | "process" | "voice">("image");
  const [aiProcessFile, setAiProcessFile] = useState<File | null>(null);
  const [aiProcessOp, setAiProcessOp] = useState("bg-remove");
  const [aiProcessPrompt, setAiProcessPrompt] = useState("");
  const [aiProcessLoading, setAiProcessLoading] = useState(false);
  const [aiProcessResult, setAiProcessResult] = useState<{ fileUrl?: string; imageUrl?: string; taskId?: string; status?: string; message?: string; availableOps?: { id: string; label: string; icon: string }[] } | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState<{ audioUrl?: string; status?: string; message?: string } | null>(null);
  const aiProcessFileRef = useRef<HTMLInputElement>(null);

  // ── AI Scheduler state ──────────────────────────────────────────────────
  type SchedulerSuggestion = {
    sessionId: number; fanName: string; fanEmail: string; lastFanMessage: string;
    suggestion: string; imageUrl?: string; isGiftCardRequest: boolean;
    humanNote: string; delayMs: number; generatedAt: string;
  };
  type ScheduledReply = { sessionId: number; fanName: string; sendAt: string; scheduledAt: string; message: string; imageUrl?: string };
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [schedulerIntervalMin, setSchedulerIntervalMin] = useState(30);
  const [schedulerSuggestions, setSchedulerSuggestions] = useState<SchedulerSuggestion[]>([]);
  const [scheduledReplies, setScheduledReplies] = useState<ScheduledReply[]>([]);
  const [countdown, setCountdown] = useState<Record<number, string>>({});
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [schedulerLastRun, setSchedulerLastRun] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<Record<number, string>>({});

  // Data
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatReply, setChatReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [showChatList, setShowChatList] = useState(true);
  const [calls, setCalls] = useState<Call[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [liveFlash, setLiveFlash] = useState(false);
  const [newPost, setNewPost] = useState({ imageUrl: "", caption: "", platform: "instagram", isPrivate: false });
  const [addingPost, setAddingPost] = useState(false);
  const [postMediaFile, setPostMediaFile] = useState<string | null>(null);
  const [postMediaType, setPostMediaType] = useState<"image" | "video">("image");
  const [postMediaMime, setPostMediaMime] = useState<string>("");
  const postImageRef = useRef<HTMLInputElement>(null);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [giftCardFilter, setGiftCardFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [giftCardAdminNote, setGiftCardAdminNote] = useState<Record<number, string>>({});
  const [lightboxImg, setLightboxImg] = useState<{ src: string; label: string; gcId: number } | null>(null);
  const [socialConfig, setSocialConfig] = useState<SocialConfig | null>(null);
  const [syncingX, setSyncingX] = useState(false);
  const [syncingTikTok, setSyncingTikTok] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingInstagram, setSyncingInstagram] = useState(false);
  const [igToken, setIgToken] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [xHandleInput, setXHandleInput] = useState("");
  const [tiktokHandleInput, setTiktokHandleInput] = useState("");
  const [syncIntervalInput, setSyncIntervalInput] = useState("6");
  const [lastSyncResult, setLastSyncResult] = useState<Record<string, unknown> | null>(null);
  const [githubPushing, setGithubPushing] = useState<"public" | "admin" | null>(null);
  const [githubResult, setGithubResult] = useState<{ target?: string; success?: boolean; error?: string } | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [rawSecrets, setRawSecrets] = useState<Record<string, string>>({});

  // AI Studio state
  const [aiChatSession, setAiChatSession] = useState<ChatSession | null>(null);
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [loadingAiSuggest, setLoadingAiSuggest] = useState(false);
  const [aiReplyText, setAiReplyText] = useState("");
  const [sendingAiReply, setSendingAiReply] = useState(false);
  const [aiMode, setAiMode] = useState<"autonomous" | "approval">("approval");
  const [aiChatPollRef] = useState<{ current: ReturnType<typeof setInterval> | null }>({ current: null });
  const [trainingStep, setTrainingStep] = useState<"upload" | "processing" | "done">("upload");
  const [trainProgress, setTrainProgress] = useState(0);
  const [trainVideos, setTrainVideos] = useState<File[]>([]);
  const [trainAudios, setTrainAudios] = useState<File[]>([]);
  const [trainPersonality, setTrainPersonality] = useState("");
  const [trainJobId, setTrainJobId] = useState<string | null>(null);
  const [personaEditId, setPersonaEditId] = useState<string | null>(null);
  const [personaEditBuf, setPersonaEditBuf] = useState("");

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const h = { "x-admin-key": adminKey };

  // ── Data fetching ──────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [sessRes, callRes, reqRes, tipRes, postRes, statRes, gcRes] = await Promise.all([
      fetch(`${API}/chat/admin/sessions`, { headers: h }),
      fetch(`${API}/calls`, { headers: h }),
      fetch(`${API}/requests`, { headers: h }),
      fetch(`${API}/tips`, { headers: h }),
      fetch(`${API}/posts`, { headers: h }),
      fetch(`${API}/stats`, { headers: h }),
      fetch(`${API}/gift-cards`, { headers: h }),
    ]);
    if (sessRes.ok) { const data = await sessRes.json(); setChatSessions(data); }
    if (callRes.ok) setCalls(await callRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
    if (tipRes.ok) setTips(await tipRes.json());
    if (postRes.ok) setPosts(await postRes.json());
    if (statRes.ok) setStats(await statRes.json());
    if (gcRes.ok) setGiftCards(await gcRes.json());
  }, [adminKey]);

  const fetchSocialConfig = useCallback(async () => {
    const res = await fetch(`${API}/social/sync/config`, { headers: h });
    if (res.ok) {
      const cfg = await res.json() as SocialConfig;
      setSocialConfig(cfg);
      setXHandleInput(cfg.xHandle || "");
      setTiktokHandleInput(cfg.tiktokHandle || "");
      setSyncIntervalInput(String(cfg.intervalHours || 6));
    }
  }, [adminKey]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    const res = await fetch(`${API}/settings`, { headers: h });
    if (res.ok) {
      const data = await res.json();
      setRawSecrets(data._raw || {});
      const { _raw, ...safe } = data;
      setPlatformSettings(safe);
    }
    setSettingsLoading(false);
  }, [adminKey]);

  const fetchChatMessages = useCallback(async (session: ChatSession) => {
    const res = await fetch(`${API}/chat/admin/${session.id}/messages`, { headers: h });
    if (res.ok) {
      const data = await res.json();
      setChatMessages(data.messages);
      setTimeout(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }, 80);
    }
  }, [adminKey]);

  const saveSettings = async (patch: PlatformSettings) => {
    setSettingsSaving(true);
    const res = await fetch(`${API}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify(patch),
    });
    if (res.ok) { toast({ title: "✓ Settings saved" }); await fetchSettings(); }
    else toast({ title: "Save failed", variant: "destructive" });
    setSettingsSaving(false);
  };

  const login = async () => {
    const res = await fetch(`${API}/admin/auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwInput }),
    });
    const data = await res.json();
    if (data.authorized) {
      sessionStorage.setItem("hb_admin_key", data.key);
      setAdminKey(data.key); setAuthed(true);
    } else toast({ title: "Incorrect password", variant: "destructive" });
  };

  useEffect(() => {
    if (!authed) return;
    fetchAll(); fetchSocialConfig(); fetchSettings();
  }, [authed, fetchAll, fetchSocialConfig, fetchSettings]);

  // SSE activity
  useEffect(() => {
    if (!authed) return;
    const es = new EventSource(`${API}/events`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as (Activity & { type: string }) | { type: "connected" };
        if (data.type === "connected") return;
        const ev = data as Activity;
        setActivity((prev) => [ev, ...prev].slice(0, 50));
        fetchAll();

        // ── Live flash pulse on header badge ──────────────────────────────
        setLiveFlash(true);
        if (liveFlashRef.current) clearTimeout(liveFlashRef.current);
        liveFlashRef.current = setTimeout(() => setLiveFlash(false), 3500);

        // ── In-app toast notification with tab navigation ─────────────────
        const icons: Record<string, string> = { message: "💬", call: "📹", request: "✨", tip: "💝" };
        const tabMap: Record<string, Tab> = { message: "chat", call: "calls", request: "requests", tip: "tips" };
        const label = ev.type === "tip" && ev.amount > 0
          ? `$${ev.amount} tip received!`
          : ev.type === "message" ? "sent a message"
          : ev.type === "call" ? "booked a call"
          : ev.type === "request" ? "submitted a request"
          : ev.detail;
        toast({
          title: `${icons[ev.type] || "🔔"} ${ev.fanName}`,
          description: `${label}${ev.detail && ev.detail !== label ? ` · ${ev.detail.slice(0, 60)}` : ""}`,
          action: (
            <ToastAction altText="View" onClick={() => setTab(tabMap[ev.type] ?? "dashboard")}>
              View
            </ToastAction>
          ),
        });

        // ── Browser push notifications (if enabled) ───────────────────────
        if (notifEnabled && Notification.permission === "granted") {
          new Notification(`${icons[ev.type] || "🔔"} Sophie Rain`, { body: ev.detail, icon: "/favicon.ico" });
        }
      } catch {}
    };
    return () => es.close();
  }, [authed, notifEnabled, fetchAll]);

  // Poll chat messages when a session is selected
  useEffect(() => {
    if (!selectedSession) { if (chatPollRef.current) clearInterval(chatPollRef.current); return; }
    fetchChatMessages(selectedSession);
    chatPollRef.current = setInterval(() => fetchChatMessages(selectedSession), 4000);
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [selectedSession?.id, fetchChatMessages]);

  const selectSession = (s: ChatSession) => {
    setSelectedSession(s);
    setShowChatList(false);
    setChatMessages([]);
  };

  const sendReply = async () => {
    if (!chatReply.trim() || !selectedSession) return;
    setSendingReply(true);
    const res = await fetch(`${API}/chat/admin/${selectedSession.id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify({ message: chatReply }),
    });
    if (res.ok) {
      const msg = await res.json();
      setChatMessages((prev) => [...prev, msg]);
      setChatReply("");
      setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 80);
      fetchAll();
    } else toast({ title: "Failed to send", variant: "destructive" });
    setSendingReply(false);
  };

  const sendVoiceReply = async (blob: Blob) => {
    if (!selectedSession) return;
    const fd = new FormData();
    fd.append("file", new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }));
    setSendingReply(true);
    const res = await fetch(`${API}/chat/admin/${selectedSession.id}/reply-media`, { method: "POST", headers: h, body: fd });
    if (res.ok) {
      const msg = await res.json();
      setChatMessages((prev) => [...prev, msg]);
      setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 80);
    }
    setSendingReply(false);
  };

  const sendFileReply = async (file: File) => {
    if (!selectedSession) return;
    const fd = new FormData();
    fd.append("file", file);
    setSendingReply(true);
    const res = await fetch(`${API}/chat/admin/${selectedSession.id}/reply-media`, { method: "POST", headers: h, body: fd });
    if (res.ok) {
      const msg = await res.json();
      setChatMessages((prev) => [...prev, msg]);
      setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 80);
    }
    setSendingReply(false);
  };

  const updateCallStatus = async (id: number, status: string) => {
    await fetch(`${API}/calls/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ status }) });
    fetchAll();
  };

  const deletePost = async (id: number) => {
    await fetch(`${API}/posts/${id}`, { method: "DELETE", headers: h });
    fetchAll();
  };

  const addPost = async () => {
    if (!newPost.imageUrl && !postMediaFile) return;
    setAddingPost(true);
    try {
      let imageUrl = newPost.imageUrl;
      let videoUrl: string | undefined;
      let mediaType = "image";

      if (postMediaFile) {
        const isVid = postMediaType === "video";
        const upRes = await fetch(`${API}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json", ...h },
          body: JSON.stringify({
            [isVid ? "video" : "image"]: postMediaFile,
            filename: `post_${Date.now()}`,
          }),
        });
        if (upRes.ok) {
          const d = await upRes.json();
          if (isVid) { videoUrl = d.url; imageUrl = ""; mediaType = "video"; }
          else { imageUrl = d.url; mediaType = "image"; }
        }
      } else if (newPost.imageUrl) {
        // detect if pasted URL is a video by extension
        const ext = newPost.imageUrl.split("?")[0].split(".").pop()?.toLowerCase() || "";
        if (["mp4", "mov", "webm", "avi", "3gp", "mpeg"].includes(ext)) {
          videoUrl = newPost.imageUrl;
          imageUrl = "";
          mediaType = "video";
        }
      }

      await fetch(`${API}/posts`, {
        method: "POST", headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ ...newPost, imageUrl: imageUrl || "/uploads/posts/default.png", videoUrl, mediaType, watermark: false }),
      });
      setNewPost({ imageUrl: "", caption: "", platform: "custom", isPrivate: false });
      setPostMediaFile(null);
      setPostMediaType("image");
      setPostMediaMime("");
      toast({ title: "Published to feed!" });
      fetchAll();
    } catch { toast({ title: "Failed to publish", variant: "destructive" }); }
    setAddingPost(false);
  };

  const updateGiftCard = async (id: number, status: string, adminNote?: string) => {
    const res = await fetch(`${API}/gift-cards/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify({ status, adminNote: adminNote || giftCardAdminNote[id] || null }),
    });
    if (res.ok) { toast({ title: status === "approved" ? "Gift card approved! Access unlocked." : "Gift card rejected." }); fetchAll(); }
  };

  const saveSocialConfig = async () => {
    const res = await fetch(`${API}/social/sync/config`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify({ xHandle: xHandleInput, tiktokHandle: tiktokHandleInput, intervalHours: parseInt(syncIntervalInput, 10) || 6 }),
    });
    if (res.ok) { setSocialConfig(await res.json()); toast({ title: "Social settings saved!" }); }
  };

  const toggleAutoSync = async () => {
    const res = await fetch(`${API}/social/sync/config`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify({ enabled: !socialConfig?.enabled }),
    });
    if (res.ok) { const cfg = await res.json() as SocialConfig; setSocialConfig(cfg); toast({ title: cfg.enabled ? "Auto-sync ON 🟢" : "Auto-sync OFF" }); }
  };

  const syncPlatform = async (platform: "x" | "tiktok" | "all") => {
    if (platform === "x") setSyncingX(true);
    else if (platform === "tiktok") setSyncingTikTok(true);
    else setSyncingAll(true);
    const handle = platform === "x" ? xHandleInput : platform === "tiktok" ? tiktokHandleInput : undefined;
    const endpoint = platform === "all" ? "/social/sync/all" : `/social/sync/${platform}`;
    try {
      const res = await fetch(`${API}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(handle ? { handle } : {}) });
      const data = await res.json();
      setLastSyncResult(data as Record<string, unknown>);
      if (res.ok) {
        const synced = typeof data.synced === "number" ? data.synced : ((data.x?.synced ?? 0) + (data.tiktok?.synced ?? 0));
        toast({ title: `Synced ${synced} new post${synced !== 1 ? "s" : ""}!` });
        fetchAll();
      } else toast({ title: "Sync failed", description: data.error, variant: "destructive" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    if (platform === "x") setSyncingX(false);
    else if (platform === "tiktok") setSyncingTikTok(false);
    else setSyncingAll(false);
  };

  const pushToGitHub = async (target: "public" | "admin") => {
    setGithubPushing(target); setGithubResult(null);
    try {
      const res = await fetch(`${API}/social/github/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      setGithubResult(data);
      if (res.ok && data.success) toast({ title: `✓ Pushed to ${target === "admin" ? "Admin" : "Hannah-brooks-love"}!` });
      else toast({ title: "Push failed", description: data.error, variant: "destructive" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    setGithubPushing(null);
  };

  const VAPID_PUBLIC_KEY = "BDM_U27gb4qFr3Kvn4Jc4Xdt4JlyOxf7FDkd8J599gP6GnrWbK9IomX9WTF75QVRvcQzE6U1Kd5m69k53KXtXsg";

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  };

  const enableNotifications = async () => {
    // 1. Request permission
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setNotifEnabled(false);
      toast({ title: "Permission denied", description: "Go to browser settings and allow notifications for this site.", variant: "destructive" });
      return;
    }
    setNotifEnabled(true);

    // 2. Register service worker + subscribe to push
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        toast({ title: "Browser notifications enabled", description: "Push notifications not supported — add this page to your home screen for full push support." });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await fetch(`${API}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      toast({ title: "🔔 Push notifications ON!", description: "You'll get real alerts on this device for every message, gift card, call and more." });
    } catch (err) {
      console.error("Push subscription failed:", err);
      toast({ title: "Notifications enabled (browser only)", description: "Could not set up push — add this page to your home screen and try again." });
    }
  };

  const handleConnect = async () => {
    const url = connectInput.trim().replace(/\/$/, "");
    if (!url) return;
    setConnectTesting(true);
    setConnectError("");
    try {
      const res = await fetch(`${url}/api/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "__test__" }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok || res.status === 401) {
        localStorage.setItem("hb_api_url", url);
        setApiUrl(url);
      } else {
        setConnectError(`Server returned ${res.status}. Make sure the URL is correct.`);
      }
    } catch {
      setConnectError("Could not reach that URL. Check it's correct and the server is running.");
    }
    setConnectTesting(false);
  };

  const disconnect = () => {
    localStorage.removeItem("hb_api_url");
    sessionStorage.removeItem("hb_admin_key");
    setApiUrl("");
    setConnectInput("");
    setConnectError("");
    setAuthed(false);
    setAdminKey("");
  };

  const logout = () => { sessionStorage.removeItem("hb_admin_key"); setAuthed(false); setAdminKey(""); };

  // ── AI Studio handlers ─────────────────────────────────────────────────
  const openAiSession = async (s: ChatSession) => {
    setAiChatSession(s);
    setAiSuggestion("");
    setAiReplyText("");
    setAiChatMessages([]);
    if (aiChatPollRef.current) clearInterval(aiChatPollRef.current);
    const loadMsgs = async () => {
      const res = await fetch(`${API}/chat/admin/${s.id}/messages`, { headers: h });
      if (res.ok) { const data = await res.json(); setAiChatMessages(data.messages); }
    };
    await loadMsgs();
    aiChatPollRef.current = setInterval(loadMsgs, 5000);
  };

  const suggestAiReply = async () => {
    if (!aiChatSession) return;
    setLoadingAiSuggest(true);
    try {
      const res = await fetch(`${API}/chat/admin/${aiChatSession.id}/ai-suggest`, { method: "POST", headers: h });
      if (res.ok) { const data = await res.json(); setAiSuggestion(data.suggestion); }
      else setAiSuggestion("Thank you so much for reaching out darling! 🥰 How can I make your day special today? 💫");
    } catch { setAiSuggestion("Thank you so much for reaching out darling! 🥰 How can I make your day special today? 💫"); }
    finally { setLoadingAiSuggest(false); }
  };

  const sendAiReply = async (text: string) => {
    if (!aiChatSession || !text.trim()) return;
    setSendingAiReply(true);
    const res = await fetch(`${API}/chat/admin/${aiChatSession.id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify({ message: text }),
    });
    if (res.ok) {
      const msg = await res.json();
      setAiChatMessages(prev => [...prev, msg]);
      setAiReplyText(""); setAiSuggestion("");
      fetchAll();
    }
    setSendingAiReply(false);
  };

  const startTraining = () => {
    if (trainVideos.length === 0 && trainAudios.length === 0) return;
    setTrainingStep("processing");
    const interval = setInterval(() => {
      setTrainProgress(p => {
        if (p >= 100) { clearInterval(interval); setTrainingStep("done"); return 100; }
        return p + Math.random() * 3;
      });
    }, 200);
    setTrainJobId(`job_${Date.now()}`);
  };

  // ── LOGIN ─────────────────────────────────────────────────────────────
  if (!apiUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
        style={{ background: "radial-gradient(ellipse at top,#1a1000 0%,#060606 70%)" }}>
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-5 blur-3xl pointer-events-none"
          style={{ background: GOLD_GRAD, top: "-200px", left: "50%", transform: "translateX(-50%)" }} />
        <div className="w-full max-w-[400px] relative z-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center border border-amber-400/30"
              style={{ background: "rgba(201,168,76,0.08)" }}>
              <Globe className="w-8 h-8" style={{ color: GOLD }} />
            </div>
            <h1 className="text-3xl font-serif font-bold text-white">Connect to Backend</h1>
            <p className="text-white/30 mt-2 text-sm">Enter your public API URL to get started</p>
          </div>
          <div className="rounded-3xl p-7 space-y-4 backdrop-blur-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.15)" }}>
            <div>
              <label className="text-xs text-white/40 block mb-2 uppercase tracking-wider font-semibold">Backend URL</label>
              <div className="relative">
                <Input
                  placeholder="https://your-app.replit.app"
                  value={connectInput}
                  onChange={e => { setConnectInput(e.target.value); setConnectError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleConnect()}
                  className="bg-black/60 border-white/10 text-white h-12 rounded-xl placeholder:text-white/20 pr-10"
                />
                {connectInput && (
                  <button onClick={() => copyUrl(connectInput)} title="Copy URL"
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: urlCopied ? "#4ade80" : "rgba(255,255,255,0.25)" }}>
                    {urlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <p className="text-xs text-white/20 mt-1.5">Your Replit app URL, no trailing slash needed</p>
            </div>
            {connectError && (
              <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/20"
                style={{ background: "rgba(239,68,68,0.08)" }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{connectError}</span>
              </div>
            )}
            <button onClick={handleConnect} disabled={connectTesting || !connectInput.trim()}
              className="w-full h-12 rounded-xl font-bold text-black tracking-wider transition-all disabled:opacity-50 text-sm"
              style={{ background: GOLD_GRAD, boxShadow: "0 4px 20px rgba(201,168,76,0.3)" }}>
              {connectTesting ? "Testing connection…" : "Connect & Continue →"}
            </button>
          </div>
          <p className="text-center text-white/15 text-xs mt-8 tracking-wider">CREATOR PORTAL · PRIVATE ACCESS</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
        style={{ background: "radial-gradient(ellipse at top,#1a1000 0%,#060606 70%)" }}>
        {/* Decorative circles */}
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-5 blur-3xl pointer-events-none"
          style={{ background: GOLD_GRAD, top: "-200px", left: "50%", transform: "translateX(-50%)" }} />
        <div className="w-full max-w-[360px] relative z-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 overflow-hidden border-2 border-amber-400/30 shadow-2xl" style={{ boxShadow: "0 8px 40px rgba(201,168,76,0.3)" }}>
              <img src={logoHB} alt="SR" className="w-full h-full object-cover" onError={e => { const t = e.target as HTMLImageElement; t.style.display="none"; t.parentElement!.style.background=GOLD_GRAD; t.parentElement!.innerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:900;color:#000;font-size:28px;font-family:serif">SR</div>'; }} />
            </div>
            <h1 className="text-3xl font-serif font-bold text-white">Creator Portal</h1>
            <p className="text-white/25 mt-2 text-sm tracking-[0.2em] uppercase">Sophie Rain · Private</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/30 font-mono truncate max-w-[220px]">{apiUrl}</span>
              <button onClick={disconnect} className="text-xs text-white/20 hover:text-white/50 transition-colors underline ml-1">
                Change
              </button>
            </div>
          </div>
          <div className="rounded-3xl p-7 space-y-4 backdrop-blur-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.15)" }}>
            <div className="relative">
              <Input type={showPw ? "text" : "password"} placeholder="Enter your password" value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && login()}
                className="bg-black/60 border-white/10 text-white h-13 rounded-xl placeholder:text-white/20 pr-12 h-12" />
              <button onClick={() => setShowPw(s => !s)} className="absolute right-3 top-3 text-white/30 hover:text-white transition-colors">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button onClick={login}
              className="w-full h-13 rounded-xl font-bold text-black tracking-wider transition-all active:scale-98 h-12 text-sm"
              style={{ background: GOLD_GRAD, boxShadow: "0 4px 20px rgba(201,168,76,0.3)" }}>
              Sign In to Portal
            </button>
          </div>
          <p className="text-center text-white/15 text-xs mt-8 tracking-wider">PROTECTED · NOT FOR PUBLIC ACCESS</p>
        </div>
      </div>
    );
  }

  const unreadChats = chatSessions.reduce((a, s) => a + (s.unreadCount || 0), 0);
  const pendingCalls = calls.filter(c => c.status === "pending").length;
  const pendingReqs = requests.filter(r => r.status === "pending").length;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number; section?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { id: "earnings", label: "Earnings", icon: <DollarSign className="w-[18px] h-[18px]" /> },
    { id: "chat", label: "Messages", icon: <MessageSquare className="w-[18px] h-[18px]" />, count: unreadChats },
    { id: "calls", label: "Calls", icon: <Phone className="w-[18px] h-[18px]" />, count: pendingCalls },
    { id: "requests", label: "Requests", icon: <Sparkles className="w-[18px] h-[18px]" />, count: pendingReqs },
    { id: "tips", label: "Tips", icon: <Gift className="w-[18px] h-[18px]" /> },
    { id: "gift-cards", label: "Gift Cards", icon: <CreditCard className="w-[18px] h-[18px]" />, count: giftCards.filter(g => g.status === "pending").length },
    { id: "vip-members", label: "VIP Members", icon: <Crown className="w-[18px] h-[18px]" /> },
    { id: "feed", label: "Feed", icon: <ImagePlus className="w-[18px] h-[18px]" /> },
    { id: "social", label: "Social", icon: <Instagram className="w-[18px] h-[18px]" /> },
    { id: "github", label: "GitHub", icon: <Github className="w-[18px] h-[18px]" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-[18px] h-[18px]" /> },
    { id: "ai-chat", label: "AI Chat", icon: <Brain className="w-[18px] h-[18px]" />, section: "AI Studio" },
    { id: "analytics", label: "Analytics", icon: <BarChart2 className="w-[18px] h-[18px]" /> },
    { id: "personas", label: "Personas", icon: <Users className="w-[18px] h-[18px]" /> },
    { id: "training", label: "Training", icon: <Upload className="w-[18px] h-[18px]" /> },
    { id: "ai-generate", label: "AI Create", icon: <ImagePlus className="w-[18px] h-[18px]" /> },
  ];

  const generateImage = async () => {
    if (!aiGenPrompt.trim()) { toast({ title: "Enter a prompt first", variant: "destructive" }); return; }
    setAiGenLoading(true); setAiGenResult(null);
    try {
      const res = await fetch(`${API}/ai/generate-image`, {
        method: "POST", headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ prompt: aiGenPrompt, size: aiGenSize, style: aiGenStyle, quality: "hd", publishToFeed: aiGenPublish, isVip: aiGenVip, caption: aiGenCaption || aiGenPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiGenResult(data);
      toast({ title: aiGenPublish ? "Image generated & posted to feed!" : "Image generated!" });
      if (aiGenPublish) fetchAll();
    } catch (e: unknown) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
    setAiGenLoading(false);
  };

  const generateVideo = async () => {
    if (!aiVideoPrompt.trim()) { toast({ title: "Enter a video prompt", variant: "destructive" }); return; }
    setAiVideoLoading(true); setAiVideoResult(null);
    try {
      const res = await fetch(`${API}/ai/generate-video`, {
        method: "POST", headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ prompt: aiVideoPrompt, imageUrl: aiGenResult?.imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiVideoResult(data);
      toast({ title: data.status === "generating" ? "Video generating via RunwayML!" : data.status === "image_preview" ? "Preview frame generated!" : "Video queued!" });
    } catch (e: unknown) {
      toast({ title: "Video generation failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
    setAiVideoLoading(false);
  };

  const processMedia = async () => {
    if (!aiProcessFile) { toast({ title: "Upload a file first", variant: "destructive" }); return; }
    setAiProcessLoading(true); setAiProcessResult(null);
    try {
      const isVideo = aiProcessFile.type.startsWith("video");
      const endpoint = isVideo ? "/ai/process-video" : "/ai/process-image";
      const fd = new FormData();
      fd.append(isVideo ? "video" : "image", aiProcessFile);
      fd.append("operation", aiProcessOp);
      fd.append("prompt", aiProcessPrompt);
      const res = await fetch(`${API}${endpoint}`, { method: "POST", headers: h, body: fd });
      const data = await res.json();
      setAiProcessResult(data);
      toast({ title: data.status === "needs_gpu" ? "File uploaded — configure GPU_WORKER_URL to process" : data.status === "completed" ? "Processing complete!" : "Queued for processing" });
    } catch (e: unknown) {
      toast({ title: "Processing failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
    setAiProcessLoading(false);
  };

  const generateVoice = async () => {
    if (!voiceText.trim()) { toast({ title: "Enter text first", variant: "destructive" }); return; }
    setVoiceLoading(true); setVoiceResult(null);
    try {
      const fd = new FormData(); fd.append("text", voiceText);
      const res = await fetch(`${API}/ai/voice-clone`, { method: "POST", headers: h, body: fd });
      const data = await res.json();
      setVoiceResult(data);
      if (data.audioUrl) toast({ title: "Voice generated!" });
      else toast({ title: "Voice config needed", description: data.message });
    } catch (e: unknown) {
      toast({ title: "Voice generation failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
    setVoiceLoading(false);
  };

  // ── Countdown timer for scheduled replies ──────────────────────────────
  useEffect(() => {
    if (!scheduledReplies.length) return;
    const t = setInterval(() => {
      const now = Date.now();
      const times: Record<number, string> = {};
      scheduledReplies.forEach(r => {
        const ms = new Date(r.sendAt).getTime() - now;
        if (ms <= 0) times[r.sessionId] = "Sending…";
        else { const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); times[r.sessionId] = m > 0 ? `${m}m ${s}s` : `${s}s`; }
      });
      setCountdown(times);
      setScheduledReplies(prev => prev.filter(r => new Date(r.sendAt).getTime() > now - 8000));
    }, 1000);
    return () => clearInterval(t);
  }, [scheduledReplies]);

  // ── AI Scheduler functions ──────────────────────────────────────────────
  const fetchSchedulerStatus = async () => {
    try {
      const res = await fetch(`${API}/ai/scheduler/status`, { headers: h });
      if (!res.ok) return;
      const data = await res.json() as { enabled: boolean; intervalMinutes: number; lastRun: string | null; suggestions: SchedulerSuggestion[]; scheduledReplies?: ScheduledReply[] };
      setSchedulerEnabled(data.enabled ?? false);
      setSchedulerIntervalMin(data.intervalMinutes ?? 30);
      setSchedulerSuggestions(data.suggestions ?? []);
      setSchedulerLastRun(data.lastRun ?? null);
      setScheduledReplies(data.scheduledReplies ?? []);
    } catch {}
  };

  useEffect(() => {
    if (tab === "ai-chat") void fetchSchedulerStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const toggleScheduler = async () => {
    setSchedulerLoading(true);
    try {
      const endpoint = schedulerEnabled ? "stop" : "start";
      const res = await fetch(`${API}/ai/scheduler/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ intervalMinutes: schedulerIntervalMin }),
      });
      const data = await res.json() as { enabled: boolean; intervalMinutes?: number; message?: string };
      setSchedulerEnabled(data.enabled ?? !schedulerEnabled);
      toast({ title: data.enabled ? `Scheduler started — every ${schedulerIntervalMin}min` : "Scheduler stopped" });
      void fetchSchedulerStatus();
    } catch { toast({ title: "Scheduler error", variant: "destructive" }); }
    setSchedulerLoading(false);
  };

  const runSchedulerNow = async () => {
    setSchedulerLoading(true);
    try {
      const res = await fetch(`${API}/ai/scheduler/run-now`, { method: "POST", headers: h });
      const data = await res.json() as { pendingCount: number; lastRun: string; suggestions: typeof schedulerSuggestions };
      setSchedulerSuggestions(data.suggestions ?? []);
      setSchedulerLastRun(data.lastRun ?? null);
      toast({ title: `Scanned — ${data.pendingCount ?? 0} suggestion${(data.pendingCount ?? 0) !== 1 ? "s" : ""} ready` });
    } catch { toast({ title: "Scan failed", variant: "destructive" }); }
    setSchedulerLoading(false);
  };

  const approveSchedulerSuggestion = async (sessionId: number, scheduleDelayMs?: number) => {
    const sug = schedulerSuggestions.find(s => s.sessionId === sessionId);
    const msg = (editingSuggestion[sessionId] ?? sug?.suggestion ?? "").trim();
    if (!msg) return;
    try {
      const res = await fetch(`${API}/ai/scheduler/suggestions/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ message: msg, imageUrl: sug?.imageUrl, scheduleDelayMs }),
      });
      const data = await res.json() as { scheduled?: boolean; sendAt?: string };
      if (data.scheduled && data.sendAt && sug) {
        toast({ title: `⏱ Scheduled — sending in ${Math.round((scheduleDelayMs ?? 0) / 60000)} min` });
        setScheduledReplies(prev => [...prev, { sessionId, fanName: sug.fanName, sendAt: data.sendAt!, scheduledAt: new Date().toISOString(), message: msg, imageUrl: sug.imageUrl }]);
      } else {
        toast({ title: "✓ Reply sent to fan!" });
        void fetchAll();
      }
      setSchedulerSuggestions(prev => prev.filter(s => s.sessionId !== sessionId));
      setEditingSuggestion(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
    } catch { toast({ title: "Failed to send reply", variant: "destructive" }); }
  };

  const cancelScheduledReply = async (sessionId: number) => {
    try {
      await fetch(`${API}/ai/scheduler/scheduled/${sessionId}`, { method: "DELETE", headers: h });
      setScheduledReplies(prev => prev.filter(r => r.sessionId !== sessionId));
      toast({ title: "Scheduled reply cancelled" });
    } catch { toast({ title: "Cancel failed", variant: "destructive" }); }
  };

  const dismissSchedulerSuggestion = async (sessionId: number) => {
    try { await fetch(`${API}/ai/scheduler/suggestions/${sessionId}/dismiss`, { method: "POST", headers: h }); } catch {}
    setSchedulerSuggestions(prev => prev.filter(s => s.sessionId !== sessionId));
    setEditingSuggestion(prev => { const n = { ...prev }; delete n[sessionId]; return n; });
  };

  const syncInstagram = async () => {
    setSyncingInstagram(true);
    try {
      const res = await fetch(`${API}/social/sync/instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ token: igToken, userId: igUserId }),
      });
      const data = await res.json();
      setLastSyncResult(data as Record<string, unknown>);
      if (res.ok) {
        toast({ title: `Instagram: synced ${data.synced ?? 0} post${data.synced !== 1 ? "s" : ""}!` });
        fetchAll();
      } else toast({ title: "Instagram sync failed", description: data.error, variant: "destructive" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    setSyncingInstagram(false);
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "#070706" }}>
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b backdrop-blur-xl"
        style={{ borderColor: "rgba(201,168,76,0.1)", background: "rgba(7,7,6,0.95)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/30 shrink-0">
            <img src={logoHB} alt="SR" className="w-full h-full object-cover" onError={e => { const t = e.target as HTMLImageElement; t.style.display="none"; t.parentElement!.style.background=GOLD_GRAD; t.parentElement!.innerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:900;color:#000;font-size:10px;font-family:serif">SR</div>'; }} />
          </div>
          <div>
            <span className="font-serif font-bold text-base text-white">Sophie Rain</span>
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{ color: GOLD, borderColor: "rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.08)" }}>
              Creator Portal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Connected server indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg mr-2 border"
            style={{ background: "rgba(74,222,128,0.05)", borderColor: "rgba(74,222,128,0.15)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="text-xs text-white/30 font-mono max-w-[140px] truncate">{apiUrl.replace(/^https?:\/\//, "")}</span>
            <button onClick={() => copyUrl(apiUrl)} title="Copy API URL"
              className="transition-colors ml-0.5"
              style={{ color: urlCopied ? "#4ade80" : "rgba(255,255,255,0.2)" }}>
              {urlCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
            <button onClick={disconnect} title="Disconnect" className="text-white/20 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
          {/* Notification badge — unread messages + pending items */}
          {(() => {
            const totalBadge = (chatSessions.reduce((a, s) => a + (s.unreadCount || 0), 0)) +
              calls.filter(c => c.status === "pending").length +
              requests.filter(r => r.status === "pending").length;
            return (totalBadge > 0 || liveFlash) ? (
              <button onClick={() => setTab("chat")} className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-black mr-1 transition-all"
                style={{
                  background: GOLD_GRAD,
                  boxShadow: liveFlash ? "0 0 22px rgba(201,168,76,0.9), 0 0 40px rgba(201,168,76,0.4)" : "0 0 14px rgba(201,168,76,0.5)",
                  transform: liveFlash ? "scale(1.08)" : "scale(1)",
                }}>
                <Bell className={`w-3.5 h-3.5 ${liveFlash ? "animate-bounce" : ""}`} />
                {totalBadge > 0 ? totalBadge : "NEW"}
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              </button>
            ) : null;
          })()}
          <button onClick={enableNotifications} className="p-2 rounded-xl text-white/30 hover:text-white transition-colors hover:bg-white/5">
            {notifEnabled ? <Bell className="w-4 h-4" style={{ color: GOLD }} /> : <BellOff className="w-4 h-4" />}
          </button>
          <button onClick={fetchAll} className="p-2 rounded-xl text-white/30 hover:text-white transition-colors hover:bg-white/5">
            <RefreshCw className="w-4 h-4" />
          </button>
          {/* AI Persona Studio button */}
          <a
            href={(platformSettings as any)?.aiPersonaUrl || "https://hannah-brooks-ai-persona.onrender.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 ml-1"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", boxShadow: "0 2px 12px rgba(124,58,237,0.35)" }}
            title="Open AI Persona Studio">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.7-1.414 2.7H4.213c-1.444 0-2.414-1.7-1.414-2.7L4.2 15.3" />
            </svg>
            <span className="hidden sm:inline">AI Persona</span>
          </a>
          <button onClick={logout} className="p-2 rounded-xl text-white/30 hover:text-white transition-colors hover:bg-white/5">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex" style={{ minHeight: "calc(100vh - 57px)" }}>
        {/* ── Desktop Sidebar ───────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r p-3 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto"
          style={{ borderColor: "rgba(201,168,76,0.08)", background: "rgba(0,0,0,0.5)" }}>
          <nav className="space-y-0.5 flex-1">
            {tabs.map((t) => (
              <React.Fragment key={t.id}>
                {t.section && (
                  <div className="pt-3 pb-1 px-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-px flex-1" style={{ background: "rgba(201,168,76,0.15)" }} />
                      <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(201,168,76,0.45)" }}>{t.section}</span>
                      <div className="h-px flex-1" style={{ background: "rgba(201,168,76,0.15)" }} />
                    </div>
                  </div>
                )}
                <button onClick={() => setTab(t.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={tab === t.id
                    ? { color: GOLD, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }
                    : { color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }}>
                  <span className="flex items-center gap-2.5">{t.icon}{t.label}</span>
                  {t.count !== undefined && t.count > 0 && (
                    <span className="text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center text-black font-bold"
                      style={{ background: GOLD }}>{t.count}</span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* Live Activity */}
          {activity.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] font-bold text-white/20 px-3 mb-2 uppercase tracking-widest">Live</p>
              <div className="space-y-1.5">
                {activity.slice(0, 5).map((a, i) => (
                  <div key={i} className="px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-1 text-white/60 mb-0.5">
                      <span>{a.type === "message" ? "💬" : a.type === "call" ? "📹" : a.type === "tip" ? "💝" : "✨"}</span>
                      <span className="font-medium truncate">{a.fanName}</span>
                    </div>
                    {a.amount > 0 && <div className="font-bold text-xs" style={{ color: GOLD }}>${a.amount}</div>}
                    <div className="text-white/25">{timeAgo(a.timestamp)} ago</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Persona Studio link */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <a
              href={`${window.location.origin.replace(/:\d+$/, ":3000")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full"
              style={{ color: "rgba(201,168,76,0.7)", border: "1px solid rgba(201,168,76,0.15)", background: "rgba(201,168,76,0.04)" }}>
              <Brain className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
              <span>AI Persona Studio</span>
              <ExternalLink className="w-3 h-3 ml-auto shrink-0 opacity-50" />
            </a>
            <p className="text-[10px] text-white/15 px-3 mt-1.5">Opens in a new tab</p>
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-x-hidden pb-20 md:pb-6">
          {/* Mobile tab scroll */}
          <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto md:hidden" style={{ scrollbarWidth: "none" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border"
                style={tab === t.id
                  ? { color: GOLD, background: "rgba(201,168,76,0.1)", borderColor: "rgba(201,168,76,0.25)" }
                  : { color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }}>
                {t.icon}{t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="rounded-full px-1.5 text-black text-[10px] font-bold" style={{ background: GOLD }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="px-4 md:px-6 py-4 md:py-6">

            {/* ─── DASHBOARD ──────────────────────────────────────── */}
            {tab === "dashboard" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-serif font-bold text-white">Dashboard</h2>
                  <span className="text-white/25 text-sm">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
                </div>

                {/* Stats */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: "Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, icon: <DollarSign className="w-5 h-5" />, color: GOLD },
                      { label: "Messages", value: chatSessions.length, icon: <MessageSquare className="w-5 h-5" />, color: "#f472b6" },
                      { label: "Calls", value: stats.totalCalls, icon: <Phone className="w-5 h-5" />, color: "#60a5fa" },
                      { label: "Requests", value: stats.totalRequests, icon: <Sparkles className="w-5 h-5" />, color: "#c084fc" },
                      { label: "Tips", value: stats.totalTips, icon: <Gift className="w-5 h-5" />, color: "#34d399" },
                    ].map((s) => (
                      <GoldCard key={s.label} className="p-5">
                        <div style={{ color: s.color }} className="mb-3">{s.icon}</div>
                        <div className="text-2xl font-bold text-white">{s.value}</div>
                        <div className="text-[11px] text-white/25 mt-1 uppercase tracking-widest">{s.label}</div>
                      </GoldCard>
                    ))}
                  </div>
                )}

                {/* Quick actions */}
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { id: "chat" as Tab, icon: <MessageSquare />, title: "Fan Messages", desc: `${unreadChats} unread · Reply personally`, color: GOLD },
                    { id: "social" as Tab, icon: <Zap />, title: "Social Sync", desc: "Import from TikTok & X", color: "#60a5fa" },
                    { id: "github" as Tab, icon: <Github />, title: "Push to GitHub", desc: "Backup your site now", color: "#c084fc" },
                  ].map((s) => (
                    <button key={s.id} onClick={() => setTab(s.id)}
                      className="text-left rounded-2xl p-5 transition-all hover:scale-[1.01] active:scale-[0.99] border"
                      style={{ background: "rgba(255,255,255,0.025)", borderColor: `${s.color}20` }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
                      <div className="font-semibold text-white text-sm">{s.title}</div>
                      <div className="text-xs text-white/35 mt-1">{s.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Pending calls */}
                {calls.filter(c => c.status === "pending").length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-white/25 uppercase tracking-widest mb-3">Pending Calls</h3>
                    <div className="space-y-3">
                      {calls.filter(c => c.status === "pending").slice(0, 3).map((c) => (
                        <GoldCard key={c.id} className="p-4 flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-white text-sm">{c.fanName} — {c.durationMinutes}min</div>
                            <div className="text-xs text-white/30">{new Date(c.preferredDate).toLocaleString()}</div>
                          </div>
                          <button onClick={() => updateCallStatus(c.id, "confirmed")}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-colors">
                            Confirm
                          </button>
                        </GoldCard>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── EARNINGS ───────────────────────────────────────── */}
            {tab === "earnings" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-serif font-bold text-white">Earnings</h2>
                  <span className="text-white/30 text-sm">{new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
                </div>

                {/* Revenue summary cards */}
                {stats && (
                  <>
                    {/* Total revenue hero */}
                    <GoldCard className="p-7 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{ background: "radial-gradient(ellipse at top right, #c9a84c, transparent 60%)" }} />
                      <p className="text-xs font-bold tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>Total Revenue</p>
                      <p className="text-5xl font-serif font-bold text-white">${stats.totalRevenue.toFixed(2)}</p>
                      <p className="text-white/30 text-sm mt-2">Lifetime earnings across all channels</p>
                    </GoldCard>

                    {/* Breakdown by category */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: "Messages", icon: <MessageSquare className="w-5 h-5" />, value: calls.reduce((a) => a + 4.99, 0).toFixed(2), count: stats.totalMessages, color: "#f472b6", desc: "Paid chat messages" },
                        { label: "Video Calls", icon: <Phone className="w-5 h-5" />, value: calls.reduce((a, c) => a + Number(c.amountPaid), 0).toFixed(2), count: stats.totalCalls, color: "#60a5fa", desc: "Zoom & WhatsApp calls" },
                        { label: "Custom Requests", icon: <Sparkles className="w-5 h-5" />, value: requests.reduce((a, r) => a + Number(r.amountPaid), 0).toFixed(2), count: stats.totalRequests, color: "#c084fc", desc: "Custom content" },
                        { label: "Tips", icon: <Gift className="w-5 h-5" />, value: tips.reduce((a, t) => a + Number(t.amount), 0).toFixed(2), count: stats.totalTips, color: "#34d399", desc: "Fan tips" },
                      ].map((s) => (
                        <GoldCard key={s.label} className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
                            <span className="text-xs text-white/25">{s.count} total</span>
                          </div>
                          <p className="text-2xl font-bold text-white font-serif">${s.value}</p>
                          <p className="text-xs text-white/25 mt-1">{s.label}</p>
                        </GoldCard>
                      ))}
                    </div>

                    {/* Earnings breakdown bars */}
                    <GoldCard className="p-6">
                      <h3 className="font-semibold text-white mb-5">Revenue Mix</h3>
                      <div className="space-y-4">
                        {[
                          { label: "Messages", pct: 35, color: "#f472b6" },
                          { label: "Video Calls", pct: 30, color: "#60a5fa" },
                          { label: "Custom Requests", pct: 25, color: "#c084fc" },
                          { label: "Tips", pct: 10, color: "#34d399" },
                        ].map((b) => (
                          <div key={b.label}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-white/60 font-medium">{b.label}</span>
                              <span style={{ color: b.color }} className="font-bold">{b.pct}%</span>
                            </div>
                            <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.pct}%`, background: `linear-gradient(90deg,${b.color}80,${b.color})` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </GoldCard>

                    {/* Recent transactions */}
                    <GoldCard className="overflow-hidden">
                      <div className="p-5 border-b" style={{ borderColor: "rgba(201,168,76,0.08)" }}>
                        <h3 className="font-semibold text-white">Recent Transactions</h3>
                      </div>
                      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        {[
                          ...tips.slice(0, 3).map(t => ({ type: "tip", name: t.fanName, amount: Number(t.amount), desc: t.message || "Fan tip", time: t.createdAt, color: "#34d399" })),
                          ...calls.filter(c => c.amountPaid).slice(0, 3).map(c => ({ type: "call", name: c.fanName, amount: Number(c.amountPaid), desc: `${c.durationMinutes}min call`, time: c.createdAt, color: "#60a5fa" })),
                          ...requests.filter(r => r.amountPaid).slice(0, 3).map(r => ({ type: "request", name: r.fanName, amount: Number(r.amountPaid), desc: r.requestType, time: r.createdAt, color: "#c084fc" })),
                        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10).map((tx, i) => (
                          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${tx.color}15`, color: tx.color }}>
                              {tx.type === "tip" ? <Gift className="w-4 h-4" /> : tx.type === "call" ? <Phone className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{tx.name}</p>
                              <p className="text-xs text-white/30 truncate">{tx.desc}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold" style={{ color: GOLD }}>${tx.amount.toFixed(2)}</p>
                              <p className="text-xs text-white/25">{timeAgo(tx.time)}</p>
                            </div>
                          </div>
                        ))}
                        {tips.length === 0 && calls.length === 0 && requests.length === 0 && (
                          <div className="px-5 py-10 text-center text-white/25 text-sm">No transactions yet</div>
                        )}
                      </div>
                    </GoldCard>
                  </>
                )}

                {!stats && <div className="text-center py-20 text-white/30">Loading earnings data…</div>}
              </div>
            )}

            {/* ─── CHAT (WhatsApp-like) ──────────────────────────── */}
            {tab === "chat" && (
              <div className="flex gap-0 h-[calc(100vh-160px)] rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(201,168,76,0.12)" }}>
                {/* Session list */}
                <div className={`flex flex-col ${showChatList || !selectedSession ? "flex" : "hidden"} md:flex w-full md:w-72 lg:w-80 border-r shrink-0`}
                  style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.6)" }}>
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <h2 className="text-base font-bold text-white">Fan Chats</h2>
                    <span className="text-xs text-white/30">{chatSessions.length} conversations</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {chatSessions.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <MessageSquare className="w-8 h-8 text-white/15 mb-3" />
                        <p className="text-white/25 text-sm">No fan conversations yet</p>
                      </div>
                    )}
                    {chatSessions.map((s) => {
                      const lastMsg = s.lastMessage?.message || "";
                      const att = parseAttachment(lastMsg);
                      const preview = att ? `📎 ${att.type === "voice" ? "Voice note" : att.name}` : lastMsg.slice(0, 50);
                      const isSelected = selectedSession?.id === s.id;

                      return (
                        <button key={s.id} onClick={() => selectSession(s)}
                          className="w-full flex items-center gap-3 px-4 py-3 border-b text-left transition-all"
                          style={{
                            borderColor: "rgba(255,255,255,0.04)",
                            background: isSelected ? "rgba(201,168,76,0.08)" : "transparent",
                          }}>
                          <div className="relative shrink-0">
                            <FanAvatar session={s} size="sm" />
                            {s.unreadCount > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-black"
                                style={{ background: GOLD }}>{s.unreadCount}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white text-sm truncate">{s.fanName}</span>
                              {s.lastMessageAt && <span className="text-[10px] text-white/25 shrink-0">{timeAgo(s.lastMessageAt)}</span>}
                            </div>
                            <p className="text-xs text-white/35 truncate mt-0.5">
                              {s.lastMessage?.senderType === "hannah" ? "You: " : ""}{preview || "No messages yet"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chat window */}
                {selectedSession ? (
                  <div className={`flex flex-col flex-1 ${!showChatList ? "flex" : "hidden md:flex"}`}
                    style={{ background: "radial-gradient(ellipse at top,#0e0a00 0%,#070706 60%)" }}>
                    {/* Chat header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b backdrop-blur-xl"
                      style={{ borderColor: "rgba(201,168,76,0.1)", background: "rgba(7,7,6,0.9)" }}>
                      <button onClick={() => setShowChatList(true)} className="md:hidden p-1 text-white/40 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <FanAvatar session={selectedSession} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm">{selectedSession.fanName}</div>
                        <div className="text-xs text-white/30">{selectedSession.fanEmail}</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full border" style={{ color: GOLD, borderColor: "rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.08)" }}>
                        {selectedSession.freeUsed} msgs sent
                      </div>
                    </div>

                    {/* Messages */}
                    <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                      {chatMessages.length === 0 && (
                        <div className="flex items-center justify-center h-full text-white/20 text-sm">No messages yet</div>
                      )}
                      {chatMessages.map((msg) => (
                        <ChatBubble key={msg.id} msg={msg} session={selectedSession} />
                      ))}
                    </div>

                    {/* Reply input */}
                    <div className="flex-shrink-0 border-t px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(7,7,6,0.95)" }}>
                      <input ref={fileInputRef as any} type="file" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFileReply(f); (e.target as HTMLInputElement).value = ""; }} />
                      <div className="flex items-end gap-2">
                        <button onClick={() => (fileInputRef.current as HTMLInputElement)?.click()} disabled={sendingReply}
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 hover:bg-white/10 disabled:opacity-30 transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <div className="flex-1 rounded-2xl border overflow-hidden focus-within:border-[rgba(201,168,76,0.3)] transition-colors"
                          style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                          <textarea value={chatReply} onChange={(e) => setChatReply(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                            placeholder={`Reply to ${selectedSession.fanName}…`} rows={1}
                            className="w-full bg-transparent text-white text-sm px-4 py-3 resize-none outline-none placeholder:text-white/20 max-h-[120px]"
                            style={{ fieldSizing: "content" } as React.CSSProperties} />
                        </div>
                        <VoiceRecorder onRecorded={sendVoiceReply} disabled={sendingReply} />
                        {chatReply.trim() && (
                          <button onClick={sendReply} disabled={sendingReply}
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95"
                            style={{ background: GOLD_GRAD, boxShadow: "0 4px 15px rgba(201,168,76,0.35)" }}>
                            {sendingReply ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Send className="w-4 h-4 text-black" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3 text-white/20">
                    <MessageSquare className="w-12 h-12" />
                    <p>Select a conversation to start replying</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── CALLS ──────────────────────────────────────────── */}
            {tab === "calls" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-serif font-bold text-white">Call Bookings <span className="text-white/25 font-normal text-lg ml-1">({calls.length})</span></h2>
                {calls.map((c) => (
                  <GoldCard key={c.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{c.fanName}</span>
                          <span className={statusBadge(c.status)}>{c.status}</span>
                          <span className="font-bold text-sm" style={{ color: GOLD }}>${c.amountPaid}</span>
                        </div>
                        <div className="text-xs text-white/30 mt-1">{c.fanEmail} · {timeAgo(c.createdAt)} ago</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                        <div className="text-xs text-white/30 mb-1">Duration</div>
                        <div className="text-white font-semibold">{c.durationMinutes} minutes</div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                        <div className="text-xs text-white/30 mb-1">Date</div>
                        <div className="text-white font-semibold text-sm">{new Date(c.preferredDate).toLocaleString()}</div>
                      </div>
                      {c.notes && (
                        <div className="col-span-2 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                          <div className="text-xs text-white/30 mb-1">Notes</div>
                          <div className="text-white/80 text-sm">{c.notes}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {c.status === "pending" && (
                        <button onClick={() => updateCallStatus(c.id, "confirmed")}
                          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-colors">
                          <CheckCircle className="w-4 h-4" /> Confirm
                        </button>
                      )}
                      {c.status === "confirmed" && (
                        <button onClick={() => updateCallStatus(c.id, "completed")}
                          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                          <CheckCircle className="w-4 h-4" /> Mark Completed
                        </button>
                      )}
                    </div>
                  </GoldCard>
                ))}
                {calls.length === 0 && <div className="text-center py-20 text-white/20 border border-white/5 rounded-2xl">No bookings yet</div>}
              </div>
            )}

            {/* ─── REQUESTS ───────────────────────────────────────── */}
            {tab === "requests" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-serif font-bold text-white">Custom Requests <span className="text-white/25 font-normal text-lg ml-1">({requests.length})</span></h2>
                {requests.map((r) => (
                  <GoldCard key={r.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{r.fanName}</span>
                          <span className={statusBadge(r.status)}>{r.status}</span>
                          <span className="font-bold text-sm" style={{ color: GOLD }}>${r.amountPaid}</span>
                        </div>
                        <div className="text-xs text-white/30 mt-1">{r.fanEmail} · {timeAgo(r.createdAt)} ago</div>
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <div className="text-[10px] text-white/30 mb-1 uppercase tracking-widest">Type: {r.requestType}</div>
                      <p className="text-white/80 text-sm leading-relaxed">{r.description}</p>
                    </div>
                  </GoldCard>
                ))}
                {requests.length === 0 && <div className="text-center py-20 text-white/20 border border-white/5 rounded-2xl">No requests yet</div>}
              </div>
            )}

            {/* ─── TIPS ───────────────────────────────────────────── */}
            {tab === "tips" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-serif font-bold text-white">Tips & Gifts <span className="text-white/25 font-normal text-lg ml-1">({tips.length})</span></h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tips.map((t) => (
                    <GoldCard key={t.id} className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white/60 border border-white/10"
                          style={{ background: "rgba(255,255,255,0.05)" }}>
                          {t.fanName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-2xl font-bold" style={{ color: GOLD }}>${t.amount}</span>
                      </div>
                      <div className="font-semibold text-white text-sm">{t.fanName}</div>
                      <div className="text-xs text-white/30 mb-2">{t.fanEmail} · {timeAgo(t.createdAt)} ago</div>
                      {t.message && <p className="text-sm text-white/50 italic border-t border-white/5 pt-2 mt-2">"{t.message}"</p>}
                    </GoldCard>
                  ))}
                </div>
                {tips.length === 0 && <div className="text-center py-20 text-white/20 border border-white/5 rounded-2xl">No tips yet</div>}
              </div>
            )}

            {/* ─── FEED ───────────────────────────────────────────── */}
            {tab === "feed" && (
              <div className="space-y-6">
                <h2 className="text-2xl font-serif font-bold text-white">Feed Manager</h2>
                <GoldCard className="p-6">
                  <h3 className="font-bold text-white flex items-center gap-2 mb-5">
                    <ImagePlus className="w-5 h-5" style={{ color: GOLD }} /> Publish New Post
                  </h3>
                  <div className="space-y-4">
                    <input ref={postImageRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const isVid = f.type.startsWith("video/");
                      setPostMediaType(isVid ? "video" : "image");
                      setPostMediaMime(f.type);
                      const reader = new FileReader();
                      reader.onload = ev => { setPostMediaFile(ev.target?.result as string); setNewPost(p => ({ ...p, imageUrl: "" })); };
                      reader.readAsDataURL(f);
                    }} />

                    <div className="flex gap-4">
                      <div onClick={() => postImageRef.current?.click()}
                        className="relative w-36 h-36 rounded-2xl border-2 border-dashed border-white/20 hover:border-amber-400/50 cursor-pointer transition-all flex items-center justify-center overflow-hidden bg-black/40 shrink-0 group">
                        {postMediaFile && postMediaType === "video" ? (
                          <>
                            <video src={postMediaFile} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <div className="w-10 h-10 rounded-full bg-black/70 border border-white/30 flex items-center justify-center">
                                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                              </div>
                            </div>
                            <div className="absolute bottom-1 left-0 right-0 text-center">
                              <span className="text-[9px] bg-amber-400 text-black font-bold px-1.5 py-0.5 rounded-full">VIDEO</span>
                            </div>
                          </>
                        ) : postMediaFile ? (
                          <img src={postMediaFile} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                        ) : newPost.imageUrl ? (
                          <img src={newPost.imageUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" onError={e => ((e.target as HTMLImageElement).style.display = "none")} />
                        ) : (
                          <div className="text-center group-hover:scale-105 transition-transform">
                            <Video className="w-7 h-7 text-white/30 mx-auto mb-1" />
                            <p className="text-white/30 text-[10px]">Photo or Video</p>
                            <p className="text-white/20 text-[9px]">Tap to choose</p>
                          </div>
                        )}
                        {(postMediaFile || newPost.imageUrl) && (
                          <button onClick={e => { e.stopPropagation(); setPostMediaFile(null); setPostMediaType("image"); setNewPost(p => ({ ...p, imageUrl: "" })); }}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col gap-3">
                        <div>
                          <p className="text-white/40 text-xs mb-1.5 font-bold uppercase tracking-wider">Or paste a URL</p>
                          <Input placeholder="https://... (image or video link)"
                            value={newPost.imageUrl}
                            onChange={e => { setNewPost(p => ({ ...p, imageUrl: e.target.value })); if (e.target.value) { setPostMediaFile(null); setPostMediaType("image"); } }}
                            className="bg-black/50 border-white/10 text-white rounded-xl placeholder:text-white/20" />
                        </div>
                        <p className="text-white/25 text-xs">MP4 · MOV · WebM · AVI · JPG · PNG · GIF · WebP</p>
                        {postMediaType === "video" && postMediaFile && (
                          <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                            <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                            <p className="text-amber-400 text-xs font-bold">Video ready — will show inline player on feed</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Textarea placeholder="Caption (optional)" value={newPost.caption}
                      onChange={e => setNewPost(p => ({ ...p, caption: e.target.value }))}
                      className="bg-black/50 border-white/10 text-white rounded-xl resize-none placeholder:text-white/20" rows={2} />

                    <div className="flex gap-4 items-center flex-wrap">
                      <select value={newPost.platform} onChange={e => setNewPost(p => ({ ...p, platform: e.target.value }))}
                        className="bg-black/60 border border-white/10 text-white rounded-xl px-3 py-2 text-sm">
                        <option value="custom">Exclusive (Custom)</option>
                        <option value="instagram">Instagram</option>
                        <option value="twitter">X / Twitter</option>
                        <option value="tiktok">TikTok</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-white/40 cursor-pointer select-none">
                        <input type="checkbox" checked={newPost.isPrivate}
                          onChange={e => setNewPost(p => ({ ...p, isPrivate: e.target.checked }))} className="rounded" />
                        <Lock className="w-3.5 h-3.5" /> VIP only
                      </label>
                    </div>
                    <button onClick={addPost} disabled={addingPost || (!newPost.imageUrl && !postMediaFile)}
                      className="h-12 px-8 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all flex items-center gap-2"
                      style={{ background: GOLD_GRAD }}>
                      {addingPost ? <><RefreshCw className="w-4 h-4 animate-spin" /> Publishing…</> :
                       postMediaType === "video" && postMediaFile ? <><Play className="w-4 h-4 fill-black" /> Publish Video</> :
                       <><ImagePlus className="w-4 h-4" /> Publish to Feed</>}
                    </button>
                  </div>
                </GoldCard>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {posts.map((p) => {
                    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
                    const thumb = p.thumbnailUrl || p.imageUrl;
                    const thumbSrc = thumb?.startsWith("/uploads/") ? `${API_BASE}${thumb}` : thumb;
                    const isVid = p.mediaType === "video" || !!p.videoUrl;
                    return (
                    <div key={p.id} className="relative rounded-2xl overflow-hidden aspect-square group border border-white/5">
                      {isVid ? (
                        <div className="w-full h-full bg-black flex items-center justify-center">
                          <img src={thumbSrc || ""} alt="" className="w-full h-full object-cover opacity-80" onError={e => ((e.target as HTMLImageElement).style.display="none")} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-black/70 border border-white/30 flex items-center justify-center">
                              <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img src={p.imageUrl?.startsWith("/uploads/") ? `${API_BASE}${p.imageUrl}` : p.imageUrl} alt={p.caption || ""} className="w-full h-full object-cover" onError={e => ((e.target as HTMLImageElement).style.opacity="0.3")} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all" />
                      <div className="absolute top-2 left-2 flex items-center gap-1 text-white/80 text-xs bg-black/60 px-2 py-0.5 rounded-full backdrop-blur">
                        {platformIcon(p.platform)} {p.platform}
                      </div>
                      {p.isPrivate && <div className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold text-black" style={{ background: GOLD }}>VIP</div>}
                      <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                        <button onClick={() => deletePost(p.id)}
                          className="w-full text-xs font-bold py-1.5 rounded-lg text-red-300 border border-red-500/30 bg-red-500/20 hover:bg-red-500/30 transition-colors">
                          <Trash2 className="w-3 h-3 inline mr-1" /> Remove
                        </button>
                      </div>
                    </div>
                  );
                  })}
                  {posts.length === 0 && <div className="col-span-full text-center py-20 text-white/20 border border-white/5 rounded-2xl">No posts yet</div>}
                </div>
              </div>
            )}

            {/* ─── SOCIAL ─────────────────────────────────────────── */}
            {tab === "social" && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-white">Social Sync</h2>
                  <p className="text-white/30 text-sm mt-1">Watermark-free import from TikTok & X, auto or manual.</p>
                </div>

                <GoldCard className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
                        style={socialConfig?.enabled ? { background: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)" } : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                        <Zap className={`w-5 h-5 ${socialConfig?.enabled ? "text-green-400" : "text-white/30"}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-white">Auto-Sync</div>
                        <div className="text-xs text-white/30">{socialConfig?.enabled ? `Running every ${socialConfig.intervalHours}h` : "Off"}</div>
                      </div>
                    </div>
                    <button onClick={toggleAutoSync} className="transition-colors">
                      {socialConfig?.enabled ? <ToggleRight className="w-8 h-8 text-green-400" /> : <ToggleLeft className="w-8 h-8 text-white/30" />}
                    </button>
                  </div>
                </GoldCard>

                <GoldCard className="p-5 space-y-4">
                  <h3 className="font-semibold text-white">Account Handles</h3>
                  <div>
                    <label className="text-xs text-white/30 mb-1.5 block">X / Twitter handle</label>
                    <Input placeholder="@sophieraiin" value={xHandleInput} onChange={(e) => setXHandleInput(e.target.value)}
                      className="bg-black/50 border-white/10 text-white rounded-xl placeholder:text-white/20" />
                  </div>
                  <div>
                    <label className="text-xs text-white/30 mb-1.5 block">TikTok handle</label>
                    <Input placeholder="@sophieraiin" value={tiktokHandleInput} onChange={(e) => setTiktokHandleInput(e.target.value)}
                      className="bg-black/50 border-white/10 text-white rounded-xl placeholder:text-white/20" />
                  </div>
                  <div>
                    <label className="text-xs text-white/30 mb-1.5 block">Auto-sync every (hours)</label>
                    <Input type="number" min="1" max="24" value={syncIntervalInput} onChange={(e) => setSyncIntervalInput(e.target.value)}
                      className="bg-black/50 border-white/10 text-white rounded-xl w-28" />
                  </div>
                  <button onClick={saveSocialConfig} className="h-10 px-5 rounded-xl font-bold text-sm text-black" style={{ background: GOLD_GRAD }}>
                    Save Settings
                  </button>
                </GoldCard>

                {/* Instagram Sync */}
                <GoldCard className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-pink-400" />
                    <h3 className="font-semibold text-white">Instagram Sync</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full text-pink-300 bg-pink-500/10 border border-pink-500/20 font-medium">Graph API</span>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed">
                    Syncs your public Instagram posts directly into the feed. Requires an Instagram Business/Creator account and access token from{" "}
                    <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline" style={{ color: GOLD }}>developers.facebook.com</a>.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Instagram Access Token</label>
                      <Input type="password" value={igToken} onChange={e => setIgToken(e.target.value)}
                        placeholder="EAABwzLixnjY..." className="bg-black border-white/10 text-white text-sm rounded-xl placeholder:text-white/20" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Instagram User ID</label>
                      <Input value={igUserId} onChange={e => setIgUserId(e.target.value)}
                        placeholder="17841400..." className="bg-black border-white/10 text-white text-sm rounded-xl placeholder:text-white/20" />
                    </div>
                  </div>
                  <button onClick={syncInstagram} disabled={syncingInstagram || (!igToken)}
                    className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-pink-500/30 text-pink-300 bg-pink-500/10 hover:bg-pink-500/20 disabled:opacity-40 transition-colors">
                    <Instagram className="w-4 h-4" />{syncingInstagram ? "Syncing Instagram…" : "Sync Instagram Now"}
                  </button>
                </GoldCard>

                <GoldCard className="p-5 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-white">X / TikTok Sync</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full text-green-300 bg-green-500/10 border border-green-500/20 font-medium">✓ Free — No API Key Needed</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Works for free via public RSS and open scraping. Enter your handles above and hit Sync — no paid API keys required.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => syncPlatform("x")} disabled={syncingX || syncingAll}
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-sky-500/30 text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-40 transition-colors">
                      <Twitter className="w-4 h-4" />{syncingX ? "Syncing…" : "Sync X / Twitter"}
                    </button>
                    <button onClick={() => syncPlatform("tiktok")} disabled={syncingTikTok || syncingAll}
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-pink-500/30 text-pink-300 bg-pink-500/10 hover:bg-pink-500/20 disabled:opacity-40 transition-colors">
                      <Music2 className="w-4 h-4" />{syncingTikTok ? "Syncing…" : "Sync TikTok"}
                    </button>
                    <button onClick={() => syncPlatform("all")} disabled={syncingAll || syncingX || syncingTikTok}
                      className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-black disabled:opacity-40" style={{ background: GOLD_GRAD }}>
                      <Zap className="w-4 h-4" />{syncingAll ? "Syncing…" : "Sync All"}
                    </button>
                  </div>
                  {lastSyncResult && (
                    <div className="rounded-xl p-4 text-xs font-mono text-white/40 overflow-x-auto" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <pre>{JSON.stringify(lastSyncResult, null, 2)}</pre>
                    </div>
                  )}
                </GoldCard>
              </div>
            )}

            {/* ─── GITHUB ─────────────────────────────────────────── */}
            {tab === "github" && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                    <Github className="w-6 h-6" style={{ color: GOLD }} /> GitHub Push
                  </h2>
                  <p className="text-white/30 text-sm mt-1">Push code to your separate public and admin GitHub repositories.</p>
                </div>

                <div className="rounded-xl px-4 py-3 flex items-center gap-3 border" style={{ background: "rgba(201,168,76,0.05)", borderColor: "rgba(201,168,76,0.2)" }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <p className="text-sm text-white/60"><span className="font-bold" style={{ color: GOLD }}>GITHUB_PERSONAL_ACCESS_TOKEN</span> detected — ready to push to both repos.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* ── Public Fan App Repo ── */}
                  <GoldCard className="p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)" }}>
                        <Globe className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Public Fan App</h3>
                        <a href="https://github.com/daviddan-241/Hannah-brooks-love" target="_blank" rel="noreferrer"
                          className="text-xs flex items-center gap-1 mt-0.5 hover:underline" style={{ color: "rgba(56,189,248,0.8)" }}>
                          github.com/daviddan-241/Hannah-brooks-love <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                    <p className="text-xs text-white/35 leading-relaxed">
                      Fan platform (port 5000): Home, Feed, Messages, Calls, Boutique, Members — all public-facing pages.
                    </p>
                    <button onClick={() => pushToGitHub("public")} disabled={githubPushing !== null}
                      className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                      style={githubPushing === "public"
                        ? { background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.3)", color: "rgb(56,189,248)" }
                        : { background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", color: "rgb(147,218,250)" }}>
                      <Github className="w-4 h-4" />
                      {githubPushing === "public" ? "Pushing…" : "Push Public App"}
                    </button>
                    {githubResult?.target === "public" && (
                      <div className={`rounded-xl p-3 text-sm border flex items-start gap-2 ${githubResult.success ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
                        {githubResult.success
                          ? <><CheckCircle size={14} className="mt-0.5 shrink-0" /><span>Pushed to <strong>Hannah-brooks-love</strong>!</span></>
                          : <><AlertCircle size={14} className="mt-0.5 shrink-0" /><span className="text-xs">{githubResult.error}</span></>}
                      </div>
                    )}
                  </GoldCard>

                  {/* ── Admin & AI Studio Repo ── */}
                  <GoldCard className="p-6 space-y-4" style={{ borderColor: "rgba(201,168,76,0.25)" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)" }}>
                        <Brain className="w-5 h-5" style={{ color: GOLD }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Admin &amp; AI Studio</h3>
                        <a href="https://github.com/daviddan-241/Admin" target="_blank" rel="noreferrer"
                          className="text-xs flex items-center gap-1 mt-0.5 hover:underline" style={{ color: "rgba(201,168,76,0.8)" }}>
                          github.com/daviddan-241/Admin <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                    <p className="text-xs text-white/35 leading-relaxed">
                      Creator portal + AI Persona Studio: admin dashboard, chat control, analytics, personas, training, social sync.
                    </p>
                    <button onClick={() => pushToGitHub("admin")} disabled={githubPushing !== null}
                      className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                      style={githubPushing === "admin"
                        ? { background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.4)", color: GOLD }
                        : { background: GOLD_GRAD, color: "#000" }}>
                      <Github className="w-4 h-4" />
                      {githubPushing === "admin" ? "Pushing…" : "Push Admin & AI Studio"}
                    </button>
                    {githubResult?.target === "admin" && (
                      <div className={`rounded-xl p-3 text-sm border flex items-start gap-2 ${githubResult.success ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
                        {githubResult.success
                          ? <><CheckCircle size={14} className="mt-0.5 shrink-0" /><span>Pushed to <strong>Admin</strong>!</span></>
                          : <><AlertCircle size={14} className="mt-0.5 shrink-0" /><span className="text-xs">{githubResult.error}</span></>}
                      </div>
                    )}
                  </GoldCard>
                </div>

                <GoldCard className="p-5">
                  <h4 className="font-semibold text-white mb-3 text-sm">Push Both at Once</h4>
                  <p className="text-xs text-white/35 mb-4">Commits and pushes all current code to both repositories in sequence.</p>
                  <button
                    onClick={async () => { await pushToGitHub("public"); await pushToGitHub("admin"); }}
                    disabled={githubPushing !== null}
                    className="flex items-center gap-2 h-11 px-6 rounded-xl font-bold text-sm border border-white/10 text-white/60 hover:text-white hover:border-white/20 disabled:opacity-40 transition-all">
                    <Github className="w-4 h-4" /> Push to Both Repos
                  </button>
                </GoldCard>
              </div>
            )}

            {/* ─── GIFT CARDS ──────────────────────────────────────── */}
            {tab === "gift-cards" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2"><CreditCard className="w-6 h-6" style={{ color: GOLD }} /> Gift Card Payments</h2>
                    <p className="text-white/30 text-sm mt-1">Fans who paid by gift card — verify each card and unlock their access.</p>
                  </div>
                  <div className="flex gap-2">
                    {(["all", "pending", "approved", "rejected"] as const).map(f => (
                      <button key={f} onClick={() => setGiftCardFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${giftCardFilter === f ? "text-black" : "text-white/40 border border-white/10"}`}
                        style={giftCardFilter === f ? { background: GOLD_GRAD } : {}}>
                        {f} {f === "pending" && giftCards.filter(g => g.status === "pending").length > 0 && `(${giftCards.filter(g => g.status === "pending").length})`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {giftCards.filter(g => giftCardFilter === "all" || g.status === giftCardFilter).map(gc => (
                    <GoldCard key={gc.id} className="p-5">
                      <div className="flex flex-col md:flex-row gap-5">
                        {/* Card photos */}
                        <div className="flex gap-3 shrink-0">
                          {[{ label: "Front", url: gc.frontImageUrl }, { label: "Back", url: gc.backImageUrl }].map(({ label, url }) => {
                            const src = url.startsWith("data:") ? url : `${API}${url}`;
                            const mime = url.startsWith("data:image/png") ? "image/png" : url.startsWith("data:image/gif") ? "image/gif" : "image/jpeg";
                            const ext = mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : "jpg";
                            const filename = `giftcard_${gc.id}_${label.toLowerCase()}.${ext}`;

                            const saveToPhotos = async () => {
                              try {
                                // Convert data URI to blob
                                const res = await fetch(src);
                                const blob = await res.blob();
                                const file = new File([blob], filename, { type: mime });
                                // Use Web Share API (iOS shows "Save Image" → saves to Photos)
                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                  await navigator.share({ files: [file], title: filename });
                                } else {
                                  // Fallback: regular download
                                  const a = document.createElement("a");
                                  a.href = src;
                                  a.download = filename;
                                  a.click();
                                }
                              } catch { /* user cancelled share — ignore */ }
                            };

                            return (
                              <div key={label} className="flex flex-col items-center gap-1.5">
                                {/* Tap image → full screen */}
                                <div className="w-32 h-20 rounded-xl overflow-hidden border border-white/10 bg-black/30 relative group cursor-pointer"
                                  onClick={() => setLightboxImg({ src, label, gcId: gc.id })}>
                                  <img src={src} alt={label} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.opacity="0.3"; }} />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                  </div>
                                </div>
                                <span className="text-white/30 text-[10px]">{label}</span>
                                {/* Save to Photos button */}
                                <button onClick={saveToPhotos}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all active:scale-95">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                                  </svg>
                                  Save
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {/* Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <div className="font-bold text-white">{gc.fanName}</div>
                              <div className="text-xs text-white/40">{gc.fanEmail}</div>
                            </div>
                            <span className={statusBadge(gc.status)}>{gc.status}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm mb-2">
                            <span className="text-white/60"><span className="text-white/30">Card:</span> {gc.cardType}</span>
                            <span className="text-white/60"><span className="text-white/30">Amount:</span> <span className="text-amber-400 font-bold">${gc.cardAmount}</span></span>
                            <span className="text-white/60"><span className="text-white/30">For:</span> {gc.purpose}</span>
                          </div>
                          {gc.note && <p className="text-xs text-white/40 italic mb-2">"{gc.note}"</p>}
                          <p className="text-xs text-white/20">{new Date(gc.createdAt).toLocaleString()}</p>
                          {gc.status === "pending" && (
                            <div className="mt-3 flex flex-wrap gap-2 items-center">
                              <input value={giftCardAdminNote[gc.id] || ""} onChange={e => setGiftCardAdminNote(n => ({ ...n, [gc.id]: e.target.value }))}
                                placeholder="Add a note (optional)" className="flex-1 h-8 px-3 rounded-lg text-xs bg-black/40 border border-white/10 text-white placeholder:text-white/20 min-w-[160px]" />
                              <button onClick={() => updateGiftCard(gc.id, "approved")}
                                className="h-8 px-4 rounded-lg font-bold text-xs text-black" style={{ background: GOLD_GRAD }}>
                                <CheckCircle size={12} className="inline mr-1" /> Approve & Unlock
                              </button>
                              <button onClick={() => updateGiftCard(gc.id, "rejected")}
                                className="h-8 px-4 rounded-lg font-bold text-xs text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                                <X size={12} className="inline mr-1" /> Reject
                              </button>
                            </div>
                          )}
                          {gc.adminNote && <p className="mt-2 text-xs text-amber-400/70 italic">Admin: {gc.adminNote}</p>}
                        </div>
                      </div>
                    </GoldCard>
                  ))}
                  {giftCards.filter(g => giftCardFilter === "all" || g.status === giftCardFilter).length === 0 && (
                    <div className="text-center py-20 text-white/20 border border-white/5 rounded-2xl">
                      <CreditCard className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p>No {giftCardFilter === "all" ? "" : giftCardFilter} gift cards yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── VIP MEMBERS ─────────────────────────────────────── */}
            {tab === "vip-members" && (
              <VipMembersTab API={API} adminKey={adminKey} GOLD={GOLD} GOLD_GRAD={GOLD_GRAD} />
            )}

            {/* ─── SETTINGS ───────────────────────────────────────── */}
            {tab === "settings" && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-white">Platform Settings</h2>
                  <p className="text-white/30 text-sm mt-1">Control all prices, API keys, and branding — no code changes needed.</p>
                </div>

                {settingsLoading ? (
                  <div className="text-center py-20 text-white/30">Loading settings…</div>
                ) : (
                  <>
                    <SettingsSection title="Payment — Flutterwave" icon={<CreditCard className="w-5 h-5" style={{ color: GOLD }} />}
                      desc="Get keys from dashboard.flutterwave.com">
                      <SF label="Public Key" hint="Starts with FLWPUBK_">
                        <Input defaultValue={String(platformSettings.flutterwavePublicKey || "")} onBlur={e => saveSettings({ flutterwavePublicKey: e.target.value })} placeholder="FLWPUBK_LIVE-..." className={IC} />
                      </SF>
                      <SF label="Secret Key" hint="Server-side only — never shared">
                        <SecretInput defaultValue={rawSecrets.flutterwaveSecretKey || ""} onSave={v => saveSettings({ flutterwaveSecretKey: v })} placeholder="FLWSECK_LIVE-..." />
                      </SF>
                      <SF label="Currency">
                        <Input defaultValue={String(platformSettings.currency || "USD")} onBlur={e => saveSettings({ currency: e.target.value })} placeholder="USD" className={IC} />
                      </SF>
                    </SettingsSection>

                    <SettingsSection title="Pricing" icon={<DollarSign className="w-5 h-5" style={{ color: GOLD }} />}
                      desc="All prices apply instantly to the public site.">
                      <div className="grid grid-cols-2 gap-4 py-4">
                        {[
                          { key: "msgPrice", label: "Message ($)" },
                          { key: "msgFreeLimit", label: "Free messages" },
                          { key: "subMonthly", label: "VIP Monthly ($)" },
                          { key: "subQuarterly", label: "VIP 3-Month ($)" },
                          { key: "subLifetime", label: "VIP Lifetime ($)" },
                          { key: "requestPrice", label: "Custom Request ($)" },
                          { key: "tipMin", label: "Min Tip ($)" },
                          { key: "callWa5", label: "WhatsApp 5min ($)" },
                          { key: "callZoom15", label: "Zoom 15min ($)" },
                          { key: "callZoom30", label: "Zoom 30min ($)" },
                          { key: "callPrivate60", label: "Private 1hr ($)" },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <label className="text-xs font-bold text-white/35 tracking-wider block mb-1.5">{label}</label>
                            <Input type="number" step="0.01" defaultValue={String(platformSettings[key] ?? "")}
                              onBlur={e => saveSettings({ [key]: parseFloat(e.target.value) || 0 })} className={IC} />
                          </div>
                        ))}
                      </div>
                    </SettingsSection>

                    <SettingsSection title="Social API Keys" icon={<Key className="w-5 h-5" style={{ color: GOLD }} />}
                      desc="Paste your API keys here. Applied immediately, no restart needed.">
                      <SF label="X / Twitter Bearer Token" hint="From developer.twitter.com">
                        <SecretInput defaultValue={rawSecrets.xBearerToken || ""} onSave={v => saveSettings({ xBearerToken: v })} placeholder="AAAA..." />
                      </SF>
                      <SF label="RapidAPI Key" hint="For TikTok sync — from rapidapi.com">
                        <SecretInput defaultValue={rawSecrets.rapidApiKey || ""} onSave={v => saveSettings({ rapidApiKey: v })} placeholder="Your RapidAPI key" />
                      </SF>
                      <SF label="GitHub Remote URL" hint="Optional override: https://TOKEN@github.com/user/repo.git">
                        <SecretInput defaultValue={rawSecrets.githubRemote || ""} onSave={v => saveSettings({ githubRemote: v })} placeholder="https://ghp_...@github.com/..." />
                      </SF>
                    </SettingsSection>

                    <SettingsSection title="AI Keys" icon={<Brain className="w-5 h-5" style={{ color: GOLD }} />}
                      desc="Power the AI Create tab — image generation, video, voice synthesis. Configure the services you use.">
                      <SF label="OpenAI API Key" hint="For DALL-E 3 image generation — platform.openai.com">
                        <SecretInput defaultValue={rawSecrets.openaiApiKey || ""} onSave={v => saveSettings({ openaiApiKey: v })} placeholder="sk-..." />
                      </SF>
                      <SF label="RunwayML API Key" hint="For AI video generation — app.runwayml.com">
                        <SecretInput defaultValue={rawSecrets.runwaymlApiKey || ""} onSave={v => saveSettings({ runwaymlApiKey: v })} placeholder="key_..." />
                      </SF>
                      <SF label="ElevenLabs API Key" hint="For voice synthesis — elevenlabs.io">
                        <SecretInput defaultValue={rawSecrets.elevenlabsApiKey || ""} onSave={v => saveSettings({ elevenlabsApiKey: v })} placeholder="Your ElevenLabs key" />
                      </SF>
                      <SF label="ElevenLabs Voice ID" hint="Your cloned voice ID from ElevenLabs dashboard">
                        <Input defaultValue={String(platformSettings.elevenlabsVoiceId || "")} onBlur={e => saveSettings({ elevenlabsVoiceId: e.target.value })} placeholder="21m00Tcm4TlvDq8ikWAM" className={IC} />
                      </SF>
                      <SF label="GPU Worker URL" hint="RunPod / Vast.ai endpoint for face swap, clothes change, voice convert, enhance">
                        <Input defaultValue={String(platformSettings.gpuWorkerUrl || "")} onBlur={e => saveSettings({ gpuWorkerUrl: e.target.value })} placeholder="https://your-worker.runpod.net" className={IC} />
                      </SF>
                      <SF label="AI Persona Studio URL" hint="Your Render URL for the AI Persona Studio — used for the header button">
                        <Input defaultValue={String((platformSettings as any).aiPersonaUrl || "")} onBlur={e => saveSettings({ aiPersonaUrl: e.target.value } as any)} placeholder="https://hannah-brooks-ai-persona.onrender.com" className={IC} />
                      </SF>
                    </SettingsSection>

                    <SettingsSection title="Profile & Links" icon={<User className="w-5 h-5" style={{ color: GOLD }} />}
                      desc="Your public profile information shown on the homepage.">
                      <SF label="Bio">
                        <textarea defaultValue={String(platformSettings.creatorBio || "")}
                          onBlur={e => saveSettings({ creatorBio: e.target.value })} rows={3}
                          className="w-full bg-black border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-1 resize-none placeholder:text-white/20"
                          style={{ "--tw-ring-color": "rgba(201,168,76,0.3)" } as React.CSSProperties} />
                      </SF>
                      <SF label="Tagline">
                        <Input defaultValue={String(platformSettings.creatorTagline || "")} onBlur={e => saveSettings({ creatorTagline: e.target.value })} className={IC} />
                      </SF>
                      <SF label="WhatsApp Number">
                        <Input defaultValue={String(platformSettings.whatsappNumber || "")} onBlur={e => saveSettings({ whatsappNumber: e.target.value })} placeholder="447700000000" className={IC} />
                      </SF>
                      {["instagramUrl", "twitterUrl", "tiktokUrl", "onlyfansUrl"].map(key => (
                        <SF key={key} label={key.replace("Url", "").replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()) + " URL"}>
                          <Input defaultValue={String(platformSettings[key] || "")} onBlur={e => saveSettings({ [key]: e.target.value })} className={IC} />
                        </SF>
                      ))}
                    </SettingsSection>

                    <SettingsSection title="Email Notifications" icon={<Bell className="w-5 h-5" style={{ color: GOLD }} />}
                      desc="Receive email alerts when fans pay, book calls, send tips, or submit gift cards. Uses any SMTP provider (Gmail, SendGrid, etc.).">
                      <SF label="Your Email (Admin Notifications)" hint="Where Sophie gets notified of new payments, bookings, etc.">
                        <Input defaultValue={String(platformSettings.adminEmail || "")} onBlur={e => saveSettings({ adminEmail: e.target.value })} placeholder="you@gmail.com" className={IC} />
                      </SF>
                      <SF label="SMTP Host" hint="e.g. smtp.gmail.com / smtp.sendgrid.net">
                        <Input defaultValue={String(platformSettings.smtpHost || "")} onBlur={e => saveSettings({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" className={IC} />
                      </SF>
                      <SF label="SMTP Port" hint="587 = TLS (recommended) · 465 = SSL · 25 = plain">
                        <Input type="number" defaultValue={String(platformSettings.smtpPort || "587")} onBlur={e => saveSettings({ smtpPort: parseInt(e.target.value) || 587 })} placeholder="587" className={IC} />
                      </SF>
                      <SF label="SMTP Username" hint="Usually your email address">
                        <Input defaultValue={String(platformSettings.smtpUser || "")} onBlur={e => saveSettings({ smtpUser: e.target.value })} placeholder="you@gmail.com" className={IC} />
                      </SF>
                      <SF label="SMTP Password / App Password" hint="For Gmail: use a 16-char App Password (not your login password)">
                        <SecretInput defaultValue={rawSecrets.smtpPass || ""} onSave={v => saveSettings({ smtpPass: v })} placeholder="xxxx xxxx xxxx xxxx" />
                      </SF>
                      <SF label="From Name / Address" hint='How it appears to fans — e.g. "Sophie Rain" or noreply@sophierain.com'>
                        <Input defaultValue={String(platformSettings.smtpFrom || "")} onBlur={e => saveSettings({ smtpFrom: e.target.value })} placeholder={`"Sophie Rain" <noreply@sophierain.com>`} className={IC} />
                      </SF>
                      <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs text-white/40 leading-relaxed">
                        <strong className="text-amber-400/80">Gmail tip:</strong> Enable 2FA → Google Account → Security → App Passwords → Mail. Paste the 16-char code above.
                      </div>
                    </SettingsSection>

                    <SettingsSection title="Security" icon={<Lock className="w-5 h-5" style={{ color: GOLD }} />}
                      desc="Change your admin portal password. You'll be logged out after saving.">
                      <SF label="Admin Password">
                        <SecretInput defaultValue={rawSecrets.adminPassword || ""} onSave={v => { saveSettings({ adminPassword: v }); setTimeout(logout, 1500); }} placeholder="New password" />
                      </SF>
                    </SettingsSection>
                  </>
                )}
              </div>
            )}
            {/* ─── AI CHAT CONTROL ────────────────────────────────── */}
            {tab === "ai-chat" && (
              <div className="space-y-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                      <Brain className="w-6 h-6" style={{ color: GOLD }} /> AI Chat Control
                    </h2>
                    <p className="text-white/30 text-sm mt-1">Real fan messages — review &amp; reply with AI assist</p>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border" style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(201,168,76,0.15)" }}>
                    <span className="text-sm font-semibold text-white/70">Auto Mode</span>
                    <button onClick={() => setAiMode(m => m === "autonomous" ? "approval" : "autonomous")}>
                      {aiMode === "autonomous"
                        ? <ToggleRight size={28} style={{ color: "#ff006e" }} />
                        : <ToggleLeft size={28} className="text-white/30" />}
                    </button>
                    <span className="text-sm font-bold" style={{ color: aiMode === "autonomous" ? "#ff006e" : "rgba(255,255,255,0.3)" }}>
                      {aiMode === "autonomous" ? "AUTO" : "REVIEW"}
                    </span>
                  </div>
                </div>

                {/* ── AI Reply Scheduler Panel ── */}
                <GoldCard className="p-5" style={{ borderColor: schedulerEnabled ? "rgba(52,211,153,0.3)" : "rgba(201,168,76,0.1)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <Zap className="w-4 h-4" style={{ color: schedulerEnabled ? "#34d399" : GOLD }} />
                        Auto-Reply Scheduler
                        {schedulerEnabled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-500/15 text-green-400 border border-green-500/25">LIVE</span>
                        )}
                        {schedulerSuggestions.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-black" style={{ background: GOLD }}>
                            {schedulerSuggestions.length} pending
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-white/30 mt-0.5">
                        {schedulerEnabled
                          ? `Running every ${schedulerIntervalMin}min · Last scan: ${schedulerLastRun ? timeAgo(schedulerLastRun) : "not yet"}`
                          : "Scans for unanswered fans and queues AI reply suggestions for your one-click approval"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-white/30">Every</label>
                        <Input type="number" min="5" max="240" value={schedulerIntervalMin}
                          onChange={e => setSchedulerIntervalMin(parseInt(e.target.value) || 30)}
                          className="w-16 bg-black/60 border-white/10 text-white text-xs rounded-xl text-center" />
                        <label className="text-xs text-white/30">min</label>
                      </div>
                      <button onClick={runSchedulerNow} disabled={schedulerLoading}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40">
                        {schedulerLoading ? "…" : "Scan Now"}
                      </button>
                      <button onClick={toggleScheduler} disabled={schedulerLoading}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={schedulerEnabled
                          ? { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }
                          : { background: GOLD_GRAD, color: "#000" }}>
                        {schedulerEnabled ? "Stop" : "Start Scheduler"}
                      </button>
                    </div>
                  </div>

                  {/* ── Scheduled (queued) replies countdown ── */}
                  {scheduledReplies.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-3 h-3" style={{ color: "#7c3aed" }} />
                        Queued to Send ({scheduledReplies.length})
                      </div>
                      {scheduledReplies.map(r => (
                        <div key={r.sessionId} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>
                          {r.imageUrl && <img src={r.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 opacity-80" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-purple-300">{r.fanName}</div>
                            <div className="text-[11px] text-white/40 truncate">{r.message.slice(0, 60)}{r.message.length > 60 ? "…" : ""}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs font-mono font-bold text-purple-400">{countdown[r.sessionId] ?? "…"}</div>
                            <div className="text-[10px] text-white/20">until send</div>
                          </div>
                          <button onClick={() => cancelScheduledReply(r.sessionId)} className="text-white/20 hover:text-red-400 transition-colors shrink-0 ml-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Pending suggestions ── */}
                  {schedulerSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black shrink-0" style={{ background: GOLD }}>
                          {schedulerSuggestions.length}
                        </span>
                        Pending AI Replies — Review &amp; Send
                      </div>
                      {schedulerSuggestions.map(s => (
                        <div key={s.sessionId} className="rounded-xl p-4 space-y-3" style={{ background: s.isGiftCardRequest ? "rgba(124,58,237,0.08)" : "rgba(0,0,0,0.35)", border: s.isGiftCardRequest ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                          {/* Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ background: GOLD_GRAD }}>
                                {s.fanName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold text-white">{s.fanName}</span>
                              {s.isGiftCardRequest && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.3)", color: "#c4b5fd" }}>🎁 Gift Card Ask</span>
                              )}
                              {s.imageUrl && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.4)", color: GOLD }}>📷 w/ Photo</span>
                              )}
                              <span className="text-[10px] text-white/25 italic">{s.humanNote}</span>
                            </div>
                            <button onClick={() => dismissSchedulerSuggestion(s.sessionId)} className="text-white/20 hover:text-white/50 transition-colors shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Fan's message */}
                          <div className="text-xs text-white/35 italic px-3 py-2 rounded-lg border border-white/5 bg-white/[0.03] leading-relaxed">
                            "{s.lastFanMessage.slice(0, 150)}{s.lastFanMessage.length > 150 ? "…" : ""}"
                          </div>

                          {/* Image preview */}
                          {s.imageUrl && (
                            <div className="flex items-center gap-3">
                              <img src={s.imageUrl} alt="proof photo" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                              <div className="text-[11px] text-white/35 leading-relaxed">This photo will be sent<br/>after the text reply.</div>
                            </div>
                          )}

                          {/* Editable reply */}
                          <div>
                            <label className="text-[10px] font-bold text-white/25 uppercase tracking-widest block mb-1.5">AI Reply — edit freely</label>
                            <Textarea
                              value={editingSuggestion[s.sessionId] ?? s.suggestion}
                              onChange={e => setEditingSuggestion(prev => ({ ...prev, [s.sessionId]: e.target.value }))}
                              rows={2}
                              className="bg-black/50 border-white/10 text-white text-sm rounded-xl resize-none placeholder:text-white/20" />
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => approveSchedulerSuggestion(s.sessionId)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-black"
                              style={{ background: GOLD_GRAD }}>
                              <Send className="w-3.5 h-3.5" /> Send Now
                            </button>
                            {s.delayMs > 0 && (
                              <button onClick={() => approveSchedulerSuggestion(s.sessionId, s.delayMs)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors"
                                style={{ borderColor: "rgba(124,58,237,0.4)", color: "#c4b5fd", background: "rgba(124,58,237,0.08)" }}>
                                <Clock className="w-3 h-3" />
                                Schedule ({s.delayMs < 60000 ? `${Math.round(s.delayMs/1000)}s` : `${Math.round(s.delayMs/60000)}m`})
                              </button>
                            )}
                            <button onClick={() => dismissSchedulerSuggestion(s.sessionId)}
                              className="px-3 py-2 rounded-xl text-xs text-white/25 border border-white/8 hover:text-white/50 transition-colors">
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {schedulerSuggestions.length === 0 && scheduledReplies.length === 0 && (
                    <p className="text-center text-xs text-white/20 py-2">
                      {schedulerEnabled
                        ? "No pending suggestions — all fans have recent replies"
                        : 'Click "Scan Now" to check for unanswered fans, or start the scheduler'}
                    </p>
                  )}
                </GoldCard>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total Sessions", value: chatSessions.length, color: GOLD },
                    { label: "Unread", value: chatSessions.reduce((a, s) => a + (s.unreadCount || 0), 0), color: "#ffaa00" },
                    { label: "Fan Messages", value: stats?.totalMessages ?? 0, color: "#34d399" },
                  ].map((s) => (
                    <GoldCard key={s.label} className="p-5 text-center">
                      <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs text-white/30 mt-1 uppercase tracking-widest">{s.label}</div>
                    </GoldCard>
                  ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Session list */}
                  <div>
                    <h3 className="text-xs font-bold text-white/25 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" style={{ color: "#ffaa00" }} /> Fan Sessions ({chatSessions.length})
                    </h3>
                    {chatSessions.length === 0 ? (
                      <GoldCard className="p-10 text-center">
                        <MessageSquare className="w-8 h-8 text-white/15 mx-auto mb-3" />
                        <p className="text-white/25 text-sm">No fan sessions yet</p>
                      </GoldCard>
                    ) : (
                      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {chatSessions.map((s) => (
                          <GoldCard key={s.id} className="p-4 cursor-pointer hover:scale-[1.01] transition-all"
                            style={{ borderColor: aiChatSession?.id === s.id ? "rgba(201,168,76,0.5)" : s.unreadCount > 0 ? "rgba(255,170,0,0.25)" : "rgba(201,168,76,0.1)" }}
                            onClick={() => openAiSession(s)}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-black shrink-0"
                                style={{ background: GOLD_GRAD }}>
                                {s.fanName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white text-sm truncate">{s.fanName}</span>
                                  {s.unreadCount > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0"
                                      style={{ background: "rgba(255,170,0,0.2)", color: "#ffaa00", border: "1px solid rgba(255,170,0,0.4)" }}>
                                      {s.unreadCount} new
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-xs text-white/30 truncate">{s.lastMessage?.message?.slice(0, 40) || s.fanEmail}</span>
                                  {s.lastMessageAt && <span className="text-[10px] text-white/25 shrink-0 ml-2">{timeAgo(s.lastMessageAt)}</span>}
                                </div>
                              </div>
                            </div>
                          </GoldCard>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message thread + AI reply */}
                  <div>
                    {aiChatSession ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black shrink-0"
                            style={{ background: GOLD_GRAD }}>
                            {aiChatSession.fanName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-white text-sm">{aiChatSession.fanName}</div>
                            <div className="text-xs text-white/30">{aiChatSession.fanEmail}</div>
                          </div>
                          <button onClick={suggestAiReply} disabled={loadingAiSuggest || aiChatMessages.filter(m => m.senderType === "fan").length === 0}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-black disabled:opacity-40"
                            style={{ background: GOLD_GRAD }}>
                            <Sparkles size={12} />{loadingAiSuggest ? "Thinking…" : "AI Suggest"}
                          </button>
                        </div>

                        <GoldCard className="overflow-hidden" style={{ maxHeight: "280px", overflowY: "auto" }}>
                          {aiChatMessages.length === 0 ? (
                            <div className="p-8 text-center text-white/25 text-sm animate-pulse">Loading messages…</div>
                          ) : (
                            <div className="p-4 space-y-3">
                              {aiChatMessages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.senderType === "hannah" ? "justify-end" : "justify-start"}`}>
                                  <div className="max-w-[82%] rounded-2xl px-4 py-2.5"
                                    style={msg.senderType === "hannah"
                                      ? { background: GOLD_GRAD, color: "#000" }
                                      : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <p className="text-sm leading-relaxed">{msg.message}</p>
                                    <p className="text-[10px] opacity-40 mt-1">{timeAgo(msg.createdAt)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </GoldCard>

                        {aiSuggestion && (
                          <GoldCard className="p-4" style={{ borderColor: "rgba(201,168,76,0.3)" }}>
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={12} style={{ color: GOLD }} />
                              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>AI Suggested Reply</span>
                            </div>
                            <p className="text-sm text-white/75 leading-relaxed mb-3">{aiSuggestion}</p>
                            <div className="flex gap-2">
                              <button onClick={() => sendAiReply(aiSuggestion)} disabled={sendingAiReply}
                                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-black disabled:opacity-50"
                                style={{ background: GOLD_GRAD }}>
                                <CheckCircle size={12} /> Send This
                              </button>
                              <button onClick={() => { setAiReplyText(aiSuggestion); setAiSuggestion(""); }}
                                className="text-xs font-semibold px-3 py-2 rounded-xl text-white/50 border border-white/10 hover:text-white/70 transition-colors">
                                Edit First
                              </button>
                              <button onClick={() => setAiSuggestion("")}
                                className="text-xs font-semibold px-3 py-2 rounded-xl text-white/30 border border-white/05 ml-auto hover:text-white/50 transition-colors">
                                Dismiss
                              </button>
                            </div>
                          </GoldCard>
                        )}

                        <GoldCard className="p-4">
                          <div className="text-[10px] font-bold mb-2 text-white/30 uppercase tracking-widest">Your Reply</div>
                          <div className="flex gap-2">
                            <textarea value={aiReplyText} onChange={(e) => setAiReplyText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendAiReply(aiReplyText); }}
                              placeholder="Type your reply… (Cmd+Enter to send)" rows={3}
                              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 resize-y" />
                            <button onClick={() => sendAiReply(aiReplyText)} disabled={sendingAiReply || !aiReplyText.trim()}
                              className="px-3 rounded-xl text-black self-end disabled:opacity-40"
                              style={{ background: GOLD }}>
                              <Send size={14} />
                            </button>
                          </div>
                        </GoldCard>
                      </div>
                    ) : (
                      <GoldCard className="h-full flex items-center justify-center p-14">
                        <div className="text-center">
                          <User size={36} className="mx-auto mb-3 text-white/15" />
                          <p className="text-white/30 text-sm">Select a fan session</p>
                          <p className="text-white/15 text-xs mt-1">View messages and reply with AI assist</p>
                        </div>
                      </GoldCard>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── ANALYTICS ───────────────────────────────────────── */}
            {tab === "analytics" && (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                    <BarChart2 className="w-6 h-6" style={{ color: GOLD }} /> Analytics
                  </h2>
                  <button onClick={fetchAll} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold text-white/40 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.08)" }}>
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                {stats && (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: "Fan Messages", value: stats.totalMessages, icon: <MessageSquare size={16} />, color: GOLD },
                        { label: "Calls Booked", value: stats.totalCalls, icon: <Phone size={16} />, color: "#34d399" },
                        { label: "Content Requests", value: stats.totalRequests, icon: <Sparkles size={16} />, color: "#c084fc" },
                        { label: "Total Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, icon: <DollarSign size={16} />, color: "#ffaa00" },
                      ].map((s) => (
                        <GoldCard key={s.label} className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}18`, color: s.color }}>{s.icon}</div>
                            <span className="text-xs font-bold text-green-400">↑ live</span>
                          </div>
                          <div className="text-3xl font-bold text-white">{s.value}</div>
                          <div className="text-xs mt-1 uppercase tracking-widest text-white/25">{s.label}</div>
                        </GoldCard>
                      ))}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                      <GoldCard className="p-6">
                        <h3 className="font-bold text-white mb-1">Activity by Type</h3>
                        <p className="text-xs text-white/30 mb-5">All-time counts per category</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={[
                            { name: "Messages", value: stats.totalMessages },
                            { name: "Calls", value: stats.totalCalls },
                            { name: "Requests", value: stats.totalRequests },
                            { name: "Tips", value: stats.totalTips },
                          ]} barSize={32}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: "#0e0a00", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "12px", color: "#fff" }} />
                            <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]} fill="rgba(201,168,76,0.8)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </GoldCard>

                      <GoldCard className="p-6">
                        <h3 className="font-bold text-white mb-1">Revenue by Source</h3>
                        <p className="text-xs text-white/30 mb-5">Estimated earnings breakdown</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={[
                            { name: "Msgs", value: parseFloat((stats.totalMessages * 4.5).toFixed(2)) },
                            { name: "Calls", value: parseFloat((stats.totalCalls * 54).toFixed(2)) },
                            { name: "Reqs", value: parseFloat((stats.totalRequests * 49.99).toFixed(2)) },
                            { name: "Tips", value: parseFloat((stats.totalTips * 12).toFixed(2)) },
                          ]}>
                            <defs>
                              <linearGradient id="gRevAdmin" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(201,168,76,0.3)" />
                                <stop offset="100%" stopColor="rgba(201,168,76,0)" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: "#0e0a00", border: "1px solid rgba(201,168,76,0.2)", borderRadius: "12px", color: "#fff" }} />
                            <Area type="monotone" dataKey="value" name="Revenue ($)" stroke="rgba(201,168,76,0.8)" fill="url(#gRevAdmin)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </GoldCard>
                    </div>

                    <GoldCard className="p-6">
                      <h3 className="font-bold text-white mb-5">Platform Summary</h3>
                      <div className="space-y-4">
                        {[
                          { name: "Fan Messages", value: stats.totalMessages, color: GOLD },
                          { name: "Calls Booked", value: stats.totalCalls, color: "#34d399" },
                          { name: "Content Requests", value: stats.totalRequests, color: "#c084fc" },
                          { name: "Tips Received", value: stats.totalTips, color: "#ffaa00" },
                        ].map((p) => {
                          const max = Math.max(stats.totalMessages, stats.totalCalls, stats.totalRequests, stats.totalTips, 1);
                          return (
                            <div key={p.name} className="flex items-center gap-4">
                              <div className="w-36 text-sm text-white/60 shrink-0">{p.name}</div>
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs text-white/30">{p.value} total</span>
                                </div>
                                <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${Math.max((p.value / max) * 100, p.value > 0 ? 3 : 0)}%`, background: `linear-gradient(90deg,${p.color}80,${p.color})` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </GoldCard>
                  </>
                )}
                {!stats && <div className="text-center py-20 text-white/30">Loading analytics…</div>}
              </div>
            )}

            {/* ─── PERSONAS ─────────────────────────────────────────── */}
            {tab === "personas" && (() => {
              const DEMO_PERSONAS = [
                { id: "1", name: "Sophie (Main)", desc: "Primary persona — Miami top creator", status: "active" as const, voice: "sophie-v3.pth", face: "sophie-face-v2.onnx", personality: "Warm, flirty, Miami energy. Loves fans. Teases but never over-promises. Premium creator energy.", mode: "autonomous" as const, msgs: 1247, acc: 96 },
                { id: "2", name: "Sophie (Business)", desc: "Professional tone for brand deals", status: "idle" as const, voice: "sophie-v3.pth", face: "sophie-face-v2.onnx", personality: "Professional, confident, concise. Uses formal language for brand deals and business inquiries. No flirting.", mode: "approval" as const, msgs: 89, acc: 94 },
                { id: "3", name: "Aria (Alt)", desc: "Alternative persona for separate brand", status: "idle" as const, voice: "aria-v1.pth", face: "aria-face-v1.onnx", personality: "Mysterious, artistic, European accent. Fashion-forward. Intellectual discussions.", mode: "off" as const, msgs: 234, acc: 91 },
              ];
              const [selectedPersona, setSelectedPersona] = React.useState(DEMO_PERSONAS[0]);
              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                      <Users className="w-6 h-6" style={{ color: GOLD }} /> Persona Manager
                    </h2>
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-black"
                      style={{ background: GOLD_GRAD }}>
                      + New Persona
                    </button>
                  </div>

                  <div className="grid lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                      {DEMO_PERSONAS.map((p) => (
                        <GoldCard key={p.id} className="p-4 cursor-pointer hover:scale-[1.01] transition-all"
                          style={{ borderColor: selectedPersona.id === p.id ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.1)" }}
                          onClick={() => setSelectedPersona(p)}>
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-black shrink-0"
                              style={{ background: GOLD_GRAD }}>
                              {p.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-sm">{p.name}</span>
                                {p.status === "active" && <Star size={10} className="text-yellow-400" />}
                              </div>
                              <p className="text-xs text-white/35 truncate">{p.desc}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className="font-bold" style={{ color: p.status === "active" ? "#34d399" : "rgba(255,255,255,0.3)" }}>
                                  ● {p.status.toUpperCase()}
                                </span>
                                <span className="text-white/30">{p.msgs} msgs</span>
                                <span style={{ color: "#34d399" }}>{p.acc}% acc</span>
                              </div>
                            </div>
                            {p.status === "active" && (
                              <div className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                                style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                                LIVE
                              </div>
                            )}
                          </div>
                        </GoldCard>
                      ))}
                      <button className="w-full py-3 rounded-xl text-sm text-white/30 hover:text-white transition-colors border-2 border-dashed flex items-center justify-center gap-2"
                        style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                        + Add Persona
                      </button>
                    </div>

                    <div className="lg:col-span-3 space-y-4">
                      <GoldCard className="p-6">
                        <div className="flex items-start justify-between mb-5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-black"
                              style={{ background: GOLD_GRAD }}>
                              {selectedPersona.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg">{selectedPersona.name}</h3>
                              <p className="text-white/40 text-sm">{selectedPersona.desc}</p>
                            </div>
                          </div>
                          <button onClick={() => { setPersonaEditId(selectedPersona.id === personaEditId ? null : selectedPersona.id); setPersonaEditBuf(selectedPersona.personality); }}
                            className="p-2 rounded-xl text-white/40 hover:text-white transition-colors border border-white/10">
                            <Edit3 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          {[
                            { label: "Face Model", value: selectedPersona.face },
                            { label: "Voice Profile", value: selectedPersona.voice },
                            { label: "Reply Mode", value: selectedPersona.mode.toUpperCase() },
                            { label: "Accuracy", value: `${selectedPersona.acc}%` },
                          ].map((f) => (
                            <div key={f.label} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                              <div className="text-xs text-white/30 uppercase tracking-widest mb-1">{f.label}</div>
                              <div className="text-sm font-semibold text-white">{f.value}</div>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40 uppercase tracking-widest">Personality Prompt</span>
                            {personaEditId === selectedPersona.id && (
                              <button onClick={() => setPersonaEditId(null)}
                                className="text-xs px-3 py-1 rounded-lg font-bold text-black"
                                style={{ background: GOLD_GRAD }}>Save</button>
                            )}
                          </div>
                          {personaEditId === selectedPersona.id ? (
                            <textarea value={personaEditBuf} onChange={(e) => setPersonaEditBuf(e.target.value)} rows={5}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 resize-y" />
                          ) : (
                            <div className="rounded-xl p-4 text-sm text-white/60 leading-relaxed"
                              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                              {selectedPersona.personality}
                            </div>
                          )}
                        </div>
                      </GoldCard>

                      <GoldCard className="p-5">
                        <h4 className="font-semibold text-white mb-4">Auto-Reply Mode</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "autonomous", label: "Autonomous", desc: "Replies automatically", color: "#ff006e" },
                            { id: "approval", label: "Human Review", desc: "You approve each reply", color: "#ffaa00" },
                            { id: "off", label: "Off", desc: "No auto-replies", color: "rgba(255,255,255,0.3)" },
                          ].map((m) => (
                            <div key={m.id} className="p-3 rounded-xl text-left"
                              style={selectedPersona.mode === m.id
                                ? { background: `${m.color}15`, border: `1px solid ${m.color}`, boxShadow: `0 0 12px ${m.color}30` }
                                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div className="text-sm font-semibold text-white mb-1">{m.label}</div>
                              <div className="text-xs text-white/35">{m.desc}</div>
                            </div>
                          ))}
                        </div>
                      </GoldCard>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── TRAINING ─────────────────────────────────────────── */}
            {tab === "training" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                    <Brain className="w-6 h-6" style={{ color: GOLD }} /> Persona Training
                  </h2>
                  <p className="text-white/30 text-sm mt-1">Upload reference media to train a new or existing AI persona</p>
                </div>

                {trainingStep === "done" ? (
                  <GoldCard className="p-10 text-center" style={{ borderColor: "rgba(52,211,153,0.3)" }}>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                      style={{ background: "rgba(52,211,153,0.1)", border: "2px solid rgba(52,211,153,0.4)" }}>
                      <CheckCircle size={32} className="text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Training Complete!</h3>
                    <p className="text-white/40 mb-6">Your persona is ready. Face model, voice profile, and personality engine are all trained.</p>
                    <div className="flex justify-center gap-4">
                      <button onClick={() => { setTrainingStep("upload"); setTrainProgress(0); setTrainVideos([]); setTrainAudios([]); }}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 border border-white/10 hover:border-white/20">
                        Train Another
                      </button>
                      <button onClick={() => setTab("personas")}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
                        style={{ background: GOLD_GRAD }}>
                        View Personas
                      </button>
                    </div>
                  </GoldCard>
                ) : trainingStep === "processing" ? (
                  <GoldCard className="p-6" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">Training in Progress</h3>
                      <span className="font-bold text-sm" style={{ color: GOLD }}>{Math.floor(trainProgress)}%</span>
                    </div>
                    <div className="h-2 rounded-full mb-6" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${trainProgress}%`, background: GOLD_GRAD, boxShadow: "0 0 10px rgba(201,168,76,0.5)" }} />
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Extracting facial embeddings", done: trainProgress > 20, active: trainProgress > 0 && trainProgress <= 20 },
                        { label: "Training face swap model", done: trainProgress > 45, active: trainProgress > 20 && trainProgress <= 45 },
                        { label: "Processing voice samples", done: trainProgress > 65, active: trainProgress > 45 && trainProgress <= 65 },
                        { label: "Training voice conversion", done: trainProgress > 80, active: trainProgress > 65 && trainProgress <= 80 },
                        { label: "Optimizing for real-time", done: trainProgress > 95, active: trainProgress > 80 && trainProgress <= 95 },
                        { label: "Building persona profile", done: trainProgress >= 100, active: trainProgress > 95 && trainProgress < 100 },
                      ].map((s, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${s.done ? "bg-green-400/20 text-green-400" : s.active ? "" : "opacity-30 text-white/30"}`}
                            style={s.active ? { background: "rgba(201,168,76,0.15)", color: GOLD } : {}}>
                            {s.done ? <CheckCircle size={12} /> : <Brain size={12} />}
                          </div>
                          <span className={s.done ? "text-white/60 line-through" : s.active ? "text-white" : "text-white/30"}>{s.label}</span>
                          {s.active && <span className="text-xs animate-pulse" style={{ color: GOLD }}>processing…</span>}
                          {s.done && <span className="text-green-400 text-xs">✓</span>}
                        </div>
                      ))}
                    </div>
                    {trainJobId && <p className="text-xs text-white/20 text-center mt-6">Job ID: {trainJobId} · Estimated 8–15 min on GPU</p>}
                  </GoldCard>
                ) : (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <GoldCard className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Video size={18} style={{ color: GOLD }} />
                        <h3 className="font-bold text-white">Video Samples</h3>
                        <span className="text-xs text-white/30">2–10 videos required</span>
                      </div>
                      <label className="block rounded-xl border-2 border-dashed p-8 text-center mb-4 transition-all cursor-pointer hover:border-yellow-600/40"
                        style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                        <Upload size={32} className="mx-auto mb-3 text-white/20" />
                        <p className="text-sm text-white/40">Drop video files here or click to browse</p>
                        <p className="text-xs text-white/20 mt-1">MP4, MOV, AVI · Max 500MB each</p>
                        <input type="file" accept="video/*" multiple className="hidden"
                          onChange={(e) => setTrainVideos(p => [...p, ...Array.from(e.target.files || [])])} />
                      </label>
                      {trainVideos.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-sm"
                          style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.1)" }}>
                          <Video size={14} style={{ color: GOLD }} />
                          <span className="text-white/70 flex-1 truncate">{f.name}</span>
                          <span className="text-white/30 text-xs">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                          <button onClick={() => setTrainVideos(p => p.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400"><X size={12} /></button>
                        </div>
                      ))}
                    </GoldCard>

                    <GoldCard className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Mic size={18} style={{ color: "#f0d080" }} />
                        <h3 className="font-bold text-white">Voice Samples</h3>
                        <span className="text-xs text-white/30">1–5 minutes ideal</span>
                      </div>
                      <label className="block rounded-xl border-2 border-dashed p-8 text-center mb-4 transition-all cursor-pointer hover:border-yellow-600/40"
                        style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                        <Mic size={32} className="mx-auto mb-3 text-white/20" />
                        <p className="text-sm text-white/40">Drop audio files here or click to browse</p>
                        <p className="text-xs text-white/20 mt-1">WAV, MP3, FLAC · Clean audio, minimal noise</p>
                        <input type="file" accept="audio/*" multiple className="hidden"
                          onChange={(e) => setTrainAudios(p => [...p, ...Array.from(e.target.files || [])])} />
                      </label>
                      {trainAudios.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-sm"
                          style={{ background: "rgba(240,208,128,0.05)", border: "1px solid rgba(240,208,128,0.1)" }}>
                          <Mic size={14} style={{ color: "#f0d080" }} />
                          <span className="text-white/70 flex-1 truncate">{f.name}</span>
                          <span className="text-white/30 text-xs">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                          <button onClick={() => setTrainAudios(p => p.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400"><X size={12} /></button>
                        </div>
                      ))}
                    </GoldCard>

                    <GoldCard className="p-6 lg:col-span-2">
                      <div className="flex items-center gap-2 mb-4">
                        <Brain size={18} style={{ color: "#ffaa00" }} />
                        <h3 className="font-bold text-white">Personality Configuration</h3>
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs text-white/40 mb-2 block uppercase tracking-widest">Personality Prompt</label>
                          <textarea value={trainPersonality} onChange={(e) => setTrainPersonality(e.target.value)}
                            rows={5} placeholder="Describe personality, tone, speaking style, topics to discuss, things to avoid…"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 resize-y" />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs text-white/40 mb-2 block uppercase tracking-widest">Persona Name</label>
                            <Input placeholder="e.g. Sophie (Main)" className="bg-black border-white/10 text-white rounded-xl placeholder:text-white/20" />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 mb-2 block uppercase tracking-widest">LLM Model</label>
                            <select className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                              <option>GPT-4o (Recommended)</option>
                              <option>GPT-4-turbo</option>
                              <option>Llama 3 70B</option>
                              <option>Claude 3.5 Sonnet</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-white/40 mb-2 block uppercase tracking-widest">Voice Model</label>
                            <select className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                              <option>XTTS v2 (Best quality)</option>
                              <option>RVC v2 (Fastest)</option>
                              <option>OpenVoice v2</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex items-center justify-between gap-4 pt-5 border-t border-white/[0.06]">
                        <div className="text-sm text-white/40">
                          {trainVideos.length > 0 && <span className="mr-4">{trainVideos.length} video{trainVideos.length !== 1 ? "s" : ""}</span>}
                          {trainAudios.length > 0 && <span className="mr-4">{trainAudios.length} audio file{trainAudios.length !== 1 ? "s" : ""}</span>}
                          {!trainVideos.length && !trainAudios.length && "Upload media to begin"}
                        </div>
                        <button onClick={startTraining} disabled={trainVideos.length === 0 && trainAudios.length === 0}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: GOLD_GRAD, boxShadow: "0 4px 20px rgba(201,168,76,0.3)" }}>
                          <Brain size={16} /> Start Training
                        </button>
                      </div>
                    </GoldCard>
                  </div>
                )}
              </div>
            )}

            {/* ─── AI CREATE ────────────────────────────────────── */}
            {tab === "ai-generate" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-6 h-6" style={{ color: GOLD }} /> AI Content Creator
                  </h2>
                  <p className="text-white/30 text-sm mt-1">Generate images &amp; videos, process uploaded media, clone your voice</p>
                </div>

                {/* Sub-tab navigation */}
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: "image" as const, label: "🎨 Image Gen", desc: "DALL-E 3" },
                    { id: "video" as const, label: "🎬 Video Gen", desc: "RunwayML" },
                    { id: "process" as const, label: "✨ AI Edit", desc: "Upload + prompt" },
                    { id: "voice" as const, label: "🎙️ Voice", desc: "ElevenLabs" },
                  ] as const).map(st => (
                    <button key={st.id} onClick={() => setAiSubTab(st.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={aiSubTab === st.id
                        ? { background: GOLD_GRAD, color: "#000" }
                        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {st.label} <span className="text-[10px] opacity-60">{st.desc}</span>
                    </button>
                  ))}
                </div>

                {/* ── Image Generation ── */}
                {aiSubTab === "image" && (
                  <div className="space-y-4">
                    <GoldCard className="p-5 space-y-4">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <ImagePlus className="w-4 h-4" style={{ color: GOLD }} /> Generate Image with DALL-E 3
                      </h3>
                      <div>
                        <label className="text-xs text-white/40 mb-2 block">Describe the image you want</label>
                        <textarea value={aiGenPrompt} onChange={e => setAiGenPrompt(e.target.value)}
                          rows={3} placeholder="A stunning portrait of a beautiful woman in elegant lingerie, soft studio lighting, professional photography…"
                          className="w-full bg-black/50 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none resize-y placeholder:text-white/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-white/40 mb-1.5 block">Size</label>
                          <select value={aiGenSize} onChange={e => setAiGenSize(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                            <option value="1024x1024">Square (1:1)</option>
                            <option value="1792x1024">Wide (16:9)</option>
                            <option value="1024x1792">Portrait (9:16)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-white/40 mb-1.5 block">Style</label>
                          <select value={aiGenStyle} onChange={e => setAiGenStyle(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                            <option value="vivid">Vivid (dramatic)</option>
                            <option value="natural">Natural (realistic)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={aiGenPublish} onChange={e => setAiGenPublish(e.target.checked)} className="w-4 h-4 rounded" />
                          <span className="text-sm text-white/70">Post to feed</span>
                        </label>
                        {aiGenPublish && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={aiGenVip} onChange={e => setAiGenVip(e.target.checked)} className="w-4 h-4 rounded" />
                            <span className="text-sm text-white/70">VIP only (adult)</span>
                          </label>
                        )}
                      </div>
                      {aiGenPublish && (
                        <div>
                          <label className="text-xs text-white/40 mb-1.5 block">Feed caption (optional)</label>
                          <Input value={aiGenCaption} onChange={e => setAiGenCaption(e.target.value)}
                            placeholder="Caption…" className="bg-black/50 border-white/10 text-white rounded-xl placeholder:text-white/20" />
                        </div>
                      )}
                      <button onClick={generateImage} disabled={aiGenLoading || !aiGenPrompt.trim()}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black disabled:opacity-40"
                        style={{ background: GOLD_GRAD, boxShadow: "0 4px 20px rgba(201,168,76,0.3)" }}>
                        <Sparkles className="w-4 h-4" />{aiGenLoading ? "Generating…" : "Generate Image"}
                      </button>
                    </GoldCard>
                    {aiGenLoading && (
                      <div className="flex items-center gap-3 text-white/50 text-sm">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        Generating with DALL-E 3… (usually 10–20 seconds)
                      </div>
                    )}
                    {aiGenResult?.imageUrl && (
                      <GoldCard className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-white">Generated Image</h3>
                          <a href={aiGenResult.imageUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Full size
                          </a>
                        </div>
                        <img src={aiGenResult.imageUrl} alt="AI Generated" className="w-full rounded-xl object-cover max-h-[500px]" />
                        {aiGenResult.revisedPrompt && (
                          <p className="text-xs text-white/30 leading-relaxed">
                            <span className="text-white/50 font-medium">DALL-E revised: </span>{aiGenResult.revisedPrompt}
                          </p>
                        )}
                        {aiGenResult.status === "image_published" && (
                          <div className="flex items-center gap-2 text-sm text-green-400">
                            <CheckCircle className="w-4 h-4" /> Published to feed
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => { setAiSubTab("video"); setTimeout(() => generateVideo(), 100); }}
                            disabled={aiVideoLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-40">
                            <Video className="w-4 h-4" /> Animate →
                          </button>
                        </div>
                      </GoldCard>
                    )}
                    {aiGenResult?.message && !aiGenResult.imageUrl && (
                      <div className="rounded-xl p-4 border border-amber-500/20 bg-amber-500/5 text-sm text-amber-300">{aiGenResult.message}</div>
                    )}
                  </div>
                )}

                {/* ── Video Generation ── */}
                {aiSubTab === "video" && (
                  <div className="space-y-4">
                    <GoldCard className="p-5 space-y-4">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Video className="w-4 h-4" style={{ color: GOLD }} /> Generate Video
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(192,132,252,0.1)", color: "#c084fc", border: "1px solid rgba(192,132,252,0.2)" }}>RunwayML Gen-3</span>
                      </h3>
                      <div>
                        <label className="text-xs text-white/40 mb-2 block">Describe the video scene or motion</label>
                        <textarea value={aiVideoPrompt} onChange={e => setAiVideoPrompt(e.target.value)}
                          rows={3} placeholder="A beautiful woman dancing in slow motion, golden hour lighting, cinematic, bokeh background…"
                          className="w-full bg-black/50 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none resize-y placeholder:text-white/20" />
                      </div>
                      {aiGenResult?.imageUrl && (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
                          <img src={aiGenResult.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-white">Using generated image as starting frame</p>
                            <p className="text-xs text-white/30">RunwayML will animate it with your prompt</p>
                          </div>
                        </div>
                      )}
                      <div className="p-3 rounded-xl text-xs text-white/40 leading-relaxed" style={{ background: "rgba(192,132,252,0.04)", border: "1px solid rgba(192,132,252,0.12)" }}>
                        <strong className="text-purple-300">Requires: </strong>Add <code className="bg-black/40 px-1 rounded">RUNWAYML_API_KEY</code> or <code className="bg-black/40 px-1 rounded">GPU_WORKER_URL</code> in Settings → AI Keys. Without these a preview image is generated.
                      </div>
                      <button onClick={generateVideo} disabled={aiVideoLoading || !aiVideoPrompt.trim()}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "white", boxShadow: "0 4px 20px rgba(139,92,246,0.3)" }}>
                        <Video className="w-4 h-4" />{aiVideoLoading ? "Generating…" : "Generate Video"}
                      </button>
                    </GoldCard>
                    {aiVideoLoading && (
                      <div className="flex items-center gap-3 text-white/50 text-sm">
                        <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                        Generating video… usually 30–90 seconds with RunwayML
                      </div>
                    )}
                    {aiVideoResult && (
                      <GoldCard className="p-4 space-y-3">
                        {aiVideoResult.imageUrl && (
                          <>
                            <h3 className="font-semibold text-white">
                              {aiVideoResult.status === "image_preview" ? "Preview Frame (RunwayML key needed for video)" : "Generated"}
                            </h3>
                            <img src={aiVideoResult.imageUrl} alt="Preview" className="w-full rounded-xl object-cover max-h-[400px]" />
                          </>
                        )}
                        {aiVideoResult.message && (
                          <div className="text-xs text-amber-300 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">{aiVideoResult.message}</div>
                        )}
                        {aiVideoResult.taskId && (
                          <div className="text-xs text-green-300">
                            Task: <code className="bg-black/40 px-1 rounded">{aiVideoResult.taskId}</code>
                            {aiVideoResult.provider === "runwayml" && " · Check RunwayML dashboard"}
                          </div>
                        )}
                      </GoldCard>
                    )}
                  </div>
                )}

                {/* ── AI Edit / Process ── */}
                {aiSubTab === "process" && (
                  <div className="space-y-4">
                    <GoldCard className="p-5 space-y-4">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4" style={{ color: GOLD }} /> AI Media Editor
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: "face-swap", label: "Face Swap", icon: "😊", gpu: true },
                          { id: "clothes-change", label: "Change Clothes", icon: "👗", gpu: true },
                          { id: "bg-remove", label: "Remove BG", icon: "✂️", gpu: true },
                          { id: "enhance", label: "AI Enhance", icon: "✨", gpu: true },
                          { id: "voice-convert", label: "Voice Convert", icon: "🎙️", gpu: true },
                          { id: "variation", label: "Variation", icon: "🎨", gpu: false },
                        ].map(op => (
                          <button key={op.id} onClick={() => setAiProcessOp(op.id)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left"
                            style={aiProcessOp === op.id
                              ? { background: "rgba(201,168,76,0.15)", borderColor: "rgba(201,168,76,0.4)", color: GOLD }
                              : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                            <span className="text-base">{op.icon}</span>
                            <span className="flex-1">{op.label}</span>
                            {op.gpu && <span className="text-[9px] opacity-50">GPU</span>}
                          </button>
                        ))}
                      </div>
                      <div>
                        <label className="text-xs text-white/40 mb-2 block">Upload photo or video</label>
                        <input ref={aiProcessFileRef} type="file" accept="image/*,video/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) setAiProcessFile(f); }} />
                        <button onClick={() => aiProcessFileRef.current?.click()}
                          className="w-full h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors"
                          style={{ borderColor: aiProcessFile ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.1)", background: aiProcessFile ? "rgba(201,168,76,0.04)" : "transparent" }}>
                          {aiProcessFile ? (
                            <>
                              <CheckCircle className="w-6 h-6" style={{ color: GOLD }} />
                              <span style={{ color: GOLD }}>{aiProcessFile.name} ({Math.round(aiProcessFile.size / 1024)}KB)</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-6 h-6" />
                              <span>Click to upload photo or video</span>
                            </>
                          )}
                        </button>
                      </div>
                      {["face-swap", "clothes-change"].includes(aiProcessOp) && (
                        <div>
                          <label className="text-xs text-white/40 mb-1.5 block">Describe the change (optional)</label>
                          <Input value={aiProcessPrompt} onChange={e => setAiProcessPrompt(e.target.value)}
                            placeholder={aiProcessOp === "clothes-change" ? "e.g. elegant black lace dress, form-fitting" : "e.g. keep same expression, smooth lighting"}
                            className="bg-black/50 border-white/10 text-white rounded-xl placeholder:text-white/20" />
                        </div>
                      )}
                      <div className="p-3 rounded-xl text-xs text-white/40 leading-relaxed" style={{ background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.1)" }}>
                        <strong className="text-amber-300">GPU required for most ops: </strong>
                        Set <code className="bg-black/40 px-1 rounded">GPU_WORKER_URL</code> in Settings → AI Keys. Image Variation works with OpenAI key.
                      </div>
                      <button onClick={processMedia} disabled={aiProcessLoading || !aiProcessFile}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black disabled:opacity-40"
                        style={{ background: GOLD_GRAD, boxShadow: "0 4px 20px rgba(201,168,76,0.3)" }}>
                        <Sparkles className="w-4 h-4" />
                        {aiProcessLoading ? "Processing…" : `Apply ${aiProcessOp.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`}
                      </button>
                    </GoldCard>
                    {aiProcessResult && (
                      <GoldCard className="p-4 space-y-3">
                        {aiProcessResult.imageUrl && <img src={aiProcessResult.imageUrl} alt="Processed" className="w-full rounded-xl max-h-[400px] object-contain" />}
                        {aiProcessResult.fileUrl && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <a href={aiProcessResult.fileUrl} target="_blank" rel="noreferrer" className="text-green-300 hover:underline">View uploaded file</a>
                          </div>
                        )}
                        {aiProcessResult.message && (
                          <div className="text-xs p-3 rounded-xl border" style={{
                            color: aiProcessResult.status === "needs_gpu" ? "#fbbf24" : "#86efac",
                            borderColor: aiProcessResult.status === "needs_gpu" ? "rgba(251,191,36,0.2)" : "rgba(134,239,172,0.2)",
                            background: aiProcessResult.status === "needs_gpu" ? "rgba(251,191,36,0.04)" : "rgba(134,239,172,0.04)",
                          }}>{aiProcessResult.message}</div>
                        )}
                      </GoldCard>
                    )}
                  </div>
                )}

                {/* ── Voice Synthesis ── */}
                {aiSubTab === "voice" && (
                  <div className="space-y-4">
                    <GoldCard className="p-5 space-y-4">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Mic className="w-4 h-4" style={{ color: GOLD }} /> Voice Synthesis
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>ElevenLabs / GPU</span>
                      </h3>
                      <div>
                        <label className="text-xs text-white/40 mb-2 block">Text to speak in your voice</label>
                        <textarea value={voiceText} onChange={e => setVoiceText(e.target.value)}
                          rows={4} placeholder="Hey darling! I've been thinking about you. Thank you so much for your support — it means the world to me 💕"
                          className="w-full bg-black/50 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none resize-y placeholder:text-white/20" />
                        <p className="text-xs text-white/20 mt-1">{voiceText.length} characters</p>
                      </div>
                      <div className="p-3 rounded-xl text-xs text-white/40 leading-relaxed" style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.12)" }}>
                        <strong className="text-green-300">Requires: </strong>
                        Add <code className="bg-black/40 px-1 rounded">ELEVENLABS_API_KEY</code> + <code className="bg-black/40 px-1 rounded">ELEVENLABS_VOICE_ID</code> in Settings → AI Keys, or set <code className="bg-black/40 px-1 rounded">GPU_WORKER_URL</code> for XTTS v2 / RVC voice cloning on your own GPU.
                      </div>
                      <button onClick={generateVoice} disabled={voiceLoading || !voiceText.trim()}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#059669,#10b981)", color: "white", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
                        <Mic className="w-4 h-4" />{voiceLoading ? "Generating voice…" : "Generate Voice Message"}
                      </button>
                    </GoldCard>
                    {voiceLoading && (
                      <div className="flex items-center gap-3 text-white/50 text-sm">
                        <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
                        Synthesizing voice…
                      </div>
                    )}
                    {voiceResult?.audioUrl && (
                      <GoldCard className="p-4 space-y-3">
                        <h3 className="font-semibold text-white">Voice Message Ready</h3>
                        <audio controls src={voiceResult.audioUrl.startsWith("http") ? voiceResult.audioUrl : `${BASE}${voiceResult.audioUrl}`} className="w-full rounded-xl" />
                        <button onClick={() => {
                          const a = document.createElement("a");
                          a.href = voiceResult.audioUrl!.startsWith("http") ? voiceResult.audioUrl! : `${BASE}${voiceResult.audioUrl}`;
                          a.download = "hannah-voice-message.mp3"; a.click();
                        }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-green-500/30 text-green-300 bg-green-500/10 hover:bg-green-500/20 transition-colors">
                          Download MP3
                        </button>
                      </GoldCard>
                    )}
                    {voiceResult?.message && !voiceResult?.audioUrl && (
                      <div className="rounded-xl p-4 border border-amber-500/20 bg-amber-500/5 text-sm text-amber-300">{voiceResult.message}</div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t flex items-center justify-around px-1 safe-pb"
        style={{
          borderColor: "rgba(201,168,76,0.1)",
          background: "rgba(7,7,6,0.97)",
          backdropFilter: "blur(20px)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        }}>
        {tabs.slice(0, 6).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="relative flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all min-w-[48px]"
            style={{ color: tab === t.id ? GOLD : "rgba(255,255,255,0.3)" }}>
            {t.count !== undefined && t.count > 0 && (
              <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-black"
                style={{ background: GOLD }}>{t.count}</span>
            )}
            {t.icon}
            <span className="text-[9px] font-semibold tracking-wide">{t.label}</span>
          </button>
        ))}
        {/* More button */}
        <button onClick={() => setTab("settings")}
          className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl"
          style={{ color: ["settings", "github", "social"].includes(tab) ? GOLD : "rgba(255,255,255,0.3)" }}>
          <Settings className="w-[18px] h-[18px]" />
          <span className="text-[9px] font-semibold tracking-wide">More</span>
        </button>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          main { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
        }
        * { -webkit-tap-highlight-color: transparent; }
        textarea { field-sizing: content; }
      `}</style>

      {/* ── Lightbox / Full-screen image viewer ── */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center"
          style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(12px)" }}
          onClick={() => setLightboxImg(null)}>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}
            onClick={e => e.stopPropagation()}>
            <span className="text-white font-bold text-sm tracking-wide">
              Gift Card #{lightboxImg.gcId} — {lightboxImg.label}
            </span>
            <button onClick={() => setLightboxImg(null)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Image */}
          <img src={lightboxImg.src} alt={lightboxImg.label}
            className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()} />

          {/* Bottom bar — save button */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 px-5 py-6"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
            onClick={e => e.stopPropagation()}>
            <button
              onClick={async () => {
                const mime = lightboxImg.src.startsWith("data:image/png") ? "image/png" : "image/jpeg";
                const ext = mime === "image/png" ? "png" : "jpg";
                const filename = `giftcard_${lightboxImg.gcId}_${lightboxImg.label.toLowerCase()}.${ext}`;
                try {
                  const res = await fetch(lightboxImg.src);
                  const blob = await res.blob();
                  const file = new File([blob], filename, { type: mime });
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: filename });
                  } else {
                    const a = document.createElement("a");
                    a.href = lightboxImg.src;
                    a.download = filename;
                    a.click();
                  }
                } catch { /* user cancelled */ }
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-black active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg,#c9a84c,#f0d080)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Save to Photos
            </button>
            <p className="text-white/30 text-xs">or tap outside to close</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VIP Members Tab ───────────────────────────────────────────────────────
type VipMember = { id: number; email: string; fanName: string | null; tier: string; grantedBy: string; isActive: boolean; grantedAt: string; expiresAt: string | null; notes: string | null; };

function VipMembersTab({ API, adminKey, GOLD, GOLD_GRAD }: { API: string; adminKey: string; GOLD: string; GOLD_GRAD: string }) {
  const [members, setMembers] = React.useState<VipMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [grantEmail, setGrantEmail] = React.useState("");
  const [grantName, setGrantName] = React.useState("");
  const [grantTier, setGrantTier] = React.useState("monthly");
  const [granting, setGranting] = React.useState(false);
  const { toast } = useToast();
  const h = { "Content-Type": "application/json", "x-admin-key": adminKey };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/vip`, { headers: h });
      setMembers(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [API, adminKey]);

  React.useEffect(() => { load(); }, [load]);

  async function handleGrant() {
    if (!grantEmail.trim()) return;
    setGranting(true);
    try {
      const r = await fetch(`${API}/vip/grant`, {
        method: "POST", headers: h,
        body: JSON.stringify({ email: grantEmail.trim(), fanName: grantName.trim() || undefined, tier: grantTier, grantedBy: "admin" }),
      });
      if (r.ok) {
        toast({ title: "VIP granted!", description: `${grantEmail} now has ${grantTier} access.` });
        setGrantEmail(""); setGrantName("");
        load();
      } else {
        const e = await r.json(); toast({ title: "Failed", description: e.error, variant: "destructive" });
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
    setGranting(false);
  }

  async function handleRevoke(id: number) {
    await fetch(`${API}/vip/${id}`, { method: "PATCH", headers: h, body: JSON.stringify({ isActive: false }) });
    load();
  }

  const tierColor = (t: string) => t === "lifetime" ? "#f0d080" : t === "quarterly" ? "#c9a84c" : "#a07830";
  const tierLabel = (t: string) => t === "lifetime" ? "Lifetime" : t === "quarterly" ? "3-Month" : "Monthly";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
          <Crown className="w-6 h-6" style={{ color: GOLD }} /> VIP Members
        </h2>
        <p className="text-white/30 text-sm mt-1">Grant or revoke VIP access. Approved gift cards and successful payments auto-add fans here.</p>
      </div>

      {/* Manual grant */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(201,168,76,0.15)" }}>
        <p className="text-sm font-bold text-white/70">Grant VIP Manually</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={grantEmail} onChange={e => setGrantEmail(e.target.value)} placeholder="fan@email.com"
            className="h-10 rounded-xl px-3 text-sm bg-black border border-white/10 text-white placeholder:text-white/20 focus:outline-none col-span-1" />
          <input value={grantName} onChange={e => setGrantName(e.target.value)} placeholder="Fan name (optional)"
            className="h-10 rounded-xl px-3 text-sm bg-black border border-white/10 text-white placeholder:text-white/20 focus:outline-none" />
          <select value={grantTier} onChange={e => setGrantTier(e.target.value)}
            className="h-10 rounded-xl px-3 text-sm bg-black border border-white/10 text-white focus:outline-none">
            <option value="monthly">Monthly (1 month)</option>
            <option value="quarterly">Quarterly (3 months)</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </div>
        <button onClick={handleGrant} disabled={granting || !grantEmail.trim()}
          className="h-10 px-6 rounded-xl text-sm font-bold text-black disabled:opacity-40"
          style={{ background: GOLD_GRAD }}>
          {granting ? "Granting..." : "Grant VIP Access"}
        </button>
      </div>

      {/* Member list */}
      {loading ? (
        <div className="text-center py-16 text-white/20">Loading...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-20 border border-white/5 rounded-2xl text-white/20">
          <Crown className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No VIP members yet — approve a gift card or grant manually above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="rounded-2xl p-4 flex items-center justify-between gap-4" style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${m.isActive ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)"}` }}>
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: m.isActive ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.05)" }}>
                  <Crown className="w-4 h-4" style={{ color: m.isActive ? GOLD : "rgba(255,255,255,0.2)" }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{m.fanName || m.email}</span>
                    {m.fanName && <span className="text-white/30 text-xs">{m.email}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold text-black" style={{ background: m.isActive ? tierColor(m.tier) : "#333" }}>{tierLabel(m.tier)}</span>
                    {!m.isActive && <span className="text-xs text-red-400 font-bold">REVOKED</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-white/30">
                    <span>Granted: {new Date(m.grantedAt).toLocaleDateString()}</span>
                    {m.expiresAt && <span>Expires: {new Date(m.expiresAt).toLocaleDateString()}</span>}
                    {!m.expiresAt && m.tier === "lifetime" && <span className="text-amber-400">∞ Lifetime</span>}
                    <span>via {m.grantedBy.replace("_", " ")}</span>
                  </div>
                </div>
              </div>
              {m.isActive && (
                <button onClick={() => handleRevoke(m.id)}
                  className="shrink-0 h-8 px-3 rounded-lg text-xs font-bold text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings helpers ──────────────────────────────────────────────────────
const IC = "bg-black border-white/10 text-white text-sm rounded-xl placeholder:text-white/20 w-full";

function SettingsSection({ title, icon, desc, children }: { title: string; icon: React.ReactNode; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(201,168,76,0.1)" }}>
      <div className="flex items-start gap-3 p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,168,76,0.1)" }}>{icon}</div>
        <div><p className="font-bold text-white">{title}</p><p className="text-xs text-white/30 mt-0.5">{desc}</p></div>
      </div>
      <div className="p-5 space-y-0">{children}</div>
    </div>
  );
}

function SF({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
        <div className="sm:min-w-[160px] sm:shrink-0">
          <p className="text-sm font-semibold text-white/70">{label}</p>
          {hint && <p className="text-xs text-white/25 mt-0.5">{hint}</p>}
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

function SecretInput({ defaultValue, onSave, placeholder }: { defaultValue: string; onSave: (v: string) => void; placeholder?: string }) {
  const [val, setVal] = React.useState(defaultValue);
  const [show, setShow] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Input type={show ? "text" : "password"} value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
        className="bg-black border-white/10 text-white text-sm rounded-xl placeholder:text-white/20 flex-1" />
      <button type="button" onClick={() => setShow(s => !s)}
        className="p-2 text-white/30 hover:text-white transition-colors rounded-xl border border-white/10">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <button type="button" onClick={() => onSave(val)}
        className="px-3 py-2 rounded-xl text-sm font-bold text-black hover:opacity-90 transition-opacity whitespace-nowrap"
        style={{ background: "linear-gradient(135deg,#c9a84c,#f0d080)" }}>
        <Save className="w-4 h-4" />
      </button>
    </div>
  );
}
