---
title: "La correzione che non ha cambiato niente"
description: "Un bug corretto che non sposta un numero smentisce metà di una diagnosi. La causa vera della v0.1 decide la forma di tutta la v0.2."
date: 2026-10-02
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - ai-agents
  - evolution
  - debugging
  - planning
lang: it
---

# La correzione che non ha cambiato niente

Il bug l'ha trovato un agente che cercava altro. Gli avevo chiesto una ricerca su come i microrganismi controllano la profondità, e nel rapporto finale, in una nota a margine, c'era una riga: il codice faceva vagare i corpi piccoli al doppio della velocità che la fisica gli concede. Il fix era una riga. Abbiamo rilanciato la simulazione, e la popolazione si è estinta negli stessi tempi di prima.

Una correzione che non cambia niente è un esperimento gratis. Questo è arrivato per caso, e ha smentito metà della spiegazione con cui avevo chiuso la versione precedente.

AcquarioTS è una simulazione di vita artificiale: organismi circolari in una vasca chiusa, dove il carbonio non entra e non esce, e l'unica cosa che arriva da fuori è la luce, forte in alto e sempre più debole verso il fondo. Un organismo trasforma la luce in cibo, il cibo in energia, e quando ne ha abbastanza si divide in due. Il figlio eredita il raggio del genitore con una piccola mutazione casuale, un po' più grande o un po' più piccolo. Nient'altro: nessun comportamento, nessuna specie scritta a mano.

La prima versione, la v0.1, non è mai riuscita a tenerne in vita una popolazione. In ogni run il raggio medio scendeva, generazione dopo generazione, finché i corpi diventavano troppo piccoli per mantenersi, e la vasca si svuotava. Chiudendo la versione avevo scritto anche il perché. Un corpo piccolo costa poco, quindi arriva prima a potersi dividere. E un corpo piccolo vaga più in fretta, quindi esce prima dalla banda di luce. Metà della spiegazione era economia, metà geografia.

Il bug stava proprio nella geografia.

La fisica chiama quel vagare _diffusione_, e la mia prima reazione è stata sbagliata:

> la diffusione ha senso che sia proporzionale alla membrana cellulare, quindi al raggio

Nel progetto la stessa parola copre due cose. C'è lo scambio di cibo e gas attraverso la membrana, che cresce col perimetro ed era giusto da sempre. E c'è il corpo intero che vaga, spinto dagli urti delle molecole d'acqua: il moto browniano. Il bug stava nel secondo, e l'agente si è fermato a chiedere quale dei due intendessi prima di toccare il codice.

Due diffusioni, una parola.

Per un corpo così piccolo l'acqua è melassa: ogni spinta diventa subito una velocità, la forza divisa per l'attrito, e l'attrito cresce col raggio. Questo il codice lo faceva giusto. Sbagliava la spinta, identica per tutti. Un corpo più grande ha più attrito, ma prende anche più urti, e la sua spinta deve crescere come la radice quadrata del raggio. Senza quella radice, un corpo di raggio 0,5 vagava al doppio di quanto la fisica gli concede: ecco da dove veniva la riga nel rapporto.

> ah quindi questo peggiorava anche la sopravvivenza spingendo i corpi piccoli a correre troppo.

Lo pensavamo tutti e due. Il fix, la radice del raggio al denominatore, a raggio 1 lascia il passo identico: il test che lo fissava non se n'è nemmeno accorto.

Poi abbiamo rilanciato il mondo sul codice corretto. Partiva con nove organismi, arrivava a mille, e intorno al passo quindicimila della simulazione non c'era più nessuno. Il raggio medio scendeva senza fermarsi: 0,84, 0,43, 0,24, 0,18. La stessa corsa verso il piccolo di prima, con gli stessi tempi.

La correzione non ha cambiato niente.

Senza volerlo, il fix era l'esperimento più pulito che la v0.1 non avesse mai fatto. Cambiava una cosa sola, quanto in fretta un corpo piccolo esce dalla luce, e lasciava ferme tutte le altre. Se la geografia fosse stata la causa, la popolazione avrebbe dovuto reggere meglio. Non l'ha fatto.

Un altro numero diceva la stessa cosa: il 99,4% degli organismi vivi stava nella banda di luce. Chi ne usciva moriva in fretta e spariva dal conteggio, ma la corsa verso il piccolo succedeva lì, in piena luce.

Non morivano perché uscivano dalla luce. Morivano dentro la luce.

Restava l'altra metà, l'economia: i piccoli arrivano prima a potersi dividere. Ma una spiegazione che poggia per metà su un bug, e sopravvive alla sua correzione senza che cambi niente, si merita un sospetto anche per la metà rimasta.

Tutto questo succedeva mentre pianificavamo la v0.2, la versione in cui gli organismi avrebbero finalmente avuto degli organelli: cloroplasti per fare più fotosintesi, propulsori per muoversi, neuroni per decidere quando. Prima di costruirla, io e l'agente stavamo tracciando una mappa: un issue su GitHub che elenca le decisioni da prendere, ognuna in un ticket suo, da risolvere una alla volta in conversazione. Le ricerche in letteratura l'agente le fa da solo, e da una di queste era uscito il bug.

La mappa l'avevo aperta con una frase:

> Building predation, eating or thrusters on top of a population that reliably goes extinct changes what those features even mean

Se una popolazione muore sempre, un propulsore che la salva non dice niente su a cosa serva un propulsore. Così uno dei primi ticket chiedeva perché la v0.1 morisse.

Il ticket offriva due colpevoli. La geografia, che il fix aveva appena messo in dubbio. E il margine metabolico: troppa poca energia per permettersi un figlio. Prima degli esperimenti l'agente aveva scritto nel ticket la sua previsione: la geografia conta poco, il colpevole è il tempo, perché i piccoli arrivano a dividersi prima di essere autosufficienti. Era la mia spiegazione con la metà sbagliata tolta.

Sbagliata anche quella.

Un figlio non si fa con l'energia. Il suo corpo è carbonio, e il genitore lo paga in cibo, che deve avere già dentro di sé. Il primo indizio è arrivato da una sonda su uno dei mondi di prova, una fotografia dello stato interno di ogni organismo. Quasi tutti avevano l'energia al 98% del massimo, ben sopra la soglia per dividersi. Il cibo interno stava a due terzi di quanto ne serve per costruire un corpo. Quanti potevano pagare un figlio grande quanto loro: zero.

Non mancava l'energia. Mancava il cibo per fare un figlio grande quanto sé.

> perché i figli non nascono mai più grandi dei genitori? non dovrebbe essere casuale?

L'agente aveva appena contato ogni nascita: circa il 100% dei figli più piccoli del genitore, nessuno più grande. Io ho letto il numero e ho fatto la domanda che toglie il pavimento.

La mutazione è casuale. Quello che non è casuale è quali nascite vanno a buon fine. Nel codice della v0.1 erano tre righe, in quest'ordine:

```ts
const childGenome = mutateGenome(parent.genome, parent.rng);
const massCost = RHO * bodyAreaOfRadius(childGenome.bodyRadius);
if (parent.food < massCost) return null;
```

Il genitore estrae la mutazione, prezza il figlio che ne esce, e se non ha abbastanza cibo rinuncia. Al passo dopo riprova, con un'estrazione nuova. Tira a sorte finché non esce un figlio abbastanza piccolo da permetterselo.

**Il setaccio.**

La corsa verso il piccolo non era selezione. Era un filtro alla nascita, che lasciava passare solo i figli rimpiccioliti: in media il 94% del raggio del genitore. Generazione dopo generazione, finché il raggio scendeva sotto la taglia a cui un corpo riesce a mantenersi, e la linea moriva.

Nessuno sceglie i piccoli. Passano solo quelli.

Il controllo decisivo non era nel ticket. L'agente l'ha aggiunto di sua iniziativa: una variante con la mutazione del raggio spenta, tutti a raggio 1 per sempre. Senza mutazione il setaccio non ha niente da filtrare. Sopravviveva in tutti e cinque i mondi di prova, con circa 135 organismi.

La variante che non misurava niente di quello che il ticket chiedeva è quella che ha risposto.

Spegnere la mutazione però non è una cura: senza mutazione non c'è evoluzione. La cura l'ho proposta io:

> potremmo fare che un genitore, per poter tentare una nascita, debba avere, oltre che un livello abbastanza alto di energia, anche abbastanza cibo per poter far nascere un ipotetico figlio con la mutazione che lo fa nascere x 1+u\*0.08, in modo che qualsiasi sia la sua dimensione casuale potrà andare a buon fine la nascita

Si paga prima il figlio più grande che la mutazione può produrre, e solo dopo si estrae:

```ts
const worstCost = RHO * bodyAreaOfRadius(parent.genome.bodyRadius * (1 + δ));
if (parent.food < worstCost) return null;
const childGenome = mutateGenome(parent.genome, parent.rng);
```

L'agente l'ha messa dietro un'opzione e l'ha misurata. Il setaccio è sparito: tre quarti dei figli identici al genitore, gli altri un po' più grandi o un po' più piccoli, come la mutazione vuole. Cinque mondi su cinque vivi, e il raggio medio che saliva, da 0,90 a 1,18 a fine run. Per la prima volta una popolazione dell'acquario andava verso la taglia che la teoria le assegnava, invece che allontanarsene.

Nella spec della v0.2 si chiama **Worst-Case Birth Gate**: un cancello alla nascita, tarato sul caso peggiore.

Il prezzo stava nei numeri accanto: 45 organismi, 334 nascite in centomila passi. La vasca era viva, ma quasi vuota.

> dovremo risolvere anche questa lentezza in futuro. aumentiamo il cibo prodotto per luce, ci penseremo.

L'abbiamo misurato, col gate acceso. Più cibo per ogni unità di luce, e le nascite calavano: da 6,1 a 2,7 per organismo ogni centomila passi. Lo stesso per ogni altra leva che rende la vita più economica. Le vite si allungavano, da diciassettemila passi fino a settantaquattromila, e i figli no.

Vivere più a lungo invece di fare più figli.

In una vasca chiusa un figlio non è fatto di energia ma di carbonio, e il carbonio che sta in un corpo vivo non è nell'acqua a disposizione di un altro. Rendere la vita più economica non aggiunge materia: la tiene chiusa nei corpi più a lungo. E un cloroplasto è esattamente "più cibo per unità di luce". Gli organelli della v0.2 non avrebbero riempito la vasca.

Chiudendo la v0.1 avevo scritto, in una decisione di progetto messa nero su bianco, che non restava nessuna leva da tirare. Era vero. Il guasto non era una leva: era l'ordine di tre righe.

E ha deciso la forma della v0.2 prima ancora che cominciassimo a disegnarla. Il ticket successivo chiedeva se curare la sopravvivenza prima degli organelli, insieme a loro o attraverso di loro. Dopo il setaccio la risposta era prima, per una ragione che la domanda non poteva vedere: un organello nuovo è un figlio che costa di più. Il setaccio avrebbe filtrato anche quello. Gli organelli sarebbero morti nella culla, scartati alla nascita da un controllo che nessuno aveva scritto contro di loro.

Da lì in poi, la mappa è stata disegnata con una domanda in testa: come fa una struttura nuova a nascere senza finire nel setaccio?

Nella v0.1 un figlio poteva cambiare solo raggio, e il figlio peggiore era facile da prezzare: il raggio del genitore più la mutazione massima. Nella v0.2 il genoma diventa una lista di organelli, ognuno con un tipo, una posizione e un raggio, e una mutazione può aggiungerne uno, toglierlo, duplicarlo o ingrandirlo. Quanto costa il figlio peggiore, adesso?

> non so se con l'introduzione degli organelli il genitore può sapere quanto costa il figlio più caro

Calcolarlo davvero vorrebbe dire provare tutte le mutazioni possibili. E un limite largo, preso per stare sicuri, renderebbe sterile chiunque abbia un organello grande.

L'agente ha proposto di rovesciare il problema: il genitore non calcola niente, è la legge di mutazione a garantire un tetto. Gli organelli nuovi nascono piccoli, una duplicazione non copia gratis un organello grande, e così nessun figlio può costare più di una frazione fissa in più del genitore. Per costruzione.

Il tetto lo garantisce la legge, non il genitore.

Restava una sola tentazione da evitare: far rispettare il tetto scartando le estrazioni che lo superano. Sarebbe stato di nuovo il setaccio, girato dall'altra parte.

Il tetto fisso è durato un ticket.

Il ticket sul genoma doveva decidere due cose. La prima era da dove viene la taglia di un corpo fatto di organelli. L'agente ha proposto di sommare le aree, citoplasma più organelli, così che la disposizione interna non cambiasse mai quanto è grande il corpo. Io ho scelto l'altra strada, quella che il documento di visione del progetto descriveva da sempre: gli organelli si spingono a vicenda finché non si sovrappongono più, e il corpo è il cerchio più piccolo che li contiene, più uno strato di citoplasma. Il corpo come conseguenza della sua forma interna.

La seconda era come si duplica un organello. L'agente ha proposto che la duplicazione divida invece di copiare: un organello diventa due pezzi, l'area totale resta quella, e il figlio non costa di più. Io ho voluto i due pezzi diseguali, da un quinto e quattro quinti fino a metà e metà.

Prese una per una, le due scelte reggevano. Messe insieme, no.

Due cerchi occupano più posto di uno. Dividere un organello conserva l'area, ma non il corpo: due cerchi che insieme hanno l'area di uno hanno bisogno di un cerchio più largo per starci dentro, a metà e metà circa 1,41 volte il raggio. Se l'organello riempiva quasi tutto il corpo, il figlio veniva grande quasi il doppio. L'ha notato l'agente, mettendo insieme la mia scelta sul corpo e quella sulla divisione.

Con un tetto fisso, il gate avrebbe chiesto a ogni genitore di poter pagare un figlio doppio, per colpa del caso peggiore di pochi. Un mondo quasi sterile.

L'agente mi ha raccomandato, dicendolo apertamente, di tornare indietro sulla taglia del corpo: con le aree sommate la divisione non costa niente, e il tetto torna una costante piccola. Io ho tenuto il corpo che nasce dalla forma. Il tetto lo calcola il genitore: una formula chiusa letta dal suo genoma, cioè dal suo organello più grande, dallo spessore del citoplasma e dal numero massimo di mutazioni per nascita.

Un ticket prima avevamo scritto che il genitore non calcola niente. Un ticket dopo torna a fare un conto. Non su tutte le mutazioni possibili, però: su una formula. E la formula esiste solo perché ogni tipo di organello dichiara come mutano i suoi parametri, scegliendo da un menu chiuso di leggi. Il caso peggiore di una legge dichiarata si legge nella dichiarazione.

Il prezzo della scelta è scritto nella decisione stessa, come rischio accettato. Un genitore con un organello grande deve tenere da parte molto più cibo di quanto spenderà davvero, perché il suo caso peggiore è grande, e quindi si riproduce più tardi. È una pressione contro gli organelli giganti che nessuno ha progettato. I figli restano un campione onesto della mutazione, quindi non è un setaccio. Ma è una selezione che viene dal gate, non dal mondo, e andrà guardata quando i primi organelli esisteranno davvero.

Il tetto risponde a metà della domanda: quanto può costare un figlio. L'altra metà è cosa fa una struttura appena nata. Un organello che il giorno della nascita peggiora l'organismo viene eliminato dalla selezione prima di avere il tempo di diventare utile. La ricerca sulle reti neurali evolute lo diceva chiaramente: senza protezioni speciali, la struttura nuova sopravvive solo se nasce economica e quasi neutra.

La regola si è vista meglio in un ticket dove sembrava c'entrare poco, quello sul modello del neurone. La ricerca consigliava di buttare due geni, soglia e scarica, e tenere un neurone continuo, più facile da evolvere. L'agente era d'accordo. Io mi ricordavo perché li avevamo messi:

> per poter modellare neuroni che si attivano sempre e non si azzerano, altri che accumulano fino ad attivarsi e azzerarsi. e tutte le configurazioni intermedie

Rispondendo, l'agente ha dovuto ammettere che con neuroni continui "accumula, scatta, si azzera" richiede due neuroni e tre o quattro collegamenti. Buttando i due geni si perdeva proprio la cosa per cui erano stati pensati.

La via d'uscita era già dentro i numeri. Con il fattore di scarica a 1, lo scatto non azzera niente. Il neurone nasce così, e da neonato è esattamente il neurone continuo che voleva la ricerca. Le mutazioni poi abbassano quel fattore un passo alla volta, e il reset diventa sempre più forte.

Non ha vinto nessuna delle due proposte. Il meccanismo resta, ma nasce spento.

Nasce spento è diventata la regola di tutta la v0.2. Ogni struttura nuova entra in un modo che non cambia niente, e comincia a contare solo quando la mutazione la sposta:

- **il neurone** nasce con il fattore di scarica a 1, cioè senza reset;
- **un neurone inserito** nasce senza collegamenti, e **una sinapsi**, il collegamento fra due neuroni, nasce con un peso piccolo;
- **la divisione di un neurone** copia i collegamenti in entrata su entrambi i pezzi e divide i pesi in uscita nella stessa proporzione delle aree, così chi sta a valle riceve esattamente lo stesso segnale di prima.

Il caso più estremo l'abbiamo deciso nell'ultimo ticket della mappa, quello che divide la costruzione della v0.2 in otto tappe, ognuna con una sola cosa nuova da verificare. Il primo organello della v0.2 è un neurone senza sinapsi, perché le sinapsi arrivano quattro tappe dopo. Non fa niente: occupa spazio e paga il suo costo. Ma proprio per questo mette al lavoro tutto il macchinario nuovo (l'inserimento, la divisione, il corpo che si allarga, il tetto) su organismi vivi, senza toccare nient'altro del mondo. L'ha proposto l'agente, e io ho detto sì al secondo giro: al primo non avevo capito una parola della domanda.

Il primo organello della v0.2 non serve a niente, ed è per questo che arriva per primo.

Un organello che non fa niente ha anche un'altra proprietà: è il controllo di se stesso. Se i neuroni senza sinapsi restano rari, è perché il loro costo pesa. Se si diffondessero, vorrebbe dire che il costo non morde.

Per un organello che fa qualcosa la domanda è più difficile: si diffonde perché serve, o per caso? Una formula che dica quanto dovrebbe essere frequente non c'è. Resta il confronto: lo stesso mondo, con lo stesso seme casuale, con l'organello acceso e spento.

In genetica si chiama knockout: si spegne un gene e si guarda cosa smette di funzionare. Qui si spegne un organello in un mondo intero. Ma spegnerlo del tutto sarebbe stato il controllo sbagliato. Un mondo senza float, l'organello più leggero dell'acqua che solleva un corpo verso la luce, non paga i float, non perde il loro spazio, non spreca su di loro le mutazioni. Se nel mondo vero i float fossero più frequenti, non si saprebbe se è per quello che fanno o per quello che costano.

La regola l'ha proposta l'agente e io l'ho confermata: **funzione spenta, costo acceso**. Nel mondo di controllo il float continua a nascere, a pagare, a occupare spazio, solo che non solleva più. Il caso lavora identico nei due mondi, e l'unica differenza è quella che la selezione può vedere. La v0.2 sarà finita quando il mondo vero batterà il suo controllo in cinque coppie su cinque, non in media.

È nasce spento, applicato a un mondo intero.

La mappa si è chiusa con tredici ticket chiusi su tredici, e con vuota la sezione delle cose ancora troppo vaghe per farne un ticket. L'ultima voce, il dubbio che organelli e neuroni rallentino troppo la simulazione, non è stata risolta ma consegnata alla tappa che la incontrerà, con la regola che il progetto si è dato dal primo giorno: prima costruisci, poi misuri. Della v0.2 non esiste ancora una riga di codice. Era la destinazione: una spec, non un cantiere.

La tabella delle tappe ha otto righe. La prima contiene una cosa sola, il gate al caso peggiore: tre righe di codice rimesse nell'ordine giusto. Ci è arrivata perché una correzione non ha cambiato niente.
