---
title: "La domanda sbagliata, tre volte"
description: "Un organello più leggero dell'acqua porta i corpi verso la superficie, e quelli che lo portano dovrebbero stare dritti. Tre volte nello stesso milestone il numero era giusto e la domanda no."
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

Il progetto è un acquario virtuale in due dimensioni. Gli organismi sono dischi, i **corpi**, che si muovono a caso spinti dal moto browniano, vivono della luce che scende dalla superficie, si riproducono con piccole mutazioni del genoma e muoiono. Il tempo avanza a passi discreti, i **tick**. Ogni misura si ripete su più **semi**, i valori iniziali del generatore casuale, per vedere se le storie concordano. Fino a ora nessun gene poteva spostare un corpo in profondità. Questo milestone, M8, aggiunge la gravità.

Il primo organello che pesa è il **float**, più leggero dell'acqua. Un corpo che lo porta dovrebbe salire, e un corpo con il float sopra il centro dovrebbe stare dritto: se lo si gira, il float tira su da una parte e il corpo si raddrizza da solo. Si chiama gravitaxis passiva, "passiva" perché nessun gene sa dove sia l'alto. Nei test unitari funziona. Poi abbiamo misurato la popolazione vera, cinque semi di centomila tick, e per i corpi che portano un float abbiamo letto l'angolo medio del loro **Body Axis**, l'orientamento del corpo rispetto al mondo, in gradi dalla verticale:

| seme | angolo medio | coseno medio |
| ---- | ------------ | ------------ |
| 7    | 94°          | −0,06        |
| 8    | 83°          | 0,08         |
| 9    | 105°         | −0,27        |
| 10   | 48°          | 0,61         |
| 11   | 61°          | 0,45         |

Angoli sparsi come se l'orientamento fosse a caso. La gravitaxis passiva, nella popolazione vera, non c'era.

Questo articolo racconta come abbiamo scoperto che la tabella rispondeva a una domanda diversa da quella che volevamo fare. Nello stesso milestone era già successo altre due volte: il numero era giusto e la domanda no. La prima volta l'abbiamo capito subito, le altre due no.

## Un organello che sale

Fino a M7 un corpo aveva una posizione e il moto browniano era l'unica forza: un lignaggio stava nella **Bright Band**, la fascia vicino alla superficie dove la luce è ancora abbondante, spessa dieci raggi di corpo, solo perché i fondatori erano nati lì. In M8 l'acqua diventa più densa linearmente dalla superficie al fondo, il float ha densità `−1`, e un corpo che ne porta uno viene spinto verso la **Resting Depth**, la profondità a cui la densità media dei suoi organelli eguaglia quella dell'acqua. Il neurone, l'altro organello, resta senza peso, quindi un corpo che porta solo neuroni si muove come prima.

La spinta è `g·a·(1 + y/H)`, con `a` l'area del float, `y` la profondità e `H` quella dell'acquario. Sale il doppio vicino al fondo, perché lì l'acqua è più densa, senza che nessun gene lo sappia.

La costante `g` non è stata trovata a tentativi, è stata derivata. Un corpo di riferimento con un solo float sale a una velocità proporzionale a `g`. Il moto browniano ha una diffusione `D = s²/4`, con `s` il passo. Il profilo di equilibrio delle profondità ha un'altezza di scala `D/v`, e se la imponiamo uguale allo spessore della Bright Band, `g` esce in forma chiusa: circa 4,2. In un progetto dove quasi ogni costante è stata calibrata dopo, questa è stata scritta prima.

Il primo controllo l'ha smentita a metà. Quaranta corpi con un float ciascuno, centocinquantamila tick: la profondità media misurata è 9,65 contro 8,28 previsti, e nella Bright Band sta il 58% dei corpi, non il 69%. Non è `g` sbagliata. La previsione vale per corpi che non si toccano, e quaranta corpi di raggio 1 si ammassano in due o tre file contro la superficie e si spingono giù a vicenda. La ragione l'avevamo scritta nel commento del codice prima di vedere il numero, e il numero è andato dalla parte che il commento diceva. Il profilo calcolato risponde a "dove vanno i corpi se non si toccano", e noi stavamo misurando "dove vanno i corpi in un acquario". È la domanda sbagliata più innocua delle tre, perché sapevamo già dove cercare.

## Il muro che rifà l'ammaccatura

La seconda sta in un documento nostro.

Fin dal primo milestone la simulazione ha un tetto di 0,5 raggi sulla **penetrazione** tra due corpi, la misura di quanto si sovrappongono. Un'**ADR**, il documento in cui scriviamo una decisione e le sue ragioni (la numero 0008, per l'esattezza), aveva fissato in anticipo il rimedio se una folla l'avesse sforato: un numero fisso `K` di passate di separazione per tick, il più piccolo `K` che regge. Con il float, la folla del primo milestone (160 corpi, ognuno con un galleggiante di raggio 0,1, venticinque volte la spinta di un float appena nato) si ammassa sulla superficie per cinque file. La penetrazione massima era 0,746.

"Passate" è stato letto come "ripeti la passata". Con `K` = 8 la penetrazione massima scendeva a 0,71. Con `K` = 32 saliva a 0,79. Otto volte più lavoro, nessun effetto, anzi un po' peggio.

Il colpevole era il muro. La superficie spinge la fila di sopra dentro quella di sotto, e il vincolo del muro, applicato una volta sola a fine tick, rimetteva i corpi esattamente dove la separazione li aveva appena tolti. Più passate dopo la stessa ammaccatura non servono a niente, se è il muro a rifarla a ogni tick. Una passata non era "separa", era "separa, poi rimetti dentro": con quella forma `K` = 2 dà 0,544, ancora sopra, e `K` = 3 regge.

Tre, quindi, e il numero viene da una misura. La riga dell'ADR aveva ragione sul meccanismo e torto sul significato di una parola, e nessuno poteva saperlo prima di mettere un muro vero davanti a una folla vera: quella del primo milestone non toccava la superficie abbastanza a lungo da mostrarlo. Il costo è che la separazione ora gira tre volte per tick in ogni mondo, anche in quello senza organelli. Il **golden hash**, un valore di controllo di un mondo di riferimento che cambia se cambia qualunque tick, è passato da `1f3f5bf3` a `fd8594ce`, e stavolta la prova che sia cambiato solo per questo sta nella storia dei commit.

## Dritti per la loro fisica

Torniamo alla tabella. Il Body Axis è un vettore unitario di coseno e seno, girato dalla coppia `τ` divisa per l'attrito rotazionale `8πR³`, quello della stessa sfera in un fluido viscoso che dà `6πR` all'attrito di traslazione. Un figlio eredita l'asse del genitore, ma il suo float nasce con una posizione mutata, e la posizione cambia da corpo a corpo.

Qui sta la domanda sbagliata. La tabella misurava l'angolo dell'asse dal mondo, che è zero solo per un corpo il cui float, nel suo sistema di riferimento, sta già sopra il centro. Se invece il float è a sinistra del centro, il corpo è dritto quando è ruotato di un quarto di giro, e il suo equilibrio è a 90°, non a 0°. Il 105° del seme 9 e il 94° del seme 7, letti come corpi rovesciati, potevano essere corpi perfettamente dritti per la loro fisica.

La misura sull'asse l'aveva scritta Claude, nel programma che stampa il rapporto. Sempre Claude, guardando la tabella, ha proposto un'altra misura, e Fabio ha detto di aggiungerla: non più l'angolo dell'asse dal mondo, ma l'angolo della **leva** del float, il suo scostamento dal centro girato dall'asse, dalla verticale verso l'alto. Zero gradi vuol dire il float proprio sopra il centro.

| seme | angolo della leva | coseno |
| ---- | ----------------- | ------ |
| 7    | 4,8°              | 0,97   |
| 9    | 0,25°             | 1,00   |
| 11   | 7,4°              | 0,95   |
| 8    | 33°               | 0,68   |
| 10   | 62°               | 0,42   |

Tre semi su cinque sono dritti, quasi esattamente. La gravitaxis passiva c'era, e la domanda di prima non poteva vederla.

Restano il seme 8 e il seme 10, e su quelli Fabio ha chiesto di indagare. Una sonda a perdere, cancellata dopo l'uso, ha guardato i portatori uno per uno ogni 12.500 tick. La spiegazione è meno interessante di quella che speravamo, e ha due metà. La prima: sono pochi. Nel seme 10 i portatori sono due, in molti campioni zero; nel seme 8 sono sei, e compaiono solo dal tick 75.000. Una media su due corpi non è una popolazione.

La seconda: non sono storti, sono lenti. Una leva di 4·10⁻⁴ e una coppia di 10⁻³ su un attrito rotazionale di circa 15 danno una velocità angolare di circa 10⁻⁴ radianti per tick. Un corpo a 125° ci mette circa ventimila tick a raddrizzarsi, e li abbiamo visti farlo: i sei corpi del seme 8 passano da 125°, 57°, 120°, 109°, 166° e 28° al tick 75.000 a 7°, 0°, 0°, 1°, 1° e 0° al tick 100.000. A fine corsa sono tutti dritti. La media sulla seconda metà li coglie mentre si raddrizzano, come una fotografia scattata a metà di un'onda: la rotazione di un float da 0,02 di raggio è più lenta della finestra con cui l'avevamo guardata.

## Quello che resta aperto

- **Perché a 125°?** I corpi del seme 8 erano così lontani dalla verticale al tick 75.000 pur ereditando l'asse del genitore. Una leva mutata nel figlio sposta l'asse preferito, ma non sappiamo di quanto. Non l'abbiamo misurato.
- **La penetrazione nel mondo vivo.** Il peggiore nel seme 10 è 2,278, il tetto del test sulla corsa viva è 2,0. Il rapporto non boccia niente, perché lo strumento non fa da cancello (ADR-0024), ma è il numero che avremmo voluto vedere sotto il tetto senza guardarlo. Le tre passate sono tarate su una folla di 160 corpi con un float da 0,1, e la distanza da questo picco, su un seme vero, non l'avevamo misurata.
- **Un golden senza test.** Che il mondo senza organelli non cambi quando l'asse entra nell'hash è stato verificato a mano: tolto l'asse, il golden era ancora `93ab5e6b`; rimesso, è diventato `1f3f5bf3`. Nel repo resta un commento che lo racconta e nessun test. Il revisore l'ha segnalato come il punto più debole del ticket, e ha ragione: la garanzia è vera perché qualcuno l'ha controllata una volta, non perché qualcuno la ricontrolla.

Tre volte la risposta è stata giusta e la domanda no. Il profilo prevedeva corpi che non si toccano, il piano prevedeva una passata che non includeva il muro, la tabella misurava un angolo dal mondo. Il numero è sempre stato onesto: la parte difficile era capire che cosa stesse misurando.
