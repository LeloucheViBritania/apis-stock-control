import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
  ) {}

  // Cette tâche s'exécute tous les jours à 09:00 du matin
  // Vous pouvez changer pour CronExpression.EVERY_HOUR pour plus de fréquence
    // src/modules/notifications/notifications.service.ts

    @Cron('0 9 * * *') // Tous les jours à 9h
    async handleLowStockCron() {
    this.logger.log('Vérification des stocks faibles en cours...');

    // 1. Récupérer tous les produits actifs
    // Note : Prisma ne permet pas facilement de comparer deux colonnes (quantiteStock <= niveauStockMin) 
    // directement dans le 'where' sans RawQuery. Le plus simple est de filtrer en JS.
    const produits = await this.prisma.produit.findMany({
        where: {
        estActif: true,
        },
        select: {
        id: true,
        nom: true,
        quantiteStock: true,
        niveauStockMin: true, // <--- On utilise votre champ existant
        produitsFournisseurs: { // Si vous utilisez la relation via ProduitFournisseur
            select: { 
                fournisseur: { select: { nom: true, email: true } } 
            } 
        }
        }
    });

    // 2. Filtrer en JavaScript : Stock Actuel <= Stock Minimum
    const alertes = produits.filter(p => p.quantiteStock <= p.niveauStockMin);

    if (alertes.length === 0) {
        this.logger.log('Aucun stock faible détecté.');
        return;
    }

    // 3. Envoyer l'email avec la liste 'alertes'
    await this.sendAlertEmail(alertes);
    }
  private async sendAlertEmail(produits: any[]) {
    // Générer un tableau HTML simple pour le mail
    const lignesTableau = produits
      .map(p => `<tr>
                  <td>${p.nom}</td>
                  <td style="color:red; font-weight:bold;">${p.quantiteStock}</td>
                  <td>${p.seuilAlerte || 5}</td>
                  <td>${p.fournisseur?.nom || 'N/A'}</td>
                 </tr>`)
      .join('');

    const htmlContent = `
      <h1> Alerte Stock Critique</h1>
      <p>Bonjour,</p>
      <p>Voici la liste des produits ayant atteint leur seuil d'alerte ce matin :</p>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th>Produit</th>
            <th>Stock Actuel</th>
            <th>Seuil Min</th>
            <th>Fournisseur</th>
          </tr>
        </thead>
        <tbody>
          ${lignesTableau}
        </tbody>
      </table>
      <p>Merci de prévoir un réapprovisionnement rapidement.</p>
    `;

    try {
      await this.mailerService.sendMail({
        to: process.env.ADMIN_EMAIL || 'admin@votre-entreprise.com', // L'email du gestionnaire
        subject: ` ALERTE STOCK : ${produits.length} produits critiques`,
        html: htmlContent,
      });
      this.logger.log(`Email d'alerte envoyé pour ${produits.length} produits.`);
    } catch (error) {
      this.logger.error("Erreur lors de l'envoi de l'email", error);
    }
  }
}