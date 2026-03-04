import { AppLanguage, getActiveLanguage, getStoredLanguage } from './language';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'SVG', 'PATH']);
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title'] as const;

const EXACT_FR: Record<string, string> = {
  Home: 'Accueil',
  Workout: 'Entrainement',
  Progress: 'Progres',
  Profile: 'Profil',
  Settings: 'Parametres',
  Account: 'Compte',
  Preferences: 'Preferences',
  Notifications: 'Notifications',
  'Privacy & Security': 'Confidentialite et securite',
  'Personal Details': 'Details personnels',
  Theme: 'Theme',
  Language: 'Langue',
  Dark: 'Sombre',
  Light: 'Clair',
  'Log Out': 'Se deconnecter',
  'Create My Workout Plan': 'Creer mon plan d entrainement',
  'Create Alone': 'Creer seul',
  'With Coach': 'Avec coach',
  'Choose Coach': 'Choisir un coach',
  'My Blog Posts': 'Mes posts de blog',
  'Gym Access': 'Acces gym',
  Classification: 'Classement',
  Exercises: 'Exercices',
  'Days Left': 'Jours restants',
  sessions: 'seances',
  'Notification Controls': 'Controle des notifications',
  'Coach Messages': 'Messages du coach',
  'Rest Between Sets': 'Repos entre les series',
  'Mission & Challenge Complete': 'Mission et challenge termines',
  'Overall Recovery': 'Recuperation globale',
  'Today Plan': 'Plan du jour',
  'Damaged muscles': 'Muscles fatigues',
  'Ready to train': 'Pret a entrainer',
  'Last trained': 'Dernier entrainement',
  Today: 'Aujourd hui',
  Yesterday: 'Hier',
  'Not trained recently': 'Pas entraine recemment',
  Remaining: 'Restant',
  Volume: 'Volume',
  Week: 'Semaine',
  Source: 'Source',
  'Current plan week': 'Semaine du plan actuel',
  'Recent performance': 'Performance recente',
  'Next Period Overload': 'Surcharge periode suivante',
  'View Plan': 'Voir le plan',
  'Analysis Complete': 'Analyse terminee',
  Results: 'Resultats',
  'View Bi-Weekly Report': 'Voir le rapport bi-hebdomadaire',
  'Weekly Check-In': 'Check-in hebdomadaire',
  'Strength Progress': 'Progres de force',
  Consistency: 'Regularite',
  'Total Volume': 'Volume total',
  'Muscle Distribution': 'Repartition musculaire',
  Recovery: 'Recuperation',
  Complete: 'Termine',
  Completed: 'Termine',
  Back: 'Retour',
  Next: 'Suivant',
  Cancel: 'Annuler',
  Close: 'Fermer',
  Save: 'Enregistrer',
  'Save Changes': 'Enregistrer les changements',
  Search: 'Recherche',
  Filter: 'Filtre',
  Loading: 'Chargement',
  'Loading...': 'Chargement...',
  Error: 'Erreur',
  Delete: 'Supprimer',
  Remove: 'Retirer',
  Add: 'Ajouter',
  Start: 'Demarrer',
  Stop: 'Arreter',
  Continue: 'Continuer',
  Pause: 'Pause',
  Friends: 'Amis',
  Coach: 'Coach',
  Messages: 'Messages',
  Message: 'Message',
  Calculator: 'Calculateur',
  Nutrition: 'Nutrition',
  'Rest Day': 'Jour de repos',
  'Eat well and recover': 'Mangez bien et recuperez',
  'Friend Profile': 'Profil ami',
  'No coaches available.': 'Aucun coach disponible.',
  'Loading coaches...': 'Chargement des coachs...',
  'No overload recommendations yet. Log more sets to generate your next progression targets.': 'Pas encore de recommandations de surcharge. Enregistrez plus de series pour generer vos prochaines cibles.',
  'Recommendations are generated from your active plan week and your latest completed sets.': 'Les recommandations sont basees sur votre semaine de plan active et vos dernieres series terminees.',
  'Based on your recent performance, RepSet recommends these increases to maintain progressive overload.': 'Selon vos performances recentes, RepSet recommande ces augmentations pour maintenir la surcharge progressive.',
};

const PHRASE_FR: Array<[string, string]> = [
  ['Preferences & Account', 'Preferences et compte'],
  ['Member since', 'Membre depuis'],
  ['Failed to load', 'Echec du chargement'],
  ['Failed to save', 'Echec de la sauvegarde'],
  ['Failed to update', 'Echec de la mise a jour'],
  ['Update Password', 'Mettre a jour le mot de passe'],
  ['Change Password', 'Changer le mot de passe'],
  ['Old Password', 'Ancien mot de passe'],
  ['New Password', 'Nouveau mot de passe'],
  ['Confirm New Password', 'Confirmer le nouveau mot de passe'],
  ['Loading notifications...', 'Chargement des notifications...'],
  ['Top ', 'Top '],
  ['of ', 'de '],
  [' set', ' serie'],
  [' sets', ' series'],
  [' reps', ' reps'],
  [' kg', ' kg'],
  [' points', ' points'],
  [' week', ' semaine'],
  [' weeks', ' semaines'],
  [' day', ' jour'],
  [' days', ' jours'],
  [' month', ' mois'],
  [' year', ' an'],
  [' years', ' ans'],
];

const originalTextByNode = new WeakMap<Text, string>();
const originalAttrsByNode = new WeakMap<Element, Map<string, string>>();

let observer: MutationObserver | null = null;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isElementSkipped = (element: Element | null) => {
  if (!element) return true;
  if (SKIP_TAGS.has(element.tagName)) return true;
  if (element.closest('[data-no-translate="true"]')) return true;
  return false;
};

const translateCoreToFrench = (raw: string) => {
  const leading = raw.match(/^\s*/)?.[0] || '';
  const trailing = raw.match(/\s*$/)?.[0] || '';
  const core = raw.trim();
  if (!core) return raw;

  const exact = EXACT_FR[core];
  if (exact) return `${leading}${exact}${trailing}`;

  let translated = core;
  PHRASE_FR.forEach(([en, fr]) => {
    translated = translated.replace(new RegExp(escapeRegExp(en), 'g'), fr);
  });

  return `${leading}${translated}${trailing}`;
};

const translateFromOriginal = (original: string, language: AppLanguage) => {
  if (language === 'fr') return translateCoreToFrench(original);
  return original;
};

const applyTextTranslation = (node: Text, language: AppLanguage) => {
  if (!node.parentElement || isElementSkipped(node.parentElement)) return;
  const current = node.nodeValue ?? '';
  if (!originalTextByNode.has(node)) {
    originalTextByNode.set(node, current);
  }
  const original = originalTextByNode.get(node) ?? current;
  const translated = translateFromOriginal(original, language);
  if (translated !== current) {
    node.nodeValue = translated;
  }
};

const applyAttributeTranslation = (element: Element, language: AppLanguage) => {
  if (isElementSkipped(element)) return;
  if (!originalAttrsByNode.has(element)) {
    originalAttrsByNode.set(element, new Map());
  }
  const originalAttrs = originalAttrsByNode.get(element);
  if (!originalAttrs) return;

  TRANSLATABLE_ATTRIBUTES.forEach((attr) => {
    const value = element.getAttribute(attr);
    if (value == null) return;

    if (!originalAttrs.has(attr)) {
      originalAttrs.set(attr, value);
    }

    const original = originalAttrs.get(attr) || value;
    const translated = translateFromOriginal(original, language);
    if (translated !== value) {
      element.setAttribute(attr, translated);
    }
  });
};

const applyTranslationsToNode = (root: Node, language: AppLanguage) => {
  if (root.nodeType === Node.TEXT_NODE) {
    applyTextTranslation(root as Text, language);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return;
  }

  const elementRoot = root as Element;
  if (root.nodeType === Node.ELEMENT_NODE) {
    applyAttributeTranslation(elementRoot, language);
  }

  const ownerDocument = (root as Element).ownerDocument || document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    applyTextTranslation(textNode as Text, language);
    textNode = walker.nextNode();
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    const translatableElements = elementRoot.querySelectorAll('[placeholder], [aria-label], [title]');
    translatableElements.forEach((el) => applyAttributeTranslation(el, language));
  }
};

const applyTranslationsNow = () => {
  if (typeof document === 'undefined' || !document.body) return;
  const language = getActiveLanguage();
  applyTranslationsToNode(document.body, language);
};

export const initializeRuntimeTranslator = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (observer) return;

  applyTranslationsNow();

  const handleLanguageChanged = () => {
    requestAnimationFrame(() => {
      const language = getStoredLanguage();
      applyTranslationsToNode(document.body, language);
    });
  };

  window.addEventListener('app-language-changed', handleLanguageChanged);
  window.addEventListener('storage', handleLanguageChanged);

  observer = new MutationObserver((mutations) => {
    const language = getActiveLanguage();
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
        applyTextTranslation(mutation.target as Text, language);
        return;
      }

      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        applyAttributeTranslation(mutation.target as Element, language);
        return;
      }

      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          applyTranslationsToNode(node, language);
        });
      }
    });
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
  });
};
