import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = ['GUEST', 'LEARNER', 'CREATOR', 'ADMIN'];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeded roles: ', roles.join(', '));
}

main()
  .catch((err) => {
    console.error('Error while seeding roles:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
