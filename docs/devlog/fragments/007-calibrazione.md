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

---

Anche lo strumento può mentire, non solo le costanti che misura. La riga "N_max at r = 1.5" di `calibrate.ts` moltiplicava il budget per π prima di dividerlo, mentre la formula di `vision.md` vuole la costante grezza — quel `·π` appartiene a un'altra forma chiusa, quella che trasforma "K organismi" in un ammontare di carbonio, e non compare qui. Non stampava un numero assurdo. Stampava un numero plausibile, sbagliato nello stesso modo silenzioso dei tre ritrovamenti di prima. Si è visto solo mettendo due righe dello stesso report una contro l'altra — "ambient carbon s", vera, contro "N_max at r = 1.5", finta — e trovando che implicavano due budget diversi per lo stesso input.

---

Alzare il budget di carbonio abbastanza da ottenere `N_max = 150` fa partire la CO₂ interna della generazione 0 sopra la propria cap. La cap resta ferma a 1 per scelta esplicita del ticket, e la quota ambientale di CO₂ ne prende 1.30. La respirazione resta bloccata finché la photosynthesis non la riporta sotto, e vicino al bordo della banda fotica quello richiede migliaia di tick. Nessuno l'aveva mai visto perché il vecchio budget, troppo piccolo, non si era mai avvicinato a quella soglia.

Tiene il carbonio giusto, nella cap sbagliata — la stessa frase di prima, spostata di un piano.

---

Per la prima volta in questo progetto un mondo mortale e fertile fa nascere qualcuno da solo. Prima: quaranta fondatori, trentanove cadaveri entro il tick 11k, zero nascite mai. Dopo: la prima nascita al tick 100, poi trentatremila nascite in cinquantamila tick. Ma la popolazione sale oltre i mille corpi e poi collassa a zero entro il tick 30k — un boom e un crollo veri, non nascosti sotto una soglia più larga, perché addomesticarli è dichiaratamente il lavoro del ticket dopo.

---

Ho misurato α prima di spostare il budget di carbonio, e poi ho usato quella misura per risolvere la costante che dipende dal budget nuovo. Sbagliato: α dipende dall'ambiente che il budget stesso fissa, quindi misurarla prima vuol dire misurarla nel mondo sbagliato. Me ne sono accorto solo perché il numero è cambiato troppo per essere rumore — da 2.7 a 6.1 — rilanciando l'harness dopo aver spostato il budget. Lo stesso ordine che `vision.md` mette per iscritto in prosa, il budget prima e la misura dopo, e che avevo comunque invertito senza accorgermene.

---

Una manciata di test più vecchi davano per scontato che niente nascesse o morisse in fretta, e lo davano per scontato senza saperlo: erano rimasti verdi per quattro milestone non perché l'invariante fosse vera, ma perché non era mai stata messa alla prova. Il primo mondo che riproduce per davvero li ha messi alla prova tutti insieme lo stesso giorno — un soffitto di collisione tarato quando nessuno nasceva mai in seicento tick, una pipeline di riferimento che non replicava il pavimento d'energia perché nessuno l'aveva mai toccato, due letture di α tarate su un mondo dove la respirazione partiva subito. Nessuno di questi era un errore quando è stato scritto.

---

Il costo di una run da centomila tick non è fisso: dipende da quanti corpi il mondo tiene in vita nel frattempo. Lo stesso file di test, stessa struttura, stesso seed, è passato da quattro secondi a due minuti e mezzo, solo perché adesso la popolazione sale di un ordine di grandezza prima di ricollassare. Il timeout di trenta secondi che bastava fino a ieri era una misura del vecchio mondo travestita da parametro del test runner.

---

Il ticket #36 doveva solo spostare qualche costante contro tre soglie già scritte. Ha finito per farmi rifiutare una legge, scoprire un bug di prestazioni per puro caso, e chiudere accettando che due delle tre soglie restino non superate. Nessuna delle tre cose era nel piano, e nessuna delle tre è uscita da un test rosso: sono uscite tutte da una domanda fatta a voce, in un punto in cui il codice già "funzionava".

---

Il primo modo per far tornare `r_max` funzionava: se il cibo non basta, il figlio prende il resto dalla CO₂ del genitore, rilasciando l'ossigeno che portava con sé. Chimicamente pulito — è la fotosintesi stessa, girata al contrario, senza luce. Ho detto no lo stesso.

> non mi piace che il figlio si prenda la co2 come cibo

Non sapevo ancora perché non mi piacesse. L'ho trovato dopo, mettendolo a confronto con il resto del meccanismo: ovunque nella mitosi, quello che il genitore cede è quello che il figlio riceve, stesso tipo. Cibo per cibo, ossigeno per ossigeno, CO₂ per CO₂. Il fallback rompeva quella regola in un punto solo — cibo che diventa massa passando per la CO₂ — e bastava vederla scritta per sapere che non la volevo, anche prima di saperne il motivo.

---

Ho provato a scollegare il costo di massa dalla taglia del figlio — dare al genitore la libertà di cedere "un tot", non necessariamente quanto pesa il figlio. Sembrava la stessa idea del fallback, spostata di un passo. Non lo era: l'avevo già scartata io stesso, mesi prima, in ADR-0022, con la stessa identica motivazione che avrei riscoperto adesso — se la taglia del figlio smette di dipendere solo dalla mutazione, `bodyRadius` smette di essere un tratto sotto selezione, e la popolazione collassa verso il corpo più piccolo che sopravvive. Non un problema di conservazione del carbonio, questa volta: un problema di cosa significa "ottimo" quando l'ottimo può essere aggirato barando sulla taglia.

---

Ho ricostruito da solo, con un esempio numerico, il meccanismo che il codice già implementava — genitore paga la massa strutturale del figlio, poi gli regala un extra deciso da un gene. Non l'avevo letto da nessuna parte prima di scriverlo. Coincideva a cifra.

Non è la scoperta che conta. È che la parte del meccanismo che non mi piaceva non era quella che pensavo. Il fallback non introduceva "un genitore che dà al figlio più di quanto serve" — quello c'era già, si chiama `childAllocationRatio`. Introduceva un genitore che paga in una moneta e il figlio riceve in un'altra. Ci sono voluti tre giri di conversazione per separare le due cose.

---

> visto che le risorse del figlio arrivano dal genitore e al genitore vengono tolte, non dovrebbe aumentare

Avevo scritto che la nascita di un figlio "aumenta istantaneamente" il carbonio totale, come se fosse un problema da correggere con un debito compensativo. Non aumenta: il codice attuale bilancia tutto nello stesso istante, ed è stato lui a fermarmi prima che continuassi a spiegare un bug che non c'era, invece del vincolo che c'era davvero — non "la nascita crea carbonio", ma "due quantità calcolate in modo indipendente devono coincidere per caso, e oggi coincidono perché il codice le forza a farlo".

Un'altra voce nel mucchio delle correzioni che non sono arrivate da un test.

---

Senza il fallback, nessuna combinazione di costanti provata fa passare tutti e tre i gate insieme. `AMBIENT_CO2_SHARE` tira `n` e `r_max` in direzioni opposte — abbassarlo aiuta l'uno e rovina l'altro. `tenancy` è rimasta sotto la soglia richiesta in ogni combinazione, mai sopra 4.25 nel punto migliore trovato. Il ticket stesso prevedeva questo esito: _"if the world cannot be made to satisfy them, that is a finding."_ L'ho lasciato così. Non un gate allargato per far passare una run — un gate che resta chiuso, scritto dove si vede.

---

Guardando la simulazione girare: tante nascite, e una deriva verso corpi sempre più piccoli, non verso il raggio ottimo previsto sulla carta. Sembrava un segno che "il mondo funziona". Era il sintomo esatto che il gate `tenancy` esiste per scoprire.

I corpi piccoli si muovono più in fretta per moto browniano — entrano ed escono dalla luce prima di poter dimostrare, con più di una nascita, se il loro raggio fosse davvero quello giusto. Tanta attività, ma è più probabile che sia geografia — chi capita a passare nella zona giusta — che vera selezione energetica.

È la stessa parola di mesi fa, tirata fuori da un'altra porta. ADR-0018 l'aveva scritta parlando del ritorno dal buio: _"an early result may be reporting geography rather than genetics"_. Il progetto continua ad avvertirsi da solo sulla stessa cosa, e io continuo a riconoscerla solo dopo averla vista girare.

---

Un bug di prestazioni trovato per puro caso, cercando tutt'altro: `buildUniformGrid` dimensiona ogni cella al doppio del raggio corporeo più grande nella popolazione — corretto, finché tutti i corpi sono di taglia simile. `bodyRadius` muta senza un tetto. Bastano abbastanza nascite perché una mutazione rara produca un corpo enorme, e nel momento in cui esiste, migliaia di corpi minuscoli finiscono ammassati nella stessa manciata di celle giganti — un tick che dovrebbe costare `n` ne costa `n²`, per tutti i tick finché quel corpo non muore.

Una run da un minuto ne ha impiegati ottanta. Il timeout di vitest lo ha segnalato fallito al secondo 120, ma il ciclo sincrono di JavaScript non si può interrompere a metà — ha continuato a girare in background, invisibile, per un'ora e diciotto in più, prima che qualcuno potesse leggere l'esito vero.

Due scelte, prese in momenti diversi e per motivi entrambi ragionevoli — la cella dimensionata sul corpo più grande, la mutazione senza tetto — si sono incontrate una volta sola, per caso, dentro una popolazione abbastanza fertile da produrre l'incontro. Non l'ho cercato. Stavo solo aspettando che finisse una run che pensavo durasse un minuto.

---

> ma secondo me è un bug non pericoloso, cmq ho già in mente un algoritmo diverso

Ottanta minuti invece di uno mi era sembrato abbastanza per chiamarlo pericoloso. A lui no — e ha già in testa l'algoritmo che lo sostituisce, prima ancora che qualcuno gli chiedesse di scriverlo.

---

> griglia di dimensione fissa, da trovare con un benchmark. ogni organismo si registra in tutte le celle che tocca. creiamo una mappa fissa di celle a distanza <1, <2, <3 ecc. per fare la ricerca parto dalle coordinate x e y, e cerco solo nelle celle a distanza < distance utilizzando la mappa di celle a distanza fisse

La griglia attuale risolve "nessun corpo scappa al controllo" dimensionando la cella sul corpo più grande — una taglia sola, decisa dal caso peggiore di tutta la popolazione. La sua fa la stessa promessa al contrario: la cella resta piccola e fissa, e chi è più grande di una cella si registra in più celle. Il corpo enorme paga il proprio costo — comparire in più bucket — invece di farlo pagare a tutti gli altri alzando la taglia della cella per l'intera popolazione.

La mappa delle distanze precalcolata è la seconda metà dell'idea, e sposta lo stesso principio dalla scrittura alla lettura: invece di ricalcolare ogni volta quali colonne e righe coprire a partire da un raggio di ricerca, la forma dell'anello a distanza 1, 2, 3 è fissa e la si guarda in una tabella. Il costo di una query smette di dipendere da quanto è grande il corpo più grande nel mondo, e dipende solo da quanto lontano deve guardare _quella_ query.

---

> pensavo di provare varie dimensioni e vedere in tot secondi quanti tick riesce ad eseguire

Nessuna formula per la dimensione giusta della cella — un benchmark, si prova e si guarda quanti tick gira in un tempo fisso. La stessa mossa dell'harness di calibrazione, spostata dalle costanti del mondo a quelle del motore che lo fa girare: quando non sai derivarlo, non lo stimi, lo fai correre e leggi il numero.

---

Il ticket #37 prometteva un lavoro di HUD e invece era quasi tutto già pagato. #33 aveva allargato `OrganismView` con i due geni della riproduzione "so that all four genes can be read where the statistics over them are computed — the HUD and the calibration harness", parola per parola il ticket che sarebbe arrivato mesi dopo. Quando #37 è arrivato per davvero, non c'era niente da aggiungere al mondo: solo da leggere quello che il mondo esponeva già, e sommarlo in una riga di HUD.

Un commento nel codice aveva nominato il proprio futuro prima che esistesse, e il futuro è arrivato a dargli ragione esattamente.

---

ADR-0018 si era scritta da sola una scadenza: "Flip the default at M4, when a restart is showing something." M4 non ha mai fatto nascere nessuno, quindi la scadenza è passata senza succedere niente, e il documento è rimasto un milestone indietro rispetto a se stesso finché #37 non ha chiuso il conto. Non dimenticato: rimandato esattamente per il motivo che la frase stessa prevedeva — quando un restart mostra qualcosa, e quel qualcosa non c'era ancora.

---

#36 non è chiuso, ma non è nemmeno aperto nel senso in cui lo è un ticket senza risposta. Il verdetto c'è già, scritto in un commento: due gate su tre restano sotto soglia, per una scelta di principio e non per un bug irrisolto. #38 e #31 aspettano comunque, perché "blocked by" non distingue fra un ticket a cui manca la risposta e un ticket la cui risposta non è quella che si voleva sentire.

---

#38 doveva rispondere a una domanda con due risposte possibili: converge o non converge. La risposta vera è stata una terza, più netta di entrambe: niente da misurare. Quindici mondi, cinque seed per tre genomi di partenza, e tutti e quindici si estinguono prima ancora di entrare nella finestra delle ultime diecimila tick. Il gate di accuratezza non ha un solo numero da giudicare. Il gate di convergenza non ha uno spread da confrontare: `NaN`, non un valore fuori banda.

Non è la milestone che ha fallito una previsione. È la milestone in cui la domanda "converge?" si è scoperta prematura.

---

I test che dovevano solo "riportare, non giudicare" — media e σ degli altri due geni, la non-convergenza di `lineageHue` — avevano un `expect(survivors.length).toBeGreaterThan(0)` scritto dentro. Sembrava una guardia ragionevole. Era un gate travestito da report, ed è saltato fuori esattamente nel caso che contava di più: quando tutti i mondi si estinguono, un report che si rifiuta di girare non dice "niente da riportare", fallisce e basta — la stessa distinzione di prima, girata al contrario. Lì era una misura scritta in un commento che non aveva modo di fallire; qui era un report scritto come se non potesse mai fallire, e falliva comunque, proprio nel momento in cui contava di più guardare.

L'ha trovato la revisione, non una run.

---

La stessa suite, lo stesso codice, gli stessi cinque seed: 888 secondi, poi 641, poi — senza che niente fosse cambiato nel frattempo — 29723. Otto ore e mezza, fermata solo dal timeout dell'hook. Ho controllato i processi node ancora vivi sulla macchina: nessuno riconducibile alla run, tutti server di sviluppo e language server aperti da giorni, estranei.

Non ho trovato la causa. Ho rilanciato la stessa run isolata una terza volta — 659 secondi, stesso verdetto delle prime due — e ho scelto di fidarmi della maggioranza invece di inseguire l'anomalia. Tre misure su quattro concordano; la quarta resta senza spiegazione, e ci resta.

---

Il file di test che #38 doveva produrre finisce rosso, e lo dice di sé stesso nel proprio commento: non è lasciato rosso per errore, il rosso è il verdetto. In un progetto dove ogni altro gate lungo resta verde per definizione — conservazione, determinismo — questo è il primo che ha il permesso esplicito di fallire e restare così, perché fallire è esattamente cosa doveva scoprire.

---

Guardando l'acquario dal vivo si vede la stessa cosa che le quindici run avevano già misurato: i corpi si rimpiccioliscono e a un certo punto, tutti insieme, si estinguono. Ma vederlo girare aggiunge una domanda che un numero da solo non fa venire in mente: perché proprio il piccolo, e perché li uccide?

La risposta non è mancanza di luce o di CO₂. È che il costo per riprodursi scala con l'area, quindi un corpo piccolo arriva alla soglia di mitosi con molto meno tempo — e il moto browniano, che va come `1/r`, porta un corpo piccolo fuori dalla luce molto più in fretta di uno grande. `tenancy` misura esattamente questo rapporto, ed è sotto soglia: quasi nessuno resta in luce abbastanza per completare un ciclo riproduttivo intero, a meno di essere abbastanza piccolo da farlo in fretta. La popolazione non sta selezionando chi guadagna di più, sta selezionando chi fa in tempo — ed è una pressione che scavalca il pavimento che il costo fisso d'esistenza avrebbe dovuto garantire, perché quel pavimento protegge da "diventare piccoli non conviene", non da "diventare piccoli funziona per un motivo completamente diverso".

Non muoiono perché è mancata la luce. Muoiono perché sono diventati troppo piccoli per usarla.

---

La prima reazione, guardando la deriva verso il piccolo, è stata proporre una cura geometrica: allargare la zona di luce. Funzionerebbe pure — più spazio in verticale nella luce vuol dire più tempo prima che il moto browniano porti un corpo fuori, cioè esattamente quello che manca a `tenancy`. Ma `LIGHT_ATTENUATION_K` è recintata da un ADR precedente proprio per questo motivo: è la finestra dentro cui si misura α, e allargarla vuol dire rimisurare α, e quindi risolvere di nuovo `EXISTENCE_COST`, e quindi ricominciare la catena di calibrazione da un pezzo più a monte. Non è una costante qualunque, è la definizione stessa dello strumento di misura.

La cura più ovvia era fuori dal recinto che il progetto si era già dato.

---

> fotico è proprio brutto come termine

Detto en passant, dentro una domanda di design, come se fosse un dettaglio. Non lo è: "banda fotica" è nel glossario di `CONTEXT.md`, in quattro ADR, nell'HUD. Rinominarlo oggi vorrebbe dire riscrivere lo stesso vocabolario che il progetto ha appena finito di stabilizzare — non una parola sbagliata, una parola arrivata prima che qualcuno si fermasse ad ascoltarla ad alta voce.

---

> corsa al piccolo

La parola che chiude il capitolo, ed è quasi un'eco: `vision.md` ne aveva già scritta una versione, in inglese, mesi prima che succedesse davvero — "a race to zero: without a flat cost, smaller is always fitter without bound." Il progetto si era già premunito contro esattamente questa corsa, con quel nome preciso, e ci aveva messo un pavimento apposta.

Il pavimento ha retto contro il pericolo che il testo immaginava — un corpo piccolo che guadagna di più in proporzione — e ha ceduto a un altro, da una porta che il testo non stava guardando: un corpo piccolo che non guadagna di più, ma fa in tempo. La corsa al piccolo è successa lo stesso.
