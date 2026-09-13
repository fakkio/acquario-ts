---
title: "Un acquario troppo vuoto"
description: "Il milestone precedente aveva passato tutti i suoi test. Non aveva abbastanza mondo dentro per far vedere cosa non funzionava."
date: 2026-09-13
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - typescript
  - ai-agents
  - testing
  - code-review
lang: it
---

# Un acquario troppo vuoto

Il milestone precedente aveva consegnato tutto quello che doveva consegnare, e aveva passato tutti i suoi test.

Dentro c'era un test che non poteva fallire e un bug che nessuno poteva vedere. Il test chiedeva che due simulazioni partite dallo stesso seed restassero identiche, e non poteva fallire perché in quel mondo non si muoveva ancora niente. Il bug cancellava il disegno a ogni ridimensionamento della finestra, e non si poteva vedere perché su quello schermo non c'era ancora niente da cancellare: un fondo quasi nero e una griglia bianca all'otto per cento di opacità.

Nessuno dei due è cambiato quando è arrivato il milestone dopo. Il codice è rimasto identico. È cambiato che nella vasca sono comparsi quaranta cerchi saturi, ed è diventato impossibile non vederli.

Il milestone si chiama "corpi e movimento", e riempire la vasca non era un effetto collaterale: era il suo compito.

AcquarioTS è una simulazione di vita artificiale, un acquario in cui non esiste nessuna specie scritta a mano: c'è un organismo, c'è un genoma, e quello che deve emergere deve emergere da solo. Il mondo va avanti a tick, avanzamenti di durata fissa, uno dopo l'altro. Il codice lo scrive un agente, un ticket alla volta; io decido cosa si fa, e alla fine leggo quello che ha scritto.

I ticket di questo milestone sono cinque, e tre riempiono la vasca. Nel primo gli organismi prendono un corpo, cioè una posizione e un raggio. Nel secondo cominciano a muoversi di moto browniano, lo sballottamento casuale di una cosa troppo piccola per restare ferma. Nel terzo smettono di compenetrarsi: quando due corpi si sovrappongono, qualcosa li spinge finché non si sfiorano soltanto.

Alla fine del terzo, nella vasca ci sono quaranta cerchi che si muovono e si respingono. All'inizio del primo c'era una griglia.

## Quello che non si vedeva

Comincio dal test.

La simulazione deve essere deterministica, ed è [l'invariante che il milestone precedente esisteva per aggiungere](001-venticinque-anni-per-cancellare-una-sottoclasse.md): stesso seed, stesso mondo. Il seed è il numero da cui parte il generatore di numeri casuali, e siccome tutto il caso di questo mondo discende da lì, due run che partono dallo stesso seed devono calcolare esattamente le stesse cose, tick dopo tick. Per controllarlo c'è `hashState`, che prende lo stato del mondo e ne restituisce un'impronta. Due run, stesso tick, stessa impronta, e non è cambiato niente.

Il primo ticket del milestone aveva fra i criteri di accettazione proprio questo: il codice nuovo non deve cambiare il mondo esistente. Tradotto in test: fai girare la simulazione, prendi l'impronta, confrontala. Verde.

Solo che `hashState`, in quel momento, impastava tre cose: il seed, il numero di tick fatti, e lo stato del generatore di numeri casuali. Nient'altro, perché nel mondo non c'era nient'altro. Quel test non confrontava due mondi, confrontava due contatori. Sarebbe rimasto verde per qualunque versione del codice che incrementasse il tick, sbagliata in tutto il resto quanto volete. Il criterio di accettazione che dice "non hai rotto niente" era una domanda a cui non si poteva rispondere di no.

Alla fine del milestone precedente avevo lasciato scritta una riga proprio su questo: che il determinismo non è una cosa da dare per scontata solo perché il test passa oggi. Non era una profezia, era la constatazione ovvia che in un mondo vuoto non c'è granché da testare. Il ticket dopo l'ha presa alla lettera.

Un test che non può fallire non ha motivo di esistere, e la conseguenza coerente sarebbe cancellarlo e riscriverlo quando morde. L'abbiamo tenuto, e non per pigrizia. Quel test non è scritto male, è scritto in anticipo, e soprattutto si accende da solo: le posizioni degli organismi entrano in `hashState`, i corpi cominciano a muoversi, e da quel momento controlla davvero. Nessuno deve ricordarsi di niente.

Avevo previsto che si sarebbe acceso al secondo ticket, quello che mette le posizioni nell'impronta. Non è successo: finché niente muove i corpi, la popolazione al tick sette è identica comunque tu ci arrivi, con un avanzamento solo o con sette. Si è acceso al terzo, con il moto browniano. Avevo sbagliato il ticket, non l'argomento.

L'altro episodio è più difficile da raccontare, perché per un milestone intero non è stato niente.

Il ticket voleva solo che il bordo dell'acquario fosse visibile. L'agente ha fatto girare l'applicazione, ha deciso che la vasca appiccicata nell'angolo in alto a sinistra era brutta, e l'ha centrata: una cosa che nessuno gli aveva chiesto. L'agente della review, che è un secondo agente e apre il codice a cose fatte con la memoria vuota, gliel'ha segnata come scope creep. E nel guardare lì ha trovato dell'altro.

Il centraggio si scentrava al ridimensionamento della finestra. La ragione sta in una particolarità del canvas: assegnargli una larghezza ne azzera il contenuto, anche quando il numero che gli assegni è identico a quello di prima. Il codice del ridimensionamento riassegnava la larghezza, il disegno spariva, e nessuno lo rifaceva.

Non era un difetto di questo milestone. Era lì dal primo giorno: in tutta la storia del repository la parola `resize` compare nel codice sorgente in due commit soltanto, quello dello scheletro iniziale e questo.

Nel testing manuale non me n'ero mai accorto, e la prima spiegazione è che il guasto quasi non aveva superficie. Mentre la simulazione gira, il disegno viene rifatto al frame di rendering successivo e il guasto si ripara da solo. A simulazione ferma si guarisce al primo pan o al primo zoom, perché ogni gesto della camera ridisegna. Restava una finestra stretta: ridimensionare da fermo, e poi non toccare più niente.

Ma la ragione vera è un'altra. Nel milestone precedente lo schermo era un riempimento quasi nero e una griglia bianca all'otto per cento di opacità. Un canvas vuoto, contro quella roba lì, è una differenza che devi andare a cercare. Adesso ci sono una vasca bordata di ciano e quaranta cerchi saturi, e lo stesso identico guasto è impossibile non vederlo.

Il bug non è cambiato. È cambiato quanto c'era da perdere.

I due episodi hanno la stessa forma. Il test non poteva fallire finché non c'era niente da muovere. Il bug non si poteva vedere finché non c'era niente da cancellare. In nessuno dei due casi è cambiato il codice: è cambiato che il mondo si è riempito abbastanza da rendere osservabile una cosa che c'era già.

Per me non è un'analogia fra due episodi. È la ragione per cui un acquario vuoto era un posto rischioso dove chiudere un milestone. Quel milestone ha consegnato tutto quello che doveva consegnare e ha passato tutti i suoi test, e resta vero: semplicemente non aveva abbastanza mondo dentro per far vedere cosa non funzionava.

Una contromisura non ce l'ho. Quello che ho è la domanda dopo: adesso che la vasca è piena e le cose si vedono, chi le ha viste, e se è un caso che sia sempre lo stesso.

## Chi se n'è accorto

Nel glossario del progetto, alla voce Tick, c'è scritto questo:

> One fixed-length step of simulated time. Decoupled from rendering frames.
> _Avoid_: frame, step (reserve "step" for the manual single-tick control), update

Il glossario è un file nel repository, e ogni agente che lavora qui è tenuto a leggerlo. Quella riga l'ho approvata mesi fa, in una sessione di modellazione del dominio, e poi me la sono dimenticata. Quando l'ho approvata pensavo a un documento di design, non a un vincolo.

Poi è successo questo, in fila. L'agente che ha spacchettato il milestone in ticket ne ha intitolato uno "Per-tick step and the three-phase pipeline skeleton", usando la parola vietata esattamente nel significato vietato, con il glossario nel repository accanto a lui. L'agente che ha implementato quel ticket ha letto il ticket e ha chiamato la funzione `stepOnce`, senza aprire il glossario. L'agente della review ha aperto il glossario, ha trovato la riga, e ha notato anche che una funzione `step` esisteva già davvero, dentro il loop di rendering, e occupava quel significato: cioè esattamente il caso che la parentesi della regola tiene da parte. È diventata `runTick`.

Tre agenti. Due hanno propagato l'errore, il terzo l'ha fermato. Io in quella catena non c'ero.

Perché l'agente che implementava non ha visto la regola? O non ha letto il file, oppure l'ha letto e la regola gli è finita fuori dall'attenzione. Un agente lavora dentro una finestra di contesto, la quantità di testo che riesce a tenere davanti agli occhi tutta insieme, e ricorda bene quello che c'è all'inizio e alla fine; la parte in mezzo ogni tanto esce dal fuoco, come succede agli umani. La review sta lì apposta per questo, e parte con la memoria vuota.

Quindi la storia dei tre agenti non è quella che sembrava. Il terzo non ha fermato l'errore perché fosse più bravo o più attento degli altri due. L'ha fermato perché era appena nato.

È successo di nuovo, nello stesso milestone.

Alla voce Brownian Motion il glossario dice: _Avoid_: drift, jitter, wander, random walk. L'agente che ha implementato il ticket del movimento le ha usate tutte e quattro. Una funzione `drift`, due test intitolati "wanders" e "drifting", i commenti pieni di "jitter" e "random walk". Nel ticket che si chiama Brownian motion. Quattro su quattro. La review ha aperto il glossario e le ha segnate tutte, esattamente come per `step`.

La differenza è che stavolta la storia era già scritta. Questi articoli nascono da un file di appunti che riempio ticket per ticket mentre il lavoro procede, perché a milestone finito non mi ricorderei più niente. In quel file, quaranta righe più su, c'era già la mia conclusione del primo episodio, in italiano, dentro questo stesso repository: il glossario va tenuto presente durante l'implementazione, non solo durante la revisione.

Non ha cambiato niente.

Quindi cambio idea rispetto a quelle quaranta righe più su. La review è il posto giusto per quel controllo.

Non è una resa. È che quella verifica non si fa scrivendo, si fa rileggendo. Un agente che sta scrivendo una funzione di venti righe non può tenersi in testa quaranta voci di glossario con le loro liste di parole vietate mentre decide come chiamare una variabile locale: non è distrazione, è il momento sbagliato. La review non è la rete di sicurezza che scatta quando il processo fallisce, è il posto dove quel controllo va fatto.

L'agente mi ha fatto notare che così ho solo spostato il problema. "Alla fine lancia la review" sta scritta in una skill, cioè in un file di istruzioni che l'agente legge e segue quando lavora: tre righe di markdown, e niente nel sistema che ne imponga davvero l'esecuzione. Ho spostato il controllo da una convenzione che non si è accesa a un'altra convenzione.

C'è quell'aneddoto della signora che dopo una conferenza di astronomia si alza e dice che la Terra poggia sul guscio di una tartaruga gigante. E la tartaruga su cosa poggia? Su un'altra tartaruga. E quella? "È inutile che insista, giovanotto: sono tartarughe fino in fondo."

L'agente proponeva di spostare le liste di parole vietate dentro la skill della review, così almeno stanno dove qualcuno le legge. No. Stanno bene nel glossario, e la review sta bene dentro il flusso di implementazione.

E sì, una skill eseguita da un agente non è deterministica. Ma qui si parla di qualità del codice: se la review si perde un nome che non segue le convenzioni, non è una cosa grave. L'importante è che il software faccia quello che deve, e quello lo verificano i test, che sono deterministici e girano da soli.

La domanda giusta su un controllo non è se può sbagliare. È quanto costa quando sbaglia.

Fin qui il difetto è sempre stato un controllo che si perde qualcosa. Nel ticket delle collisioni sta un passo prima, nel documento da cui tutti copiano.

Quel ticket non poteva permettersi di confrontare ogni corpo con tutti gli altri, quindi la vasca viene divisa in celle: ogni organismo è registrato nella cella in cui cade il suo centro, e per trovare i vicini di un corpo si leggono le celle lì intorno.

Il ticket diceva: la query restituisce i candidati nelle celle che il cerchio tocca. Preso alla lettera è un bug. Un organismo sta nella cella del suo centro, non in tutte quelle che il suo corpo copre, quindi un vicino abbastanza grosso da toccarti pur avendo il centro una cella più in là non compare in nessuna delle celle che leggi. Li perde di rado, e li perde esattamente nelle coppie quasi a contatto, che sono l'unica ragione per cui il codice delle collisioni esiste.

L'agente se n'è accorto e ha implementato la cosa giusta invece di quella scritta. Non me l'ha chiesto. E lì i test non ti salvano: se implementi il ticket alla lettera e poi scrivi il test leggendo lo stesso ticket, i due sono d'accordo fra loro e il verde è pieno.

Nel ticket dopo è successa una cosa che sembra la stessa e non lo è. Un criterio di accettazione diceva che con il movimento spento la sovrapposizione massima fra i corpi deve diminuire a ogni tick. È falso, e non per la ragione che il ticket stesso sospettava. Le correzioni si accumulano in un buffer prima di essere applicate tutte insieme: un corpo stretto fra sei vicini riceve la somma di sei spinte, e quella somma lo può cacciare più dentro un settimo che stava solo sfiorando. Il buffer è la cosa che rende il risultato indipendente dall'ordine in cui visiti i corpi, ed è la stessa identica cosa che gli toglie la monotonia.

Ci sono due modi, allora, in cui un ticket può essere sbagliato.

Il primo cade da solo. "La sovrapposizione massima diminuisce a ogni tick", messa dentro un test, diventa rossa contro codice giusto. Non serve nessuno che la giudichi: serve solo qualcuno che provi a scriverla. La specifica si smentisce da sé nel momento in cui qualcuno la esegue.

Il secondo va d'accordo con sé stesso. "I candidati nelle celle che il cerchio tocca" è eseguibile, è coerente, e chiede la cosa sbagliata in un modo che il computer può soddisfare senza protestare. Il test scritto leggendo quel ticket non lo contraddice, perché non è un secondo testimone: è lo stesso testimone due volte.

In tribunale due testimoni che si sono parlati prima di deporre contano come uno. Non è che mentano: è che il secondo non aggiunge niente al primo, perché attingono alla stessa fonte.

L'agente che ha spacchettato il milestone in ticket, l'agente che implementa quei ticket, e i test che quell'agente scrive leggendo il ticket che sta implementando: tre voci, e una fonte sola, il brainstorming da cui il milestone è uscito. Concordano sempre. La loro concordanza non vale niente.

Sul mio ruolo mi sono accorto di una cosa: quando faccio la review finale non leggo il ticket, guardo il codice. Non è pigrizia procedurale. Se leggessi il ticket sarei il terzo documento della stessa famiglia, e tre documenti che discendono dalla stessa idea non si smentiscono a vicenda. Leggendo solo il codice sono l'unico anello della catena che non ha il ticket in testa, ed è l'unica posizione da cui quello che dico conta qualcosa. Il prezzo vale la pena scriverlo: così il ticket, una volta scritto, non lo rilegge più nessuno, e viene controllato solo dall'atto di implementarlo.

Le uniche cose che in questi cinque ticket hanno davvero contraddetto qualcosa sono testimoni indipendenti, e si contano:

- `stepOnce`, fermato dal glossario, che non discende dal ticket, aperto da un agente appena nato.
- La query delle celle, fermata dal dominio, cioè da come funziona davvero la griglia.
- Il criterio sulla sovrapposizione, fermato dall'esecuzione, che non è un documento e non discende da niente.
- Un test che non poteva fallire, fermato dalla mutazione: rompere il codice apposta per vedere se il test se ne accorge.

Tutto il resto della catena si è limitato ad annuire.

In quella lista c'è `stepOnce`, in cima, ed è il momento di tornarci: quando l'ho raccontata, quella storia, l'allarme era troppo alto.

L'avevo scritta con inquietudine vera, tre agenti e io fuori dalla catena. Ma misurata col criterio del costo è quasi un non-evento: un nome, beccato dalla review, con i test verdi tutto il tempo.

Quasi. Un nome sbagliato non è un fallimento importante, però è comunque preferibile che l'incongruenza salti fuori il prima possibile. Il costo non è il nome di oggi: è che il codice e il glossario finiscano a dire due cose diverse, e che qualcuno più avanti li legga tutti e due e capisca due cose diverse.

## Quello che nessuno leggeva

C'è un ultimo pezzo di questo milestone che va in direzione contraria a tutto il resto, e riguarda me.

Per dare a ogni corpo una direzione a caso, l'agente aveva pescato un angolo e ne aveva preso seno e coseno. La review gliel'ha bocciato, e per una ragione che non era nemmeno una regola.

Le decisioni di progetto le tengo scritte una per file. In una di quelle, di passaggio, era finita un'osservazione: il ciclo interno di questa versione usa solo aritmetica. Da lì discendeva una comodità futura. Se un giorno avessi voluto risultati identici cifra per cifra su motori JavaScript diversi, sarebbe bastato congelare una tabella invece di rivedere ogni formula. Non un divieto: una proprietà arrivata gratis, e scritta da qualche parte da qualcuno.

L'agente ha riscritto la direzione con un rejection sampling: peschi due numeri a caso dentro un quadrato, e se il punto cade fuori dal cerchio inscritto lo butti e ripeschi. Circa uno su cinque finisce nel cestino.

Non ero d'accordo. Buttare un numero su cinque, in un ambiente che già non è velocissimo, non mi piace. Si torna a seno e coseno: la regola vera è che due run uguali siano uguali sullo stesso motore, e se cambia il motore ce lo facciamo andare bene.

Prima di far tornare indietro l'agente ho chiesto il numero. Meno male.

Dieci milioni di chiamate, cinque round, ordine alternato. Seno e coseno: 65 nanosecondi a chiamata. Rejection sampling: 40,6. Il metodo che butta un numero su cinque costa il 62% di quello che non ne butta nessuno, e le due distribuzioni non si toccano nemmeno: il caso peggiore del rejection è più rapido del caso migliore della trigonometria.

A dirlo dopo è ovvio. Quello che butti è roba a buon mercato: uno scarto sono due numeri casuali e una manciata di operazioni su interi. Quello che eviti sono due funzioni trascendenti, che il motore JavaScript si calcola in software.

"Buttare un numero su cinque" suona come uno spreco, e io l'ho letto come uno spreco. Spreco di cosa, non me l'ero chiesto.

In questo milestone ci sono due regimi, e li ho visti solo mettendoli uno accanto all'altro. Dove esiste un numero, chiedo la misura e accetto che mi smentisca: tre minuti di benchmark hanno ribaltato una decisione che avevo già preso. Dove il numero non esiste, e sui nomi non esiste, resta una convenzione che ho appena ammesso non essersi accesa.

Non è un'incoerenza. È che uno dei due ha uno strumento e l'altro no.

Tre volte, in una sera sola, ho detto "qui manca un meccanismo". Tre volte il meccanismo c'era già.

La prima era la regola di provare a rompere il codice per vedere se un test se ne accorge. L'avevo scritta alla fine di un ticket, e sotto avevo aggiunto che non sapevo chi l'avrebbe eseguita: per ora lascio così. Nel ticket dopo è stata eseguita. Sette mutazioni prima del commit, ognuna con la suite che diventa rossa, e nessuno l'aveva chiesto: non stava nelle istruzioni del repository, non stava nel ticket, e il file degli appunti l'agente l'ha aperto solo dopo. L'aveva presa dal messaggio di commit del ticket precedente, perché la prima cosa che fa quando comincia è leggere la cronologia. Il motore era `git log`. La regola si è propagata per imitazione invece che per istruzione, e nessuno l'aveva progettata così.

Vale la pena metterlo accanto al resto: la convenzione che ha funzionato è quella che nessuno ha scritto come convenzione, e quella su tick e step stava nel file giusto, con tanto di lista di parole vietate, ed è passata sotto il naso di due agenti su tre.

La seconda volta stavo per costruire un modo di conservare le versioni vecchie di un file che avevo appena deciso di riscrivere. Il modo esiste, si chiama git, ed è il posto dove quel file stava già.

E poi c'è il test. Un test scritto quando un tick non costava niente ha cominciato a morire nel momento in cui il tick ha iniziato a lavorare davvero: duemila tick per quaranta corpi, trecentoventimila asserzioni, e quasi tutto il tempo passato dentro la libreria di asserzioni invece che dentro la simulazione. Nessuno l'aveva toccato. Un test di solito ti avvisa quando invecchia, e lo fa diventando rosso; questo è diventato lento, che è l'unico modo di rompersi che non sembra niente, finché non sembra un test che ogni tanto fa i capricci. L'agente che stava lavorando lì l'ha visto fallire due volte e l'ha archiviato come contesa di CPU, perché in quel momento aveva due processi che giravano in parallelo e quella spiegazione era disponibile, comoda e in parte anche vera. L'ha ripreso l'agente della review, che la spiegazione comoda non ce l'aveva.

E la durata di quel test era stampata a ogni esecuzione, accanto al suo nome: 8851 ms. Letta, e scavalcata.

Il problema non è mai stato che mancasse lo strumento. È che nessuno leggeva la deposizione.

L'ultima. A milestone finito l'agente mi elenca cosa manca e ci mette la release: la 0.2.0, dice, perché il documento sulle release dichiara che prima della 1.0 ogni milestone è un minor bump. Il documento sbaglia, e sbaglia da agosto: il tag dice `v0.0.2`, il file dei metadati dice 0.0.2, e il changelog di quella riga scrive per esteso che chiude il milestone precedente. Un milestone è un patch. Per saperlo bastava un comando, `git tag`, e nessuno l'ha dato.

Quarta volta in una sera, dieci minuti dopo aver messo per iscritto la frase sulla deposizione. Stavolta è toccato a chi stava tenendo il conto.

All'inizio di questa storia il problema era che il segnale non c'era: il mondo era troppo vuoto per produrne. Adesso la vasca è piena di corpi che si muovono, il segnale c'è, e viene stampato a ogni esecuzione. Resta da leggerlo.
