# Il figlio più caro

> #53 scegli un ticket e implementalo

Una scelta che non era una scelta. Dei tre ticket aperti sotto #53, due erano bloccati dal terzo: la Persistence non si può misurare su un mondo che ha ancora la sieve, e il re-run dei done-criteria nemmeno. L'agente ha preso #55 perché era l'unico che la mappa delle dipendenze lasciava prendere.

---

Il Birth Sieve aveva un test che lo proteggeva.

Si chiamava _spends the derivation and mutation draws but never the tangent-angle draw when a physical requirement fails_. Fissava, come legge del mondo, proprio il comportamento che ha ucciso la v0.1: estrai il figlio, scopri che non puoi pagarlo, butti via le estrazioni e riprovi al tick dopo. Era scritto bene, era verde, e difendeva il difetto. Con il gate quel percorso non esiste più, e il test è stato cancellato invece che corretto: non c'era niente da correggere, descriveva una cosa che adesso non può succedere.

---

Il test anti-sieve è stato scritto prima del gate, e doveva fallire. È fallito: media del log del rapporto tra area del figlio e area del genitore −0.0247, con un errore standard di 0.00125. Venti errori standard sotto lo zero, contro una tolleranza di quattro.

#40 aveva misurato −0.12, cinque volte tanto. La differenza non è un errore: nel test metà dei genitori parte già abbastanza ricca da pagare il figlio peggiore, e su quelli la sieve non agisce. Il test vede il difetto più debole dell'esperimento, ma lo vede senza ambiguità. Un test non deve riprodurre la misura, deve solo non poterla mancare.

---

Il test scritto prima della funzione non può chiamare la funzione. Così il test anti-sieve calcolava il soffitto a mano, `(1 + δ)²` volte l'area del genitore, perché `birthCostCeiling` non esisteva ancora.

Dopo il verde quella riga è rimasta lì. L'ha notata il sub-agente che faceva la review degli standard, non l'agente che aveva scritto il test: quando M7 sostituirà il corpo della funzione con il bound letto dal genoma strutturale, il test avrebbe continuato a prezzare la legge della v0.1, verde e sbagliato. Scrivere il test prima della funzione lascia un residuo, e qualcuno deve ricordarsi di toglierlo.

---

Nessun figlio arriva al soffitto.

La magnitudine della mutazione del raggio è `1 + u·δ`, con `u` sempre strettamente minore di 1. Quindi un genitore che può pagare il figlio peggiore, dopo aver pagato il figlio vero, ha sempre qualcosa in avanzo. Il vecchio test sul genitore che muore di fame nel tick della propria nascita lo metteva con l'energia esattamente uguale al costo del figlio estratto, e il pagamento lo portava a zero. Con il gate quel genitore non passa nemmeno: il costo del figlio estratto è sotto il soffitto, e il gate chiede il soffitto.

Per farlo morire ancora l'agente ha dovuto renderlo generoso: `childAllocationRatio` a 1, il figlio si prende tutto quello che resta. Prima si moriva di parto per sfortuna nell'estrazione. Adesso si muore solo dando tutto.

---

Il genoma non aveva mai avuto bisogno di sapere che un corpo è un cerchio.

`birthCostCeiling` vive nel modulo del genoma, accanto all'operatore di mutazione, perché la garanzia la fa la legge di mutazione. Ma il soffitto è un'area, e per calcolarla `genome.ts` ora importa `bodyAreaOfRadius` da `organism.ts`, che a sua volta importa dal genoma. Un ciclo innocuo a runtime, segnalato in review e lasciato lì. La prima volta che l'ereditarietà deve conoscere la geometria.

---

Il gate tiene in vita il mondo, ma per un pelo.

Primo controllo senza priming, seed 7 e 8, 40 mila tick. Con la sieve erano estinti a 14.089 e 15.898. Adesso arrivano in fondo con 75 e 58 organismi, e `bodyRadius` sale: il seed 8 passa da 0.81 a 1.00. Però tutti e due passano da un collo di bottiglia all'inizio: il minimo è 4 organismi per il seed 7 e 7 per il seed 8, prima di risalire sopra gli 80.

#40 parlava di un mondo sottile, circa 45 organismi. Non diceva che a un certo punto ne restano quattro. La Persistence, così com'è definita, passa lo stesso: chiede solo che la popolazione sia viva alla fine. Il minimo stampato da #56 dirà quanto spesso il margine è così stretto.

---

La risposta di #56 alla domanda di prima: sempre.

Cinque seed, dal 7 all'11, 100 mila tick, senza priming. Tutti vivi alla fine, con 62, 44, 38, 42 e 37 organismi. Ma i minimi sono 4, 7, 9, 6 e 9, su 40 fondatori. Nessun seed passa comodo: ognuno attraversa un collo di bottiglia e ne esce. Il gate è verde e il mondo, ogni volta, è stato a pochi organismi dalla fine.

Il test non ha una soglia sul numero, per scelta del ticket: l'abbondanza è di M12, e una soglia adesso sarebbe un numero senza un obiettivo dietro. Stampa i minimi e basta.

---

Il numero che doveva rendere visibile il margine era invisibile proprio a chi faceva girare il test.

Il ticket chiedeva di stampare il minimo di ogni seed, così che un mondo sopravvissuto per un pelo si vedesse anche quando il test passa. L'agente ha scritto la stampa, ha lanciato la suite, tutto verde, e nell'output le righe non c'erano. Vitest 4.1 si accorge di girare dentro un agente AI (legge variabili d'ambiente come `CLAUDECODE`) e nasconde l'output dei test che passano, per risparmiare contesto. Se ne è accorto l'agente stesso, con un test di prova da una riga, e per leggere i numeri ha dovuto chiedere esplicitamente `--reporter=default`. Nel terminale di Fabio le righe ci sono.

Uno strumento che decide cosa l'agente non ha bisogno di vedere, e lo decide proprio sulla riga scritta perché qualcuno la vedesse.

---

Il commento di `reproduction.long.test.ts` è una stratigrafia.

Ogni ticket ci ha aggiunto uno strato invece di riscrivere quello sotto: #29 spiega perché la popolazione va innescata a mano, #31 racconta il muro del cibo, #35 e #36 aggiornano i tempi e il picco a 1.025 organismi. Lo strato di #29 diceva che la riproduzione naturale "essentially never re-fires" una volta finito il surplus iniziale. Il ticket chiedeva di verificarlo sul mondo col gate, e l'agente l'ha fatto con uno script usa e getta: seed 7 innescato, picco a 125, poi circa 75 organismi e tra 14 e 43 nascite ogni 5 mila tick fino alla fine, con `bodyRadius` da 0.85 a circa 1.1. La frase era falsa.

L'agente non l'ha cancellata. L'ha messa al passato ("quando è stato scritto…") e ci ha appoggiato sopra lo strato di M6, e ha marcato come superato anche il paragrafo di #31. Il file adesso racconta la storia del mondo, non solo il suo stato.

---

Mezzo pensiero, da verificare: perché il boom innescato col gate arriva a 125 e non a 1.025?

Un ottavo. L'ipotesi ovvia è che il gate sia più severo della sieve proprio quando il cibo abbonda: la sieve faceva nascere il figlio piccolo appena c'era da pagarlo, il gate aspetta di poter pagare quello grande. Ma è un'ipotesi. L'agente l'aveva scritta nel commento come una causa, poi l'ha tolta perché nessuno l'aveva misurata. Nel codice è rimasto solo il numero.

---

Il glossario era più severo dell'ADR che aveva definito il termine.

Il ticket dice "survival", ADR-0027 dice "Survival alone is a weak gate". L'agente ha scritto "survival" ovunque. Il sub-agente della review sugli standard l'ha segnalato come violazione: in `GLOSSARY.md` la voce **Persistence** elenca tra le parole da evitare proprio "survival", perché quella è di un organismo solo. E "population" usata per un conteggio, che il glossario chiama "population size". Corretto tutto, nel test e in `vision.md`. Le parole le aveva scelte la pianificazione, ma a tenerle in ordine è stata la review.

---

Una previsione che era già una misura.

Il ticket #57 chiedeva di scrivere le previsioni prima di lanciare i quindici run, una riga per genoma di partenza. L'agente, scrivendo quella per `r=1.0`, si è accorto che i cinque mondi con quel genoma sono esattamente i cinque della Persistence: stessi seed, stesso genoma, stesso costruttore. La loro sopravvivenza era già stata misurata da #56. L'ha scritto nella previsione stessa: su questa riga non sto prevedendo niente.

---

Previsto su carta, misurato al tick 19.560.

Per il genoma `r=2.5` l'agente ha rifatto un conto a mano prima del run. Fondatori più grandi tengono più carbonio nel corpo, e il carbonio ambiente `s` scende da 1.74 a circa 1.14. Il figlio peggiore chiede cibo per `(1 + δ)² ≈ 1.17` volte l'area del genitore. Quindi all'inizio nessun fondatore può riprodursi, finché non ne muoiono abbastanza da restituire carbonio all'acqua. Previsione: quattro su cinque sopravvivono, e quello che muore muore in questa siccità iniziale.

Il seed 10 si estingue al tick 19.560 con zero nascite. Gli altri quattro passano. È la previsione che è andata meglio, ed è andata bene per il motivo scritto, non per caso.

---

La previsione per `r=1.5` era una deriva leggera verso il basso. I run si sono divisi in due.

Tre seed su cinque crollano a circa 1.15 nei primi 10 mila tick, cioè al livello da cui stanno risalendo i run partiti da 1.0, e poi risalgono anche loro fino a 1.3. Gli altri due restano tra 1.5 e 1.6 per tutto il run. I numeri finali cadevano nella forchetta prevista, la strada no. Una previsione giusta sul punto d'arrivo può essere sbagliata su tutto il resto.

---

Quindici run, ma non quindici mondi indipendenti.

`createPopulation` consuma le estrazioni di un seed nello stesso modo qualunque sia il genoma di partenza. Così il seed 11 ha gli stessi fondatori, in proporzione, sotto `r=1.0`, `r=1.5` e `r=2.5`, quasi nelle stesse posizioni. E il seed 11 finisce primo sia a 1.0 sia a 1.5, il seed 7 ultimo o penultimo. Nessuno l'aveva messo in conto quando ADR-0025 ha scelto "cinque seed per tre genomi".

---

Il verdetto l'ha deciso una riga scritta quando non decideva niente.

In #54 l'agente che ha spostato i done-criteria nel calibration harness ha cambiato una regola, e l'ha dichiarato sul ticket come differenza voluta: un run estinto fa fallire non solo l'accuratezza ma anche la convergenza. Prima la dispersione si calcolava sui sopravvissuti. La motivazione era ADR-0025, "a failed run, not an excluded one", un run fallito e non un run escluso. Sul ticket c'era anche: "On this law the verdict is the same either way", con la legge di allora il verdetto non cambia. Erano tutti estinti.

In #57 i sopravvissuti hanno una dispersione di 0.30 contro lo 0.62 dei genomi di partenza. Con la regola vecchia la convergenza passava. Con quella nuova fallisce, per un solo run, quello morto nella siccità. La regola è stata scritta quando non poteva cambiare niente, e due ticket dopo è l'unica cosa tra PASS e FAIL.

---

Una causa non misurata, la seconda volta nello stesso milestone.

Il commento di `doneCriteria.ts` diceva che una legge in cui i run sopravvivono sarebbe costata più degli 8 minuti e 10 della v0.1, e chiedeva a chi l'avesse misurata di scriverci il numero. Il numero è 88 secondi. L'agente l'ha scritto, e ci ha messo accanto una spiegazione: un mondo sottile di 12–62 organismi costa meno dei mondi della v0.1 prima di morire. Il sub-agente della review sugli standard l'ha fermata: nessuno l'aveva misurata, e gli 8 minuti erano già un limite superiore preso con un secondo run sulla stessa macchina. Nel commento è rimasto il numero.

Come per il boom innescato che arriva a 125 invece che a 1.025: l'ipotesi ovvia scritta come causa, e tolta in review.

---

La nota su dove la misura contraddiceva le previsioni conteneva a sua volta affermazioni contraddette dalla misura.

L'agente aveva scritto che i run da sotto e da sopra "si stanno ancora muovendo verso 1.5 a 100k", e che i seed 10 e 11 erano i più alti. La tabella diceva altro: il seed 7 partito da 2.5 è fermo a 1.8 dal tick 30 mila, due run partiti da 1.0 si muovono appena dopo i 60 mila, e sotto `r=1.0` il seed 10 è terzo. L'ha trovato il sub-agente della review sulla specifica, rileggendo i numeri riga per riga. L'agente aveva arrotondato la tabella nella direzione della propria storia: selezione verso `r_opt`, seed coerenti. Il commento su GitHub è stato corretto, e anche il paragrafo in `vision.md`.

---

`r_opt` va in pensione senza essere stato raggiunto.

Era il numero su cui la v0.1 aveva costruito l'intero criterio scientifico: `r_opt = 2·c₀/α`, previsto su carta, 1.5 raggi base. La sua ultima misura dà accuratezza 6 su 15 e convergenza fallita. Ma è la prima misura in cui qualcuno gli va incontro: i run partiti da 1.0 salgono, quelli partiti da 2.5 scendono, e la deriva non porta in discesa. Dentro i 100 mila tick del protocollo nessuno ci arriva. Con gli organelli il reddito non sarà più `α·r`, e la domanda smette di avere senso prima di avere una risposta.
