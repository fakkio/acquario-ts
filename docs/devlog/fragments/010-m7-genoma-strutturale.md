# Il neurone che non fa niente

> leggi @docs/vision.md e pianifichiamo la M7. Poi farò io il to-spec e il to-ticket da questo contesto

---

> cosa intendi per MEC?

L'agente aveva scritto "MEC" in tutte e sei le domande del primo round, perché vision e ADR-0028 lo usavano da settimane: `MEC_parent`, il minimum enclosing circle. Nel glossario non c'era. Una sigla che compare nelle formule da un mese e che l'autore del progetto non riconosce non è vocabolario condiviso, è vocabolario dell'agente. Il glossario ha guadagnato **Enclosing Circle** perché Fabio ha fatto una domanda da principiante sul proprio progetto.

---

La contraddizione stava lì da #42. ADR-0028 diceva che un organello inserito nasce "within the current circle", la vision diceva "inside the current body". Sembra la stessa frase e non lo è: un disco nato sul bordo del cytoplasm, lontano dagli altri organelli, allarga il cerchio di mezza thickness invece che di `2·r_new`, e il Birth Cost Ceiling si rompe. L'ha trovata l'agente rileggendo i due documenti uno accanto all'altro per preparare il grill. Fabio non sapeva ancora cosa fosse il MEC, e la domanda su dove nasce un organello dipendeva proprio da quello.

---

> ok, non dimentichiamoceli però

I quattro parametri CTRNN del neurone (`τ`, `bias`, `threshold`, `dischargeFactor`) escono da M7: senza synapses non fanno niente, e un parametro che non fa niente deriva a caso e ruba eventi di mutazione. La proposta è dell'agente, sulla regola che ADR-0032 aveva già scritto per l'orientation. Il "però" è di Fabio, ed è la cosa giusta da temere: una decisione di rimandare vive solo se qualcuno la scrive dove verrà letta. Adesso sta nella riga di M11 della vision.

---

> quando un organello passa il limite inferiore lo eliminiamo, che dici?

In M7 l'idea funziona benissimo: un organello inutile si rimpicciolisce fino a sparire, che è l'atrofia. Si rompe in M11. Un neurone non guadagna niente dalla propria dimensione, quindi la selezione lo spinge verso il piccolo, e con l'eliminazione al floor i neuroni collegati verrebbero cancellati a caso, synapses comprese. Un tasso di deletion nascosto proprio sulla struttura che la neutralità deve proteggere. L'obiezione è dell'agente. Fabio ha scelto il clamp, e ha rilanciato:

> comunque dovremo dare un motivo anche ai neuroni di avere un raggio non troppo piccolo. Però non mi viene in mente un'idea che mi convinca a pieno

È finito in `ideas.md` come problema aperto, con due candidati che non convincono nessuno dei due: il rumore dei canali ionici e un fan-in limitato dal perimetro.

---

Il neurone di M7 è un disco che non fa niente. Occupa spazio, paga l'overhead, allarga il corpo e rende il figlio più caro. È proprio per questo che arriva per primo: non pesa, non tocca reazioni, e mette al lavoro tutta la macchina (inserimento, split, relaxation, Enclosing Circle, ceiling) su organismi vivi, senza che una funzione confonda il risultato.

---

> l'alternativa è ripensare il limite del figlio peggiore, mettere un figlio peggiore al 90 percentile e poi se il figlio nascente fosse più grande del previsto lo facciamo nascere morto (il padre non può dargli abbastanza energia/cibo) [non so se mi sono spiegato] o facciamo morire il padre (ma si crea una perdita di massa mi sa)

Il conto che l'aveva spinto: ogni minimal organism, con le costanti di partenza, deve tenere il 30% di area in più di quanto chiedeva M6, per pagare un inserimento che quasi certamente non riceverà.

Fabio temeva per la massa, ed era la cosa sbagliata da temere. Un figlio nato morto restituisce il carbonio attraverso le Remains come qualsiasi morte, il ledger regge. Il problema è un altro: i figli che nascono vivi non sono più un campione imparziale della legge di mutazione. Che il genitore paghi il figlio nato morto rende il taglio costoso, non imparziale. È il Birth Sieve con il cartellino del prezzo attaccato.

E la coda tagliata non è una coda qualsiasi. Con `M_max = 2` e `p = 0.25` circa il 9% delle nascite porta un inserimento: il 10% di figli più cari coincide quasi esattamente con i figli che ricevono un organello nuovo. Un gate al novantesimo percentile avrebbe ucciso l'innovazione per meccanismo, che è proprio quello che M13 deve saper distinguere dalla selezione.

> ok, mi hai convinto

M6 aveva tolto il sieve da una porta. Il primo grill di M7 l'ha quasi fatto rientrare dall'altra, con una proposta ragionevole fatta per difendere la persistence.

---

Ogni minimal organism paga per un neurone che quasi certamente non riceverà. È il prezzo di un gate imparziale: il genitore deve poter pagare il figlio peggiore che la legge di mutazione può produrre, e da M7 quella legge può dargli un organello. Il conto si può solo stringere: si contano soltanto gli operatori che hanno un bersaglio, e il primo inserimento in un corpo vuoto costa `r_new` invece di `2·r_new`. Non si può togliere. Sul lato energia il gate resta comunque sotto la soglia genetica (circa 475 contro 943 per un organismo baseline), quindi a decidere sarà la massa. Lo dirà la persistence.

---

Un mondo con il roster vuoto deve essere M6, bit per bit: stesso state hash, allo stesso tick, dello stesso seed. Lo ha proposto l'agente e Fabio ha detto ok senza discutere, ma la conseguenza è più grande della regola. Per tenere quell'hash il contatore degli innovation id resta fuori dall'hash, un `Gene[]` vuoto non aggiunge niente, un roster vuoto non consuma draw, e il ceiling stretto diventa obbligatorio invece che una scelta. Un solo test ha deciso quattro dettagli di implementazione.

---

> scegli un ticket e implementalo. Prima di partire fammi la solita mappa html

Il primo ticket di M7 non tocca una riga di codice. Fissa un numero: lo state hash del mondo di M6, seed 1, tick 2000, `d22057a8`. È un golden hash, cioè un valore registrato una volta sul codice vecchio e poi mai più ritoccato: da qui in avanti ogni ticket di M7 deve rifarlo uguale per un corpo senza organelli. Un test che nasce verde per costruzione. Il rosso utile arriva dopo, la prima volta che il refactor di genoma, corpo, cap e concentrazioni sposta un bit senza volerlo.

---

La prima versione del test, scritta dall'agente, avanzava il mondo con una sola chiamata: `advance(createWorld(1), 2000 * FIXED_DT_MS)`. Ma `advance` esegue al massimo 240 tick per chiamata, un tetto pensato per l'app (una scheda rimasta in background non deve recuperare minuti di simulazione tutti insieme). Il mondo si sarebbe fermato al tick 240, con 1 nascita e 32 morti. Le due asserzioni di guardia, "almeno una nascita, almeno una morte", passavano entrambe. Il test sarebbe stato verde, il commento avrebbe detto 2000 tick, e l'hash fissato sarebbe stato `ec1f7f9c`, quello di un altro istante. L'agente se n'è accorto prima di lanciarlo, leggendo il nome di un test in `world.test.ts` ("caps the number of catch-up ticks run in a single call"). Adesso il test avanza un tick alla volta e controlla anche `getTick`.

---

Il ticket chiedeva di costruire "the default world". Il glossario mette proprio "default world" fra i termini da evitare: quel mondo ha un nome, **Reference World**. L'agente aveva copiato la parola dal ticket nel nome del test; l'ha trovata il revisore Standards di `/code-review`. Il ticket era uscito da `/to-tickets`, scritto da un agente che il glossario l'aveva sotto mano. Il vocabolario regge finché qualcuno lo controlla, anche quando a scrivere è chi l'ha scritto.

---

Sul seed 1 il mondo apre con una moria: dei 40 fondatori ne muoiono 32 entro il tick 240, e la prima morte arriva al tick 43, la prima nascita al 125. Sul seed 42 gli stessi due tick, 43 e 125, identici. Qualcosa nella generazione 0 è abbastanza deterministico da non sentire il seed. Da guardare, prima o poi: è la mutazione forzata dei fondatori, o l'equilibrio iniziale?

---

Il frammento sopra prometteva un rosso utile, "la prima volta che il refactor sposta un bit senza volerlo". In #60 il golden hash non è mai diventato rosso, nemmeno una volta. La ragione è meno rassicurante di quanto sembri. Senza organelli la Cytoplasm Area e l'area del corpo sono lo stesso numero, bit per bit: una lettura che sceglie l'area sbagliata produce esattamente lo stesso hash di una che sceglie quella giusta. Il test prova che il refactor non ha rotto niente, non che ogni lettura sia finita dalla parte giusta. Il piano dell'agente, nella mappa HTML, diceva il contrario: "se una lettura sceglie l'area sbagliata, scatta lì". Non può scattare. La scelta dell'area diventa verificabile solo in #61, quando un neurone rende diversi i due numeri.

---

Il ticket elencava tre letture da spostare sulla Cytoplasm Area: concentrazioni, cap, `β`. La respirazione ne nasconde una quarta, dentro il tasso: `K · (cibo/A) · (O₂/A) · A`. Le prime due `A` sono concentrazioni, la terza è il volume in cui la reazione avviene. L'agente l'ha messa sul citoplasma, perché il volume della reazione è quello che contiene gli store. Nessuno l'ha discusso e nessun test se ne sarebbe accorto: oggi le due scelte danno lo stesso numero.

---

L'harness ha le sue copie delle formule della simulazione. `income.ts` ricalcola la manutenzione `c₀ + β·area` a mano, `income.ts` e `live.ts` ricalcolano la concentrazione del cibo. Il ticket nominava l'harness solo per fondatori e scale di spessori. Seguito alla lettera, avrebbe lasciato lo strumento a misurare sull'area del corpo mentre la simulazione paga sul citoplasma: due numeri diversi per la stessa cosa da #61 in poi, in un posto che per scelta non ha test (ADR-0024). L'agente le ha spostate cercando ogni lettura d'area, non seguendo la lista.

In `dark.ts` invece aveva ricalcolato il cap a mano dal raggio del gradino, con un commento: "il fondatore di un gradino non porta organelli". Il revisore Standards di `/code-review` ha notato che la regola "senza organelli lo spessore è tutto il raggio" stava ormai scritta in tre posti, e che #61 dovrà cambiarli tutti insieme. Ora `dark.ts` legge il cap dalla view.

---

`Gene = never`. Il ticket voleva un `Gene[]` "sempre vuoto per ora". L'agente l'ha tipizzato con il tipo che non ha valori: un `genes.push(...)` non compila. Un array vuoto per convenzione diventa vuoto per legge, fino al giorno in cui #61 dichiara l'Organelle Gene e il compilatore indica ogni punto che deve accorgersene.

---

ADR-0028 scrive la forma del genoma come `{ mitosisEnergyThreshold, childAllocationRatio, lineageHue, cytoplasmThickness, genes }`, con lo spessore per ultimo. Il codice lo mette per primo, perché nel codice l'ordine di dichiarazione è l'ordine dei draw e lo spessore deve occupare il posto di `bodyRadius`. Il revisore Standards l'ha segnalato come violazione dell'ADR, il revisore Spec come requisito rispettato ("same position in the draw order"). Hanno ragione tutti e due: l'ADR elenca un insieme, il codice dichiara una sequenza.

---

Il contratto di ADR-0028 dice che un evento che aggiunge `Δd` di diametro, o sposta un organello di `d`, allarga l'Enclosing Circle al massimo di `Δd + d`, "however far the relaxation pushes". L'algoritmo era lasciato al ticket. Quello che l'agente ha scritto non cerca un rilassamento bello e poi spera che rispetti il contratto: costruisce il contratto e basta.

A ogni giro c'è un **colpevole**, il disco con più sovrapposizioni, e due mosse possibili. La spinta allontana tutti gli altri dal colpevole della stessa distanza, la sua sovrapposizione più profonda. Lo scivolamento sposta solo il colpevole, verso l'esterno, fino al primo posto libero. Si tiene la mossa che lascia il cerchio più piccolo.

Ognuna salva il caso che l'altra perde. Un organello che cresce si sovrappone ai vicini al massimo di quanto è cresciuto, e la spinta li allontana proprio di quello. Se invece lo si facesse scivolare, attraverserebbe mezzo corpo. Un organello inserito al centro di uno grande si sovrappone per tutto il raggio del grande, e spingere via tutto di quella misura gonfierebbe il corpo. Scivolando verso il bordo, il cerchio cresce al massimo di `2·r_new`.

---

La spinta non avvicina mai due dischi, e la ragione è una riga di analisi convessa: la mappa `p ↦ p + s·û`, che allontana ogni punto dal centro della stessa distanza `s`, è il gradiente della funzione convessa `|p|²/2 + s·|p|`, e il gradiente di una funzione così non accorcia nessuna distanza. Quindi la spinta toglie le sovrapposizioni del colpevole senza crearne di nuove fra gli altri. È la frase che fa terminare il ciclo: a ogni giro il numero di coppie sovrapposte scende.

---

Il codice del layout è passato verde al primo colpo, sedici test su sedici. L'agente non si è fidato. Ha tolto lo scivolamento e ha rilanciato: è caduto il test dell'inserimento, solo quello. Ha rimesso lo scivolamento e tolto la spinta: sono caduti crescita e spostamento, solo quelli. Un test di proprietà che non hai mai visto rosso potrebbe passare anche con la funzione vuota. Rompere apposta il codice per vedere quale test si accorge di cosa è il modo più rapido di sapere che i test misurano davvero il contratto.

---

Il piano metteva il rilassamento dei fondatori dentro `deriveBody`, e il ticket diceva la stessa cosa: "the body-derivation function ... relaxes overlapping organelles apart". Vero, ma solo a metà. ADR-0034 vuole che il genoma contenga già il layout rilassato e ricentrato, "with nothing left for construction to fix". Così com'era, un fondatore scritto a mano con i neuroni uno sopra l'altro teneva nel genoma le posizioni sovrapposte, le piegava nell'hash e le passava ai figli. Era proprio l'alternativa che ADR-0034 scarta.

L'hanno trovato tutti e due i revisori di `/code-review`, Standards e Spec, ognuno per conto suo. Il piano era dell'agente, la frase incompleta era del ticket, scritto da un altro agente con l'ADR sotto mano. È la seconda volta in M7 che un ticket uscito da `/to-tickets` dice qualcosa di vero e incompleto rispetto ai documenti da cui nasce: la prima era il "default world" di #59.

---

Il test che doveva provare "il genoma del fondatore è il suo corpo" confrontava le due liste con `toEqual`, e falliva. Differenze all'ultima cifra: `-0.10546916309558063` contro `-0.10546916309558085`. Ricentrare un layout già centrato lo sposta comunque, perché il centro del suo Enclosing Circle non torna `0` ma un `1e-16` di arrotondamento. È deterministico e non fa danni, ma l'idempotenza su cui contava il piano ("rilassarlo di nuovo non sposta niente") vale solo fino all'ultimo bit. In #62 ogni nascita ricentra il layout del figlio: la deriva sarà di qualche `1e-16` per generazione.

---

La regola sugli Innovation Id dice che niente ordina gli id per valore. Il test che controlla che i fondatori li ricevano in ordine di piazzamento fa proprio quello: `[...ids].sort((a, b) => a - b)`, e confronta. Con un commento che si scusa: lo legge solo per controllare il contatore, mai per mettere in fila i geni. Per verificare che un valore non conta, bisogna guardarlo.

---

Il ceiling è arrivato con un ticket di anticipo. #61 non doveva toccarlo: il Birth Cost Ceiling strutturale è di #62. Ma un figlio eredita i neuroni del genitore tali e quali, e con il ceiling di M6, `π·(t·(1+δ))²`, il primo genitore con un neurone avrebbe fatto scattare il `throw` della mitosi alla prima nascita. L'agente l'ha visto nel piano, prima di scrivere codice, e ha aggiunto il raggio dell'Enclosing Circle del genitore: è la formula di ADR-0028 senza il termine degli eventi strutturali. Con un `Gene[]` vuoto il raggio è zero, e il ceiling resta quello di v0.1 bit per bit.

---

Per vedere il nuovo look l'agente ha fatto girare l'app con 40 fondatori carichi di neuroni, attraverso una patch locale a `main.ts` mai committata. I neuroni di quella prova avevano raggio da 0.1 a 0.2. Quelli veri nasceranno a `r_new = 0.05`: allo zoom di partenza, 14 pixel per unità, fanno 0.7 pixel di raggio. I "small grey dots" decisi per lo schermo in #50 saranno puntini sotto il pixel, visibili solo zoomando. Da ricordare quando #63 farà comparire i primi neuroni in un mondo vero.

---

L'effetto di morte dura 300 millisecondi. La prima raffica di dodici screenshot, uno ogni 70 millisecondi, non ne ha preso nessuno. La seconda prova ha letto il contatore Deaths dell'HUD ogni 15 millisecondi e ha scattato 60 millisecondi dopo il primo cambio. Lo screenshot mostra un corpo scuro che svanisce dentro il suo anello, contro la parete di destra. Per fotografare la morte bisogna aspettarla.
