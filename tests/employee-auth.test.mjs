import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticatedEmployee } from '../worker/auth.js';
import { firebaseConfig, mockFirebase, token } from './firebase-fixture.mjs';

const request = (idToken) => new Request('https://msa.test/api/chat/bootstrap', { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} });
const rejects = (operation, status) => assert.rejects(operation, (error) => error.status === status);

test('identidade e RE vêm do Firebase; cabeçalhos da hospedagem não substituem o login', async (t) => {
  const state = mockFirebase(t);
  const employee = await authenticatedEmployee(request(token('a')), firebaseConfig);
  assert.deepEqual(employee, { id: 'firebase:a', name: 'Funcionário a', re: '1001', role: 'operador' });
  const oldSession = new Request('https://msa.test/api/chat/bootstrap', { headers: { 'oai-authenticated-user-id': 'a' } });
  await rejects(authenticatedEmployee(oldSession, firebaseConfig), 401);
  assert.equal(state.calls, 2);
});

test('tokens expirados ou de outro projeto são recusados antes da consulta', async (t) => {
  const state = mockFirebase(t);
  for (const idToken of ['invalid', token('a', { exp: 0 }), token('a', { aud: 'outro-projeto' }), token('a', { iss: 'https://malicioso.test' })]) {
    await rejects(authenticatedEmployee(request(idToken), firebaseConfig), 401);
  }
  assert.equal(state.calls, 0);
});

test('um JWT aparentemente correto não autentica quando o Firebase o recusa', async (t) => {
  const state = mockFirebase(t), forged = token('a');
  state.rejectedTokens.add(forged);
  await rejects(authenticatedEmployee(request(forged), firebaseConfig), 401);
  assert.equal(state.calls, 1);
});

test('conta desabilitada ou sessão revogada não acessa as conversas', async (t) => {
  const state = mockFirebase(t);
  state.identities.get('a').disabled = true;
  await rejects(authenticatedEmployee(request(token('a')), firebaseConfig), 403);
  state.identities.get('a').disabled = false;
  state.identities.get('a').validSince = String(Math.floor(Date.now() / 1000) + 60);
  await rejects(authenticatedEmployee(request(token('a')), firebaseConfig), 401);
});

test('perfil ausente, RE inconsistente e cargo desconhecido não liberam acesso', async (t) => {
  const state = mockFirebase(t), original = { ...state.profiles.get('a') };
  for (const profile of [null, { ...original, re: '9999' }, { ...original, cargo: 'admin' }, { ...original, status: 'pendente' }]) {
    state.profiles.set('a', profile);
    await rejects(authenticatedEmployee(request(token('a')), firebaseConfig), 403);
  }
});

test('falha ao consultar Firebase deixa o acesso fechado e permite tentar novamente', async (t) => {
  const state = mockFirebase(t);
  state.unavailable = true;
  await rejects(authenticatedEmployee(request(token('a')), firebaseConfig), 503);
  state.unavailable = false;
  assert.equal((await authenticatedEmployee(request(token('a')), firebaseConfig)).id, 'firebase:a');
});
