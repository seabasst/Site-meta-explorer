import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.adLibraryBrand.updateMany({
    where: { category: 'airline', ingestionStatus: { not: 'pending' } },
    data: { ingestionStatus: 'pending', failCount: 0 },
  });
  console.log('Reset', result.count, 'airline brands to pending');
  await prisma.$disconnect();
}
main();
