---
title: "Il tappo che nessuno aveva deciso"
description: "Un organismo muore di fame con il cibo in tasca, per una regola scritta per proteggere la conservazione. Toglierla ha smentito quasi tutte le nostre previsioni."
date: 2026-10-07
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - predictions
  - measurement
  - ai-agents
lang: it
---

# Il tappo che nessuno aveva deciso

Un organismo sta morendo di fame con il cibo in tasca. L'ispettore, il pannello che mostra cosa c'è dentro un corpo, lo dice in quattro righe (è un organismo di seconda generazione):

| serbatoio | contenuto | capienza |
| --------- | --------- | -------- |
| energia   | 241,6     | 2008,6   |
| cibo      | 3,788     | 7,532    |
| O₂        | 2,770     | 5,022    |
| CO₂       | **5,022** | 5,022    |

L'energia scende di 1,24 a ogni tick, il passo discreto della simulazione. La respirazione, la reazione che trasforma cibo e ossigeno in energia, dovrebbe correre a circa 2 per tick, e corre a 0,013. L'organismo ha tutto quello che gli serve per respirare e non respira. Muore in circa 190 tick, dove uno senza il problema ne durerebbe 1600.

Il colpevole è l'ultima riga. Respirare produce CO₂, e il serbatoio della CO₂ è pieno. La regola diceva che una reazione non può produrre più di quanto il serbatoio del suo prodotto riesca a contenere, e un serbatoio pieno si svuota solo attraverso la membrana, che lascia uscire poco quando fuori la CO₂ è già quasi alla stessa concentrazione. La respirazione poteva quindi produrre soltanto quanto la membrana smaltiva, cioè quasi niente. Questo articolo racconta cosa è successo quando abbiamo tolto quella regola, e quante delle nostre previsioni sono sopravvissute.

## Il tappo che era un effetto collaterale

La simulazione è una vasca chiusa di organismi circolari, dove il carbonio non entra e non esce. Ogni organismo ha serbatoi interni (energia, cibo, O₂, CO₂) separati dall'ambiente da una membrana, e ognuno aveva un **Cap**, un tetto. La regola era "frena, non sprecare": se il prodotto di una reazione non entra, la reazione rallenta, invece di buttare via il carbonio per fargli posto. Proteggeva la **conservazione**, cioè il fatto che il carbonio totale resti sempre lo stesso, ed è il sistema di allarme del progetto: ogni bug serio, finora, l'ha fatta suonare.

Per la CO₂ la regola partiva male. L'ambiente apre a circa 1,04 di CO₂ e il tetto era 1, quindi ogni fondatore nasceva già sopra il suo tetto e non respirava finché la fotosintesi non gli portava via abbastanza CO₂. Sotto la fascia luminosa, dove la fotosintesi non c'è, non cominciava mai.

Il ragionamento che teneva in piedi la regola era sbagliato in un punto solo. Un serbatoio che contiene più del suo tetto conserva il carbonio altrettanto bene, e lo scambio passivo con l'ambiente lo riporta a posto da solo. Il tetto non serviva a niente, e costava la vita agli organismi che avevano il cibo in tasca.

L'ADR-0035, la decisione scritta (ADR sta per _architecture decision record_) che l'ha tolto, sta in due righe:

```text
fotosintesi:   min(tasso, CO₂ disponibile)
respirazione:  min(tasso, cibo disponibile, O₂ disponibile, spazio nel serbatoio dell'energia)
```

Solo l'energia ha ancora un tetto. Cibo, O₂ e CO₂ non ne hanno più: un loro serbatoio si legge come **Concentration**, quantità per unità di area, da confrontare con quella dell'ambiente. Sopra l'ambiente, la membrana la fa uscire, senza una regola in più.

Portare la legge nel codice è stato quasi tutto cancellare. Una riga di legge aggiunta, un centinaio di righe di impalcatura tolte: la tabella dei tetti, i conteggi che servivano a misurarli, `capFor` che è diventata `energyCap`.

## Sette previsioni, scritte prima

Prima di toccare il codice abbiamo scritto sette previsioni nel ticket padre, da giudicare dopo contro la stessa misura fatta prima e dopo la legge. È l'ordine dell'ADR-0024: lo strumento prima della legge. Non esiste un'opzione del mondo che selezioni la vecchia legge, perché sarebbe un'interfaccia permanente per uno strumento usato una volta. La tabella "prima" è il mondo di M7 con gli strumenti di misura aggiunti, la tabella "dopo" è quello di M7.5, sugli stessi cinque seed (le sequenze casuali) e per centomila tick ciascuno.

Servono tre parole che tornano nella tabella. `α` è l'energia che un organismo guadagna per unità di raggio: se cresce col perimetro e non con l'area, i corpi grandi non vincono per forza. `α_bright` la misura nella fascia luminosa, `α` di popolazione su tutti. La **Generation** di un organismo è il numero dei suoi antenati. Il **dark ladder** è una scala di corpi di raggi diversi messi da soli a profondità 30, dove la luce è un millesimo, per vedere quali sopravvivono.

| #   | previsione                                                                            | esito           |
| --- | ------------------------------------------------------------------------------------- | --------------- |
| 1   | al buio sopravvivono corpi di raggio da 0,5 a 12                                      | smentita        |
| 2   | `α_bright` si muove di meno del 5%                                                    | smentita (−43%) |
| 3   | `α` di popolazione sale, molto più di `α_bright`                                      | smentita (−78%) |
| 4   | prima della legge il CO₂ frenava almeno il 20% degli organismi-tick, l'O₂ meno del 5% | smentita        |
| 5   | la persistenza regge su tutti i seed                                                  | confermata      |
| 6   | più organismi, meno nascite, Generation media più bassa                               | in parte        |
| 7   | la concentrazione massima più alta è quella del CO₂, nessuna sopra il totale ambiente | mista           |

Una confermata, una in parte, una mista, quattro smentite. La 6 l'avevamo segnata "fiducia bassa, probabilmente sbaglia", ed è l'unica di cui abbiamo azzeccato la direzione.

Due righe si spiegano con una definizione e una misura, e meritano più di una cella.

**La 4, prima della legge.** Il CO₂ frenava circa il 10% degli organismi-tick su tutti e cinque i seed (9,5–11,5%), non il 20%. L'O₂ tra l'8,6 e il 10,9% su quattro seed, non meno del 5%. Il cibo lo 0,0%, come previsto. Quello che ha reso il "prima" un numero affidabile è stato un sotto-agente di revisione, non l'agente che l'aveva scritto. La prima definizione di "frenato dal tetto" contava anche un organismo al buio, senza cibo e con la CO₂ sopra il tetto, che non avrebbe reagito comunque. E le percentuali erano divise per la popolazione dopo nascite e morti e non per quella che aveva reagito, quindi i neonati gonfiavano il denominatore. La prima corsa lunga è stata buttata e rifatta.

**La 1.** Prima della legge ogni corpo del dark ladder moriva tra il tick 7 e il 198. Dopo, tra il tick 30 e il 29.072: il raggio 1,21 arriva quasi alla fine di una finestra di 30.000. Non è la conferma che chiedeva la previsione, è una soglia che si è spostata di due ordini di grandezza. Con una finestra più lunga forse si apre, e non l'abbiamo provato.

## Dieci test rossi

Il primo `npm test` dopo la legge ha dato dieci test falliti, per ragioni che nessuno aveva previsto.

- **La prima nascita** in un mondo con roster vuoto, cioè senza organelli, è al tick 6307 invece che al 125 (seed 2: 7254, seed 3: 9576). La prima morte tra il 1405 e il 1572, prima della legge al 43. Ora la respirazione consuma il cibo al suo ritmo pieno, e il cibo interno sta intorno a 0,4 per unità di area, mentre il cancello della massa per dividersi ne chiede quasi 1.
- **Un test era sbagliato da sempre.** Chiamava `advance(world, 2000 * FIXED_DT_MS)` credendo di far girare 2000 tick, ma `advance` si ferma a 240 per chiamata. Nel vecchio mondo la prima morte stava al tick 43 e 240 bastavano. Il mondo nuovo li ha scoperti.
- **Il golden hash**, il test che dice "un roster vuoto non disegna niente e non cambia niente", è stato registrato di nuovo su 8000 tick invece di 2000, perché pretende una nascita e una morte nella finestra. Il valore vecchio non tornerà più: è il primo hash d'oro che muore per una ragione di legge e non per un errore.

Il dato che ha cambiato il resto dell'articolo veniva da altri quattro test, quelli su `α`. Dalla legge in poi `α` leggeva esattamente zero, a ogni tick e a ogni profondità. L'ADR-0015 esclude dalla media gli organismi con il serbatoio dell'energia pieno, e con la legge nuova lo erano tutti, sempre: la respirazione riempie il serbatoio da metà a pieno in un tick.

L'agente ha saltato quei quattro test (`it.skip`, con un commento che dice perché) invece di inventare una definizione nuova di `α`. È una scelta di perimetro: cosa debba misurare `α` dopo la legge è una decisione di progetto, quindi di Fabio, e nel ticket non c'era. Il sotto-agente di revisione ha notato che uno skip senza ticket non lo segue nessuno.

## Il tetto accidentale

Fabio ha deciso la definizione: `α` misura il **tasso potenziale**, l'energia che la respirazione produrrebbe senza il freno del serbatoio pieno, per unità di raggio. Venti righe di codice. Tre dei quattro test sono tornati verdi al primo giro. Il quarto, quello della linearità, no.

Raggi 0,6, 0,85, 1,0, 1,2 e 1,4 danno `α` = 824, 1341, 1634, 1998, 2328. Il coefficiente di variazione è 0,32, contro la soglia di 0,1. E i valori sono dell'ordine del migliaio, quando il guadagno vero di un organismo è dell'ordine del mantenimento, qualche unità. Il tasso potenziale è azione di massa sull'area, `K_RESP · C_cibo · C_O₂ · area`: una **capacità**, non un reddito.

Fabio ha guardato il numero e ha chiesto:

> perché senza cap l'energia si riempie in un tick? dovrebbe comunque esserci un cap di energia prodotta per tick, o di respirazione per tick, no?

L'agente ha dovuto ammettere che nel mondo nuovo non c'è. L'unico tetto sul tasso di respirazione è il substrato, `min(cibo, O₂)`, e nient'altro. Il vecchio tetto della CO₂ faceva di nascosto quel mestiere, senza che nessuno l'avesse deciso: era un limite di velocità nato per caso da una regola di conservazione. Togliendolo per salvare gli organismi affamati ne avevamo tolto un secondo che nessuno sapeva di avere. Il serbatoio dell'energia era rimasto l'unica valvola, e `α` misurava proprio la valvola.

Un tetto vero sul tasso esiste già nei documenti: una cinetica saturante, la `V_max` di Michaelis-Menten, scritta come "la risposta se serve". Aggiungerla ora cambierebbe la legge del mondo, e quindi la persistenza, contro il patto di M7.5 che niente di pre-registrato si muove.

Fabio ha proposto una via più economica: abbassare `RESPIRATION_ENERGY_YIELD`, l'energia prodotta per unità di respirazione. L'agente ha risposto "solo in parte". Cambiare quella costante cambia la **scala** di `α` e non la **forma**: il coefficiente di variazione resta 0,32. In più è una costante del mondo, quindi appartiene a M12, e il commento nel codice ricorda che a 900 lo sweep aveva già rotto `n`.

La decisione di Fabio:

> niente, lasciamo così allora, vedremo poi con gli organelli.

`α` resta il tasso potenziale e la sua linearità si rimanda. Il test è `it.skip` con un commento, e l'ADR-0015 ha un emendamento che chiama `α` una capacità e dà tre candidati per dopo: il reddito effettivo, una respirazione saturante, il yield come leva di M12. Questo skip, a differenza del primo, ha un ticket chiuso con la riga scritta nei criteri.

## Il righello che cambia a metà

Dopo il tasso potenziale, `npm run caps` dava `α_bright` = 901 ± 120. Nel ticket precedente la stessa riga leggeva 11,29, contro l'8,165 del "prima" di M7 (+38%). I due numeri non si confrontano: c'è di mezzo un fattore ottanta, e la definizione di `α` è cambiata dentro il ticket che doveva misurare l'effetto della legge.

L'agente aveva spuntato troppo presto il criterio "`α` confrontabile prima e dopo". Se n'è accorto Fabio, leggendo 11,29 accanto a 901. Ha detto "riapri il criterio", poi "riapri la issue e implementa la soluzione per poterla chiudere". La soluzione era misurare di nuovo il "prima": un worktree temporaneo a `c5a88ad` (M7, con i tetti), con una sola riga cambiata, la stessa definizione. Stessi seed, stessa finestra. Nessuna riga del repo si è mossa: la correzione di un criterio è stata una misura.

| `α` come tasso potenziale | prima (M7, con i tetti) | dopo (senza tetti) | variazione |
| ------------------------- | ----------------------- | ------------------ | ---------- |
| `α_bright`                | 1594 ± 130              | 901 ± 120          | −43%       |
| popolazione intera        | 1159 ± 38               | 251 ± 41           | −78%       |

Il segno si è girato. Con la vecchia definizione sembrava che togliere i tetti alzasse `α`, mentre il tasso potenziale scende, e scende molto di più nella parte al buio. Una lettura, non verificata: senza tetto il serbatoio si riempie subito, gli organismi respirano a pieno regime e bruciano il cibo in tasca, e la concentrazione media di cibo e O₂ cala, quindi cala anche il tasso di azione di massa. Per saperlo serve una sonda sulle concentrazioni, non una storia.

La regola che ne esce è semplice: **una misura prima/dopo ha senso solo se il righello non cambia a metà**.

## Quello che resta aperto

La persistenza regge e il cancello di M7.5 è verde: minimi 14, 16, 17, 14, 9 contro 8, 8, 9, 8, 10 del "prima". Il seed 11 dà 9 contro 10, un organismo, e la clausola stretta della previsione 5 ("almeno quanto M7") cade per uno. Abbiamo scritto "confermata" e subito dopo "cade per uno", invece di arrotondare a verde.

Quello che preoccupa non è la sopravvivenza ma l'abbondanza. Il traguardo di M12 è una Generation media di almeno 50:

- le nascite sui cinque seed passano da 2.893 a 588;
- la Generation media finale da 7,3–48,7 a 4,0–6,1, su ogni seed;
- il seed 7 del "prima" era un'anomalia (162 organismi e Generation 48,7, contro 33–37 e 7–15 degli altri), e nel "dopo" non c'è più. Il crollo delle nascite è quasi tutto suo, ma la direzione è la stessa dappertutto.

E una cosa che non avevamo chiesto. Le concentrazioni di carbonio e ossigeno superano il totale ambiente di 0,05–0,11 su ogni seed, e lo facevano già prima della legge. La frase dell'ADR, "nessuno store può stare sopra il totale ambiente", è vera per il rilassamento verso l'ambiente e non per il picco. La spiegazione più facile è l'allocazione al figlio, data per intero. Non l'abbiamo misurata.

Una regola di lavoro che questo ticket ha confermato: quando la previsione sbaglia, si corregge il documento, non la misura. Il `vision.md` diceva che il buio è "un habitat di rari corpi grandi", ma nessuna corsa l'ha mai mostrato, né prima né dopo. L'abbiamo riscritto al condizionale, "sulla carta ammette una banda", e l'ADR-0035 ha una sezione "Measured" con i numeri. La frase sbagliata era rimasta in giro da M5 senza che nessuno la mettesse alla prova.
