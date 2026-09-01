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
