import ApiMonitorClient from '@/components/superadmin/ApiMonitorClient';
import { FC } from 'react';

interface PageProps {}

const Page: FC<PageProps> = ({}) => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Call Monitor</h1>
      <ApiMonitorClient />
    </div>
  );
};

export default Page;
