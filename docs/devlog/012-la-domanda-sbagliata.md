---
title: "La domanda sbagliata, tre volte"
description: "Il galleggiante sale, e i corpi che lo portano dovrebbero stare dritti. Il numero diceva di no, poi di sì, poi di nessuno dei due: ogni volta chiedevo altro."
date: 2026-10-11
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - physics
  - measurement
  - ai-agents
lang: it
---

# La domanda sbagliata, tre volte

Cinque semi, centomila tick, e una tabella che dice una cosa che non ci aspettavamo. Le righe sono i corpi che portano un **float**, un organello più leggero dell'acqua, e la colonna che conta è l'angolo medio del loro **Body Axis**, l'orientamento del corpo rispetto al mondo, in gradi dalla verticale:

| seme | angolo medio | coseno medio |
| ---- | ------------ | ------------ |
| 7    | 94°          | −0,06        |
| 8    | 83°          | 0,08         |
| 9    | 105°         | −0,27        |
| 10   | 48°          | 0,61         |
| 11   | 61°          | 0,45         |

Un corpo con un galleggiante sopra il centro è in equilibrio stabile: se lo giri, il galleggiante tira su da una parte e il corpo si raddrizza da solo. Si chiama gravitaxis passiva, "passiva" perché nessun gene sa dove sia l'alto. Nei test unitari funziona. Nella popolazione vera, a guardare questa tabella, non c'è: gli angoli sono sparsi come se l'orientamento fosse a caso.

Questo articolo racconta come abbiamo scoperto che la tabella rispondeva a una domanda che non avevamo fatto, e che la stessa cosa era già successa due volte nello stesso milestone, in due punti dove non ce ne eravamo accorti.

## Un organello che sale

Fino a M7 la profondità non dipendeva dal genoma. Un corpo aveva una posizione, e il moto browniano era l'unica forza: un lignaggio stava nella Bright Band, la fascia vicino alla superficie dove c’è luce, solo perché i fondatori erano nati lì. M8 aggiunge la gravità, e il **float** è il primo organello che pesa meno dell'acqua. L'acqua diventa più densa linearmente dalla superficie al fondo, il float ha densità `−1`, e un corpo che ne porta uno viene spinto verso la **Resting Depth**, la profondità a cui la densità media dei suoi organelli eguaglia quella dell'acqua. Il neurone resta senza peso, quindi un corpo che porta solo neuroni si muove come in v0.1.

La spinta è `g·a·(1 + y/H)`, con `a` l'area del float e `H` la profondità dell'acquario. Sale il doppio vicino al fondo, perché lì l'acqua è più densa, senza che nessun gene lo sappia.

La costante `g` non l'abbiamo trovata a tentativi, l'abbiamo derivata. Un corpo di riferimento con un solo float di raggio `r_new` sale a una velocità proporzionale a `g`. Il moto browniano ha una diffusione `D = s²/4`, con `s` il passo. Il profilo di equilibrio ha un'altezza di scala `D/v`, e se la imponiamo uguale allo spessore della Bright Band, `g` esce in forma chiusa: circa 4,2. In un progetto dove quasi ogni costante è stata calibrata dopo, questa è stata scritta prima.

Il primo controllo l'ha smentita a metà. Quaranta corpi con un float ciascuno, centocinquantamila tick, e la profondità media misurata è 9,65 contro 8,28 previsti; nella Bright Band sta il 58% dei corpi, non il 69%. Non è `g` sbagliata: la previsione vale per corpi che non si toccano, e quaranta corpi di raggio 1 si ammassano in due o tre file contro la superficie e si spingono giù a vicenda. Avevamo scritto la ragione nel commento del codice prima di vedere il numero, e il numero è andato dalla parte che il commento diceva. È il primo caso della domanda sbagliata, ma questa volta ce ne siamo accorti subito: il profilo che avevamo calcolato risponde a "dove vanno i corpi se non si toccano", e noi stavamo misurando "dove vanno i corpi in un acquario".

## Il muro che rifà l'ammaccatura

Il secondo caso è meno facile da vedere, perché la domanda sbagliata stava in un documento nostro.

M1 aveva fissato un tetto di 0,5 sulla penetrazione tra due corpi, e l'ADR-0008 aveva scritto in anticipo il rimedio se una folla l'avesse rotto: un numero fisso `K` di passate di separazione per tick, il più piccolo `K` che regge. Con il float, la folla di M1 (160 corpi, ognuno con un galleggiante di raggio 0,1, venticinque volte la sua spinta iniziale) si ammassa sulla superficie per cinque file. Il peggior overlap era 0,746.

Abbiamo letto "passate" come "ripeti la passata". Con `K` = 8 il peggiore scendeva a 0,71. Con `K` = 32 saliva a 0,79. Otto volte più lavoro, nessun effetto, anzi un po' peggio.

Il colpevole era il muro. La superficie spinge la fila di sopra dentro quella di sotto, e il vincolo del muro, applicato una volta sola a fine tick, rimetteva i corpi esattamente dove la separazione li aveva appena tolti. Più passate dopo la stessa ammaccatura non servono a niente, se è il muro a rifarla a ogni tick. Una passata non era "separa", era "separa, poi rimetti dentro": con quella forma `K` = 2 dà 0,544, ancora sopra, e `K` = 3 regge.

Tre, quindi, e il numero viene da una misura. La riga dell'ADR aveva ragione sul meccanismo e torto sul significato di una parola, e nessuno poteva saperlo prima di mettere un muro vero davanti a una folla vera: quella di M1 non toccava la superficie abbastanza a lungo da mostrarlo. Il costo è che la separazione ora gira tre volte per tick in ogni mondo, anche in quello senza organelli: il golden hash è passato da `1f3f5bf3` a `fd8594ce`, e stavolta la prova che sia cambiato solo per questo sta nella storia del commit.

C'è una nota a margine su come ce ne siamo accorti. Tre copie scritte a mano dello stesso passo, nei test di `world.test.ts`, hanno smesso di combaciare col mondo e il fallimento era un `toEqual` con differenze alla quindicesima cifra. Non era un bug, la copia aveva una sola passata. Ora il passo è una funzione sola, `resolveCollisions`.

## Dritti per la loro fisica

Torniamo alla tabella. Il Body Axis è un vettore unitario di coseno e seno, girato dalla coppia `τ` divisa per l'attrito rotazionale `8πR³`, quello della stessa sfera di Stokes che dà `6πR` all'attrito di traslazione. Un figlio eredita l'asse del genitore, ma il galleggiante nasce con una posizione mutata, e la posizione cambia da corpo a corpo.

Questa è la domanda sbagliata della tabella. L'angolo dell'asse dal mondo vale zero solo per un corpo il cui float è esattamente sopra il centro quando l'asse è zero. Per gli altri, "dritto" vuol dire che il float sta sopra il centro, e l'asse che lo ottiene è quello che il genoma gli ha dato: quell'angolo non è zero. Il 105° del seme 9 e il 94° del seme 7, letti come corpi rovesciati, potevano essere corpi perfettamente dritti per la loro fisica.

Abbiamo cambiato la misura: non più l'angolo dell'asse dal mondo, ma l'angolo della **leva** del float, il suo scostamento dal centro girato dall'asse, dalla verticale verso l'alto. Zero gradi vuol dire il float proprio sopra il centro.

| seme | angolo della leva | coseno |
| ---- | ----------------- | ------ |
| 7    | 4,8°              | 0,97   |
| 9    | 0,25°             | 1,00   |
| 11   | 7,4°              | 0,95   |
| 8    | 33°               | 0,68   |
| 10   | 62°               | 0,42   |

Tre semi su cinque sono dritti, quasi esattamente. La gravitaxis passiva c'era, e la domanda di prima non poteva vederla.

Restano il seme 8 e il seme 10. Una sonda a perdere, cancellata dopo l'uso, ha guardato i portatori uno per uno ogni 12.500 tick. La spiegazione è meno interessante di quella che speravamo, e ha due metà. La prima: sono pochi. Nel seme 10 i portatori sono due, in molti campioni zero; nel seme 8 sono sei, e compaiono solo dal tick 75.000. Una media su due corpi non è una popolazione.

La seconda: non sono storti, sono lenti. Una leva di 4·10⁻⁴ e una coppia di 10⁻³ su un attrito rotazionale di circa 15 danno `ω ≈ 10⁻⁴` radianti per tick. Un corpo a 125° ci mette circa ventimila tick a raddrizzarsi, e li abbiamo visti farlo: i sei corpi del seme 8 passano da 125°, 57°, 120°, 109°, 166° e 28° al tick 75.000 a 7°, 0°, 0°, 1°, 1° e 0° al tick 100.000. A fine corsa sono tutti dritti. La media sulla seconda metà li coglie mentre si raddrizzano, una fotografia di un'onda a metà: la rotazione di un float da 0,02 di raggio è più lenta della finestra con cui l'avevamo guardata.

## Quello che resta aperto

- **Perché a 125°?** I corpi del seme 8 erano così lontani dalla verticale al tick 75.000 pur ereditando l'asse del genitore. Una leva mutata nel figlio sposta l'asse preferito, ma non sappiamo di quanto. Non l'abbiamo misurato.
- **L'overlap vivo.** Il peggiore nel seme 10 è 2,278, il tetto del test sulla corsa viva è 2,0. Il rapporto non boccia niente, perché lo strumento non fa da cancello (ADR-0024), ma è il numero che avremmo voluto vedere sotto il tetto senza guardarlo. Le tre passate sono tarate su una folla di 160 corpi con un float da 0,1, e la distanza da questo picco, su un seme vero, non l'avevamo misurata.
- **Un golden senza test.** Che il mondo a roster vuoto non cambi quando l'asse entra nell'hash l'abbiamo verificato a mano: tolto l'asse, il golden era ancora `93ab5e6b`; rimesso, è diventato `1f3f5bf3`. Nel repo resta un commento che lo racconta e nessun test. Il revisore l'ha segnalato come il punto più debole del ticket, e ha ragione: la garanzia è vera perché qualcuno l'ha controllata una volta, non perché qualcuno la ricontrolla.
- **La frazione.** Il 6,1% ± 3,3% dei portatori di float, contro il 3,4% ± 4,5% dei neuroni, sta dentro il rumore: in centomila tick un lineage vede poche generazioni. I portatori però stanno più in alto, a una profondità media di 5,3 contro 9,2 per chi non lo porta, in tutti e cinque i semi.

Tre volte la risposta è stata giusta e la domanda no. Il profilo prevedeva corpi che non si toccano, il piano prevedeva una passata che non includeva il muro, la tabella misurava un angolo dal mondo. Il numero è sempre stato onesto: la parte difficile era capire che cosa stesse misurando.
