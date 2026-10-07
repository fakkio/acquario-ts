# M7.5, i tappi morbidi

> scegli un ticket di 67 e implementalo

Fabio ha delegato anche la scelta del ticket. L'agente ha scelto #72, l'unico non bloccato da un altro ticket aperto, e non il primo della lista. Una scelta di ordine, non di gusto.

---

L'ADR-0036, scritto nella grill, diceva che `relax` e `makeRoom` "keep their moves and their contract" e che il Cerchio Racchiudente sopravviveva "come il modo in cui la mossa di slide sceglie il suo raggio". Era una frase scritta a tavolino, e sbagliata in modo invisibile: il contratto restava vero sul cerchio e non su quello che serviva ora, la Reach misurata dall'origine fissa.

---

Nessuno ha deciso di cambiare le mosse. L'agente ha riscritto i test sulla Reach prima di toccare il codice, e tre su sei sono caduti subito: il passo di dimensione, il passo di posizione, l'inserimento dentro un organello grande. La correzione (scegliere la mossa per Reach, far partire lo slide dall'origine) è una scelta di esecuzione, dentro un perimetro che il ticket aveva già fissato.

---

Il controesempio costruito a mano non ha fallito. Due dischi sugli assi, (1,0) e (0,1), e un terzo inserito a (0.5,0.5): il cerchio che li racchiude ha il centro in mezzo e il bordo lontano oltre la Reach, quindi lo slide dal centro del cerchio doveva sforare. Sul codice vecchio passava lo stesso. I tre test che hanno scovato il problema erano quelli a caso, con seme fisso. Il caso scritto apposta per spiegare il bug non lo prende, e resta nel file come spiegazione, non come guardia.

---

Per un po' i test sono diventati instabili senza che nessuno avesse toccato niente. Il colpevole era un sotto-agente della revisione, che per verificare la Reach rimetteva il vecchio `layout.ts` nel working tree e poi lo ripristinava, mentre io lanciavo la suite. Un fallimento "transitorio" che era vero: il codice vecchio, davvero fallito, davvero osservato.

---

- il ticket chiede, se il contratto non regge, di dire nel commento di chiusura quale mossa cambia e che limite dà
- la risposta è una riga: lo slide parte dall'origine, e a `Reach + r` degli altri non si sovrappone più a niente, quindi il bordo lontano sta al massimo a `Reach + 2r`
- la prova del push non è cambiata di una virgola: ogni disco si sposta di esattamente `s`, e `|p|` cresce al massimo di `s`, qualunque sia l'origine

---

> scegli un ticket di 67 e implementalo

Seconda delega identica, e di nuovo un solo ticket libero: #73, perché #69 e #74 aspettano lui, e #70 e #71 aspettano quelli. Dei sette figli di #67 ne restava sbloccato uno.

---

L'ADR-0036 dice che il limite sull'area, `R_area_max`, è "in forma chiusa ed esatto": il citoplasma al suo passo più grande, più l'area degli organelli del genitore, più `M_max` volte il massimo che un evento può aggiungere. Non regge appena gli eventi si concatenano. Far crescere due volte lo stesso organello dà `π r² ((1+δ)⁴ − 1)`, cioè `4δ + 6δ² + …`, mentre due volte il massimo di un singolo passo dà `4δ + 2δ²`. Il termine che manca è piccolo, e ha un nome: ADR-0034 lo chiamava "slack", margine lasciato dagli operatori, e a `M_max = 1` non si vede mai.

---

Il soffitto è diventato una camminata: si provano tutte le sequenze di `M_max` eventi che il genitore e il roster permettono, tenendo traccia di area e reach, e si prende il massimo. Più larga della forma chiusa dell'ADR, ma è un vero limite superiore. A `M_max = 1` coincide con la forma chiusa, quindi il caso che gira nel mondo non cambia.

---

Per il test della sequenza avevo scritto una versione "esatta" dell'attesa, uguale al soffitto solo a `M_max = 1`, e quella a `M_max` qualunque è diventata una disuguaglianza. Un test che era un'uguaglianza solo perché la costante valeva 1.

---

Il test dell'ordine delle estrazioni (tipo, poi posizione) l'ho scritto rifacendo a mano le estrazioni dallo stesso seme: quattro dell'intestazione, le prove degli eventi, l'operatore, l'indice del tipo, poi il punto nel disco. Se qualcuno sposta l'estrazione del punto prima del tipo, cade.

---

Il Cerchio Racchiudente era 150 righe di Welzl, con tre casi di Apollonio per tre dischi tangenti. Non serviva più a niente e l'ho cancellato intero: il ticket diceva solo che "non è più il corpo", e il glossario dice "ritirato". Un pezzo di geometria esatta, scritto con cura, morto da un giorno all'altro.

---

Prettier lanciato su tutto `src` ha toccato anche file che non c'entravano (`death.ts`, `light.ts`, `rng.ts`, …): differenze solo di fine riga, nessuna di sostanza, viste solo perché `git status` le elencava. Le ho ripristinate prima del commit.

---

Il verdetto del primo commit è stato respinto dal pre-commit: `no-useless-assignment` su un ciclo `do … while` che assegnava `px` e `py` per poi leggerli solo nella condizione. Riscritto come funzione ricorsiva che restituisce il punto.
