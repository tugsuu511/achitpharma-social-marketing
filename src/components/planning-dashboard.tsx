"use client";
import { useState, type ReactNode } from "react";
import { CalendarDays, ChevronRight, LayoutGrid, Paperclip, Plus, Search, Users, X } from "lucide-react";
import { isOverdue, shortDate, STATUS_LABEL, type Task, type User, type Status } from "@/lib/types";
import { Avatar, Empty, PlatformBadge, StatusBadge } from "./ui";

export function TaskCards({ tasks, today, onSelect, filtered = false, onCreate }: { tasks: Task[]; today: string; onSelect: (id: string) => void; filtered?: boolean; onCreate?: () => void }) {
  if (!tasks.length) return <Empty title={filtered ? "Тохирох төлөвлөгөө олдсонгүй" : "Эхний төлөвлөгөөгөө нэмээрэй"} description={filtered ? "Хайлтын үг эсвэл шүүлтүүрээ өөрчлөөд үзээрэй." : "Хийх ажил, хугацаагаа оруулаад эндээс явцыг нь хянаарай."} action={!filtered && onCreate ? <button className="button primary" onClick={onCreate}><Plus size={17}/>Төлөвлөгөө нэмэх</button> : undefined}/>;
  return <div className="plan-card-grid">
    {tasks.map(task => {
      const overdue = isOverdue(task,today);
      return <button type="button" className={`plan-card${overdue ? " plan-card-overdue" : ""}`} key={task.id} onClick={() => onSelect(task.id)} aria-label={`${task.title} — ${STATUS_LABEL[task.status]}, дэлгэрэнгүй нээх`}>
        <span className="plan-card-top"><PlatformBadge platform={task.platform}/><StatusBadge status={task.status}/></span>
        <strong className="plan-card-title">{task.title}</strong>
        <span className="plan-card-description">{task.description || "Нэмэлт тайлбар оруулаагүй байна."}</span>
        <span className="plan-card-tags">{task.priority === "high" && <span className="priority">Өндөр ач холбогдол</span>}{overdue && <span className="plan-overdue-label">Хугацаа хэтэрсэн</span>}</span>
        <span className="plan-card-owner"><Avatar name={task.assigneeName}/><span>{task.assigneeName}</span></span>
        <span className="plan-card-bottom"><span className={`plan-card-date${overdue ? " overdue" : ""}`}><CalendarDays size={15}/><span><small>Дуусах огноо</small><strong>{shortDate(task.dueDate)}, {task.dueDate.slice(0,4)}</strong></span></span>{task.attachmentCount > 0 && <span className="plan-card-files" aria-label={`${task.attachmentCount} хавсралт`}><Paperclip size={14}/>{task.attachmentCount}</span>}<ChevronRight size={18}/></span>
      </button>;
    })}
  </div>;
}

export function PlanningDashboard({ tasks, users, user, today, onSelect, onCreate, calendar }: { tasks: Task[]; users: User[]; user: User; today: string; onSelect: (id: string) => void; onCreate: () => void; calendar: ReactNode }) {
  const [mode,setMode] = useState<"cards" | "calendar">("cards");
  const [query,setQuery] = useState(""); const [status,setStatus] = useState("all"); const [assignee,setAssignee] = useState("all");
  const filtered = tasks.filter(task => (status === "all" || (status === "overdue" ? isOverdue(task,today) : task.status === status)) && (assignee === "all" || task.assigneeId === assignee) && `${task.title} ${task.description} ${task.assigneeName}`.toLowerCase().includes(query.trim().toLowerCase()));
  const activeCount = tasks.filter(task => task.status !== "approved").length;
  return <section className="planning-dashboard" aria-label="Төлөвлөгөөний самбар">
    <div className="planning-summary"><div><span>Нийт төлөвлөгөө</span><strong>{tasks.length}</strong></div><div><span>Үргэлжилж буй</span><strong>{activeCount}</strong></div><div><span>Батлагдсан</span><strong>{tasks.length-activeCount}</strong></div></div>
    <div className="planning-view-toolbar"><h2>{user.role === "admin" ? "Багийн төлөвлөгөө" : "Миний төлөвлөгөө"}</h2><div className="planning-view-switch" role="group" aria-label="Төлөвлөгөө харах хэлбэр"><button type="button" aria-pressed={mode === "cards"} onClick={() => setMode("cards")}><LayoutGrid size={16}/>Карт</button><button type="button" aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")}><CalendarDays size={16}/>Календарь</button></div></div>
    {mode === "calendar" ? calendar : <>
      <div className="panel planning-filters"><div className="task-toolbar"><div className="search-input"><Search size={18}/><input type="search" aria-label="Төлөвлөгөө хайх" placeholder="Төлөвлөгөө хайх…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" aria-label="Хайлт цэвэрлэх" onClick={() => setQuery("")}><X size={16}/></button>}</div>{user.role === "admin" && <label className="assignee-select"><Users size={16}/><select aria-label="Төлөвлөгөөний хариуцагчаар шүүх" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="all">Бүх ажилтан</option>{users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div>
      <div className="filter-tabs" role="group" aria-label="Төлөвлөгөөний төлөвөөр шүүх"><button type="button" className={status === "all" ? "selected" : ""} aria-pressed={status === "all"} onClick={() => setStatus("all")}>Бүгд <span>{tasks.length}</span></button>{(Object.keys(STATUS_LABEL) as Status[]).map(item => <button type="button" key={item} className={status === item ? "selected" : ""} aria-pressed={status === item} onClick={() => setStatus(item)}>{STATUS_LABEL[item]}<span>{tasks.filter(task => task.status === item).length}</span></button>)}<button type="button" className={status === "overdue" ? "selected" : ""} aria-pressed={status === "overdue"} onClick={() => setStatus("overdue")}>Хугацаа хэтэрсэн<span>{tasks.filter(task => isOverdue(task,today)).length}</span></button></div></div>
      <p className="planning-result" role="status">{filtered.length} төлөвлөгөө · Картаа дарж дэлгэрэнгүйг нээнэ үү</p>
      <TaskCards tasks={filtered} today={today} onSelect={onSelect} onCreate={onCreate} filtered={!!query || status !== "all" || assignee !== "all"}/>
    </>}
  </section>;
}
