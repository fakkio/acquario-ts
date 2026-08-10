---
title: "Venticinque anni per cancellare una sottoclasse"
description: "La stessa simulazione sognata venticinque anni fa, ma riscritta con un'idea diversa: niente specie codificate a mano, solo organismi, genomi e un mondo che deve reggersi da solo."
date: 2026-08-07
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - typescript
  - ai-agents
  - design
  - rewrite
lang: it
---

# Venticinque anni per cancellare una sottoclasse

Quando avevo vent'anni ho scritto un acquario in C#. Era uno di quei programmi che nascono con una sola urgenza: vedere se l'idea funziona davvero. Tutto stava dentro `Form1.cs`. Duemilacinquantacinque righe, un solo file, nessuna vergogna.

Non era bello. Ma funzionava.

```text
Mondo · Elemento · ElementoAria · Essere
O2 · CO2 · Alga · Polline
PesceRosso · UovoRosso · PesceGiallo · UovoGiallo
DNA · Brain · Neuron · Input · Sinapsi
```

Dentro c'erano alghe, pesci rossi e pesci gialli, e una piccola catena alimentare: le alghe respiravano anidride carbonica ed emettevano ossigeno, i pesci rossi mangiavano le alghe, i pesci gialli mangiavano i pesci rossi. Ogni pesce aveva anche un cervello — `Brain`, `Neuron`, `Sinapsi` — che decideva dove muoversi, quando respirare, quando mangiare, quando riprodursi.

E dopo un po' di generazioni succedeva la cosa per cui l'avevo scritto: i pesci rossi cominciavano a muoversi verso le alghe e a scappare dai pesci gialli. Nessuno gliel'aveva insegnato. Era uscito da solo, dai numeri.

Ossigeno e anidride carbonica erano semplicemente pixel che si muovevano a caso di un passo per asse, e un essere li assorbiva se gli finivano dentro un'area di 3×3 pixel. Un dettaglio quasi ridicolo, se non fosse che ogni tanto le alghe si moltiplicavano troppo e l'anidride carbonica libera nel mondo finiva quasi del tutto.

Tienilo a mente: torna, molto più avanti in questa storia.

## Perché rifarlo, se già funzionava

La prima risposta è banale: perché era scritto malissimo. Duemila righe in un file solo, e in mezzo bug che non avevo mai davvero capito, come esseri che comparivano dal nulla, o sparivano senza motivo.

La seconda è tecnica. Quel mondo era discreto: coordinate intere, tutto su griglia. Portarlo in uno spazio continuo voleva dire comunque riscriverlo da capo.

La terza riguarda la parte interessante di una simulazione del genere. Nel vecchio acquario non potevo cliccare un essere e guardargli dentro. Non potevo capire _perché_ stesse facendo quello che faceva. E se la parte bella di un acquario artificiale è osservare il comportamento che emerge, questa non è una mancanza secondaria: è la mancanza principale.

Ma il motivo vero per cui l'ho ripreso in mano dopo venticinque anni è un altro: volevo costruire qualcosa di serio con gli agenti. Non l'ennesima app fatta in vibecoding per vedere un'interfaccia comparire in fretta. Volevo un progetto abbastanza ostinato da mettere davvero alla prova il metodo. E questo acquario ce l'avevo in testa da sempre.

## La differenza non è il sogno, è chi lo scrive

Se chiudo gli occhi e immagino la versione finita vedo dei cerchi che assorbono ed emettono gas, altri che si muovono cercando cibo, uno che attacca e uno che si difende, due che si accoppiano e depongono un uovo. Cioè esattamente la simulazione che avevo venticinque anni fa: alghe che scambiano gas, pesci rossi che cercano cibo, pesci gialli che attaccano, uova che si schiudono. Il punto non è che il sogno sia cambiato. Il punto è che oggi non voglio più scriverlo nello stesso modo.

Nel vecchio codice le specie erano sottoclassi:

```csharp
class Alga : Essere
class PesceRosso : Essere
class PesceGiallo : Essere
```

Ero io a decidere che l'alga fa fotosintesi e il pesce rosso mangia le alghe. L'evoluzione poteva al massimo regolare i parametri dentro quelle scatole, ma le scatole le avevo disegnate io, e di nuove non poteva costruirne. In AcquarioTS non esiste nessuna sottoclasse: esiste un organismo e un genoma, e il principio che sta in cima al documento di visione, _tutto è un organello_, è tecnicamente il rifiuto di quella gerarchia. Se emergeranno produttori e consumatori sarà perché conveniva, non perché li ho dichiarati in cima al file.

Il prezzo va detto subito, perché è alto: la v0.1 non ha cervello, non ha occhi, non ha predazione e non ha movimento diretto. Si muove di moto browniano e basta. `Brain`, `Neuron` e `Sinapsi` li ho già scritti una volta, da ragazzo, e riparto smontando quello che già avevo. Di proposito.

## Quattro documenti in cinque giorni

Prima di scrivere una riga di TypeScript ho fatto quattro giri di brainstorming, con due modelli diversi, nell'arco di cinque giorni.

Il primo ha prodotto la visione: tutto è un organello, l'organismo minimo, il sistema nervoso ricorrente, le mutazioni, l'obiettivo finale. Un documento bello, coerente ma completamente non implementabile, perché non conteneva nessun confine di versione: era tutto "la prima versione".

Il secondo ha aggiunto lo scope, ed è lì che la v0.1 nasce come cosa separata dal sogno: lo stack, la strategia di test, i confini rigidi, la popolazione iniziale generata da un genoma baseline, la griglia uniforme al posto del QuadTree, e perfino la motivazione della scelta scritta nero su bianco. Ed è sempre lì che la simulazione fluidodinamica è stata sostituita da tre pool globali ben mescolati, dichiarati per quello che sono: un'approssimazione a dimensione zero di quella vera.

Il terzo è sceso nella fisica: fotosintesi proporzionale alla larghezza proiettata verso la luce, scambi proporzionali al perimetro, ogni quantità espressa come rate moltiplicato per `dt`.

Il quarto giro è quello che ha prodotto i tredici ADR che stanno nel repository: un file per decisione, con la motivazione scritta accanto. Ed è anche il giro in cui il progetto ha smesso di sembrare semplice come me l'ero sempre immaginato.

## La riga sopravvissuta a tre revisioni

Nel primo documento la fotosintesi era questa:

```text
CO2 + luce -> energia + O2
```

Nel secondo è identica. Nel terzo è identica. Tre revisioni, due modelli diversi, cinque giorni di lavoro, e nessuno l'ha toccata; del resto non c'è niente che non vada, a guardarla: è la reazione che ti ricordi dalle medie.

In fondo la fotosintesi usa luce e anidride carbonica, no? Il problema è che quella reazione **non produce cibo**. Produce energia. Il carbonio entra come CO2 ed esce come niente.

Contemporaneamente, altrove nel documento, la morte convertiva la massa del corpo in cibo. Quindi il sistema faceva una cosa precisa: regalava materia nuova ogni volta che passava per il ciclo nascita-morte.

La luce del sole, in pratica, stava finanziando carbonio gratis.

Questo non è un dettaglio teorico. Significa che il pool di cibo cresce senza limite e che la frase "l'estinzione è un esito possibile ma emergente" diventa falsa. Se la materia si moltiplica da sola, l'ecosistema non può davvero reggersi o collassare: è truccato in partenza.

La correzione è modellare il cibo come carbonio puro e chiudere il bilancio:

```text
fotosintesi:  CO₂ + luce → cibo + O₂      fissa carbonio, non produce energia
respirazione: cibo + O₂  → energia + CO₂  l'unica fonte di energia del mondo
```

La mitosi paga massa in proporzione all'area del figlio, e la morte restituisce esattamente la massa pagata alla nascita. Con questa mossa due quantità diventano conservate per costruzione:

```text
carbonio = pool.food + pool.CO₂ + Σ food interno + Σ CO₂ interna + Σ bodyMass
ossigeno = pool.O₂  + pool.CO₂ + Σ O₂ interno   + Σ CO₂ interna
```

L'energia invece non si conserva, ed è voluto: è la valuta del lavoro, si produce e si spende. Il carbonio è la valuta della materia, e quella non si crea né si distrugge.

Ed ecco la parte che mi ha fatto sorridere quando me ne sono accorto. Da ragazzo, con i pixel, avevo già visto l'anidride carbonica del mondo finire quasi del tutto perché c'erano troppe alghe. Il tetto di carbonio non è un'idea nuova, uscita dal quarto giro di brainstorming: è la formalizzazione di una cosa che avevo guardato accadere sullo schermo, per caso, venticinque anni fa, senza sapere ancora che era importante.

## Il costo che non c'era

Il secondo errore stava da tutt'altra parte del documento e ha esattamente la stessa forma. In tutte e tre le versioni il costo energetico di un organismo era uno solo:

```text
costo ∝ area ∝ r²
```

Anche questa sembra ragionevole: un corpo più grande costa di più, in proporzione a quanto è grande. Poi però ho scritto il conto. L'organismo incassa per diffusione attraverso la membrana, quindi il guadagno è proporzionale al perimetro, lineare in `r`; vivere e riprodursi invece costa in proporzione all'area, che è quadratica. Il ritmo con cui riesci a riprodurti — quello che ti avanza, diviso per quanto costa un figlio — diventa

```text
reproductiveRate(r) ∝ (α·r − β·r²) / r² = α/r − β
```

cioè una funzione monotòna decrescente. Nessun massimo. Più piccolo è _sempre_ più adatto, senza limite: lasciata girare, la v0.1 avrebbe spinto `bodyRadius` fino al minimo numero rappresentabile in virgola mobile e si sarebbe fermata lì.

Sullo schermo, però, il risultato sarebbe sembrato plausibile: una popolazione che si rimpicciolisce, si stabilizza su un valore e ci resta, cioè esattamente come appare l'evoluzione quando trova un ottimo. Avrei festeggiato un fondo scala scambiandolo per un risultato.

Ho provato a difendere il modello con due argomenti. Il primo: un corpo grande ha più riserve, quindi la taglia si difende da sola. I conti dicono di no, perché l'autonomia è `kCap·πr² / (c₀ + β·πr²)`, e con `c₀ = 0` si riduce alla costante `kCap/β` — un organismo quattro volte più grande immagazzina quattro volte tanto e lo brucia quattro volte più in fretta. Il vantaggio della riserva è creato da `c₀`, e senza `c₀` non esiste. Il secondo argomento: prima o poi gli organelli limiteranno la taglia verso il basso, perché un corpo non può essere più piccolo di quello che contiene. Questo invece regge, ma vale dalla v0.2 in avanti; in v0.1 di organelli non ce n'è nemmeno uno, e quindi non c'è niente che fermi il collasso.

La correzione è un costo di esistenza: un termine piatto, indipendente dalla taglia, che paghi per il solo fatto di essere un organismo.

```text
reproductiveRate(r) ∝ α/r − c₀/r² − β        r_opt = 2·c₀/α
```

Siccome `c₀/r²` diverge quando `r → 0`, l'ottimo torna a essere interno. Esiste una taglia minima vitale perché esiste un costo che non puoi ridurre rimpicciolendoti.

## La soglia che poteva spegnere una stirpe

Il terzo è più breve da raccontare. Il gene `mitosisEnergyThreshold` era una quantità assoluta di energia con mutazione moltiplicativa, solo che l'energia ha un tetto, `kCap × bodyArea`: bastava una mutazione che spingesse la soglia sopra quel tetto perché quell'organismo non si riproducesse mai più, né lui né nessuno dei suoi discendenti. Una stirpe che si estingue perché un gene è finito fuori scala non è un effetto di fitness, è un incidente di modellazione travestito da selezione naturale. Adesso le due soglie riproduttive sono frazioni adimensionali in `[0, 1]`, e `bodyRadius` resta l'unico gene moltiplicativo.

## Cosa avevano in comune quei tre errori

Tre errori diversi, e tre volte la stessa forma. Nessuno dei tre lancia un'eccezione, nessuno produce un `NaN`, nessuno rompe un test: tutti e tre producono pallini colorati che si muovono, si dividono e sembrano vivi. E tutti e tre stavano dentro una riga plausibile:

- `CO2 + luce -> energia + O2`
- `costo ∝ area`
- "soglia di energia per riprodursi"

Questo è quello che ho imparato sul brainstorming con gli agenti, ed è la ragione per cui questo articolo esiste. Ogni giro ha aggiunto dettaglio, rigore, sezioni nuove, e nessuno dei primi tre è tornato indietro a chiedersi se le premesse si chiudessero. Un agente a cui chiedi di migliorare un documento migliora il documento; se vuoi che te lo demolisca devi chiederglielo, e devi chiedergli di fare i conti, non di rileggere. Il bug del raggio non l'ho trovato guardando del codice: l'ho trovato provando a giustificare per iscritto una scelta ovvia, e scoprendo che la giustificazione non si chiudeva.

## Un criterio che non è mio

E qui arriva la parte scomoda. La v0.1 è finita quando succedono tre cose:

1. **Conservazione** — carbonio e ossigeno costanti a meno dell'errore in virgola mobile.
2. **Determinismo** — lo stesso seme produce lo stesso hash di stato al tick N.
3. **Selezione, non deriva** — le medie di popolazione convergono su `r_opt = 2·c₀/α`, calcolato sulla carta _prima_ di far girare la simulazione.

Il terzo è quello che vale, perché la deriva non converge su un numero previsto in anticipo: solo la selezione lo fa. E devo confessare che quel criterio non l'ho proposto io — è emerso dall'agente, insieme all'export CSV che serve a misurarlo.

Se sono onesto, il giorno in cui la v0.1 girerà io guarderò il canvas, e il CSV non credo che lo aprirò con particolare entusiasmo. Anzi, peggio: se sul canvas vedessi pallini che si dividono e mi sembrasse bello, ma `bodyRadius` si fosse fermato al 60% di `r_opt`, la tentazione di andare avanti lo stesso ci sarebbe tutta. Ed è esattamente per questo che quel criterio serve. Un criterio di completamento che ti emoziona non è un criterio, è una speranza: "sembra vivo" non distingue la selezione dalla deriva, e non distingue un ottimo vero da un gene collassato in un fondo scala. Il valore di `r_opt` sta tutto nel fatto che è scomodo — è un numero calcolato prima, a cui non importa niente di quanto sia carina la simulazione. Se la simulazione incontra la forma chiusa ho ragione; se non la incontra ho un bug, non un'opinione.

C'è anche un corollario pratico, e questo invece mi piace parecchio. Con una quindicina di costanti libere, calibrare a tentativi vuol dire andare dove capita. Adimensionalizzando no: fisso `kCap = 1`, `β = 1`, `ρ = 1` e l'unità di lunghezza al raggio di partenza, e tre costanti spariscono per costruzione; poi scelgo l'`r_opt` che voglio vedere e ricavo `c₀ = α·r_opt/2`. Da problema di tuning a problema di algebra.

## Truccare i dadi

Resta una domanda aperta, e la risposta non ce l'ho ancora.

Voglio che emergano produttori e consumatori. Ma un generalista che fa un po' di fotosintesi e un po' di respirazione è già una strategia che funziona: perché mai dovrebbe specializzarsi? L'idea istintiva era premiare la specializzazione: se un generalista ricava 50 da una via e 50 dall'altra, chi punta tutto su una sola deve poter arrivare a 200. Solo che il documento di design dice il contrario: gli organelli hanno un costo fisso più un costo per area, con efficacia sublineare, cioè raddoppiare un organello rende meno del doppio. Con quella regola il generalista con due organelli piccoli batte lo specialista con uno grande, che è l'opposto di quello che voglio ottenere. La sublinearità comunque la tengo, perché è la cosa che rende reale il compromesso fra pochi organelli grandi e molti piccoli; come incentivare la specializzazione lo deciderò quando ci arrivo.

Ma la domanda di fondo resta un'altra: incentivare la specializzazione non è, in fondo, progettare il risultato invece di lasciarlo emergere? Sì, in un certo senso lo è. Però le regole del mondo le scrivo comunque io, sempre, non ho altri strumenti a disposizione. Posso scegliere quali leggi fisiche valgono, non posso scegliere quali strategie vincono dentro quelle leggi. Il confine, per me, sta esattamente qui: scrivere `class Alga : Essere` è dichiarare la risposta in anticipo. Scrivere una funzione di costo che renda conveniente specializzarsi è dichiarare il problema, e lasciare che sia il mondo a rispondere. Se fra un anno l'acquario producesse la scena che ho in testa, e per arrivarci avessi dovuto sistemare tre o quattro coefficienti, la considererei una vittoria piena.

## La cosa che temo

Non temo che sia difficile. Temo che sia noioso. Nello specifico, che gli organismi continuino a nascere e morire senza che nulla evolva mai, un rumore di fondo che non va da nessuna parte.

È un rischio che mi sono scelto. L'agente aveva suggerito di immettere cibo nel mondo di continuo, così da garantire sempre un minimo: quella era la rete di protezione. Il cibo disciolto c'è, e un giorno si comporterà come i due gas, ma cresce in un modo solo, quando un essere muore e rilascia il suo. Nessuno lo inietta dall'alto: il mondo ha il carbonio che ha, e l'unica cosa che entra dall'esterno è la luce. La rete di protezione l'ho lasciata fuori apposta, e lo rifarei: un'estinzione che non può accadere non è una simulazione, è un acquario finto.

## Il prossimo passo

Sei milestone, ognuna eseguibile da sola, ognuna che aggiunge esattamente un invariante, così quando un invariante si rompe ha una sola causa possibile. M0 è lo scheletro: accumulatore a passo fisso, PRNG con seme, canvas, pan, zoom, play, pausa, step, e l'invariante che aggiunge è il determinismo. Pan e zoom lì dentro non sono complicazioni inutili, sono strumenti di debug che userò in ogni milestone successiva. Poi corpi e movimento, metabolismo a popolazione immortale, morte, riproduzione, calibrazione, fino al primo `bodyRadius` che converge da solo su un numero che avevo scritto sulla carta.

Adesso, forse, posso scrivere codice.
