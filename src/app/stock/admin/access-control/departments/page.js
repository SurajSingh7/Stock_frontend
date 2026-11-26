import DepartmentRestrictions from '@/modules/accessControl/departments/DepartmentRestrictions';
import RequireAdmin from '@/modules/accessControl/RequireAdmin';

const Page = () => (
  <RequireAdmin>
    <DepartmentRestrictions />
  </RequireAdmin>
);

export default Page;
