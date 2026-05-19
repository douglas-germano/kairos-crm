export type Channel = "whatsapp" | "instagram";

export type User = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

export type Workspace = {
  id: number;
  name: string;
  plan: string;
  created_at: string;
};

export type Contact = {
  id: number;
  channel: Channel;
  external_id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type ContactPage = {
  items: Contact[];
  total: number;
  page: number;
  pages: number;
};

export type Conversation = {
  id: number;
  channel: Channel;
  status: "open" | "closed" | "bot";
  ai_enabled: boolean;
  last_message_at: string | null;
  assigned_to: number | null;
  created_at: string;
  synced_at: string | null;
  contact?: Contact;
};

export type ConversationPage = {
  items: Conversation[];
  total: number;
  page: number;
  pages: number;
};

export type ConversationSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
};

export type Message = {
  id: number;
  conversation_id: number;
  direction: "inbound" | "outbound";
  content: string;
  content_type: "text" | "image" | "audio" | "video" | "template" | "sticker";
  caption: string | null;
  status: "sent" | "delivered" | "read" | "failed";
  external_id: string | null;
  created_at: string;
};

export type Agent = {
  id: number;
  workspace_id: number;
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  enabled: boolean;
  channels: Channel[];
  created_at: string;
};

export type Flow = {
  id: number;
  agent_id: number;
  name: string;
  trigger_type: "first_message" | "keyword" | "schedule";
  trigger_config: Record<string, unknown>;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  active: boolean;
  created_at: string;
};

export type Integration = {
  id: number;
  workspace_id: number;
  channel: Channel;
  status: "active" | "inactive";
  meta: Record<string, unknown>;
  created_at: string;
};

export type BroadcastStatus = "draft" | "sending" | "completed" | "failed";

export type Broadcast = {
  id: number;
  workspace_id: number;
  name: string;
  message: string;
  status: BroadcastStatus;
  total_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type BroadcastRecipient = {
  id: number;
  broadcast_id: number;
  contact_id: number;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  contact: Contact | null;
};

export type BroadcastDetail = Broadcast & {
  recipients: BroadcastRecipient[];
};
