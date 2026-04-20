import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // Clean existing data
  await prisma.corporateSalesSnapshot.deleteMany();
  await prisma.corporateSale.deleteMany();
  await prisma.user.deleteMany();

  // Create users (sellers)
  const sellers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'joao.silva@empresa.com',
        name: 'João Silva',
        password: await bcryptjs.hash('senha123', 10),
      },
    }),
    prisma.user.create({
      data: {
        email: 'maria.santos@empresa.com',
        name: 'Maria Santos',
        password: await bcryptjs.hash('senha123', 10),
      },
    }),
    prisma.user.create({
      data: {
        email: 'pedro.oliveira@empresa.com',
        name: 'Pedro Oliveira',
        password: await bcryptjs.hash('senha123', 10),
      },
    }),
    prisma.user.create({
      data: {
        email: 'ana.costa@empresa.com',
        name: 'Ana Costa',
        password: await bcryptjs.hash('senha123', 10),
      },
    }),
  ]);

  console.log(`Criados ${sellers.length} vendedores`);

  // Create sample sales
  const clients = ['Empresa A', 'Empresa B', 'Empresa C', 'Empresa D', 'Empresa E'];
  const products = ['Produto X', 'Produto Y', 'Produto Z', 'Produto W'];

  const sales = [];
  const startDate = new Date('2024-01-01');
  const endDate = new Date();

  for (let i = 0; i < 200; i++) {
    const date = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    const seller = sellers[Math.floor(Math.random() * sellers.length)];
    const client = clients[Math.floor(Math.random() * clients.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const amount = 1000 + Math.random() * 9000;

    sales.push(
      prisma.corporateSale.create({
        data: {
          date,
          sellerId: seller.id,
          client,
          product,
          amount: Math.round(amount * 100) / 100,
          commission: Math.round((amount * 0.1) * 100) / 100,
          status: Math.random() > 0.1 ? 'COMPLETED' : 'PENDING',
        },
      })
    );
  }

  await Promise.all(sales);
  console.log(`Criadas ${sales.length} vendas`);

  console.log('Seed completo!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
