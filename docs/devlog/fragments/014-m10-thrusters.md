# M10, i thruster

#91, il Thrust Cost, è andato dritto: la formula era scritta nel ticket, il golden hash è rimasto fermo, i test sono passati al primo giro. Il materiale sta tutto nei due posti dove il piano e la realtà hanno divergito, e nessuno dei due l'avevo previsto.

---

Il test del mondo immortale dice "l'energia non finisce mai sotto zero con un thruster che carica". Passa. Ma passa anche se il thruster non costasse niente. Me ne sono accorto perché un subagente di review, spawnato da me, ha scritto che il test non dimostra che il floor scatti. Ho provato a dimostrarlo: asserzione "almeno una volta l'energia vale esattamente 0". Fallita. Energia ferma a 1241.88 per tick consecutivi, identica alla cifra: il corpo ricarica la respirazione fino al tetto ogni tick, poi manutenzione e spinta tolgono la stessa quantità, e il giorno dopo si riparte dal tetto. Il costo di spinta è reale, ma il mondo di prova non lo porta mai a zero.

---

Secondo tentativo: spostare il fondatore da y=3 a y=40, al buio, così la fotosintesi non rifornisce. Stessa identica energia, 1241.88. Non ho capito perché e non ho indagato oltre: ho tolto l'asserzione e lasciato il test com'era, più debole di quanto il criterio di accettazione chiedesse. L'ho detto nel riepilogo invece di sistemarlo.

Chi: l'idea di rafforzare il test è del subagente di review (che l'ha segnalata), il tentativo e la rinuncia sono miei. Non è una decisione di progetto, è un'esecuzione che non è riuscita.

---

Un criterio di accettazione che passa per costruzione. Il test che avevo scritto per "energia mai sotto zero" non poteva fallire in quel mondo, e un test che non può fallire non misura niente. Da ricordare: per ogni invariante, chiedersi qual è la situazione in cui lo vedrei rompersi, e se il mondo di prova ci arriva.

---

`thrustCost: thrustCost ?? 0` in `thrustersOf`. Il riflesso era scrivere un default silenzioso, per far compilare il caso in cui il campo manca. Un tipo che dichiara `force` ma non il costo avrebbe spinto gratis, e nessun test se ne sarebbe accorto: una spinta gratis nel simulatore non si distingue da una spinta che funziona. L'ha segnalato la review standards, non Fabio e non io.

---

Come l'abbiamo risolto, e chi ha deciso cosa. Ho proposto due strade: un controllo a runtime che lancia un errore, oppure unire `force` e costo in un unico campo `thrust: {force, cost}`, così il tipo non può esistere a metà. Ho raccomandato la seconda; Fabio ha detto "vai con la 1, il campo unico". Il "come" di progetto (dove vive l'invariante: nei tipi o in un controllo) l'ho messo davanti a lui; il "come" di esecuzione (la forma del campo, i punti toccati) è mio. Ho anche detto che la seconda era un rifattore più largo di quanto il ticket chiedesse, e che restare nel perimetro era un'opzione valida.

---

ADR-0006 diceva "i passi v0.2 (occhi, neuroni, organelli attivi, thrust) stanno tra lo step 5 e lo step 6". Con il Thrust Cost addebitato dentro lo step 5 e la spinta applicata nello step 6, "thrust" in quella riga poteva voler dire due cose. Ho chiesto a Fabio come decidere se aggiornarlo. La risposta onesta era: la numerazione non cambia, la riga era ambigua. Fabio ha detto di sistemare la riga, e ho aggiunto una frase sola. Una riga ambigua in un ADR scritto prima del codice è il tipo di debito che nasce quando il piano nomina una cosa con una parola sola e il codice la divide in due.

---

Una nota di metodo: la review parallela (due subagenti, uno su standard e uno su spec) ha trovato in totale una cosa vera con conseguenze, il `?? 0`, e una che era una debolezza del mio test. Il resto erano osservazioni stilistiche. Utile, ma non quanto sembrava dal rumore.
