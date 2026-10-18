---
title: "Una spinta gratis non si vede"
description: "Il test passa anche se il thruster non costa niente. Da lì, una domanda su ogni misura: in che mondo vedrei che è sbagliata?"
date: 2026-10-16
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - testing
  - measurement
  - ai-agents
lang: it
---

# Una spinta gratis non si vede

Il progetto è un acquario virtuale in due dimensioni. Gli organismi sono dischi, i **corpi**, che si muovono a caso, vivono della luce che scende dalla superficie, si riproducono con piccole mutazioni del genoma e muoiono. Il tempo avanza a passi discreti, i **tick**. Ogni misura si ripete su più **semi**, i valori iniziali del generatore casuale, per vedere se le storie concordano. Un corpo può portare **organelli**, dischi dentro il disco, ognuno di un tipo. Un programma di misura, la **harness**, fa girare mondi e stampa rapporti.

Questo milestone, M10, aggiunge il **thruster**: un organello che spinge il corpo lungo il proprio orientamento, con una forza che cresce con il suo raggio. Spingere costa. Il **Thrust Cost** è l'energia che il thruster paga a ogni tick, proporzionale alla forza che esercita, anche quando la spinta serve solo a restare fermi contro la gravità. Quando nessun segnale lo comanda, il thruster spinge a un livello di base, il **drive**, che qui vale 0,1.

Il lavoro è stato in tre ticket: il costo (#91), la misura di un thruster isolato contro le sue formule (#94), la lettura del **Mondo di Riferimento**, quello in cui la popolazione nasce, muta e muore da sola (#95). In tutti e tre la domanda utile è stata la stessa: se questo numero fosse sbagliato, in che mondo me ne accorgerei? Per il costo la risposta era "in nessuno di quelli che avevamo". Per l'orbita, "in questo, e subito". Per il Mondo di Riferimento, "in nessuno, perché i portatori sono troppo pochi".

## Il test che non può fallire

Il ticket del costo è andato dritto: la formula era scritta, l'hash dell'esecuzione di riferimento non si è mosso, i test sono passati al primo giro. Uno di quei test gira in un **mondo immortale**, dove l'energia si ferma a zero invece di passare sotto e nessuno muore, e afferma che con un thruster che carica l'energia non scende mai sotto zero. Passa. Ma passerebbe anche se il thruster non costasse niente.

Se n'è accorto un subagente di review, lanciato da Claude: il test non dimostra che il limite a zero scatti. Claude ha provato a dimostrarlo con un'asserzione più dura, "almeno una volta l'energia vale esattamente 0". Fallita. L'energia restava a 1241,88 per tick consecutivi, identica alla cifra. Il corpo ricarica la respirazione fino al tetto a ogni tick, manutenzione e spinta tolgono la stessa quantità, e il tick dopo si riparte dal tetto. Il Thrust Cost c'è ed è reale, ma quel mondo non lo porta mai a zero.

Secondo tentativo: il fondatore spostato da y=3 a y=40, al buio, perché la fotosintesi non rifornisse. Stessa energia, 1241,88. Claude non ha capito perché e non ha indagato oltre. Ha tolto l'asserzione, lasciato il test com'era, più debole di quanto il criterio di accettazione chiedesse, e l'ha scritto nel riepilogo invece di sistemarlo. L'idea di rafforzare il test era del subagente; il tentativo e la rinuncia sono di Claude. Non una decisione di progetto: un'esecuzione che non è riuscita.

La regola che ne esce vale per ogni invariante: chiedersi in quale situazione lo si vedrebbe rompersi, e controllare che il mondo di prova ci arrivi.

## `?? 0`

Lo stesso difetto, in forma di codice. Nella funzione che raccoglie i thruster di un corpo c'era `thrustCost: thrustCost ?? 0`, un valore predefinito silenzioso scritto per far compilare il caso in cui il campo manca. Un tipo che dichiara la forza ma non il costo avrebbe spinto gratis, e nessun test se ne sarebbe accorto, perché nel simulatore una spinta gratis e una spinta che funziona hanno lo stesso aspetto. L'ha segnalato la review sugli standard del repository, non Fabio e non Claude. Delle due review parallele (standard e spec) è stata l'unica a trovare qualcosa con conseguenze; il resto erano osservazioni di stile.

Claude ha messo davanti a Fabio due strade: un controllo a runtime che lancia un errore se il costo manca, oppure un unico campo `thrust: {force, cost}`, così il tipo non può esistere a metà. Ha raccomandato la seconda, dicendo che era un refactoring più largo di quanto il ticket chiedesse e che restare nel perimetro era un'opzione valida. Fabio ha scelto il campo unico.

La scelta mostra la divisione di lavoro del progetto. Il "come" di progetto, cioè dove vive l'invariante (nei tipi o in un controllo), è di Fabio. Il "come" di esecuzione, la forma del campo e i punti da toccare, è di Claude.

Una riga dell'ADR-0006, il documento che fissa l'ordine dei passi del tick, aveva lo stesso problema in prosa. Metteva "thrust" fra lo step 5 e lo step 6, ma il Thrust Cost è addebitato nel 5 e la spinta applicata nel 6, quindi la parola poteva voler dire due cose. La numerazione non cambiava, la riga era ambigua; Claude ha aggiunto una frase.

## Il numero raccontava la causa

Con #94 il rapporto si rovescia: qui l'errore si vedeva, e dava le istruzioni per trovarlo.

Il ticket misura un thruster tangenziale, che fa girare il corpo in un'orbita di raggio 1,4. Il primo ostacolo era di principio: il moto browniano sposta il corpo di una ventina di unità nel tempo di un periodo, circa 30.000 tick, e il ticket diceva "letti dalla traiettoria", che così com'è è tutta rumore. La harness, per ADR-0024, non apre porte sue: passa da `createWorld` e `advance`, e se una misura non ci passa la risposta è un'opzione sul mondo. Claude ha aggiunto `brownian: "off"` a `WorldOptions`, con un test, senza chiederlo: il perimetro del ticket non lo prevedeva e gli è sembrato il minimo. L'ha detto nel riepilogo.

Il primo giro sull'orbita:

| grandezza | misurata | prevista | scarto |
| --------- | -------- | -------- | ------ |
| periodo   | 3,159e4  | 2,978e4  | +6%    |
| raggio    | 1,387    | 1,334    | +4%    |

Due errori con lo stesso segno, in rapporto 3:2. Il periodo va come `R³` e il raggio come `R²`, quindi un `R` sbagliato del 2% dà esattamente +6% e +4%. Il numero raccontava la causa prima che la cercassimo.

La causa: il raggio del corpo non è `sqrt(1 + r²)`. Con il thruster a distanza 1 dal centro il corpo cresce, a circa 1,02, perché conta fin dove arriva l'organello. La prima correzione di Claude leggeva il raggio da un corpo con il thruster al centro, e la previsione non si è mossa di una cifra: giusta correzione, posto sbagliato. Alla seconda, con il raggio letto da un corpo con la stessa leva dell'orbita, periodo e raggio coincidono con le formule alla quarta cifra.

Il raggio viene dal mondo, non da una derivazione scritta nella harness. Il `sqrt(1 + R_NEW²)` stava già in `centreRange` di `buoyancy`, e vale per un float al centro. Una formula copiata in due posti diventa due formule, e la contabilità dell'area è del corpo: una copia nella harness la farebbe divergere in silenzio.

## Il Mondo di Riferimento, a pochi

Il ticket #95 legge il Mondo di Riferimento per spinta, sui cinque semi di sempre. Delle cinque previsioni scritte prima, due sono cadute per la stessa ragione: i portatori sono pochi. Il thruster sta all'1,4% dei corpi, il float all'1,2%, con una variazione fra semi da 0% a 3,5%. Su circa 970 corpi per seme, l'1,4% sono una dozzina di corpi. La previsione "thruster sotto il float" non regge, ma non si può nemmeno dire il contrario: la differenza sta dentro il rumore.

L'altra previsione caduta era "la maggior parte dei portatori gira". Sommando i semi: 48,5%. Seme per seme: 36%, 100%, 50%, 0%, 0%, su 66 letture in tutto. Un seme dove tutti girano e due dove nessuno gira non è una frequenza, è la storia di uno o due lignaggi. Il numero complessivo dice "metà" e nasconde che la domanda, con questi conteggi, non ha risposta. Dipende anche da una soglia scelta da Claude: 1e-4 rad/tick, un periodo di circa 63.000 tick, qualche generazione. Il ticket diceva solo "sopra una soglia fissata nelle impostazioni"; Claude l'ha scritta nel commento di chiusura e non solo nel codice.

Le previsioni che hanno tenuto sono tutte sul "niente":

- **spinta verticale media**: −9,9e-4 ± 1,7e-3, contro una spinta di 0,0053, con il segno che cambia da un seme all'altro;
- **drive medio**: 0,1000 esatto, quindi nessuna selezione;
- **profondità dei corpi con solo thruster**: 9,023, contro 9,011 dei corpi senza organelli.

Prevedere "nessun effetto" è facile da azzeccare e difficile da distinguere dal non aver misurato abbastanza. È il test iniziale rovesciato: lì il mondo non poteva mostrare il guasto, qui non può mostrare l'effetto.

E il costo, che apriva l'articolo, qui è quasi invisibile per ragioni sue: il Thrust Cost è lo 0,6% della spesa di un portatore, 0,062 contro 9,77 di manutenzione. Il thruster che nel ticket "costa il doppio dell'overhead a piena potenza" a drive 0,1 costa poco più di niente.

## Che cosa resta

Due letture sono rimaste aperte, perché nessun ticket chiedeva di spiegarle:

- **Sovrapposizione.** La peggiore fuori dalle nascite è 0,5285 al seme 10, sopra lo 0,5 di M1. Claude non l'ha corretta né ha indagato se c'entrino i thruster: il ticket diceva "letto contro lo 0,5", non "deve stare sotto". Se torna, va messa sul tavolo in una sessione di interrogatorio sul progetto.
- **Profili di profondità.** Su e giù non seguono `exp(−d/L)` (distanza media dalla parete 11,3 contro 9,1 salendo, 10,2 contro 9,1 scendendo). Per il float `buoyancy` registra la stessa deviazione, dovuta ai corpi che si ammassano contro la parete e vengono respinti dalla separazione. Che "giù" sia meno deviato di "su" non lo spieghiamo.

La domanda vera è un'altra: se il thruster, a queste frequenze, abbia mai modo di farsi selezionare. Con una dozzina di portatori per seme il Mondo di Riferimento non sa rispondere, e finché non ne produce di più nessuna misura potrà farlo.
