# 🗓️ Eventropy — Project Requirements

> An AI-powered event planning teammate that handles the unglamorous, logistical work so organizers can focus on the experience.

---

## 🎯 Product Vision

A desktop application that acts as an intelligent co-pilot for event organizers — automating communication, tracking registrations, surfacing funding opportunities, and keeping all stakeholders aligned across tools they already use.

---

## 🧑‍🤝‍🧑 Target Users

- GTM, sales, and marketing teams running events
- Community organizers (free tier)
- Non-profits and students (free tier)

### Event Types Supported
- Small, free community events (< 200 attendees)
- Higher-stakes events (fashion week, tech week) with entry fees

---

## 💼 Business Model

| Tier | Audience | Price |
|------|----------|-------|
| Free | Non-profits, students | $0 |
| Pro | GTM / sales / marketing teams | Subscription (TBD) |
| Team | Larger orgs | Subscription (TBD) |

---

## 🔄 User Flow (not in hackathon scope, just for the sake of pitching)

### 1. Onboarding — Tell the Agent About Your Event
The user provides context upfront so the AI can act as an informed teammate from day one:

- **Goals** — What does success look like? (attendance target, community growth, brand awareness)
- **Current challenges** — What's hard or uncertain? (finding a venue, managing volunteers, getting sponsors)
- **Resources** — Budget, team size, tools already in use, existing contacts
- **Progress** — What's already done? (venue booked, speakers confirmed, registration open)

> The agent ingests this to build an initial **knowledge graph node** for the event — linking people, tasks, deadlines, and dependencies.

---

### 2. Planning — AI Generates & Ranks the Work
The orchestrator agent consolidates all tasks required and organizes tasks in a to-do list based on the type of task (each task type has a seperate ai agent responsible). Tasks are assigned a level of urgency based on event type, timeline, and stated goals. The user can then label tasks that they want to do from the to-do list view.

- Information the agents require from the user to complete a task is labelled with an alert symbol ("you haven't confirmed A/V — that's typically needed 3 weeks out")
- The user can provide this information upon opening that agent's chat window, which opens from clicking on the alert symbol.
- Flags blockers and dependencies between tasks

---

### 3. Execution — Agent Takes Actions on Your Behalf
This is the core differentiator. The agent doesn't just suggest — it **acts**:

| Action | How |
|--------|-----|
| Draft & send email follow-ups | Gmail API |
| Post updates or answer FAQs in Discord | Discord API |
| Pull registration data & flag drop-offs | Luma MCP |
| Search for relevant grants or sponsors | Perplexity API |
| Create or update calendar events | Google Calendar API |
| Update task status in Notion | Notion MCP |

The user reviews, approves, or edits before anything is sent — the agent operates in a **human-in-the-loop** model by default, with the option to auto-execute routine tasks.

---

### 4. Monitoring — Live Event Dashboard
During the event:
- Incoming questions from Discord / WhatsApp routed to the agent for suggested responses
- In the future: Task completion tracking and countdown to key milestones

---

### 5. Retrospective — Learning for Next Time (Future)
After the event, the agent runs a structured retro:
- What went well / what didn't (pulled from comms, task completion rate, attendance vs. goal)
- Generates a **retro summary** stored in the knowledge graph
- Updates future task templates and risk flags based on what was learned

> Every event makes the agent smarter for the next one.

---

## 🧠 Knowledge Graph — Memory & History

The knowledge graph is the platform's long-term memory. Unlike a flat database, it captures **relationships** between entities across events over time. This is done by giving the orchestration agent long term memory, specifying context to it's subagents.

**What gets stored:**
- Events (past and upcoming) with outcomes
- People — team members, vendors, speakers, sponsors — and their roles/performance history
- Tasks — what was done, when, by whom, how long it took
- Retro insights — recurring blockers, what worked for which event type
- Comms threads — key decisions made via email, Discord, WhatsApp

**What this enables:**
- "Last time we ran a tech week event, catering was a blocker — flag it early this time"
- "This vendor was used twice and rated highly — suggest them again"
- "Your typical lead time for this event type is 6 weeks — you're behind"
- Role clarity: the graph tracks who owns what, preventing duplicated or dropped work

**Architecture candidates** *(TBD):*
- Neo4j (robust, production-grade graph DB)
- LlamaIndex Knowledge Graph (LLM-native, easier to query in natural language)
- Custom lightweight graph store for hackathon scope

---

## 🔌 Integrations

| Tool | Purpose |
|------|---------|
| **Luma** | Event registration management (via MCP) |
| **Discord** | Attendee Q&A, concerns, community comms |
| **WhatsApp** | Chat import & communication ([LangChain loader](https://docs.langchain.com/oss/python/integrations/document_loaders/whatsapp_chat)) |
| **Gmail / Google Calendar** | Email follow-ups, deadline tracking (Google Cloud Console API) |
| **Notion** | Documentation & notes (via MCP) |
| **Perplexity API** | Web search for grants & funding sources |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Shell** | Electron (TypeScript) |
| **AI / Search** | Perplexity API |
| **Calendar & Email** | Google Cloud Console API (Calendar + Gmail) |
| **Community** | Discord API |
| **Messaging** | WhatsApp API |
| **Integrations** | Luma MCP, Notion MCP |
| **Knowledge Layer** | Knowledge graphs *(architecture TBD — candidates: Neo4j, LlamaIndex KG, custom graph store)* |

---

## 🖥️ Platform

**Desktop app** — built with Electron (TypeScript)

---

## 🎨 UI / Design (Static Prototype)

- [ ] **Dashboard page** — gallery view of all projects + "New Project" button
- [ ] **Calendar view** — deadlines, event milestones, countdown timers
- [ ] **Checklist / To-Do** — task management per event
- [ ] **Agent chat** - talk with agent's on specific tasks

---

## ✅ To-Do

### Design
- [ ] Create static prototype

### Research
- [ ] Research problem space & market landscape
- [ ] Estimate financial opportunity (TAM/SAM/SOM)
- [ ] Evaluate venture-backability

### Pitch
- [ ] Create Google Slides deck
- [ ] Write pitch script

### Development
- [ ] Define knowledge graph architecture
- [ ] Set up Electron + TypeScript boilerplate
- [ ] Prototype at least one integration (suggested: Luma MCP or Gmail)

---

## 🏁 Competitors

*(Research needed — suggested starting points)*

- **Eventbrite** — ticketing & registration, no AI planning layer
- **Cvent** — enterprise event management, complex & expensive
- **Splash (acq. by Cvent)** — event marketing platform for branded events
- **Monday.com / Asana** — general project management, not event-specific
- **ChatGPT / Notion AI** — general AI, not integrated with event tooling
- **Grip** — AI-powered networking at events, not logistics-focused

> Key differentiator to validate: **no existing tool combines AI automation with multi-channel integrations (Discord, WhatsApp, Luma) in a single event-planning workspace.**

---

## ❓ Open Questions

- What is the knowledge graph use case specifically? (attendee relationships, vendor contacts, event history?)
- Luma MCP — does an official MCP server exist, or does this need to be custom-built?
- WhatsApp API — Business API or personal chat export parsing?
- Pricing: what subscription price is defensible given the free-for-nonprofits commitment?
