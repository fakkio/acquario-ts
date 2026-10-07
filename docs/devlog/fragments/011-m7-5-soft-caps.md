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

---

> scegli un ticket di 67 e implementalo

Seconda delega identica, e di nuovo un solo ticket libero: #73, perché #69 e #74 aspettano lui, e #70 e #71 aspettano quelli. Dei sette figli di #67 ne restava sbloccato uno.

---

L'ADR-0036 dice che il limite sull'area, `R_area_max`, è "in forma chiusa ed esatto": il citoplasma al suo passo più grande, più l'area degli organelli del genitore, più `M_max` volte il massimo che un evento può aggiungere. Non regge appena gli eventi si concatenano. Far crescere due volte lo stesso organello dà `π r² ((1+δ)⁴ − 1)`, cioè `4δ + 6δ² + …`, mentre due volte il massimo di un singolo passo dà `4δ + 2δ²`. Il termine che manca è piccolo, e ha un nome: ADR-0034 lo chiamava "slack", margine lasciato dagli operatori, e a `M_max = 1` non si vede mai.

---

Il soffitto è diventato una camminata: si provano tutte le sequenze di `M_max` eventi che il genitore e il roster permettono, tenendo traccia di area e reach, e si prende il massimo. Più larga della forma chiusa dell'ADR, ma è un vero limite superiore. A `M_max = 1` coincide con la forma chiusa, quindi il caso che gira nel mondo non cambia.

---

Per il test della sequenza avevo scritto una versione "esatta" dell'attesa, uguale al soffitto solo a `M_max = 1`, e quella a `M_max` qualunque è diventata una disuguaglianza. Un test che era un'uguaglianza solo perché la costante valeva 1.

---

Il test dell'ordine delle estrazioni (tipo, poi posizione) l'ho scritto rifacendo a mano le estrazioni dallo stesso seme: quattro dell'intestazione, le prove degli eventi, l'operatore, l'indice del tipo, poi il punto nel disco. Se qualcuno sposta l'estrazione del punto prima del tipo, cade.

---

Il Cerchio Racchiudente era 150 righe di Welzl, con tre casi di Apollonio per tre dischi tangenti. Non serviva più a niente e l'ho cancellato intero: il ticket diceva solo che "non è più il corpo", e il glossario dice "ritirato". Un pezzo di geometria esatta, scritto con cura, morto da un giorno all'altro.

---

Prettier lanciato su tutto `src` ha toccato anche file che non c'entravano (`death.ts`, `light.ts`, `rng.ts`, …): differenze solo di fine riga, nessuna di sostanza, viste solo perché `git status` le elencava. Le ho ripristinate prima del commit.

---

Il verdetto del primo commit è stato respinto dal pre-commit: `no-useless-assignment` su un ciclo `do … while` che assegnava `px` e `py` per poi leggerli solo nella condizione. Riscritto come funzione ricorsiva che restituisce il punto.

---

> scegli un ticket di 67 e implementalo

Terza delega identica. Questa volta i ticket liberi erano due, #69 e #74, perché #73 era chiuso e #74 aspettava solo lui. L'agente ha scelto #69 seguendo l'ordine che #67 stesso dichiara (strumento, tabella "prima", legge, schermo, tabella "dopo") e non per gusto. #74 è rimasto lì, libero.

---

"Il tappo ha fatto da limite" sembra una frase con un solo significato, e il ticket la usa senza definirla. L'agente ha dovuto scegliere cosa conta: la prima versione era "lo spazio rimasto nel tappo è il più piccolo di tutti i limiti della reazione". Una scelta di esecuzione, dentro un perimetro fissato dal ticket.

---

La prima definizione contava come "legato dal tappo" anche un organismo al buio, senza cibo, con la CO₂ sopra il tappo: lo spazio rimasto è negativo, quindi il più piccolo, e la reazione non sarebbe partita lo stesso. Non l'ha visto Fabio e non l'ha visto l'agente: l'ha visto il sotto-agente della revisione. Corretto con una condizione in più: contano solo i casi in cui gli altri limiti sono tutti positivi, cioè in cui la reazione sarebbe partita senza il tappo.

---

Lo stesso sotto-agente ha trovato un secondo difetto, più brutto perché silenzioso: le percentuali erano divise per la popolazione dopo morti e nascite, mentre i conteggi vengono dalla popolazione che ha reagito. I neonati gonfiavano il denominatore, i morti sparivano. La prima corsa lunga della tabella "prima", già finita e già in un file, andava buttata e rifatta da capo. Una misura corretta nei numeri e storta nel rapporto.

---

Un mio taglio su una riga di testo del report ha mangiato metà della frase ("respiration by CO₂," e poi niente). L'ho visto solo rileggendo l'output della corsa, non nel codice. Un commit a parte per rimettere una riga.

---

- il tappo della CO₂ lega circa il 10% degli organismi-tick su tutti e cinque i semi (9.5–11.5%), la previsione diceva almeno 20%
- l'O₂ lega tra 8.6% e 10.9% su quattro semi, la previsione diceva meno di 5%; il seme 7 legge 0.2%
- il cibo legge 0.0%, come previsto
- la concentrazione interna massima di CO₂ è 1.03–1.05, cioè quasi il valore di apertura dei fondatori (1.04): mai sopra di più

---

Il seme 7 è un'altra storia: popolazione finale 162 e Generazione media 48.7, contro 33–37 e 7–15 degli altri quattro. Il tappo dell'O₂ lo lega quasi mai. Nessuno, per ora, ha una spiegazione.

---

La banda scura, "prima": vuota, ogni raggio della scala muore, tra il tick 7 (r = 0.25) e il tick 198 (r = 8). La previsione 1 lo dava per scontato (REFUTED), e ha avuto ragione. È la parte della previsione che non ha bisogno di essere giudicata dopo.

---

> scegli un ticket di 67 e implementalo

Quarta delega identica. Questa volta #67 aveva già #69 chiuso, #73 chiuso, #74 libero e #70 sbloccato. L'agente ha scelto #70, la legge, e non #74, lo strumento: l'ordine dichiarato in #67 mette la legge prima. Di nuovo una scelta di ordine, non di gusto, e di nuovo dell'agente.

---

Il ticket diceva "i commenti sui tappi vanno riscritti secondo l'ADR-0035". L'agente ha cancellato la tabella `K_CAP` e ha riscritto i commenti vicini, ma i riferimenti a `K_CAP.food` e `K_CAP.carbonDioxide` dentro i commenti dei test sono rimasti. Non li ha visti l'agente: li ha elencati il sotto-agente della revisione, che li ha trovati con una grep. Nessun linter guarda i commenti.

---

La legge nuova sta in tre righe: la fotosintesi corre a `min(tasso, CO₂)`, la respirazione a `min(tasso, cibo, O₂, spazio per l'energia)`. Il resto del ticket, quasi tutto, è stato togliere: `capFor` è diventata `energyCap`, la fotosintesi non restituisce più niente, i conteggi di #69 sono spariti, la tabella `K_CAP` pure. Un ticket che aggiunge una riga di legge e ne cancella cento di scaffale.

---

Il primo `npm test` dopo la legge ha dato dieci rossi. Dieci rossi, tutti per la stessa ragione che nessuno aveva previsto: la previsione 6 del ticket diceva "meno nascite", non "la prima nascita al tick 6307 invece che al 125".

---

- seme 1, mondo con roster vuoto: prima nascita al tick 6307 (prima della legge: 125)
- seme 2: 7254. Seme 3: 9576
- prima morte tra 1405 e 1572 su tutti e tre, prima della legge al 43
- la ragione: ora la respirazione consuma il cibo al suo ritmo di azione di massa, e il cibo interno sta intorno a 0.4 per area, mentre il cancello della massa chiede quasi 1

---

Metà dei rossi non erano rossi veri. I test chiamavano `advance(world, 2000 * FIXED_DT_MS)` credendo di far girare 2000 tick, ma `advance` si ferma a 240 per chiamata (il tetto del recupero, `MAX_TICKS_PER_ADVANCE`). Per anni quei test hanno girato 240 tick e nessuno se n'è accorto, perché nel vecchio mondo la prima morte stava al tick 43 e 240 bastavano. Il mondo nuovo li ha scoperti.

---

Il test d'oro. Il ticket dice di rigistrarlo e di descriverlo come "la legge del mondo minimo e non più di M6". L'agente ha dovuto allungare la corsa da 2000 a 8000 tick, perché il test pretende una nascita e una morte dentro la finestra e la prima nascita ormai sta al 6307. Il vecchio valore, `d22057a8`, non tornerà mai più: è il primo hash d'oro che muore per una ragione di legge e non per un errore.

---

L'ordine con cui le cose si sono rivelate: prima l'energia (E% 0.99 già al tick 500), poi la mancanza di nascite, poi la `α` a zero. La `α` l'ha vista l'agente per ultima, cercando perché quattro test sulla `α` positiva non cadevano per caso: a un tick la respirazione riempie il serbatoio dell'energia da metà a pieno. Con la sonda: profondità 2 (luce piena) e profondità 38 (buio), `α` esattamente 0.00 a tutti i tick fino al 2000.

---

La `α` vale zero ovunque perché l'ADR-0015 esclude gli organismi frenati dal serbatoio pieno, e con la legge nuova lo sono tutti, sempre. È la trappola che il commento di `K_CAP_ENERGY` raccontava già: "un mondo sempre al tetto non ha nessun tick fuori dall'esclusione da misurare". Scritta per un'altra strada (alzare il cibo ambiente), tornata dalla porta dell'ADR-0035. Nessuno l'aveva messa in conto: né l'ADR, né la grill, né la previsione, che dava per scontato che `α_bright` si muovesse "di meno del 5%".

---

L'agente ha saltato quattro test sulla `α` (`it.skip`, con un commento che dice perché) invece di inventare una nuova definizione di `α`. Una scelta di perimetro, e dell'agente: cosa debba misurare la `α` dopo la legge è una decisione di progetto, quindi di Fabio, e nel ticket non c'è. Il sotto-agente della revisione ha notato che un `skip` senza ticket non lo segue nessuno.

---

Il verdetto della corsa lunga: la persistenza regge su tutti e cinque i semi, e la gate di #67 passa. Minimi 9–17, finali 20–74, nascite 79–153, Generazione media 3.95–6.10. Contro M7: Generazione media 7.3–48.7 e nascite 144–2077. Persistono tutti, ma il seme 7 non è più quel seme speciale (prima 2077 nascite, ora 137). La previsione 6, quella a bassa fiducia, era quella giusta da aspettarsi sbagliata: l'ha avuta giusta.

---

- `α_bright` nella corsa di `npm run caps`: 11.29 ± 0.21 (prima 8.165 ± 0.33), cioè +38%, non il "meno del 5%" della previsione 2
- `α` di popolazione: 5.585 ± 0.27 (prima 2.226): sale molto, come dice la previsione 3, ma contando solo i tick in cui qualcuno guadagna qualcosa
- picco di CO₂ interna 1.57–1.59 (prima 1.03–1.05), previsto "intorno a `C_ext` + 0.4": c'è
- la banda scura resta vuota, e muore quasi uguale: la previsione 1 ("CONFERMATA, con sopravvissuti su ogni gradino") non regge

---

Fabio ha chiesto, a lavoro finito: "è rimasta la velocità di diffusione massima proporzionale al perimetro vero?". Sì: `K_DIFFUSION × perimetro × gradiente`, il perimetro del corpo intero, mai toccato. Non è una domanda del ticket, e arriva proprio sul meccanismo che ora decide il sistema: lo sfiato scala col perimetro, la respirazione con l'area.
