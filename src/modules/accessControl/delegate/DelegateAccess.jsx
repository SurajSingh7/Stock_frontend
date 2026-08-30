'use client';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getModules, delegateAccess } from '../api';
import { searchHrmsUsers } from '../hrmsDirectory';
import { PageShell, Card, Field, PrimaryButton, Picker, Banner, TableShell, EmptyRow, Mono, ActionPill } from '../shared';

const DelegateAccess = () => {
  const [modules, setModules] = useState([]);
  const [fromUser, setFromUser] = useState(null); // { id, label, description, roleId, roleName }
  const [toUser, setToUser] = useState(null);
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getModules().then((res) => setModules(res.data || [])).catch((err) => toast.error(err.message));
  }, []);

  const toggleModule = (id) =>
    setSelectedModuleIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!fromUser || !toUser) {
      toast.error('Pick both a source and a target user.');
      return;
    }
    if (!fromUser.roleId) {
      toast.error("The source user has no HRMS role — can't compute their access.");
      return;
    }
    if (fromUser.id === toUser.id) {
      toast.error('Source and target can’t be the same user.');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await delegateAccess({
        fromUserId: fromUser.id,
        fromRoleId: fromUser.roleId,
        toUserId: toUser.id,
        moduleIds: selectedModuleIds.length ? selectedModuleIds : undefined,
      });
      setResult(res.data);
      toast.success('Access delegated.');
    } catch (err) {
      toast.error(err.message || 'Failed to delegate access.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      question="One-time copy"
      title="Delegate Access"
      description="Copy everything User A can currently do onto User B — a snapshot, not a live link. Changing A afterwards never touches B, and B keeps their own role's baseline underneath. This only ever adds."
    >

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="space-y-4">
            <Field label="From" hint={fromUser?.roleName ? `Role: ${fromUser.roleName}` : "Whose access is being copied."}>
              <Picker fetcher={searchHrmsUsers} placeholder="Search HRMS users…" selected={fromUser} onSelect={setFromUser} onClear={() => setFromUser(null)} />
            </Field>
            <Field label="To" hint="Who receives the copy.">
              <Picker fetcher={searchHrmsUsers} placeholder="Search HRMS users…" selected={toUser} onSelect={setToUser} onClear={() => setToUser(null)} />
            </Field>
            <Field label="Modules" hint="Leave all unchecked to copy every module.">
              <div className="flex flex-wrap gap-2">
                {modules.map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => toggleModule(m._id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedModuleIds.includes(m._id)
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </Field>
            <PrimaryButton onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Copying…' : 'Copy access'}
            </PrimaryButton>
          </div>
        </Card>

        <Card title="Result" description="What was actually copied." className="lg:col-span-2 h-fit">
          {!result ? (
            <Banner>Nothing copied yet — fill in the form and submit.</Banner>
          ) : (
            <div className="space-y-3">
              <Banner tone="success">
                Copied from <span className="font-mono">{result.delegation.fromUserId}</span> to{' '}
                <span className="font-mono">{result.delegation.toUserId}</span> — batch{' '}
                <span className="font-mono">{result.delegation.batchId}</span>
              </Banner>
              <TableShell head={['Module', 'Actions granted to B']}>
                {result.copied.length === 0 ? (
                  <EmptyRow colSpan={2}>Nothing to copy — A has no access on the selected modules.</EmptyRow>
                ) : (
                  result.copied.map((c) => (
                    <tr key={c.moduleId} className="align-top">
                      <td className="px-4 py-3.5"><Mono>{c.moduleKey}</Mono></td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {c.actions.length === 0 ? (
                            <span className="text-xs text-slate-400">none</span>
                          ) : (
                            c.actions.map((a) => <ActionPill key={a} state="added">{a}</ActionPill>)
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </TableShell>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
};

export default DelegateAccess;
