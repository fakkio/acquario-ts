# M1: corpi e movimento

La regola che ha salvato il codice l'ha scritta l'AI, e io non me la ricordavo.

Sta in `CONTEXT.md`, sotto la voce **Tick**: _Avoid: frame, step (reserve
"step" for the manual single-tick control), update_. L'ho approvata mesi fa
in una sessione di domain modeling e poi l'ho dimenticata. Quando l'ho
approvata pensavo a un documento di design, non a un vincolo.

Poi è successo questo, in fila. L'agente che ha spacchettato M1 in ticket ha
intitolato il #8 "Per-tick **step** and the three-phase pipeline skeleton",
usando la parola vietata esattamente nel significato vietato, e `CONTEXT.md`
ce l'aveva nel repo. L'agente che ha implementato il ticket ha letto il
ticket e ha chiamato la funzione `stepOnce`, senza aprire il glossario.
L'agente della review ha aperto il glossario, ha trovato la riga, e ha
notato che `renderLoop.step()` esisteva già davvero e occupava quel
significato. È diventata `runTick`.

Tre agenti: due hanno propagato l'errore, il terzo l'ha fermato. Io in
quella catena non c'ero.

---

Non mi dà fastidio che la regola non sia mia. L'ho approvata perché ha senso.

Mi dà fastidio _quando_ è stata usata. Il glossario va tenuto presente
durante l'implementazione, non solo durante la revisione. Non perché la
review non debba beccarlo, è lì per quello. Ma se il glossario lo apri solo
alla fine, la review smette di essere una rete di sicurezza e diventa il
primo momento in cui qualcuno legge le regole del progetto.

---

L'agente mi ha chiesto di inventare un nome per la categoria di regole che
non hanno un motore: quelle che nessun tool può verificare, che nessuno
ricorda, e che si applicano solo se per caso qualcuno apre il file giusto al
momento giusto. Ci girava intorno con "memoria esterna", "regola orfana".

Si chiamano convenzioni. La parola esiste già.

Quello che cambia non è il nome, è quanta forza hanno. In un gruppo di
persone una convenzione sta in piedi perché qualcuno se la ricorda, e in
review dice "no, quello lo chiamiamo tick". Qui non se la ricorda nessuno:
io no, e gli agenti nascono, leggono quello che gli viene detto di leggere,
e muoiono. Stessa parola di prima, molta meno forza.

---

Perché l'agente che implementava non ha visto la regola? O non ha letto
`CONTEXT.md`, oppure l'ha letto e la regola è finita fuori dall'attenzione.
Un agente ricorda bene l'inizio e la fine della sua context window; la parte
in mezzo ogni tanto esce dal fuoco, come succede agli umani.

E la review sta lì apposta per questo: per prendere le cose sfuggite durante
l'implementazione. Parte con una context window pulita.

Quindi la storia dei tre agenti non è quella che sembrava. Il terzo non ha
fermato l'errore perché fosse più bravo o più attento degli altri due. L'ha
fermato perché era appena nato.

---

Le tre funzioni di fase, `readPhase` / `resolvePhase` / `commitPhase`: il
ticket le chiedeva, l'agente ha deciso da solo di non scriverle. Ha lasciato
le fasi come blocchi di commento dentro un'unica `runTick`, perché oggi non
avrebbero niente da ricevere e niente da restituire, e il vincolo vero di
ADR-0006, che resolve non scrive sul mondo, vive nelle firme: con firme
vuote non lo esprimi da nessuna parte.

Avrei dovuto decidere io. Ma visto che le tre funzioni adesso sono
effettivamente inutili, gli avrei dato ragione.

Le due cose stanno insieme e non si annullano: la decisione era mia, l'ha
presa lui senza chiedere, e la risposta era quella giusta. Le scriverà
quando avranno qualcosa da fare.

---

A M0 avevo scritto che non si può dare per scontato che due seed uguali
producano davvero due mondi uguali solo perché il test passa oggi. Al primo
ticket di M1 è successo alla lettera: il criterio di accettazione che deve
garantire "non hai cambiato niente" è un test che non può fallire. `hashState`
impasta solo `seed | tick | globalRng.state`, quindi l'uguaglianza vale per
qualunque `runTick` che incrementi il contatore, e varrebbe anche se
l'accumulatore divergesse, perché nell'hash non c'è.

Quella frase a M0 la pensavo davvero, ma non era una profezia: sapevo già
che finché il mondo è vuoto non c'era granché da testare.

Un test sempre verde non ha senso di esistere. Questo lo è perché il mondo è
ancora troppo semplice, non perché sia scritto male.

---

Da riprendere: `accumulatorMs` deve entrare in `hashState`?

È stato del mondo, ed è l'unico pezzo che due mondi possono avere diverso
risultando uguali all'hash. Ma se due run hanno tickettato in modo diverso
per via dei ritardi del browser, non so se riusciremo a farli tornare
identici comunque. Non ho ancora una risposta.

---

_Ragionamento dell'agente, decisione mia: tenerlo._

Se un test sempre verde non ha senso di esistere, la conseguenza coerente
sarebbe cancellare quel test e riscriverlo in #9, quando morde. L'abbiamo
tenuto.

Un test prematuro e una convenzione non letta sembrano la stessa cosa: una
regola scritta che oggi non produce nessun effetto. Non lo sono. Il test si
accende da solo. Nessuno deve ricordarsi di niente: arriva #9, le posizioni
degli organismi entrano in `hashState`, e da quel momento controlla davvero.
La convenzione su `step`, per accendersi, aveva bisogno che qualcuno aprisse
il file giusto al momento giusto, e infatti non si è accesa.

Cancellare il test lo sposterebbe dalla prima categoria alla seconda: da cosa
che si accende da sola a cosa che qualcuno si deve ricordare di riscrivere.

---

Poi ci abbiamo ragionato, e la risposta era l'opposto di come avevo
impostato la domanda. `accumulatorMs` non deve entrare nell'hash, e non per
pigrizia: metterlo dentro **romperebbe** l'invariante di determinismo invece
di rafforzarla.

L'accumulatore è il confine fra tempo reale e tempo simulato. Da un lato
entra il jitter dei frame, dall'altro escono tick tutti identici da
`FIXED_DT_MS`. Assorbire quello spezzettamento, così che la simulazione non
lo veda mai, è tutto il suo lavoro. Il resto che si porta dietro è quindi
l'unico pezzo di stato che è funzione di come il browser ha tagliato il
tempo, e non della simulazione.

Se lo hashi, due run dallo stesso seed, una a 60fps regolari e una con
qualche frame lungo, arrivano al tick 100 con la stessa identica simulazione
e due resti diversi in pancia. Hash diversi. Il test fallirebbe su due run
deterministiche nel modo più pieno possibile. Staresti hashando il ritmo del
browser insieme allo stato del mondo.

La formulazione onesta dell'invariante non è quella che avevo in testa:

> Stesso seed e stesso numero di tick ⇒ stesso hash. Non "stesso seed e
> stesso tempo di orologio trascorso".

E la mia preoccupazione, "non so se riusciremo a farli uguali uguali", era
mal posta: lo sono già, a parità di tick, garantito dal passo fisso. Quello
che il ritardo del browser cambia non è cosa calcola il tick 100, è quando
ci arrivi. Con il cap di catch-up che butta via il tempo in eccesso, due run
che hanno stallato in modo diverso si trovano a numeri di tick diversi. Ma
quella è divergenza su quanto lontano è arrivata la simulazione, mai su cosa
ha calcolato.

Il perché adesso è scritto su `hashState`. Era una domanda che mi sono fatto
guardando il codice, e nel codice non c'era la risposta.

---

Avevo scritto che il test sempre verde si sarebbe acceso in #9. L'agente che
ha implementato #9 mi ha fatto notare che non è successo: le posizioni sono
entrate in `hashState` esattamente lì, come previsto, ma il test è rimasto
verde. Finché niente muove i corpi, la popolazione al tick 7 è identica
comunque tu ci arrivi, con una `advance` sola o con sette.

Ho sbagliato il ticket, non l'argomento. Si accende in #10, quando i corpi si
muovono. E che sia #9 o #10 non cambia la sostanza: nessuno deve ricordarsi
di riscriverlo, e il movimento non è un ticket che si può saltare — è il
motivo per cui il milestone si chiama "corpi e movimento".

---

`getPopulation` poteva essere una riga sola: restituisce `readonly
Organism[]`. Compila, e a leggerla sembra una cosa chiusa a chiave.

Non protegge niente. Quel `readonly` congela l'array, non gli organismi
dentro, che restano oggetti mutabili con `x` e `y` pubblici. Il layer di
rendering potrebbe spostare tutti i corpi dell'acquario dentro la funzione
di disegno, e il compilatore non fiata.

L'agente ha deciso da solo di non scriverla così: un tipo a parte,
`OrganismView`, quattro campi in sola lettura, e `getPopulation` restituisce
quello. Il render legge un corpo e non può muoverlo.

Il prezzo l'ha trovato dopo, implementando. Un criterio di accettazione di #9
dice che `hashState` deve cambiare se cambia la posizione, il raggio o lo
stream di un organismo. Con l'accessor davvero in sola lettura quel criterio
non è più testabile dove è scritto: nessun test fuori dal modulo può spostare
un corpo. Il test è sceso su `foldPopulation`. Il criterio nomina la porta
pubblica, il test sta dentro casa.

Gliel'ho ratificato dopo. È il come di esecuzione, quello che gli lascio.

---

L'agente ha scelto la variazione dei raggi di generazione 0 senza pensarci:
da 0.6 a 1.6 volte il raggio baseline. Media 1.1. Nessun test rosso, niente
si rompe, la simulazione gira identica.

Solo che `BASELINE_BODY_RADIUS` non è un numero qualsiasi, è l'unità di
lunghezza. Il metodo di calibrazione dice di fissare l'unità al raggio
baseline e di scrivere tutto il resto in quella: le dimensioni
dell'acquario, `r_opt`, `c₀`. Con quello spread il corpo mediano della
popolazione è 1.1 unità, e l'unità con cui misuri il mondo è più piccola
dell'organismo tipico che dovrebbe descrivere. Non si rompe niente: è
l'unità che smette lentamente di voler dire quello che dice.

L'ha beccata l'agente della review sulla spec, leggendo una preposizione. Il
ticket dice: `bodyRadius` varied **around** the baseline. La regola stava
lì. Non in un test, non in un tipo, non nel lint: in una parola inglese
dentro il testo di un ticket.

---

Corretto lo spread, l'agente aveva aggiunto anche un test: la somma dei due
fattori deve fare 2, cioè il baseline deve restare al centro. Un test su due
costanti, che non esercita niente e non può accendersi da solo. Me l'ha
chiesto, e l'ho buttato.

Non perché sia tautologico. Perché quelle due costanti servono solo adesso,
per avere un po' di variabilità da guardare: poi sarà tutto evolutivo, la
variazione la faranno ereditarietà e mutazione, e lo spread di generazione 0
diventerà irrilevante.

La domanda giusta su un test non è solo cosa verifica. È quanto dura la cosa
che sta verificando. Quello spread è un'impalcatura, sta in piedi al posto
della mutazione finché la mutazione non esiste. Un test su un'impalcatura non
è un test interessante.

---

Il centraggio della vasca non l'aveva chiesto nessuno. Il ticket voleva solo
che il bordo dell'acquario fosse visibile: l'agente ha fatto girare l'app, ha
deciso che la vasca appiccicata nell'angolo in alto a sinistra era brutta, e
ha aggiunto `frameAquarium` cambiando la firma di `mountCamera`, che è roba
di M0.

L'agente della review gliel'ha segnata come scope creep. E insieme ha trovato
che il centraggio si scentra al resize, perché `mountCanvas` riassegna
`canvas.width` — e assegnare `canvas.width` azzera il bitmap del canvas — e
poi non ridisegna nessuno.

Quel difetto è di M0 ed è lì dal primo giorno: in tutta la storia del repo,
`resize` compare in `src/` in due commit soltanto, lo scheletro iniziale e
questo. È un difetto di M0 che abbiamo infilato dentro un ticket che parlava
d'altro.

Io nel testing manuale non me n'ero mai accorto, e la prima spiegazione è che
il guasto quasi non aveva superficie: mentre la simulazione gira viene
riparato al frame successivo, e da fermo si auto-guarisce al primo pan o
zoom, perché ogni gesto della camera ridisegna. Restava una finestra stretta,
ridimensionare da fermo e non toccare più niente.

Ma la ragione vera è un'altra. A M0 lo schermo era un riempimento quasi nero
e una griglia bianca all'otto per cento di opacità: un canvas vuoto, contro
quella roba lì, è una differenza che devi andare a cercare. Adesso ci sono
una vasca bordata di ciano e quaranta cerchi saturi, e lo stesso identico
guasto è impossibile non vederlo.

Il bug non è cambiato. È cambiato quanto c'era da perdere.

---

L'agente ha fatto notare che la storia del resize ha la stessa forma del test
sempre verde. Il test non poteva fallire finché non c'era niente da muovere.
Il bug non si poteva vedere finché non c'era niente da cancellare. In nessuno
dei due casi è cambiato il codice: è cambiato che il mondo si è riempito
abbastanza da rendere osservabile una cosa che c'era già.

Per me non è un'analogia fra due episodi. È la ragione per cui un acquario
vuoto era un posto rischioso dove chiudere un milestone.

M0 ha consegnato tutto quello che doveva consegnare e ha passato tutti i suoi
test. Non aveva abbastanza mondo dentro per far vedere cosa non funzionava.

---

È successo di nuovo, nello stesso milestone.

`CONTEXT.md`, voce **Brownian Motion**: _Avoid: drift, jitter, wander, random
walk_. L'agente che ha implementato il #10 le ha usate tutte e quattro. Una
funzione `drift`, due test intitolati "wanders" e "drifting", i commenti pieni
di "jitter" e "random walk". Nel ticket che si chiama _Brownian motion_.
Quattro su quattro. La review ha aperto il glossario e le ha segnate tutte,
esattamente come per `step`.

La differenza è che stavolta la storia era già scritta. L'avevo messa io in
questo file, quaranta righe più su, in italiano, dentro il repo: _il glossario
va tenuto presente durante l'implementazione, non solo durante la revisione_.
Non ha cambiato niente.

---

Quindi cambio idea rispetto a quelle quaranta righe più su. La review è il
posto giusto per quel controllo.

Non è una resa. È che quella verifica non si fa scrivendo, si fa rileggendo.
Un agente che sta scrivendo una funzione di venti righe non può tenersi in
testa quaranta voci di glossario con le loro liste `_Avoid_` mentre decide come
chiamare una variabile locale. Non è distrazione, è il momento sbagliato.

La review non è la rete di sicurezza che scatta quando il processo fallisce. È
il posto dove quel controllo va fatto, e pretenderlo dall'implementazione
significa pretendere la cosa giusta dal momento sbagliato.

---

L'agente mi ha fatto notare che così ho solo spostato il problema. "Alla fine
lancia la code-review" sta scritta in `.claude/skills/implement`, e sono tre
righe di markdown senza nessun hook che le imponga. Ho spostato il controllo da
una convenzione che non si è accesa a un'altra convenzione. Tartarughe. Poi ha
proposto di spostare le liste `_Avoid_` dentro la skill di review.

No. Gli `_Avoid_` stanno bene in `CONTEXT.md`.

`/implement` contiene la code-review, ed è lì che deve stare. E sì, una skill
eseguita da un agente non è deterministica. Ma qui si parla di qualità del
codice: se la review si perde un nome che non segue le convenzioni, non è una
cosa grave. L'importante è che il software faccia quello che deve, e quello lo
verificano i test deterministici, type, unit, integration ed e2e.

La domanda giusta su un controllo non è se può sbagliare. È quanto costa
quando sbaglia.

---

E allora rileggo l'apertura di questo file e l'allarme era troppo alto.

La storia di `step` l'avevo scritta con inquietudine vera, tre agenti e io
fuori dalla catena. Per il criterio che ho stabilito dopo è quasi un
non-evento: un nome, beccato dalla review, con i test verdi tutto il tempo.

La verità sta sempre nel mezzo, in ogni caso. Un nome sbagliato non è un
fallimento importante. Però è comunque preferibile che l'agente trovi al più
presto queste incongruenze, in modo che in futuro non si creino
fraintendimenti. Il costo non è il nome di oggi. È che il codice e il glossario
finiscano a dire due cose diverse, e che qualcuno più avanti legga i due e
capisca due cose diverse.

---

_Scritto dall'agente, bocciato dalla sua stessa review, ribaltato da me._

Per dare una direzione a caso a ogni corpo, l'agente aveva pescato un angolo e
ne aveva preso seno e coseno. La review gliel'ha bocciato: seno e coseno non
sono identici all'ultima cifra fra engine diversi, e ADR-0007, sotto
Consequences, si era annotata che il loop interno di v0.1 usa solo aritmetica,
quindi per avere un giorno il determinismo bit a bit basterebbe congelare una
tabella invece di rivedere ogni formula. Non una regola. Una proprietà arrivata
gratis, e annotata.

L'agente ha riscritto la direzione con un rejection sampling: peschi due numeri,
se il punto cade fuori dal cerchio lo butti e ripeschi. Circa uno su cinque nel
cestino.

Non sono d'accordo. Buttare un numero su cinque, in un ambiente TypeScript che
già non è performante, non mi piace. È vero che adesso l'efficienza non è
prioritaria, però teniamola sott'occhio.

Si torna a seno e coseno. La regola è quella scritta: run uguali sono uguali
sullo stesso engine. Se cambia l'engine cambia il mondo, e ce lo facciamo
andare bene.

---

Prima del revert ho chiesto il numero. Meno male.

Dieci milioni di chiamate, cinque round, ordine alternato. Seno e coseno: 65 ns
a chiamata. Rejection sampling: 40,6 ns. Il metodo che butta un draw su cinque
costa 0,62 di quello che non ne butta nessuno, cioè è il 38% più veloce. Le due
distribuzioni non si toccano nemmeno: il caso peggiore del rejection è più
rapido del caso migliore della trigonometria.

A dirlo dopo è ovvio. Quello che butti è la roba a buon mercato: uno scarto
sono due draw di mulberry32, una manciata di operazioni su interi. Quello che
eviti sono due funzioni trascendenti, che V8 calcola in software. Ne butti una
su cinque e ti conviene lo stesso.

"Buttare un numero su cinque" suona come uno spreco, e io l'ho letto come uno
spreco. Spreco di cosa, non me l'ero chiesto.

Teniamo il rejection sampling. E siccome resta, la frase di ADR-0007 continua a
essere vera: nessun documento da correggere, e la porta che l'ADR aveva lasciato
aperta resta aperta senza che nessuno debba difenderla.

---

Nota a margine con i numeri veri: con quaranta organism, il moto browniano di
un tick costa lo 0,02% di un frame con la trigonometria e lo 0,01% con il
rejection. La differenza per cui ho aperto la discussione inizia a contare
intorno ai diecimila organism.

---

_Analisi dell'agente, verdetto mio._

Terzo test che non può fallire in tre ticket, e stavolta di una specie diversa.

Il test sulla lunghezza del passo calcolava il valore atteso con la stessa
formula dell'implementazione, `forza / (attrito · raggio)`, riscritta dentro il
test. Se la formula nel codice fosse stata sbagliata, il test l'avrebbe
ricopiata sbagliata e sarebbe passato contento. L'ha beccato la review.

Gli altri due non potevano fallire perché il mondo era troppo semplice, e si
sarebbero accesi da soli appena il mondo si riempiva. Questo non si sarebbe
acceso mai: chiedeva al codice di controllare sé stesso.

Adesso il test asserisce un numero scritto a mano, `0.1061032953945969`. E fa
una cosa strana. Se qualcuno ritocca la costante della forza browniana, il test
si rompe apposta, anche quando il codice è giusto. Si rompe per obbligare
qualcuno a rifare la valutazione che quella costante richiede: far girare
l'app e decidere se il movimento sembra microscopia o sembra un formicolio. Un
criterio che nessuna macchina può verificare.

Quel test non verifica che la costante sia giusta. Verifica che nessuno la
cambi senza guardare lo schermo.

Io di test non me ne intendo molto. Mi sembra un test onesto.

---

_Filo aperto, segnato dall'agente, senza risposta mia: da riprendere quando si
scrive l'articolo._

In questo milestone ci sono due regimi. Dove esiste un numero, Fabio chiede la
misura e accetta che lo smentisca: è successo sul rejection sampling, dove
l'istinto puntava dalla parte sbagliata e la misura ha deciso. Dove il numero
non esiste, e sui nomi non esiste, resta una convenzione che lui stesso ha
appena ammesso non essersi accesa.

Non è un'incoerenza. È che uno dei due ha uno strumento e l'altro no. Ma forse
spiega perché la faccenda dei nomi gli dà fastidio senza che riesca a dire bene
cosa pretendere.

---

_Evento: scelta dell'agente, presa senza chiedere. Regola: mia._

Il ticket #11 dice che la query restituisce i candidati «nelle celle che il
cerchio tocca». Preso alla lettera è un bug. Gli organism finiscono nel bucket
del loro centro, quindi un corpo con il centro una cella più in là tocca
comunque il cerchio, e leggere solo le celle coperte lo perde. Lo perde
raramente: proprio nelle coppie quasi a contatto, che sono l'unica ragione per
cui le collisioni esistono.

L'agente se n'è accorto e ha implementato la cosa giusta invece di quella
scritta. Non me l'ha chiesto.

E i test deterministici lì non ti salvano. Se implementi il ticket alla lettera
e poi scrivi il test leggendo lo stesso ticket, i due sono d'accordo fra loro e
il verde è pieno.

La regola, da adesso, ha due rami.

Se il ticket è **sbagliato**, si viene da me prima. Si fa brainstorming, si
sbroglia la matassa insieme, e poi decido io. In ogni caso.

Se il ticket è **giusto** e l'agente crede di avere una strada migliore, fa bene
a provare la sua. Il cancello arriva dopo, ed è doppio: i test automatici e il
mio QA manuale.

Quello che divide i due rami non sono i gusti. È se il mio cancello finale può
vedere l'errore oppure no. Sulla query non lo vede, e sta scritto qui sopra:
ticket alla lettera più test scritto leggendo lo stesso ticket fa verde pieno
con il bug dentro. Un cancello che non può vedere l'errore non è un cancello,
quindi quella decisione deve arrivarmi prima.

L'altro ramo sta nello stesso ticket. La griglia costruita fuori dal tick,
contro quello che il ticket dice, perché il consumatore arriva solo con #12. Lì
il cancello tiene: due criteri di accettazione di #11 restano aperti, si vedono,
e li chiude #12.

---

_Domanda mia, verifica dell'agente._

«Ma il TDD non dovrebbe già farlo? Prima scrivi il test rosso, poi lo fai
diventare verde con l'implementazione.»

Sì. E infatti è andata così, il rosso c'è stato. Solo che il rosso è stato
questo:

    Error: Cannot find module './grid'
    src/world/grid.test.ts (0 test)

Zero test eseguiti. Il file non si caricava proprio, perché il modulo che
importava non esisteva ancora. Tutti e venti i test erano rossi insieme, per la
stessa ragione, e quella ragione non c'entrava niente con quello che ognuno di
loro andava a controllare.

Il rosso del TDD dimostra che il test fallisce quando il codice **non c'è**. Non
dimostra che fallisce quando il codice **c'è ed è sbagliato**. Sono due cose
diverse, e in mezzo ci sta tutto lo spazio dove vive un test inutile.

Quello che poi si è rivelato buono a niente confrontava due griglie e chiedeva
che avessero la stessa dimensione di cella. Sarebbe passato anche contro una
funzione che restituisce due costanti e basta. Non ha mai avuto un rosso vero:
ha avuto solo quello dell'import.

---

_Decisione mia._

Quando la review boccia un test dicendo che non può fallire, quel verdetto non
basta da solo. Si prova rompendo il codice. In questo modo siamo sicuri.

`/implement` però non lo tocco. È una skill rodata, l'ha scritta Matt Pocock,
resta com'è.

---

_Filo aperto, sollevato dall'agente, rimandato da me._

La regola nuova, un test bocciato si prova rompendo il codice, non ha nessun
motore che la esegua. Sta a valle della review, la review vive dentro
`/implement`, e `/implement` ho appena deciso di non toccarlo.

È la stessa forma delle tartarughe di quaranta righe fa. Solo che lì l'oggetto
del controllo erano i nomi, e avevo chiuso dicendo che in fondo alla catena ci
sono comunque i test deterministici. Qui l'oggetto del controllo sono i test.

Non so ancora. Per ora lascio così.
