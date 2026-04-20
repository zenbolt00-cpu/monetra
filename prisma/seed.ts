import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from 'bcryptjs'
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminPassword = await bcrypt.hash('Admin@123', 10)
  const vendorPassword = await bcrypt.hash('Vendor@123', 10)

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@montera.app' },
    update: {},
    create: {
      email: 'admin@montera.app',
      name: 'Montera Admin',
      password: adminPassword,
      role: Role.ADMIN,
    },
  })

  // Create Vendor 1
  const vendor1 = await prisma.vendor.upsert({
    where: { email: 'sharma@vendor.com' },
    update: {},
    create: {
      name: 'Sharma Textiles',
      email: 'sharma@vendor.com',
      phone: '+91-9876543210',
      users: {
        create: {
          email: 'sharma@vendor.com',
          name: 'Sharma Admin',
          password: vendorPassword,
          role: Role.VENDOR,
        },
      },
    },
  })

  // Create Vendor 2
  const vendor2 = await prisma.vendor.upsert({
    where: { email: 'kapoor@vendor.com' },
    update: {},
    create: {
      name: 'Kapoor Fabrics',
      email: 'kapoor@vendor.com',
      phone: '+91-9123456789',
      users: {
        create: {
          email: 'kapoor@vendor.com',
          name: 'Kapoor Admin',
          password: vendorPassword,
          role: Role.VENDOR,
        },
      },
    },
  })

  console.log({ admin, vendor1, vendor2 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
