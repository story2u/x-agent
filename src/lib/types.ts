export type Tone = "sharp" | "warm" | "technical" | "playful" | "executive";

export interface GenerateRequest {
  topic: string;
  audience: string;
  goal: string;
  tone: Tone;
  constraints?: string;
  outputType?: "tweet" | "thread" | "review" | "longTweet" | "both";
  runMode?: "draft" | "reviewed" | "publish-ready";
  skillIds?: string[];
  referenceIds?: string[];
  knowledgeSourceIds?: string[];
  toolIds?: string[];
}

export interface CreativeMediaExtension {
  kind: "image";
  status: "planned" | "generated";
  prompt?: string;
  altText?: string;
  assetUrl?: string;
}

export interface TwitterCreative {
  tweet: string;
  hashtags: string[];
  rationale: string;
  safetyNotes: string[];
  dailyFortune?: DailyFortuneArtifact;
  media?: CreativeMediaExtension;
}

export interface DailyFortuneArtifact {
  selectedSkill: "daily-fortune-tweet";
  outputType: "longTweet" | "thread" | "both";
  inputSummary: {
    date: string | null;
    topic: string;
    audience: string | null;
    assumptions: string[];
  };
  fortuneSpine: {
    keyword: string;
    symbolicImage: string;
    emotionalWeather: string;
    coreTension: string;
    practicalAdvice: string;
  };
  longTweet: {
    title: string;
    body: string;
    hashtags: string[];
  };
  thread: Array<{
    index: number;
    text: string;
    role: "hook" | "context" | "money" | "career" | "relationship" | "risk" | "ritual" | "cta";
  }>;
  reviewNotes: {
    safetyCheck: string[];
    hypeCheck: string[];
    publishReadiness: "draft" | "reviewed" | "publish-ready";
  };
}

export interface GenerateResponse {
  id: string;
  operator?: Operator;
  creative: TwitterCreative;
  transcript: string;
  references?: GenerationReference[];
  skillTrace?: RunSkillTrace;
  usage?: {
    input: number;
    output: number;
    totalTokens: number;
  };
  job?: CreativeJob;
}

export interface Operator {
  email: string;
  name: string;
  authMode: "cloudflare-access" | "development" | "chatgpt-oauth" | "password";
  role: "admin" | "operator" | "viewer";
}

export type CreativeJobStatus = "draft" | "review" | "approved" | "published";

export interface CreativeJob {
  id: string;
  operator: Operator;
  status: CreativeJobStatus;
  input: GenerateRequest;
  creative: TwitterCreative;
  transcript: string;
  references?: GenerationReference[];
  usage?: GenerateResponse["usage"];
  tweetId?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  operator?: Operator;
  jobId?: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface GenerationReference {
  id: string;
  type: "skill" | "reference" | "knowledge" | "tool";
  label: string;
  citation?: string;
}

export type SkillStatus = "draft" | "active" | "deprecated";
export type SkillVersionStatus = "draft" | "published" | "archived";
export type SkillValidationStatus = "valid" | "warning" | "error";

export interface SkillValidationResult {
  status: SkillValidationStatus;
  errors: string[];
  warnings: string[];
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  "allowed-tools"?: string[] | string;
  [key: string]: unknown;
}

export interface SkillReferenceBinding {
  id: string;
  skillVersionId: string;
  referenceId?: string;
  title: string;
  path: string;
  type: "markdown" | "template" | "policy" | "example";
  content: string;
  loadPolicy: "always" | "on-demand";
  createdAt: string;
}

export interface SkillToolPermission {
  id: string;
  skillVersionId: string;
  toolName: string;
  permission: "allowed" | "requires-approval" | "blocked";
  description: string;
  enabled: boolean;
  createdAt: string;
}

export interface SkillVersion {
  id: string;
  skillId: string;
  version: number;
  status: SkillVersionStatus;
  skillMd: string;
  frontmatter: SkillFrontmatter;
  outputContract: Record<string, unknown> | null;
  validation: SkillValidationResult;
  changelog?: string;
  createdAt: string;
  publishedAt?: string;
  references: SkillReferenceBinding[];
  tools: SkillToolPermission[];
}

export interface SkillPackage {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: SkillStatus;
  currentVersionId?: string;
  currentVersion?: SkillVersion;
  validation: SkillValidationResult;
  linkedReferencesCount: number;
  allowedToolsCount: number;
  lastRunAt?: string;
  usedByCurrentAgent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillTestRun {
  id: string;
  skillId: string;
  skillVersionId?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  validation: SkillValidationResult;
  status: "success" | "failed";
  createdAt: string;
}

export interface RunSkillTrace {
  id?: string;
  runId?: string;
  skillId: string;
  skillSlug: string;
  skillName: string;
  skillVersionId: string;
  version: number;
  selectionMode: "manual" | "auto" | "default";
  selectionReason: string;
  loadedReferences: Array<{ title: string; path: string; loadPolicy: string }>;
  allowedTools: Array<{ toolName: string; permission: string; enabled: boolean }>;
  outputContractValid: boolean;
  validation?: SkillValidationResult;
  runInput?: string;
  runOutputType?: string;
  runArtifactPreview?: string;
  runStatus?: string;
  createdAt?: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Operator["role"];
  authMode: Operator["authMode"];
  teamId: string;
  disabledAt?: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeJobVersion {
  id: string;
  jobId: string;
  version: number;
  creative: TwitterCreative;
  transcript: string;
  usage?: GenerateResponse["usage"];
  createdAt: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  version: number;
  trigger: string;
  referenceIds: string[];
  toolIds: string[];
  outputContract: string;
  executionPolicy: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceTemplate {
  id: string;
  name: string;
  owner: string;
  body: string;
  status: "active" | "disabled";
  version: number;
  isDefault: boolean;
  linkedSkillIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  sourceType: string;
  sourceUrl?: string;
  status: "active" | "queued" | "indexing" | "disabled";
  indexedAt?: string;
  chunks: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  citation?: string;
  createdAt: string;
}

export interface ToolExtension {
  id: string;
  name: string;
  type: string;
  status: "enabled" | "disabled";
  permission: "agent" | "operator" | "publisher" | "system" | "admin";
  secretStatus: "not_required" | "missing" | "configured";
  rateLimit: number;
  description: string;
  guardrail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCallLog {
  id: string;
  toolId: string;
  operator?: Operator;
  jobId?: string;
  mode: "live" | "dry-run";
  status: string;
  input: unknown;
  output: Record<string, unknown>;
  requestId?: string;
  createdAt: string;
}
