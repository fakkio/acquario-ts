# M2 — la spec che non lascia margine

"Due ticket di fila (#15 e ora #16) sono filati lisci senza deviazioni proprio perché la spec del milestone M2 è scritta con un dettaglio insolito." — il punto di partenza di Fabio per questo pezzo.

---

Nel commit `f80f675` ("M2 design decisions in vision.md e CONTEXT.md"), introdurre un solo meccanismo — il doppio sub-pass di exchange, ADR-0016 — ha reso silenziosamente sbagliate tre cose già scritte, tutte scoperte tornando a toccare quei documenti per M2:

1. `CONTEXT.md`, voce "Delta Buffer": diceva che il buffer contiene le _request_ di exchange. In realtà contiene le _grant_ — già risolte, già scalate. La voce descriveva la metà sbagliata della pipeline.
2. `CONTEXT.md`, voce "Body Cost": elencava "maintenance" come parola da evitare, ambigua. Ma il quinto step della pipeline si chiama esattamente Maintenance — è dovuta nascere una voce di glossario a sé, e la avoid-list si è capovolta.
3. `vision.md`, sezione sulla pipeline del tick: diceva che gli step 3-5 erano "purely internal" — order-independent perché leggono solo lo snapshot di inizio tick. Non è più del tutto vero da quando quegli step leggono una grant calcolata collettivamente nel settlement tra i due sub-pass. La frase è dovuta tornare indietro a "non più puramente interni, però...".

Tre correzioni non ovvie, innescate da un solo cambiamento, tutte scoperte nello stesso commit.

---

"È un complimento all'agente, visto che le spec le ha scritte lui per il se stesso futuro (o un altro agente volendo)." — Fabio, a chiarire il punto di apertura. Il dettaglio insolito della spec di M2 non è merito suo: le tickets #15-#20 non le ha scritte Fabio, le ha scritte un'istanza dell'agente, per essere eseguite più tardi da un'altra istanza (o dalla stessa, ma senza memoria della sessione in cui erano state scritte).

---

Ogni `/implement` parte a freddo: un `/clear` lo precede sempre. Chi scrive la spec di un milestone e chi la esegue ticket per ticket non condividono mai il contesto — nemmeno quando è "la stessa" sessione nel senso dell'ID, perché la memoria della fase di design è già stata cancellata prima che l'esecuzione cominci.

---

"Vero che forse sarebbe più interessante leggere il risultato di to-tickets, ma lo faccio raramente, di solito io guardo il diff di ogni implement non prima. forse sbaglio?" — Fabio. La revisione umana cade quasi sempre sull'esecuzione (il diff), quasi mai sul piano (l'output di `/to-tickets`, le tickets stesse prima che qualcuno le implementi).

---

"Non mi è mai capitato, ma in effetti potrebbe capitare. Me ne accorgerei leggendo la diff o durante il QA manuale che comunque faccio dopo ogni implement." — Fabio, sul rischio di un piano sbagliato eseguito fedelmente. Non è successo finora, ma la rete di sicurezza non è "qualcuno rilegge il piano prima" — è tutta a valle: il diff, e il QA manuale sull'app che gira, dopo che il codice esiste già.

---

Nessun precedente concreto: "no, non mi viene in mente niente di concreto" — il rischio del piano-sbagliato-eseguito-bene resta, per ora, teorico. Non un incidente da raccontare, ma un punto cieco strutturale non ancora esploso.

---

"Sì, torna, direi che basta così. Certo, quando l'agente scrive le spec leggendo le vecchie e facendomi grilling può trovare degli errori passati e correggerli." — Fabio conferma la terza rete di sicurezza e ne nomina il meccanismo: non è l'agente che si rilegge da solo in silenzio, è il grilling con Fabio durante la scrittura della spec — lo stesso tipo di sessione di questo file — a far emergere le incongruenze vecchie mentre se ne scrivono di nuove.

---

Su #17 (l'exchange settlement), il codice passava verde a typecheck, lint e test con i totali per pool sommati nell'ordine con cui capitava di scorrere l'array della popolazione. La somma in virgola mobile non è associativa: riordinare la popolazione poteva spostare l'ultimo bit del fattore di scala, mentre il criterio di accettazione del ticket diceva "bit-identical". Nessuno strumento automatico lo vedeva: l'ha trovato il sub-agente Spec di `/code-review`, leggendo il criterio parola per parola contro il diff.

"Non è un vero bug, visto che abbiamo detto che la simulazione deve essere replicabile sullo stesso ambiente. Questo è stato fatto per essere ripetibile su ambienti diversi, però se l'ordinamento ad ogni tick peserà troppo lo toglieremo in futuro." — Fabio, a ridimensionare la scoperta. "Ambiente" qui è motore/browser: ADR-0007 promette determinismo a parità di motore, non tra motori diversi. L'ordinamento prima di sommare va oltre quella promessa già fatta, verso una proprietà che quella promessa non copre ancora. E su chi l'ha trovata: "In ogni caso è stato il codereview a trovarlo, non io."

---

"L'hai risolto bene ma temo che sarà troppo dispendioso a livello di performance quando aumenteremo il numero di esseri." — Fabio sul fix: ordinare gli importi di ogni pool prima di sommarli, ad ogni tick, così la somma dipende dall'insieme dei valori e non dall'ordine di arrivo. Non tolto ora. Prima volta nella pila che una correzione di correttezza entra già segnata come candidata a sparire, se il costo misurato lo giustificherà — non se il timore lo giustificherà.

---

Con #18 (fotosintesi) il pattern di #17 si ripete, ma questa volta sul codice invece che sulla spec: due test già verdi davano per buono che dentro un tick non si muovesse nient'altro oltre lo scambio passivo. Uno assertava un drift esattamente zero, `toBe(0)`. L'altro replicava a mano l'intera pipeline del tick, motion, separazione, muro, senza includere lo scambio né la fotosintesi, perché fino a quel momento non serviva includerli. Nessuno dei due era rotto per un bug: erano scritti bene per un mondo che un attimo dopo ha smesso di esistere.

---

Il dettaglio che rende la cosa interessante più della semplice manutenzione: il drift, una volta che la fotosintesi comincia davvero a spostare carbonio tra CO₂, food e O₂ dentro lo stesso organismo, non torna più a zero esatto. Resta a livello di rumore in virgola mobile, ordine di 1e-15, 1e-16. Non è una perdita: `a - x` e `b + x` calcolati separatamente non promettono di dare `a + b` fino all'ultimo bit, anche quando il totale che descrivono non è cambiato per niente. Il test è passato da un'uguaglianza esatta a una tolleranza proprio per questo, non perché la conservazione fosse diventata meno vera.

---

Candidato per una parola guida di questo pezzo: un'assunzione con la data di scadenza. La spec di M2 (commit `f80f675`) ne aveva tre, trovate da #16 tornando sui documenti. Il codice di #17 ne aveva una, trovata dal sub-agente Spec di `/code-review`. Il codice di #18 ne aveva due, trovate scrivendo i test della fetta successiva. Ogni fetta della catena non aggiunge solo un meccanismo: rende falso qualcosa scritto prima che sembrava vero solo perché quel meccanismo non esisteva ancora.

---

Con #19 (respirazione e maintenance) l'assunzione con la data di scadenza non era più nella spec né nel codice, ma nei numeri: `RESPIRATION_ENERGY_YIELD = 100` e `EXISTENCE_COST = 2.2`, scritti a mano nel ticket, facevano collassare l'intera popolazione a zero energia entro 500 tick. Non un bug — il ticket stesso lo prevedeva ("expect to move c₀ and the energy yield") — ma la differenza tra leggerlo previsto su carta e vederlo succedere in un run che muore per davvero.

---

"Le costanti cmq andranno aggiustate quando avremo una simulazione con esseri che possono morire." — Fabio. Il ritocco fatto in #19 (yield 100→800, c₀ 2.2→1.0) ha una scadenza già nota e già più vicina di quanto dica il commit: non solo "M5 risolverà le costanti per davvero contro l'α misurato", ma prima ancora, un'intera categoria di assunzioni cade quando M3 introduce la morte. La popolazione fissa e immortale di M2 è un mondo particolare — un organismo a zero energia resta lì per sempre, ancora presente nel conteggio, ancora a diffondere — e le costanti tarate per farlo stare in equilibrio in _quel_ mondo non hanno motivo di reggere in uno dove il carbonio di un morto torna nei pool e la popolazione può cambiare numero.

---

Il modo in cui è stata trovata la costante giusta non è stato risolvere un'equazione, è stato scrivere uno script usa-e-getta che fa girare `createWorld` per 20-100k tick e stampa i numeri — energia media, quanti a zero, livelli dei pool — a intervalli. La prima volta, con le costanti del ticket: `meanEnergy=0.00 zeroEnergy=40` già a tick 500, e restava così fino a tick 20000. Da lì, tentativi: alzare `RESPIRATION_ENERGY_YIELD`, abbassare `EXISTENCE_COST`, far girare di nuovo, leggere i numeri, aggiustare ancora — fino a un regime dove un pugno di organismi vicino alla superficie tiene un surplus vero e il resto sta a zero, invece che il collasso totale di prima. Fabio, confermando che questo è il pezzo interessante: "sì, il taratura a occhio è il pezzo interessante."

---

ADR-0015 ha un titolo che è quasi uno slogan: "α is measured, not declared". Un intero ADR per dire che _una_ costante non si calcola su carta ma si legge da un run vero — e quello strumento, formale, arriva solo con M5. Ma in #19 due _altre_ costanti (`RESPIRATION_ENERGY_YIELD`, `EXISTENCE_COST`) sono state tarate più o meno con lo stesso spirito, in anticipo e senza lo strumento: non declared, ma nemmeno measured nel senso pieno dell'ADR — solo guardate scorrere in un terminale finché il quadro non sembrava sensato. "È la stessa idea di ADR-0015, ma manuale." — Fabio, a mettere la parola giusta sopra la differenza: stesso principio, esecuzione artigianale invece che strumentata.
