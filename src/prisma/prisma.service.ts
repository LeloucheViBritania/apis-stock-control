import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Base de données connectée');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Base de données déconnectée');
  }

  // Méthode utilitaire pour nettoyer la base de données (dev seulement)
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && key !== 'constructor',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
       if (typeof model === 'object' && model !== null && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      }),
    );
  }
}