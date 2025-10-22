// import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/index.js';
const prisma = new PrismaClient();
PrismaClient;
const main = async () => {
    const email = "kennethdavid256@gmail.com";
    const name = "Kenneth";
    const password = "123456";
    const adminExists = await prisma.user.findFirst({
        where: {
            role: "SUPER_ADMIN"
        }
    });
    if (adminExists) {
        console.log("admin already exists");
    }
    const hashedpassword = await bcrypt.hash(password, 5);
    await prisma.user.create({
        data: {
            name,
            email,
            password: hashedpassword,
            role: "SUPER_ADMIN"
        }
    });
};
main().catch((e) => {
    console.error("error creating admin", e),
        process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map