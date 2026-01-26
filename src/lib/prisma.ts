import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy initialization to avoid build-time errors
function createPrismaClient(): PrismaClient {
  return new PrismaClient()
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

// Export a proxy for lazy initialization at runtime
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return getPrisma()[prop as keyof PrismaClient]
  },
})
