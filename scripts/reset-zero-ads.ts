import { config } from 'dotenv';
config({ path: '.env.local' });
import { prisma } from '../src/lib/prisma';

async function reset() {
  // Reset brands that have no ads and aren't permanently failed
  const result = await prisma.adLibraryBrand.updateMany({
    where: {
      ads: { none: {} },
      failCount: { lt: 10 }  // Not permanently failed
    },
    data: { 
      ingestionStatus: 'pending',
      failCount: 0
    }
  });
  
  console.log('Reset', result.count, 'brands with 0 ads for re-ingestion');
  
  const pending = await prisma.adLibraryBrand.count({ where: { ingestionStatus: 'pending' } });
  console.log('Total pending:', pending);
  
  await prisma.$disconnect();
}
reset();
