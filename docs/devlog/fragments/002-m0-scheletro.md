# M0: lo scheletro

Avevo iniettato `Document` in `mountCanvas` pensando che rendesse il codice più
testabile — passare l'elemento da montare invece di prendere `document` globale.
L'ho droppata a metà: mi sono accorto che quel test non aggiungeva valore, perché
il loop di rendering lo verifico avviando l'applicazione, non isolando
`mountCanvas`. È rimasto `document` globale.

---

`bracketSpacing` è lo stile che uso in tutti i miei progetti — niente spazi
dentro le parentesi graffe. Non l'ho messo nella config fin dall'inizio: ho
lasciato girare Prettier di default finché non ho visto per caso un file pieno
di spazi che non mi piaceva. A quel punto ho disattivato l'opzione e riformattato
tutto il repo in un commit separato.

---

Avevo capito male io stesso `hashState`, rileggendolo a distanza di settimane:
non è quello che rende il mondo deterministico — quello lo fa `createWorld` col
seed e gli stream di PRNG per organismo. `hashState` è la sonda che verifica il
determinismo: confronta se due mondi partiti dallo stesso seed sono arrivati
allo stesso stato dopo N tick. Il test in `world.test.ts` lo esercita già, ma
solo sulla meccanica sintetica del `World` core — accumulator, PRNG. Non l'ho
ancora visto messo alla prova da un comportamento di simulazione vero, perché
non esiste ancora niente che possa divergere in modo interessante. Dovremo
stare attenti, mano a mano che lo sviluppo aggiunge comportamento, a
controllare che due seed uguali continuino a produrre davvero due mondi
uguali.

---

Prima c'erano tre bottoni: avvia, pausa, step. Avvia e pausa restavano attivi
tutti e due insieme, il che non aveva senso. Primo istinto: gestire lo stato
disabilitato/abilitato di ciascuno in base a se la simulazione fosse ferma o
avviata. Solo dopo mi sono accorto che non serviva — avvia e pausa erano lo
stesso concetto guardato da due lati, e bastava un unico bottone toggle.

---

Playwright non l'ho preso solo per gli e2e test in senso classico. Sto facendo
scrivere il codice ad agenti, e Playwright è un modo per dare loro la "vista"
mentre lavorano — invece di doversi basare solo sul codice e sul risultato
dell'esecuzione, possono vedere cosa succede davvero nel browser.

---

Ho provato pan e zoom su un dispositivo touch e non funzionava niente — né il
dito che trascina, né il pizzico per zoomare. Non potevano funzionare: non
c'erano proprio gli event listener per il touch. Non era emerso dalla grilling
session con l'agente. L'ho fatto implementare subito, senza rimandarlo: con
poco sforzo in più si supportano anche tablet e smartphone.

---

Dopo anni il progetto mi emoziona ancora. Non lo scrivo io, il codice, eppure
vedere una griglia zoommabile che si muove sotto il dito mi fa esaltare lo
stesso.

---

Il codice ormai è solo un dettaglio implementativo. Il ruolo dell'ingegnere
informatico è diventato fare il PM — da un lato può essere divertente, ma se ti
piace programmare, sappi che non lo farai più.

---

Non c'era bisogno che scrivessi io il codice, ma "solo" che decidessi cosa e
come farlo. Ho riguardato tutto quello che ha scritto l'IA — magari non
l'avrei fatto nello stesso modo, ma la qualità è alta, più alta di quella di
colleghi in carne e ossa. E come non correggo lo stile di un collega che ha un
gusto diverso dal mio ma ugualmente valido, allo stesso modo non correggo
l'agente: è solo un altro gusto.

---

> Sembra "vibe coding", invece è "automatic programming". Non è adatto a
> chiunque, è l'evoluzione (pun intended) del mestiere dell'ingegnere
> informatico.

---

Il "come" che decido io e il "come" che non correggo in review non sono lo
stesso "come". Uno è il come di progetto: canvas, TypeScript, Prettier, come
si fanno i commit, i branch, quali skill usare. L'altro è il come di
esecuzione: dentro quel perimetro, come l'agente struttura effettivamente il
codice. Il primo resta mio al 100%. Il secondo lo tratto come il gusto di un
collega — non lo correggo, come non correggerei lo stile di un collega dentro
lo stesso linter aziendale. `bracketSpacing` è un esempio del primo tipo: l'ho
deciso io a livello di config, non l'ha scelto l'agente.

---

Nella M0 l'agente ha scelto un approccio più vicino allo stile nativo di JS
al posto dell'OOP che avrei usato io d'istinto. Non l'ho solo tollerato: mi ha
convinto. E se l'avessi dovuto implementare io in quello stile, sarebbe stato
più difficile da maneggiare — non è "un gusto diverso ma ugualmente valido",
è che sul come di esecuzione l'agente a volte ha un'idea migliore della mia.
Non è un caso isolato, dipende dalle volte.

---

Il perché del progetto — perché farlo, perché voglio l'acquario, perché gli
organelli invece che qualcos'altro per far emergere l'evoluzione — resta mio.
In alcuni casi l'IA può aiutarmi a definire meglio un perché, ma il perché di
fondo del progetto no, quello non si delega.

---

Non sono il PM del progetto — se lo fossi, non avrei scelto nemmeno gli
strumenti tecnologici, mi sarei fidato abbastanza da lasciare anche quello
all'agente. Sono l'architetto: decido la struttura, gli strumenti, faccio
review di correttezza. Non sono ancora pronto a fare solo il PM — non mi fido
abbastanza dell'AI, per ora, da lasciarle anche le decisioni tecniche.

---

Editor mi sembrava riduttivo, e comunque è una parola da scrittura di prosa,
non da codice. Architetto no: è già una parola del mestiere.
