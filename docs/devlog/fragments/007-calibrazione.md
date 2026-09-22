# Una costante travestita da unità

M5 non ha ancora una riga di codice e ha già smentito tre cose che il progetto dava per assodate. Nessuna delle tre è uscita da una run: sono uscite da cinque giri di domande, a tavolino, prima ancora che esistesse l'harness che dovrebbe misurarle. È il contrario di come erano andate le milestone precedenti, dove le sorprese arrivavano sempre dai numeri.

---

Il ticket #31 aveva chiuso M4 con una diagnosi: la riproduzione non parte mai perché il costo in cibo di un figlio coincide esattamente con la cap di cibo del genitore, e il cibo interno misurato non supera il 6-12%. Sembrava un problema di taratura, e per un giro intero l'agente l'ha trattato così: alzare `K_PHOTO` di un ordine di grandezza, abbassare `K_RESP`, e il cibo si accumula.

Poi si è smentito da solo, e il perché sta in una riga. Photosynthesis e respiration sono l'una l'inversa dell'altra sul carbonio: nessuna delle due cambia quanto carbonio c'è dentro un organismo, cambiano soltanto in che forma chimica sta. L'unica cosa che sposta carbonio attraverso la membrana è la diffusione. Quindi il carbonio interno totale si rilassa alla concentrazione ambiente e non la supera mai, la condizione per permettersi un figlio diventa `s ≥ ρ`, e dentro quella condizione non compare nessuna costante metabolica. Compare solo quanto carbonio ha il mondo.

Un problema che sembrava di manopole era una soglia di legge.

---

Da lì viene anche il motivo per cui al buio non si nasce, e non è quello che sembra. Un organismo al buio non è povero di carbonio: il suo carbonio interno sale lo stesso fino all'ambiente, esattamente come quello in superficie. Solo che la respiration lo converte in CO₂ e senza luce niente lo riconverte. Il costo di massa di un figlio si paga in food, quindi un corpo al buio può essere pieno di carbonio e non potersi permettere un figlio lo stesso.

Tiene il carbonio giusto nella forma sbagliata.

Ed è la frase più netta su cosa serve la photosynthesis in questo modello: non produce energia, lo dice `vision.md` da sempre. Produce materia nella forma con cui si costruisce un corpo. Per questo le lineages vivono nella luce.

---

Al secondo giro l'agente mi aveva proposto un recinto: ecco le costanti che M5 non tocca, e fra queste `K_CAP`, `RHO`, `LIGHT_SURFACE_INTENSITY`, `BODY_COST_COEFFICIENT`, perché fissano le unità. Ho detto ok.

Un giro dopo è tornato indietro da solo. `kCap` e `ρ` hanno la stessa dimensione, carbonio su area. Fissarle entrambe a 1 non è una scelta di unità: è una scelta di unità più un'affermazione fisica nascosta, cioè che un organismo può contenere esattamente il carbonio del proprio corpo. Ed è quell'affermazione, non l'unità, che rende un figlio impagabile.

Una costante travestita da unità, dentro un documento che le unità le elenca con orgoglio.

---

Tre cose che il progetto aveva messo per iscritto come fissate, e non lo erano. `K_CAP` era una scelta libera travestita da unità. Il tetto della popolazione sembrava dover passare dal carbonio allo spazio, e invece non si è mai mosso dal carbonio. `K_PHOTO` sembrava la leva del problema e non tocca niente di quello che doveva toccare.

Nessuna delle tre era scritta male. Erano scritte con la sicurezza che si usa per le cose derivate, e non erano derivate.

---

> stavo pensando ad un modo non noioso per far sopravvivere gli organismi al buio. ma con una qualche selezione

L'agente aveva letto la mia obiezione del quarto giro come fisica. Avevo scritto che forse al buio sopravvivono solo i raggi piccoli, per via della proporzione quadratica contro lineare fra diffusione e respiration, e lui ne ha tirato fuori un raggio massimo riproduttivo, due gate misurabili e un ADR intero.

Ma non stavo facendo fisica. Stavo cercando un modo non noioso di popolare il buio, e la proporzione fra area e perimetro era solo il vocabolario che avevo sottomano per dirlo.

Una richiesta di design, buttata lì in una riga, è uscita dall'altra parte come una derivazione con dentro una soglia da misurare. Non è un fraintendimento, è più o meno il mestiere. Ma la traduzione ha perso un pezzo, ed era la metà più importante della frase: "con una qualche selezione".

---

> diciamo che tutti questi calcoli per la calibrazione li ho lasciati andare a sentimento

Cinque giri di domande, quattro ADR, un paio di derivazioni con dentro medie della luce sulla profondità e rilassamenti di concentrazione, e io ho approvato quasi tutto senza rifare i conti.

Vale la pena scriverlo perché cambia il significato delle tre volte in cui l'agente si è smentito. Non sono state correzioni trovate in revisione: la revisione non c'era. Erano l'unico controllo attivo nel giro. E due volte su tre la smentita è arrivata dopo il mio ok, il che vuol dire che il mio ok non era il filtro che sembrava.

---

> perchè è importante misurare questo alpha?

L'ho chiesto alla fine, dopo aver approvato cinque giri di decisioni che pendono tutte da `α`. L'agente ci ha letto dentro un momento: uno che approva un impianto e intanto continua a interrogarne la chiave di volta.

Era solo una curiosità.

---

> hai ragione, non c'è selezione è solo geografia. niente..

Il desiderio di popolare il buio è durato tre giri e si è chiuso in una riga. L'agente aveva anche offerto una via di scampo, il viaggio di ritorno: il moto browniano è simmetrico, quindi uno che scende può risalire, e se risale vivo si riproduce e trasmette quello che gli ha permesso di sopravvivere là sotto. Ma i corpi che sopravvivono al buio sono quelli grandi, e i corpi grandi diffondono lenti. Parcheggiati.

La parola che ho usato per chiuderla è geografia, ed è la stessa che ADR-0018 si era scritta da sola mesi prima, parlando di tutt'altro: "in v0.1, dying last mostly means having been in the photic zone, and depth is not under genetic control until v0.2, so an early result may be reporting geography rather than genetics".

Il progetto si era già avvertito da solo. Ci sono rientrato dentro da un'altra porta, tre milestone dopo, senza riconoscere l'avvertimento finché non ho riusato la sua stessa parola.

---

> semplicemente preferisco fare in ordine: grilling, to-spec e infine to-ticket

Avevo tenuto per me la scrittura della spec e dei ticket, e l'agente ci aveva letto un confine: le decisioni difficili da invertire me le faccio scrivere, la spec no, quindi da qualche parte passa una linea fra il come di progetto e il come di esecuzione.

Non c'era nessuna linea. C'era una coda. Prima si fa il grilling, poi la spec, poi i ticket, e quando l'ho detto eravamo ancora dentro il primo.

Gli ADR sono usciti da lì non perché siano meno miei, ma perché il grilling era il passo in corso.
