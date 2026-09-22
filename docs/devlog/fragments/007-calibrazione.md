# Quanto dura una misura

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

---

Il primo ticket di M5 ha un deliverable curioso: tre allargamenti del mondo e zero cambiamenti di comportamento. La verifica sta in una riga, scritta nel ticket stesso: un mondo costruito senza opzioni deve arrivare allo stesso hash di prima. Un commit intero la cui prova di correttezza è che un numero non si muove.

Additive means additive, dice il ticket, che tradotto è: se hai allargato bene, non si vede niente.

---

Ho verificato l'invarianza avanzando il mondo di `500 × FIXED_DT_MS` in una chiamata sola, e ho scritto i tre hash nel commit message come prova. Erano giusti. Erano anche identici prima e dopo, quindi la conclusione reggeva.

Solo che `MAX_TICKS_PER_ADVANCE` taglia una singola `advance` a 240 tick. Quei tre numeri erano il tick 240 con scritto sopra tick 500. Nessuno poteva riprodurli: chi avesse rifatto la misura nel modo ovvio, cinquecento chiamate da un tick, avrebbe ottenuto tre hash diversi e non avrebbe saputo quale dei due era rotto.

La misura era corretta e irriproducibile nello stesso momento. È il caso peggiore, perché non fallisce.

---

L'ha trovata un agente di revisione, rifacendo la misura per conto suo in un worktree staccato invece di leggere il numero che gli avevo messo davanti.

Vale la pena metterlo accanto al frammento sui cinque giri di design, quello dove scrivevo che la revisione non c'era e che le smentite dell'agente erano l'unico controllo attivo. Qui la revisione c'era, ed è servita esattamente per la cosa per cui serve: non ha trovato un errore di ragionamento, ha trovato un numero che nessuno aveva ricontato.

---

`K_CAP` diventa una tabella per risorsa, e ogni voce resta 1. Nessuna cap si muove di un millesimo.

Sembra lavoro a vuoto ed è l'opposto. Fra due ticket il cibo salirà sopra `ρ`, e quel diff conterrà un numero cambiato e nient'altro. Chi lo aprirà fra sei mesi non dovrà separare il cambio di forma dal cambio di valore, perché sono in due commit diversi.

Allarga la forma adesso, sposta il valore dopo. Costa un commit in più e compra l'attribuibilità.

---

ADR-0022 ha ritrattato per iscritto la frase "`kCap = 1` fissa l'unità di concentrazione". `vision.md` era stato corretto in due punti su tre. Il terzo, la riga sull'unità della luce, diceva ancora la frase vecchia. E con lui un commento in `ledger.ts` e due in `reproduction.long.test.ts`.

Quattro posti dove il progetto continuava ad affermare una cosa che si era già ritrattata, in un repo dove la ritrattazione stessa è il titolo del mucchio di frammenti.

Una decisione scritta in un ADR non si propaga da sola. Si propaga dove qualcuno è andato a guardare.

---

Sono andato a controllare se il repo avesse davvero l'abitudine di fidarsi di numeri raccontati a voce, e la risposta è più precisa dell'accusa.

`death.test.ts` dice "Measured at 269 ticks to extinction", e due righe sotto c'è `const SEED = 71` dentro il `describe` che quella run la esegue. Rilanci il test e 269 torna. Il tolerance `1e-9` di `conservation.long.test.ts` è argomentato nel commento sopra al test che lo misura, con il seed nello stesso file.

`RESPIRATION_ENERGY_YIELD = 800` invece dice "found by running `createWorld` out to 100k ticks and reading where the population settles". Nessun seed. Nessuna opzione: quel mondo era immortale? fertile? Nessun comando. E `EXISTENCE_COST` sta a 1.0 "for the same reason", cioè per la stessa run irripetibile.

Non è una questione di disciplina. Un numero sopravvive esattamente quanto il codice che l'ha misurato. Dove la misura stava dentro un test è ancora viva; dove stava solo in un commento è il racconto di una run in cui nessuno può più entrare.

---

E c'è la coincidenza che rende la cosa un debito invece che un aneddoto: le due costanti non riproducibili sono esattamente le due che M5 deve ri-derivare. `EXISTENCE_COST` è quella che il ticket #35 deve risolvere contro l'α misurata nella banda fotica.

M5 non sta correggendo un'abitudine sbagliata. Sta pagando un conto preciso, aperto da due numeri la cui provenienza è evaporata.

---

Il mio errore era della stessa famiglia, e la differenza fra i due casi non è la gravità: è quanto sono durati. Il mio trenta secondi, perché qualcuno ha rifatto la misura. Quegli altri quattro milestone, perché nessuno l'ha rifatta.

---

Perché una misura scritta in un commento non ha modo di fallire. Un test rotto diventa rosso; un numero sbagliato in un commit message resta lì e sembra una prova.

Questo spiega anche una decisione della spec di M5 che a prima lettura sembrava pignola: l'harness non asserisce niente, riporta e basta, e i gate stanno nella long suite. "A test that prints instead of asserting is a test that can never fail." Vero, e lo stesso vale per il suo output. Quindi la regola che serve non è che l'harness asserisca, ma che ogni numero che produce sia ri-ottenibile con un comando, proprio perché quel numero non potrà mai diventare rosso da solo.

Il controllo umano, nelle milestone che restano, va speso dove un'affermazione non ha modo di fallire. Non sul codice: sui numeri.

---

Messi in fila, i ritrovamenti di M5 sono tre forme della stessa cosa.

`K_CAP = 1` era scritta con la sicurezza che si usa per le cose derivate, e non era derivata: nessuno aveva rifatto quella derivazione per quattro milestone. `RESPIRATION_ENERGY_YIELD = 800` è scritta con la sicurezza che si usa per le cose misurate, e la run che la misurò non è più raggiungibile. E la ritrattazione di ADR-0022 è arrivata in due punti su sei, perché gli altri quattro nessuno è andato a rileggerli.

Un'affermazione dura finché nessuno rifà il lavoro che c'è sotto. La misura è il caso più netto perché ha una scadenza che non si vede: il numero resta leggibile per sempre, è la run che scompare.

---

E in tutti e tre i casi, la cosa che ha rifatto il lavoro è stata qualcuno che lo ha rifatto a mano. L'agente che al terzo giro ri-deriva e si smentisce. La revisione che rilancia la misura dell'hash in un worktree staccato invece di leggere il numero che le avevo messo davanti. Io che vado a cercare con `grep` quante volte il repo dice "measured".

Niente di tutto questo è automatico, e il progetto una cosa automatica ce l'ha: l'invariante di conservazione rifà la stessa verifica centomila volte di fila, a ogni tick, e `vision.md` la chiama da sempre "the single best bug detector the project has", cioè il miglior rilevatore di bug che il progetto possiede.

È l'unica affermazione del progetto che non può invecchiare, perché è l'unica che si ricontrolla da sola.

---

Questo articolo si chiude su un verdetto che ancora non esiste. Le quindici run di done-criteria diranno se le medie geniche atterrano entro il ±15% dell'`r_opt` previsto, e la spec di M5 mette per iscritto che un verdetto è dovuto in entrambi i casi: "It is not a reason to widen the ±15% band, and the band is fixed before the runs precisely so that widening it later is recognisable as a refusal rather than a judgement call." Allargare la banda dopo, dice, si riconoscerebbe come un rifiuto e non come un giudizio.

Quindi il pezzo è impegnato in anticipo a pubblicare anche il risultato negativo. Non è coraggio: è che la banda è stata fissata prima, e adesso non è più mia.

---

Ed è la stessa moneta del filo, girata dall'altro lato.

Una misura che non si può rifare non vale niente, perché il numero sopravvive alla run che lo ha prodotto. Una previsione fissata dopo la misura non vale niente, perché non c'è più niente che possa smentirla.

Sono tutte e due questioni di ordine, non di rigore. Prima la previsione, poi la misura; e la misura deve restare rifacibile più a lungo del numero che stampa.

---

L'harness è atterrato prima che si muovesse una costante, ed è la prima volta in M5 che una previsione di carta viene messa alla prova. Ha retto: `α_dark` misurata 1.240 contro una soglia di 2.000, e tutti e dodici i raggi, da 0.25 a 8.0, muoiono sotto la luce.

Ma la conferma migliore non è il verdetto, è la forma. ADR-0023 diceva che il buio ammette una banda e non un tetto, perché la condizione di sopravvivenza è una parabola all'ingiù: i piccoli muoiono sul costo fisso, i grandi sul costo d'area. La tabella dei morti la disegna. Il più piccolo muore al tick 61, il centro della scala regge fino al 317, il più grande ricade al 242.

La banda è vuota, ma è vuota per il motivo previsto. Il vertice della parabola sta sotto la linea di pochissimo; non è la parabola a essere sbagliata.

---

Cinque giri di domande avevano azzeccato la fisica e sbagliato lo strumento.

Il ticket #34 descrive la misura del reddito energetico come esatta, e lo è: in una popolazione fissa nessuno nasce, nessuno muore, nessuno paga un figlio, quindi l'energia cambia per due soli termini e `Δenergia + (c₀ + β·area)` è la respirazione, non una stima della respirazione.

Solo che vale finché l'energia è libera di scendere. Il mondo immortale la ferma a zero. E il corpo che sbatte contro quel pavimento è esattamente quello il cui reddito non copre il proprio mantenimento, cioè quello di cui volevo sapere il reddito.

Lo strumento vede solo gli organismi che non hanno bisogno di lui.

---

La prima versione dell'harness ha usato una sola finestra per tutta la scala dei raggi, come diceva il ticket. Ha ammesso tre pioli su dieci e ha stampato `NaN`.

La seconda cerca, per ogni piolo, il tratto più lungo in cui quel corpo non era né a zero né al massimo. Ne ammette dieci su dieci, con un `r²` di 0.98. Sembra la fine della storia.

Non lo è. Quei quattro pioli grandi uno stato stazionario non ce l'hanno: sono leggibili solo mentre scendono, fra il tick 1 e il tick 350, dentro il transitorio di apertura del mondo. ADR-0025 l'esponente lo definisce sul regime limitato dall'offerta, che è un'altra cosa.

---

Quindi `n` è riportato due volte, e le due volte non dicono la stessa cosa.

```
n, across seeds            1.161 ± 0.0091
n, settled rungs only      1.400 ± 0.0071
```

Il gate di ADR-0025 vuole `n` fra 0.9 e 1.15. Il primo numero è appena fuori, e appena fuori somiglia a una questione di taratura. Il secondo non somiglia a niente del genere.

I quattro pioli misurati nel transitorio tirano la pendenza verso il basso, cioè verso il gate. Se non li avessi marcati, l'harness avrebbe stampato un numero più vicino a passare di quanto il mondo meriti.

Il numero comodo era quello che usciva dal non guardare.

---

C'è una riga nell'intestazione del report che non è una misura. È aritmetica che il progetto possedeva già.

`N_max = K/(2r²) − aquariumArea/(2π r²)`, la formula chiusa del tetto di popolazione, scritta in ADR-0022. Valutata alle costanti di oggi, con `K = 200`, dà **−30**.

Un tetto negativo vuol dire che il mondo è sterile per fisica, prima di qualunque domanda di taratura. Nessuno aveva mandato avanti quella formula. Era lì, derivata, corretta, e per farla parlare è servito scrivere lo strumento che la stampa in una riga insieme alle altre.

Il mucchio dice che un'affermazione dura finché nessuno rifà il lavoro che c'è sotto. Questa non aveva nemmeno bisogno che si rifacesse il lavoro: bastava sostituire un numero.

---

> mi sto stufando di rispondere a tutte queste domande sui frammenti per un devlog che tanto poi faccio scrivere a te

Il mucchio esiste perché l'articolo esca dalle notazioni invece che dal diff. Ma se guardo questo file, le cose che dal diff non si ricostruiscono sono cinque, e sono tutte righe che ho buttato lì mentre facevo altro: il buio non noioso, i conti lasciati andare a sentimento, la curiosità sull'alpha, la resa sulla geografia, la coda grilling-spec-ticket.

Nessuna delle cinque è la risposta a una domanda. Sono tutte cose dette lavorando.

Le domande producono l'analisi che l'agente fa del proprio codice, che è esattamente la cosa che dal diff si ricostruisce benissimo.

E c'è il rovescio, che è la parte che non mi aspettavo: siccome l'articolo lo faccio scrivere a lui, il mucchio conta di più, non di meno. Se lo scrivessi io, le mie notazioni ce le avrei in testa e il file sarebbe una comodità. Così è l'unico canale che hanno.
