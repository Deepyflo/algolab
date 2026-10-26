# Changelog

Historique reconstitué à partir des demandes et de l’état actuel du projet. Le dépôt n’ayant pas encore publié de versions, ces versions `0.x.x` sont des estimations de jalons, pas des releases taguées. La convention suivie : incrément mineur pour une étape fonctionnelle, patch pour une correction ou un petit complément.

## [0.13.0] — 2026-10-26 — Historique des examens

- Ajout d’une page dédiée qui récapitule toutes les simulations terminées, les cinq exercices rencontrés, le score global et la durée.
- Ajout de statistiques par exercice : nombre d’apparitions, nombre et taux de simulations où le seuil strict de 80 % des tests a été dépassé, ainsi que le taux moyen de tests réussis.
- Persistance des sessions dans `data/exam-history.json` via le serveur local, afin que l’historique puisse être sauvegardé et transféré avec le projet.
- Conservation du dernier code soumis pour chaque exercice en vue de son affichage dans une PR distincte.
- Les simulations réalisées avant cette version ne sont pas récupérables.

## [0.12.0] — 2026-10-23 — Exercices d’examen élargis

- La simulation d’examen pioche désormais dans tous les exercices de la base, y compris les warmups, drills et exercices personnalisés, et plus seulement dans la catégorie `simulation`.
- Mise à jour des libellés du tirage aléatoire, du sélecteur manuel et du message d’erreur pour refléter ce choix élargi.
- Renouvellement de l’URL versionnée du module de la page afin que le navigateur charge bien cette mise à jour.

## [0.11.0] — 2026-10-23 — Progression en entraînement

- Ajout dans l’en-tête du mode entraînement d’un compteur d’exercices terminés sur le total disponible.
- Un exercice est compté comme terminé lorsque tous ses tests sont réussis ; le compteur suit les validations enregistrées et se met à jour après une soumission ou l’effacement de la progression.
- Le compteur est limité à la page d’entraînement et n’apparaît pas dans la simulation d’examen.

## [0.10.0] — 2026-10-23 — Simulation d’examen blanc

- Ajout d’une page de simulation d’examen accessible depuis l’interface principale.
- Choix entre un tirage aléatoire de cinq exercices de la catégorie `simulation` et une sélection manuelle de cinq exercices.
- Affichage d’un seul exercice à la fois ; progression uniquement vers l’avant, sans liste révélant les sujets suivants ni retour aux exercices déjà passés.
- Ajout d’un chronomètre global de 60 ou 75 minutes, avec fin automatique à l’expiration.
- Affichage du nombre de tests réussis sur le total de la session et du nombre d’exercices déjà évalués.
- Ajout d’un récapitulatif final avec temps écoulé, score global, seuil de réussite et détail des résultats par exercice.

## [0.9.0] — 2026-10-23 — Identité visuelle AlgoLab

- Refonte des pages d’entraînement et de gestion des exercices pour une interface moins générique et plus personnelle.
- Conservation du dark mode avec une palette charbon, orange brûlé et crème.
- Ajout de détails de marque chaleureux, de surfaces mieux hiérarchisées, de contrôles plus lisibles et d’une adaptation responsive retravaillée.
- Harmonisation des composants de l’éditeur, de la console et du formulaire de création avec cette identité.

## [0.8.0] — 2026-10-23 — Soumissions et boucle de pratique

- Ajout d’un bouton global pour effacer les brouillons, résultats, validations et chronos de tous les exercices, avec confirmation. Les exercices du fichier JSON restent intacts.
- Chargement direct d’un exercice via un identifiant dans l’URL, utile pour ouvrir une simulation précise comme le challenge 15.
- Stabilisation de l’affichage du panneau de résultats pendant l’exécution et lorsqu’un exercice écrit avec `print()`.
- Affichage des sorties `stdout` et `stderr`, avec limitation de taille pour contenir les impressions volumineuses.
- Ajustements de l’éditeur et de la console pour maintenir les résultats visibles et corriger le rendu de la sélection de plusieurs lignes.

## [0.7.0] — 2026-10-23 — Exécution mesurée et analyse

- Affichage du temps d’exécution et d’une estimation du pic mémoire Python après soumission.
- Ajout de limites configurables de temps et de mémoire ; exécution dans un Worker avec arrêt en cas de dépassement du délai.
- Ajout d’un estimateur de complexité algorithmique à base d’analyse syntaxique heuristique.
- Correction du chargement de l’analyse et du cas où le résultat de complexité restait toujours « Indéterminée ».
- Correction de la résolution de `analyze_complexity` dans le moteur Python.

## [0.6.0] — 2026-10-22 — Base d’exercices gérable

- Regroupement de tous les exercices fournis dans `data/exercises.json`.
- Ajout d’une page pour créer des énoncés avec code de base et cas de test, puis modifier ou supprimer les exercices de la base.
- Ajout d’une API locale dans `server.py` pour lire et modifier le JSON de façon persistante, sans stocker les nouveaux énoncés dans `localStorage`.
- Ajout de l’import et de l’export de la base pour la transférer entre machines.
- Mise à jour de la documentation de démarrage et de stockage.

## [0.5.0] — 2026-10-22 — Console de débogage

- Ajout d’une console de sortie pour inspecter les appels à `print()` lors des soumissions.
- Regroupement de la sortie Python et des résultats de tests dans un panneau de résultats.
- Correction de l’affichage du panneau lors de l’exécution d’un exercice qui écrit dans la sortie standard.

## [0.4.0] — 2026-10-22 — Simulation des conditions d’examen

- Ajout d’un chronomètre par exercice avec démarrage, pause, reprise et remise à zéro.
- Conservation des temps et scores dans le navigateur, par exercice.
- Affichage du taux de réussite et du nombre de tests à réussir pour dépasser strictement 80 %.
- Ajout des repères de format : cinq exercices en 60 à 75 minutes.

## [0.3.1] — 2026-10-22 — Corrections de l’éditeur

- Correction d’une erreur d’import CodeMirror empêchant le chargement de l’application (`keymap` n’était pas exporté par le module utilisé).
- Correction du rendu visuel de la sélection multi-ligne dans l’éditeur.

## [0.3.0] — 2026-10-22 — Éditeur de code

- Remplacement de la saisie basique par un éditeur CodeMirror avec coloration syntaxique Python et thème sombre de type IDE.
- Configuration de l’indentation automatique et de Tab dans CodeMirror ; la demande d’Emmet n’est pas satisfaite par le code actuel, qui n’intègre pas de moteur Emmet dédié pour Python.
- Séparation du HTML, du JavaScript, du Python et des feuilles de style en fichiers dédiés, rangés par rôle et par module.

## [0.2.0] — 2026-10-22 — Exercices remis à zéro

- Réinitialisation du code de départ de tous les exercices, y compris ceux dont une solution existait déjà dans le dépôt source.
- Harmonisation des fonctions de départ au format `# TODO: implement` suivi de `pass`, afin que chaque exercice soit réellement à résoudre.
- Conservation de ces exercices déjà connus comme matière d’entraînement supplémentaire.

## [0.1.0] — 2026-10-22 — Première version d’AlgoLab

- Création d’une page web d’entraînement inspirée d’un IDE de plateforme de challenges.
- Chargement des exercices d’algorithmique Python 3 issus du dossier de drill fourni.
- Affichage de l’énoncé, édition du code et exécution des tests dans le navigateur via Pyodide.
- Ajout d’une interface sombre et d’une navigation par catégories d’exercices.

## À venir

- Aucune fonctionnalité à venir n’est annoncée pour le moment ; les demandes et décisions futures seront consignées ici au fil du développement.
