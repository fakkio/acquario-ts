# Un ticket che non riproduce niente, prima di poter riprodurre qualcosa

ADR-0012 si era scritta da sola la data di scadenza, mesi prima che scadesse davvero: "Cell size is derived from the largest body radius the world allows... That derivation expires at M4." Il ticket #27 non aggiungeva niente di nuovo al mondo — nessuna riproduzione, nessuna mutazione, "quando atterra, il mondo si comporta esattamente come oggi" dice il testo del ticket — esisteva solo per disinnescare una previsione che qualcun altro, mesi prima, aveva già scritto nero su bianco.

---

Il fallimento che il ticket preveniva era silenzioso per costruzione: un corpo che supera metà cella smette di essere trovato dalle query dei vicini, e la suite resta verde mentre succede. Non un crash, non un errore — un vuoto che non si nota finché qualcuno non va a cercarlo apposta. `organism.ts` lo diceva già nel commento su `MAX_BODY_RADIUS`. La cosa interessante è che il bug non esisteva ancora quando il ticket è stato scritto: è stato prevenuto prima di nascere, sulla fiducia di una previsione fatta a distanza.

---

Due test in `grid.test.ts` leggevano `GEOMETRY.cellSize` — la geometria di una griglia costruita da una popolazione vuota, quindi calcolata sul valore di fallback — e poi piazzavano corpi con il raggio di default di `organismAt` (`BASELINE_BODY_RADIUS = 1`) dentro quelle coordinate. Finché la dimensione della cella era una costante di modulo, le due geometrie coincidevano sempre, per costruzione. Nel momento in cui la cella è diventata una funzione della popolazione che le viene passata, i due corpi hanno smesso di vivere nella stessa griglia — uno pensato per celle larghe 2.8, l'altro che ne generava di larghe 2 — e i test sono falliti in un modo che non aveva niente a che fare con quello che stavano cercando di verificare. Non era un bug nel codice di produzione: era un presupposto implicito nei test stessi, invisibile finché la costante che lo teneva in piedi non è sparita.

---

Il ticket #28 fissava per intero un solo δ: quello del raggio corporeo, 0.08, derivato a mano dal range che M1 aveva già calibrato. Gli altri tre — soglia di mitosi, rapporto di allocazione al figlio, deriva della tinta — restavano solo "vanno in `constants.ts`, segnati come provvisori", senza un numero scritto da nessuna parte. Sceglierli è toccato a chi implementava. Va bene così, per stessa ammissione: sono provvisori, non contano finché M5 non li ricalibra su un `α` misurato per davvero.

---

"×1.08 poi ×0.92 non torna a 1: atterra a 0.9936." Non è un dettaglio tecnico buttato lì per completezza — è la frase che rende visibile, in un numero solo, perché la forma additiva ovvia per mutare il raggio era sbagliata: un drift verso il basso gratuito, seduto esattamente sopra il segnale che M5 dovrà misurare. A volte il bug non è nel codice ma nell'intuizione di partenza, e la confutazione sta tutta in un conto fatto a mano.

---

Non c'era uno skill di progetto per far girare l'app, quindi per controllare a occhio che i colori non fossero diventati tutti neri dopo il cambio di unità di `lineageHue` (da gradi a `[0, 1)`) ho scritto uno script Playwright usa e getta: apri la pagina, clicca play, aspetta, screenshot. Ha funzionato, ma è stato buttato via subito dopo. Il gap che rivela è reale: manca un modo ripetibile di dire "fammi vedere l'acquario al tick N" senza reinventare ogni volta il driver.

---

Non è che `lineageHue` "non eredita mai" — dopo generazione zero eredita ed evolve esattamente come gli altri tre geni, attraverso lo stesso operatore di mutazione. È solo che a generazione zero gli altri tre fingono di avere un genitore: il baseline genome, un genitore di comodo condiviso da tutti i fondatori, così la selezione parte da un genotipo comune. `lineageHue` è l'unico che si rifiuta di stare al gioco — perché quaranta fondatori "figli" dello stesso genitore finto sarebbero quaranta sfumature indistinguibili dello stesso colore, e un marcatore che non distingue nessuno non è un marcatore.

---

Il criterio di successo del ticket, scritto testualmente nell'ultima riga dei criteri di accettazione: "una run risulta visivamente indistinguibile da quella di oggi." Un ticket che riscrive da zero come nasce un corpo — genoma, operatore di mutazione, generazione 0 mutata invece che disegnata a caso — e il segno che ha funzionato è che non si vede niente di diverso sullo schermo. Tutto il lavoro vero è sotto, in attesa che il prossimo ticket, la mitosi, gli dia finalmente qualcosa da fare.

---

Il ticket #29 (mitosi) prevedeva un solo rischio di calibrazione, scritto nero su bianco: che la popolazione "possa fare boom fino al soffitto di carbonio e restarci ferma" entro poche migliaia di tick. Il rischio vero era l'opposto — non riprodursi mai. Il costo in cibo di un figlio (`ρ × childArea`) coincide esattamente con la cap di cibo del genitore: bisogna essere quasi pieni al 100% per permetterselo, e in una run immortale di 100k tick il massimo osservato in tutta la popolazione è il 6%. Nessuna delle due manopole che il ticket #29 possiede — soglia di energia, costo energetico del figlio — tocca il lato cibo, quindi nessuna delle due poteva risolverlo.

> mi aspettavo che le varie costanti sarebbero dovute essere tunate osservando la simulazione, e ancora andrà fatto

La direzione generale — le costanti di M2 non sono quelle giuste, andranno riviste guardando una run vera — Fabio se l'aspettava fin dall'inizio. Il dettaglio specifico no: né lui né il testo del ticket avevano previsto che il collo di bottiglia sarebbe stato il cibo (bloccato da `ρ = K_CAP = 1`, una scelta di costruzione di M2, non toccabile da questo ticket) invece dell'energia (le due costanti che il ticket #29 stesso segnalava come da tarare). L'ha trovato l'agente, empiricamente, facendo girare prove da 100k tick prima di scrivere il gate di accettazione — non un'ipotesi verificata a tavolino, ma un numero che uscito da una run ha smentito l'unico rischio scritto in anticipo.

> va bene per ora, segnalo per M5

La decisione di "pre-caricare" il gate invece di aspettare M5 l'ha presa l'agente, in autonomia, dentro lo stesso ticket — Fabio l'ha vista e approvata solo dopo, in questa sessione. Non una correzione: una toppa dichiarata tale, con una scadenza scritta sopra invece che nascosta sotto un commento.

---

Il primo tentativo di misurare il conservation drift sul gate a 100k tick ha dato uno spavento: un errore del 19-20%, che sembrava un leak di carbonio vero. Era un artefatto del test, non un bug della simulazione — il confronto era contro il totale calcolato _prima_ del priming, non dopo, e il priming stesso inietta materia negli organismi senza passare dai pool. Rifatto il confronto contro la baseline giusta (dopo il priming, non prima), il drift è sceso a 1e-16. La simulazione era corretta dall'inizio; era il test a guardare il numero sbagliato. L'ha trovato e corretto l'agente, da solo, prima ancora che il gate finito arrivasse a Fabio.

---

Il ticket #31 si era già scritto la propria via di fuga, mesi prima di sapere se le sarebbe servita: "if the gate cannot be made to pass without changing a law rather than a constant, that is a finding about the model and it belongs in a comment on the issue before it belongs in the code." Non una speranza ottimista che tutto sarebbe filato liscio — una clausola di uscita, già pronta, per lo scenario esatto che poi si è verificato.

---

Fatta girare la versione "vera" del gate — nessun priming, popolazione di partenza normale, mortalità e fertilità entrambe accese — il risultato è stato più netto di quanto il #29 avesse già misurato. Non solo il cibo non basta mai: la popolazione crolla da 40 fondatori a 1 superstite entro 11.000 tick, zero nascite in tutto l'arco osservato. E non è un declino lento — il massimo di cibo posseduto da un organismo si stabilizza già al tick 5.000 e non si muove più per altri 15.000. Una run che smette di raccontare qualcosa di nuovo dopo un ventesimo del tempo che le è stato dato.

---

Il dettaglio che chiude la questione non è servito misurarlo su una run: è nel codice. Con ρ = K_CAP = 1, il costo in massa di un figlio è, per costruzione, esattamente la cap di cibo di un figlio della stessa taglia — non una vicinanza empirica, un'uguaglianza esatta. Le due manopole che il ticket #31 concede a M4 — soglia di energia, costo energetico del figlio — controllano solo il varco sull'energia dentro `evaluateMitosis`, mai quello sul cibo. Nessun valore possibile di nessuna delle due può chiudere un divario 8-10x su una risorsa che quelle manopole non toccano.

---

Di fronte al bivio — documentare e rimandare, toccare una costante "di legge" fuori dal perimetro di M4, o riscrivere i criteri di accettazione del ticket — la scelta non è stata presa in autonomia: è stata sottoposta a Fabio con tre opzioni esplicite, prima di scrivere una riga di codice. Diverso dal giro precedente su #29, dove la stessa famiglia di problema (uno scarto tra il piano e quello che la fisica del modello permette) era stata gestita in autonomia e mostrata solo a cose fatte. Qui la domanda è arrivata prima, non dopo — perché la posta in gioco non era più "che test scrivo", ma "che cosa significa che un milestone non può chiudersi come previsto".

---

> Non ho esitato, era chiaramente la scelta giusta aspettare per regolare le variabili quando avremo una simulazione più completa.

Nessun tentennamento tra le tre strade, per Fabio. Toccare le costanti adesso, prima che l'acquario sia abbastanza completo da dire qualcosa di vero su sé stesso, sarebbe stato tarare al buio — non una prudenza generica, ma la stessa logica che governa tutto M5: le costanti si misurano su una run, non si indovinano su carta.

---

> sorpresa

Alla domanda se si aspettasse che il ticket #31, scritto mesi prima, avesse già previsto con tanta precisione la propria via d'uscita — "se il gate non passa senza toccare una legge, è un finding, non un test annacquato" — la risposta di Fabio è stata secca: sorpresa, non previsione confermata. Il ticket sapeva, in anticipo, di poter non sapere.

---

> Era difficile prevedere le soglie giuste prima di avere un acquario almeno in parte funzionante.

La ragione per cui #29 aveva sbagliato l'unico rischio che si era scritto in anticipo (temeva il boom fino al soffitto di carbonio, non l'estinzione per fame) non è una svista che si potesse correggere leggendo meglio `docs/vision.md`: le soglie giuste — quanto costa un figlio, quanto puoi accumulare — non si possono dedurre a tavolino da un acquario che ancora non esiste. Si scoprono facendolo girare.
