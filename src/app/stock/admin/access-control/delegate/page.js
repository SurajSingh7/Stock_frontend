import DelegateAccess from '@/modules/accessControl/delegate/DelegateAccess';
import RequireAdmin from '@/modules/accessControl/RequireAdmin';

const Page = () => (
  <RequireAdmin>
    <DelegateAccess />
  </RequireAdmin>
);

export default Page;
