# M11, il sistema nervoso

#97, il prefattore: il genoma può contenere sinapsi e nessun mondo si muove. Il golden hash è rimasto fermo, ed era il criterio più importante del ticket.

---

Chi ha scelto il ticket. Fabio ha scritto "scegli un ticket di #96 e implementalo", quindi la scelta è stata mia. Non era una scelta difficile: #97 era l'unico senza ticket bloccanti, gli altri dipendevano da lui. Ma è una decisione di ordine di lavoro presa dall'agente, e vale la pena scriverla.

---

Il tipo `Gene` è diventato `OrganelleGene | SynapseGene`, e il compilatore ha trovato per me tutti i posti dove "gene" voleva dire "organello". Erano pochi nel codice di produzione e moltissimi nei test: quasi cinquanta righe di `genome.genes[0].x` o `for (const gene of genome.genes)` che improvvisamente non compilavano. Le ho sistemate con uno script che leggeva gli errori di `tsc` e avvolgeva `.genes` in `organelleGenes(...)` solo sulle righe che sbagliavano. Il piano diceva "i bersagli delle mutazioni ignorano le sinapsi"; non diceva che metà dei test avrebbe dovuto cambiare.

---

Come distinguere i due geni a runtime: `"type" in gene`. L'organello ha un campo `type`, la sinapsi no. Un campo `kind` esplicito sarebbe più robusto, e la review standards l'ha suggerito, ma avrebbe costretto a toccare ogni fixture di ogni test che costruisce un organello a mano. Ho scelto io, e ho scelto la strada economica. È un "come" di esecuzione, dentro il perimetro che il ticket dava. Se arriva un terzo tipo di gene, i quattro punti che oggi fanno quel controllo vanno riscritti.

---

Il minting delle sinapsi: una sinapsi punta a un organello per id provvisorio, e quell'organello può stare dopo di lei nel genoma. La prima versione, scritta in un passaggio solo, avrebbe lasciato l'endpoint non riscritto in quel caso. Il fatto che sia un caso reale l'ho visto leggendo il codice che avevo appena cambiato, non perché un test fallisse: ho separato "assegna tutti gli id" da "riscrivi gli endpoint" prima di scrivere il test. L'agente di review standards ha poi scritto che quel caso non era coperto dai test. Era coperto: l'avevo scritto io. Un riscontro sbagliato, da non prendere per buono solo perché arriva con sicurezza.

---

`mutateStructure` ora lavora sui soli organelli e riaccoda le sinapsi alla fine. Con zero sinapsi il comportamento è identico a prima, ed è l'unico motivo per cui il golden hash non si muove. Con sinapsi, un figlio mutato ha prima gli organelli e poi le sinapsi, anche se il genitore le aveva mescolate. L'ho scritto in un commento perché "ordine del genoma" prima voleva dire una cosa sola.

---

Il debito che ho lasciato apposta: una cancellazione o uno split non portano via le sinapsi dell'organello colpito. Oggi nessuna sinapsi esiste, quindi non si vede. Il ticket non lo chiedeva, la review spec l'ha segnalato come nota per il ticket successivo. Una sinapsi orfana, come una spinta gratis, non si distingue da una che funziona.

---

Il segnale del thruster ora vive sull'organismo (`thrusterSignals`), nato uguale a `drive`. Non entra ancora nell'hash, e l'ADR-0037 dice che deve entrarci. Finché dipende solo dal genoma non cambia nessun hash, ma nel ticket che farà scrivere il segnale al tick va aggiunto, o l'hash smetterà in silenzio di coprirlo. L'ha notato la review standards; l'ho annotato in un commento invece di anticiparlo.

---

Una trappola nel test del mondo: la sinapsi del fondatore punta all'id 1, e funziona solo perché `placeFounders` numera gli organelli da 1. Le bozze di sinapsi non hanno gli endpoint riscritti dal minting. L'ha segnalato la review spec. Non l'ho sistemato: il ticket non lo chiede e il test lo dichiara, ma è un punto dove un cambio di numerazione romperebbe il test per una ragione che non si legge.
