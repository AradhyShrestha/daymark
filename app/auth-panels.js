"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Eye, EyeOff, ImagePlus, LoaderCircle, LockKeyhole, LogOut, Mail, UserRound, X } from "lucide-react";
import BrandLogo from "./brand";

async function readResponse(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}

export function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("register");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const result = await readResponse(response);
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand"><BrandLogo /></div>
        <div className="auth-eyebrow">A LITTLE SPACE FOR WHAT MATTERS</div>
        <h1>{isRegister ? "Start with today." : "Welcome back."}</h1>
        <p className="auth-description">{isRegister ? "Make an account to keep your tasks and plans close." : "Sign in to pick up right where you left off."}</p>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && <label className="auth-field"><span>Your name</span><div><UserRound size={16} /><input autoComplete="name" value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={32} placeholder="Jordan Davis" required /></div></label>}
          <label className="auth-field"><span>Email address</span><div><Mail size={16} /><input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" required /></div></label>
          <label className="auth-field"><span>Password</span><div><LockKeyhole size={16} /><input autoComplete={isRegister ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} placeholder="At least 8 characters" required /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin-icon" size={17} /> : <>{isRegister ? "Create account" : "Sign in"}<ArrowRight size={16} /></>}</button>
        </form>
        <div className="auth-switch">{isRegister ? "Already have an account?" : "New to Daymark?"}<button type="button" onClick={() => { setMode(isRegister ? "login" : "register"); setShowPassword(false); setError(""); }}>{isRegister ? "Sign in" : "Create an account"}</button></div>
        <div className="auth-footnote"><LockKeyhole size={13} /> Your password is encrypted before it is stored.</div>
      </section>
      <aside className="auth-side">
        <div className="auth-side-stamp">DAYMARK / PERSONAL PLANNING</div>
        <div className="auth-quote-mark">“</div>
        <p>Make room<br />for what matters.</p>
        <div className="auth-side-bottom"><span>One thing at a time.</span><span>✳</span></div>
      </aside>
    </main>
  );
}

export function AccountPanel({ user, onClose, onSaved, onLogout }) {
  const [username, setUsername] = useState(user.username);
  const [avatarDataUrl, setAvatarDataUrl] = useState(user.avatarDataUrl ?? null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/[\/]?(png|jpeg|webp)$/i.test(file.type) || file.size > 600_000) {
      setError("Choose a PNG, JPEG, or WebP image under 600 KB.");
      event.target.value = "";
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    }).catch((photoError) => {
      setError(photoError.message);
      return null;
    });
    if (dataUrl) {
      setAvatarDataUrl(dataUrl);
      setError("");
      setNotice("");
    }
    event.target.value = "";
  }

  async function saveProfile(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, avatarDataUrl }),
      });
      const result = await readResponse(response);
      onSaved(result.user);
      setNotice("Account updated.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="account-dialog-head"><div><span className="account-kicker">YOUR DAYMARK</span><h2 id="account-title">Account</h2></div><button className="icon-button" type="button" aria-label="Close account" onClick={onClose}><X size={18} /></button></div>
        <form className="account-form" onSubmit={saveProfile}>
          <div className="account-avatar-row"><span className="account-avatar">{avatarDataUrl ? <Image src={avatarDataUrl} alt="Profile preview" width={64} height={64} unoptimized /> : user.username.slice(0, 1).toUpperCase()}</span><div><strong>Profile photo</strong><small>PNG, JPEG, or WebP · up to 600 KB</small><div className="photo-actions"><label className="photo-button"><ImagePlus size={14} />Choose photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPhoto} /></label>{avatarDataUrl && <button className="remove-photo" type="button" onClick={() => { setAvatarDataUrl(null); setNotice(""); }}>Remove</button>}</div></div></div>
          <label className="account-field"><span>Username</span><input value={username} onChange={(event) => { setUsername(event.target.value); setNotice(""); }} minLength={2} maxLength={32} required /></label>
          <label className="account-field"><span>Email address</span><input value={user.email} readOnly /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="account-notice" role="status">{notice}</div>}
          <button className="account-save" type="submit" disabled={pending || username.trim().length < 2}>{pending ? "Saving..." : "Save changes"}</button>
        </form>
        <div className="account-logout"><div><strong>Leaving already?</strong><small>You can sign back in any time.</small></div><button type="button" onClick={onLogout}><LogOut size={15} />Log out</button></div>
      </section>
    </div>
  );
}