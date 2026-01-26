import { auth } from '@/auth';
import { getSubscriptionStatus, type SubscriptionStatus as Status } from '@/lib/subscription';
import { UpgradeButton } from './upgrade-button';
import { ManageSubscriptionButton } from './manage-subscription-button';

export async function SubscriptionStatus() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  const status = await getSubscriptionStatus(session.user.email);

  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={status} />
      <StatusAction status={status} />
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  switch (status) {
    case 'pro':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          Pro
        </span>
      );
    case 'past_due':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Payment Issue
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          Free
        </span>
      );
  }
}

function StatusAction({ status }: { status: Status }) {
  switch (status) {
    case 'pro':
    case 'past_due':
      return <ManageSubscriptionButton />;
    case 'cancelled':
      // User can resubscribe via upgrade button
      return <UpgradeButton />;
    default:
      // Free users see upgrade button (handled by UpgradeButton in header)
      return null;
  }
}
