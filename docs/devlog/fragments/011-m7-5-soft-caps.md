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
