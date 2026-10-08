"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle, CalendarDays, CalendarRange, Check, ChevronDown,
  CircleCheckBig, Clock3, Inbox, Menu, Plus, Search,
  Sparkles, Sun, Sunrise, Trash2, X,
} from "lucide-react";
import { readTasks, readWorkspaces, writeTasks, writeWorkspaces } from "../lib/task-store";
import { AccountPanel, AuthPanel } from "./auth-panels";
import BrandLogo from "./brand";

const views = [
  { id: "today", label: "Today", icon: Sun },
  { id: "tomorrow", label: "Tomorrow", icon: Sunrise },
  { id: "week", label: "This week", icon: CalendarRange },
  { id: "overdue", label: "Overdue", icon: AlertCircle },
];
const libraryViews = [
  { id: "all", label: "All tasks", icon: Inbox },
  { id: "completed", label: "Completed", icon: CircleCheckBig },
];
const viewCopy = {
  today: ["Today", "A little progress goes a long way."],
  tomorrow: ["Tomorrow", "Get ahead of what’s coming."],
  week: ["This week", "Everything you’re moving forward."],
  overdue: ["Overdue", "A fresh start is always available."],
  all: ["All tasks", "Every open loop, in one place."],
  completed: ["Completed", "Look at everything you’ve finished."],
};

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateOffset(offset, baseDate) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDueDate(value) {
  if (!value) return "No date";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function createStarterTasks(baseDate) {
  const createdAt = baseDate.toISOString();
  return [
    { id: crypto.randomUUID(), title: "Plan the week ahead", dueDate: dateOffset(0, baseDate), category: "Personal", priority: "high", completed: false, createdAt },
    { id: crypto.randomUUID(), title: "Send project update to Maya", dueDate: dateOffset(0, baseDate), category: "Work", priority: "normal", completed: false, createdAt },
    { id: crypto.randomUUID(), title: "Pick up a few groceries", dueDate: dateOffset(1, baseDate), category: "Personal", priority: "low", completed: false, createdAt },
    { id: crypto.randomUUID(), title: "Review the new onboarding flow", dueDate: dateOffset(2, baseDate), category: "Work", priority: "normal", completed: false, createdAt },
    { id: crypto.randomUUID(), title: "Book a dentist appointment", dueDate: dateOffset(-1, baseDate), category: "Personal", priority: "high", completed: false, createdAt },
  ];
}

function belongsInView(task, view, today, tomorrow, weekStart, weekEnd) {
  if (view === "completed") return task.completed;
  if (view === "overdue" && task.completed) return false;
  if (view === "all") return !task.completed;
  if (view === "today") return task.dueDate === today;
  if (view === "tomorrow") return task.dueDate === tomorrow;
  if (view === "week") return task.dueDate >= weekStart && task.dueDate <= weekEnd;
  if (view === "overdue") return Boolean(task.dueDate) && task.dueDate < today;
  return false;
}

function TaskItem({ task, onToggle, onDelete, isOverdue }) {
  return (
    <article className={`task-row${task.completed ? " is-complete" : ""}${isOverdue ? " is-overdue" : ""}`}>
      <button className="task-check" type="button" onClick={() => onToggle(task.id)} aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}>
        {task.completed && <Check size={14} strokeWidth={2.6} />}
      </button>
      <div className="task-main">
        <p className="task-title">{task.title}</p>
        <div className="task-details">
          <span className="task-date"><CalendarDays size={13} />{formatDueDate(task.dueDate)}</span>
          <span className={`task-category category-${task.category.toLowerCase()}`}>{task.category}</span>
        </div>
      </div>
      <span className={`priority priority-${task.priority}`} aria-label={`${task.priority} priority`}><span />{task.priority}</span>
      <button className="delete-task" type="button" onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={15} /></button>
    </article>
  );
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [accountOpen, setAccountOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("personal");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [now, setNow] = useState(null);
  const [activeView, setActiveView] = useState("today");
  const [sortBy, setSortBy] = useState("date");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("Work");
  const [priority, setPriority] = useState("normal");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then(({ user: sessionUser }) => {
        if (!mounted) return;
        if (!sessionUser) {
          startTransition(() => setAuthStatus("unauthenticated"));
          return;
        }
        activateUser(sessionUser);
      })
      .catch(() => {
        if (mounted) startTransition(() => setAuthStatus("unauthenticated"));
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (ready && user) writeTasks(tasks, activeWorkspaceId, user.id);
  }, [ready, tasks, activeWorkspaceId, user]);

  function activateUser(sessionUser) {
    const currentTime = new Date();
    const loadedWorkspaces = readWorkspaces(sessionUser.id, sessionUser.username);
    const storedTasks = readTasks("personal", sessionUser.id);
    const initialTasks = storedTasks ?? [];
    writeWorkspaces(loadedWorkspaces, sessionUser.id);
    if (!storedTasks) writeTasks(initialTasks, "personal", sessionUser.id);
    startTransition(() => {
      setUser(sessionUser);
      setWorkspaces(loadedWorkspaces);
      setActiveWorkspaceId("personal");
      setTasks(initialTasks);
      setNow(currentTime);
      setDueDate(dateKey(currentTime));
      setReady(true);
      setAuthStatus("authenticated");
    });
  }

  function saveUserProfile(updatedUser) {
    setUser(updatedUser);
    setAccountOpen(false);
  }

  async function logOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setAccountOpen(false);
      setReady(false);
      setAuthStatus("unauthenticated");
      setTasks([]);
    }
  }

  const today = now ? dateKey(now) : "";
  const tomorrow = now ? dateOffset(1, now) : "";
  const weekStart = now ? dateKey(startOfWeek(now)) : "";
  const weekEndDate = now ? startOfWeek(now) : null;
  if (weekEndDate) weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = weekEndDate ? dateKey(weekEndDate) : "";
  const visibleTasks = useMemo(() => tasks
    .filter((task) => query.trim() || belongsInView(task, activeView, today, tomorrow, weekStart, weekEnd))
    .filter((task) => task.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const rank = { high: 0, normal: 1, low: 2 };
      if (sortBy === "priority") return rank[a.priority] - rank[b.priority];
      if (sortBy === "recent") return b.createdAt.localeCompare(a.createdAt);
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return rank[a.priority] - rank[b.priority];
    }), [tasks, activeView, today, tomorrow, weekStart, weekEnd, query, sortBy]);

  function countFor(view) {
    return tasks.filter((task) => belongsInView(task, view, today, tomorrow, weekStart, weekEnd) && !task.completed).length;
  }

  function addTask(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || !dueDate || dueDate < today || !now) return;
    setTasks((current) => [{
      id: crypto.randomUUID(), title: cleanTitle, dueDate, category, priority,
      completed: false, createdAt: now.toISOString(),
    }, ...current]);
    setTitle("");
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function selectView(view) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  function selectWorkspace(workspaceId) {
    setActiveWorkspaceId(workspaceId);
    setTasks(readTasks(workspaceId, user.id) ?? []);
    setTitle("");
    setDueDate(today);
    setWorkspaceMenuOpen(false);
    setQuery("");
    setSearchOpen(false);
    setActiveView("today");
  }

  function createWorkspace(event) {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) return;
    const workspace = {
      id: crypto.randomUUID(),
      name,
      description: "Personal workspace",
    };
    const nextWorkspaces = [...workspaces, workspace];
    setWorkspaces(nextWorkspaces);
    writeWorkspaces(nextWorkspaces, user.id);
    writeTasks([], workspace.id, user.id);
    setNewWorkspaceName("");
    selectWorkspace(workspace.id);
  }

  if (authStatus === "loading") {
    return <main className="auth-loading"><BrandLogo markOnly className="auth-loading-mark" /><span>Checking your account...</span></main>;
  }
  if (authStatus !== "authenticated" || !user) {
    return <AuthPanel onAuthenticated={activateUser} />;
  }

  const [heading, subheading] = viewCopy[activeView];
  const todayTasks = tasks.filter((task) => task.dueDate === today);
  const todayDone = todayTasks.filter((task) => task.completed).length;
  const todayProgress = todayTasks.length ? Math.round((todayDone / todayTasks.length) * 100) : 0;

  return (
    <main className="app-shell">
      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <a className="brand" href="#home" onClick={() => selectView("today")}><BrandLogo /></a>
        <button className="workspace-switcher" type="button" aria-expanded={workspaceMenuOpen} aria-label="Change workspace" onClick={() => setWorkspaceMenuOpen((open) => !open)}><span className="workspace-avatar">{workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name.slice(0, 1).toUpperCase() ?? "J"}</span><span className="workspace-label"><strong>{workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? "Jordan’s space"}</strong><small>{workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.description ?? "Personal workspace"}</small></span><ChevronDown size={15} /></button>
        {workspaceMenuOpen && <div className="workspace-menu"><div className="workspace-menu-label">SWITCH WORKSPACE</div>{workspaces.map((workspace) => <button key={workspace.id} className={`workspace-option${workspace.id === activeWorkspaceId ? " selected" : ""}`} type="button" onClick={() => selectWorkspace(workspace.id)}><span className="workspace-option-avatar">{workspace.name.slice(0, 1).toUpperCase()}</span><span>{workspace.name}</span>{workspace.id === activeWorkspaceId && <Check size={15} />}</button>)}<form className="workspace-create" onSubmit={createWorkspace}><input value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} placeholder="New workspace" aria-label="New workspace name" maxLength={40} /><button type="submit" aria-label="Create workspace" disabled={!newWorkspaceName.trim()}><Plus size={16} /></button></form></div>}
        <div className="sidebar-label">YOUR SPACE</div>
        <nav className="nav-list" aria-label="Task views">
          {views.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item${activeView === id ? " active" : ""}`} onClick={() => selectView(id)} type="button"><Icon size={17} strokeWidth={1.8} /><span>{label}</span><span className={`nav-count${id === "overdue" && countFor(id) ? " count-alert" : ""}`}>{countFor(id) || ""}</span></button>)}
        </nav>
        <div className="sidebar-label sidebar-label-spaced">LIBRARY</div>
        <nav className="nav-list" aria-label="Task library">
          {libraryViews.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item${activeView === id ? " active" : ""}`} onClick={() => selectView(id)} type="button"><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === "all" && <span className="nav-count">{tasks.filter((task) => !task.completed).length || ""}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="week-card"><div className="week-card-top"><span>DAILY MOMENTUM</span><Sparkles size={15} /></div><div className="week-card-number">{todayDone}<span> / {todayTasks.length}</span></div><div className="week-card-caption">tasks finished today</div><div className="progress-track"><span style={{ width: `${todayProgress}%` }} /></div></div>
          <button className="profile-row" type="button" aria-label="Open account settings" onClick={() => setAccountOpen(true)}><span className="profile-avatar">{user.avatarDataUrl ? <Image src={user.avatarDataUrl} alt="" width={31} height={31} unoptimized /> : user.username.slice(0, 1).toUpperCase()}</span><span><strong>{user.username}</strong><small>{user.email}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" type="button" />}

      <section className="main-panel" id="home">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" type="button"><Menu size={19} /></button>
          <div className="breadcrumb"><span>My tasks</span><span className="breadcrumb-slash">/</span><strong>{heading}</strong></div>
          <div className="topbar-actions">
            {searchOpen && <input className="search-input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a task..." aria-label="Search tasks" />}
            <button className={`icon-button${searchOpen ? " icon-button-selected" : ""}`} aria-label={searchOpen ? "Close search" : "Search tasks"} onClick={() => { setSearchOpen((open) => !open); setQuery(""); }} type="button">{searchOpen ? <X size={18} /> : <Search size={18} />}</button><span className="topbar-divider" />
            <span className="today-chip"><span />{now && new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(now)}</span>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading"><div><div className="eyebrow">{query.trim() ? "SEARCHING THIS WORKSPACE" : activeView === "today" ? "A FRESH PAGE" : "YOUR TASKS"}</div><h1>{query.trim() ? "Search" : heading}<span className="heading-dot">.</span></h1><p>{query.trim() ? `Results for “${query.trim()}”` : subheading}</p></div>
            <div className="heading-date"><span className="heading-date-icon"><CalendarDays size={17} /></span><span><strong>{now && new Intl.DateTimeFormat("en", { weekday: "long" }).format(now)}</strong><small>{now && new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(now)}</small></span></div>
          </div>
          {!['overdue', 'all', 'completed'].includes(activeView) && <>
            <form className="quick-add" onSubmit={addTask}>
              <button className="quick-add-icon" type="submit" aria-label="Add task" disabled={!title.trim() || !dueDate || dueDate < today}><Plus size={19} strokeWidth={2.2} /></button><input className="task-entry" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task to your day..." aria-label="Task title" />
              <div className="quick-add-options">
                <label className={`select-wrap date-select${dueDate && dueDate < today ? " date-invalid" : ""}`}><CalendarDays size={14} /><input type="date" min={today || undefined} value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Due date" aria-invalid={Boolean(dueDate && dueDate < today)} required /></label>
                <label className="select-wrap category-select"><span className="category-dot" /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Task category"><option>Work</option><option>Personal</option><option>Learning</option></select><ChevronDown size={13} /></label>
                <label className="select-wrap priority-select"><select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Task priority"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select><ChevronDown size={13} /></label>
                <button className="add-button" type="submit" disabled={!title.trim() || !dueDate || dueDate < today}><span>Add task</span></button>
              </div>
            </form>
            {dueDate && dueDate < today && <div className="date-error" role="alert">Choose today or a future date. Past dates aren’t available for new tasks.</div>}
          </>}
          <div className="list-toolbar"><div className="list-summary"><span className="list-summary-count">{visibleTasks.length}</span> {visibleTasks.length === 1 ? "task" : "tasks"}<span className="summary-separator">·</span><span>{query.trim() ? "in this workspace" : activeView === "today" ? `${todayDone} completed` : activeView === "overdue" ? "needs attention" : activeView === "completed" ? "nicely done" : "in this view"}</span></div><button className="sort-button" type="button" aria-label={`Sort by ${sortBy === "date" ? "due date" : sortBy === "priority" ? "priority" : "recently added"}; click to change`} onClick={() => setSortBy((current) => current === "date" ? "priority" : current === "priority" ? "recent" : "date")}><Clock3 size={14} />{sortBy === "date" ? "Due date" : sortBy === "priority" ? "Priority" : "Recently added"}<ChevronDown size={13} /></button></div>
          <div className="task-list" aria-live="polite">
            {!ready ? <div className="loading-row">Getting your day in order...</div> : visibleTasks.length ? visibleTasks.map((task) => <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} isOverdue={activeView === "overdue"} />) : <div className="empty-state"><span className="empty-icon"><Check size={22} /></span><h2>{query ? "No matching tasks" : activeView === "overdue" ? "You’re all caught up" : activeView === "completed" ? "Nothing completed yet" : "A little breathing room"}</h2><p>{query ? "Try another search, or clear your search." : activeView === "overdue" ? "No overdue tasks right now." : activeView === "completed" ? "Completed tasks will be kept here." : activeView === "all" ? "No open tasks in this workspace." : "Add a task above and make this space your own."}</p>{query && <button type="button" className="clear-search" onClick={() => setQuery("")}>Clear search</button>}</div>}
          </div>
          {activeView === "today" && todayTasks.length > 0 && <div className="day-footer"><span className="day-footer-line" /><span>{todayProgress === 100 ? "Everything on today’s list is done." : `${todayTasks.length - todayDone} ${todayTasks.length - todayDone === 1 ? "task" : "tasks"} left for today`}</span><span className="day-footer-line" /></div>}
          <footer className="page-footer"><span>One thing at a time.</span><span className="footer-sparkle">✳</span></footer>
        </div>
      </section>
      {accountOpen && <AccountPanel user={user} onClose={() => setAccountOpen(false)} onSaved={saveUserProfile} onLogout={logOut} />}
    </main>
  );
}
