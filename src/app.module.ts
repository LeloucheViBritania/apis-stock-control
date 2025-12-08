import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Modules Core
import { PrismaModule } from './prisma/prisma.module';

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
// import { AjustementsStockModule } from './modules/ajustements-stock/ajustements-stock.module';
// import { BonsCommandeAchatModule } from './modules/bons-commande-achat/bons-commande-achat.module';
 import { JournalAuditModule } from './modules/journal-audit/journal-audit.module';
// import { RapportsModule } from './modules/rapports/rapports.module';

// Guards & Interceptors
import { AuthGuard } from './common/guards/auth.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
// 1. IMPORTER LE MODULE ET LE GUARD THROTTLER
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';


import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer';
import { NotificationsModule } from './modules/notifications/notifications.module'; // On va le créer après

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. CONFIGURER LE THROTTLER GLOBALEMENT
    // Ici : limite à 10 requêtes toutes les 60 secondes (1 minute)
    ThrottlerModule.forRoot([{
      ttl: 60000, // Temps en millisecondes (60s)
      limit: 10,  // Nombre maximum de requêtes par IP durant ce laps de temps
    }]),

    // JWT Configuration
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: Number(process.env.JWT_EXPIRATION) || '7d' },
    }),

    // Prisma (Database)
    PrismaModule,

    // Auth & Subscription
    AuthModule,
    SubscriptionModule,

    // Modules FREE (toujours disponibles)
    ProduitsModule,
    CategoriesModule,
    FournisseursModule,
    ClientsModule,
    CommandesModule,
    MouvementsStockModule,
    DashboardModule,

    // Modules PREMIUM (nécessitent un abonnement)
    EntrepotsModule,
    // Décommentez pour activer les autres modules PREMIUM
     InventaireModule,
     TransfertsStockModule,
    // AjustementsStockModule,
    // BonsCommandeAchatModule,
     JournalAuditModule,
    // RapportsModule,


    // 1. Activer le Scheduler
    ScheduleModule.forRoot(),

    // 2. Configurer le Mailer (Exemple avec Gmail ou SMTP classique)
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.MAIL_PORT) || 587,
        secure: false, // true pour 465, false pour les autres
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
    // Interceptor global pour l'audit log (PREMIUM uniquement)
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
