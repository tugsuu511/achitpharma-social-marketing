"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight, X, Leaf, LoaderCircle } from "lucide-react";
import { STATUS_LABEL, type Status } from "@/lib/types";
export async function api(path: string, body?: unknown, method = "POST") {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api/${path}`, { method, headers: isForm ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) { if (response.status === 401 && !path.startsWith("login")) window.location.assign("/"); throw new Error(result.error || "Хүсэлт амжилтгүй боллоо."); }
  return result;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand brand-image${compact ? " brand-compact" : ""}`}>
    <span className="brand-logo-frame">
      <Image src="/brand/achitpharma-logo.png" alt="Ачит Фарм — хүүхдийн эм ханган нийлүүлэх байгууллага" width={945} height={472} sizes={compact ? "104px" : "(max-width: 760px) 210px, 260px"} loading="eager" className="brand-logo"/>
    </span>
    {!compact && <small>SOCIAL MARKETING TEAM</small>}
  </div>;
}
export function Avatar({ name, size = "" }: { name: string; size?: string }) { return <span className={`avatar ${size}`} aria-hidden="true">{name.trim().slice(0,2).toUpperCase()}</span>; }
export function StatusBadge({ status }: { status: Status }) { return <span className={`badge status-${status}`}><i />{STATUS_LABEL[status]}</span>; }
export function PlatformBadge({ platform }: { platform: string }) { return <span className={`platform platform-${platform.toLowerCase()}`}><span>{platform === "Facebook" ? "f" : platform === "Instagram" ? "◎" : platform === "TikTok" ? "♪" : platform === "YouTube" ? "▶" : "#"}</span>{platform}</span>; }
export function Busy({ children, busy }: { children: ReactNode; busy?: boolean }) { return <>{busy && <LoaderCircle size={16} className="spin" />}{children}</>; }
export function Empty({ title = "Одоогоор ажил алга", description = "Шинэ ажил нэмэгдэхэд энд харагдана.", action }: { title?: string; description?: string; action?: ReactNode }) { return <div className="empty"><span className="empty-icon"><Leaf size={26}/></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; dialog.close(); }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? "wide" : ""}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-label={title}><div className="modal-head"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Хаах"><X size={20}/></button></div>{children}</dialog>;
}
export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) { return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }
export function MoreButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-button" onClick={onClick}>{children}<ArrowUpRight size={16}/></button>; }
