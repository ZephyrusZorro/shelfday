'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, PackageOpen, BookOpen, History, Settings, ArrowUpRight, Plus, RefreshCw, Sprout, LogOut, Check, LoaderCircle, CircleHelp } from 'lucide-react';
import type { Kitchen, Snapshot } from '../../lib/model';
import { snapshotSchema } from '../../lib/model';
import { localDate } from '../../lib/planning';
import { backupText, activityCsv } from '../../lib/export';
import { Today, Stockroom, Recipes, Activity, KitchenSettings } from './views';
import OperationDialog from './operation-dialog';

export type Modal = { type: 'ingredient' | 'receive' | 'recipe' | 'prepare' | 'sell' | 'portionWaste' | 'stockWaste' | 'close' | 'restore' | 'reset' | 'sample' | 'guide'; id?: string; backup?: Kitchen };
export type ViewProps = { state: Kitchen; date: string; open: (modal: Modal) => void; busy: boolean };
export function download(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function money(cents: number, currency: string) { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(cents / 100); }
export function count(n: number) { return n.toLocaleString('en'); }
const sections = [{ name: 'Today', icon: LayoutDashboard }, { name: 'Stockroom', icon: PackageOpen }, { name: 'Recipes', icon: BookOpen }, { name: 'Activity', icon: History }, { name: 'Settings', icon: Settings }] as const;
export default function KitchenApp({ displayName }: { displayName: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [date, setDate] = useState(''); const [view, setView] = useState('Today');
  const [modal, setModal] = useState<Modal | null>(null); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(true);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<{ revision: number; operation: unknown } | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch('/api/kitchen', { cache: 'no-store' }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || 'Could not open your kitchen.'); setSnapshot(snapshotSchema.parse(body)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open your kitchen. Check your connection.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { setDate(localDate()); void reload(); }, [reload]);
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(t); } }, [notice]);
  async function send(body: { revision: number; operation: unknown }): Promise<boolean> {
    if (saving) return false;
    pending.current = body; setSaving(true); setError('');
    try {
      const response = await fetch('/api/kitchen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status >= 500) throw new Error('Save could not be confirmed. Retry the same save below.');
        pending.current = null; setUncertain(false);
        if (response.status === 409) await reload();
        setError(data.error || 'This entry could not be saved.'); return false;
      }
      setSnapshot(snapshotSchema.parse(data)); pending.current = null; setUncertain(false); setModal(null); setNotice('Saved to your kitchen.'); return true;
    } catch (e) {
      setUncertain(true); setError(e instanceof Error && e.message.includes('confirmed') ? e.message : 'Connection interrupted. The save may have reached your kitchen. Retry this same save before making another change.'); return false;
    } finally { setSaving(false); }
  }
  async function run(type: string, payload: unknown) {
    if (!snapshot || pending.current) return false;
    return send({ revision: snapshot.revision, operation: { id: crypto.randomUUID(), type, date, payload } });
  }
  function open(next: Modal) { if (!saving && !uncertain) { setError(''); setModal(next); } }
  if (!snapshot || !date) return <main className="load-screen"><Sprout size={40} /><h1>{loading ? 'Opening your kitchen…' : 'Your kitchen is taking a moment.'}</h1>{error && <p role="alert">{error}</p>}{!loading && <button className="button primary" onClick={reload}>Try again</button>}</main>;
  const state = snapshot.state; const props: ViewProps = { state, date, open, busy: saving || uncertain };
  const expired = state.lots.filter(l => l.remaining > 0 && l.useBy < date).length;
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to workspace</a>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">s<span>↗</span></span>shelfday<span className="brand-dot">.</span></div>
      <div className="kitchen-switch"><span className="kitchen-avatar">{state.name.slice(0, 1)}</span><div><strong>{state.name}</strong><span>SERVICE WORKSPACE</span></div></div>
      <span className="nav-caption">OPERATIONS</span>
      <nav aria-label="Main navigation">{sections.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${view === name ? 'active' : ''}`} aria-current={view === name ? 'page' : undefined} onClick={() => setView(name)}><Icon size={19} /><span>{name}</span>{name === 'Stockroom' && expired > 0 && <span className="nav-count">{expired}</span>}{view === name && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="small-note"><Sprout size={23} /><strong>Stock. Prep. Service.<br />Keep the line moving.</strong><p>One place for the daily numbers.</p></div>
        <button className="text-button help-link" onClick={() => open({ type: 'guide' })}><CircleHelp size={17} />How Shelfday works</button>
        <div className="user-row"><span className="user-avatar">{displayName.slice(0, 1).toUpperCase()}</span><span title={displayName}>{displayName}</span><a href="/signout-with-chatgpt?return_to=/" target="_top" aria-label="Sign out"><LogOut size={16} /></a></div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{view}</strong></div><div className="topbar-right"><span className="save-status">{saving ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />}{saving ? 'Saving…' : uncertain ? 'Save unconfirmed' : `Saved · v${snapshot.revision}`}</span><button className="icon-button" title="Refresh kitchen" aria-label="Refresh kitchen" onClick={reload} disabled={saving || uncertain || loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button><button className="icon-button" aria-label="How Shelfday works" onClick={() => open({ type: 'guide' })}><CircleHelp size={16} /></button><a className="icon-button" href="/signout-with-chatgpt?return_to=/" target="_top" aria-label="Sign out"><LogOut size={16} /></a></div></header>
      <main id="main" tabIndex={-1} className="main-content">
        {state.sample && <div className="sample-banner"><span><strong>Sample kitchen</strong> · These are example records. Explore freely.</span><button onClick={() => open({ type: 'reset' })} disabled={props.busy}>Start my own kitchen <ArrowUpRight size={14} /></button></div>}
        {error && <div className="error-banner" role="alert"><span>{error}</span>{uncertain && <button className="button small" disabled={saving} onClick={() => pending.current && send(pending.current)}>Retry same save</button>}</div>}
        <div className="page-heading"><div><span className="eyebrow">{view === 'Today' ? 'DAILY OPERATIONS' : 'KITCHEN OPERATIONS'}</span><h1>{view === 'Today' ? 'Today’s service.' : view === 'Settings' ? 'Workspace settings.' : view === 'Activity' ? 'The activity ledger.' : view === 'Recipes' ? 'Your production menu.' : 'The stockroom.'}</h1><p>{view === 'Today' ? 'Plan production. Track every batch. Close with the numbers balanced.' : view === 'Stockroom' ? 'Receive, label, and use the earliest batch first.' : view === 'Recipes' ? 'A simple recipe is the link between your shelves and your prep.' : view === 'Activity' ? 'An honest record of what came in, went out, and was left behind.' : 'Your kitchen details and portable records, all in one place.'}</p></div>
          <div className="heading-actions">{view === 'Today' && <><label className="date-picker"><span className="sr-only">Service date</span><input type="date" value={date} min="2000-01-01" max={localDate()} onChange={e => e.target.value && setDate(e.target.value)} disabled={props.busy} /></label><button className="button primary" onClick={() => open({ type: 'receive' })} disabled={props.busy || !state.ingredients.length}><Plus size={16} />Receive stock</button></>}{view === 'Stockroom' && <><button className="button" onClick={() => open({ type: 'ingredient' })} disabled={props.busy}><Plus size={16} />Ingredient</button><button className="button primary" onClick={() => open({ type: 'receive' })} disabled={props.busy || !state.ingredients.length}><Plus size={16} />Receive stock</button></>}{view === 'Recipes' && <button className="button primary" onClick={() => open({ type: 'recipe' })} disabled={props.busy || !state.ingredients.length}><Plus size={16} />New recipe</button>}{view === 'Activity' && <button className="button" onClick={() => download(activityCsv(state), `shelfday-activity-${date}.csv`, 'text/csv;charset=utf-8')}>Export CSV <ArrowUpRight size={16} /></button>}</div>
        </div>
        {!state.ingredients.length && <div className="onboarding"><div className="onboarding-illustration"><PackageOpen size={48} strokeWidth={1.3} /><span className="illustration-sprout"><Sprout size={26} /></span></div><div><span className="eyebrow">SET UP YOUR WORKSPACE</span><h2>Start with the ingredients.</h2><p>Add an ingredient, receive your first batch, then create a recipe.<br />Shelfday will connect the quantities for you.</p><div className="inline-actions"><button className="button primary" onClick={() => open({ type: 'ingredient' })} disabled={props.busy}>Add first ingredient <Plus size={15} /></button><button className="text-button" onClick={() => open({ type: 'sample' })} disabled={props.busy}>Explore a sample kitchen <ArrowUpRight size={15} /></button></div></div></div>}
        {view === 'Today' && <Today {...props} />}{view === 'Stockroom' && <Stockroom {...props} />}{view === 'Recipes' && <Recipes {...props} />}{view === 'Activity' && <Activity {...props} />}{view === 'Settings' && <KitchenSettings {...props} run={run} />}
        <footer className="workspace-footer"><span><Sprout size={13} /> STOCK / PREP / SERVICE / CLOSE</span><span>Dates and quantities entered by your kitchen.</span></footer>
      </main>
    </div>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    {modal && <OperationDialog modal={modal} {...props} saving={saving} uncertain={uncertain} retry={() => pending.current && void send(pending.current)} error={error} run={run} close={() => !saving && setModal(null)} onBackup={() => download(backupText(state), `shelfday-backup-${date}.json`)} />}
  </div>;
}
