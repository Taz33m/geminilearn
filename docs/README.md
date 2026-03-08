# Geminilearn - Personalized Professor for Multimodal, Accessible Learning

## 1. Product Vision
Geminilearn reimagines classroom presentations by combining a teacher's essence with a voice-driven AI co-presenter. Instead of static slides, instructors speak naturally while an agent orchestrates supporting visuals, flash cards, and deep-dive explorations on a live canvas. The agent listens, understands the lesson context, and transforms requests into rich teaching aids in real time in the form of a multimodal intelligent canvas.

---

## 2. Core Agent Behaviors
| Capability | Description | Demo Proof Point |
|------------|-------------|------------------|
| **Canvas Awareness** | Agent inspects/modifies an “open white canvas” that the teacher can annotate on. Keeps visuals consistent with lesson flow. | Visual placeholders regenerate as the agent acts. |
| **Lecture-Grounded Generation** | Uses supplied lecture material to avoid hallucinations; cites sources in outputs. | Flash cards + deep dives reference the lesson outline. |
| **Interactive Workflow** | Agent asks clarifying questions before executing impactful actions. | “Focus flash cards on week 2 labs?” prompt appears. |
| **Tool Confirmation Loop** | Each tool call ends with a confirmation + optional follow-up suggestion. | After deep dive, agent asks: “Add quiz question?” |

---

## 3. Planned Tool Calls
### 3.1 Flash Card Generator
- **Inputs:** topic focus, optional extra context from the teacher.
- **Process:** pull facts/examples from lecture notes, structure into *Prompt → Key Idea → Probe Question*.
- **Output:** list of cards displayed in sidebar; option to pin to canvas.
- **Guardrails:** refuse or ask for more context if topic not found in lecture material.

### 3.2 Topic Deep Dive
- **Inputs:** subject + optional angle (overview, compare/contrast, step-by-step).
- **Process:** produce mini-report with sections (Summary, Examples, Visual Ideas, References).
- **Output:** render in sidebar with button to spray visuals onto canvas (images, flowcharts, etc.).
- **Iterate:** user can say “Regenerate with metabolism focus” for an updated report.

### 3.3 Canvas Enhance
- **Inputs:** bounding box of selected canvas area + annotation goal.
- **Process:** analyze current content, propose enhancement plan (labels, highlights, cleanup).
- **Output:** preview image/overlay, confirm to replace or layer onto canvas.
- **Safety:** warn before destructive edits (e.g., erasing user annotations).

---

## 4. UI Layout Summary
```
┌───────────────────────────┬────────────────────────────────────────┐
│ Voice Agent Sidebar       │ Main Canvas                            │
│ • Connect / status pill   │ • Live whiteboard placeholder          │
│ • Flash cards tab         │ • Shows injected visuals/annotations   │
│ • Deep dives tab          │ • Future: real Fabric.js drawing       │
│ • Generated content feed  │                                        │
└───────────────────────────┴────────────────────────────────────────┘
```
- Sidebar width set to one-third of viewport to accommodate generative UI.
- Voice controls condensed for hackathon polish.
- “Generated Content” section ready to display outputs of tool calls.

---

## 5. Implementation Checklist
| Status | Item |
|--------|------|
| ✅ | Next.js app scaffolded with Tailwind + shadcn readiness |
| ✅ | Voice agent hook using Gemini Live API |
| ✅ | Ephemeral token backend route (`/api/voice/token`) |
| ✅ | Sidebar layout + voice UI ready for demo |
| ✅ | Flash card tool execution + UI list |
| ✅ | Deep dive generator + markdown/visual render |
| ✅ | Canvas enhance flow + image overlay mock |
| ✅ | Lecture material ingestion (static JSON for demo) |

---

## 6. Tech Stack Overview
- **Frontend:** Next.js 14 App Router, Tailwind CSS, shadcn-inspired components.
- **Voice Agent:** Gemini Live API via `@google/genai`.
- **Auth:** Ephemeral client secrets fetched via Next.js API route using project API key.
- **State:** React hooks (future option—Zustand for session memory).
- **Future Canvas:** Fabric.js integration for layered drawings (post-demo).

---

## 7. Where We See Geminilearn Going
1. **Real Canvas Integration:** using Fabric.js; persist drawing state.
2. **Shared Session Memory:** store generated assets and allow revision history.
3. **Assessment Mode:** auto-generate quizzes based on flash cards.
4. **Student View:** synced learner view with agent-curated highlights.
5. **Analytics:** track engagement (most requested topics, time spent per slide).

---

## 8. Quick Start - Demo Setup
1. Add `GEMINI_API_KEY` to `frontend/.env.local`.
2. Optional live-session tuning env vars:
   - `NEXT_PUBLIC_GEMINI_LIVE_MODEL`
   - `NEXT_PUBLIC_GEMINI_LIVE_ENABLE_SESSION_RESUMPTION` (`false` to disable)
   - `NEXT_PUBLIC_GEMINI_LIVE_CONTEXT_TRIGGER_TOKENS` (for context compression)
   - `NEXT_PUBLIC_GEMINI_LIVE_CONTEXT_TARGET_TOKENS` (sliding window target)
3. Install deps: `npm install` inside `frontend`.
4. Run dev server: `npm run dev` → `http://localhost:3000`.
5. Enable microphone → click “Start Voice Agent.”
6. Use scripted prompts from storyboard section.

---

## 9. Documentation Index

### Core Documentation
- **[FLASHCARD_IMPLEMENTATION.md](./FLASHCARD_IMPLEMENTATION.md)** - Complete guide to flashcard generation system
- **[ADDING_TOOLS.md](./ADDING_TOOLS.md)** - Step-by-step guide for adding new tool calls to the voice agent
- **[CONVERSATION_HISTORY.md](./CONVERSATION_HISTORY.md)** - How conversation history persistence works across disconnects/reconnects
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** - Roadmap and prioritized next features

### Key Features Documented
- ✅ Flashcard generation with structured outputs (Zod)
- ✅ Tool calling infrastructure
- ✅ Conversation history persistence
- ✅ Audio cues for tool calls
- ✅ Voice agent connection and management

### Quick Reference
- **Adding a new tool**: See [ADDING_TOOLS.md](./ADDING_TOOLS.md)
- **Understanding history**: See [CONVERSATION_HISTORY.md](./CONVERSATION_HISTORY.md)
- **Flashcard system**: See [FLASHCARD_IMPLEMENTATION.md](./FLASHCARD_IMPLEMENTATION.md)
