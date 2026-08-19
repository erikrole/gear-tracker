# Guide Markdown contract

Guides (the Resources area) are authored once and read on two clients. This
document is the contract both readers implement. Change it before changing
either renderer.

## The standard

Guide content is **CommonMark + GFM**. Neither client owns a dialect.

| Surface | Parser | Engine |
| --- | --- | --- |
| Web reader | `remark-gfm` via `react-markdown` | cmark-gfm semantics |
| iOS reader | [`apple/swift-markdown`](https://github.com/apple/swift-markdown) | cmark-gfm |
| Editor | MDXEditor (`@mdxeditor/editor`) | serializes CommonMark + GFM |

Because both readers sit on the same spec, anything CommonMark or GFM defines —
reference links, nested lists, escapes, tables, task lists, strikethrough — works
on both without either side special-casing it.

Source of truth for each half:

- Web: `src/components/resources/MarkdownReader.tsx`
- iOS: `ios/Wisconsin/Views/GuideMarkdown.swift` (parse) and
  `ios/Wisconsin/Views/GuidesView.swift` (render)
- iOS contract tests: `ios/WisconsinTests/GuideMarkdownTests.swift`

## House conventions

Two things ride on top of the spec. They are conventions, not syntax
extensions — both are plain CommonMark that each reader gives extra meaning.

### 1. Callouts (GitHub alerts)

A blockquote whose first line is an alert marker.

```markdown
> [!WARNING]
> Do not unplug the drive mid-transfer.
```

Kinds: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION` (case-insensitive). The
marker is stripped and the quote is rendered as a tone-matched card.

| Kind | Tone |
| --- | --- |
| note | blue |
| tip | green |
| important | purple |
| warning | orange |
| caution | red |

Implemented by `src/lib/remark-callouts.ts` and `GuideMarkdown.calloutMarker`.
A blockquote with no marker stays a plain quote.

### 2. Video embeds

A fenced block tagged `embed` or `video` whose body is a URL.

````markdown
```embed
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```
````

Web frames a validated player URL (YouTube or Vimeo only — the raw string is
never passed to an `<iframe>`). iOS cannot frame a provider player, so it renders
a card that opens the URL. A body that is not a usable URL falls back to a normal
code block on both clients.

Implemented by `src/lib/media-embed.ts` and `GuideMarkdown.parseEmbed`.

## Rules both readers follow

**Raw HTML is dropped.** Web passes `skipHtml`; iOS discards `HTMLBlock` and
`InlineHTML`. Do not author HTML in a guide — it will not render anywhere.

**Images.** Uploads go through `/api/resources/upload-image` and come back as
absolute Vercel Blob URLs, which is the normal case. Hand-authored destinations
also work, including root-relative ones (`/uploads/rig.png`), which iOS resolves
against the active API origin. Alt text is shown as a visible caption on both
clients, so write it as a caption. A destination containing a space must be
wrapped in angle brackets (`![Rig](<https://…/a b.png>)`) or percent-encoded —
CommonMark ends a bare destination at the first space.

**Link schemes.** `http`, `https`, `mailto`, and `tel` are permitted; anything
else (`javascript:`, `data:`, `file:`) is refused rather than handed to the
system opener. Image destinations are narrower still: `http`/`https` only,
because they feed a network image loader.

**Tables** are GFM tables, including column alignment (`:--`, `:-:`, `--:`). The
delimiter row is consumed for alignment and never rendered. Escape a literal pipe
inside a cell as `\|`.

**Headings** are ATX (`## Section`) and need the space after the hashes. The web
TOC indexes levels 1–3.

## Adding a feature

1. Update this document.
2. Update both readers.
3. Add a case to `GuideMarkdownTests.swift` and to the web reader's tests.

If a feature cannot be expressed in CommonMark + GFM, prefer a convention layered
on valid Markdown (as callouts and embeds are) over a syntax extension — an
extension would put the two parsers back out of step.
