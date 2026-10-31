import { api } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/constants/api";

/*
  The money side of an invoice — Invoice List, Payments and Approvals. Each is
  its own module, so the popups they share take the `base` their screen may
  read through: "invoice-list" | "payments" | "payment-approval".
*/
const { invoiceList: IL, invoiceScoped, payments: PAY, paymentApproval: PA, debitNoteQueues } = API_ENDPOINTS.purchase;

/* ------------------------------ lists ------------------------------ */

// query: URLSearchParams or a plain object of the list filters.
export const fetchInvoiceList = (query) => api.get(IL.list, { query, fallback: "Failed to load invoices" });
export const fetchPayments = (query) => api.get(PAY.list, { query, fallback: "Failed to load" });
export const fetchPaymentApprovals = (query) => api.get(PA.list, { query, fallback: "Failed to load" });

/* ------------------------- shared per invoice ------------------------- */

export const fetchAdjustments = async (base, invoiceId) =>
  (await api.get(invoiceScoped.adjustments(base, invoiceId), { fallback: "Failed to load" })).data || [];

export const fetchDebitNotes = async (base, invoiceId) =>
  (await api.get(invoiceScoped.debitNotes(base, invoiceId), { fallback: "Failed to load debit notes" })).data || [];

/* ---------------------------- invoice list ---------------------------- */

export const scheduleInvoice = (invoiceId, body) => api.patch(IL.schedule(invoiceId), body, { fallback: "Failed to save" });

// adjustmentId: the debit note being resubmitted (its lines come back marked).
export const fetchDebitNoteItems = async (invoiceId, adjustmentId) =>
  (await api.get(IL.debitNoteItems(invoiceId), { query: { adjustmentId }, fallback: "Failed to load items" })).data;

export const raiseDebitNote = (invoiceId, body) =>
  api.post(invoiceScoped.debitNotes("invoice-list", invoiceId), body, { fallback: "Failed to save debit note" });
export const resubmitDebitNote = (debitNoteId, body) =>
  api.patch(IL.resubmitDebitNote(debitNoteId), body, { fallback: "Failed to save debit note" });
export const withdrawDebitNote = (debitNoteId, reason) =>
  api.patch(IL.withdrawDebitNote(debitNoteId), { reason }, { fallback: "Failed to withdraw" });

/* ------------------------------ payments ------------------------------ */

export const addMiscAdjustment = (invoiceId, body) =>
  api.post(invoiceScoped.adjustments("payments", invoiceId), body, { fallback: "Failed to save" });
export const editAdjustment = (adjustmentId, body) => api.patch(PAY.adjustment(adjustmentId), body, { fallback: "Failed to save" });

export const sendForApproval = (invoiceId, reason) =>
  api.patch(PAY.sendForApproval(invoiceId), { reason }, { fallback: "Failed to send" });

export const updateTds = (invoiceId, body) => api.patch(PAY.tds(invoiceId), body, { fallback: "Failed to update TDS" });

// FormData: the splits plus each one's proof files.
export const recordPayment = (invoiceId, formData) => api.post(PAY.record(invoiceId), formData, { fallback: "Failed to record payment" });

/* ---------------------------- approvals ---------------------------- */

export const decidePayment = (invoiceId, body) => api.patch(PA.decide(invoiceId), body, { fallback: "Failed to save" });

/* ------------------------ debit note queues ------------------------ */

// mode: "payments" (review step) | "paymentApproval" (approval step)
export const fetchDebitNoteQueue = (mode, query) =>
  api.get(debitNoteQueues[mode].list, { query, fallback: "Failed to load debit notes" });
export const actOnDebitNote = (mode, debitNoteId, body) => {
  const q = debitNoteQueues[mode];
  return api.patch((q.review || q.decide)(debitNoteId), body, { fallback: "Failed" });
};
