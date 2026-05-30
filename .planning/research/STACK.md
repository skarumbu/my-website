# Technology Stack

**Project:** Posts & Writing System — stack additions for markdown writing + publishing
**Researched:** 2026-05-30
**Confidence:** HIGH (all versions verified via npm registry and official Microsoft docs)

---

## Context: What Already Exists

The existing app is React 18.2 + TypeScript + CRA (react-scripts 5.0.1), deployed on Azure Static Web Apps. Auth via MSAL. Backend via Azure Functions. The additions below are additive — no build system changes, no new auth system, no framework swap.

---

## Recommended Stack Additions

### Markdown Editor (Write Page — `/write`)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@uiw/react-md-editor` | 4.1.1 | Split-pane markdown editor with live preview | Best fit for notebook feel: textarea-based (no CodeMirror/Monaco overhead), built-in `preview="live"` split pane, TypeScript-native, MIT. 4.6 kB gzipped. Actively maintained (215 npm versions, Dec 2024 release). Controlled component via `value`/`onChange` — integrates cleanly with React state. |

**Why not the alternatives:**
- `md-editor-rt` — More features (Mermaid, LaTeX), but overkill for prose writing. Adds unnecessary complexity.
- `react-markdown-editor-lite` — Split-pane editor but uses CodeMirror under the hood, heavier bundle, less active maintenance.
- Monaco Editor — VS Code editor; massive bundle (~2 MB), designed for code, wrong feel for prose.
- TipTap / ProseMirror — Rich text (WYSIWYG), not markdown source; diverges from the markdown-as-storage model.

**Usage pattern:**
```tsx
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";

<MDEditor
  value={content}
  onChange={(val) => setContent(val ?? "")}
  preview="live"
  height={600}
  data-color-mode="light"
/>
```

---

### Markdown Renderer (Public Read Pages — `/posts`, `/posts/:slug`)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-markdown` | 10.1.0 | Render stored markdown to React elements | The unified ecosystem standard. Plugin-based via remark/rehype. No `dangerouslySetInnerHTML`. XSS-safe by default. 11 well-maintained dependencies, all unified ecosystem. TypeScript types included. |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks) | Required for prose documents — design docs and project write-ups will use tables and task lists. |
| `rehype-highlight` | 7.0.2 | Syntax highlighting for fenced code blocks | Uses lowlight (highlight.js), bundles 37 languages by default, ~5 kB gzipped additional. Simpler than rehype-pretty-code for this use case. |
| `rehype-slug` | 6.0.0 | Adds `id` attributes to headings | Enables in-page anchor links in longer posts. Zero config. |

**Why `rehype-highlight` over `rehype-pretty-code`:**
rehype-pretty-code is the better choice for a Next.js/build-time context (Shiki, VS Code themes). For a CRA SPA doing client-side rendering, rehype-highlight's highlight.js approach is simpler, lighter, and requires no special CSS import beyond a single highlight.js theme stylesheet. rehype-pretty-code v0.14.3 is unstyled by design and requires additional transformer setup that adds complexity without payoff here.

**Usage pattern:**
```tsx
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import "highlight.js/styles/github.css";

<Markdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight, rehypeSlug]}
>
  {post.content}
</Markdown>
```

---

### Frontmatter Parsing (Azure Functions — Node.js)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `gray-matter` | 4.0.3 | Parse YAML frontmatter from markdown blobs | The standard Node.js frontmatter parser. Zero dependencies. Works on raw strings (perfect for blobs downloaded from Azure Storage). Returns `{ data, content }` — frontmatter metadata in `data`, markdown body in `content`. Used by Gatsby, Jekyll, Hugo tooling. |

**Frontmatter schema (stored at top of each `.md` blob):**
```yaml
---
title: "My Post Title"
slug: "my-post-title"
publishedAt: "2026-05-30T10:00:00Z"
published: true
excerpt: "Optional short description"
---
```

**Why not JSON files or a database:** Matches the project decision — one blob per post, markdown with frontmatter. Gray-matter reads the blob string directly, no file system access needed.

---

### Azure Blob Storage SDK (Azure Functions — Node.js)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@azure/storage-blob` | 12.31.0 | Read/write post blobs from Azure Functions | Official Microsoft SDK, v12 is the current stable line (verified against Microsoft Docs updated 2026-02-10). `BlobServiceClient` → `ContainerClient` → `BlockBlobClient` hierarchy maps directly to the single container + one-blob-per-post pattern. Supports `async`/`await` throughout. Available in Azure Functions Node.js runtime. |
| `@azure/identity` | 4.13.1 | Managed identity auth for Blob Storage | Use `DefaultAzureCredential` instead of connection strings. In Azure Functions with a system-assigned managed identity, this resolves automatically to the Function's identity — no secrets in environment variables for auth. `StorageSharedKeyCredential` (connection string) is the local development fallback. |

**Authentication pattern:**

*Production (managed identity — no secret rotation, least privilege):*
```typescript
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

const blobServiceClient = new BlobServiceClient(
  `https://${process.env.STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  new DefaultAzureCredential()
);
```

*Local dev (connection string from `local.settings.json`):*
```typescript
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!
);
```

**Why managed identity over connection strings:** Microsoft's stated best practice for Azure Functions. Connection strings require manual key rotation and create a security surface if the key leaks. Managed identity uses Azure RBAC — assign "Storage Blob Data Contributor" to the Function's identity in IAM, no credential management needed.

---

### Slug Generation (Azure Functions — Node.js)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `slugify` | 1.6.9 | Generate URL-safe slug from post title | Zero dependencies, widely used. Converts "My Post Title" → `my-post-title`. The slug becomes the blob name and the URL segment. Handles Unicode, diacritics, special characters. |

**Why not `nanoid` for slugs:** nanoid generates random IDs (good for session tokens, not for human-readable URLs). The slug must be derived from the title so `/posts/my-post-title` is predictable and stable.

---

## Complete Installation

```bash
# React app (frontend)
npm install @uiw/react-md-editor react-markdown remark-gfm rehype-highlight rehype-slug

# Azure Functions (backend — run inside the functions project directory)
npm install @azure/storage-blob @azure/identity gray-matter slugify
```

---

## What NOT to Install

| Library | Why to Avoid |
|---------|-------------|
| `@mdx-js/react` / MDX | Adds a compilation step incompatible with CRA without ejecting. Overkill for stored markdown rendering. |
| `marked` | Lower-level than react-markdown; requires manual XSS sanitization; no React component model. |
| `monaco-editor` | ~2 MB bundle for a code editor, wrong UX for prose writing. |
| `TipTap` / `Quill` / `Slate` | WYSIWYG editors output HTML, not markdown. Diverges from the markdown-as-source storage model. |
| `next-mdx-remote` | Next.js specific. Not applicable to CRA. |
| `@azure/storage-queue` | Not needed — no queuing pattern in this system. |
| `cosmosdb` / any database SDK | Project decision: Blob Storage only, no database. |

---

## Environment Variables Required

**React app (`REACT_APP_` prefix — baked at build time):**
```
REACT_APP_POSTS_API_BASE_URL=https://<function-app>.azurewebsites.net/api
```

**Azure Functions (`local.settings.json` / App Settings):**
```
AZURE_STORAGE_CONNECTION_STRING=<for local dev only>
STORAGE_ACCOUNT_NAME=<storage account name, for managed identity in prod>
STORAGE_CONTAINER_NAME=posts
```

---

## Dependency Compatibility Notes

- `@uiw/react-md-editor@4.x` requires React 18+ — matches existing `react@18.2.0`. HIGH confidence.
- `react-markdown@10.x` requires React 16.8+ — compatible. HIGH confidence.
- `gray-matter@4.x` is pure Node.js, no React dependency. Works in Azure Functions Node.js 18/20. HIGH confidence.
- `@azure/storage-blob@12.x` — officially supported on LTS Node.js. Functions v4 runtime runs on Node.js 18/20. HIGH confidence.
- CRA (`react-scripts@5.0.1`) can import `@uiw/react-md-editor` without ejecting. The CSS import (`markdown-editor.css`) is handled by CRA's webpack config as-is. Confirmed by library docs. HIGH confidence.

---

## Sources

- [@azure/storage-blob official docs — learn.microsoft.com, updated 2026-02-10](https://learn.microsoft.com/en-us/javascript/api/overview/azure/storage-blob-readme?view=azure-node-latest)
- [Managed identity for Azure Functions + Blob Storage — Microsoft Tech Community](https://techcommunity.microsoft.com/blog/appsonazureblog/use-managed-identity-instead-of-azurewebjobsstorage-to-connect-a-function-app-to/3657606)
- [@uiw/react-md-editor — Context7 verified docs (context7.com/uiwjs/react-md-editor)](https://context7.com/uiwjs/react-md-editor/llms.txt)
- [react-markdown — Context7 verified docs (context7.com/remarkjs/react-markdown)](https://context7.com/remarkjs/react-markdown/llms.txt)
- [gray-matter — Context7 verified docs (context7.com/jonschlinkert/gray-matter)](https://context7.com/jonschlinkert/gray-matter/llms.txt)
- [rehype-highlight GitHub — rehypejs/rehype-highlight](https://github.com/rehypejs/rehype-highlight)
- [npm registry versions verified: @uiw/react-md-editor@4.1.1, react-markdown@10.1.0, gray-matter@4.0.3, @azure/storage-blob@12.31.0, @azure/identity@4.13.1, remark-gfm@4.0.1, rehype-highlight@7.0.2, rehype-slug@6.0.0, slugify@1.6.9]
