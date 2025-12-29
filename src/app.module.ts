
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Modules Core
import { PrismaModule } from './prisma/prisma.module';
import { ExportModule } from './common/services/export.module'; // NOUVEAU

// Modules Auth & Subscription
import { AuthModule } from './modules/auth/auth.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

// Modules FREE
import { ProduitsModule } from './modules/produits/produits.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { FournisseursModule } from './modules/fournisseurs/fournisseurs.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CommandesModule } from './modules/commandes/commandes.module';
import { MouvementsStockModule } from './modules/mouvements-stock/mouvements-stock.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

// Modules PREMIUM
import { EntrepotsModule } from './modules/entrepots/entrepots.module';
import { InventaireModule } from './modules/inventaire/inventaire.module';
import { TransfertsStockModule } from './modules/transferts-stock/transferts-stock.module';
import { JournalAuditModule } from './modules/journal-audit/journal-audit.module';
import { RapportsModule } from './modules/rapports/rapports.module'; // ACTIVÉ

// Guards & Interceptors
import { AuthGuard } from './common/guards/auth.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { InventairePhysiqueModule } from './modules/inventaire-physique/inventaire-physique.module';
import { PrevisionsModule } from './modules/previsions/previsions.module';
import { ReapprovisionnementModule } from './modules/reapprovisionnement/reapprovisionnement.module';
import { CommandesAvanceesModule } from './modules/commandes/commandes-avancees.module';
import { FournisseursAvancesModule } from './modules/fournisseurs/fournisseurs-avances.module';
import { ClientsAvancesModule } from './modules/clients/clients-avances.module';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Throttler
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),

    // JWT Configuration
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: Number(process.env.JWT_EXPIRATION) || '7d' },
    }),

    // Prisma (Database)
    PrismaModule,

    // Module d'export global (NOUVEAU)
    ExportModule,

    // Auth & Subscription
    AuthModule,
    SubscriptionModule,

    // Modules FREE
    ProduitsModule,
    CategoriesModule,
    FournisseursModule,
    ClientsModule,
    ClientsAvancesModule,
    CommandesModule,
    MouvementsStockModule,
    DashboardModule,

    // Modules PREMIUM
    EntrepotsModule,
    InventaireModule,
    InventairePhysiqueModule,
    ReapprovisionnementModule,
    CommandesAvanceesModule,
    FournisseursAvancesModule,
    PrevisionsModule,
    TransfertsStockModule,
    JournalAuditModule,
    RapportsModule, // ACTIVÉ pour les exports

    // Scheduler & Mailer
    ScheduleModule.forRoot(),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.MAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.MAIL_USER || 'votre-email@gmail.com',
          pass: process.env.MAIL_PASSWORD || 'votre-mot-de-passe-app',
        },
      },
      defaults: {
        from: '"Stock Control" <no-reply@votre-domaine.com>',
      },
    }),

    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}