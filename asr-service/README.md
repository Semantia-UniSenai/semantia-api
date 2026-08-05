# Semantia ASR

Serviço interno e efêmero de reconhecimento de fala, dimensionado para uma VPS CPU-only com 8–16 GB de RAM e 2–4 vCPU.

## Responsabilidade

- recebe PCM16 little-endian, mono, 16 kHz;
- valida tamanho e duração antes de chamar o modelo;
- executa ASR especializado com `faster-whisper`;
- devolve texto, motor, modelo e tempo de inferência;
- nunca grava WAV/PCM e nunca registra áudio ou texto em logs;
- não contém regras de sala, autorização ou persistência.

A API NestJS é a única cliente deste serviço. O container ASR não deve ser exposto à internet em produção.

## Endpoints

### `GET /health`

Liveness do processo. Não garante que o modelo esteja carregado.

### `GET /ready`

Retorna `200` quando o provider está carregado e `503` caso contrário.

### `POST /v1/transcriptions`

Corpo: `application/octet-stream` com PCM16.

Headers obrigatórios:

- `x-request-id`: `clientSegmentId`, entre 8 e 128 caracteres seguros;
- `x-sample-rate`: `16000`;
- `x-duration-ms`: duração declarada entre 250 e 30000 ms.

Header opcional: `x-language`, atualmente `pt`.

Resposta:

```json
{
  "requestId": "segment-0001",
  "text": "texto literal",
  "engine": "faster-whisper",
  "model": "small",
  "inferenceMs": 842
}
```

A duração declarada precisa corresponder aos bytes com tolerância de 80 ms. O corpo máximo é 960000 bytes. Erros usam códigos estáveis sem detalhes internos.

`text` pode ser vazio quando a janela não produz fala reconhecível. A API NestJS trata esse resultado
como ACK sem persistência/broadcast e mantém replay idempotente em cache efêmero por 120 s.

O provider recebe cada janela integral; não há `vad_filter`. Segmentação ocorre no navegador por
contagem de frames e controle explícito, não por classificação de voz/silêncio.

## Defaults CPU-first

```dotenv
ASR_PROVIDER=faster-whisper
ASR_MODEL=small
ASR_DEVICE=cpu
ASR_COMPUTE_TYPE=int8
ASR_CPU_THREADS=2
ASR_MAX_CONCURRENCY=1
ASR_MAX_QUEUE=4
ASR_PRELOAD=true
ASR_HOTWORDS="Semantia Socket.IO WebSocket TypeScript PostgreSQL"
```

O modelo fica no volume `/models` por meio de `HF_HOME=/models/huggingface`. O primeiro start baixa o modelo; reinícios seguintes reutilizam o cache.

`large-v3-turbo` não é o default porque 2–4 vCPU sem GPU podem criar backlog. Qualquer troca de modelo exige benchmark no mesmo áudio pt-BR.

## Desenvolvimento

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[test]'
.venv/bin/pytest -q -W error
.venv/bin/uvicorn asr_service.main:app --host 127.0.0.1 --port 8000
```

O Compose na raiz sobe PostgreSQL e ASR:

```bash
docker compose up -d postgres asr
docker compose ps
docker compose logs --no-log-prefix asr
```

A porta `127.0.0.1:8000` existe apenas para desenvolvimento local. Em produção, remova o mapeamento de porta e mantenha o serviço na rede privada do Compose.

## Segurança e operação

- container sem root (`uid/gid 10001`);
- áudio somente em memória;
- retenção de áudio zero;
- uma inferência concorrente por padrão;
- fila limitada e erro `QUEUE_FULL` quando saturada;
- nenhuma credencial cloud;
- sem fallback implícito para provedor externo;
- logs devem conter apenas request id, bytes, duração, motor e timings;
- o futuro agente/LLM consome somente texto final em outro serviço.
