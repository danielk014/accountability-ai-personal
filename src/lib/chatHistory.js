import { getUserPrefix } from '@/lib/userStore';
import { supabaseStorage } from '@/api/supabaseStorage';

const MAX_CONVERSATIONS = 30;

function getKey(chatType) {
  return `${getUserPrefix()}chat_history_${chatType}`;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function generateTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const text = typeof firstUser.content === 'string' ? firstUser.content
    : typeof firstUser.text === 'string' ? firstUser.text
    : 'New conversation';
  return text.length > 50 ? text.slice(0, 50) + '…' : text;
}

export function newConversation() {
  return {
    id: generateId(),
    title: 'New conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

export function loadConversations(chatType) {
  try {
    const raw = supabaseStorage.getItem(getKey(chatType));
    if (!raw) return [];
    const list = JSON.parse(raw);
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveConversation(chatType, conversation) {
  const list = loadConversations(chatType);
  const idx = list.findIndex(c => c.id === conversation.id);
  const updated = {
    ...conversation,
    updatedAt: Date.now(),
    title: generateTitle(conversation.messages) || conversation.title,
  };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.unshift(updated);
  }
  // Prune oldest beyond max
  const pruned = list.slice(0, MAX_CONVERSATIONS);
  supabaseStorage.setItem(getKey(chatType), JSON.stringify(pruned));
}

export function deleteConversation(chatType, id) {
  const list = loadConversations(chatType);
  const filtered = list.filter(c => c.id !== id);
  supabaseStorage.setItem(getKey(chatType), JSON.stringify(filtered));
}

/**
 * Migrate a flat messages array (old format) into the new conversations system.
 * Returns the created conversation, or null if no migration needed.
 */
export function migrateFlat(chatType, oldMessages) {
  if (!oldMessages || oldMessages.length === 0) return null;
  const existing = loadConversations(chatType);
  if (existing.length > 0) return null; // already migrated
  const conv = {
    id: generateId(),
    title: generateTitle(oldMessages),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: oldMessages,
  };
  supabaseStorage.setItem(getKey(chatType), JSON.stringify([conv]));
  return conv;
}
