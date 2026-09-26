---
title: "Il muro del cibo"
description: "M4 doveva far nascere i primi organismi di AcquarioTS. Quasi nessuno nasce — per un motivo che il ticket aveva già previsto di non poter risolvere da solo."
date: 2026-09-21
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - typescript
  - ai-agents
  - reproduction
  - calibration
lang: it
---

# Il muro del cibo

Un organismo che respira, fotosintetizza, si muove — e non si riproduce mai. Non per un bug: nella milestone che insegna al mondo AcquarioTS a far nascere organismi nuovi, il costo in cibo di un figlio coincide esattamente con la [cap di cibo](004-metabolismo.md) di un genitore della stessa taglia. Bisognerebbe essere pieni al 100% per permetterselo; nessun organismo osservato in centomila tick arriva oltre il 12% della propria. È una scoperta che nessun criterio di accettazione anticipava, perché quando quei criteri sono stati scritti nessuno sapeva ancora che ci fosse qualcosa da scoprire.

Per capire come ci si arriva, bisogna tornare all'inizio della milestone — a un ticket che non aggiunge niente al mondo. Un ADR scritto mesi prima si era lasciato dietro la propria data di scadenza: la dimensione della cella della griglia era derivata dal corpo più grande che il mondo permetteva, e quella derivazione sarebbe scaduta esattamente qui, a M4. Il primo ticket della milestone non introduce né riproduzione né mutazione — "quando atterra, il mondo si comporta esattamente come oggi", dice il suo stesso testo — esiste solo per disinnescare una previsione fatta a distanza, da chi non poteva ancora sapere se sarebbe servita davvero. Il fallimento che preveniva era silenzioso per costruzione: un corpo che supera metà cella smette di essere trovato dalle query dei vicini, e la suite dei test resta verde mentre succede. Non un crash — un vuoto che nessuno nota finché non lo va a cercare apposta.

Il ticket successivo scrive il genoma: un record piatto di quattro geni — il raggio del corpo, la soglia di energia a cui un organismo tenta la mitosi, la quota di risorse residue che lascia al figlio, e una tinta ereditaria senza alcun effetto fisiologico — più l'operatore che li muta a ogni nascita. Da qui in avanti generazione zero non nasce più da un raggio disegnato a caso: nasce da un unico genoma di base, mutato quaranta volte indipendenti. La selezione parte da un punto comune, non da rumore. Il criterio di successo del ticket, scritto testualmente nei suoi criteri di accettazione: che una run risultasse visivamente indistinguibile da quella di ieri. Tutto il lavoro vero resta sotto la superficie, in attesa che il ticket seguente — la mitosi — gli dia finalmente qualcosa da fare.

Quel ticket aveva scritto in anticipo un solo rischio di calibrazione, nero su bianco: che la popolazione potesse fare boom fino al soffitto di carbonio e restarci ferma, entro poche migliaia di tick. Il rischio vero era l'opposto — non riprodursi mai. Il costo in cibo di un figlio, proporzionale alla sua area corporea, coincide esattamente con la cap di cibo di un genitore della stessa taglia: bisogna essere pieni quasi al 100% per permetterselo, e in una run immortale da centomila tick il massimo osservato in tutta la popolazione è il 6%. Nessuna delle due manopole che quel ticket possiede — la soglia di energia a cui un organismo tenta la mitosi, il costo energetico del figlio — tocca il lato cibo. Nessuna delle due poteva risolverlo.

L'ha trovato l'agente, empiricamente: facendo girare prove da centomila tick prima ancora di scrivere il gate di accettazione del ticket, non verificando un'ipotesi a tavolino. Il numero uscito da quella run — il 6% — ha smentito l'unico rischio che il ticket si era scritto in anticipo, quello del boom fino al soffitto di carbonio. Non è la prima volta in questo dev-log che una previsione sbagliata viene trovata da chi scrive il codice, invece che da chi legge il diff dopo — ma qui non c'è nemmeno un diff da leggere ancora: la scoperta arriva prima che ci sia qualcosa da mostrare a qualcuno.

Il perché non è un dettaglio da riga di codice. Due scelte di costruzione fissate a 1 fin dal [metabolismo](004-metabolismo.md) — la densità corporea e il coefficiente della cap di concentrazione, nessuna delle due toccabile da questo ticket — si combinano e fanno collassare il costo in massa di un figlio, proporzionale alla sua area, sulla sua stessa cap di cibo. Non una vicinanza misurata su una run: un'identità che vale per costruzione, prima ancora che qualcuno faccia partire una simulazione per verificarla.

> mi aspettavo che le varie costanti sarebbero dovute essere tunate osservando la simulazione, e ancora andrà fatto

La direzione generale — le costanti di M2 non sono quelle giuste, andranno riviste guardando una run vera — Fabio se l'aspettava fin dall'inizio. Il dettaglio specifico no: né lui né il testo del ticket avevano previsto che il collo di bottiglia sarebbe stato il cibo, bloccato da una scelta di costruzione non toccabile da questo ticket, invece dell'energia — le due manopole che il ticket stesso segnalava come da tarare.

Il ticket successivo si chiama #31, e nasce con lo stesso gesto del primo ticket della milestone: si scrive da solo la propria via di fuga, mesi prima di sapere se le sarebbe servita. Se il gate non passa senza toccare una legge invece di una costante, dice testualmente, quello è un finding sul modello — e va scritto in un commento prima ancora che nel codice. Non una speranza ottimista che tutto sarebbe filato liscio: una clausola di uscita, già pronta, per lo scenario esatto che poi si è verificato.

Fatta girare la versione "vera" del gate — nessun priming, popolazione di partenza normale, mortalità e fertilità entrambe accese — il risultato è più netto di quanto il 6% già misurato lasciasse immaginare. Quaranta fondatori crollano a un solo superstite entro undicimila tick, zero nascite in tutto l'arco osservato. E non è un declino lento: il massimo di cibo posseduto da un organismo si stabilizza già al tick cinquemila, al 12% della propria cap, e non si muove più per altri quindicimila. Una run che smette di raccontare qualcosa di nuovo dopo un ventesimo del tempo che le è stato dato.

Tre risposte, senza girarci troppo intorno. Sulla scelta tra aspettare e ritoccare subito una costante fuori dal perimetro della milestone: "Non ho esitato, era chiaramente la scelta giusta aspettare per regolare le variabili quando avremo una simulazione più completa" — toccarle adesso, prima che l'acquario sia abbastanza completo da dire qualcosa di vero su sé stesso, sarebbe stato tarare al buio. Sulla clausola di uscita che il ticket si era scritta da solo, mesi prima, con tanta precisione: "sorpresa", secca — non una previsione confermata. Il ticket sapeva, in anticipo, di poter non sapere. E sul perché nessuno, lui compreso, avesse previsto che il collo di bottiglia sarebbe stato proprio il cibo: "Era difficile prevedere le soglie giuste prima di avere un acquario almeno in parte funzionante." Non una svista correggibile rileggendo meglio la vision del progetto — un numero che si scopre solo facendo girare il mondo, mai a tavolino.
