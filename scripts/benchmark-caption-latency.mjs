// Mede a latência ponta a ponta da legenda literal na Semantia.
//
// Simula o anfitrião falando em tempo real: a cada 5 s uma janela de áudio
// (PCM16, 16 kHz, a mesma regra do navegador) é enviada pelo Socket.IO
// (`transcription:audio`) no instante em que ela terminaria de ser gravada.
// Um convidado conectado na mesma sala recebe `transcript:final`.
//
// Latência medida por janela:
//   finalMs  = chegada da legenda no convidado - envio da janela pelo anfitrião
//              (API + fila + HTTP + Whisper + persistência + broadcast)
//   ackMs    = chegada do ACK no anfitrião - envio
//   inferenceMs = tempo de inferência informado pelo serviço ASR
//   firstWordDelayMs = finalMs + duração da janela (atraso da primeira palavra
//              da janela, que espera a janela de 5 s fechar no navegador)
//
// Não mede: captura/reamostragem no navegador, rede da internet e renderização
// da legenda na tela. Use API e ASR reais (ASR_URL apontando para o serviço).
//
// Uso:
//   API_URL=http://127.0.0.1:3000 node scripts/benchmark-caption-latency.mjs \
//     --corpus asr-service/bench/fleurs --passes 2 --out results/ponta-a-ponta-fleurs.csv

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { io } from 'socket.io-client';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const corpusDir = arg('corpus');
const passes = Number(arg('passes', '2'));
const outPath = arg('out', 'results/ponta-a-ponta.csv');
if (!corpusDir) throw new Error('--corpus é obrigatório');

function readPcmFromWav(path) {
  const buffer = readFileSync(path);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'data') return buffer.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${path}: chunk data não encontrado`);
}

async function http(method, path, body, token) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${API_URL}/live`, {
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
    });
    const timer = setTimeout(() => reject(new Error('timeout de conexão')), 10_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function emitAck(socket, event, payload, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout no ack ${event}`)), timeoutMs);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function describe(values) {
  const n = values.length;
  if (n === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    n > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    mean,
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    stdev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(corpusDir, 'manifest.json'), 'utf8'));
  const windows = manifest.windows.map((item) => ({
    file: item.file,
    durationMs: item.durationMs,
    pcm16: readPcmFromWav(join(corpusDir, item.file)),
  }));

  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const host = await http('POST', '/api/auth/signup', {
    name: 'Anfitriã Benchmark',
    email: `bench-${unique}@semantia.app`,
    password: 'benchmark-only-1',
  });
  const meeting = await http('POST', '/api/rooms', {}, host.accessToken);
  const guest = await http('POST', '/api/sessions/guest-access', {
    joinToken: meeting.joinToken,
    displayName: 'Convidado Benchmark',
  });

  const hostSocket = await connect(host.accessToken);
  const guestSocket = await connect(guest.accessToken);
  for (const socket of [hostSocket, guestSocket]) {
    const ack = await emitAck(socket, 'session:join', { sessionId: meeting.meetingId });
    if (!ack?.ok) throw new Error(`session:join falhou: ${JSON.stringify(ack)}`);
  }

  const finalsBySeq = new Map();
  guestSocket.on('transcript:final', (event) => {
    finalsBySeq.set(event.seq, performance.now());
  });

  const rows = [];
  for (let pass = 1; pass <= passes; pass += 1) {
    const passStart = performance.now();
    let elapsedAudioMs = 0;
    const pending = [];
    for (const [index, window] of windows.entries()) {
      elapsedAudioMs += window.durationMs;
      // A janela só existe no navegador depois que todo o seu áudio foi gravado.
      await sleep(passStart + elapsedAudioMs - performance.now());
      const sentAt = performance.now();
      const payload = {
        clientSegmentId: `bench-${unique}-p${pass}-w${index}`,
        pcm16: window.pcm16,
        sampleRate: 16_000,
        durationMs: window.durationMs,
      };
      pending.push(
        emitAck(hostSocket, 'transcription:audio', payload).then(async (ack) => {
          const ackAt = performance.now();
          if (!ack?.ok) {
            rows.push({ pass, window: window.file, audioMs: window.durationMs, error: ack?.error?.code ?? 'UNKNOWN' });
            return;
          }
          let finalAt = null;
          if (ack.seq !== null) {
            for (let attempt = 0; attempt < 100 && !finalsBySeq.has(ack.seq); attempt += 1) {
              await sleep(20);
            }
            finalAt = finalsBySeq.get(ack.seq) ?? null;
          }
          rows.push({
            pass,
            window: window.file,
            audioMs: window.durationMs,
            seq: ack.seq,
            ackMs: ackAt - sentAt,
            finalMs: finalAt === null ? null : finalAt - sentAt,
            inferenceMs: ack.inferenceMs,
            model: ack.model,
            error: '',
          });
        }),
      );
    }
    await Promise.all(pending);
    console.log(`passada ${pass}/${passes} concluída (${windows.length} janelas)`);
  }

  hostSocket.disconnect();
  guestSocket.disconnect();

  mkdirSync(dirname(outPath), { recursive: true });
  const header = 'corpus,pass,window,audio_ms,seq,inference_ms,ack_ms,final_ms,overhead_ms,first_word_delay_ms,error';
  const lines = rows
    .sort((a, b) => a.pass - b.pass || a.window.localeCompare(b.window))
    .map((row) =>
      [
        manifest.name,
        row.pass,
        row.window,
        row.audioMs,
        row.seq ?? '',
        row.inferenceMs ?? '',
        row.ackMs?.toFixed(1) ?? '',
        row.finalMs?.toFixed(1) ?? '',
        row.finalMs != null && row.inferenceMs != null ? (row.finalMs - row.inferenceMs).toFixed(1) : '',
        row.finalMs != null ? (row.finalMs + row.audioMs).toFixed(1) : '',
        row.error,
      ].join(','),
    );
  writeFileSync(outPath, `${header}\n${lines.join('\n')}\n`);

  const withFinal = rows.filter((row) => row.finalMs != null);
  const summary = {
    corpus: manifest.name,
    corpusDescription: manifest.description,
    windows: windows.length,
    passes,
    sent: rows.length,
    captions: withFinal.length,
    emptyText: rows.filter((row) => !row.error && row.seq === null).length,
    errors: rows.filter((row) => row.error).length,
    finalMs: describe(withFinal.map((row) => row.finalMs)),
    ackMs: describe(rows.filter((row) => row.ackMs != null).map((row) => row.ackMs)),
    inferenceMs: describe(withFinal.map((row) => row.inferenceMs)),
    overheadMs: describe(withFinal.map((row) => row.finalMs - row.inferenceMs)),
    firstWordDelayMs: describe(withFinal.map((row) => row.finalMs + row.audioMs)),
  };
  writeFileSync(outPath.replace(/\.csv$/, '.summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  // Erros (por exemplo QUEUE_FULL) são resultado da medição, não falha do script.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
