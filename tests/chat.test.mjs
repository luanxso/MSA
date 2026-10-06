import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleChatRequest } from '../worker/chat.js';
import { firebaseConfig, mockFirebase, token } from './firebase-fixture.mjs';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter((file) => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...params) {
          return {
            async run() { return statement.run(...params); },
            async first() { return statement.get(...params) || null; },
            async all() { return { results: statement.all(...params) }; },
          };
        },
      };
    },
  };
}

async function request(db, user, route, { method = 'GET', body, origin = 'https://msa.test' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (user) headers.Authorization = `Bearer ${token(user)}`;
  const response = await handleChatRequest(new Request(`https://msa.test/api/chat/${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB: db }, firebaseConfig);
  return { status: response.status, data: await response.json() };
}

function message(conversation, body = 'Passagem de turno registrada.', clientKey = crypto.randomUUID()) {
  return { conversation, body, client_key: clientKey };
}

test('uma mensagem do setor usa a identidade Firebase e é lida por outro funcionário', async (t) => {
  mockFirebase(t);
  const db = database();
  const bootstrap = await request(db, 'a', 'bootstrap');
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.data.people.length, 0);
  assert(bootstrap.data.rooms.some((room) => room.name === 'Passagem de turno'));
  const saved = await request(db, 'a', 'messages', { method: 'POST', body: { ...message('sector:injecao'), sender_id: 'b', sender_name: 'Outro funcionário' } });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.message.sender_id, 'firebase:a');
  assert.equal(saved.data.message.sender_re, '1001');
  assert.equal(saved.data.message.sender_name, 'Funcionário a');
  const loaded = await request(db, 'b', 'messages?conversation=sector:injecao');
  assert.equal(loaded.status, 200);
  assert.equal(loaded.data.messages[0].body, 'Passagem de turno registrada.');
  assert.equal(loaded.data.messages[0].id, saved.data.message.id);
});

test('conversas individuais são compartilhadas pelos dois participantes e bloqueadas para terceiros', async (t) => {
  mockFirebase(t);
  const db = database();
  for (const user of ['a', 'b', 'c']) await request(db, user, 'bootstrap');
  const ab = await request(db, 'a', 'threads', { method: 'POST', body: { person_id: 'firebase:b' } });
  const ba = await request(db, 'b', 'threads', { method: 'POST', body: { person_id: 'firebase:a' } });
  assert.equal(ab.data.id, ba.data.id);
  await request(db, 'a', 'messages', { method: 'POST', body: message(ab.data.id, 'Mensagem individual.') });
  const participant = await request(db, 'b', `messages?conversation=${ab.data.id}`);
  assert.equal(participant.data.messages[0].body, 'Mensagem individual.');
  assert.equal((await request(db, 'c', `messages?conversation=${ab.data.id}`)).status, 404);
  assert.equal((await request(db, 'c', 'messages', { method: 'POST', body: message(ab.data.id) })).status, 404);
});

test('repetir um envio após falha de rede não duplica a mensagem', async (t) => {
  mockFirebase(t);
  const db = database();
  const body = message('sector:producao');
  const first = await request(db, 'a', 'messages', { method: 'POST', body });
  const repeated = await request(db, 'a', 'messages', { method: 'POST', body });
  assert.equal(first.data.message.id, repeated.data.message.id);
  const history = await request(db, 'a', 'messages?conversation=sector:producao');
  assert.equal(history.data.messages.length, 1);
  assert.equal((await request(db, 'a', 'messages', { method: 'POST', body: { ...body, body: 'Outra mensagem' } })).status, 409);
});

test('paginação mantém a ordem e recupera mensagens antigas e novas sem perdas', async (t) => {
  mockFirebase(t);
  const db = database();
  for (let i = 1; i <= 56; i += 1) await request(db, 'a', 'messages', { method: 'POST', body: message('shift:handover', `Registro ${i}`) });
  const recent = await request(db, 'b', 'messages?conversation=shift:handover');
  assert.equal(recent.data.messages.length, 50);
  assert.equal(recent.data.messages[0].body, 'Registro 7');
  assert.equal(recent.data.messages.at(-1).body, 'Registro 56');
  assert.equal(recent.data.has_more, true);
  const old = await request(db, 'b', `messages?conversation=shift:handover&before=${recent.data.messages[0].id}`);
  assert.equal(old.data.messages.length, 6);
  assert.equal(old.data.messages[0].body, 'Registro 1');
  assert.equal(old.data.has_more, false);
  const next = await request(db, 'b', `messages?conversation=shift:handover&after=${old.data.messages.at(-1).id}`);
  assert.deepEqual(next.data.messages.map((item) => item.id), recent.data.messages.map((item) => item.id));
});

test('validação impede uso anônimo, mensagens inválidas, alteração do RE e requisições externas', async (t) => {
  mockFirebase(t);
  const db = database();
  assert.equal((await request(db, null, 'bootstrap')).status, 401);
  assert.equal((await request(db, 'a', 'messages', { method: 'POST', body: message('sector:producao'), origin: 'https://outro.test' })).status, 403);
  assert.equal((await request(db, 'a', 'messages', { method: 'POST', body: message('sector:producao', '   ') })).status, 400);
  assert.equal((await request(db, 'a', 'messages', { method: 'POST', body: message('sector:producao', 'a'.repeat(2001)) })).status, 400);
  assert.equal((await request(db, 'a', 'profile', { method: 'PUT', body: { re: '9999' } })).status, 404);
  assert.equal((await request(db, 'a', 'bootstrap')).data.me.re, '1001');
  assert.equal((await request(null, 'a', 'bootstrap')).status, 503);
});

test('aprovação é exigida também na API e o bloqueio posterior interrompe novos envios', async (t) => {
  const state = mockFirebase(t), db = database();
  state.profiles.get('a').status = 'pendente';
  assert.equal((await request(db, 'a', 'bootstrap')).status, 403);
  state.profiles.get('a').status = 'ativo';
  assert.equal((await request(db, 'a', 'bootstrap')).status, 200);
  state.profiles.get('a').status = 'bloqueado';
  assert.equal((await request(db, 'a', 'messages', { method: 'POST', body: message('sector:producao') })).status, 403);
});
