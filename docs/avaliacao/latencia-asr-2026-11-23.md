# Latência do reconhecimento de fala (Whisper), 23/11/2026

Medição do tempo que o serviço de reconhecimento de fala da Semantia leva para transformar a fala
em legenda literal. Execução pública no GitHub Actions:
[run 45179433566](https://github.com/Semantia-UniSenai/semantia-api/actions/runs/45179433566)
(workflow `Latência do ASR (Whisper)`, commit `bfaf9cf`). Os dados brutos estão em
[`latencia-asr-2026-11-23/`](latencia-asr-2026-11-23/).

## Como o pipeline funciona

1. O navegador do anfitrião captura o microfone (AudioWorklet), reamostra para 16 kHz e corta o
   áudio em **janelas fixas de 5 s**, sem detecção de voz (`useMeetingTranscription.ts`,
   `segmentSeconds: 5`).
2. Cada janela vai em PCM16 pelo Socket.IO (`transcription:audio`) para a API NestJS.
3. A API chama o serviço ASR interno por HTTP (`POST /v1/transcriptions`), que roda
   faster-whisper `small`, `int8`, CPU, 2 threads, beam 5, uma inferência por vez (fila de até 4).
4. A API aplica a limpeza conservadora, grava o trecho no PostgreSQL e transmite
   `transcript:final` para todos na sala.

## O que foi medido

| Teste | Script | Descrição |
|---|---|---|
| Inferência | `asr-service/benchmarks/latency.py` | Tempo do `FasterWhisperProvider` de produção por janela de 5 s, várias repetições, e RTF (tempo de processamento ÷ duração do áudio). |
| Ponta a ponta | `scripts/benchmark-caption-latency.mjs` | Um anfitrião envia uma janela a cada 5 s, em tempo real, como o navegador; mede do envio até o convidado receber `transcript:final`, com API, PostgreSQL, Socket.IO e ASR reais. |

Áudio de teste:

- **FLEURS pt_br** (Google, partição `dev`, CC BY 4.0): 30 falas humanas lidas em português do
  Brasil, emendadas com pausas de 0,5 s, 359,6 s de áudio, 72 janelas.
- **Corpus de 100 frases** do agente de adaptação (`literalText`), sintetizadas com Piper
  (voz `pt_BR-faber-medium`): 284,5 s de áudio, 57 janelas.

Ambiente: GitHub Actions `ubuntu-24.04`, Intel Xeon 6975P-C, 4 vCPU, 15,7 GB de RAM, Python 3.12,
faster-whisper 1.2.1, CTranslate2 4.9.1. Na configuração de produção o ASR foi limitado a 2 núcleos
(`taskset -c 0,1`, `ASR_CPU_THREADS=2`); no ponta a ponta a API e o script ficaram nos outros 2.
O modelo foi baixado e carregado antes da medição (carga a quente: cerca de 1 s) e duas janelas de
aquecimento foram descartadas.

## Resultados

Tempos em milissegundos.

| Cenário | Métrica | n | Média | Mediana | p95 | Desvio | Mín. | Máx. |
|---|---|---|---|---|---|---|---|---|
| FLEURS, 2 threads (produção) | Inferência por janela de 5 s | 360 | 1369 | 1284 | 1460 | 697 | 1114 | 9958 |
| FLEURS, 2 threads (produção) | RTF | 360 | 0,274 | 0,257 | 0,292 | 0,139 | 0,223 | 1,992 |
| 100 frases (Piper), 2 threads | Inferência por janela de 5 s | 171 | 1305 | 1296 | 1415 | 66 | 1176 | 1499 |
| 100 frases (Piper), 2 threads | RTF | 171 | 0,262 | 0,260 | 0,283 | 0,013 | 0,235 | 0,300 |
| FLEURS, 4 threads em 4 núcleos | Inferência por janela de 5 s | 216 | 1495 | 1386 | 1634 | 921 | 1144 | 11743 |
| FLEURS, ponta a ponta | Envio da janela → legenda no convidado | 144 | 1372 | 1297 | 1491 | 567 | 1151 | 6250 |
| FLEURS, ponta a ponta | Parte fora do Whisper (API, fila, banco, Socket.IO) | 144 | 27 | 12 | 18 | 121 | 10 | 1263 |
| FLEURS, ponta a ponta | Atraso da 1ª palavra da janela (inclui os 5 s da janela) | 144 | 6367 | 6297 | 6491 | 570 | 5799 | 11250 |

Leitura:

- Na configuração de produção o Whisper small processa uma janela de 5 s em cerca de **1,3 s**
  (RTF ≈ 0,26), ou seja, cerca de 3,8 vezes mais rápido que o tempo real. Não houve fila
  acumulada nem erro: 144 de 144 janelas viraram legenda.
- Do fim da janela até a legenda chegar ao convidado: mediana de **1,3 s** (p95 1,5 s). A API,
  o banco e o Socket.IO somam cerca de 12 ms (mediana); quase todo o tempo é do Whisper.
- Como o navegador só envia a janela depois de 5 s, a palavra dita no início da janela aparece
  cerca de **6,3 s** depois (mediana; p95 6,5 s), e a última palavra, cerca de 1,3 s depois.
  Para uma palavra num ponto qualquer da janela, o atraso esperado fica perto de 3,8 s
  (1,3 s + 2,5 s, estimativa derivada, não medida diretamente).
- **Janela atípica:** uma janela do FLEURS (`w0027`, que termina no meio de uma frase: "mas o
  vento e a umidade combinadas torna uma sensação mais fria que o que o") levou de 5,7 s a
  11,7 s em todas as repetições. A causa provável é o Whisper refazer a decodificação com
  temperatura maior quando o resultado não passa nos seus limiares de qualidade; isso não foi
  instrumentado. No ponta a ponta, a janela seguinte esperou de 0,75 s a
  1,26 s na fila e o atraso voltou ao normal em seguida. Sem essa janela, a média do FLEURS com
  2 threads é 1290 ms. São 5 de 360 medições (1,4%) acima de 2 s.
- 4 threads em 4 núcleos não foi mais rápido que 2 threads em 2 núcleos (mediana 1386 ms contra
  1284 ms) neste processador.
- Erro de reconhecimento (WER indicativo, só da primeira repetição): **14,3%** no FLEURS e 24,5%
  nas frases sintetizadas. É indicativo porque o corte fixo de 5 s parte palavras na borda das
  janelas e o texto foi normalizado só com minúsculas e sem pontuação. As transcrições estão nos
  arquivos `*.transcricao.txt`.

## Limitações

- O runner do GitHub Actions não é a VPS de produção. O processador (Xeon 6975P-C) é recente; numa
  VPS de 2 vCPU mais antiga ou compartilhada os tempos podem ser maiores. Os números valem para
  a configuração testada.
- Não foram medidos: captura e reamostragem no navegador, rede da internet entre o usuário e o
  servidor, renderização da legenda na tela e a adaptação pelo LLM (desligada por padrão,
  `TRANSCRIPT_ADAPTATION_ENABLED=false`). A rede foi local (127.0.0.1).
- Uma sala por vez, um anfitrião falando. Com várias salas o ASR atende uma janela por vez e a
  fila cresce.
- O áudio é fala lida (FLEURS) e voz sintetizada, sem ruído de ambiente, sotaques variados ou
  fala espontânea. Não substitui um teste com o público-alvo.

## Como repetir

GitHub → Actions → **Latência do ASR (Whisper)** → Run workflow. O artefato `latencia-asr` traz os
CSV, os resumos JSON e `RESUMO.md`. Para rodar em outra máquina, veja
[`asr-service/benchmarks/README.md`](../../asr-service/benchmarks/README.md).
