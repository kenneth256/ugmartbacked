import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const main = async () => {
  console.log('🌱 Starting seed...');

  const email = "admin@gmail.com";
  const name = "Kenneth";
  const password = "123456";

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { role: "SUPER_ADMIN" }
      ]
    }
  });

  if (existingAdmin) {
    console.log("✅ Admin already exists:", existingAdmin.email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });


};

main()
  .catch((e) => {
    console.error("❌ Error creating admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
