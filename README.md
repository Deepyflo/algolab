# AlgoLab — laboratoire d’algorithmique Python 3

**AlgoLab** est un petit environnement d’entraînement inspiré des plateformes de challenges techniques. Il a été conçu pour préparer un examen d’algorithmique dans le cadre d’une formation orientée recrutement chez Odoo : cinq exercices de niveau principalement *easy*, à résoudre en 60 à 75 minutes, avec un seuil de réussite strictement supérieur à 80 %.

> **Transparence sur l’IA** — Ce projet a été entièrement réalisé avec l’aide d’une IA, de l’interface aux outils d’exécution et à la documentation. L’IA a servi d’outil de développement, pas de promesse magique : le code, les limites et les choix techniques sont visibles dans le dépôt, les exercices sont modifiables, et les résultats d’analyse restent présentés comme des estimations. Le projet est fait pour être lu, essayé, corrigé et amélioré par des humains. Si vous repérez un bug ou une approximation, une issue ou une PR est la bienvenue.

## Démarrer

Python 3 est nécessaire pour lancer le serveur local :

```bash
python3 server.py
```

Ouvrez ensuite [http://localhost:8000](http://localhost:8000). L’éditeur CodeMirror et le moteur Python Pyodide sont chargés depuis des CDN ; une connexion Internet est donc nécessaire au premier chargement.

## Fonctionnalités

- **IDE Python 3 dans le navigateur** : coloration syntaxique de style IDE, indentation automatique, touche Tab, numéros de ligne et édition multi-ligne.
- **Identité visuelle personnalisée** : interface sombre aux accents orange brûlé et crème, avec une présentation chaleureuse et sobre.
- **Exercices d’algorithmique** : warmups, drills et simulations, avec code de départ volontairement remis à `TODO: implement` pour pratiquer chaque solution.
- **Gestion de la base d’exercices** : créer, modifier, supprimer, importer et exporter des exercices depuis la page **Mes exercices**. Chaque exercice comporte un énoncé, du code de départ et des cas de test.
- **Persistance portable des énoncés** : les exercices sont conservés dans [`data/exercises.json`](data/exercises.json) par le serveur local. Ce fichier peut être versionné ou déplacé avec le projet pour retrouver la base sur une autre machine.
- **Conditions d’examen** : chronomètre individuel par exercice (démarrer, pause, reprendre, remise à zéro), score de tests et indication du nombre de cas requis pour dépasser 80 %.
- **Simulation d’examen blanc** : session de cinq simulations tirées au hasard ou choisies manuellement, durée totale de 60 ou 75 minutes, score cumulé et récapitulatif par exercice.
- **Débogage** : `print()` s’affiche dans la console de résultats avec `stdout` et `stderr`. Les sorties sont bornées pour éviter qu’une boucle de debug ne remplisse toute la mémoire.
- **Mesures d’exécution** : durée et estimation du pic de mémoire Python, avec limites de temps et mémoire configurables. L’exécution est isolée dans un Worker et peut être interrompue en cas de dépassement du délai.
- **Complexité indicative** : analyse syntaxique heuristique donnant un ordre de grandeur comme `O(n)` ou `O(n log n)` lorsque le code le permet.
- **Effacement global des soumissions** : le bouton de l’en-tête supprime, après confirmation, les brouillons, scores, validations et chronos stockés dans le navigateur. Les énoncés de la base JSON ne sont pas supprimés.

### Limites des mesures

La mémoire indiquée correspond aux allocations Python suivies par `tracemalloc` ; elle ne mesure ni tout le navigateur ni le moteur Pyodide. La limite mémoire s’applique à ces allocations suivies. L’analyse de complexité est une heuristique syntaxique : elle ne prouve pas la complexité et peut manquer le coût de fonctions appelées ou la taille réelle des données.

Les brouillons, scores, validations et chronos sont propres au navigateur et enregistrés dans son `localStorage`. Seule la base d’énoncés est dans le fichier JSON partagé avec le projet. L’effacement global supprime ces données de progression locales.

## Gérer les exercices

Cliquez sur **Mes exercices** pour ouvrir l’interface de gestion. Elle permet de modifier ou supprimer aussi bien les exercices fournis que ceux ajoutés. Les opérations d’import et d’export servent à transférer la base entre machines ; les exercices personnalisés stockés par une ancienne version du navigateur peuvent également être importés.

Pour un cas de test personnalisé, indiquez un appel Python et sa valeur attendue en JSON, par exemple :

```text
Appel : solution([2, 3])
Attendu : [5]
```

## Structure du projet

```text
AlgoLab/
├── data/exercises.json       # Base d’exercices portable
├── python/                   # Runner Python et analyse de complexité
├── scripts/                  # Interface, éditeur, navigation et exécution
├── styles/                   # Styles séparés par zone de l’interface
├── custom.html               # Gestion des exercices
├── index.html                # Environnement d’entraînement
├── exam.html                 # Simulation d’examen blanc
└── server.py                 # Serveur local et API JSON
```

La session d’examen est pilotée par `scripts/exam-session.js` et mise en forme dans `styles/exam.css`.

## Versions

Le projet n’ayant pas encore eu de releases formelles, les numéros ci-dessous sont une **reconstitution rétrospective** des étapes demandées. La version actuelle est estimée à **0.10.0** : les fonctionnalités principales sont présentes, mais l’application reste un outil personnel en évolution.

Voir le [changelog complet](CHANGELOG.md). Chaque nouvelle fonctionnalité demandée devra y être ajoutée dans la prochaine version appropriée.

> L’éditeur s’appuie sur l’indentation intégrée à CodeMirror. Il ne contient pas de moteur Emmet dédié pour Python à ce stade.

## Contribuer

Les améliorations et corrections sont les bienvenues. Pour proposer un changement, décrivez le comportement visé et les étapes permettant de le reproduire. Les changements qui touchent au runner doivent préciser les limites de mesure ou d’isolation concernées. Une revue humaine reste utile, même lorsque l’implémentation initiale a été produite avec une IA.
