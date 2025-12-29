export enum Feature {
  // FREE Features
  DASHBOARD_BASIQUE = 'dashboard_basique',
  GESTION_PRODUITS = 'gestion_produits',
  GESTION_CATEGORIES = 'gestion_categories',
  GESTION_FOURNISSEURS = 'gestion_fournisseurs',
  GESTION_CLIENTS = 'gestion_clients',
  GESTION_COMMANDES = 'gestion_commandes',
  MOUVEMENTS_STOCK_BASIQUE = 'mouvements_stock_basique',
  ALERTES_STOCK = 'alertes_stock',

  INVENTAIRE_PHYSIQUE = 'inventaire_physique',
  PREVISIONS_STOCK = 'previsions_stock',
  REAPPROVISIONNEMENT_SUGGERE = 'reapprovisionnement_suggere',
  REAPPROVISIONNEMENT_AUTO = 'reapprovisionnement_auto',
  
  // PREMIUM Features
  MULTI_ENTREPOTS = 'multi_entrepots',
  TRANSFERTS_STOCK = 'transferts_stock',
  AJUSTEMENTS_AVANCES = 'ajustements_avances',
  BONS_COMMANDE_ACHAT = 'bons_commande_achat',
  GESTION_ROLES = 'gestion_roles',
  JOURNAL_AUDIT = 'journal_audit',
  RAPPORTS_AVANCES = 'rapports_avances',
  RELATION_PRODUITS_FOURNISSEURS = 'relation_produits_fournisseurs',
}

export const PREMIUM_FEATURES: Feature[] = [
  Feature.MULTI_ENTREPOTS,
  Feature.TRANSFERTS_STOCK,
  Feature.AJUSTEMENTS_AVANCES,
  Feature.BONS_COMMANDE_ACHAT,
  Feature.GESTION_ROLES,
  Feature.JOURNAL_AUDIT,
  Feature.RAPPORTS_AVANCES,
  Feature.RELATION_PRODUITS_FOURNISSEURS,
];

export const FREE_FEATURES: Feature[] = [
  Feature.DASHBOARD_BASIQUE,
  Feature.GESTION_PRODUITS,
  Feature.GESTION_CATEGORIES,
  Feature.GESTION_FOURNISSEURS,
  Feature.GESTION_CLIENTS,
  Feature.GESTION_COMMANDES,
  Feature.MOUVEMENTS_STOCK_BASIQUE,
  Feature.ALERTES_STOCK,
];
