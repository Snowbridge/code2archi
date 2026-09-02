# Code to Archimate Modeler (`code2archi` / `c2a`)

CLI tool that scans microservice web application source code, discovers components and their relationships, and produces an **AS-IS ArchiMate model** grounded in facts from the codebase.

The model is meant to be opened in [Archi](https://www.archimatetool.com/) (ArchiMate 5.x, plain `.archimate` XML) and used for onboarding, architecture governance, and keeping documentation aligned with what is actually shipped.

## Why this exists

Enterprise landscapes spread facts across hundreds of repositories: modules, build files, REST endpoints, declared contracts, and runtime versions. Manual reverse-engineering takes weeks or months and goes stale before the next release.

`code2archi` turns that work into a **repeatable modelling pipeline**:

```text
scan  →  generate  →  reconcile   (reconcile — planned)
```

Each stage is a separate CLI command. Stages communicate only through **artifacts on disk** (discovery-model JSON, then `.archimate`), so the workflow is reproducible in a terminal or CI without ad-hoc scripts.

**Target sources:** Java, Kotlin, JavaScript, TypeScript; Maven, Gradle, npm.

**Target ArchiMate coverage (product intent):**

| Layer | Intent |
| ----- | ------ |
| Application | Full AS-IS mapping of components, services, and contracts |
| Technology | Full stack and infrastructure inventory from code and build artifacts |
| Business | Inventory of automated business processes and their links when Camunda/BPMN is present in sources |

Product intent and capabilities live in [`documentation/product-intent/`](../documentation/product-intent/). CLI contracts and processor specs — in [`documentation/specifications/`](../documentation/specifications/).

## Requirements

- **Node.js 24+**
- npm

## Install and build

```bash
cd application
npm install
npm run build
```

Run tests (optional):

```bash
npm test
```

### Run without global install

From the `application/` directory:

```bash
# production build
npm start -- <command> [options]

# development (TypeScript via tsx)
npm run dev -- <command> [options]
```

After `npm run build`, you can also link the CLI globally:

```bash
npm link
code2archi --help
# or
c2a --help
```

## Quick start

Scan one or more source trees (monorepo roots, folders with git repos, or a plain directory):

```bash
c2a scan /path/to/landscape
```

This writes a **discovery-model** directory, by default `code2archi-scan-<timestamp>` in the current working directory.

Generate an ArchiMate model from the latest scan in cwd:

```bash
c2a generate landscape.archimate
```

Or point explicitly at a discovery-model folder:

```bash
c2a generate landscape.archimate ./code2archi-scan-2026-09-02T12-26-47.8580+0300
```

Open `landscape.archimate` in Archi: **File → Open Model**.

### Useful global options

| Option | Description |
| ------ | ----------- |
| `-L, --log-level` | `INFO` (default) or `DEBUG` |
| `-V, --verbose` | Mirror TSV log to stderr |
| `--profile` | Write JSON timing report to cwd |
| `--threads` / `--sync` | Parallel or single-threaded processor execution |
| `--with` / `--without` / `--with-only` | Filter built-in processors by coordinate |

Examples:

```bash
c2a scan --verbose --profile /path/to/repos
c2a generate out.archimate --no-decorate
c2a scan --with-only scan.scope.git-repos /path
```

Full CLI contract: [`documentation/specifications/cli/`](../documentation/specifications/cli/).

## What works today

### Commands

| Command | Status |
| ------- | ------ |
| `scan` | Implemented |
| `generate` | Implemented |
| `reconcile` | Specified, **not implemented** |
| `config` | Specified, **not implemented** |

### `scan` — discovery-model

Built-in processors discover:

- **Repositories** — git working copies and unversioned folder roots (`scan.scope`)
- **Application modules** — Maven, Gradle, and npm (including workspaces) with inter-module dependencies (`scan.source.assembly`)
- **REST controllers (Java/Kotlin)** — annotation-based and functional routing:
  - Spring Web / WebFlux (MVC annotations, `RouterFunction` / `CoRouterFunction`)
  - JAX-RS (Quarkus)
  - Micronaut (`@Controller`, `RouteBuilder`)
  - Quarkus Vert.x / reactive routes
  - Ktor routing

Output is a directory of JSON files (`manifest.json`, `repositories.json`, `application-modules.json`, `rest-controllers.json`, …) validated against JSON Schema in the specifications repo.

### `generate` — ArchiMate model

From discovery-model, built-in processors currently materialise these **element slots** (see [generated-element-slots](../documentation/specifications/archimate-model/generated-element-slots.md)):

**Technology layer**

- Source repository artifacts
- Module artifacts (Maven / Gradle / npm)
- System software catalog (runtime, build tool, compiler versions) and assignments to modules
- Composition: repository → module

**Application layer**

- Application components per module (including library aggregation edges)
- REST controller application services
- Declared API contracts (from implemented interface FQCN)
- Inferred API contracts (from endpoints and DTO types)

The result is a plain XML `.archimate` file compatible with Archi 5.x.

### Platform mechanics (in all commands)

- Structured file logging and optional stderr mirror
- Optional profiling (`code2archi-profile-<command>-<timestamp>.json`)
- Worker-thread parallelism with processor registry and CLI filters
- Idempotent element generation with stable `c2a:Id` custom properties

## Gap vs product intent

The README above describes the **current slice** of the vision. The table below summarises what is planned but not yet delivered.

| Area | Product intent | Current state |
| ---- | -------------- | ------------- |
| **Modelling pipeline** | `scan → match → generate → reconcile` as a complete workflow | `scan` and `generate` work; `reconcile` command missing |
| **Reconciliation** | Compare code, ArchiMate model, and declared contracts (OpenAPI, schemas); surface gaps explicitly | Not implemented (capability: [reconciliation](../documentation/product-intent/capability/reconciliation.md)) |
| **Business layer** | Camunda / BPMN process inventory and links | Not implemented (capability: [business-process-inventory](../documentation/product-intent/capability/business-process-inventory.md)) |
| **Inter-service links** | HTTP clients, message producers/consumers, cross-service dependencies in the model | Entity types (`RestClient`, `MessageConsumer`, `MessageProducer`) are reserved; no scan/generate processors yet |
| **JavaScript / TypeScript** | Source-level discovery alongside JVM languages | npm **module assembly** only; no JS/TS REST or application parsing |
| **Technology inventory** | Broad runtime, framework, and infra-pattern coverage (databases, messaging, deployment) | Limited to repo/module structure and versions from build files |
| **Diagrams** | `generate.views` — layout diagrams in Archi | Processor group exists; **no view processors** registered |
| **Plugins** | Extend scan/generate without forking core | Processor registry is internal; **plugin host API not shipped** |
| **Run configuration** | `config` command, merged CLI + file defaults | Not implemented |
| **Model refresh at scale** | Repeatable refresh every release cycle in hours | Mechanically possible via re-run; automation, diff, and reconcile reporting still missing |

In practice today, `c2a` gives a solid **first-pass AS-IS map** of repositories, modules, build/runtime facts, and Java/Kotlin REST surface — enough to open in Archi and review structure. It does **not** yet replace architecture governance (reconcile), business process mapping (Camunda), or full cross-service dependency analysis.

## Project layout

| Path | Role |
| ---- | ---- |
| `src/` | CLI, scan/generate flows, parsers, built-in processors |
| `test/` | Node test runner suites |
| `dist/` | Compiled output (`npm run build`) |

Specifications and product intent are maintained in sibling workspace folders (`documentation/`, `ADR/`, `playbook/`, `glossary/`), not inside this git repository.

## Development

```bash
npm run build    # compile TypeScript → dist/
npm test         # run tests
npm run dev -- scan --help
```

When changing behaviour, follow **spec-first**: update [`documentation/specifications/`](../documentation/specifications/) before or together with code changes.
