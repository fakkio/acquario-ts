---
title: "Quanto dura una misura"
description: "Una milestone di calibrazione pubblica un verdetto negativo apposta — e trova tre modi di evitarlo, tutti già scartati in anticipo."
date: 2026-09-26
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - typescript
  - ai-agents
  - calibration
  - reproducibility
lang: it
---

# Quanto dura una misura

Un numero scritto in un commento di codice muore quando muore la run che lo ha misurato: resta leggibile per sempre, ma nessuno può più controllarlo. Questa milestone — la calibrazione, cioè scegliere le costanti giuste perché una popolazione di organismi che nascono, si nutrono e si riproducono dentro un mondo chiuso converga verso una taglia corporea prevista in anticipo, non trovata per tentativi — ha passato le prime settimane a scoprire quell'idea su costanti già in produzione da quattro milestone. Le ultime le ha passate a costruire uno strumento che non ripetesse lo stesso errore.

Poi quello strumento ha detto una cosa scomoda. E stavolta c'era un modo per crederci.

Il progetto aveva già l'abitudine buona, da qualche parte. `death.test.ts` dice "measured at 269 ticks to extinction", e due righe sotto c'è il seed che quella run esegue: rilanciandolo, 269 torna sempre. Ma `RESPIRATION_ENERGY_YIELD = 800`, una delle costanti che governano quanta energia un organismo ricava dal cibo, dice solo "found by running `createWorld` out to 100k ticks and reading where the population settles". Nessun seed. Nessuna opzione — quel mondo era immortale? fertile? Nessun comando da rilanciare.

Non è disciplina che manca qua e là. Un numero sopravvive esattamente quanto il codice che lo ha misurato: dove la misura sta dentro un test, è ancora viva; dove sta solo in un commento, è il racconto di una run in cui nessuno può più rientrare.

Non era un caso isolato. `K_CAP`, il coefficiente che fissa quanto carbonio un corpo può contenere per unità della propria area, era scritto a 1 con la sicurezza con cui si scrive un'unità di misura. Ma `K_CAP` e `ρ` — la densità di carbonio dei corpi — condividono la stessa dimensione: fissarle entrambe a 1 non è una scelta di unità, è una scelta di unità più un'affermazione fisica nascosta dentro, mai verificata per quattro milestone.

Un'affermazione dura finché nessuno rifà il lavoro che c'è sotto. Vale per un numero misurato in una run irripetibile, e vale per un numero scritto con la sicurezza di una cosa derivata quando derivata non lo è mai stata.

La spec di questa milestone porta già la contromisura, anche se a prima lettura sembra pignoleria: lo strumento che avrebbe misurato le costanti — l'harness di calibrazione, uno script che costruisce mondi e stampa cosa succede dentro — non deve asserire niente. Riporta e basta; i controlli che possono davvero fallire stanno altrove, in una suite di test separata. "A test that prints instead of asserting is a test that can never fail", dice la spec. Vero — e vale altrettanto per il suo output.

La regola che serve non è che l'harness asserisca qualcosa. È che ogni numero che stampa sia riottenibile con un comando, non solo leggibile in un commento. Un numero che non può mai diventare rosso da solo va sorvegliato da qualcun altro — e quel qualcun altro, da qui in avanti, è sempre un comando da rilanciare, mai una frase di cui fidarsi.

Il bersaglio scientifico della milestone è uno solo: un organismo guadagna energia in proporzione al proprio raggio corporeo — chiamiamo `α` quel tasso — e la spende in parte a costo fisso, in parte in proporzione alla propria area. Un conto fatto su carta, mesi prima che esistesse una riga di codice per verificarlo, prevede che la popolazione converga verso un raggio ottimale preciso, `r_opt = 2·c₀/α`. La milestone deve scegliere le costanti che rendono vera questa previsione, poi verificare se lo è davvero.

Quella formula regge solo se il reddito cresce esattamente in proporzione al raggio — non un po' più svelto, non un po' più lento. L'esponente che lo misura si chiama `n`, e la previsione vale solo se `n` cade abbastanza vicino a 1.

La prima versione dell'harness misurava `n` con un'unica finestra temporale per tutta la scala dei raggi provati. Su dieci raggi, tre finivano fuori scala e lo strumento stampava `NaN`.

La seconda cercava, raggio per raggio, il tratto più lungo in cui quel corpo non era né a zero né al massimo. Ammetteva tutti e dieci, con un adattamento quasi perfetto — sembrava la fine della storia. Non lo era: quattro di quei dieci raggi non avevano mai raggiunto uno stato stazionario, erano letti solo mentre scendevano ancora, dentro il transitorio di apertura del mondo. Inclusi nella media, tiravano `n` verso il basso — per una coincidenza che non aveva niente di rassicurante, proprio verso il numero che la previsione voleva vedere. Il numero comodo era quello che usciva dal non guardare abbastanza da vicino.

C'è anche una riga nel report dell'harness che non è affatto una misura: è aritmetica che il progetto possedeva già da una milestone precedente, la formula chiusa del tetto di popolazione. Valutata alle costanti di quel momento dava **−30**. Un tetto negativo vuol dire un mondo sterile per fisica, prima ancora di qualunque domanda di taratura — e nessuno l'aveva notato perché nessuno aveva mai fatto girare quella riga insieme alle altre.

Il conto su carta prevede reddito lineare nel raggio, ma la riproduzione mette in mezzo un ostacolo che quel conto non conosce. Il costo in massa di un figlio è una soglia su una concentrazione interna di carbonio, e la stessa dinamica che tiene il reddito lineare fa scendere quella concentrazione via via che un corpo cresce. Sopra un certo raggio — chiamiamolo `r_max` — un organismo guadagna benissimo e non può permettersi un figlio lo stesso.

C'è una seconda pressione, di tutt'altra natura. Il moto browniano di un corpo va come l'inverso del proprio raggio: uno piccolo entra ed esce dalla banda luminosa molto più in fretta di uno grande. `tenancy` misura quante nascite un organismo completa per ogni soggiorno nella luce — sotto una certa soglia, un raggio che sembra vincente potrebbe solo essere stato di passaggio nel posto giusto, non davvero più adatto.

Il ticket doveva spostare qualche costante contro tre soglie già scritte: `n`, `r_max`, `tenancy`. Nessuna combinazione provata li soddisfa tutti e tre insieme — una costante tira `n` e `r_max` in direzioni opposte, e `tenancy` non ha mai superato 4.25 contro una soglia di 5, nel punto migliore trovato.

C'era un modo per far chiudere `r_max` da solo, e funzionava: se il cibo interno non basta a pagare la massa del figlio, prendere il resto dalla CO₂ del genitore, rilasciando l'ossigeno che portava con sé — chimicamente pulito, la fotosintesi stessa girata al contrario. È stato scartato lo stesso.

> non mi piace che il figlio si prenda la CO2 come cibo

Il motivo preciso è arrivato solo dopo, messo a confronto con il resto del meccanismo: ovunque nella riproduzione, quello che un genitore cede è quello che il figlio riceve, stesso tipo — cibo per cibo, ossigeno per ossigeno, CO₂ per CO₂. Il fallback rompeva quella regola in un punto solo. Bastava vederla scritta per sapere che non andava, prima ancora di saperne il motivo.

Con questo restava una sola domanda aperta: partendo da quindici mondi — cinque seed per tre genomi di partenza, centomila tick ciascuno — la popolazione converge sul raggio previsto o no? La milestone si era già impegnata a pubblicare la risposta comunque, qualunque fosse: la banda di tolleranza era fissata prima di far girare una sola run, apposta perché allargarla dopo si riconoscesse come un rifiuto e non come un giudizio.

La risposta vera non è stata nessuna delle due previste. Tutti e quindici i mondi si estinguono prima ancora di entrare nella finestra di lettura delle ultime diecimila tick. Il gate di accuratezza non ha nemmeno un numero da giudicare. Quello di convergenza non ha uno spread da confrontare: `NaN`, non un valore fuori banda. Non era la milestone che sbagliava una previsione — era la milestone in cui la domanda "converge?" si è scoperta prematura.

Anche i test pensati per limitarsi a riportare senza giudicare — media e deviazione degli altri due geni, la non convergenza del marcatore neutro — avevano dentro un controllo che sembrava innocuo: la pretesa che qualche organismo fosse sopravvissuto. Un gate travestito da report, saltato fuori esattamente nel caso che contava di più: con tutti i mondi estinti, un report che si rifiuta di girare non dice "niente da riportare" — fallisce e basta. L'ha trovato la revisione, non una run.

Il file di test che doveva rispondere finisce rosso, e lo dice di sé stesso nel proprio commento: non lasciato rosso per errore, il rosso è il verdetto. In un progetto dove ogni altro gate lungo resta verde per definizione — conservazione, determinismo — questo è il primo con il permesso esplicito di fallire e restarci, perché fallire è esattamente cosa doveva scoprire.

Guardare l'acquario girare dal vivo aggiunge una domanda che un numero da solo non fa venire in mente: perché proprio i corpi piccoli, e perché li uccide? Non è mancanza di luce o di CO₂. Il costo per riprodursi scala con l'area, quindi un corpo piccolo arriva alla soglia di mitosi con molto meno tempo — e il moto browniano lo porta fuori dalla luce molto più in fretta di uno grande. `tenancy` misura esattamente questo rapporto, ed è sotto soglia: quasi nessuno resta in luce abbastanza per completare un ciclo riproduttivo intero, a meno di essere abbastanza piccolo da farlo in fretta. La popolazione non sta selezionando chi guadagna di più — sta selezionando chi fa in tempo. Ed è una pressione che scavalca il pavimento che il costo fisso d'esistenza avrebbe dovuto garantire: quel pavimento protegge da "diventare piccoli non conviene", non da "diventare piccoli funziona per un motivo completamente diverso".

Non muoiono perché è mancata la luce. Muoiono perché sono diventati troppo piccoli per usarla.

Dopo il verdetto sono arrivate tre proposte per far sopravvivere il mondo lo stesso, e tutte e tre erano già state accese e spente prima di essere riproposte.

Più energia dalla respirazione era già stata provata durante la caccia alle costanti, fino a un valore tre volte quello in produzione: rompeva `n`, non solo rifiutava di aiutare. Una banda luminosa più larga avrebbe probabilmente aiutato `tenancy` — più spazio verticale nella luce vuol dire più tempo prima che il moto browniano porti fuori un corpo — ma quella costante non è una soglia qualunque: è la definizione stessa della finestra in cui si misura `α`. Allargarla vuol dire rimisurare tutto da capo, dalla costante di esistenza in su. E un generation-0 innescato con più risorse all'inizio — l'unica idea mai davvero non provata — aveva già la sua risposta scritta in un gate esistente, nato per un altro scopo: un mondo innescato collassa lo stesso, solo più tardi e più in grande, perché la riproduzione naturale smette di ripartire una volta speso il surplus iniziale.

Non vicoli ciechi da scoprire. Vincoli già bruciati da un giro precedente dello stesso capitolo.

La milestone si chiude così: il terzo criterio di v0.1 — che la popolazione converga per selezione e non per deriva — resta misurato e non soddisfatto, per scelta registrata piuttosto che per un problema ancora aperto ([ADR-0026](../adr/0026-m5-ends-without-convergence-and-v0-1-ships-that-way.md)). Conservazione e determinismo reggono entrambi. La sopravvivenza, se mai tornerà, è lavoro della prossima versione — ma questo verdetto, a differenza delle costanti che lo hanno preceduto, resta un comando da rilanciare per chiunque voglia controllarlo, non una frase di cui doversi fidare.
