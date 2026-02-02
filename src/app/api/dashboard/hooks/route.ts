import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET — fetch hook groups for a snapshot, sorted by totalReach descending
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get('snapshotId');

  if (!snapshotId) {
    return NextResponse.json({ error: 'Missing snapshotId' }, { status: 400 });
  }

  // Verify the snapshot belongs to this user
  const snapshot = await prisma.brandSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId: session.user.id,
    },
  });

  if (!snapshot) {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
  }

  // Fetch hook groups sorted by totalReach descending (uses @@index([snapshotId, totalReach]))
  const hookGroups = await prisma.hookGroup.findMany({
    where: { snapshotId },
    orderBy: { totalReach: 'desc' },
  });

  return NextResponse.json({ hookGroups: hookGroups.map(serialize) });
}

// BigInt is not JSON-serializable by default
function serialize(record: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(record, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
