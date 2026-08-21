import AuditLog from '@/modules/accessControl/auditLog/AuditLog';
import RequireAdmin from '@/modules/accessControl/RequireAdmin';

const Page = () => (
  <RequireAdmin>
    <AuditLog />
  </RequireAdmin>
);

export default Page;
