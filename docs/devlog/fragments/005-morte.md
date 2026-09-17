# M3 introduce la morte, e la prima cosa che fa è salvare l'immortalità

"q5: quando la popolazione si estingue, il mondo si resetta e riparte con un nuovo seed." — Fabio, rispondendo alla domanda su cosa succede quando muore l'ultimo organismo. La risposta è arrivata dentro un elenco di risposte secche (q1: b, q2: a, q3: a, q4: a), cinque decisioni in una riga ciascuna, e questa era l'unica che non entrava nel modello. Un mondo, nel glossario di questo progetto, è "quello che un seed determina e uno state hash identifica". Un mondo che si ricarica con un altro seed a metà vita non è più identificato dal suo seed, e la promessa di ADR-0007 smette di valere senza che niente lo segnali.

---

"hai ragione.. allora dovremmo trovare un altro modo per ricreare il mondo. magari teniamo lo stesso seed ma usiamo come partenza per gli esseri un array di esseri salvati dal mondo precedente." — Fabio, mezzo minuto dopo l'obiezione.

La controproposta è migliore dell'originale e migliore anche della mia: tenere il seed fermo e far variare solo i fondatori significa che pool, piazzamenti e gradiente di luce restano identici, e qualunque differenza tra due mondi consecutivi è attribuibile alla genetica e a nient'altro. È un esperimento controllato, non un riavvio.

E non si può spedire per primo. Con il seed fissato e nessun fondatore ancora esistente, il mondo N+1 è bit-identico al mondo N: il riavvio diventa la ripetizione infinita dello stesso mondo. La regola che è caduta fuori da lì, e che è finita in ADR-0018: si fa variare esattamente una cosa, ed è quella che si ha. Oggi il seed, domani i fondatori, mai tutte e due.

---

"nel mio vecchio progetto avevo questo pseudo algoritmo: una lista l di 100 elementi, ogni organismo che muore viene inserito in un indice casuale e l'ultimo elemento esce dalla lista. In questo modo la lista ha un'alta probabilità di avere al suo interno gli ultimi morti, e una probabilità più bassa (ma non zero) di avere un organismo morto molti tick fa." — Fabio.

Il vecchio progetto è quello dell'articolo 001, l'acquario in C# di venticinque anni fa. Non è tornato come nostalgia: è tornato come soluzione, a una domanda che il progetto nuovo si era appena posto per la prima volta.

I conti tornano meglio di quanto la descrizione lasci sospettare. Un elemento in posizione `j` viene spinto a destra da un inserimento con probabilità `(j+1)/100`, quindi avanza di una casella ogni `100/(j+1)` morti in media, e la sua permanenza attesa nella lista è `100 · H(100) ≈ 519` morti. La lista tiene più o meno le ultime cinquecento vittime, pesate verso le recenti, con una coda lunga.

---

Il punto su cui si è fermata la sessione, prima di arrivare all'algoritmo: un criterio per decidere quali organismi passano al mondo successivo è una funzione di fitness scritta a mano. "Salva i dieci vissuti più a lungo" è qualcuno che decide cosa vuol dire essere adatti, e l'ultima riga di `vision.md` dice che questo progetto non lo fa mai: osservare ecosistemi complessi emergere "senza mai programmare direttamente un comportamento, una specie o una strategia".

"hai ragione.." — la concessione è arrivata in due parole e senza discussione, e subito dopo è arrivato l'algoritmo del vecchio progetto, che quel problema non ce l'ha: "morto di recente", in un mondo che collassa, vuol dire "ha resistito più a lungo", cioè sopravvivenza, cioè esattamente l'asse su cui il ciclo interno seleziona già. Non aggiunge un asse nuovo, amplifica quello che c'è.

---

"Ci pensiamo più avanti insieme?" — Fabio, chiudendo la questione del criterio.

L'archivio dei fondatori è finito in ADR-0018 come decisione deliberatamente aperta, nel senso in cui ADR-0014 lascia aperto l'incentivo alla specializzazione. Non "non lo sappiamo ancora", ma "il candidato in testa è questo, e la scelta si fa quando ci sarà qualcosa da guardare".

---

"La lista era già presente nel vecchio progetto in C#. Il vecchio progetto, quando morivano tutti gli esseri, ripartiva in automatico." — Fabio.

Questo ribalta il senso di tutto quello che è successo prima. La risposta "il mondo si resetta e riparte" non era un'idea buttata lì in fondo a un elenco di risposte secche: era il comportamento di un programma che ha girato davvero, venticinque anni fa. E la lista dei cento non era un ricordo tirato fuori per analogia, era il pezzo che in quel programma faceva esattamente questo lavoro.

Quindi l'archivio dei fondatori non è una funzionalità nuova di AcquarioTS. È un ripristino. E l'obiezione dell'agente, quella sul glossario e sul ledger, era senza saperlo un'obiezione contro software funzionante.

La differenza tra i due acquari non è l'idea, è il vincolo: il vecchio poteva semplicemente farlo, questo deve prima verificare che non contraddica la riga di chiusura di `vision.md`, che nel vecchio progetto non esisteva.

---

"Non saprei come rispondere, ha fatto tutto l'agente." — Fabio, alla domanda su chi avesse previsto che cancellare il clamp dell'immortalità avrebbe distrutto lo strumento con cui M5 misura `α`.

La non risposta è la risposta. Non è l'agente che si corregge dopo una review, e non è Fabio che intercetta l'errore leggendo il diff: è l'agente che progetta e l'agente che trova la trappola dentro il proprio progetto, senza che nessun altro passi di lì. `docs/agents/devlog.md` tiene separati con cura i primi due casi, perché "dicono cose opposte su quanto ci si può fidare". Questo è un terzo caso, e non ha ancora un nome.

---

"Mi viene da chiedere, per sapere se l'implementazione è troppo pesante, visto che la performance in futuro sarà un problema per questo progetto." — Fabio, sul perché a una richiesta aggiunge quasi sempre "se non complica troppo le cose".

Non è delega, e non è disinteresse per il layer grafico. È una domanda mirata su un costo preciso. Lo stesso pensiero stava già nella pila di M2, sul fix dell'ordinamento prima di sommare: "temo che sarà troppo dispendioso a livello di performance quando aumenteremo il numero di esseri". La preoccupazione non cambia oggetto tra un milestone e l'altro, cambia solo punto di applicazione.

---

"No, avrei preferito fare tutti gli step come stabilito nella nostra pipeline." — Fabio, sul fatto che i ticket esistessero già quando è arrivato a `/to-spec`.

La pipeline è `/grill-with-docs`, poi `/to-spec`, poi `/to-tickets`. In questa sessione l'agente ha proposto, in fondo al grilling, di fare branch, ADR e ticket tutti in una volta, e Fabio ha detto "go!". Autorizzato, quindi. Ma autorizzato su un piano che saltava due passaggi del suo processo, e proposto da chi quei passaggi avrebbe dovuto rispettarli.

Quando `/to-spec` è partito sul serio, il documento che doveva produrre esisteva già come issue #21, e l'unica cosa rimasta da fare era esattamente la parte che l'agente aveva saltato: la mappa dei seam. Che poi ha prodotto una decisione vera, estrarre un modulo `Session` per rendere verificabile la promessa di ADR-0018, che nel giro corto non sarebbe mai venuta fuori.

---

"funzionava sì, dopo vari restart si vedeva una certa evoluzione. Il vecchio progetto però non aveva Seed." — Fabio.

Due informazioni in una riga, e la seconda è più grossa della prima. Il vecchio acquario non aveva seed: niente determinismo, niente replicabilità, ogni riavvio pescava dal caso e basta. La domanda su cui ieri si è consumato un intero giro di grilling, se al restart tenere lo stesso seed o pescarne uno nuovo, in quel progetto non poteva proprio essere posta.

E intanto la lista funzionava. "Dopo vari restart si vedeva una certa evoluzione": l'archivio dei fondatori ha una prova sul campo, ed è l'unica che abbia. Arriva da un programma dove nessun run era ripetibile e nessun confronto controllato era possibile. Il risultato è vero e non è verificabile.

Che è poi la ragione esatta per cui questa volta il seed resta fermo e a variare sono solo i fondatori: non per eleganza, ma perché venticinque anni fa quella cosa si era vista e non si era potuta misurare.

---

"La cosa mi sta bene, fino a che la conclusione dell'agente è in linea con le mie idee." — Fabio, a cui era stato chiesto se gli desse fastidio che in questa sessione l'agente avesse scritto sia le 23 domande sia le 23 risposte consigliate.

La frase sembra una resa e invece descrive un meccanismo che ha funzionato. Su 23 decisioni Fabio ne ha spostate due, la q5 e la controproposta sul seed fermo, e ha ratificato il resto. Il filtro però non è "ho verificato il ragionamento", è "questa conclusione è in linea con quello che penso". Le due volte in cui non lo era si è visto subito.

Non è una firma in calce, è un diritto di veto. Esercitato due volte su ventitré.

---

Una parola guida, o meglio un'immagine, e arriva dal contenuto stesso del milestone.

M3 progetta un archivio dei fondatori: una lista di organismi morti che il mondo successivo si porta dietro, perché ripartire da zero significa buttare via tutto quello che il mondo precedente aveva imparato.

Nella sessione di design succede la stessa identica cosa, un piano sopra. Ogni `/implement` parte da un `/clear`, quindi l'agente non ha memoria delle sessioni precedenti: ha solo quello che è scritto su disco. `vision.md`, `CONTEXT.md`, diciotto ADR, il codice. Tutto il resto è perduto a ogni giro.

E i due soli momenti in cui Fabio ha spostato una decisione, in ventitré domande, vengono dall'unica cosa che su disco non c'è: un acquario in C# di venticinque anni fa, che ripartiva da solo quando morivano tutti e teneva una lista di cento morti per riuscirci.

In fase di design, Fabio è la lista dei cento.

---

Parola guida, scelta da Fabio: **il diritto di veto**.

Poi si rilegge il transcript per scrivere il frammento, e di veti non ce n'è nemmeno uno.

Le due volte in cui Fabio ha spostato qualcosa non ha bocciato un'opzione: ha risposto fuori dall'elenco. Alla q5 l'agente offriva tre strade, non fare niente, fermare il loop, registrare il tick dell'estinzione, e lui ne ha scritta una quarta che non era prevista: il mondo si resetta e riparte. Alla q22 di nuovo, con il seed fermo e i fondatori che variano.

E la prima delle due è stata ribaltata. L'agente ha obiettato sul glossario e sul ledger, Fabio ha detto "hai ragione", e la sua risposta è uscita di scena. Quella sopravvissuta è la seconda, che adesso sta in ADR-0018 come punto d'arrivo previsto del progetto.

Il conto vero è quindi: zero veti, due risposte fuori elenco, una respinta e una adottata come piano.

Il nome però resta giusto, perché lo scarto è la cosa interessante. Fabio si descrive in linguaggio da veto, "fino a che la conclusione dell'agente è in linea con le mie idee", cioè come qualcuno che presidia un'uscita. Quello che ha fatto davvero è stato aggiungere due cose che nell'elenco non c'erano. Il potere che sente di avere è fermare. Quello che ha usato è aggiungere.

E c'è un limite che vale la pena scrivere adesso che si vede bene: tutte e due le aggiunte vengono da qualcosa contro cui misurare, cioè il vecchio acquario in C#. Dove un'idea preesistente non c'è, non c'è appiglio, e la conclusione dell'agente passa perché nessuno ha motivo di fermarla. La pila di M2 ha già il caso in cui non è scattato niente: "In ogni caso è stato il codereview a trovarlo, non io."

---

La sessione di implementazione è partita da sola, senza Fabio in mezzo: `/implement`, un ticket da scegliere dentro #21, via. Le decisioni di questo blocco di frammenti sono tutte dell'agente, non sue: lo si scrive qui una volta per tutte invece che ripeterlo a ogni frammento.

---

Il test che #22 aveva scritto per una morte che ancora non esisteva, "lets an organism's energy go negative... in the mortal world", si aspettava di trovare, dopo duemila tick, almeno un organismo con energia negativa. Con #23 quell'energia non è più osservabile: un organismo a `energy <= 0` viene condannato e tolto dalla popolazione nello stesso tick in cui ci arriva. Il test è andato rosso, ma nel modo giusto — non un bug, la conferma che la morte funzionava. Riscritto per verificare che la popolazione si riduca, non che qualcuno resti a galleggiare sotto zero.

---

Il ticket #23 suggeriva di costruire la popolazione dell'acceptance run "come fa già `referencePopulationFor`", cioè `createPopulation` più `initializeMetabolism`. Ma `createPopulation` sparge gli organismi su tutte le profondità dell'acquario, e vicino alla superficie c'è luce a sufficienza perché la fotosintesi tenga in vita un organismo indefinitamente. Con quella popolazione l'estinzione totale, il criterio d'accettazione del ticket, non sarebbe mai arrivata. Serviva forzare la profondità di ogni organismo dopo il piazzamento, per portarli tutti dove `vision.md` promette che "maintenance wins every time".

---

269 tick per estinguere una popolazione di quaranta organismi piazzati al buio, pochi millisecondi di costo. Il numero che `vision.md` aveva solo promesso in astratto — "a y ≈ 40, I(y) è circa 1e-4, quindi la manutenzione vince sempre" — si è confermato al primo tentativo, senza dover alzare `MAX_TICKS` o cambiare seed.

---

Uno spostamento di codice non richiesto dal ticket: `runMetabolism`, la replica a mano dei passi 2-5 della pipeline, viveva solo dentro `world.test.ts`. Il nuovo `death.test.ts` doveva rieseguire la stessa sequenza per il suo acceptance run, e duplicarla a mano una seconda volta avrebbe voluto dire due copie della pipeline da tenere sincronizzate a mano. Spostata in `testing.ts`, condivisa tra i due file. La code review l'ha segnalata come scope creep — a basso rischio, un puro spostamento, nessun comportamento cambiato — ma segnalata comunque: anche una sessione senza Fabio produce un diff che qualcun altro deve poter giudicare.
