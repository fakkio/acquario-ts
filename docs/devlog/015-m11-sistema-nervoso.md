---
title: "Quello che avevamo scritto prima di misurare"
description: "M11 dà un sistema nervoso ai corpi. Due misure, due previsioni scritte prima: una quasi azzeccata, l'altra rimasta senza niente da misurare."
date: 2026-10-29
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - measurement
  - neural-networks
  - ai-agents
lang: it
---

# Quello che avevamo scritto prima di misurare

Il progetto è un acquario virtuale in due dimensioni. Gli organismi sono dischi, i **corpi**, che si muovono a caso, vivono della luce che scende dalla superficie, si riproducono con piccole mutazioni del genoma e muoiono. Il tempo avanza a passi discreti, i **tick**. Ogni misura si ripete su più **semi**, i valori iniziali del generatore casuale. Un corpo può portare **organelli**, dischi dentro il disco, ognuno di un tipo: l'ultimo arrivato, in M10, è il **thruster**, che spinge il corpo lungo il proprio orientamento. Un programma di misura, la **harness**, fa girare mondi e stampa rapporti. Il **Mondo di Riferimento** è il mondo senza interventi: la popolazione nasce, muta e muore da sola.

Fino a M10 nessun corpo poteva reagire a niente. Il thruster spingeva sempre al livello con cui era nato, il **drive**, anche al buio, anche in cima all'acquario. M11 aggiunge il sistema nervoso, e lo fa con tre pezzi:

- la **sinapsi**, una connessione con un peso che porta un valore da una **porta** di uscita a una porta di ingresso;
- i **sensi innati**, le porte di uscita del corpo stesso: quanta energia ha, quanta luce c'è al suo centro, da che parte è la superficie;
- il **neurone**, un organello che somma i valori che gli arrivano e li ricorda per un po', con una memoria che si svuota solo lentamente.

Il caso più corto è il **Reflex**: una sinapsi che va da un senso innato direttamente a un **attuatore**, un organello che agisce sul mondo come il thruster, senza neurone in mezzo. Per esempio, dalla luce alla potenza di un thruster, con un peso negativo: più luce c'è, meno il thruster spinge.

Prima di far girare qualunque cosa, per ciascuna delle due misure abbiamo scritto che cosa ci aspettavamo di leggere. Una previsione scritta dopo il risultato non può sbagliare, e quindi non dice niente. Qui racconto che cosa è successo quando i numeri sono arrivati.

## Un Reflex cablato a mano

Il primo ticket di misura (#102) non lascia alla mutazione il compito di costruire il Reflex: lo cabla l'harness. Quaranta corpi identici, senza nascite né morti, ciascuno con un solo thruster al centro, puntato verso l'alto, e una sola sinapsi dalla luce alla potenza del thruster. Il peso è −4 e il drive è 0,5. Il segnale del thruster è `0,5 − 4 × luce`, tenuto tra 0 e 1. La luce scende con la profondità: in alto il valore sarebbe negativo e il segnale resta a zero, e diventa positivo solo oltre una **profondità di arresto**, dove la luce è scesa a 0,125. Con queste scelte la profondità di arresto sta a 9 unità dalla superficie (un corpo ha un raggio di circa 1), dentro la **Bright Zone**, la fascia vicina alla superficie dove la luce è abbastanza forte perché la fotosintesi conti.

Sopra quella profondità il thruster è spento e il corpo si muove a caso. Sotto, spinge verso l'alto, tanto più forte quanto più buio trova. Ci aspettiamo quindi che i corpi si fermino vicino alla profondità di arresto: un tratto piatto sopra, dove nulla li trattiene, e una coda che decade verso il basso.

La previsione l'abbiamo derivata prima di far girare niente. Con una forza che dipende dalla profondità, e senza flusso netto attraverso le pareti, la densità dei corpi è `p(y) ∝ exp(−Φ(y))`, dove `Φ` è l'integrale della velocità di deriva diviso per il coefficiente di diffusione. Le ipotesi sono scritte accanto al codice: asse verticale, nessuna coppia, diffusione browniana, attrito `6π·R`, corpi che non interagiscono. Nel codice non c'è la formula: la funzione integra la tabella della luce passo per passo, così il limite a 1 del segnale e le pareti dell'acquario non richiedono casi a parte.

Poi abbiamo misurato: 40 corpi, 150.000 tick.

| Grandezza                             | Prevista | Misurata |
| ------------------------------------- | -------- | -------- |
| Profondità media (in unità)           | 7,60     | 8,27     |
| Corpi sopra la profondità di arresto  | 63,9%    | 57,7%    |
| Densità nel tratto piatto, per fascia | 8,0%     | circa 7% |
| Corpi oltre le 23 unità               | 0,1%     | 0,4%     |

Il tratto piatto c'è, appena sotto il livello previsto, e la coda decade nella direzione giusta. Dove sbaglia, sbaglia sempre nello stesso verso: i corpi stanno un po' più in basso della teoria, e la coda è più pesante. Lo stesso scarto l'avevamo visto nei thruster di M10, e lì la spiegazione era la **separazione**, la regola che spinge due corpi sovrapposti ad allontanarsi: con quaranta corpi di raggio circa 1 che si affollano sopra la profondità di arresto, qualcuno viene respinto verso il fondo. Qui non l'abbiamo verificato: il commento nel codice parla di una possibile separazione, e il ticket scrive "probabilmente".

Per un primo cablaggio è un buon risultato: la rete fa quello che la formula dice, entro uno scarto che ha una spiegazione plausibile. Ma dice una cosa sola, che un Reflex scritto a mano funziona. Non dice niente su cosa farebbe la mutazione se dovesse trovarlo da sola.

## Una promessa e il regime dove la si controlla

Prima di poter chiedere alla mutazione di costruire reti, serviva una garanzia di un altro tipo, e riguarda lo **split**. È l'operatore che divide un organello in due, e per un neurone fa questo: le aree dei due pezzi sommano a quella dell'originale, le sinapsi in ingresso sono copiate su entrambi, quelle in uscita sono divise in `f·w` e `(1−f)·w`, e una sinapsi che il neurone aveva su se stesso diventa quattro. Su carta i due pezzi ricevono lo stesso ingresso, tengono la stessa memoria, emettono lo stesso segnale, e a valle i pesi si sommano di nuovo a `w`. Un neurone diviso fa esattamente quello che faceva prima.

È una proprietà che conta più di quanto sembri. È l'unica protezione che la struttura nuova ha: una rete appena nata non deve rompere ciò che già funzionava, altrimenti ogni split è una scommessa contro l'evoluzione fatta fin lì. Quindi l'abbiamo scritta come invariante, in un test: dopo uno split, ogni segnale che arriva a un attuatore resta uguale a quello di prima, tick per tick.

Il test non può chiedere uguaglianza bit per bit. In aritmetica esatta la somma `f·w + (1−f)·w` fa `w`, in virgola mobile no: tra due numeri consecutivi rappresentabili c'è uno scarto minimo, l'**ulp**, l'unità dell'ultima cifra, e ogni somma ne può perdere un pezzo. Abbiamo scelto una tolleranza di 1e-9 su 500 tick, e il commento del test dice che la neutralità è esatta nell'aritmetica e che lo scarto viene solo dal calcolo.

Il problema sta nella parola "ogni rete". In una rete con cicli un errore di un ulp torna indietro a ogni tick e può crescere. Nel prototipo fatto prima del ticket, una rete su 400 portava lo scarto fino a 1,8e-9, cioè oltre la soglia. Con una scarica, poi, una differenza minima nella memoria può decidere se la soglia scatta o no, e allora lo scarto non è più piccolo.

Avevamo due strade: allargare la tolleranza, o dichiarare in quale famiglia di reti la promessa viene controllata. Abbiamo preso la seconda. Il generatore del test costruisce reti con questi limiti:

- `τ` scelto tra 1, 2 e 5;
- pesi interni entro ±2;
- 30 reti senza scarica, e 15 con scarica dove ogni soglia sta a un margine di 1e-3 dalla memoria con cui viene confrontata.

La rete che amplifica l'ulp esiste, e questo test passa anche perché non la genera. Non è un trucco se lo si scrive: nel codice la tolleranza è dichiarata, l'orizzonte è finito, i margini sono in chiaro, e il commento ora dice anche che il generatore evita le reti che amplificano. Quello che la garanzia vale, vale in quel regime e basta. Lo stesso criterio, controllato in un altro, potrebbe fallire.

È la distinzione che torna nella misura che segue. Una previsione ha un numero, e un numero si controlla sempre da qualche parte. Il punto è sapere dove, e se in quel luogo il mondo poteva dire di no.

## Un mondo senza niente da leggere

L'ultimo ticket (#103) è il più corto da implementare e il più difficile da raccontare. Legge il Mondo di Riferimento per cablaggio: cinque semi, 100.000 tick ciascuno, campionato ogni 2.500, con la seconda metà messa insieme, cioè 4.976 letture di corpi. Per ogni lettura chiede se il corpo porta una sinapsi, se ha un Reflex, se ha una **catena** (un senso, poi un neurone, poi un thruster), e quanto spende per le sinapsi.

Le previsioni, scritte nel documento di visione prima di far girare niente, dicevano: i thruster cablati sono quasi assenti, i Reflex e le catene stanno al livello della deriva, la persistenza regge. Ecco cosa è uscito.

| Previsione                                                            | Misura                                      | Che cosa ci dice     |
| --------------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| I thruster cablati sono quasi assenti                                 | portatori di sinapsi: 0,0% ± 0,0%           | niente               |
| Reflex e catene al livello della deriva                               | 0 Reflex e 0 catene su 4.976 letture        | niente               |
| La persistenza regge                                                  | popolazione minima 13, ogni seme sopravvive | che il mondo vive    |
| L'inserzione di organelli scende da un quinto a un sesto degli eventi | 16,7%                                       | niente, è aritmetica |

Tutte le previsioni sono rispettate, e quasi nessuna dice qualcosa. La seconda colonna sembra una conferma, ma "quasi assenti" è una previsione che il mondo ha superato nel modo più povero possibile: i portatori non sono pochi, sono zero. Con zero non si distingue la deriva dalla selezione, perché non c'è niente su cui una delle due potrebbe aver agito. Una domanda del ticket resta senza risposta, e nel rapporto è un trattino: la quota di spesa che le sinapsi pesano su un portatore, per sapere se il costo di una sinapsi è troppo alto. Non esiste nessun portatore su cui dividere, e l'harness stampa un trattino invece di un `NaN%`.

La spiegazione è nei numeri accanto. Una sinapsi, per essere inserita, ha bisogno di una porta di ingresso, cioè di un thruster o di un neurone. Nel Mondo di Riferimento il 3,7% dei corpi porta un neurone e lo 0,9% un thruster, quindi al massimo il 4,6% dei corpi ha una porta dove una sinapsi possa atterrare. Un evento strutturale su sei è un'inserzione di sinapsi, e a ogni nascita c'è al massimo un evento. Gli eventi che cadono su un corpo senza porte di ingresso non fanno niente. In media la popolazione è alla sesta generazione, e in sei generazioni le due cose non si sono incontrate.

Questo non è un difetto del sistema nervoso. Il sistema nervoso funziona: lo dimostrano il Reflex scritto a mano e la neutralità dello split. È il mondo che non ha ancora materia da cablare. Ma il rapporto dice qualcosa di più preciso su cosa significa "il mondo non seleziona il cablaggio": non che il cablaggio è raro, ma che per ora non c'è. Il rapporto stesso lo scrive nell'ultima riga, come condizione della sorpresa: una catena che funziona e si diffonde in una linea di discendenza. Non è successo, e con questi numeri di partenza era difficile che succedesse.

## I neuroni non si sono mossi

Una previsione, invece, aveva qualcosa da dire, ed è la sola che il mondo non ha confermato. Da M7 il neurone è un organello che occupa spazio, paga il suo costo di esistenza e non fa niente: nessuno poteva cablarlo. Era sembrato ovvio che la selezione lo stringesse, un neurone più piccolo costa meno, e abbiamo scritto che i neuroni sarebbero scesi verso il **raggio minimo**, `r_min`, il pavimento sotto cui un organello non si può più restringere.

Nel rapporto, il raggio dei neuroni misurato in `r_min` è 2,00, su 172 neuroni. Nessuno sta sul pavimento: lo 0,0%. E 2,00 è proprio il rapporto con cui un neurone nasce, perché `r_min` è la metà di `r_new`, il raggio di nascita. In media i neuroni sono ancora dove sono stati inseriti. Il numero è una media a due cifre: non esclude che qualcuno si sia mosso, esclude solo che la popolazione si sia spostata.

La previsione dava per scontato un orizzonte che il mondo non ha. Per restringersi un neurone ha bisogno di una mutazione che lo colpisca, che scelga il suo raggio tra i sei parametri che ora ha, e che vada nel verso giusto. Con al massimo una mutazione per nascita e sei generazioni, di questi eventi ce ne sono pochi, e non abbiamo misurato se la pressione stia agendo: la lettura dice solo che, a questo orizzonte, non ha spostato i neuroni in modo visibile. Può essere lentezza, può essere che la pressione sia più debole di quanto credevamo, e dai numeri non si distingue.

È il caso inverso al precedente. Lì la previsione era troppo timida e il mondo l'ha superata con uno zero. Qui era una previsione ragionevole su un meccanismo che dovrebbe esistere, e il mondo non la conferma né la smentisce: a questo orizzonte non si vede niente. In entrambi i casi l'errore non è nei dati, è nell'orizzonte che avevamo dato per scontato scrivendo la previsione.

## Che cosa resta

Due letture restano aperte, perché nessun ticket chiedeva di spiegarle.

- **Sovrapposizione.** Fuori dalle nascite, la peggiore è 0,5053 al seme 10, appena sopra lo 0,5 di M1. Nell'articolo precedente la stessa lettura, sullo stesso seme, era 0,5285: M11 non l'ha peggiorata. Ma è sopra lo 0,5 sia in M10 sia in M11, e non l'abbiamo mai indagata. Il ticket diceva "letto contro lo 0,5", non "deve stare sotto", e il rapporto stampa il numero e non lo fa valere come vincolo.
- **Il conteggio delle catene.** Lo strumento conta una catena una volta per ogni coppia di sinapsi che condividono il neurone, non una volta per neurone. Con zero catene la differenza non si vede. Il giorno che ne comparisse una vera, la scelta di come contarla deciderebbe se si legge "una" o "quattro".

La domanda vera non è in nessuno dei due punti, ed è fuori dal perimetro di M11: una popolazione usa davvero la sua rete? Per rispondere servono corpi con una rete, e il Mondo di Riferimento non ne produce. La prossima tappa, M12, ha come criterio una Generazione media di almeno 50 a fine corsa, contro le sei di oggi: più tempo evolutivo per ogni linea di discendenza. M13 introduce i **knockout**, mondi in cui un organello è tolto, per vedere se la sua assenza si nota; qualunque verdetto sull'uso della rete è rimandato lì. Fino a quel punto il sistema nervoso è dimostrato nel solo senso che conta adesso: fa quello che la formula dice, e uno split non lo rompe. Che serva a qualcosa, il mondo non l'ha ancora detto.
