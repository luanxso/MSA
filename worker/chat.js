import { authenticatedEmployee, EmployeeAuthError } from './auth.js';

const rooms = [
  { id: 'sector:producao', sector: 'producao', name: 'Produção', note: 'Alinhamentos gerais', description: 'Alinhamentos da produção e áreas de suporte.' },
  { id: 'sector:injecao', sector: 'injecao', name: 'Injeção', note: 'Conversa do setor', description: 'Informações do setor de injeção.' },
  { id: 'sector:montagem', sector: 'montagem', name: 'Montagem', note: 'Conversa do setor', description: 'Informações do setor de montagem.' },
  { id: 'sector:costura', sector: 'costura', name: 'Costura', note: 'Conversa do setor', description: 'Informações do setor de costura.' },
  { id: 'sector:manutencao', sector: 'manutencao', name: 'Manutenção', note: 'Suporte aos equipamentos', description: 'Alinhamentos de manutenção e suporte aos equipamentos.' },
  { id: 'sector:qualidade', sector: 'qualidade', name: 'Qualidade', note: 'Conversa do setor', description: 'Alinhamentos de qualidade e inspeção.' },
  { id: 'shift:handover', sector: null, name: 'Passagem de turno', note: 'Ocorrências e pendências', description: 'Ocorrências e pendências para o próximo turno.' },
];

class ChatError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function chatJson(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function chatDatabase(env) {
  if (!env.DB?.prepare) throw new ChatError(503, 'O chat está indisponível no momento. Tente novamente.');
  return env.DB;
}

async function chatBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new ChatError(415, 'Envie uma solicitação válida.');
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError(400, 'Solicitação incompleta.');
  const decoder = new TextDecoder();
  let text = '';
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) { await reader.cancel(); throw new ChatError(413, 'A mensagem é muito longa.'); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new ChatError(400, 'Solicitação inválida.'); }
}

async function ensureChatProfile(db, user) {
  await db.prepare('INSERT INTO chat_profiles (id, name, re, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, re = excluded.re, updated_at = excluded.updated_at')
    .bind(user.id, user.name, user.re, Date.now()).run();
  return db.prepare('SELECT id, name, re FROM chat_profiles WHERE id = ?').bind(user.id).first();
}

async function authorizeChatConversation(db, id, userId) {
  if (typeof id !== 'string' || id.length > 100) throw new ChatError(400, 'Conversa inválida.');
  if (rooms.some((room) => room.id === id)) return;
  const thread = await db.prepare('SELECT id FROM chat_threads WHERE id = ? AND (user_a = ? OR user_b = ?)').bind(id, userId, userId).first();
  if (!thread) throw new ChatError(404, 'Conversa não encontrada.');
}

function messageCursor(value) {
  if (value === null) return null;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new ChatError(400, 'Página de mensagens inválida.');
  return Number(value);
}

export async function handleChatRequest(request, env, firebaseConfig) {
  try {
    const user = await authenticatedEmployee(request, firebaseConfig);
    const url = new URL(request.url);
    const route = url.pathname.slice('/api/chat/'.length);
    if (['POST', 'PUT'].includes(request.method) && request.headers.get('Origin') !== url.origin) throw new ChatError(403, 'Origem da solicitação inválida.');
    const db = chatDatabase(env);

    if (request.method === 'GET' && route === 'bootstrap') {
      const me = await ensureChatProfile(db, user);
      const directory = await db.prepare("SELECT id, name, re FROM chat_profiles WHERE id != ? AND id LIKE 'firebase:%' ORDER BY name COLLATE NOCASE LIMIT 500").bind(user.id).all();
      return chatJson({ me, rooms, people: directory.results });
    }

    if (request.method === 'POST' && route === 'threads') {
      const body = await chatBody(request);
      if (typeof body.person_id !== 'string' || !body.person_id.startsWith('firebase:') || body.person_id.length > 160 || body.person_id === user.id) throw new ChatError(400, 'Selecione outro funcionário.');
      await ensureChatProfile(db, user);
      const person = await db.prepare('SELECT id FROM chat_profiles WHERE id = ?').bind(body.person_id).first();
      if (!person) throw new ChatError(404, 'Funcionário não encontrado.');
      const [a, b] = [user.id, person.id].sort();
      await db.prepare('INSERT INTO chat_threads (id, user_a, user_b) VALUES (?, ?, ?) ON CONFLICT(user_a, user_b) DO NOTHING').bind(`direct:${crypto.randomUUID()}`, a, b).run();
      const thread = await db.prepare('SELECT id FROM chat_threads WHERE user_a = ? AND user_b = ?').bind(a, b).first();
      return chatJson({ id: thread.id });
    }

    if (request.method === 'GET' && route === 'messages') {
      const conversation = url.searchParams.get('conversation');
      await authorizeChatConversation(db, conversation, user.id);
      const before = messageCursor(url.searchParams.get('before'));
      const after = messageCursor(url.searchParams.get('after'));
      if (before !== null && after !== null) throw new ChatError(400, 'Página de mensagens inválida.');
      const clause = before !== null ? ' AND id < ?' : after !== null ? ' AND id > ?' : '';
      const statement = db.prepare(`SELECT id, conversation, sender_id, sender_name, sender_re, body, created_at FROM chat_messages WHERE conversation = ?${clause} ORDER BY id ${after !== null ? 'ASC' : 'DESC'} LIMIT 51`);
      const args = [conversation];
      if (before !== null || after !== null) args.push(before ?? after);
      const result = await statement.bind(...args).all();
      const hasMore = result.results.length > 50;
      const messages = result.results.slice(0, 50);
      if (after === null) messages.reverse();
      return chatJson({ messages, has_more: hasMore });
    }

    if (request.method === 'POST' && route === 'messages') {
      const body = await chatBody(request);
      if (typeof body.body !== 'string' || !body.body.trim() || body.body.trim().length > 2000) throw new ChatError(400, 'Escreva uma mensagem de até 2.000 caracteres.');
      if (typeof body.client_key !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.client_key)) throw new ChatError(400, 'Identificação da mensagem inválida.');
      await authorizeChatConversation(db, body.conversation, user.id);
      const me = await ensureChatProfile(db, user);
      await db.prepare('INSERT INTO chat_messages (conversation, sender_id, sender_name, sender_re, body, created_at, client_key) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sender_id, client_key) DO NOTHING')
        .bind(body.conversation, me.id, me.name, me.re, body.body.trim(), Date.now(), body.client_key).run();
      const message = await db.prepare('SELECT id, conversation, sender_id, sender_name, sender_re, body, created_at FROM chat_messages WHERE sender_id = ? AND client_key = ?').bind(user.id, body.client_key).first();
      if (message.conversation !== body.conversation || message.body !== body.body.trim()) throw new ChatError(409, 'Esta solicitação já foi usada em outra mensagem.');
      return chatJson({ message }, 201);
    }

    return chatJson({ error: 'Ação não encontrada.' }, 404);
  } catch (error) {
    if (error instanceof ChatError || error instanceof EmployeeAuthError) return chatJson({ error: error.message }, error.status);
    console.error('Chat request failed:', error.message);
    return chatJson({ error: 'Não foi possível acessar o chat. Tente novamente.' }, 503);
  }
}
