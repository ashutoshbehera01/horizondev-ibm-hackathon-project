# ARCH_SPECS.md — CodeMap AI Frontend Architecture Specification

> **Scope:** This document governs how the `codemap-ui` Next.js 16 / React 19 /
> TypeScript frontend should fetch, model, cache, and render the parsed folder
> dependency layout produced by the `main.py` FastAPI backend.
>
> **Backend base URL (local dev):** `http://127.0.0.1:8000`
> **Primary endpoint:** `POST /api/analyze-structure`

---

## Table of Contents

1. [Backend Contract](#1-backend-contract)
2. [Architecture Review Findings](#2-architecture-review-findings)
3. [TypeScript Data Models](#3-typescript-data-models)
4. [Fetching Strategy](#4-fetching-strategy)
5. [Rendering Architecture](#5-rendering-architecture)
6. [Component Tree](#6-component-tree)
7. [State Management](#7-state-management)
8. [Error & Loading States](#8-error--loading-states)
9. [File Structure](#9-file-structure)
10. [Edge-Case Handling on the UI Side](#10-edge-case-handling-on-the-ui-side)
11. [Future Enhancements](#11-future-enhancements)

---

## 1. Backend Contract

### Request

```http
POST /api/analyze-structure
Content-Type: application/json

{
  "path": "/absolute/or/relative/path/to/target/repo"
}
```

### Response (success — HTTP 200)

```jsonc
{
  "directory_tree": {
    "root": ["main.py", "generator.py"],
    "codemap-ui/src/app": ["page.tsx", "layout.tsx"]
    // key = relative folder path (or "root" for the top level)
    // value = array of source file names inside that folder
    // NOTE: folders with zero .py/.js/.ts/.jsx/.tsx files are OMITTED
  },
  "dependencies": [
    {
      "source": "main.py",
      "target": "os",
      "type": "import"           // top-level `import X`
    },
    {
      "source": "main.py",
      "target": "fastapi",
      "type": "from_import"      // top-level `from X import Y`
    }
    // NOTE: only Python files; only top-level import statements
  ]
}
```

### Error Response (HTTP 400)

```json
{ "detail": "Provided directory path does not exist." }
```

---

## 2. Architecture Review Findings

The following issues were identified during the autonomous review pass of
`main.py` and `generator.py`. The frontend specification accounts for each.

### 2.1 `main.py` — `os.walk` edge cases

| # | Issue | Severity | Frontend mitigation |
|---|-------|----------|---------------------|
| 1 | **Substring-based ignore filter** — `"env" in root` will silently prune folders whose *path* contains the substring (e.g. `my_env_vars/`). Affected directories never appear in the response. | Medium | UI must not assume every subfolder is present; treat `directory_tree` as a sparse map. |
| 2 | **Shallow AST walk** — only `node.body` is scanned, so imports inside functions, `if __name__` blocks, or `try` blocks are invisible. | Medium | Dependency graph must be presented as "partial / top-level only" with a visible disclaimer. |
| 3 | **`"root"` alias** — the top-level directory is keyed as the string `"root"`, not the actual path. | Low | Normalise on the client: treat a key of `"root"` as display label `"/"` (repo root). |
| 4 | **Empty-directory omission** — intentional but undocumented. | Low | Do not infer missing directories from file paths; render only what the backend returns. |
| 5 | **Symlink loops** — `followlinks` defaults to `False` so currently safe, but symlinked source trees will silently disappear. | Low | Show a UI hint when a submitted path is suspected to contain symlinks (future). |

### 2.2 `generator.py` — onboarding pipeline

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | **No return value distinction** — `None` is returned on both success and `[Error]` paths. | Medium | If the pipeline is ever exposed as an API route, the frontend must not rely on a `200` body alone; check for an explicit `success` field. |
| 2 | **No JSON schema validation** — `sample_repo_structure.json` is loaded and iterated without structure checks. | Medium | Validate the backend payload with Zod on the frontend before rendering (see §3). |
| 3 | **Filesystem side-effect** — writes `.env.example` unconditionally. | Low | No frontend action needed; document that re-running the pipeline is idempotent only for the `.env.example` file. |

---

## 3. TypeScript Data Models

Create [`codemap-ui/src/types/api.ts`](codemap-ui/src/types/api.ts):

```typescript
// Raw shapes returned by the backend
export interface AnalyzeResponse {
  directory_tree: Record<string, string[]>;
  dependencies: Dependency[];
}

export interface Dependency {
  source: string;
  target: string;
  type: "import" | "from_import";
}

// Normalised shapes used by the UI layer
export interface FolderNode {
  /** Display label — "root" becomes "/" */
  label: string;
  /** Raw key from the API */
  rawKey: string;
  files: string[];
  /** Depth derived from path segments */
  depth: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  kind: "import" | "from_import";
}

export interface CodemapState {
  folderNodes: FolderNode[];
  edges: DependencyEdge[];
  /** Folders that appear as path prefixes in edges but not in directory_tree */
  impliedFolders: string[];
}
```

### Zod validation schema

Install: `npm install zod`

Create [`codemap-ui/src/lib/schema.ts`](codemap-ui/src/lib/schema.ts):

```typescript
import { z } from "zod";

export const DependencySchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(["import", "from_import"]),
});

export const AnalyzeResponseSchema = z.object({
  directory_tree: z.record(z.string(), z.array(z.string())),
  dependencies: z.array(DependencySchema),
});
```

---

## 4. Fetching Strategy

### 4.1 Next.js Server Action (recommended)

Use a **Server Action** so the backend URL never leaks to the browser and
network errors surface server-side with structured logging.

Create [`codemap-ui/src/app/actions/analyze.ts`](codemap-ui/src/app/actions/analyze.ts):

```typescript
"use server";

import { AnalyzeResponseSchema } from "@/lib/schema";
import type { AnalyzeResponse } from "@/types/api";

const BACKEND_URL =
  process.env.CODEMAP_BACKEND_URL ?? "http://127.0.0.1:8000";

export async function analyzeRepo(
  repoPath: string
): Promise<{ data: AnalyzeResponse } | { error: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/analyze-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: repoPath }),
      // Do not cache: analysis results must be fresh on every submission
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: (body as { detail?: string }).detail ?? `HTTP ${res.status}` };
    }

    const raw = await res.json();
    const parsed = AnalyzeResponseSchema.safeParse(raw);

    if (!parsed.success) {
      return { error: "Unexpected response shape from backend." };
    }

    return { data: parsed.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error." };
  }
}
```

### 4.2 Environment variable

Add to [`codemap-ui/.env.local`](codemap-ui/.env.local):

```
CODEMAP_BACKEND_URL=http://127.0.0.1:8000
```

> `CODEMAP_BACKEND_URL` is a **server-only** variable (no `NEXT_PUBLIC_` prefix).
> The CORS middleware in `main.py` (`allow_origins=["*"]`) is therefore only
> needed if a future client-side fetch is added — Server Actions bypass CORS.

---

## 5. Rendering Architecture

The UI has three logical views driven by a single piece of derived state:

```
AnalyzeResponse
      │
      ▼
normalise()          ← pure transform, no I/O
      │
      ▼
CodemapState
 ├─ folderNodes  →  <DirectoryTree />    (left panel)
 ├─ edges        →  <DependencyGraph />  (right panel / modal)
 └─ impliedFolders → <ImpliedWarning />  (inline banner)
```

### 5.1 Data normalisation

Create [`codemap-ui/src/lib/normalise.ts`](codemap-ui/src/lib/normalise.ts):

```typescript
import type { AnalyzeResponse, CodemapState, FolderNode } from "@/types/api";

export function normalise(raw: AnalyzeResponse): CodemapState {
  const folderNodes: FolderNode[] = Object.entries(raw.directory_tree).map(
    ([rawKey, files]) => ({
      rawKey,
      label: rawKey === "root" ? "/" : rawKey,
      files,
      depth: rawKey === "root" ? 0 : rawKey.split(/[\\/]/).length,
    })
  );

  const knownFolderKeys = new Set(Object.keys(raw.directory_tree));

  // Detect source files referenced in edges whose parent folder was pruned
  const impliedFolders = Array.from(
    new Set(
      raw.dependencies
        .map((d) => d.source.split(/[\\/]/).slice(0, -1).join("/"))
        .filter((dir) => dir && !knownFolderKeys.has(dir))
    )
  );

  const edges = raw.dependencies.map((d) => ({
    source: d.source,
    target: d.target,
    kind: d.type,
  }));

  return { folderNodes, edges, impliedFolders };
}
```

---

## 6. Component Tree

```
src/app/
├── page.tsx                  ← server component; hosts <RepoForm> + <CodemapView>
├── actions/
│   └── analyze.ts            ← server action
├── components/
│   ├── RepoForm.tsx           ← "use client"; path input + submit
│   ├── CodemapView.tsx        ← "use client"; orchestrates panels
│   ├── DirectoryTree.tsx      ← pure; renders folderNodes as collapsible tree
│   ├── DependencyGraph.tsx    ← pure; renders edges as SVG force graph or table
│   ├── FileChip.tsx           ← pure; coloured badge per extension
│   ├── ImpliedWarning.tsx     ← pure; banner when impliedFolders.length > 0
│   └── DepthDisclaimer.tsx    ← pure; "top-level imports only" notice
└── lib/
    ├── schema.ts
    └── normalise.ts
```

### 6.1 `RepoForm` — client component

```typescript
// src/app/components/RepoForm.tsx
"use client";
import { useState, useTransition } from "react";
import { analyzeRepo } from "@/app/actions/analyze";
import type { AnalyzeResponse } from "@/types/api";

interface Props {
  onResult: (data: AnalyzeResponse) => void;
  onError: (msg: string) => void;
}

export function RepoForm({ onResult, onError }: Props) {
  const [path, setPath] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await analyzeRepo(path.trim());
      if ("error" in result) onError(result.error);
      else onResult(result.data);
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className="flex-1 border rounded px-3 py-2 font-mono text-sm"
        placeholder="/path/to/repo"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        required
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isPending ? "Scanning…" : "Analyse"}
      </button>
    </form>
  );
}
```

### 6.2 `DirectoryTree` — rendering folder nodes

- Sort `folderNodes` ascending by `depth`, then alphabetically by `label`.
- Render each node as a disclosure row (`<details>/<summary>`) with its files
  listed as [`<FileChip>`](codemap-ui/src/app/components/FileChip.tsx) badges.
- Indent by `depth * 1rem`.
- Mark nodes whose `rawKey` appears in `impliedFolders` with a yellow ⚠ icon.

### 6.3 `DependencyGraph` — rendering edges

For the initial release a **sortable table** is sufficient and requires no
additional dependencies:

| Source file | → | Target module | Type |
|-------------|---|---------------|------|
| `main.py`   | → | `fastapi`     | `from_import` |

Upgrade path: replace the table body with a **D3.js force-directed graph** or
**React Flow** canvas once the dependency count warrants it.

- Group edges by `source` for a collapsed accordion view.
- Highlight stdlib modules (e.g. `os`, `ast`, `json`) differently from
  third-party modules.
- Add a toggle between "all edges" and "project-internal edges only"
  (filter out targets that are not also `source` values in the same response).

---

## 7. State Management

No global store is needed at the current scale. Use React `useState` in
`CodemapView`:

```typescript
// src/app/components/CodemapView.tsx
"use client";
import { useState } from "react";
import type { AnalyzeResponse } from "@/types/api";
import { normalise } from "@/lib/normalise";
import { RepoForm } from "./RepoForm";
import { DirectoryTree } from "./DirectoryTree";
import { DependencyGraph } from "./DependencyGraph";
import { ImpliedWarning } from "./ImpliedWarning";
import { DepthDisclaimer } from "./DepthDisclaimer";

export function CodemapView() {
  const [state, setState] = useState<ReturnType<typeof normalise> | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 p-8">
      <RepoForm
        onResult={(data: AnalyzeResponse) => { setState(normalise(data)); setError(null); }}
        onError={(msg) => { setError(msg); setState(null); }}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {state && (
        <>
          <DepthDisclaimer />
          {state.impliedFolders.length > 0 && (
            <ImpliedWarning folders={state.impliedFolders} />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DirectoryTree nodes={state.folderNodes} />
            <DependencyGraph edges={state.edges} />
          </div>
        </>
      )}
    </div>
  );
}
```

Upgrade to **Zustand** or React Context only when cross-route state sharing or
persistent history is required.

---

## 8. Error & Loading States

| Scenario | Backend signal | UI behaviour |
|----------|---------------|--------------|
| Path does not exist | HTTP 400 `{ "detail": "…" }` | Inline red error below the form |
| Network unreachable | `fetch` throws | Generic "Could not reach the analysis engine" message |
| Malformed response | Zod parse fails | "Unexpected response shape" with a "Copy raw JSON" debug button |
| Empty result | `directory_tree: {}` | Empty-state illustration: "No source files found in that path" |
| Large repo (slow) | Long TTFB | `useTransition` keeps the form interactive; spinner on the button |

---

## 9. File Structure

Final target layout for `codemap-ui/src`:

```
src/
├── app/
│   ├── actions/
│   │   └── analyze.ts
│   ├── components/
│   │   ├── CodemapView.tsx
│   │   ├── DependencyGraph.tsx
│   │   ├── DepthDisclaimer.tsx
│   │   ├── DirectoryTree.tsx
│   │   ├── FileChip.tsx
│   │   ├── ImpliedWarning.tsx
│   │   └── RepoForm.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── normalise.ts
│   └── schema.ts
└── types/
    └── api.ts
```

---

## 10. Edge-Case Handling on the UI Side

These directly mirror the backend findings from §2:

1. **Sparse `directory_tree`** — never reconstruct missing paths from edge
   source filenames; render only what the backend explicitly returns.

2. **`"root"` key** — normalise to `"/"` in [`normalise.ts`](codemap-ui/src/lib/normalise.ts)
   before any component sees the data.

3. **Shallow dependency graph** — surface [`<DepthDisclaimer>`](codemap-ui/src/app/components/DepthDisclaimer.tsx)
   at the top of the dependency panel with text:
   > _"Dependency edges reflect top-level import statements only. Conditional
   > and function-scoped imports are not included."_

4. **Implied/pruned folders** — compute `impliedFolders` in `normalise()` and
   display [`<ImpliedWarning>`](codemap-ui/src/app/components/ImpliedWarning.tsx)
   listing each omitted folder so developers know the graph is incomplete.

5. **Substring-pruned directories** — no reliable frontend detection is
   possible. Document the limitation in the UI tooltip on the `⚠` icon.

6. **Empty `dependencies` array** — render a "No Python import relationships
   detected" notice inside `<DependencyGraph>` rather than an empty panel.

---

## 11. Future Enhancements

| Priority | Enhancement | Notes |
|----------|-------------|-------|
| High | **TypeScript/JS import parsing** | `main.py` currently only parses Python. Expose a second pass (e.g. using `@babel/parser`) or add a `/api/analyze-ts-imports` endpoint. |
| High | **Full AST walk** | Fix the shallow-body-only AST scan in `main.py` to catch function-scoped and conditional imports, removing the need for `<DepthDisclaimer>`. |
| Medium | **`dirs[:]` mutation for pruning** | Replace the substring `in root` filter with in-place `dirs` mutation so folder names like `my_env_vars` are not incorrectly pruned. |
| Medium | **Streaming response** | For large repos, switch to `StreamingResponse` + `EventSource` on the frontend to show folder nodes as they arrive. |
| Medium | **D3 / React Flow graph** | Upgrade `<DependencyGraph>` to an interactive force-directed canvas for large dependency counts. |
| Low | **History / bookmarks** | Persist recent `repoPath` submissions in `localStorage`; show a dropdown of recents in `<RepoForm>`. |
| Low | **Export** | Add a "Download JSON" button that serialises `CodemapState` for offline sharing. |

---

*Generated by the CodeMap AI autonomous architecture review pass.*
