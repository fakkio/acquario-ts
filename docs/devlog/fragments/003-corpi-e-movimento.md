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

---

_Seconda versione della regola, un ticket dopo._

In #11 avevo scritto: «Se il ticket è sbagliato, si viene da me prima. Si fa
brainstorming, si sbroglia la matassa insieme, e poi decido io. In ogni caso.»

In #12, poche ore dopo: se riesci a risolvere da solo va benissimo, non serve
che vieni da me, e questo in entrambi i casi. Al limite vedrò alla fine, quando
faccio la code review, se quello che hai fatto sta insieme al come di progetto
che avevo in mente. Lì correggo, oppure mi faccio convincere, come è già
successo altre volte.

Quello che la versione nuova sorpassa non è un capriccio della vecchia. È un
argomento. La vecchia diceva che un cancello che non può vedere l'errore non è
un cancello, e portava l'esempio: ticket preso alla lettera, più test scritto
leggendo lo stesso ticket, fa verde pieno con il bug dentro. Quel caso non è
sparito. È solo passato sotto un cancello diverso.

---

_Il ticket ci aveva pensato, e aveva sbagliato lo stesso._

#12 non era un ticket sciatto. Il criterio diceva che con il moto spento la
penetrazione massima decresce a ogni tick, e il ticket sapeva già che una
versione ingenua di quella frase è falsa: c'era scritto che il moto browniano
rimette overlap dentro a ogni tick, e che proprio per questo il test va spezzato
in due.

Preoccupazione giusta, causa sbagliata. Il decremento monotono salta anche con
il moto spento, e per una ragione che con il moto non c'entra niente. Le
correzioni si accumulano in un buffer; un corpo dentro sei vicini riceve la
somma delle sei spinte; e la somma lo può portare più dentro un settimo che
stava solo sfiorando. Il buffer è la cosa che rende il risultato indipendente
dall'ordine di visita, ed è la stessa identica cosa che gli toglie la monotonia.

Il ticket aveva guardato nella direzione giusta e visto l'ostacolo sbagliato.

---

_Risposta di Fabio, che raddrizza la regola nuova._

«Di solito no, guardo il codice non il ticket.»

È la cosa che tiene in piedi la versione nuova. Se la review finale leggesse il
ticket sarebbe il terzo documento della stessa famiglia, e tre documenti che
discendono dalla stessa idea non si smentiscono a vicenda. Leggendo solo il
codice, Fabio è l'unico anello della catena che non ha il ticket in testa.

Il prezzo vale la pena scriverlo: così il ticket, una volta scritto, non lo
rilegge più nessuno. Viene controllato solo dall'atto di implementarlo.

---

_La linea, adesso che si vede._

Ci sono due modi in cui un ticket può essere sbagliato.

Il primo cade da solo. «La penetrazione massima decresce a ogni tick», messa
dentro un `expect`, diventa rossa contro codice giusto. Non serve nessuno che la
giudichi: serve solo qualcuno che provi a scriverla. La specifica si smentisce
da sé nel momento in cui qualcuno la esegue.

Il secondo va d'accordo con sé stesso. «I candidati nelle celle che il cerchio
tocca» è eseguibile, è coerente, e chiede la cosa sbagliata in un modo che il
computer può soddisfare senza protestare. Il test scritto leggendo quel ticket
non lo contraddice, perché non è un secondo testimone. È lo stesso testimone due
volte.

Il primo tipo lo becca chiunque implementi. Il secondo lo becca solo chi legge
il mondo invece del ticket.

---

_La parola._

**Testimoni non indipendenti.**

In tribunale due testimoni che si sono parlati prima di deporre contano come
uno. Non è che mentano. È che la loro concordanza non aggiunge niente, perché
hanno la stessa fonte.

L'agente che ha spacchettato M1 in ticket, l'agente che implementa, e i test che
quell'agente scrive leggendo il ticket: tre voci, una fonte sola, il
brainstorming da cui è uscito M1. Concordano sempre. La loro concordanza non
vale niente.

Le uniche cose che in tre ticket hanno davvero contraddetto qualcosa sono
testimoni indipendenti, e si contano:

- `stepOnce`, fermato dal glossario, che non discende dal ticket, aperto da un
  agente appena nato.
- La query di #11, fermata dal dominio, cioè da come funziona davvero il
  bucketing.
- Il criterio falso di #12, fermato dall'esecuzione, che non è un documento e
  non discende da niente.
- Il test che confrontava due griglie, fermato dalla mutazione, cioè rompendo il
  codice apposta.

Tutto il resto della catena si è limitato ad annuire.

E qui la regola nuova viene fuori meglio di come l'avevo pensata quando l'ho
scritta. Leggere il codice e non il ticket non è pigrizia procedurale. È
comprarsi l'indipendenza. È l'unica posizione da cui quello che dico conta
qualcosa.

---

_Il filo aperto di #11 si chiude, e non come me lo aspettavo._

Alla fine di #11 avevo scritto che la regola nuova, un test bocciato si prova
rompendo il codice, non aveva nessun motore che la eseguisse. «Non so ancora.
Per ora lascio così.»

In #12 è stata eseguita. Sette mutazioni prima del commit, ognuna con la suite
che diventa rossa. Nessuno l'ha chiesto: non stava in `CLAUDE.md`, non stava nel
ticket, e l'agente non l'ha presa dal fragment pile, che ha letto dopo.

L'ha presa dal messaggio di commit di #11. La prima cosa che fa in un ticket è
`git log`, e lì c'era scritto per esteso cosa era stato mutato e perché.

Il motore era la cronologia. La regola si è propagata per imitazione, non per
istruzione, e nessuno l'aveva progettata così.

Mi è stato proposto di promuoverla a sistema, di decidere che i messaggi di
commit raccontano il come e non solo il cosa. Ho detto di no. I commit vanno
bene come sono, si continua così.

Mi rendo conto di cosa sto dicendo. La convenzione che ha funzionato è quella
che nessuno ha scritto come convenzione. Quella su tick e step invece stava nel
file giusto, con tanto di lista di parole vietate, ed è passata sotto il naso di
due agenti su tre.

---

_Verdetto mio, chiesto dall'agente._

`vision.md` resta com'è. È il punto di partenza e la direzione verso cui
andiamo. Non è la specifica di quello che il codice fa adesso, e non va
inseguito ticket per ticket. Lo correggono gli ADR.

Quindi la riga 590, «no overlaps after resolution», resta lì falsa e va bene
così: dice cosa volevo, e ADR-0008 dice cosa è successo quando ho provato a
ottenerlo.

---

_Cambio idea, mezz'ora dopo._

Mi era stato proposto un rinvio: `vision.md` resta testuale e accanto alla frase
superata compare un puntatore all'ADR che l'ha affrontata. L'ho guardato e mi
sembra che complichi. Per trovare un'informazione tocca navigare due file.

Allora `vision.md` si modifica e basta. La versione originale non la perdo: sta
in git, che è esattamente il posto dove tenere le versioni vecchie di un file.

È la seconda volta in questa conversazione che la risposta era già in git e non
ci avevo pensato. La prima era la regola sulle mutazioni, che si è propagata da
sola perché stava scritta in un messaggio di commit. Nessuna delle due l'ho
progettata così.

---

_Il puntatore funzionava esattamente come è scritto._

Mezz'ora passata a chiedersi perché in tre ticket nessuno abbia aperto
`vision.md`. La risposta stava nella dicitura del puntatore, e me l'ha fatta
vedere `writing-for-agents`: un puntatore deve fare due lavori, dire cosa c'è
ed elencare i rami che devono farlo scattare.

`CLAUDE.md` non nomina `vision.md`. L'unico puntatore in catena è una riga di
`CONTEXT.md`: «The full design lives in `docs/vision.md`». Dice cosa c'è. Rami:
zero. Non esiste nessuna condizione sotto la quale un agente debba aprirlo.

Quindi non è stata distrazione, e non è stata una convenzione senza motore. È
stato un puntatore che ha fatto precisamente quello che c'era scritto di fare.
Gli agenti l'hanno aperto solo quando un ticket ne citava una riga, che è
l'unico ramo che qualcuno avesse mai indicato.

---

_Il documento aveva un mestiere, e l'ha già finito._

`vision.md` era un generatore. Da lì sono usciti i milestone della 0.1.0, e quel
lavoro è fatto.

Quello che resta non è un riferimento: sono due residui diversi che convivono
perché sono nati insieme. Cosa deve fare la v0.1, che è reference viva e che il
codice ogni tanto smentisce. E dove andiamo dopo, che non è falso, è non ancora.

E su quel secondo pezzo, messo con le spalle al muro, ho ammesso una cosa che
cambia la sua natura: la 0.2.0 non la pianificherò rileggendo quelle sezioni
come specifica. Rifarò un brainstorming, partendo da quegli appunti.

Duecento righe che stanno dentro un documento di design con l'autorità di un
documento di design, e che sono appunti di un brainstorming vecchio.

---

_La carotatura, e quanto era profonda._

Avevo chiesto quante altre righe di `vision.md` fossero false senza che lo
sapesse nessuno, e temevo che la risposta fosse "non si può sapere". Non lo è.
Gli ADR sono già l'indice di dove il documento è invecchiato, perché è
esattamente il mestiere che gli ho dato. Quattordici posti da controllare, non
seicento righe da rileggere.

Il passaggio ne ha trovate sei. Una la sapevo, la riga 590. Le altre cinque no.

La peggiore stava nella sezione sulla forma del corpo, dalla prima stesura: «un
corpo ha posizione, velocità, rotazione e velocità angolare». Sotto la fisica
sovrasmorzata non c'è nessuna velocità da portarsi da un tick all'altro, ed è
il punto centrale di ADR-0008, l'ADR che avevo scritto proprio per dire che il
modello a inerzia non era una semplificazione di quel mondo ma un mondo
diverso. Il documento continuava a descrivere il mondo che avevo scartato.

E la stessa frase compariva una seconda volta, dentro la pipeline del tick:
«brownian motion: integrate velocity and position».

Non è che la vision fosse scritta male. È che descriveva la versione precedente
di sé stessa in due punti che nessuno aveva più motivo di aprire.

---

_Una nota che mi toglie un po' di soddisfazione, e va tenuta._

Non è vero che l'ADR non era mai rientrato nella vision. La riga 232 dice che la
sublinearità resta in piedi e che l'incentivo alla specializzazione è una
domanda aperta, e rimanda a ADR-0014 per nome.

Quindi il flusso che oggi ho deciso di adottare era già successo una volta, da
solo, senza che io lo chiamassi flusso. Come le mutazioni propagate dal
messaggio di commit, e come git che teneva già le versioni vecchie della vision.

Tre volte in una sera che la cosa giusta era già lì e stavo per costruirci
sopra un meccanismo.

---

_Episodio dell'agente, con la figuraccia dentro._

Il tick ha iniziato a lavorare davvero, e un test scritto a M0 ha iniziato a
morire. `never lets a body cross the aquarium boundary, tick after tick`:
duemila tick per quaranta corpi per quattro `expect`, trecentoventimila
asserzioni, e quasi tutto il tempo passato dentro la libreria di asserzioni
invece che dentro la simulazione. Nessuno l'aveva toccato. Era stato scritto
quando un tick era gratis, e il suo costo se l'era portato dietro fino al
momento in cui il mondo sotto è cambiato.

Un test di solito te lo dice, quando invecchia: diventa rosso. Questo non è
diventato rosso. È diventato lento, che è l'unico modo di rompersi che non
sembra niente finché non sembra un test che ogni tanto fa i capricci.

L'agente che lo stava scrivendo l'ha visto fallire due volte e l'ha archiviato
come contesa di CPU, perché in quel momento aveva due review agent che giravano
in parallelo e quella spiegazione era disponibile, comoda e in parte anche vera.

L'ha ripreso il review agent, che quella spiegazione non ce l'aveva: isolato
gira in 3,9 secondi, il margine se l'è mangiato la separazione, quel timeout va
guardato adesso.

Terza volta in un milestone che a fermare un errore è chi arriva senza contesto,
e la prima in cui il distratto è l'agente che stava facendo il lavoro. Non è che
il testimone indipendente sia più sveglio. È che non ha a portata di mano la
spiegazione comoda.

---

_Il conto onesto, e due verdetti miei._

Quattro volte stasera ho sentito dire «qui manca un meccanismo», e quattro volte
il meccanismo c'era già. I messaggi di commit propagavano la regola sulle
mutazioni. Git teneva le versioni vecchie della vision. La riga 232 rimandava
già a un ADR. E per il test lento: vitest stampa la durata accanto al nome del
test, a ogni esecuzione. Nell'output c'era scritto `8851ms`. È stato letto e
scavalcato.

Il problema non è mai stato che mancasse lo strumento. È che nessuno leggeva la
deposizione.

Il timeout di quel test resta stretto. Non è un test di performance, ma è
l'unica cosa nel progetto che abbia un'opinione su quanto costa un tick, e da
M2 in avanti il tick costerà molto di più.

E sull'altra, che è la domanda vera: continuerò con le review. Non è una
disciplina da ricordarsi, è qualcuno che arriva senza contesto, e quello lo
posso comprare.

---

_Misura chiesta dall'agente su una sua stessa affermazione. Sbagliamo in due._

L'agente aveva notato che il soffitto della penetrazione, 0,24 raggi misurati su
tremila tick, vale più o meno due passi browniani, e ne aveva tirato fuori una
frase bella: la costante tarata a occhio nel ticket del moto produce due ticket
dopo un numero che si deriva sulla carta.

Ho detto che secondo me era solo una coincidenza. E che comunque quel numero non
l'avevo scelto io: l'ha tarato l'agente durante il ticket del moto, io l'ho
accettato.

Invece di darmi ragione ha scalato `BROWNIAN_FORCE` e ha rimisurato. Otto volte
la forza, undici volte il soffitto. Non è una coincidenza: il soffitto è
proporzionale al passo, e se qualcuno ritocca la forza si sposta con lei.

Però il coefficiente pulito non c'è. Non è due: vaga fra 1,5 e 2,5 a seconda di
quanto è affollata la vasca. E il passo che fa da limite non è quello baseline,
sono i corpi piccoli, che vanno come `1/r` e fanno 0,177 per tick invece di
0,106. Il conto «due per zero virgola dieci fa zero virgola ventuno» prendeva il
raggio sbagliato e arrivava vicino alla risposta giusta per la strada sbagliata.

Tre minuti di misura per stabilire che avevamo torto tutti e due, ognuno per
metà. È lo stesso regime del rejection sampling, applicato stavolta anche
all'agente che lo aveva invocato.

---

_Quello che la misura ha lasciato sul tavolo._

Il soffitto è proporzionale alla forza browniana, e la forza browniana è la
costante che si giudica guardando lo schermo. Quindi il test sulle collisioni ha
un piede dentro `motion.ts`: se qualcuno alza la forza, fallisce
`separation.test.ts`, per una ragione che sta in un altro file. A forza doppia e
duecento corpi il soffitto è già sfondato.

È la stessa forma del test che blocca a mano la lunghezza del passo. Nessuno dei
due verifica che la costante sia giusta. Verificano che nessuno la muova in
silenzio.

La differenza è che quello sul passo si rompe dove guardi, e questo si rompe una
stanza più in là. L'ho scritto nel commento, che è l'unico posto dove chi si
troverà il rosso davanti andrà davvero a leggere.

---

_Ultimo fragment, e casca a fagiolo perché è a spese dell'agente._

A milestone finito l'agente mi elenca cosa manca, e ci mette la release: la
0.2.0, dice, perché `docs/agents/release.md` dichiara che prima di 1.0 ogni
release è un minor bump, uno per milestone.

Gli ho detto che no, per M1 la release è la 0.0.3, e che la 0.2.0 è lontana.

Aveva citato il documento. Il documento sbaglia, e sbaglia da agosto: il tag è
`v0.0.2`, `package.json` dice `0.0.2`, e il CHANGELOG di quella riga scrive per
esteso «This closes M0 — Simulation skeleton». Un milestone è un patch. Il
documento arrivava perfino a dire che i patch release non erano ancora definiti,
mentre ne era già uscito uno.

Lo schema vero nessuno l'aveva scritto da nessuna parte, e sta in piedi da solo:
il patch conta i milestone, il minor conta le versioni della vision. La 0.1.0
esce quando chiude M5.

Quello che mi diverte è il tempismo. Abbiamo passato la sera a stabilire che il
segnale c'è quasi sempre e che il problema è che nessuno lo legge, l'agente
aveva appena scritto quella frase nel pile, e dieci minuti dopo ha citato un
documento invece di guardare `git tag`, che era a un comando di distanza e aveva
ragione.

Quinta volta in una sera. Stavolta è toccato a chi stava tenendo il conto.
