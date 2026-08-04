# Il branch che non ha prodotto una riga di codice

Ho appena chiuso il primo branch di AcquarioTS. Contiene tredici ADR, un glossario di quaranta termini e un documento di design da seicento righe. Non contiene una riga di TypeScript.

Non è procrastinazione travestita da metodo. È che tre volte, in quelle sessioni di design, sono arrivato a un passo dallo scrivere una simulazione che mi avrebbe mentito.

## Cos'è AcquarioTS

Un acquario 2D in cui organismi autonomi evolvono per selezione naturale. Nessuno progetta la morfologia, il metabolismo o il comportamento: l'idea è che emergano. La v0.1 ha l'organismo minimo — un cerchio che fotosintetizza, respira, si muove di moto browniano e si divide per mitosi — con un genoma di quattro geni e un mondo chiuso in cui l'unico ingresso esterno è la luce.

Il punto interessante non è farlo funzionare. È **accorgersi se non sta funzionando**. Ed è esattamente lì che una simulazione di vita artificiale è più pericolosa di quasi ogni altro software: quando sbaglia, di solito continua a girare, e sullo schermo si vedono pallini che nascono e muoiono. Sembra viva. Sembra sempre viva.

## Bugia numero uno: il raggio che collassa a zero

Nella prima stesura ogni costo energetico scalava con l'area del corpo. Sembra ragionevole: un corpo più grande costa di più, in proporzione a quanto è grande.

Poi ho scritto il conto. L'organismo incassa risorse per diffusione attraverso la membrana, quindi il guadagno è proporzionale al **perimetro** — lineare in `r`. Un figlio costa in proporzione all'**area** — quadratico in `r`. Il tasso riproduttivo diventa:

```text
reproductiveRate(r) ∝ (α·r − β·r²) / r² = α/r − β
```

Monotòna decrescente. Non ha un massimo. Più piccolo è **sempre** più adatto, senza limite. Lasciata girare, la v0.1 avrebbe spinto `bodyRadius` fino al suo minimo numerico e si sarebbe fermata lì.

E questo è il punto: sullo schermo lo avrei visto come una popolazione di organismi che si rimpiccioliscono, si stabilizzano a un valore, e ci restano. Cioè **esattamente come appare l'evoluzione che trova un ottimo**. Avrei festeggiato un fondo scala.

La correzione è un termine piatto — un costo di esistenza `c₀` che non dipende dalla taglia, pagato per il solo fatto di essere un organismo:

```text
reproductiveRate(r) ∝ α/r − c₀/r² − β        r_opt = 2·c₀/α
```

Siccome `c₀/r²` diverge quando `r → 0`, l'ottimo torna a essere interno. Esiste una taglia minima vitale perché esiste un costo che non puoi ridurre rimpicciolendoti.

Ho provato a cavarmela dicendo che tanto un corpo grande immagazzina più riserve, e quindi la taglia si difende da sola. Anche lì, il conto dice di no: l'autonomia è `kCap·πr² / (c₀ + β·πr²)`, e con `c₀ = 0` si riduce alla costante `kCap/β`. Un organismo quattro volte più grande immagazzina quattro volte tanto e lo brucia quattro volte più in fretta. Il vantaggio della riserva **è creato da `c₀`**, non esiste indipendentemente da lui.

## Bugia numero due: il cibo creato dal nulla

Seconda stesura del metabolismo: la fotosintesi produceva energia direttamente, e la morte convertiva la massa corporea in cibo. Nessuno, però, aveva mai *pagato* quella massa.

Ogni ciclo nascita–morte conia cibo dal niente, finanziato dalla luce del sole. Il pool di cibo cresce senza limite. Non esiste una capacità portante. E soprattutto: la frase "l'estinzione è un esito emergente" diventa falsa, perché in un mondo dove la materia si moltiplica da sola l'estinzione non può emergere.

La correzione è stata modellare il cibo come **carbonio puro** e chiudere il bilancio. La fotosintesi fissa carbonio senza produrre energia (`CO₂ + luce → cibo + O₂`), la respirazione è l'unica fonte di energia (`cibo + O₂ → energia + CO₂`), la mitosi paga massa in proporzione all'area del figlio, e la morte restituisce esattamente la massa pagata alla nascita.

Due quantità diventano conservate esattamente, e la simulazione le asserisce a ogni tick:

```text
carbonio = pool.food + pool.CO₂ + Σ food interno + Σ CO₂ interna + Σ bodyMass
ossigeno = pool.O₂  + pool.CO₂ + Σ O₂ interno   + Σ CO₂ interna
```

L'energia, deliberatamente, non si conserva: è la valuta del *lavoro*, viene prodotta e spesa. Il carbonio è la valuta della *materia*, e non si crea.

Il regalo inatteso è che questa asserzione è diventata il miglior rilevatore di bug del progetto. Quasi ogni errore metabolico si manifesta prima come una perdita in questi due numeri, molto prima di diventare visibile come comportamento strano. E sopravvivrà alla v0.1: quando arriverà il solver fluidodinamico, la sua advezione semi-lagrangiana sarà stabile ma non conservativa, e sarà questo test a beccarla mentre si mangia il 2% della CO₂ ogni mille tick.

## Bugia numero tre: le stirpi sterili

Il gene `mitosisEnergyThreshold` era nato come una quantità assoluta di energia, con mutazione moltiplicativa. Ma l'energia è limitata da un tetto, `kCap × bodyArea`. Quindi bastava che la mutazione spingesse la soglia **sopra il tetto** perché l'organismo non potesse più riprodursi — mai più, e nessuno dei suoi discendenti.

Una stirpe che si estingue perché il suo gene è finito fuori scala non è un effetto di fitness. È un incidente di modellazione che assomiglia moltissimo a selezione naturale.

Ora le due soglie riproduttive sono **frazioni adimensionali in `[0, 1]`** che mutano additivamente con clamping, e `bodyRadius` resta l'unico gene moltiplicativo. Il genoma ha una legge di mutazione per i rapporti e una per le scale, invece di due arbitrarie. E il compromesso r/K diventa leggibile: soglia bassa significa riprodursi presto e magri, soglia alta significa accumulare e riprodursi grassi.

## Il filo che le lega

Tre bug diversi, un'unica forma: **la simulazione avrebbe continuato a girare, e sarebbe sembrata viva.** Nessuno dei tre lancia un'eccezione. Nessuno dei tre produce un NaN. Tutti e tre producono pallini colorati che si muovono e si dividono.

È il motivo per cui non basta scrivere gli ADR come registro di ciò che ho deciso: quello che li rende utili è la sezione *perché*. Il bug del raggio non l'ho trovato guardando del codice — l'ho trovato provando a giustificare per iscritto una scelta che mi sembrava ovvia, e scoprendo che la giustificazione non si chiudeva.

## Come faccio a sapere se la v0.1 è finita

Ed è qui che casca la parte più importante. "Sembra viva" non distingue la selezione dalla deriva, né da un gene che collassa in un fondo scala numerico. Serve un criterio falsificabile, e la v0.1 ne ha tre:

1. **Conservazione.** Carbonio e ossigeno costanti a meno dell'errore in virgola mobile, su 100.000 tick.
2. **Determinismo.** Lo stesso seme produce lo stesso hash di stato al tick N.
3. **Selezione, non deriva.** Le medie di popolazione dei geni convergono nello stesso intorno partendo da semi diversi e da genomi di partenza diversi. E soprattutto convergono su `r_opt = 2·c₀/α`, **calcolato sulla carta prima di far girare la simulazione**.

Il terzo è quello che vale. La deriva non converge su un numero previsto in anticipo: solo la selezione lo fa. Quando la simulazione incontra la forma chiusa, la v0.1 è corretta — e se non la incontra, ho un bug, non un'opinione.

C'è un corollario pratico che mi piace. Con quindici costanti libere, la calibrazione a tentativi va dove capita. Invece si adimensionalizza: fisso `kCap = 1`, `β = 1`, `ρ = 1` e l'unità di lunghezza al raggio di partenza — tre costanti eliminate per costruzione — poi **scelgo** l'`r_opt` che voglio vedere e ricavo `c₀ = α·r_opt/2`. Da problema di tuning a problema di algebra.

## Il prossimo passo

Sei milestone, ognuna eseguibile da sola, ognuna che aggiunge **esattamente un invariante** — così quando un invariante si rompe ha una sola causa possibile. M0 è lo scheletro: accumulatore a passo fisso, PRNG con seme, canvas, pan, zoom, play/pausa/step. L'invariante che aggiunge è il determinismo.

Pan e zoom in M0 non sono scope creep: sono strumenti di debug, e li userò in ogni milestone successiva.

Adesso posso scrivere codice.