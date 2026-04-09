// ============================================================
// Catalogue de services NHBoost — source unique de vérité
// ============================================================

export type PaymentMode = 'one-shot' | 'subscription'

export interface ServiceCatalog {
  id: string
  name: string
  description: string
  internalCost: number
  salePrice: number
  type: PaymentMode
  monthlyPrice?: number
  commitmentMonths?: number
  iconName: string
  iconColor: string
  popular?: boolean
  engagement?: string
  // Enrichi
  longDescription: string
  sellingPoints: string[]
  deliverables: string[]
  timeline: string
  faq: { q: string; a: string }[]
}

export const SERVICES: ServiceCatalog[] = [
  {
    id: 'site-onepage',
    name: 'Site One Page',
    description: 'Page unique optimisée, design professionnel responsive, formulaire de contact, mise en ligne, SEO Friendly',
    internalCost: 300,
    salePrice: 970,
    type: 'one-shot',
    iconName: 'Globe',
    iconColor: '#6AAEE5',
    longDescription: 'Un site web professionnel en une seule page, conçu pour convertir vos visiteurs en clients. Design moderne et responsive, optimisé pour le référencement naturel et la performance mobile. Idéal pour les artisans, indépendants et petites entreprises qui veulent une présence en ligne rapide et efficace.',
    sellingPoints: [
      'Mise en ligne en 1 à 2 semaines',
      'Design professionnel et responsive (mobile, tablette, desktop)',
      'Formulaire de contact intégré',
      'Optimisation SEO de base (Google Friendly)',
      'Hébergement et nom de domaine inclus la 1ère année',
      'Marge de 670€ par vente',
    ],
    deliverables: [
      '1 page web complète avec sections (hero, services, about, contact)',
      'Formulaire de contact fonctionnel',
      'Optimisation mobile et tablette',
      'Intégration Google Analytics',
      'Mise en ligne sur le domaine du client',
    ],
    timeline: '1 à 2 semaines',
    faq: [
      { q: 'Le client doit-il fournir le nom de domaine ?', a: 'Le client peut acheter son domaine sur GoDaddy ou OVH. Nous gérons la configuration technique.' },
      { q: 'Combien de modifications sont incluses ?', a: '2 révisions gratuites sont incluses après la première version.' },
      { q: "L'hébergement est-il inclus ?", a: "Oui, l'hébergement est inclus la première année. Ensuite, un forfait annuel de ~50€ s'applique." },
      { q: 'Le site est-il optimisé pour Google ?', a: 'Oui, le SEO de base est inclus : balises, vitesse, mobile-friendly, sitemap.' },
    ],
  },
  {
    id: 'site-complet',
    name: 'Site Complet',
    description: 'Site multipages, design personnalisé, optimisation SEO de base, intégration WhatsApp/formulaire, responsive mobile',
    internalCost: 800,
    salePrice: 1470,
    type: 'one-shot',
    iconName: 'Globe',
    iconColor: '#4A7DC4',
    popular: true,
    longDescription: 'Un site web complet et sur mesure avec plusieurs pages, adapté aux entreprises qui veulent une présence digitale complète. Design personnalisé, intégration WhatsApp, optimisation SEO, et responsive sur tous les appareils.',
    sellingPoints: [
      'Site multipages entièrement personnalisé',
      'Design sur mesure aux couleurs du client',
      'Intégration WhatsApp + formulaire de contact',
      'Optimisation SEO complète',
      'Responsive mobile et tablette',
      'Marge de 670€ par vente',
    ],
    deliverables: [
      'Site multipages (5-7 pages : accueil, services, à propos, contact, etc.)',
      'Design personnalisé avec charte graphique du client',
      'Bouton WhatsApp flottant',
      'Formulaire de contact avancé',
      'Optimisation SEO on-page',
      'Google Analytics + Search Console',
      'Mise en ligne complète',
    ],
    timeline: '3 à 4 semaines',
    faq: [
      { q: 'Combien de pages sont incluses ?', a: 'Le forfait inclut 5 à 7 pages. Des pages supplémentaires peuvent être ajoutées sur devis.' },
      { q: 'Le client peut-il modifier le site lui-même ?', a: 'Oui, nous livrons un accès CMS pour les modifications de contenu simples.' },
      { q: 'Le e-commerce est-il possible ?', a: 'Pour un site e-commerce complet, un devis sur mesure est nécessaire. Le site complet peut inclure une vitrine produits basique.' },
      { q: 'Quelle est la différence avec le One Page ?', a: 'Le Site Complet offre plusieurs pages, un design entièrement personnalisé, et une optimisation SEO plus poussée.' },
      { q: 'Le site est-il sécurisé (HTTPS) ?', a: 'Oui, le certificat SSL est inclus systématiquement.' },
    ],
  },
  {
    id: 'visibilite',
    name: 'Offre Visibilité',
    description: 'Création de contenus, gestion de visibilité digitale, vidéos réseaux sociaux, optimisation présence locale',
    internalCost: 390,
    salePrice: 870,
    type: 'subscription',
    monthlyPrice: 870,
    commitmentMonths: 6,
    iconName: 'Share2',
    iconColor: '#F59E0B',
    engagement: '6 mois',
    longDescription: 'Un accompagnement mensuel complet pour développer la visibilité digitale de votre client. Création de contenus, vidéos pour les réseaux sociaux, optimisation de la présence locale et gestion de la visibilité en ligne.',
    sellingPoints: [
      'Création de contenus réguliers et professionnels',
      'Vidéos adaptées aux réseaux sociaux (Reels, TikTok, Stories)',
      'Optimisation de la présence locale (Google Business, annuaires)',
      'Gestion de la visibilité digitale globale',
      'Marge de 480€/mois — soit 2 880€ sur 6 mois',
      'Récurrent : revenu prévisible chaque mois',
    ],
    deliverables: [
      'Contenus mensuels (posts, visuels, textes)',
      'Vidéos courtes pour réseaux sociaux',
      'Optimisation fiche Google Business Profile',
      'Reporting mensuel de performance',
      'Stratégie de contenu personnalisée',
    ],
    timeline: 'Mise en place sous 1 semaine, résultats progressifs',
    faq: [
      { q: "Combien de contenus par mois ?", a: "Le volume dépend du forfait, mais en moyenne 8-12 contenus/mois (posts + vidéos)." },
      { q: "Le client doit-il fournir des visuels ?", a: "Non, nous créons tout. Si le client a des visuels, nous les intégrons." },
      { q: "Peut-on résilier avant 6 mois ?", a: "L'engagement minimum est de 6 mois. Au-delà, résiliation avec 30 jours de préavis." },
      { q: "Les résultats sont-ils garantis ?", a: "Nous ne garantissons pas de chiffres exacts, mais nos clients voient en moyenne +40% de visibilité en 3 mois." },
    ],
  },
  {
    id: 'acquisition',
    name: "Système d'Acquisition Simple",
    description: "Tunnel simple, page de conversion, système de collecte de leads, structuration de l'offre",
    internalCost: 490,
    salePrice: 970,
    type: 'subscription',
    monthlyPrice: 970,
    commitmentMonths: 3,
    iconName: 'Target',
    iconColor: '#22C55E',
    engagement: '3 mois',
    longDescription: "Un système d'acquisition clé en main pour générer des leads qualifiés de manière automatisée. Tunnel de vente, page de conversion optimisée, et système de collecte de contacts prêt à l'emploi.",
    sellingPoints: [
      'Tunnel de vente optimisé pour la conversion',
      'Page de capture de leads professionnelle',
      'Système automatisé de collecte de contacts',
      "Structuration de l'offre commerciale",
      'Marge de 480€/mois — soit 1 440€ sur 3 mois',
      'Résultats mesurables dès le 1er mois',
    ],
    deliverables: [
      'Landing page de conversion',
      'Tunnel de vente complet',
      'Formulaire de capture de leads',
      "Structuration de l'offre",
      'Suivi et reporting des leads',
    ],
    timeline: '2 à 3 semaines de mise en place',
    faq: [
      { q: 'Combien de leads peut-on espérer ?', a: "Cela dépend du secteur et du budget pub, mais nos tunnels génèrent en moyenne 15-30 leads/mois." },
      { q: "Le budget publicitaire est-il inclus ?", a: "Non, le budget pub (Facebook Ads, Google Ads) est à la charge du client. Nous recommandons un minimum de 300€/mois." },
      { q: "Faut-il un site web existant ?", a: "Non, le système fonctionne de manière autonome avec sa propre landing page." },
    ],
  },
  {
    id: 'accompagnement',
    name: 'Accompagnement Business Premium',
    description: "Positionnement stratégique, structuration offre, création contenu, système acquisition, optimisation commerciale",
    internalCost: 2500,
    salePrice: 4970,
    type: 'one-shot',
    iconName: 'Briefcase',
    iconColor: '#8B5CF6',
    longDescription: "Un programme d'accompagnement complet et premium pour les entrepreneurs qui veulent structurer leur business digital de A à Z. Positionnement stratégique, structuration de l'offre, création de contenu, mise en place d'un système d'acquisition et optimisation commerciale.",
    sellingPoints: [
      'Programme 360° : stratégie + exécution + coaching',
      'Positionnement stratégique et différenciation',
      "Structuration complète de l'offre commerciale",
      "Système d'acquisition intégré",
      'Méthodologie de croissance éprouvée',
      'Marge de 2 470€ par vente',
    ],
    deliverables: [
      'Audit et positionnement stratégique',
      "Structuration de l'offre (pricing, packaging, arguments)",
      'Création de contenu (visuels, textes, vidéos)',
      "Système d'acquisition complet",
      'Optimisation du processus commercial',
      'Sessions de coaching personnalisées',
    ],
    timeline: 'Programme sur mesure — durée selon les besoins',
    faq: [
      { q: "Combien de temps dure l'accompagnement ?", a: "Le programme s'adapte au client. En moyenne, 2-3 mois pour des résultats concrets." },
      { q: "Est-ce adapté à tous les secteurs ?", a: "Oui, la méthodologie est universelle. Nous l'adaptons à chaque secteur d'activité." },
      { q: "Quels résultats attendre ?", a: "Nos clients voient en moyenne un doublement de leur chiffre d'affaires en 6 mois après l'accompagnement." },
      { q: "Y a-t-il un suivi après le programme ?", a: "Oui, un suivi de 30 jours est inclus après la fin du programme." },
      { q: "Peut-on payer en plusieurs fois ?", a: "Oui, un paiement en 2 ou 3 fois est possible. Contactez-nous pour en discuter." },
    ],
  },
]
