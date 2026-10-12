---
title: "Rende più del previsto, vive meno del previsto"
description: "Il cloroplasto si ripaga prima del previsto, ma quasi nessun corpo lo porta a lungo. Due previsioni smentite in versi opposti e una lista rimasta vuota."
date: 2026-10-13
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - metabolism
  - measurement
  - ai-agents
lang: it
---

# Rende più del previsto, vive meno del previsto

Il progetto è un acquario virtuale in due dimensioni. Gli organismi sono dischi, i **corpi**, che si muovono a caso, vivono della luce che scende dalla superficie, si riproducono con piccole mutazioni del genoma e muoiono. Il tempo avanza a passi discreti, i **tick**. Ogni misura si ripete su più **semi**, i valori iniziali del generatore casuale, per vedere se le storie concordano. Un corpo può portare **organelli**, dischi dentro il disco, ognuno di un tipo. In M8 è arrivato il **float**, più leggero dell'acqua, che porta il corpo verso la superficie.

Questo milestone, M9, aggiunge il **cloroplasto**. Fino a ora la fotosintesi era una reazione del corpo intero, letta al suo centro. Ora ogni cloroplasto fissa carbonio sul proprio disco, in proporzione alla luce che riceve in quel punto e al proprio diametro. È anche più denso dell'acqua, quindi da solo fa affondare il corpo che lo porta. E costa: un prezzo fisso per tick, l'**overhead**, più uno per il suo tessuto, pagati prima che renda qualcosa.

Prima di misurarlo avevamo scritto che cosa aspettarci, in due parti. Un cloroplasto piccolo, di raggio 0,02, rende più di quanto costa solo dove la luce supera la media della **Bright Band**, la fascia vicino alla superficie dove la luce è ancora abbondante: i primi quattro raggi di corpo circa. E in centomila tick la frazione di corpi che portano ciascun tipo di organello resta vicina a quella con cui gli organelli nascono, perché il peso non basta a punire il cloroplasto e il rendimento non basta a premiarlo.

Sono andate male tutte e due, in versi opposti. Il cloroplasto rende più del previsto. Quasi nessun corpo lo porta a lungo.

## Rende più del previsto

Il prezzo del cloroplasto, `c_organelle`, l'avevamo derivato da un numero: `X`, il prodotto di luce, concentrazione interna di CO₂ e resa, misurato sulla Bright Band, circa 260. Con quel `X` il cloroplasto pareggia, per costruzione, sulla media della fascia. Restava da vedere se sul mondo di M9 il 260 reggeva. Ci aspettavamo di no, e in un verso: la fotosintesi consuma la CO₂ interna, quindi in superficie `X` doveva venire più basso.

| dove                 | `X` previsto  | `X` misurato |
| -------------------- | ------------- | ------------ |
| Bright Band, media   | 260           | 272 ± 7      |
| in superficie        | sotto 260     | 407          |
| pareggio di un nuovo | circa 4 raggi | 5,3 raggi    |

Il cloroplasto rende più del previsto e comincia a pagarsi più in basso, non più in alto. L'avevamo detto al contrario.

La prima versione dello strumento di misura (l'**harness**, il programma che stampa i rapporti) aveva detto un'altra cosa, e sembrava un risultato. Cercava la profondità a cui `r*(y)`, il raggio minimo per cui un cloroplasto si ripaga a quella profondità, eguaglia il raggio di un nuovo nato, e rispondeva "non incrociato dalle fasce": forse il cloroplasto non si paga mai. Era la domanda sbagliata, e l'aveva scritta Claude leggendo il ticket alla lettera. Il rendimento dipende dal diametro, non dal raggio, quindi il pareggio c'è quando `r*(y)` vale due volte il raggio di un nuovo nato, che è dove `X` torna a 260. Se n'è accorto Claude stesso, da una colonna accanto: il rapporto fra `r*` e quel raggio valeva già 1,28 in superficie e 2,3 a metà banda, il due era sotto gli occhi.

## Vive meno del previsto

Il rendimento per tick è una cosa, reggere centomila tick un'altra, e il test lungo di conservazione ci ha obbligati a guardarla. Quel test mette il bilancio di carbonio e ossigeno sotto carico con fondatori che portano tutti cloroplasti, di numeri e raggi diversi, alcuni in superficie, dove la CO₂ disponibile limita quanto si può fissare. Carbonio e ossigeno sono tornati a `1e-9` al primo colpo. Quello che non reggeva era l'asserzione che i portatori fossero ancora vivi.

Il ticket l'aveva previsto: se i fondatori muoiono prima, si ricostruiscono i fondatori e non la tolleranza. È la frase che ha deciso come si è lavorato. La tolleranza non si tocca, si cambia il mondo.

Ci aspettavamo che i fondatori in superficie, dove c'è la luce, fossero i più robusti. Sono i primi a morire. Con tre quarti dei fondatori in superficie la popolazione è a zero entro 10.000 tick, senza una nascita. Con tre quarti a metà acquario ne nascono 29 e la linea si spegne comunque entro 35.000. Con cloroplasti più grandi (raggi fra 0,04 e 0,12 invece di 0,03-0,07) peggio ancora: 48 fondatori, zero a 10.000 tick. Un corpo piccolo non regge il prezzo di un organello grosso, e il prezzo si paga prima di incassare.

Undici configurazioni su dodici hanno finito con zero portatori prima del tick 100.000. Ogni tentativo costava 18 secondi di simulazione e il solo segnale era una tabella di popolazione ogni 5000 tick, quindi si procedeva alla cieca. Alla fine ha retto una scelta di 32 fondatori, metà in superficie e metà da metà profondità in giù, senza una ragione dietro: regge e basta. Non sappiamo perché i fondatori in superficie muoiano per primi. Le ipotesi sono due e nessuna è verificata: il cloroplasto denso li fa affondare, oppure in superficie si sottraggono la CO₂ a vicenda.

## Nel mondo vero, quasi nessuno

Poi il **Mondo di Riferimento**, quello in cui la popolazione nasce, muta e muore da sola, sui cinque semi di sempre a centomila tick. Il **roster**, l'elenco dei tipi di organello da cui la mutazione pesca, ora è neurone, float e cloroplasto, un terzo ciascuno. Se la deriva fosse l'unica forza, ogni tipo dovrebbe stare al 6,7% dei corpi. Le frazioni di corpi che portano ciascun tipo, misurate:

- **float**: 5,9%
- **neurone**: 1,7%
- **cloroplasto**: 1,0%

L'ordine che avevamo scritto è giusto, il cloroplasto sotto il float. Ma tutti e tre stanno molto sotto il 6,7%, e il numero da spiegare non è quel confronto: è che in questo mondo un portatore, di qualunque tipo, vive poco.

Un secondo dato pesa di più. Il portatore ha sempre un solo pezzo: la media è 1,00 per tipo, in tutti e tre. Nessun corpo ha due cloroplasti, nessuno ha un cloroplasto e un float insieme, zero su 4.352 letture. La lista dei **Resting Depth** interni, le profondità a cui un corpo con pezzi che pesano e pezzi che galleggiano si ferma dentro la colonna d'acqua, è vuota. È il motivo per cui M9 esiste: il primo Resting Depth interno che una linea di discendenti può raggiungere. Che la composizione decida la profondità resta vero, ma solo nella **Popolazione Fissa**, un gruppo di corpi costruiti a mano per isolare un effetto. Il mondo non ci arriva.

Un'avvertenza sul ritmo: a 8000 tick, su dodici semi, solo quattro avevano un organello qualsiasi, e nessuno un float o un cloroplasto. Il roster di default è M9 sulla carta molto prima che nel mondo. Un grafico dei portatori a 10.000 tick non mostra la competizione fra tre tipi, mostra la coda di un'attesa.

## Quello che la misura non può dire

Tre previsioni restano senza giudizio, e il motivo è lo stesso: la misura ha bisogno di corpi che il mondo non produce.

- **La luce sotto il centro.** Un cloroplasto di un corpo eretto dovrebbe leggere fino a un quinto di luce in meno del centro. I cloroplasti misurati sono 40, quelli con l'asse entro 30° dalla verticale sono 3, e quei 3 leggono 1,09, sopra il centro. Con tre punti non è una smentita, è l'assenza di uno strumento.
- **Il raggio contro `r*`.** Tutti i cloroplasti hanno raggio 0,02: nessuno è cresciuto, nessuno si è ridotto. Il rapporto per fasce scende da 0,78 in superficie a 0,08 a metà colonna, ma si muove solo `r*(y)`. È una costante divisa per una curva.
- **Il tempo fra generazioni.** L'abbiamo derivato, non misurato: tick totali divisi per la generazione media, per seme. Viene 22.737 ± 3.942, contro i circa 20.000 previsti, e vale come "una generazione ogni 22.000 tick" solo se le generazioni sono ugualmente spaziate.

## Che cosa resta

Il cloroplasto si paga prima del previsto, e nessun corpo del Mondo di Riferimento lo combina con un float. Le due cose possono stare insieme se un corpo con un cloroplasto ha altri modi di morire presto, ma è un'ipotesi, e non l'abbiamo provata. Quello che sappiamo è che la domanda per cui M9 è stato costruito, se una linea di discendenti paga spinta verso l'alto in cambio di carbonio, non ha ancora materia a cui rispondere in questo mondo.

Per ora M9 non dà nessun verdetto sulla profondità come fatto genetico: i tempi in gioco (la salita del float circa 36.000 tick, il rilassamento circa 71.000, il raddrizzamento circa 20.000) sono tutti pari o maggiori di una generazione. Nessuna costante del mondo si è mossa, e non si muove prima di M12.
