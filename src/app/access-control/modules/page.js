import ModulesOverview from '@/modules/accessControl/modules/ModulesOverview';
import RequireAdmin from '@/modules/accessControl/RequireAdmin';

const Page = () => (
  <RequireAdmin>
    <ModulesOverview />
  </RequireAdmin>
);

export default Page;
