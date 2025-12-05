import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 2. ACTIVER HELMET (juste après la création de l'app)
  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter());

  // Configuration CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Préfixe global pour toutes les routes API
  app.setGlobalPrefix('api');

  // ============================================
  // CONFIGURATION SWAGGER
  // ============================================

  const config = new DocumentBuilder()
    .setTitle('API Gestion de Stock')
    .setDescription(
      `
      API REST pour la gestion de stock avec système d'abonnement FREE/PREMIUM
      
      ##  Fonctionnalités FREE
      - Gestion des produits, catégories, clients et fournisseurs
      - Commandes et mouvements de stock basiques
      - Dashboard et alertes de stock
      
      ## 🔒 Fonctionnalités PREMIUM
      - Multi-entrepôts et gestion des transferts
      - Ajustements avancés et bons de commande d'achat
      - Journal d'audit complet et rapports avancés
      
      ## 🔐 Authentification
      Utilisez le endpoint /api/auth/login pour obtenir un token JWT.
      Ensuite, cliquez sur "Authorize" et entrez: Bearer VOTRE_TOKEN
      
      ## 👥 Comptes de test
      - Admin (PREMIUM): admin / admin123
      - Gestionnaire (FREE): gestionnaire / gestionnaire123
      - Employé (FREE): employe / employe123
    `,
    )
    .setVersion('1.0')
    .setContact(
      'Support Technique',
      'https://votre-site.com',
      'support@gestionstock.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addTag('Auth', 'Authentification et gestion des utilisateurs')
    .addTag('Subscription', 'Gestion des abonnements')
    .addTag('Produits', ' Gestion des produits')
    .addTag('Categories', ' Gestion des catégories')
    .addTag('Clients', ' Gestion des clients')
    .addTag('Fournisseurs', ' Gestion des fournisseurs')
    .addTag('Commandes', ' Gestion des commandes')
    .addTag('Mouvements Stock', ' Historique des mouvements')
    .addTag('Dashboard', ' Statistiques et tableau de bord')
    .addTag('Entrepots', 'Gestion multi-entrepôts')
    .addTag('Inventaire', 'Inventaire des activtes')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Entrez votre token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Serveur de développement')
    .addServer('https://api.gestionstock.com', 'Serveur de production')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Personnalisation de l'interface Swagger
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'API Gestion de Stock - Documentation',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: `
      .swagger-ui .topbar { background-color: #2c3e50; }
      .swagger-ui .info .title { color: #2c3e50; }
      .swagger-ui .scheme-container { background: #ecf0f1; }
    `,
    jsonDocumentUrl: '/api-json',
    swaggerOptions: {
      persistAuthorization: true, // Garde le token même après refresh
      displayRequestDuration: true,
      filter: true, // Active la recherche
      showExtensions: true,
      docExpansion: 'none', // Collapse tous les endpoints par défaut
      defaultModelsExpandDepth: 3,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT || 3000;

  await app.listen(port);

  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   🚀 GESTION DE STOCK - API REST                     ║
  ║                                                       ║
  ║   📡 API: http://localhost:${port}/api                   ║
  ║   📚 Swagger: http://localhost:${port}/api/docs          ║
  ║   📊 Prisma Studio: npx prisma studio                ║
  ║                                                       ║
  ║    Fonctionnalités FREE:                           ║
  ║   - Produits, catégories, clients, fournisseurs      ║
  ║   - Commandes et mouvements de stock                 ║
  ║                                                       ║
  ║   🔒 Fonctionnalités PREMIUM:                        ║
  ║   - Multi-entrepôts et transferts                    ║
  ║   - Bons de commande et journal d'audit              ║
  ║                                                       ║
  ║   👥 Comptes de test:                                ║
  ║   - admin / admin123 (PREMIUM)                       ║
  ║   - gestionnaire / gestionnaire123 (FREE)            ║
  ║   - employe / employe123 (FREE)                      ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((err) => {
  console.error(" Erreur au démarrage de l'application:", err);
  process.exit(1);
});
