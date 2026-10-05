---
title: "Il neurone che non fa niente"
description: "Il primo pezzo del corpo che la simulazione impara a evolvere è un disco inerte. Serve a sapere chi rompe cosa, e a scoprire quanto poco si lascia misurare."
date: 2026-10-06
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
  - evolution
  - testing
  - ai-agents
  - predictions
lang: it
---

# Il neurone che non fa niente

Il primo neurone della simulazione non fa niente. È un disco che occupa spazio, paga un costo fisso a ogni tick e rende più caro il figlio che lo eredita. L'abbiamo messo lì apposta, prima di qualunque funzione, perché quando qualcosa si rompe vogliamo sapere se la colpa è della macchina o di quello che la macchina trasporta.

AcquarioTS è una simulazione di vita artificiale: organismi circolari in una vasca chiusa, dove il carbonio non entra e non esce e l'unica cosa che arriva da fuori è la luce. Fin qui un organismo era un cerchio con quattro geni e niente dentro: un raggio, due geni che decidono quando dividersi e quanto dare al figlio, e un colore per riconoscere la discendenza. La v0.2 vuole riempire quel cerchio, e per riempirlo bisogna prima poter descrivere un corpo che ha una struttura. [L'articolo precedente](./009-il-figlio-piu-caro.md) racconta la legge che tiene viva la vasca: un genitore si divide solo se può permettersi il figlio peggiore che la mutazione potrebbe produrre. Questo parla di cosa succede a quella legge quando il figlio peggiore può avere qualcosa dentro.

Un neurone senza sinapsi, cioè senza fili che lo colleghino a qualcosa, non fa niente di utile, e per questo viene per primo. Non pesa, quindi la gravità può aspettare. Non partecipa a nessuna reazione, quindi il carbonio resta quello che è e la conservazione non è in gioco. Il resto della v0.2, galleggianti, cloroplasti, propulsori, ha bisogno della stessa macchina: un genoma che descrive pezzi e non solo un raggio, una mutazione che li inserisce, li cancella, li divide e li sposta, un corpo che segue la loro disposizione e un costo per ognuno. Costruirla insieme a un pezzo che funziona avrebbe lasciato ogni rottura con due colpevoli possibili. Con un disco inerte, il colpevole è uno solo.

> cosa intendi per MEC?

L'agente ha scritto "MEC" in tutte e sei le domande del primo round di grill. Era il _minimum enclosing circle_, il cerchio più piccolo che contiene tutti i dischi di un corpo, e il corpo intero è quel cerchio più uno strato di citoplasma attorno. Nelle formule di ADR-0028 e nella vision compariva da settimane, nel glossario non c'era. Fabio ha chiesto cosa fosse, da autore del progetto, e quella è stata la prova: una sigla che nessuno ha definito e che chi guida il progetto non riconosce non è vocabolario condiviso, è vocabolario dell'agente. Il glossario ha guadagnato **Enclosing Circle** per una domanda da principiante.

La domanda ha fatto più che aggiungere una riga al glossario, perché la prima del round dipendeva da quel termine: dove nasce un organello inserito? ADR-0028 diceva "dentro il cerchio attuale", la vision "dentro il corpo attuale". Sembrano la stessa frase e sono due frasi diverse. Un disco nato dentro il corpo ma fuori dagli altri dischi, sul bordo del citoplasma, allarga il cerchio di circa mezzo spessore di citoplasma. Un disco nato dentro il cerchio lo allarga al massimo di due volte il proprio raggio, e il proprio raggio alla nascita è piccolo per costruzione. Il Birth Cost Ceiling, il tetto di costo che ogni genitore deve poter pagare per il figlio peggiore, si calcola proprio su quel secondo numero. Con il primo, il tetto si sarebbe rotto la prima volta che un figlio avesse tirato fuori il caso peggiore.

La contraddizione stava lì dal ticket #42. L'ha trovata l'agente rileggendo i due documenti uno accanto all'altro per preparare la grill, e Fabio non sapeva ancora cosa fosse l'Enclosing Circle. Nella vision la riga è stata corretta.

> l'alternativa è ripensare il limite del figlio peggiore, mettere un figlio peggiore al 90 percentile e poi se il figlio nascente fosse più grande del previsto lo facciamo nascere morto (il padre non può dargli abbastanza energia/cibo) [non so se mi sono spiegato]

Il conto che l'aveva spinto era vero. Con le costanti di partenza, ogni organismo senza organelli doveva tenere da parte il 30% di area in più rispetto a M6, per pagare l'inserimento di un neurone che quasi certamente non avrebbe ricevuto. Il tetto si calcola sul caso peggiore, e da M7 il caso peggiore ha un organello in più. Fabio proponeva di tagliare la coda: un tetto al novantesimo percentile, e il figlio che lo supera nasce morto.

Temeva per la massa, perché un figlio nato morto è carbonio che sparisce. È la preoccupazione sbagliata: un figlio nato morto restituisce il suo carbonio alla vasca come qualsiasi altra morte, attraverso i resti, e il bilancio regge. Il problema è un altro. I figli che nascono vivi smettono di essere un campione imparziale della legge di mutazione. Che il genitore paghi il figlio nato morto rende il taglio costoso, non imparziale. È il setaccio dell'articolo precedente, quello che scartava i figli troppo cari finché ne usciva uno pagabile, con un cartellino del prezzo attaccato.

La coda tagliata, poi, non è una coda qualsiasi. Con i valori di partenza circa il 9% delle nascite porta un inserimento, e il 10% di figli più cari coincide quasi esattamente con quelli che ricevono un organello nuovo. Un tetto al novantesimo percentile avrebbe soppresso l'innovazione per meccanismo, e distinguere un'innovazione soppressa da una che la selezione non premia è esattamente quello che l'ultimo milestone della v0.2 deve saper fare.

> ok, mi hai convinto

M6 aveva tolto il setaccio da una porta. La prima grill di M7 l'ha quasi fatto rientrare dall'altra, con una proposta ragionevole fatta per tenere viva la vasca. Il prezzo resta: ogni organismo senza organelli paga per un neurone che non riceverà. Si può solo stringere il conto, contando soltanto le mutazioni che il genitore potrebbe davvero ricevere e il primo organello in un corpo vuoto a un raggio invece che a due. Non si può togliere.

Il tetto pretende un'altra cosa dalla macchina, e riguarda i dischi che si sovrappongono. Un figlio può ricevere da zero a un certo numero di eventi strutturali, e ogni evento è uno di quattro: cambiare un parametro di un organello (raggio o posizione), inserirne uno nuovo, cancellarne uno, dividerne uno in due. Dopo ogni evento i dischi del corpo possono sovrapporsi, e un corpo con dischi sovrapposti non è un corpo. Serve un passo che li allontani, che il progetto chiama rilassamento.

Il rilassamento ha un vincolo scritto in ADR-0028, ed è il vincolo che tiene in piedi il tetto di costo: un evento che aggiunge `Δd` di diametro, o sposta un disco di `d`, può allargare l'Enclosing Circle al massimo di `Δd + d`, "per quanto lontano il rilassamento spinga". Se il rilassamento può allargare il cerchio più di così, il genitore non può più prezzare il figlio peggiore con una formula chiusa, e si torna a sperare. Il ticket lasciava l'algoritmo a chi implementava, e l'agente non ha cercato un rilassamento elegante sperando che rispettasse il contratto: ha costruito il contratto.

A ogni giro c'è un **colpevole**, il disco con più sovrapposizioni, e due mosse possibili. La **spinta** allontana tutti gli altri dischi dal colpevole della stessa distanza, la sua sovrapposizione più profonda. Lo **scivolamento** sposta solo il colpevole, verso l'esterno, fino al primo posto libero. Si tiene la mossa che lascia il cerchio più piccolo. Ognuna salva il caso che l'altra perde. Un disco che cresce si sovrappone ai vicini al massimo di quanto è cresciuto, e la spinta li allontana proprio di quello, mentre scivolando attraverserebbe mezzo corpo. Un disco inserito al centro di uno grande si sovrappone per tutto il raggio del grande, e spingere via tutto di quella misura gonfierebbe il corpo. Scivolando verso il bordo, il cerchio cresce al massimo di due volte il raggio di nascita.

Sul perché il ciclo finisce, basta una riga di analisi convessa. La spinta è il gradiente della funzione convessa `|p|²/2 + s·|p|`, e il gradiente di una funzione convessa non avvicina mai due punti: toglie le sovrapposizioni del colpevole senza crearne di nuove fra gli altri, e a ogni giro il numero di coppie sovrapposte scende.

Il codice è passato verde al primo colpo, sedici test su sedici, e l'agente non si è fidato. Ha tolto lo scivolamento e ha rilanciato: è caduto il test dell'inserimento, solo quello. L'ha rimesso e ha tolto la spinta: sono caduti crescita e spostamento, solo quelli. Un test di proprietà che non hai mai visto rosso potrebbe passare anche con la funzione vuota. Rompere apposta il codice per vedere quale test se ne accorge è il modo più rapido per sapere che i test misurano davvero il contratto.

Tutto questo girava ancora su corpi disegnati a mano. Poi è arrivata la vasca vera, e un controllo che deve passare prima di qualunque altro, che il progetto chiama **persistence**: il mondo di riferimento (il _Reference World_), senza aiuti, con cinque seed diversi (cinque sequenze casuali diverse) e centomila tick ciascuno, deve finire con almeno un organismo vivo in ognuno. Se una sola vasca si svuota, il milestone non è finito. Nell'articolo precedente passava con un margine sottile: in ogni seed, a un certo punto, restavano fra quattro e nove organismi su quaranta.

Prima di lanciare la corsa di M7 l'agente ha scritto la previsione in un commento sul ticket. Con due eventi strutturali al massimo per nascita e un organello nato a raggio 0.05, il tetto di un genitore senza organelli cresce di circa il 30% in area. La persistence regge su due o quattro seed su cinque, e se fallisce basta scendere a un solo evento. Il risultato è stato zero. Cinque seed estinti su cinque, e con un solo evento ancora cinque su cinque.

Il dato che rende il fallimento strano non è che il mondo morisse più in fretta. Era un mondo in cui non nasceva **nessuno**: zero nascite, mai, in trentasettemila tick. Il gate sul figlio peggiore non si apriva per nessun genitore, e la popolazione dei fondatori si consumava fino all'ultimo organismo. Il margine di M6 era già sottile, e un 30% di massa in più da avere in tasca lo ha chiuso.

Con un evento per nascita, la corsa ha mostrato una scogliera e non una pendenza.

| raggio di nascita `r_new` | seed estinti su 5 | note                                |
| ------------------------- | ----------------- | ----------------------------------- |
| 0.05                      | 5                 |                                     |
| 0.04                      | 2                 |                                     |
| 0.03                      | 0                 | una seed scende a un solo organismo |
| 0.02                      | 0                 | minimi di 4-9, come M6              |

Fra 0.04 e 0.02 un mondo passa da morto a sano. Non c'è un valore in mezzo in cui le cose vanno un po' peggio. Con due eventi per nascita il raggio doveva scendere a 0.01 prima che tutte e cinque le seed sopravvivessero, contro 0.03 con un evento, e per questo un evento è rimasto.

L'agente ha scelto 0.02, il valore più grande che mantiene i minimi di M6, con un solo evento per nascita. Il prezzo non era nel conto della grill. Un neurone nato a raggio 0.02 su un corpo di raggio 1, a quattordici pixel per unità, è un disco di 0.3 pixel. A schermo non si vede. L'unica prova a occhio che il mondo funziona è una riga di percentuale nel pannello dei numeri sullo schermo.

Restava da misurare se il neurone, in quel mondo, si paga. Un neurone che non fa niente è un banco di prova gratuito per la legge del costo: se costa qualcosa, la frazione di organismi che ne portano almeno uno deve restare sotto quella di un mondo identico, sugli stessi seed, dove il neurone non costa niente e a decidere è solo il caso. L'agente ha scritto anche questa previsione prima della corsa. Senza costo, i portatori salgono al 40-70% della popolazione in centomila tick. Con il costo scendono al 25-55%.

Il ragionamento era giusto: un organismo senza organelli riceve un inserimento nel 5% delle nascite, un portatore ne perde uno con la stessa probabilità e ne guadagna un po' di più per le divisioni, quindi la deriva va verso l'alto. Ma contava le generazioni sbagliate. Un seed fa fra cento e centosettanta nascite con circa venticinque organismi vivi, cioè quattro generazioni in tutta la corsa, e il neurone non ha il tempo di diffondersi prima ancora di essere punito. La misura, su venti seed: 5.1% senza costo.

Il costo l'abbiamo provato a quattro valori, da un centesimo a tre decimi del costo fisso di un organismo.

| costo del neurone | portatori | senza costo |
| ----------------- | --------- | ----------- |
| 0.01              | 4.0%      | 5.1%        |
| 0.03              | 3.9%      | 5.1%        |
| 0.1               | 3.2%      | 5.1%        |
| 0.3               | 4.0%      | 5.1%        |

Tutti e quattro stanno sotto il mondo gratuito, di uno, due punti. La dispersione fra seed è di 2.6 punti, e il costo più alto sta sopra quello a un decimo. Il criterio del ticket, "sotto la deriva", è soddisfatto da ogni valore e non ne distingue nessuno. L'agente ha lasciato il costo dove era già, un centesimo, e l'ha scritto nel commento della costante: la corsa non ha la potenza per ordinarli. Un valore "scelto dalla misura" che in realtà è rimasto quello di partenza.

Una frase del documento di progetto non ha retto. Diceva che la frazione di portatori "si assesta a un equilibrio fra mutazione e selezione". In quattro generazioni non si assesta niente, ed è stato il revisore a segnalarlo. La cifra non era sbagliata, era un verbo. Ora dice che il controllo c'è e sta sotto la risoluzione della corsa.

Il tetto di costo, almeno, alle costanti finali costa meno di quanto temevamo. Su un organismo vivo senza organelli vale 1.204 volte la sua area, contro 1.166 di M6, e 1.238 per i portatori: circa il 3% in più, contro il 30% che prezzavano le costanti di partenza.

Il neurone che non fa niente ha fatto il suo mestiere. Ha messo al lavoro, in una vasca viva, tutta la macchina che il resto della v0.2 userà, e quando la vasca si è svuotata nessuna funzione poteva essere accusata: i colpevoli erano due costanti della macchina, e si sono potute abbassare senza toccare altro. Non si lascia nemmeno misurare. Quello che ha da dire sul proprio costo, per ora, sta sotto il rumore di quattro generazioni.
