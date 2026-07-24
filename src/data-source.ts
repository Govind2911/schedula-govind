import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'root123',
  database: 'schedula',

  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],

  synchronize: false,
});