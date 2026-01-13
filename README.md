<div align="center">

<img src="apps/docs/public/logo.png" alt="Thalo logo" width="200">

### Thalo: _Thought And Lore Language_

**A structured plain-text format for personal knowledge.**<br> **Human-readable. Version-controlled.
Built for AI collaboration.**

<br>

[Documentation](https://thalo.rejot.dev/docs) · [Playground](https://thalo.rejot.dev/playground) ·
[Demo](https://thalo.rejot.dev/demo) · [Discord](https://discord.gg/jdXZxyGCnC)

</div>

---

Thalo is a plain-text format that gives your knowledge _just enough_ structure for tools and AI to
work with it, while staying readable and editable by humans. Just text files in git, editable in
Cursor or by Claude Code.

```shell
2026-01-08T14:30Z create book-review "Designing Data-Intensive Applications" ^ddia #engineering #books
  rating: "5"
  author: "Martin Kleppmann"

  # Summary
  The definitive guide to distributed systems and data architecture. Dense but essential.

  # Key Takeaways
  - Replication, partitioning, and consistency are the three pillars of distributed data.
  - "Exactly-once" delivery is a lie—design for idempotency instead.
  - Understanding failure modes matters more than preventing them.
```

## Thalo provides a feedback loop for agents/LLMs

LLMs can easily extract structured information from unstructured text, but they need a feedback loop
to make the data of high quality.

The Thalo CLI provides this by validating the schema of entries (e.g. `rating` in the example above)
and by checking references and links.

We have some [30 rules](https://thalo.rejot.dev/docs/rules) built in that help the agent, but since
the format is completely plain-text, it's easy to script more validations.

## Working with Thalo

It's easy to dump information; it's hard to organize. Even with LLMs. Thalo allows you to define
what your notes should look like: **entities**. They contain metadata with a simple type-system and
sections.

My workflow involves dumping thoughts, then letting the LLM extract the information into the
structured **entry** format. The entities I typically define are:

- **Opinions** - Formed stances on topics
- **Lore** - Facts and insights about subjects or yourself
- **Journals** - Personal thoughts, reflections, and experiences
- **References** - External resources (books, articles, videos)

This is my workflow. Definitions are completely up to the user.

### Advanced Workflow

When we let AI generate text, we end up with slop.

I like to let the AI generate questions based on my blurted thoughts, which I will then answer.
Because Thalo is minimal and extensible, it's easy to define a `question` and `answer` entity. A
simple script then checks if every question has an answer.

Writing down answers is a great way to come up with new thoughts and insights.

## Doing something with your knowledge: Syntheses

Define queries over your knowledge base with prompts for AI:

```thalo
2026-01-08T14:30Z define-synthesis "My Programming Philosophy" ^prog-philosophy #programming
  sources: opinion where #programming, lore where #engineering

  # Prompt
  Synthesize my programming opinions and engineering insights into a coherent philosophy.
  Note any contradictions or evolution in my thinking over time.
  Identify the 3-5 core principles that recur most often.
```

**Scattered thoughts → Structured entries → Queries + LLMs → Synthesized understanding.**

Syntheses are defined in plain text as above, and can be _actualized_ by running `thalo actualize`.

Actualization is intentionally minimal. It runs the user-defined query and prints the _new_ entries
that match the query together with the prompt. This can then be piped to an LLM to do anything, but
generally to create synthesized content.

## Entity Definitions

```shell
2026-01-08T14:30Z define-entity lore "Facts and insights about subjects or yourself"
  # Metadata
  type: "fact" | "insight" ; "fact = verifiable info, insight = learned wisdom"
  subject: string | link ; "Subject name/slug (use ^self for personal lore)"
  date?: date-range ; "Relevant date or date range"

  # Sections
  Description ; "The lore content"
```

There are two main parts to defining an entity:

- **Metadata** - The fields that describe the entity
- **Sections** - The content of the entity

Metadata is guarded by a simple type-system, with types such as `string`, `link`, `datetime`,
`date-range`, and `enum`, plus higher-order types like arrays and unions.

## Syntax recap

```shell
{timestamp} {directive} {entity} "Title" [^id] [#tags...]
  metadata: "value"
  related: ^other-entry

  # Section
  Your content here. Markdown-ish.
```

**Entities** define what types of knowledge you track. Run `thalo init` to start with some sensible
defaults, or define your own.

**Links** (`^clean-code`) are unique identifiers for your entries. **Tags** (`#programming`) enable
filtering.

## Tooling

Thalo is a small ecosystem of tools:

| Tool                    | What It Does                                         |
| ----------------------- | ---------------------------------------------------- |
| **thalo-cli**           | `init`, `check`, `actualize`: the main feedback loop |
| **thalo-lsp**           | Autocomplete, diagnostics, go-to-definition          |
| **thalo-vscode**        | Syntax highlighting + LSP integration                |
| **thalo-prettier**      | Auto-format your `.thalo` files                      |
| **Tree-sitter grammar** | Full parser for building your own tools              |

Thalo CLI uses `git` (if available) to track changes for actualization. It is entirely possible to
write Thalo as code blocks inside of Markdown files, the CLI will work with them just fine.

## Quick Start

_(Thalo is not published yet, so you need to build it yourself for now.)_

```bash
# Clone and build
git clone https://github.com/rejot-dev/thalo.git
cd thalo
CXXFLAGS="-std=c++20" pnpm install
pnpm build

# Link the CLI globally
cd apps/thalo-cli && pnpm link --global

# In a different directory, initialize your knowledge base
thalo init

# Validate your entries
thalo check
```

## License

MIT

---

<div align="center">
<sub>Built by <a href="https://github.com/rejot-dev">rejot-dev</a></sub>
</div>
