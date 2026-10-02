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
