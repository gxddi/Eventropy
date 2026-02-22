import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DragRegion from "./components/DragRegion";
import HamburgerButton from "./components/HamburgerButton";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import { fetchAllEvents, insertEvent, insertChatMessage, syncEventTasks, deleteEvent } from "./lib/eventsDb";
import { pathnameToView, viewToPath } from "./lib/routes";
import { isElectron, planEvent } from "./lib/electronBridge";
import type {
  ActiveView,
  AgentId,
  SidebarState,
  PlannerEvent,
  EventFormData,
  AccountSettings,
  Task,
} from "./types";

/**
 * INITIAL_ACCOUNT_SETTINGS -> Default account settings.
 */
const INITIAL_ACCOUNT_SETTINGS: AccountSettings = {
  currentAccount: "personal",
  personalAccount: {
    name: "User",
    email: "user@example.com",
  },
};

/**
 * App -> Root application shell.
 *
 * State:
 *   activeView    -> Discriminated union controlling which view renders.
 *   sidebarState  -> `"open"` | `"closed"` sidebar visibility toggle.
 *   eventRegistry -> Array of all PlannerEvents (from Supabase).
 *   accountSettings -> Current account settings and preferences.
 */
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = useMemo(() => pathnameToView(location.pathname), [location.pathname]);
  const previousViewRef = useRef<ActiveView>({ kind: "dashboard" });
  const [sidebarState, setSidebarState] = useState<SidebarState>("closed");
  const [eventRegistry, setEventRegistry] = useState<PlannerEvent[]>([]);
  const [accountSettings, setAccountSettings] = useState<AccountSettings>(INITIAL_ACCOUNT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createEventLoading, setCreateEventLoading] = useState(false);
  /** True while a task sync is in flight; disables toggle/delete to prevent duplicate syncs. */
  const [taskSyncInProgress, setTaskSyncInProgress] = useState(false);
  /** Serialize task syncs so concurrent clicks don't cause DELETE+INSERT race and duplicate rows. */
  const taskSyncPromiseRef = useRef<Promise<void>>(Promise.resolve());
  /** Latest pending task update; used so we sync latest state, not stale closure. */
  const pendingTasksRef = useRef<{ evtId: string; tasks: Task[] } | null>(null);

  useEffect(() => {
    if (location.pathname === "" || location.pathname === "/") navigate("/dashboard", { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchAllEvents()
      .then((events) => {
        if (!cancelled) setEventRegistry(events);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message ?? "Failed to load events");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * handleEventCreate -> Creates event in Supabase, adds one welcome message, then navigates.
   */
  const handleEventCreate = async (formData: EventFormData) => {
    setCreateEventLoading(true);
    try {
      const eventDate = formData.eventDate ? new Date(formData.eventDate) : null;
      const now = new Date();
      let status: "planning" | "on-track" | "at-risk" | "complete" = "planning";
      if (eventDate) {
        if (eventDate < now) status = "complete";
        else {
          const daysUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          status = daysUntil < 7 ? "at-risk" : "on-track";
        }
      }

      const { id: eventDbId, evt_slug } = await insertEvent(formData, {
      status,
      accountType: accountSettings.currentAccount,
    });
    await insertChatMessage(eventDbId, {
      agent_id: "general",
      role: "system",
      content: "Event created. Add tasks and use the agents to get things done.",
    });

    // Ask AI to generate an initial task breakdown for this event (when option is enabled)
    let aiTasks: Task[] = [];
    if (formData.generateAiTasks !== false) {
      if (!isElectron()) {
        console.warn("[Eventropy] AI task planning is only available in the Electron app. Run with: npm run dev (opens Electron window). Tasks were not generated.");
      } else {
        try {
          const planResult = await planEvent(eventDbId, formData);
          if (planResult?.error) {
            console.error("[Eventropy] Plan event error:", planResult.error);
          }
          if (planResult?.tasks?.length) {
            aiTasks = planResult.tasks.map((t, i) => ({
              id: `task-ai-${Date.now()}-${i}`,
              title: t.title,
              description: t.description,
              status: "todo" as const,
              priority: t.priority ?? 1,
              dueDate: t.dueDate,
              agentId: t.agentId as AgentId | undefined,
              assignedTo: "ai-agent",
              dependencies: [],
              blockers: [],
              subtasks: [],
              createdAt: new Date().toISOString(),
              chatMessages: [],
            }));
            await syncEventTasks(eventDbId, aiTasks).catch((err) => {
              console.error("[Eventropy] Failed to sync AI tasks to Supabase:", err);
            });
          } else {
            console.warn("[Eventropy] Plan event returned no tasks.", planResult?.tasks);
          }
        } catch (err) {
          console.error("[Eventropy] Plan event threw:", err);
        }
      }
    }

    const newEvent: PlannerEvent = {
      evtId: evt_slug,
      formData,
      status,
      createdAt: new Date().toISOString(),
      chatTimeline: [
        {
          msgId: `welcome-${evt_slug}`,
          agentId: "general",
          role: "system",
          content: "Event created. Add tasks and use the agents to get things done.",
          timestamp: new Date().toISOString(),
        },
      ],
      accountType: accountSettings.currentAccount,
      tasks: aiTasks,
      documents: [],
      collaborators:
        accountSettings.currentAccount === "organization"
          ? accountSettings.organizationAccount?.collaborators || []
          : undefined,
    };

      setEventRegistry((prev) => [newEvent, ...prev]);
      navigate(`/event/${evt_slug}`);
    } finally {
      setCreateEventLoading(false);
    }
  };

  /**
   * handleNavigate -> Derived from `handle` (callback) + `Navigate` (view change).
   * Sets activeView and auto-closes sidebar on navigation.
   * When navigating to event-chat, stores current view so back can return there.
   */
  const handleNavigate = (view: ActiveView) => {
    if (view.kind === "event-chat") {
      previousViewRef.current = activeView;
    }
    navigate(viewToPath(view));
    setSidebarState("closed");
  };

  /** Navigate back to the view we were on before opening the event (dashboard, calendar, or timeline). */
  const handleNavigateBack = () => {
    handleNavigate(previousViewRef.current);
  };

  /**
   * handleToggleSidebar -> Derived from `handle` (callback) + `Toggle` + `Sidebar`.
   */
  const handleToggleSidebar = () => {
    setSidebarState((prev) => (prev === "open" ? "closed" : "open"));
  };

  const handleDeleteEvent = async (evtId: string) => {
    try {
      await deleteEvent(evtId);
      setEventRegistry((prev) => prev.filter((e) => e.evtId !== evtId));
      handleNavigate({ kind: "dashboard" });
    } catch (err) {
      console.error("[Eventropy] Failed to delete event:", err);
    }
  };

  const handleUpdateEvent = async (evtId: string, updates: Partial<PlannerEvent>) => {
    setEventRegistry((prev) =>
      prev.map((e) => (e.evtId === evtId ? { ...e, ...updates } : e))
    );
    if (updates.tasks !== undefined) {
      pendingTasksRef.current = { evtId, tasks: updates.tasks };
      setTaskSyncInProgress(true);
      taskSyncPromiseRef.current = taskSyncPromiseRef.current
        .then(() => {
          const pending = pendingTasksRef.current;
          if (!pending) return;
          pendingTasksRef.current = null;
          return syncEventTasks(pending.evtId, pending.tasks).then((persisted) => {
            setEventRegistry((prev) =>
              prev.map((e) => (e.evtId === pending.evtId ? { ...e, tasks: persisted } : e))
            );
          });
        })
        .catch((err) => {
          console.warn("Failed to sync tasks to Supabase:", err);
        })
        .finally(() => {
          setTaskSyncInProgress(false);
        });
    }
  };

  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p>Loading events…</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: "0.5rem" }}>
        <p style={{ color: "var(--clr-alert)" }}>{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setLoading(true);
            fetchAllEvents()
              .then((events) => {
                setEventRegistry(events);
                setLoadError(null);
              })
              .catch((e) => setLoadError(e?.message ?? "Failed to load events"))
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {createEventLoading && (
        <div className="create-event-loading-overlay" aria-busy="true" aria-live="polite">
          <div className="create-event-loading-spinner" />
          <div className="create-event-loading-content">
            <p className="create-event-loading-title">Creating event</p>
            <p className="create-event-loading-subtitle">Generating AI tasks…</p>
          </div>
        </div>
      )}
      <div className={isElectron() ? "app-root electron" : "app-root"}>
      <DragRegion />
      <div className="app-shell">
        <HamburgerButton
          isOpen={sidebarState === "open"}
          onToggle={handleToggleSidebar}
        />
        <Sidebar
          state={sidebarState}
          events={eventRegistry}
          activeView={activeView}
          accountSettings={accountSettings}
          onNavigate={handleNavigate}
          onClose={() => setSidebarState("closed")}
        />
        <div className="main-layout">
          <MainContent
            activeView={activeView}
            eventRegistry={eventRegistry}
            accountSettings={accountSettings}
            onEventCreate={handleEventCreate}
            onNavigate={handleNavigate}
            onNavigateBack={handleNavigateBack}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            taskSyncInProgress={taskSyncInProgress}
            onUpdateSettings={setAccountSettings}
          />
        </div>
      </div>
      </div>
    </>
  );
}
