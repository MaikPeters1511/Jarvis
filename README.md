# Javis – Lokaler Voice Assistant

Javis ist ein lokal betriebener Sprachassistent mit orchestrierter Multi-Service-Architektur über `.NET Aspire`.

## Überblick

| Komponente | Technologie | Zweck |
|---|---|---|
| Orchestrierung | `.NET Aspire` (`AppHost`, `net10.0`) | Startet und verbindet alle Services |
| API | `ASP.NET Core` (`ApiService`, `net10.0`) | Chat/STT/TTS-Endpunkte, SignalR, DB-Zugriff |
| Frontend | `Angular 21` + `TypeScript` (`Web`) | UI, Wake-Word im Browser |
| TTS-Service | `Python 3.13` + `FastAPI` (`TtsService`) | Sprachsynthese (Qwen3-TTS) |
| Datenbank | `PostgreSQL` (via Aspire) | Persistenz für Einstellungen u. a. |
| LLM Runtime | `Ollama` (via Aspire) | Lokales LLM-Modell |

## Voraussetzungen

- `.NET SDK 10`
- `Node.js` + `npm` (im Web-Projekt ist `npm@11.12.1` hinterlegt)
- `Docker` (für Aspire-verwaltete Container wie PostgreSQL/Ollama)
- Für `TtsService`: Python-Umgebung via `uv` (wird durch AppHost/Service-Setup verwendet)
- Optional/abhängig von Hardware: passende Beschleunigung (`mps`, `cuda` oder `cpu`) für TTS

## Setup & Start

Aus dem Repository-Root (`/Users/maik/Desktop/Javis`):

```bash
# 1) Wake-Word-Modelle (einmalig)
./scripts/download-wakeword-models.sh

# 2) Gesamtsystem über Aspire starten
dotnet run --project src/AppHost
```

Optional Frontend separat starten (z. B. für isolierte Web-Entwicklung):

```bash
cd src/Web
npm install
npm start
```

### Einstiegspunkte

- `src/AppHost/AppHost.cs`: zentraler Startpunkt für die verteilte Anwendung
- `src/ApiService/Program.cs`: API-Startpunkt
- `src/TtsService/main.py`: FastAPI-Startpunkt für TTS
- `src/Web/src/main.ts`: Angular-Startpunkt

## Skripte & Kommandos

### Root-Skripte

- `./scripts/download-wakeword-models.sh` – lädt openWakeWord-Modelle und ORT-WASM-Dateien

### Web (`src/Web/package.json`)

- `npm run start` – Angular Dev Server (`ng serve`)
- `npm run build` – Build (`ng build`)
- `npm run watch` – Development Build im Watch-Modus
- `npm run test` – Unit-Tests (`ng test`)

### TTS lokal (optional)

```bash
cd src/TtsService
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

## Umgebungsvariablen

Bekannte, im Code direkt genutzte Variablen:

| Variable | Standardwert | Verwendung |
|---|---|---|
| `QWEN_TTS_BASE_MODEL` | `Qwen/Qwen3-TTS-12Hz-1.7B-Base` | TTS-Basismodell |
| `QWEN_TTS_DEVICE` | `mps` | Rechenbackend (`mps`/`cuda`/`cpu`/`auto`) |
| `QWEN_TTS_DTYPE` | `bfloat16` | Datentyp für TTS-Inferenz |
| `JAVIS_VOICES_DIR` | `/tmp/javis/voices` | Speicherort für Referenzstimmen |

Hinweis: Die ersten drei Variablen werden im `AppHost` für den TTS-Service gesetzt.

## Tests

- Web: `cd src/Web && npm run test`
- .NET: `TODO` – explizite Testprojekte sind in `src/Javis.slnx` aktuell nicht enthalten.
- Python TTS: `TODO` – kein dedizierter Test-Runner in der Projektdokumentation ausgewiesen.

## Projektstruktur

```text
.
├── scripts/
│   └── download-wakeword-models.sh
└── src/
    ├── Javis.slnx
    ├── AppHost/            # Aspire-Orchestrator (net10.0)
    ├── ApiService/         # ASP.NET Core API (net10.0)
    ├── ServiceDefaults/    # Shared Aspire Defaults
    ├── TtsService/         # Python/FastAPI TTS-Service
    └── Web/                # Angular-Frontend
```

## Lizenz

- `TODO`: Lizenzdatei (`LICENSE`) im Repository prüfen/ergänzen.
- In einer älteren README-Fassung ist `MIT` angegeben; bitte gegen eine reale Lizenzdatei verifizieren.
