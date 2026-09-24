"use client";

import React, { useState, useMemo } from "react";
import { API_BACKEND_URL } from "@/config/getEnvVariables";
import {
  ArrowLeft, Plus, X, Paperclip, Wallet, AlertTriangle, CheckCircle2, PieChart,
} from "lucide-react";
import { Modal, inputCls, money } from "@/modules/stock/shared/StockSharedUI";
import { paymentTermShort } from "@/modules/stock/shared/paymentTerms";
import {
  PAYMENT_STATE, PAYMENT_MODES, PAYMENT_MODE_LABEL,
} from "@/modules/stock/shared/paymentStatus";

/* ============================================================= */
/* Recording a payment — a full page, not a popup.                */
/*                                                                */
/* One settlement can arrive down several routes: 30,000 by NEFT   */
/* and 15,000 by UPI on the same day. Those are two bank entries   */
/* with two references and two receipts, so the form is a LIST of  */
/* splits rather than one amount-and-mode pair. A popup could not   */
/* hold five of those plus their file pickers without becoming a   */
/* scroll box inside a scroll box.                                */
/*                                                                */
/* The status underneath is arithmetic by default and a decision    */
/* only when someone insists: pay 44,000 of 45,000 and it is       */
/* PARTIAL, unless the vendor agreed to close it — which is a      */
/* call a person makes, so it asks for a reason and a confirm.      */
/* ============================================================= */

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Mirrors the server's own caps so the sixth file or split is refused here
// rather than silently dropped by multer.
const MAX_PROOFS = 5;
const MAX_SPLITS = 5;

const blankSplit = () => ({ mode: "NEFT", amount: "", refNo: "", files: [] });

const round2 = (n) => Math.round(n * 100) / 100;

const RecordPaymentView = ({ invoice, onBack, onDone }) => {
  const [paidOn, setPaidOn] = useState(todayStr());
  const [remarks, setRemarks] = useState("");
  /*
    Opens with one split pre-filled to the whole balance, because clearing an
    invoice in one transfer is the common case and typing the balance back in
    by hand is the step people get wrong.
  */
  const [splits, setSplits] = useState(() => [
    { ...blankSplit(), amount: String(invoice.balance ?? "") },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Null while the arithmetic is being followed. Set only when somebody
  // deliberately disagrees with it.
  const [override, setOverride] = useState(null);         // PAID | PARTIAL | null
  const [overrideReason, setOverrideReason] = useState("");
  const [confirming, setConfirming] = useState(null);     // the state being forced

  const payable = invoice.payable || 0;
  const paidSoFar = invoice.paidTotal || 0;
  const balance = invoice.balance || 0;

  const total = useMemo(
    () => round2(splits.reduce((s, x) => s + (Number(x.amount) || 0), 0)),
    [splits]
  );

  const newPaidTotal = round2(paidSoFar + total);
  const newBalance = round2(payable - newPaidTotal);

  /*
    What the amounts say. Recomputed on every keystroke so the radio below
    moves with the number — the server works the same figure out again and is
    the one that decides, this is only what the screen promises.
  */
  const autoState =
    newPaidTotal <= 0
      ? PAYMENT_STATE.UNPAID
      : newBalance > 0
        ? PAYMENT_STATE.PARTIAL
        : PAYMENT_STATE.PAID;

  /*
    An override only counts while it DISAGREES with the arithmetic.

    Force PAID on a part payment, then raise the amount to the full balance,
    and the arithmetic catches up — at which point the override is no longer
    an override. Dropping it here is what stops the screen demanding a reason
    for a decision that is no longer being made. (The server does the same on
    its side, so nothing is stored either way.)
  */
  const activeOverride = override && override !== autoState ? override : null;
  const effectiveState = activeOverride || autoState;
  const overBalance = total > balance;

  const setSplit = (i, patch) =>
    setSplits((p) => p.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  const addSplit = () =>
    setSplits((p) => (p.length >= MAX_SPLITS ? p : [...p, blankSplit()]));

  const removeSplit = (i) => setSplits((p) => p.filter((_, k) => k !== i));

  const pickFiles = (i, e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    setSplit(i, { files: [...splits[i].files, ...picked].slice(0, MAX_PROOFS) });
  };

  const dropFile = (i, k) =>
    setSplit(i, { files: splits[i].files.filter((_, x) => x !== k) });

  /*
    Choosing a status by hand is a confirm, not a click.

    Going back to what the arithmetic says needs no ceremony — that is undoing
    an override, and the reason goes with it. Disagreeing with it does: money
    either gets written off or an invoice that is fully paid stays open, and
    both are things somebody will be asked about later.
  */
  const chooseState = (state) => {
    if (state === autoState) {
      setOverride(null);
      setOverrideReason("");
      return;
    }
    setConfirming(state);
  };

  const confirmOverride = () => {
    setOverride(confirming);
    setConfirming(null);
  };

  const cancelOverride = () => {
    setConfirming(null);
    setOverrideReason("");
  };

  const rows = splits.filter((s) => (Number(s.amount) || 0) > 0);
  const everyRowHasMode = rows.every((s) => !!s.mode);
  const needsReason = !!activeOverride && !overrideReason.trim();
  const canSubmit =
    !busy && rows.length > 0 && everyRowHasMode && !overBalance && !!paidOn && !needsReason;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append(
        "data",
        JSON.stringify({
          paidOn,
          remarks: remarks.trim(),
          total,
          splits: rows.map((s) => ({
            mode: s.mode,
            amount: Number(s.amount) || 0,
            refNo: s.refNo.trim(),
          })),
          // Always sent. The server clears the override when it agrees with
          // its own arithmetic, so no fully-paid invoice ends up carrying a
          // pointless "set by hand" mark.
          stateOverride: effectiveState,
          overrideReason: overrideReason.trim(),
        })
      );
      /*
        Files are named by their split's index in the list being SENT, not in
        the form — a row left empty is dropped above, and a bank slip attached
        to the wrong leg is worse than one attached to none.
      */
      rows.forEach((s, i) => s.files.forEach((f) => fd.append(`split_${i}_proofs`, f)));

      const res = await fetch(`${API_BACKEND_URL}/stock/payments/${invoice._id}/record`, {
        method: "POST", credentials: "include", body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to record payment");
      onDone();
    } catch (e) {
      setError(e.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  const history = invoice.payments || [];

  return (
    <div className="min-h-screen bg-slate-50/60 p-6">
      <div className="mx-auto max-w-4xl">
        <button
          type="button" onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Enter payment · Invoice {invoice.invoiceNumber}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
            <span>{invoice.vendorName}</span>
            <span>{invoice.poNumber || "—"}</span>
            <span>{paymentTermShort(invoice.paymentTerms)}</span>
            <span>Payable on {fmtDate(invoice.scheduledOn)}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Payable</p>
              <p className="font-semibold tabular-nums text-slate-900">{money(payable)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Paid so far</p>
              <p className="font-semibold tabular-nums text-slate-900">{money(paidSoFar)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Balance</p>
              <p className="font-semibold tabular-nums text-indigo-700">{money(balance)}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold">&times;</button>
          </div>
        )}

        {/* ── When and why ─────────────────────────────────────── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pay-date" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Payment date <span className="text-rose-500">*</span>
              </label>
              <input
                id="pay-date" type="date" value={paidOn} max={todayStr()}
                onChange={(e) => setPaidOn(e.target.value)} className={inputCls}
              />
              {/* One date for the whole settlement: splits of one payment go
                  out together, and a per-split date would invite recording two
                  separate payments as one. */}
              <p className="mt-1 text-[11px] text-slate-400">Applies to every split below.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pay-remarks" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Remarks
              </label>
              <input
                id="pay-remarks" type="text" value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional" className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ── The splits ───────────────────────────────────────── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">How it was paid</p>
              <p className="mt-0.5 text-xs text-slate-400">
                One row per bank entry — each keeps its own reference and receipt.
              </p>
            </div>
            <button
              type="button" onClick={addSplit} disabled={splits.length >= MAX_SPLITS}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              <Plus className="h-3.5 w-3.5" /> Add another mode
            </button>
          </div>

          <div className="space-y-3">
            {splits.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Split {i + 1}
                  </span>
                  {splits.length > 1 && (
                    <button
                      type="button" onClick={() => removeSplit(i)}
                      className="rounded-md border border-rose-200 bg-white p-1 text-rose-600 shadow-sm transition hover:bg-rose-50"
                      aria-label={`Remove split ${i + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`mode-${i}`} className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Mode <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id={`mode-${i}`} value={s.mode}
                      onChange={(e) => setSplit(i, { mode: e.target.value })}
                      className={inputCls}
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`amount-${i}`} className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Amount <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={`amount-${i}`} type="number" min="0" value={s.amount}
                      onChange={(e) => setSplit(i, { amount: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor={`ref-${i}`} className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Receipt / reference no.
                    </label>
                    <input
                      id={`ref-${i}`} type="text" value={s.refNo}
                      onChange={(e) => setSplit(i, { refNo: e.target.value })}
                      placeholder="UTR / cheque / UPI ref" className={inputCls}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label htmlFor={`proofs-${i}`} className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Proof <span className="font-normal text-slate-400">(up to {MAX_PROOFS}, JPG PNG WEBP or PDF)</span>
                  </label>
                  <input
                    id={`proofs-${i}`} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => pickFiles(i, e)}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {s.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.files.map((f, k) => (
                        <span key={k} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-[160px] truncate">{f.name}</span>
                          <button
                            type="button" onClick={() => dropFile(i, k)}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label={`Remove ${f.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-500">
              Total entered
              {rows.length > 1 && <span className="ml-1 text-xs text-slate-400">({rows.length} splits)</span>}
            </span>
            <span className="text-base font-bold tabular-nums text-slate-900">{money(total)}</span>
          </div>

          {overBalance && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              That is {money(total - balance)} more than the outstanding balance of {money(balance)}.
            </p>
          )}
        </div>

        {/* ── Status ───────────────────────────────────────────── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Status after this</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Set from the amount. Change it only if the invoice is being closed on different terms.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <StateRadio
              state={PAYMENT_STATE.PARTIAL} label="Partial Paid" icon={PieChart}
              hint={`${money(Math.max(0, newBalance))} still outstanding`}
              selected={effectiveState === PAYMENT_STATE.PARTIAL}
              auto={autoState === PAYMENT_STATE.PARTIAL}
              onSelect={chooseState}
            />
            <StateRadio
              state={PAYMENT_STATE.PAID} label="Paid" icon={CheckCircle2}
              hint="Nothing further is owed"
              selected={effectiveState === PAYMENT_STATE.PAID}
              auto={autoState === PAYMENT_STATE.PAID}
              onSelect={chooseState}
            />
          </div>

          {activeOverride && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Set by hand — the amount says {PAYMENT_STATE_LABEL[autoState]}
              </p>
              <label htmlFor="override-reason" className="mb-1.5 mt-2 block text-xs font-semibold text-slate-700">
                Why <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="override-reason" rows={2} value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={
                  activeOverride === PAYMENT_STATE.PAID
                    ? "Vendor agreed to settle at this amount…"
                    : "Kept open because…"
                }
                className={inputCls}
              />
              <button
                type="button" onClick={() => { setOverride(null); setOverrideReason(""); }}
                className="mt-2 text-xs font-semibold text-amber-700 underline"
              >
                Go back to {PAYMENT_STATE_LABEL[autoState]}
              </button>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
              Already recorded ({history.length})
            </p>
            <div className="space-y-1.5">
              {history.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <span className="font-semibold tabular-nums text-slate-900">{money(p.amount)}</span>
                  <span className="text-slate-500">{PAYMENT_MODE_LABEL[p.mode] || p.mode}</span>
                  <span className="text-slate-500">{fmtDate(p.paidOn)}</span>
                  {p.refNo && <span className="text-slate-400">{p.refNo}</span>}
                  {(p.proofs || []).length > 0 && (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Paperclip className="h-3 w-3" /> {p.proofs.length}
                    </span>
                  )}
                  <span className="ml-auto text-slate-400">{p.byName || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button" onClick={onBack} disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button" onClick={submit} disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Wallet className="h-4 w-4" />
            {busy ? "Saving…" : `Save payment of ${money(total)}`}
          </button>
        </div>
      </div>

      {confirming && (
        <OverrideConfirm
          state={confirming} autoState={autoState}
          shortBy={Math.max(0, newBalance)}
          onCancel={cancelOverride} onConfirm={confirmOverride}
        />
      )}
    </div>
  );
};

/* ── Labels used in prose, where the chip metadata reads wrong ─── */
const PAYMENT_STATE_LABEL = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial Paid",
  PAID: "Paid",
};

/* ── One status choice ─────────────────────────────────────────── */
/* Module scope so the radios are not a fresh component type on   */
/* every keystroke in the amount fields above them.               */
const StateRadio = ({ state, label, icon: Icon, hint, selected, auto, onSelect }) => (
  <label
    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
      selected ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 hover:bg-slate-50"
    }`}
  >
    <input
      type="radio" name="payment-state" checked={selected}
      onChange={() => onSelect(state)}
      className="mt-0.5 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
    />
    <span className="min-w-0">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-slate-400" /> {label}
        {/* Which one the arithmetic picked, so an override is visibly a
            departure rather than just another option. */}
        {auto && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            from amount
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
    </span>
  </label>
);

/* ── The confirm before a status is forced ─────────────────────── */
/* Spelled out in money, not in status names. "Are you sure you    */
/* want PAID" tells nobody anything; "5,000 will be written off"   */
/* is the actual consequence.                                      */
const OverrideConfirm = ({ state, autoState, shortBy, onCancel, onConfirm }) => {
  const closingShort = state === PAYMENT_STATE.PAID && autoState === PAYMENT_STATE.PARTIAL;

  return (
    <Modal onClose={onCancel} title="Change the status by hand?" maxWidth="max-w-lg">
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          The amount entered makes this {PAYMENT_STATE_LABEL[autoState]}
        </p>

        {closingShort ? (
          <div className="mt-2 space-y-2 text-sm text-amber-900">
            <p>
              Marking it <strong>Paid</strong> closes the invoice with{" "}
              <strong className="tabular-nums">{money(shortBy)}</strong> unpaid. That amount
              is written off and will show against this vendor in the ledger.
            </p>
            {/* The server refuses further payment on a PAID invoice, so this
                is genuinely one-way — saying so here is the difference between
                a warning and a trap. */}
            <p className="font-semibold">
              This will not reopen. No further payment can be recorded against this invoice.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-amber-900">
            <p>
              Marking it <strong>Partial Paid</strong> keeps the invoice open even though the
              full payable has been received.
            </p>
            <p>It will keep appearing in the unpaid queues until someone closes it.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        A reason is required on the next screen and is kept with the invoice.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button" onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Keep {PAYMENT_STATE_LABEL[autoState]}
        </button>
        <button
          type="button" onClick={onConfirm}
          className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
        >
          Yes, set {PAYMENT_STATE_LABEL[state]}
        </button>
      </div>
    </Modal>
  );
};

export default RecordPaymentView;
