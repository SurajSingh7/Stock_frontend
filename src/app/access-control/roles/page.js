import RolePermissions from '@/modules/accessControl/roles/RolePermissions';
import RequireAdmin from '@/modules/accessControl/RequireAdmin';

const Page = () => (
  <RequireAdmin>
    <RolePermissions />
  </RequireAdmin>
);

export default Page;
