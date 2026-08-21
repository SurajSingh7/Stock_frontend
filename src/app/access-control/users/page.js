import UserOverrides from '@/modules/accessControl/users/UserOverrides';
import RequireAdmin from '@/modules/accessControl/RequireAdmin';

const Page = () => (
  <RequireAdmin>
    <UserOverrides />
  </RequireAdmin>
);

export default Page;
