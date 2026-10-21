"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { api, Brand, Busy } from "./ui";
export function AuthScreen() {
  const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [show,setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try { await api("login", Object.fromEntries(form)); window.location.assign("/"); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <main className="auth-layout">
    <section className="auth-story">
      <Brand/>
      <div className="story-content">
        <div className="eyebrow light"><span className="live-dot"/> НЭГ БАГ. НЭГ ЗОРИЛГО.</div>
        <h1>Сайхан санааг<br/>хамтдаа <em>бүтээе.</em></h1>
        <p>Өдөр тутмын ажлаа төлөвлөж, бүтээсэн зүйлээ хуваалцаж, багийнхаа амжилтыг нэг дороос.</p>
        <div className="story-card">
          <div className="story-card-top"><span className="mini-icon"><Sparkles size={18}/></span><span>Санаанаас гүйцэтгэл хүртэл</span><span className="tiny-tag">TEAM WORK</span></div>
          <div className="story-step"><span>01</span><div><strong>Төлөвлө</strong><small>Хүн бүрт тодорхой зорилго</small></div><Check size={17}/></div>
          <div className="story-step"><span>02</span><div><strong>Бүтээ</strong><small>Өөрийн хэмнэлээр, нэг баг болж</small></div><Check size={17}/></div>
          <div className="story-step"><span>03</span><div><strong>Үр дүнгээ хар</strong><small>Гүйцэтгэл бүр үнэ цэнтэй</small></div><ArrowRight size={17}/></div>
        </div>
      </div>
      <div className="story-footer">ACHITPHARMA <span>Хамтын ажлын орон зай</span></div>
    </section>
    <section className="auth-form-side">
      <div className="mobile-brand"><Brand/></div>
      <div className="auth-form-wrap">
        <span className="eyebrow">БАГИЙН АЖЛЫН ОРОН ЗАЙ</span>
        <h2>Тавтай морил 👋</h2>
        <p>Өөрийн эрхээр нэвтэрч, өнөөдрийн ажлаа эхлүүлээрэй.</p>
        <form onSubmit={submit} className="form-stack">
          <label>Имэйл хаяг<input type="email" name="email" placeholder="name@company.mn" autoComplete="username" required maxLength={254}/></label>
          <label>Нууц үг<div className="password-wrap">
            <input name="password" type={show ? "text" : "password"} placeholder="Нууц үгээ оруулна уу" autoComplete="current-password" minLength={1} maxLength={128} required/>
            <button type="button" aria-label={show ? "Нууц үг нуух" : "Нууц үг харах"} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
          </div></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button disabled={busy} className="button primary full" type="submit"><Busy busy={busy}>Нэвтрэх</Busy><ArrowRight size={18}/></button>
        </form>
        <div className="auth-note"><ShieldCheck size={18}/><span>Нэвтрэх эрх авах, нууц үг сэргээх бол багийн админдаа хандана уу.</span></div>
      </div>
      <footer className="auth-bottom">Achitpharma Social Marketing Team <span>Багийн дотоод систем</span></footer>
    </section>
  </main>;
}
