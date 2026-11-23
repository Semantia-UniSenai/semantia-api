"""Junta os resumos (*.summary.json) de uma pasta numa tabela Markdown.

Uso: python benchmarks/report.py results > results/RESUMO.md
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def fmt(stats: dict | None, scale: float = 1.0, digits: int = 0) -> list[str]:
    if not stats:
        return ["-"] * 7
    keys = ["n", "mean", "median", "p95", "stdev", "min", "max"]
    out = [str(stats["n"])]
    for key in keys[1:]:
        out.append(f"{stats[key] * scale:.{digits}f}".replace(".", ","))
    return out


def main() -> None:
    folder = Path(sys.argv[1])
    lines = [
        "# Latência do reconhecimento de fala (Whisper) na Semantia",
        "",
        "Valores em milissegundos, exceto RTF (tempo de processamento ÷ duração do áudio).",
        "",
        "| Cenário | Métrica | n | Média | Mediana | p95 | Desvio | Mín. | Máx. |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    details = []
    for path in sorted(folder.glob("inferencia-*.summary.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        cfg = data["config"]
        label = (
            f"{data['corpus']}, {cfg['model']}/{cfg['computeType']}, "
            f"{cfg['cpuThreads']} threads, núcleos {data['hardware']['affinity']}"
        )
        lines.append(
            f"| {label} | Inferência por janela (ms) | "
            + " | ".join(fmt(data["inferenceMs"]))
            + " |"
        )
        lines.append(f"| {label} | RTF | " + " | ".join(fmt(data["rtf"], digits=3)) + " |")
        wer = data.get("werIndicative")
        details.append(
            f"- `{path.name}`: {data['windows']} janelas × {data['repeats']} repetições; "
            f"carga do modelo {data['modelLoadMs']} ms; CPU {data['hardware']['cpu']}; "
            f"WER indicativo {wer:.1%}"
            if wer is not None
            else f"- `{path.name}`"
        )
    for path in sorted(folder.glob("ponta-a-ponta-*.summary.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        label = f"{data['corpus']}, ponta a ponta (API + ASR + PostgreSQL + Socket.IO)"
        lines.append(
            f"| {label} | Envio da janela → legenda no convidado (ms) | "
            + " | ".join(fmt(data["finalMs"]))
            + " |"
        )
        lines.append(
            f"| {label} | Inferência informada pelo ASR (ms) | "
            + " | ".join(fmt(data["inferenceMs"]))
            + " |"
        )
        lines.append(
            f"| {label} | Sobrecarga fora do Whisper (ms) | "
            + " | ".join(fmt(data["overheadMs"]))
            + " |"
        )
        lines.append(
            f"| {label} | Atraso da 1ª palavra da janela (ms) | "
            + " | ".join(fmt(data["firstWordDelayMs"]))
            + " |"
        )
        details.append(
            f"- `{path.name}`: {data['windows']} janelas × {data['passes']} passadas; "
            f"{data['captions']} legendas, {data['emptyText']} janelas sem texto, "
            f"{data['errors']} erros"
        )
    lines += ["", "## Execuções", "", *details, ""]
    print("\n".join(lines))


if __name__ == "__main__":
    main()
