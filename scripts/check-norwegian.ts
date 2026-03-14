import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const brand = await prisma.adLibraryBrand.findUnique({ where: { pageId: '508508692627039' } });
  if (!brand) { console.log('Brand not found'); return; }
  console.log('Brand:', brand.pageName, '- ID:', brand.id);
  const total = await prisma.adLibraryAd.count({ where: { brandId: brand.id } });
  const videos = await prisma.adLibraryAd.count({ where: { brandId: brand.id, displayFormat: 'video' } });
  const images = await prisma.adLibraryAd.count({ where: { brandId: brand.id, displayFormat: 'image' } });
  const carousels = await prisma.adLibraryAd.count({ where: { brandId: brand.id, displayFormat: 'carousel' } });
  console.log(`Total: ${total} | Videos: ${videos} | Images: ${images} | Carousels: ${carousels}`);
  console.log('ingestionStatus:', brand.ingestionStatus, '| pageId:', brand.pageId);
  await prisma.$disconnect();
}
main();
