"""Prepara o áudio de teste em português para o benchmark de latência do ASR.

Gera janelas PCM16 mono de 16 kHz com a mesma regra do navegador
(`semantia-web/src/live/useMeetingTranscription.ts`): janelas fixas de 5 s,
cortadas por contagem de amostras, sem VAD. A última janela fica com o resto,
desde que tenha pelo menos 250 ms (o mínimo aceito pela API).

Fontes:
- ``fleurs``: fala humana lida em português do Brasil (Google FLEURS, ``pt_br``,
  partição ``dev``), licença CC BY 4.0. Baixada do Hugging Face.
- ``corpus100``: as 100 frases ``literalText`` do corpus sintético do agente de
  adaptação (``src/modules/transcript-adaptation/evaluation``), sintetizadas com
  Piper (voz ``pt_BR-faber-medium``). Se o Piper falhar, usa ``espeak-ng``.

Uso:
    python benchmarks/prepare_corpus.py fleurs --out bench/fleurs --utterances 30
    python benchmarks/prepare_corpus.py corpus100 --out bench/corpus100 \
        --corpus-json ../src/modules/transcript-adaptation/evaluation/\
transcript-adaptation-corpus.synthetic.json
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import wave
from pathlib import Path

SAMPLE_RATE = 16_000
WINDOW_SECONDS = 5
MIN_WINDOW_MS = 250
GAP_SECONDS = 0.5


def to_pcm16_16k(source: Path) -> bytes:
    """Converte qualquer áudio para PCM16 LE mono 16 kHz com ffmpeg."""
    result = subprocess.run(
        [
            "ffmpeg",
            "-nostdin",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            str(SAMPLE_RATE),
            "-f",
            "s16le",
            "-acodec",
            "pcm_s16le",
            "-",
        ],
        check=True,
        capture_output=True,
    )
    return result.stdout


def write_wav(path: Path, pcm16: bytes) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm16)


def build_windows(utterances: list[tuple[str, bytes]], out: Path, source: dict) -> None:
    """Concatena as falas com pausas curtas e corta em janelas fixas de 5 s."""
    gap = b"\x00\x00" * int(SAMPLE_RATE * GAP_SECONDS)
    stream = gap.join(pcm for _text, pcm in utterances)
    window_bytes = SAMPLE_RATE * WINDOW_SECONDS * 2
    windows_dir = out / "windows"
    if windows_dir.exists():
        shutil.rmtree(windows_dir)
    windows_dir.mkdir(parents=True)

    windows = []
    for index, start in enumerate(range(0, len(stream), window_bytes)):
        chunk = stream[start : start + window_bytes]
        duration_ms = round(len(chunk) / 2 * 1_000 / SAMPLE_RATE)
        if duration_ms < MIN_WINDOW_MS:
            continue
        name = f"w{index:04d}.wav"
        write_wav(windows_dir / name, chunk)
        windows.append({"file": f"windows/{name}", "durationMs": duration_ms})

    manifest = {
        **source,
        "sampleRate": SAMPLE_RATE,
        "windowSeconds": WINDOW_SECONDS,
        "gapSeconds": GAP_SECONDS,
        "utterances": len(utterances),
        "totalAudioMs": round(len(stream) / 2 * 1_000 / SAMPLE_RATE),
        "reference": " ".join(text for text, _pcm in utterances),
        "windows": windows,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(
        f"{source['name']}: {len(utterances)} falas, {len(windows)} janelas, "
        f"{manifest['totalAudioMs'] / 1000:.1f} s de áudio -> {out}"
    )


def prepare_fleurs(out: Path, utterances: int, split: str) -> None:
    from huggingface_hub import hf_hub_download

    repo = "google/fleurs"
    tsv_path = hf_hub_download(repo, f"data/pt_br/{split}.tsv", repo_type="dataset")
    tar_path = hf_hub_download(repo, f"data/pt_br/audio/{split}.tar.gz", repo_type="dataset")

    rows: dict[str, str] = {}
    with open(tsv_path, encoding="utf-8") as handle:
        for row in csv.reader(handle, delimiter="\t", quoting=csv.QUOTE_NONE):
            # id, file_name, raw_transcription, transcription, ..., num_samples, gender
            if len(row) >= 3 and row[1].endswith(".wav"):
                rows.setdefault(row[1], row[2])
    selected = sorted(rows)[:utterances]
    wanted = set(selected)

    pcm_by_name: dict[str, bytes] = {}
    with tempfile.TemporaryDirectory() as tmp, tarfile.open(tar_path, "r:gz") as archive:
        for member in archive:
            name = Path(member.name).name
            if name not in wanted or not member.isfile():
                continue
            target = Path(tmp) / name
            with archive.extractfile(member) as data, open(target, "wb") as handle:
                shutil.copyfileobj(data, handle)
            pcm_by_name[name] = to_pcm16_16k(target)
    missing = wanted - pcm_by_name.keys()
    if missing:
        raise SystemExit(f"FLEURS: {len(missing)} arquivos não encontrados no tar")

    build_windows(
        [(rows[name], pcm_by_name[name]) for name in selected],
        out,
        {
            "name": "fleurs-pt_br",
            "description": f"Google FLEURS pt_br ({split}), fala humana lida, CC BY 4.0",
            "files": selected,
        },
    )


def synthesize_piper(texts: list[str], tmp: Path) -> tuple[list[bytes], str]:
    from huggingface_hub import hf_hub_download
    from piper import PiperVoice

    base = "pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"
    model = hf_hub_download("rhasspy/piper-voices", base)
    hf_hub_download("rhasspy/piper-voices", base + ".json")
    voice = PiperVoice.load(model)
    pcms = []
    for index, text in enumerate(texts):
        path = tmp / f"p{index:03d}.wav"
        with wave.open(str(path), "wb") as wav:
            voice.synthesize_wav(text, wav)
        pcms.append(to_pcm16_16k(path))
    return pcms, "Piper TTS, voz pt_BR-faber-medium"


def synthesize_espeak(texts: list[str], tmp: Path) -> tuple[list[bytes], str]:
    pcms = []
    for index, text in enumerate(texts):
        path = tmp / f"e{index:03d}.wav"
        subprocess.run(["espeak-ng", "-v", "pt-br", "-w", str(path), text], check=True)
        pcms.append(to_pcm16_16k(path))
    return pcms, "espeak-ng, voz pt-br"


def prepare_corpus100(out: Path, corpus_json: Path) -> None:
    data = json.loads(corpus_json.read_text(encoding="utf-8"))
    texts = [case["literalText"] for case in data["cases"]]
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        try:
            pcms, engine = synthesize_piper(texts, tmp)
        except Exception as cause:  # noqa: BLE001 - registra e usa o fallback
            print(
                f"Piper indisponível ({type(cause).__name__}: {cause}); usando espeak-ng",
                file=sys.stderr,
            )
            pcms, engine = synthesize_espeak(texts, tmp)
    build_windows(
        list(zip(texts, pcms, strict=True)),
        out,
        {
            "name": "corpus100-tts",
            "description": (
                f"100 frases literalText do corpus sintético, voz sintetizada ({engine})"
            ),
            "synthesizer": engine,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", choices=["fleurs", "corpus100"])
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--utterances", type=int, default=30)
    parser.add_argument("--split", default="dev")
    parser.add_argument("--corpus-json", type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    if args.source == "fleurs":
        prepare_fleurs(args.out, args.utterances, args.split)
    else:
        if not args.corpus_json:
            parser.error("--corpus-json é obrigatório para corpus100")
        prepare_corpus100(args.out, args.corpus_json)


if __name__ == "__main__":
    main()
