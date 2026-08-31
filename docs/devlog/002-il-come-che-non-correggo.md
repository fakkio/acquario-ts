---
title: "Il come che non correggo"
description: "Fargli fare quello che voglio è facile. Il difficile è decidere quando fidarmi di quello che ha deciso lui."
date: 2026-08-31
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - typescript
  - ai-agents
  - determinism
  - canvas
lang: it
---

# Il come che non correggo

Dopo tanti anni, il progetto mi emoziona ancora, anche se a scriverlo, il codice, ormai è quasi sempre l'agente. Vedere una griglia zoomabile che si muove sotto un dito mi fa esaltare lo stesso. Ma se il codice lo scrive lui, cosa faccio io, esattamente?

Sto implementando la M0 di AcquarioTS, la milestone che porta a un loop di aggiornamento e alla gestione di pan e zoom, da tastiera, mouse e touch. Faccio da architetto: prendo le decisioni sul perché, il cosa e il come, e lascio scrivere il codice al mio agente.

Già, il come. Non mi interessa imporre all'agente dettagli implementativi come la forma o lo stile di programmazione. In questo gli agenti ormai sono fortissimi. Fatico ancora a fidarmi però: a volte ha bisogno di una correzione, a volte è lui a convincere me.

Per esempio, durante l'implementazione di questa milestone l'agente ha deciso di creare tre bottoni: "avvia", "pausa" e "step". Solo dopo è stato chiaro che "avvia" e "pausa" sono la stessa faccia di un concetto, e potevano fondersi in un unico bottone.

In altre scelte invece è stato lui a convincermi che il suo punto fosse migliore, come quando ha scelto di implementare tutto in stile funzionale alla JavaScript, e non OOP come avrei probabilmente fatto io.

M0 è la prima milestone: prima che ci sia comportamento, deve esserci uno scheletro che si regge da solo. Dentro c'è un accumulatore a passo fisso, che decide quanti `tick` di simulazione far girare a ogni frame indipendentemente da quanto sia irregolare il framerate del browser, e c'è `mountCanvas`, la funzione che prende un elemento del DOM e ci disegna dentro la griglia zoomabile.

`mountCanvas`, in realtà, non è rimasta tale e quale alla prima stesura. A un certo punto l'agente ci aveva iniettato `Document`: invece di prendere il `document` globale del browser, la funzione riceveva l'elemento da montare come parametro, pensando che rendesse il codice più testabile. L'ha lasciata a metà: si è accorto da solo che quel test non aggiungeva valore, perché il loop di rendering lo si verifica avviando l'applicazione, non isolando `mountCanvas`. È tornato indietro, e `document` è rimasto globale.

È un fatto piccolo, ma vale la pena fermarcisi. Sui tre bottoni di prima, il problema l'ho visto io. Qui se n'è accorto lui, prima che arrivassi a guardare quel codice. Sono due fatti diversi, anche se da fuori sembrano lo stesso risultato: codice migliorato.

Il "come" che decido io e il "come" che non correggo in review non sono lo stesso "come". Uno è il come di progetto: canvas, TypeScript, Prettier, come si fanno i commit, i branch, quali skill usare. Resta mio al 100%. `bracketSpacing`, lo stile che uso in tutti i miei progetti (niente spazi dentro le parentesi graffe), è un esempio di questo tipo, e non l'ho messo nella config fin dall'inizio: ho lasciato girare Prettier di default finché non mi sono imbattuto per caso in un file pieno di spazi che non mi piaceva. A quel punto ho disattivato l'opzione e riformattato tutto il repo, in un commit separato.

L'altro è il come di esecuzione: dentro quel perimetro, come l'agente struttura effettivamente il codice. Quello, di regola, lo tratto come il gusto di un collega: non lo correggo, così come non correggerei lo stile di un collega dentro lo stesso linter aziendale.

Torniamo all'esempio funzionale-contro-OOP dell'apertura, perché lì la metafora del collega non regge fino in fondo. Non l'ho solo tollerato: mi ha convinto. E se avessi dovuto implementarlo io in quello stile, oggi sarebbe più difficile da maneggiare di quanto non lo sia. Non è "un gusto diverso ma ugualmente valido": è che sul come di esecuzione, a volte, l'agente ha un'idea migliore della mia. E non è nemmeno un caso isolato: dipende dalle volte.

Il come di progetto non finisce all'avvio del repository: a volte è quello che noto strada facendo. Playwright, per esempio, non l'ho preso solo per gli e2e test in senso classico: sto facendo scrivere il codice a un agente, e Playwright è un modo per dargli "vista" mentre lavora. Invece di doversi basare solo sul codice e sul risultato dell'esecuzione, può vedere davvero cosa succede nel browser.

Il touch, invece, è una lacuna che ho scoperto provandola io stesso. Ho provato pan e zoom su un dispositivo touch e non funzionava niente: né il dito che trascina, né il pizzico per zoomare. Mancavano proprio gli event listener. Non era emerso quando avevo discusso i requisiti con l'agente. L'ho fatto implementare subito, senza rimandarlo: con poco sforzo in più si supportano anche tablet e smartphone.

Si dice che il ruolo dell'ingegnere sia ormai diventato fare il PM, decidere cosa costruire e non più scriverlo. Non è il mio caso, o non ancora: se lo fossi davvero, non avrei scelto nemmeno gli strumenti tecnologici, mi sarei fidato abbastanza da lasciare anche quelli all'agente. Sono l'architetto: decido la struttura, gli strumenti, faccio review di correttezza. Non sono ancora pronto a fare solo il PM: non mi fido abbastanza dell'IA, per ora, da lasciarle anche le decisioni tecniche.

Il perché, invece, non l'ho mai messo in discussione. Perché questo progetto, perché un acquario, perché gli organelli invece di qualcos'altro per far emergere l'evoluzione: quello resta mio. L'IA può aiutarmi a definirlo meglio, ma il perché di fondo non si delega.

Dentro il come di esecuzione, la parte che ho scelto di non presidiare, è successo tutto quello che ho raccontato finora: un bottone di troppo che ho dovuto correggere, un `Document` iniettato e tolto senza che nessuno gliel'abbia chiesto, uno stile funzionale che si è rivelato migliore di quello che avrei scritto io. Far scrivere il codice a un agente, ormai, è la parte facile: gli dici cosa vuoi e lo fa, spesso meglio di come l'avrei fatto io in quel dettaglio. La parte difficile è tutta lì, in quel perimetro che ho scelto di non correggere: capire quando la sua decisione va lasciata correre, e quando no. Non è far fare all'AI quello che voglio. È fidarmi delle sue decisioni.
