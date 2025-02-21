// import { Module } from '@nestjs/common';
// import { SequelizeModule } from '@nestjs/sequelize';

// @Module({
//     imports:[
//         SequelizeModule.forRoot({
//             dialect: 'postgres',       // Specifies the database type (PostgreSQL)
//             host: '192.168.2.10',         // Database server host  :192.168.2.10
//             port: 5432,                // Port number for PostgreSQL
//             username: 'postgres', // PostgreSQL username
//             password: 'Nevergiveup@2025', // PostgreSQL password Nevergiveup#2025
//             database: 'postgres', // Database name
//             autoLoadModels: true,      // Automatically loads models registered in modules
//             synchronize: false,         // Syncs models with the database (use cautiously in production)
//           })
//     ],
//     exports: [SequelizeModule], // Export SequelizeModule to be used in other modules
// })
// export class DatabaseModule {

// }



import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule {}
