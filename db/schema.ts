import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('chat_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  re: text('re'),
  updatedAt: integer('updated_at').notNull(),
});

export const threads = sqliteTable('chat_threads', {
  id: text('id').primaryKey(),
  userA: text('user_a').notNull().references(() => profiles.id),
  userB: text('user_b').notNull().references(() => profiles.id),
}, (table) => [uniqueIndex('chat_threads_pair_unique').on(table.userA, table.userB)]);

export const messages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversation: text('conversation').notNull(),
  senderId: text('sender_id').notNull().references(() => profiles.id),
  senderName: text('sender_name').notNull(),
  senderRe: text('sender_re'),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
  clientKey: text('client_key').notNull(),
}, (table) => [
  index('chat_messages_conversation_id').on(table.conversation, table.id),
  uniqueIndex('chat_messages_sender_key_unique').on(table.senderId, table.clientKey),
]);
