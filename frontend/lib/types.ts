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

export type Message = {
  id: number;
  conversation_id: number;
  direction: "inbound" | "outbound";
  content: string;
  content_type: "text" | "image" | "audio" | "video" | "template";
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
