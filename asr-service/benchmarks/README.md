# Benchmark de latência do ASR

Mede quanto tempo o Whisper (faster-whisper) leva para transcrever a fala na Semantia.

O navegador corta o microfone em janelas fixas de 5 s (PCM16, 16 kHz, sem VAD) e envia cada
janela pelo Socket.IO; a API chama este serviço e transmite a legenda literal para a sala.
Os scripts reproduzem essa regra.

| Script | O que mede |
|---|---|
| `prepare_corpus.py` | Gera as janelas de 5 s a partir de fala em português: FLEURS `pt_br` (fala humana) e as 100 frases do corpus do agente (voz sintetizada com Piper). |
| `latency.py` | Tempo de inferência por janela e RTF, usando o `FasterWhisperProvider` de produção. |
| `../../scripts/benchmark-caption-latency.mjs` | Ponta a ponta: envio da janela pelo anfitrião até `transcript:final` no convidado, com API, PostgreSQL e ASR reais, em tempo real (uma janela a cada 5 s). |
| `report.py` | Junta os `*.summary.json` numa tabela Markdown. |

## Rodar no GitHub Actions

Workflow `Latência do ASR (Whisper)` (`.github/workflows/latencia-asr.yml`): Actions → Run workflow.
O artefato `latencia-asr` traz os CSV brutos, os resumos JSON e `RESUMO.md`.

## Rodar localmente

```bash
cd asr-service
pip install -e . jiwer==4.0.0 piper-tts==1.8.0   # precisa de ffmpeg (e espeak-ng como reserva)
python benchmarks/prepare_corpus.py fleurs --out bench/fleurs --utterances 30
taskset -c 0,1 python benchmarks/latency.py --corpus bench/fleurs --threads 2 --repeats 5 \
  --out results/inferencia-fleurs-t2.csv
python benchmarks/report.py results > results/RESUMO.md
```

Para o ponta a ponta, suba PostgreSQL, o ASR (`uvicorn asr_service.main:app --port 8000`) e a API
(`node dist/src/main.js` com `ASR_URL=http://127.0.0.1:8000`) e rode, na raiz da API:

```bash
API_URL=http://127.0.0.1:3000 node scripts/benchmark-caption-latency.mjs \
  --corpus asr-service/bench/fleurs --passes 2 --out asr-service/results/ponta-a-ponta-fleurs.csv
```

`taskset -c 0,1` limita o processo a 2 núcleos, como a VPS prevista (2–4 vCPU, `ASR_CPU_THREADS=2`).
Os números dependem do processador: registre sempre o hardware junto do resultado.
