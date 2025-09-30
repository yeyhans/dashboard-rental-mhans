import UsersDashboard from './UsersDashboard';
import { Toaster } from './ui/sonner';
import type { UserProfile } from '../types/user';

interface UsersDashboardWithToasterProps {
  initialUsers: UserProfile[];
  initialTotal: number;
  sessionToken: string;
}

const UsersDashboardWithToaster = ({ initialUsers, initialTotal, sessionToken }: UsersDashboardWithToasterProps) => {
  return (
    <>
      <UsersDashboard 
        initialUsers={initialUsers}
        initialTotal={initialTotal}
        sessionToken={sessionToken}
      />
      <Toaster />
    </>
  );
};

export default UsersDashboardWithToaster;
