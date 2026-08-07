# Venticinque anni per cancellare una sottoclasse

Venticinque anni fa avevo vent'anni e ho scritto un acquario in C#. Duemilacinquantacinque righe, tutte dentro `Form1.cs`.

Funzionava. Non "girava": funzionava.

```text
Mondo · Elemento · ElementoAria · Essere
O2 · CO2 · Alga · Polline
PesceRosso · UovoRosso · PesceGiallo · UovoGiallo
DNA · Brain · Neuron · Input · Sinapsi
```

C'erano alghe, pesci rossi e pesci gialli. Le alghe respiravano anidride carbonica ed emettevano ossigeno. I pesci rossi mangiavano le alghe. I pesci gialli mangiavano i pesci rossi.

I pesci avevano un cervello — `Brain`, `Neuron`, `Sinapsi` — che decideva dove muoversi, quando respirare, quando mangiare e quando riprodursi.

E dopo un po' di generazioni succedeva la cosa per cui l'avevo scritto: **i pesci rossi si muovevano verso le alghe e scappavano dai pesci gialli.** Nessuno gliel'aveva detto.

Ossigeno e anidride carbonica erano pixel. Si spostavano a caso di un passo per asse, e un essere poteva assorbirli se gli finivano dentro il proprio 3×3.

Ogni tanto le alghe si moltiplicavano troppo e l'anidride carbonica libera del mondo finiva quasi del tutto. Tienilo a mente, perché torna.

## Perché rifarlo, se funzionava

Era scritto malissimo. Duemila righe in un file solo, e bug che non ho mai trovato: esseri che comparivano e sparivano dal nulla.

Era discreto — coordinate intere, tutto su griglia — e trasformarlo in un mondo continuo voleva dire riscriverlo comunque da capo.

E non potevo cliccare un essere per guardarci dentro. In una simulazione dove l'unica cosa interessante è capire *perché* un individuo fa quello che fa, è una mancanza grave.

Ma la ragione vera per cui lo rifaccio adesso, dopo venticinque anni, è un'altra: volevo costruire qualcosa di serio con gli agenti.

Non l'ennesima app in vibecoding che non serve a niente. Un progetto abbastanza difficile da mettere alla prova il metodo. E questo ce l'avevo già in testa da sempre.

## La differenza non è il sogno, è chi lo scrive

Se chiudo gli occhi e immagino la versione finita, vedo questo.

Cerchi che assorbono ed emettono gas. Altri che si muovono in cerca di cibo. Uno attacca, un altro si difende. Due si accoppiano e depongono un uovo.

È **esattamente** la simulazione che avevo venticinque anni fa. Alghe che scambiano gas, pesci rossi che cercano cibo, pesci gialli che attaccano, uova che si schiudono.

Il sogno non è cambiato di una virgola. Quello che cambia è chi lo scrive.

Nel vecchio codice le specie erano sottoclassi:

```csharp
class Alga : Essere
class PesceRosso : Essere
class PesceGiallo : Essere
```

Ero io a decidere che l'alga fa fotosintesi e il pesce rosso mangia le alghe. L'evoluzione poteva regolare i parametri dentro quelle scatole. Non poteva costruirne di nuove.

In AcquarioTS non esiste nessuna sottoclasse. Esiste un organismo e un genoma. Il principio "tutto è un organello" è, tecnicamente, il rifiuto di quella gerarchia.

Se emergeranno produttori e consumatori, sarà perché conveniva — non perché li ho dichiarati io in cima al file.

Questo ha un prezzo, e va detto subito. La v0.1 **non ha cervello, non ha occhi, non ha predazione e non ha movimento diretto.** Si muove di moto browniano e basta.

`Brain`, `Neuron` e `Sinapsi` li ho già scritti una volta, da ragazzo. Riparto da meno di quello che avevo, di proposito.

## Quattro documenti in cinque giorni

Prima di scrivere una riga di TypeScript ho fatto quattro giri di brainstorming, con due modelli diversi, nell'arco di cinque giorni.

**Primo giro, con Claude.** La visione: tutto è un organello, l'organismo minimo, il sistema nervoso ricorrente, le mutazioni, l'obiettivo finale.

Un documento bello, coerente e completamente non implementabile. Non c'era dentro nessun confine di versione: era tutto "la prima versione".

**Secondo giro, con Copilot.** Lo scope. È qui che nasce la v0.1 come cosa separata dal sogno.

Copilot ha aggiunto lo stack, la strategia di test, i confini rigidi, la popolazione iniziale da un genoma baseline, e la griglia uniforme al posto del QuadTree — con la motivazione scritta accanto.

E ha sostituito la simulazione fluidodinamica con tre pool globali ben mescolati, dichiarandoli un'approssimazione a dimensione zero di quella vera.

**Terzo giro, con Claude.** I dettagli fisici: fotosintesi proporzionale alla larghezza proiettata verso la luce, scambi proporzionali al perimetro, quantità espresse come rate moltiplicate per `dt`.

**Quarto giro**, quello che ha prodotto i tredici ADR nel repository. Ed è il giro in cui è venuto giù tutto.

## La riga sopravvissuta a tre revisioni

Nel primo documento la fotosintesi era questa:

```text
CO2 + luce -> energia + O2
```

Nel secondo documento è identica. Nel terzo è identica. Tre revisioni, due modelli diversi, cinque giorni di lavoro — e nessuno l'ha toccata.

Il problema è che quella reazione **non produce cibo**. Produce energia. Il carbonio entra come CO₂ ed esce come niente.

Nel frattempo, dall'altra parte del documento, la morte convertiva la massa del corpo in cibo. Ma nessuno aveva mai *pagato* quella massa.

Ogni ciclo nascita–morte coniava materia dal nulla, finanziata dalla luce del sole. Il pool di cibo cresce senza limite e non esiste nessuna capacità portante.

Cioè: la frase "l'estinzione è un esito possibile ma emergente" — scritta nero su bianco nel secondo documento — era falsa. Dove la materia si moltiplica da sola, l'estinzione non può emergere.

La correzione è modellare il cibo come **carbonio puro** e chiudere il bilancio.

```text
fotosintesi:  CO₂ + luce → cibo + O₂      fissa carbonio, non produce energia
respirazione: cibo + O₂  → energia + CO₂  l'unica fonte di energia del mondo
```

La mitosi paga massa in proporzione all'area del figlio, e la morte restituisce esattamente la massa pagata alla nascita. Due quantità diventano conservate:

```text
carbonio = pool.food + pool.CO₂ + Σ food interno + Σ CO₂ interna + Σ bodyMass
ossigeno = pool.O₂  + pool.CO₂ + Σ O₂ interno   + Σ CO₂ interna
```

L'energia invece non si conserva, ed è voluto: è la valuta del *lavoro*, si produce e si spende. Il carbonio è la valuta della *materia*, e non si crea.

Ed ecco la parte che mi ha fatto sorridere.

Da ragazzo, con i pixel, avevo già visto l'anidride carbonica del mondo finire quasi del tutto perché c'erano troppe alghe.

Il tetto di carbonio non è un'idea nuova del quarto giro di brainstorming. È la formalizzazione di una cosa che avevo guardato accadere sullo schermo, per caso, venticinque anni fa.

## Il costo che non c'era

Stessa storia, altro punto del documento. In tutte e tre le versioni il costo energetico era uno solo:

```text
costo ∝ area ∝ r²
```

Sembra ragionevole. Un corpo più grande costa di più, in proporzione a quanto è grande.

Poi ho scritto il conto. L'organismo incassa per diffusione attraverso la membrana, quindi il guadagno è proporzionale al **perimetro**: lineare in `r`. Un figlio costa in proporzione all'**area**: quadratico.

```text
reproductiveRate(r) ∝ (α·r − β·r²) / r² = α/r − β
```

Monotòna decrescente. Nessun massimo. Più piccolo è **sempre** più adatto, senza limite.

Lasciata girare, la v0.1 avrebbe spinto `bodyRadius` fino al minimo numerico rappresentabile e si sarebbe fermata lì.

E sullo schermo lo avrei visto come una popolazione che si rimpicciolisce, si stabilizza a un valore e ci resta. Cioè **esattamente come appare l'evoluzione che trova un ottimo.**

Avrei festeggiato un fondo scala.

Ho provato a difendere il modello. Primo argomento: un corpo grande ha più riserve, quindi la taglia si difende da sola.

I conti dicono di no. L'autonomia è `kCap·πr² / (c₀ + β·πr²)`, e con `c₀ = 0` si riduce alla costante `kCap/β`.

Un organismo quattro volte più grande immagazzina quattro volte tanto e lo brucia quattro volte più in fretta. Il vantaggio della riserva **è creato da `c₀`**: non esiste senza.

Secondo argomento: in futuro gli organelli limiteranno comunque la taglia verso il basso, perché un corpo non può essere più piccolo di quello che contiene.

Questo invece **regge** — ma vale dalla v0.2 in poi. In v0.1 organelli non ce ne sono, quindi non c'è niente che fermi il collasso.

La correzione è un **costo di esistenza**: un termine piatto, indipendente dalla taglia, pagato per il solo fatto di essere un organismo.

```text
reproductiveRate(r) ∝ α/r − c₀/r² − β        r_opt = 2·c₀/α
```

Siccome `c₀/r²` diverge quando `r → 0`, l'ottimo torna a essere interno. Esiste una taglia minima vitale perché esiste un costo che non puoi ridurre rimpicciolendoti.

## Cosa avevano in comune

Ce n'è un terzo, più breve. Il gene `mitosisEnergyThreshold` era una quantità assoluta di energia, con mutazione moltiplicativa.

Ma l'energia ha un tetto, `kCap × bodyArea`. Bastava che una mutazione spingesse la soglia sopra il tetto perché quell'organismo non si riproducesse mai più. Né lui, né i suoi discendenti.

Una stirpe che si estingue perché un gene è finito fuori scala non è un effetto di fitness. È un incidente di modellazione travestito da selezione naturale.

Ora le due soglie riproduttive sono frazioni adimensionali in `[0, 1]`, e `bodyRadius` resta l'unico gene moltiplicativo.

Tre errori diversi, tre forme identiche.

Nessuno dei tre lancia un'eccezione. Nessuno produce un NaN. Nessuno rompe un test. Tutti e tre producono pallini colorati che si muovono, si dividono e sembrano vivi.

E tutti e tre stavano dentro **una riga plausibile**: `CO2 + luce -> energia + O2`, `costo ∝ area`, "soglia di energia per riprodursi".

Questo è quello che ho imparato sul brainstorming con gli agenti, ed è la ragione per cui questo articolo esiste.

Ogni giro ha aggiunto dettaglio, rigore e sezioni nuove. Nessuno dei primi tre è tornato indietro a chiedersi se le premesse si chiudessero.

Un agente a cui chiedi di migliorare un documento migliora il documento. Se vuoi che lo demolisca devi chiederglielo, e devi chiedergli di **fare i conti**, non di rileggere.

Il bug del raggio non l'ho trovato guardando del codice. L'ho trovato provando a giustificare per iscritto una scelta ovvia, e scoprendo che la giustificazione non si chiudeva.

## Un criterio che non è mio

E qui arriva la parte scomoda.

La v0.1 è finita quando succedono tre cose:

1. **Conservazione.** Carbonio e ossigeno costanti a meno dell'errore in virgola mobile, su 100.000 tick.
2. **Determinismo.** Lo stesso seme produce lo stesso hash di stato al tick N.
3. **Selezione, non deriva.** Le medie di popolazione convergono su `r_opt = 2·c₀/α`, calcolato sulla carta *prima* di far girare la simulazione.

Il terzo è quello che vale. La deriva non converge su un numero previsto in anticipo: solo la selezione lo fa.

Confessione: **quel criterio non l'ho proposto io.** È emerso dall'agente, insieme all'export CSV che serve a misurarlo.

E se sono onesto, il giorno in cui la v0.1 girerà io guarderò il canvas. Il CSV non credo che lo aprirò con particolare entusiasmo.

Anzi, peggio. Se sul canvas vedessi pallini che si dividono e mi sembrasse bello, ma `bodyRadius` si fosse fermato al 60% di `r_opt`, la tentazione sarebbe di andare avanti lo stesso.

Ed è **esattamente per questo** che quel criterio serve.

Un criterio di completamento che ti emoziona non è un criterio: è una speranza. "Sembra vivo" non distingue la selezione dalla deriva, né da un gene collassato in un fondo scala.

Il valore di `r_opt` è che è scomodo. È un numero calcolato prima, a cui non importa niente di quanto sia carina la simulazione.

Se la simulazione incontra la forma chiusa, ho ragione. Se non la incontra, ho un bug — non un'opinione.

C'è anche un corollario pratico che invece mi piace parecchio. Con una quindicina di costanti libere, calibrare a tentativi va dove capita.

Invece si adimensionalizza: fisso `kCap = 1`, `β = 1`, `ρ = 1` e l'unità di lunghezza al raggio di partenza. Tre costanti eliminate per costruzione.

Poi **scelgo** l'`r_opt` che voglio vedere e ricavo `c₀ = α·r_opt/2`. Da problema di tuning a problema di algebra.

## Truccare i dadi

Resta una domanda aperta, e non ho ancora la risposta.

Voglio che emergano produttori e consumatori. Ma un generalista che fa un po' di fotosintesi e un po' di respirazione è già una strategia che funziona: perché mai dovrebbe specializzarsi?

La mia idea istintiva era premiare la specializzazione. Se un generalista ricava 50 da una via e 50 dall'altra, chi punta tutto su una sola deve poter arrivare a 200.

Solo che il documento di design dice il contrario. Gli organelli hanno costo fisso più costo per area, con **efficacia sublineare**: raddoppiare un organello rende meno del doppio.

Con quella regola il generalista con due organelli piccoli batte lo specialista con uno grande. È l'opposto di quello che voglio ottenere.

Tengo la sublinearità, perché è ciò che rende reale il compromesso fra pochi organelli grandi e molti piccoli. Come incentivare la specializzazione lo deciderò quando ci arrivo.

Ma la domanda vera è un'altra: **incentivare la specializzazione non è progettare il risultato, invece di lasciarlo emergere?**

Sì. Però le regole del mondo le scrivo io comunque. Non ho altri strumenti: posso scegliere quali leggi valgono, non quali strategie vincono.

Il confine, per me, sta qui. Scrivere `class Alga : Essere` è dichiarare la risposta. Scrivere una funzione di costo che renda conveniente specializzarsi è dichiarare il problema.

Se fra un anno l'acquario producesse la scena che ho in testa, e per arrivarci avessi dovuto sistemare tre o quattro coefficienti, la considererei una vittoria piena.

## La cosa che temo

Non è che sia difficile. È che sia noioso.

Nello specifico: che gli organismi continuino a nascere e morire senza che nulla evolva mai. Un rumore di fondo che non va da nessuna parte.

È un rischio che mi sono scelto. Nella versione di venticinque anni fa c'era del nutrimento disperso nell'acqua che serviva — scritto proprio così — *a evitare estinzioni complete*.

Nella nuova quel nutrimento esiste ancora, ma non arriva più da fuori. Nessuno lo inietta. Il mondo ha il carbonio che ha, e l'unica cosa che entra dall'esterno è la luce.

La rete di protezione l'ho tolta apposta, e la rifarei. Un'estinzione che non può accadere non è una simulazione: è un acquario finto.

## Il prossimo passo

Sei milestone, ognuna eseguibile da sola, ognuna che aggiunge **esattamente un invariante**. Così quando un invariante si rompe ha una sola causa possibile.

M0 è lo scheletro: accumulatore a passo fisso, PRNG con seme, canvas, pan, zoom, play/pausa/step. L'invariante che aggiunge è il determinismo.

Pan e zoom in M0 non sono scope creep: sono strumenti di debug, e li userò in ogni milestone successiva.

Poi corpi e movimento, metabolismo a popolazione immortale, morte, riproduzione, calibrazione. Fino al primo `bodyRadius` che converge da solo su un numero che avevo scritto sulla carta.

Adesso posso scrivere codice.