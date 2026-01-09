import { PrismaClient } from "@prisma/client"
import * as fs from 'fs'
import * as path from "path"
import { SEED_FILES } from "./seeds/seed-files"

const filePath = path.join(__dirname, 'seeds/')
const prisma = new PrismaClient()

// Transform data types for specific tables
function transformData(tableName: string, data: any[]): any[] {
    if (tableName === 'MenuMaster') {
        return data.map(item => ({
            ...item,
            parentId:
                item.parentId === '' ||
                item.parentId === null ||
                item.parentId === undefined
                    ? null
                    : Number(item.parentId),
        }))
    }

    return data
}


async function main() {
    console.log('Seeding Database....')
    for (const seed of SEED_FILES) {
        try {
            const fileName = filePath + seed.name + '.json'
            const data: any = fs.readFileSync(fileName, 'utf-8')
            let parsed_data = JSON.parse(data)
            parsed_data = transformData(seed.table, parsed_data)
            await prisma[seed.table].createMany({
                data: parsed_data
            })
            console.log(`Seeded ${seed.table} with ${seed.name}.json`)
        } catch (error) {
            console.error(`Error reading file: ${seed.name}.json`, error.stack)
            console.info(`
                Recommendation:
                1.Drop the database and Re-create
                2.Deploy migration (npx prisma migrate deploy)
                3.Resolve the error
                4.Re-run the seed command(npm run seed)
                `
            )
            break;
        }

    }
}

main()
    .then(async () => {
        console.log('Seeding Completed')
        console.info(`Recommendation: Seed (CountryMaster) and (StateMaster) table (npm run seed:CountryMaster). Ignore if already did.`)
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })