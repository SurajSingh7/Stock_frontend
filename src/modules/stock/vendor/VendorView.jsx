"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, ShieldCheck, ShieldAlert, CreditCard, Percent, Package, IdCard,
  MapPin, Phone, Mail, User, Landmark, StickyNote, Users, Copy, Check,
} from "lucide-react";
import { fetchVendor, fetchCategory } from "./vendorApi";
import { PAYMENT_TERMS } from "./vendorConstants";
import { formatWarrantyShort } from "@/shared/warranty/warranty";

/*
  Vendor detail — a read-only page of its own (the edit form with every
  control disabled read like a form, not a record). Everything the vendor
  carries, grouped: identity and money terms on top, GST and address, the
  products they supply, then who to contact and where to pay.
*/

const PAYMENT_LABEL = Object.fromEntries(PAYMENT_TERMS.map((p) => [p.value, p.label]));
const dash = <span className="font-normal text-slate-300">—</span>;
const wrap = "break-words [overflow-wrap:anywhere]";

const TONE = {
  indigo: { box: "border-indigo-100 bg-indigo-50/60", icon: "bg-indigo-100 text-indigo-600", label: "text-indigo-500" },
  emerald: { box: "border-emerald-100 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-600", label: "text-emerald-600" },
  amber: { box: "border-amber-100 bg-amber-50/60", icon: "bg-amber-100 text-amber-600", label: "text-amber-600" },
  violet: { box: "border-violet-100 bg-violet-50/60", icon: "bg-violet-100 text-violet-600", label: "text-violet-500" },
  sky: { box: "border-sky-100 bg-sky-50/60", icon: "bg-sky-100 text-sky-600", label: "text-sky-600" },
  rose: { box: "border-rose-100 bg-rose-50/60", icon: "bg-rose-100 text-rose-600", label: "text-rose-500" },
};

const Fact = ({ icon: FIcon, label, tone, children }) => {
  const t = TONE[tone];
  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-xl border px-4 py-3 ${t.box}`}>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
        <FIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${t.label}`}>{label}</p>
        <div className={`mt-0.5 text-sm font-semibold text-slate-900 ${wrap}`}>{children}</div>
      </div>
    </div>
  );
};

const Card = ({ icon: CIcon, title, right, children, className = "" }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CIcon className="h-4 w-4 text-slate-400" /> {title}
      </h2>
      {right}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const Row = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-3 border-b border-slate-50 py-2 last:border-0">
    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className={`col-span-2 text-sm text-slate-800 ${wrap}`}>{children || dash}</dd>
  </div>
);

const CopyText = ({ value }) => {
  const [done, setDone] = useState(false);
  if (!value) return dash;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono">{value}</span>
      <button
        type="button"
        title="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {});
        }}
        className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
};

const RECIPIENT = { TO: "To", CC: "CC", NONE: "" };

const VendorView = ({ vendorId }) => {
  const router = useRouter();
  const [vendor, setVendor] = useState(null);
  const [parent, setParent] = useState(null);
  const [error, setError] = useState(null);
  const [pathMap, setPathMap] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // A deleted vendor can still be inspected from the Inactive tab.
        const v = await fetchVendor(vendorId, { includeInactive: true });
        if (!alive) return;
        setVendor(v);
        if (v.parentVendorId) {
          fetchVendor(v.parentVendorId, { includeInactive: true }).then((p) => alive && setParent(p)).catch(() => {});
        }
        // Each assigned category's full breadcrumb.
        const ids = [...new Set((v.assignedProducts || []).map((ap) => ap.categoryId?._id || ap.categoryId).filter(Boolean))];
        const entries = await Promise.all(
          ids.map((id) => fetchCategory(id).then((c) => [id, c?.displayPath || c?.name || ""]).catch(() => [id, ""]))
        );
        if (alive) setPathMap(Object.fromEntries(entries));
      } catch (e) {
        if (alive) setError(e.message || "Failed to load vendor");
      }
    })();
    return () => { alive = false; };
  }, [vendorId]);

  const groups = useMemo(
    () =>
      (vendor?.assignedProducts || [])
        .filter((ap) => ap.categoryId)
        .map((ap) => {
          const id = ap.categoryId?._id || ap.categoryId;
          return {
            id,
            name: pathMap[id] || ap.categoryId?.name || ap.categoryName || "",
            products: (ap.products || []).map((p) => ({
              id: p.productId?._id || p.productId,
              name: p.productId?.name || "—",
              warrantyMonths: p.overrides?.warrantyMonths ?? p.productId?.warrantyMonths ?? null,
            })),
          };
        }),
    [vendor, pathMap]
  );

  const back = (
    <button
      type="button" onClick={() => router.push("/stock/vendors")}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        {back}
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 p-6">
        <div className="h-10 w-64 rounded-lg bg-slate-100" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100" />)}
        </div>
        <div className="h-64 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const gst = vendor.gst || {};
  const addr = vendor.address || {};
  const productTotal = groups.reduce((n, g) => n + g.products.length, 0);
  const contacts = (vendor.contacts || []).filter((c) => c.name || c.phone || c.email);
  const banks = (vendor.bankAccounts || []).filter((b) => b.accountNumber || b.bankName || b.ifsc);

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 pb-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {back}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={`text-xl font-semibold tracking-tight text-slate-900 ${wrap}`}>{vendor.name}</h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  vendor.isActive !== false ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${vendor.isActive !== false ? "bg-emerald-500" : "bg-rose-500"}`} />
                {vendor.isActive !== false ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              {vendor.vendorCode && <span className="font-mono text-slate-600">{vendor.vendorCode}</span>}
              {vendor.vendorAlias && <span>Alias: <span className="font-medium text-slate-700">{vendor.vendorAlias}</span></span>}
              {vendor.parentVendorId && (
                <span className="inline-flex items-center gap-1 text-violet-600">
                  <Users className="h-3.5 w-3.5" /> under {parent?.name || "main vendor"}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Key facts */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Fact icon={gst.isVerified ? ShieldCheck : ShieldAlert} label="GST" tone={gst.isVerified ? "emerald" : "amber"}>
            {!gst.isAvailable ? "Not registered" : gst.isVerified ? "Verified" : "Not verified"}
          </Fact>
          <Fact icon={IdCard} label="PAN" tone="indigo">{vendor.panNumber || "—"}</Fact>
          <Fact icon={Building2} label="Branch" tone="sky">{vendor.branchName || "—"}</Fact>
          <Fact icon={CreditCard} label="Payment" tone="violet">{PAYMENT_LABEL[vendor.paymentTerms] || vendor.paymentTerms || "—"}</Fact>
          <Fact icon={Percent} label="TDS" tone="amber">{vendor.tdsRate > 0 ? `${vendor.tdsRate}%` : "None"}</Fact>
          <Fact icon={Package} label="Products" tone="rose">{productTotal}</Fact>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: GST, address, products, notes */}
          <div className="space-y-5 lg:col-span-2">
            <Card icon={ShieldCheck} title="GST details">
              {gst.isAvailable === false ? (
                <p className="text-sm text-slate-500">This vendor is not GST registered.</p>
              ) : (
                <dl>
                  <Row label="GST number"><CopyText value={gst.gstNumber} /></Row>
                  <Row label="Legal name">{gst.legalName}</Row>
                  <Row label="Trade name">{gst.tradeName}</Row>
                  <Row label="State">{gst.state?.name ? `${gst.state.name}${gst.state.code ? ` (${gst.state.code})` : ""}` : ""}</Row>
                  <Row label="Registered address">{gst.gstAddress}</Row>
                  <Row label="Verified on">{gst.verifiedAt ? new Date(gst.verifiedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</Row>
                </dl>
              )}
            </Card>

            <Card icon={MapPin} title="Address">
              <dl>
                <Row label="Address">{addr.fullAddress}</Row>
                <Row label="Area">{addr.area}</Row>
                <Row label="City">{addr.city}</Row>
                <Row label="State">{addr.state?.name ? `${addr.state.name}${addr.state.code ? ` (${addr.state.code})` : ""}` : ""}</Row>
                <Row label="PIN code">{addr.pinCode}</Row>
              </dl>
            </Card>

            <Card
              icon={Package}
              title="Assigned products"
              right={<span className="text-xs text-slate-400">{groups.length} categor{groups.length === 1 ? "y" : "ies"} · {productTotal} product{productTotal === 1 ? "" : "s"}</span>}
            >
              {groups.length === 0 ? (
                <p className="text-sm text-slate-400">No products assigned.</p>
              ) : (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <div key={g.id}>
                      <p className={`mb-2 text-xs font-semibold text-slate-600 ${wrap}`}>{g.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.products.length === 0 ? (
                          <span className="text-xs text-slate-400">No products selected in this category</span>
                        ) : (
                          g.products.map((p) => (
                            <span key={p.id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100">
                              {p.name}
                              {p.warrantyMonths ? ` · ${formatWarrantyShort(p.warrantyMonths)}` : ""}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {vendor.notes && (
              <Card icon={StickyNote} title="Notes">
                <p className={`whitespace-pre-line text-sm leading-relaxed text-slate-700 ${wrap}`}>{vendor.notes}</p>
              </Card>
            )}
          </div>

          {/* Right: contacts and bank accounts */}
          <div className="space-y-5">
            <Card icon={User} title="Contacts" right={<span className="text-xs text-slate-400">{contacts.length}</span>}>
              {contacts.length === 0 ? (
                <p className="text-sm text-slate-400">No contacts.</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold text-slate-900 ${wrap}`}>{c.name || "—"}</p>
                          {(c.designation || c.department) && (
                            <p className="text-xs text-slate-500">{[c.designation, c.department].filter(Boolean).join(" · ")}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {c.label === "PRIMARY" && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-600 ring-1 ring-inset ring-indigo-200">Primary</span>
                          )}
                          {RECIPIENT[c.recipientType] && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 ring-1 ring-inset ring-emerald-200">
                              {RECIPIENT[c.recipientType]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-600">
                            <Phone className="h-3.5 w-3.5 text-slate-400" /> {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className={`flex items-center gap-2 text-slate-700 hover:text-indigo-600 ${wrap}`}>
                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" /> {c.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card icon={Landmark} title="Bank accounts" right={<span className="text-xs text-slate-400">{banks.length}</span>}>
              {banks.length === 0 ? (
                <p className="text-sm text-slate-400">No bank accounts.</p>
              ) : (
                <div className="space-y-3">
                  {banks.map((b, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold text-slate-900 ${wrap}`}>{b.bankName || "Bank"}</p>
                        {b.label === "PRIMARY" && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-600 ring-1 ring-inset ring-indigo-200">Primary</span>
                        )}
                      </div>
                      <dl className="space-y-1 text-xs">
                        <div className="flex justify-between gap-3"><dt className="text-slate-400">Account</dt><dd className="text-slate-800"><CopyText value={b.accountNumber} /></dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-400">IFSC</dt><dd className="text-slate-800"><CopyText value={b.ifsc} /></dd></div>
                        {b.branch && <div className="flex justify-between gap-3"><dt className="text-slate-400">Branch</dt><dd className={`text-right text-slate-800 ${wrap}`}>{b.branch}</dd></div>}
                        {b.city && <div className="flex justify-between gap-3"><dt className="text-slate-400">City</dt><dd className="text-slate-800">{b.city}</dd></div>}
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorView;
