"""Mede o tempo de inferência do Whisper (faster-whisper) por janela de áudio.

Usa o mesmo caminho de código do serviço em produção
(``asr_service.providers.FasterWhisperProvider``: beam 5, sem VAD, sem texto
anterior), com a configuração lida de argumentos. Para cada repetição e cada
janela de 5 s do corpus, grava uma linha no CSV com o tempo de inferência, a
duração do áudio e o fator de tempo real (RTF = inferência / duração).

Uso (configuração de produção: small, int8, 2 threads, limitado a 2 núcleos):
    taskset -c 0,1 python benchmarks/latency.py --corpus bench/fleurs \
        --threads 2 --repeats 5 --out results/inferencia-fleurs-t2.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import platform
import statistics
import sys
import wave
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from asr_service.config import Settings  # noqa: E402
from asr_service.providers import FasterWhisperProvider  # noqa: E402


def percentile(values: list[float], fraction: float) -> float:
    """Percentil com interpolação linear (mesmo método do numpy padrão)."""
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def describe(values: list[float]) -> dict[str, float]:
    return {
        "n": len(values),
        "mean": statistics.fmean(values),
        "median": statistics.median(values),
        "p95": percentile(values, 0.95),
        "stdev": statistics.stdev(values) if len(values) > 1 else 0.0,
        "min": min(values),
        "max": max(values),
    }


def read_pcm(path: Path) -> bytes:
    with wave.open(str(path), "rb") as wav:
        if wav.getframerate() != 16_000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise ValueError(f"{path} não está em PCM16 mono 16 kHz")
        return wav.readframes(wav.getnframes())


def cpu_model() -> str:
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or "desconhecido"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--warmup", type=int, default=2, help="janelas descartadas antes de medir")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads((args.corpus / "manifest.json").read_text(encoding="utf-8"))
    windows = [
        (item["file"], item["durationMs"], read_pcm(args.corpus / item["file"]))
        for item in manifest["windows"]
    ]

    settings = Settings(
        model=args.model,
        device=args.device,
        compute_type=args.compute_type,
        cpu_threads=args.threads,
    )
    provider = FasterWhisperProvider(settings)
    load_started = perf_counter()
    provider.load()
    load_ms = (perf_counter() - load_started) * 1_000

    for _file, _duration, pcm in windows[: args.warmup]:
        provider.transcribe(pcm, 16_000, "pt")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    transcripts: list[str] = []
    with open(args.out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "corpus",
                "model",
                "compute_type",
                "threads",
                "repeat",
                "window",
                "audio_ms",
                "inference_ms",
                "wall_ms",
                "rtf",
                "chars",
            ]
        )
        for repeat in range(1, args.repeats + 1):
            for file, duration_ms, pcm in windows:
                started = perf_counter()
                result = provider.transcribe(pcm, 16_000, "pt")
                wall_ms = (perf_counter() - started) * 1_000
                rtf = result.inference_ms / duration_ms
                writer.writerow(
                    [
                        manifest["name"],
                        args.model,
                        args.compute_type,
                        args.threads,
                        repeat,
                        file,
                        duration_ms,
                        result.inference_ms,
                        round(wall_ms, 1),
                        round(rtf, 4),
                        len(result.text),
                    ]
                )
                rows.append((duration_ms, result.inference_ms, rtf))
                if repeat == 1:
                    transcripts.append(result.text)
            handle.flush()
            print(f"repetição {repeat}/{args.repeats} concluída", flush=True)

    full_windows = [row for row in rows if row[0] == manifest["windowSeconds"] * 1_000]
    summary = {
        "corpus": manifest["name"],
        "corpusDescription": manifest["description"],
        "windows": len(windows),
        "repeats": args.repeats,
        "measurements": len(rows),
        "config": {
            "model": args.model,
            "computeType": args.compute_type,
            "device": args.device,
            "cpuThreads": args.threads,
            "beamSize": 5,
            "vad": False,
        },
        "hardware": {
            "cpu": cpu_model(),
            "logicalCpus": os.cpu_count(),
            "affinity": sorted(os.sched_getaffinity(0))
            if hasattr(os, "sched_getaffinity")
            else None,
            "python": platform.python_version(),
            "platform": platform.platform(),
        },
        "modelLoadMs": round(load_ms),
        "inferenceMs": describe([row[1] for row in rows]),
        "inferenceMsFullWindows": describe([row[1] for row in full_windows])
        if full_windows
        else None,
        "rtf": describe([row[2] for row in rows]),
    }
    try:
        import jiwer

        hypothesis = " ".join(transcripts)
        normalize = jiwer.Compose(
            [
                jiwer.ToLowerCase(),
                jiwer.RemovePunctuation(),
                jiwer.RemoveMultipleSpaces(),
                jiwer.Strip(),
                jiwer.ReduceToListOfListOfWords(),
            ]
        )
        summary["werIndicative"] = jiwer.wer(
            manifest["reference"],
            hypothesis,
            reference_transform=normalize,
            hypothesis_transform=normalize,
        )
    except ImportError:
        summary["werIndicative"] = None
    summary_path = args.out.with_suffix(".summary.json")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    (args.out.with_suffix(".transcricao.txt")).write_text(
        "REFERÊNCIA:\n"
        + manifest["reference"]
        + "\n\nWHISPER (repetição 1):\n"
        + "\n".join(transcripts)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
