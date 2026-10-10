# M8: gravità e galleggiamento

La costante `g` non l'ho misurata né aggiustata a occhio: l'ho derivata. Un corpo di riferimento con un solo float di raggio `r_new` sale a velocità `g·r²/(6R)`, una camminata browniana con passo `s` ha diffusione `D = s²/4`, e il profilo di equilibrio ha altezza di scala `D/v`. Imponi che sia lo spessore della Bright Band e `g` esce in forma chiusa, circa 4.2. Una costante che si scrive sotto forma di dimostrazione invece che di numero trovato a tentativi.

---

Il primo ticket di M8 era l'unico senza blocchi, quindi la scelta del ticket l'ha fatta il grafo delle dipendenze. #77 → #78 → #79 → #80 → #81, più l'arco #78 → #80. Ho disegnato la mappa solo alla fine, ma la catena era già tutta nei campi "Blocked by".

---

Il controllo di `g` ha dato profondità media 9.83 contro 8.28 previsti, e Bright Band al 58.7% contro 69.4%. Non è `g` sbagliata: la previsione vale per corpi che non si toccano, e quaranta corpi di raggio 1 si ammucchiano contro la superficie e si spingono verso il basso a vicenda. La teoria era giusta per un mondo che non è il nostro. Con sei corpi e 400k tick sono sceso sotto la previsione (6.65), ma con molto rumore. Il numero è riportato, mai un cancello (ADR-0024).

---

Un fatto che mi ha fatto sorridere: il float è l'unico organello che sale sempre, e sale il doppio vicino al fondo. La spinta è `g·a·(1 + y/H)`: più sei in basso, più l'acqua è densa, più il float tira su. Un termostato fatto di fisica, senza nessun gene che lo sappia.

---

Il neurone è "senza peso" e il float pesa `−1`: ho dovuto togliere un booleano (`weightless`) e metterci una unione, `number | "weightless"`. Il booleano era stato scritto in M7 con un commento che diceva "letto solo quando esiste la gravità". Quando la gravità è arrivata, il commento era l'unico pezzo di M7 che sapeva già cosa sarebbe successo.

---

Per testare un tipo di densità `+3/2` serviva un tipo che non esiste nel roster. La spec voleva le dichiarazioni passate al passo di moto, ma il corpo derivato calcola i momenti una volta sola, alla costruzione. Ho spostato il punto di iniezione all'`Organism`: la deviazione più piccola che non rompe "derivato una volta".

---

- il rename `applyBrownianMotion` → `applyMotion`, dieci chiamate cambiate con un `sed`
- `*/` dentro un commento (`r_new ≈ r*/2`) che chiudeva il commento e ha rotto tutto il parsing di `constants.ts`
- la Resting Depth con il termine `P_y/A` che i test simmetrici non esercitano mai

---

Nessuna alternativa scartata per `g`: derivarla in forma chiusa era la scelta ovvia, non una decisione sofferta. Il punto è proprio questo, in un progetto dove quasi ogni costante è stata calibrata a posteriori, qui la fisica bastava a dirla prima.

---

Lo scarto tra profilo misurato e previsto era prevedibile, e lo era anche per Fabio: quaranta corpi che si ammucchiano contro la superficie non sono la camminata di un corpo solo. Nessuna sorpresa, quindi, solo un numero che conferma dove la teoria smette di valere. La parte utile è che il commento nel codice lo dice prima che qualcuno lo scambi per un `g` sbagliato.

---

Il `*/` dentro il commento di `constants.ts` Fabio non l'ha nemmeno visto: l'agente l'ha introdotto e l'ha risolto nello stesso giro, tra un typecheck rotto e il successivo. Il bug esiste solo nel log della sessione. Una parte del lavoro di M8 che il progetto non ricorderebbe mai, se nessuno lo scrivesse.

---

Fabio ha guardato il riepilogo e il diff, non la sessione. Il lavoro di un ticket arriva a lui in due pezzi: una storia raccontata dall'agente e il risultato nudo. Quello che sta in mezzo (i tentativi, gli errori corretti al volo) non lo vede nessuno dei due.

---

Il primo test del Body Axis non faceva girare niente. Un float esattamente sotto il centro è in equilibrio: il braccio è verticale, la coppia è zero, e il corpo resta lì per sempre, a testa in giù. Un equilibrio instabile, come una matita in piedi sulla punta. Per far partire il test ho dovuto inclinare il corpo di 0,5 radianti a mano. La fisica era giusta, era il mio fixture a essere troppo perfetto.

---

Il test "una copia in scala si raddrizza nello stesso numero di tick" non può essere esatto. Coppia e attrito rotazionale scalano entrambi come k³, quindi la velocità angolare non cambia, ma il termine `I_xy/H` scala come k⁴ e dipende dalla profondità. Nel test la differenza era di un tick su quarantasei, più del 2%. Ho messo "al più due tick" invece di allargare la percentuale: su numeri così piccoli la percentuale è solo rumore di arrotondamento.

---

La prova che il mondo a roster vuoto non cambia l'ho fatta a mano, in due mosse: tolto per un attimo l'asse dall'hash, il golden era ancora `93ab5e6b`; rimesso, è diventato `1f3f5bf3`. Eppure nel repo resta solo un commento che lo racconta, nessun test. Il revisore l'ha segnalato come il punto più debole del ticket, e ha ragione: la garanzia "un roster vuoto non cambia niente" è vera oggi perché l'ho controllata io, non perché qualcuno la ricontrolla.

---

Il segno della coppia l'ho deciso guardando lo schermo, non la formula. L'asse y va verso il basso, quindi `τ = x·f_y` positiva porta x verso y, che sullo schermo è un giro orario. Se la rotazione di render e quella della fisica avessero avuto versi opposti, i test sarebbero passati lo stesso e i float si sarebbero raddrizzati all'indietro, vistosamente, solo guardando l'app. Il verso giusto è un accordo tra due file che nessun test confronta.

---

- `ω = τ / 8πR³`: l'attrito rotazionale della sfera di Stokes, dove `6πR` è quello traslazionale
- rotazione con una piccola somma e una radice quadrata per rinormalizzare, nessun `sin` o `cos` nel tick
- l'asse `readonly` nella classe ma modificato sul posto, con il commento che lo dice
- il fold dell'asse in fondo alla stringa dell'hash, per non toccare il resto

---

Del ticket successivo non ho scelto niente: #77 era già committato e #78 era l'unico con tutti i blocchi sciolti. Anche questa volta il grafo ha deciso al posto mio.

---

Il piano di ADR-0008 diceva: se la folla rompe il tetto, `K` passate di separazione per tick, il più piccolo `K` che regge. L'ho letto come "ripeti la passata". Con una folla di 160 corpi, ognuno con un float di raggio 0,1, il peggior overlap era 0,746 contro un tetto di 0,5. Con `K` = 8 era 0,71, con `K` = 32 era 0,79. Otto volte più lavoro e nessun effetto, anzi un po' peggio.

---

Il colpevole era il muro. La superficie spinge la fila di sopra dentro la fila sotto, e il clamp, una volta sola a fine tick, rimetteva i corpi esattamente dove la separazione li aveva appena tolti. Più passate dopo la stessa ammaccatura non servono a niente, se l'ammaccatura la rifà il muro ogni tick.

---

La correzione non era "più passate" ma "una passata è separa, poi rimetti dentro". Con quella forma `K` = 2 dà 0,544, ancora sopra, e `K` = 3 regge. Tre, quindi, e il numero viene da una misura, non da una stima.

---

La riga di ADR-0008 che dice "un numero fisso di passate" aveva ragione sul meccanismo e torto sulla definizione di passata. Nessuno poteva saperlo prima di mettere sul muro una folla vera: la folla di M1 non toccava la superficie abbastanza a lungo da mostrarlo.

---

Il costo: la separazione ora gira tre volte per tick, e muove ogni mondo, anche quello a roster vuoto. Il golden è passato da `1f3f5bf3` a `fd8594ce`, e stavolta la prova che sia cambiato solo per questo è la storia del commit, non un esperimento a mano.

---

Tra i test tre copie a mano del passo 10 (separa, poi rimetti dentro) in `world.test.ts` hanno smesso di combaciare col mondo, e il fallimento l'ho letto come un `toEqual` con differenze alla quindicesima cifra. Non era un bug: la copia aveva una sola passata. Tre repliche dello stesso passo, ora una funzione sola, `resolveCollisions`.

---

Una svista mia, di quelle che il log della sessione conserva e il diff no: la prima sostituzione automatica con un'espressione regolare ha scritto un carattere di controllo al posto del nome della popolazione. `tsc` si è lamentato di "Invalid character" in tre punti, e l'ho aggiustato in un giro.

---

Il ticket l'ho scelto di nuovo senza scegliere: #77 era già nel codice, #80 anche, restava #81, il rapporto del float sul Reference World. Cinque semi, centomila tick, e la riga che mi interessava di più era l'ultima: l'asse medio dei portatori di float.

---

Previsione del ticket: i portatori stanno più in alto, la frazione resta vicino al livello della deriva. Tutte e due vere. Profondità media 5,3 contro 9,2, in ogni seme. Frazione dei float 6,1% ± 3,3%, quella dei neuroni 3,4% ± 4,5%: sotto il rumore, come avevo scritto che sarebbe stato.

---

Quello che non avevo previsto: i portatori non stanno dritti. L'angolo medio assoluto dell'asse va da 48° a 105° a seconda del seme, e il coseno medio sta vicino a zero. La gravitaxis passiva, che nei test unitari funziona (un corpo col float sotto il centro si gira finché il float gli sta sopra), nella popolazione vera non si vede.

---

Ipotesi, non misurata: il float di un figlio nasce con una posizione mutata, quindi "dritto" per il corpo non coincide con "asse a zero" nel mondo. L'asse che raddrizza il corpo è quello per cui il float sta sopra il centro, e quell'angolo cambia da un corpo all'altro. Misurare l'angolo dal verticale del mondo, come ho fatto, può essere la domanda sbagliata. Una misura più onesta sarebbe l'angolo tra il float e la verticale, non tra l'asse e il mondo.

---

Il peggior overlap, nel seme 10: 2,278. Il tetto del test sulla corsa viva è 2,0. Il rapporto non boccia niente (ADR-0024, lo strumento non fa da cancello), ma è il numero che avrei voluto vedere sotto il tetto senza guardarlo. La separazione a tre passate è stata tarata su una folla di 160 corpi con un float da 0,1; qui il picco viene da un seme vero, e la distanza tra le due cose non l'avevo misurata.

---

Il rapporto sul `g` dallo stesso comando: profondità media 9,65 contro 8,28 previsti, Bright Band 58% contro 69%. La previsione vale per corpi che non si toccano; quaranta corpi di raggio 1 si ammassano contro la superficie in due o tre file e si spingono giù a vicenda. Ho scritto la ragione nel commento prima di vedere il numero, e il numero è andato dalla parte che il commento diceva.

---

Ho misurato la domanda giusta: l'angolo della leva del float (il suo scostamento dal centro, girato dall'asse) dalla verticale verso l'alto. L'ipotesi regge. Nei semi 7, 9 e 11 il float sta a 4,8°, 0,25° e 7,4° da sopra il centro, coseno 0,97, 1,00 e 0,95. Il 105° del seme 9 e il 94° del seme 7, letti come "corpi rovesciati", erano corpi perfettamente dritti per la loro fisica. La gravitaxis passiva c'era, e la domanda di prima non poteva vederla.

---

Restano i semi 8 e 10, con leva a 33° e 62°. Non so ancora se sono corpi ancora in rotazione, float quasi sul centro (coppia piccola, raddrizzamento lento) o un ammasso contro la superficie che li tiene storti. Non l'ho misurato, e non lo scrivo come spiegazione.
