---
title: "Il figlio più caro"
description: "Una legge sola tiene viva la vasca, per un pelo. Poi quindici corse misurano per l'ultima volta il numero su cui la v0.1 aveva scommesso tutto."
date: 2026-10-02
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

# Il figlio più caro

Un genitore, per avere un figlio, adesso deve potersi permettere il figlio più caro che potrebbe avere. Non quello che avrà: quello peggiore. È l'unica legge nuova della prima tappa della v0.2, ed è bastata a tenere viva una vasca che nella v0.1 si svuotava sempre. Per un pelo: in ognuno dei cinque mondi misurati, a un certo punto restavano tra quattro e nove organismi.

AcquarioTS è una simulazione di vita artificiale: organismi circolari in una vasca chiusa, dove il carbonio non entra e non esce, e l'unica cosa che arriva da fuori è la luce. Un organismo trasforma la luce in cibo e il cibo in energia, e quando ne ha abbastanza si divide in due. Il figlio eredita il raggio del genitore, a volte con una piccola mutazione casuale, al massimo dell'8% in più o in meno. Il suo corpo è fatto di carbonio, e il genitore lo paga con il cibo che ha già dentro di sé.

Nella v0.1 il genitore estraeva prima la mutazione e poi controllava di poterla pagare. Se non poteva, rinunciava, e al passo successivo riprovava con un'estrazione nuova, finché non usciva un figlio abbastanza piccolo da permetterselo. L'abbiamo chiamato il setaccio, _sieve_ in inglese, e [l'articolo precedente](./008-la-correzione-che-non-ha-cambiato-niente.md) racconta come l'abbiamo trovato. Non sceglieva i piccoli: lasciava passare solo loro. Generazione dopo generazione i corpi rimpicciolivano, finché non riuscivano più a mantenersi.

La legge nuova rovescia l'ordine, e nella spec si chiama _gate_: un cancello alla nascita. Prima il genitore controlla di poter pagare il figlio più grande che la mutazione può produrre, poi estrae. Dopo il controllo il pagamento non può più fallire, e i figli che nascono sono quelli che la mutazione produce, senza filtro.

Il figlio più grande possibile ha un raggio dell'8% più grande del genitore, quindi un'area e un costo di circa 1,17 volte. È il soffitto del costo di una nascita, e il genitore non lo calcola: lo garantisce la legge di mutazione, che non può produrre niente di più grande. Per questo la funzione che lo restituisce vive accanto alla mutazione, nel modulo del genoma, e non nel codice della nascita. Nella v0.2, quando il genoma diventerà una lista di organelli, cambierà il corpo di quella funzione e non chi la chiama. Per calcolarlo, il genoma ha dovuto imparare per la prima volta che un corpo è un cerchio.

Il setaccio aveva un test che lo proteggeva. Si chiamava _spends the derivation and mutation draws but never the tangent-angle draw when a physical requirement fails_, e fissava come legge del mondo proprio quel comportamento: se il genitore non può pagare, le estrazioni sono spese e il figlio è scartato. Era scritto bene, era verde, e difendeva il difetto. Con il gate quel percorso non esiste più, e il test è stato cancellato invece che corretto: non c'era niente da correggere.

Al suo posto ne serviva uno che il setaccio non potesse superare, e andava scritto prima del gate, per vederlo fallire sulla legge vecchia. Prende genitori al limite, con il cibo appena sotto o appena sopra quanto serve per il figlio peggiore, e li fa riprovare più volte mentre il cibo sale, come succede nella vasca tra un passo e l'altro. Poi guarda tutte le nascite riuscite e chiede che in media il figlio non sia né più piccolo né più grande del genitore, entro un margine calcolato dalla variabilità del campione stesso. Sulla legge vecchia i figli venivano in media più piccoli del 2,4% in area: cinque volte oltre il margine. Rosso.

Nell'esperimento che aveva trovato il setaccio, il rimpicciolimento era cinque volte più forte. La differenza non è un errore: nel test metà dei genitori parte già abbastanza ricca da pagare il figlio peggiore, e su quelli il setaccio non agisce. Il test vede il difetto più debole di come era nella vasca, ma lo vede senza ambiguità. Un test non deve riprodurre la misura. Deve solo non poterla mancare.

Nessun figlio arriva davvero al soffitto. La mutazione estrae un numero sempre strettamente minore del massimo, quindi un genitore che ha passato il gate, dopo aver pagato il figlio vero, ha sempre qualcosa in avanzo. Lo ha mostrato un altro test vecchio, quello del genitore che muore di fame nello stesso passo in cui partorisce. Lo metteva con l'energia esattamente uguale al costo del figlio, e il pagamento lo portava a zero. Con il gate quel genitore non passa nemmeno il controllo.

Per farlo morire ancora, l'agente ha dovuto renderlo generoso: il figlio si prende tutto quello che al genitore resta dopo il pagamento. Prima si moriva di parto per sfortuna nell'estrazione. Adesso si muore solo dando tutto.

Il gate è entrato nel codice, e con lui un controllo nuovo che ogni tappa della v0.2 dovrà superare: la **Persistence**. Cinque mondi costruiti esattamente come li costruisce l'applicazione, ognuno con il suo seme casuale, senza nessun aiuto all'inizio, per centomila passi di simulazione. Alla fine, in ognuno, deve esserci qualcuno di vivo. Con il setaccio, questi cinque mondi si erano svuotati tutti prima dei quarantamila passi.

Il controllo è verde. Alla fine i cinque mondi hanno 62, 44, 38, 42 e 37 organismi, partendo da 40 fondatori. Ma il test stampa anche il minimo toccato durante la corsa, e i minimi sono 4, 7, 9, 6 e 9. Nessun mondo passa comodo: ognuno attraversa un collo di bottiglia e ne esce. Il test non ha una soglia sul numero, per scelta. Quanto debba essere popolata la vasca è il problema di una tappa successiva, e una soglia adesso sarebbe un numero senza un obiettivo dietro. Tutto verde, e il mondo, ogni volta, è stato a pochi organismi dalla fine.

Quei minimi li stampa apposta, perché un mondo sopravvissuto per un pelo si veda anche quando il test passa. All'inizio non si vedevano. L'agente ha lanciato la suite, tutto verde, e nell'output le righe non c'erano. Vitest, lo strumento che esegue i test, si accorge di girare dentro un agente AI e, per risparmiargli lettura, nasconde l'output dei test che passano. Se n'è accorto l'agente stesso, con un test di prova da una riga. Nel mio terminale le righe c'erano sempre state. Uno strumento che decide cosa l'agente non ha bisogno di vedere, e lo decide proprio sulla riga scritta perché qualcuno la vedesse.

Con una vasca che resta viva, una domanda della v0.1 tornava misurabile. La teoria del progetto prevede su carta il raggio verso cui la selezione dovrebbe spingere i corpi, e lo chiama `r_opt`. Un corpo più grande raccoglie più luce, ma costa di più tenerlo in vita e farne una copia. `r_opt` è il punto di equilibrio, e vale 1,5 volte il raggio dei fondatori della v0.1. Il criterio scientifico di tutta la v0.1 era arrivarci: il caso non converge su un numero previsto in anticipo, la selezione sì.

Il protocollo era fissato da prima: quindici corse, cinque semi per tre raggi di partenza (1,0 sotto il bersaglio, 1,5 sul bersaglio, 2,5 sopra), centomila passi ciascuna, con il raggio medio preso sugli ultimi diecimila. I criteri sono due:

- **accuratezza**: ogni corsa finisce entro il 15% di 1,5;
- **convergenza**: le corse finiscono più vicine tra loro di quanto fossero i loro punti di partenza. È il criterio che il caso non può imitare.

E c'è una regola: una corsa estinta è una corsa fallita, non una corsa esclusa.

Nella v0.1 il verdetto era stato il più netto possibile. Tutte e quindici le corse si erano estinte prima di arrivare alla finestra di misura, e non c'era nessun raggio da confrontare.

Questa volta, prima di lanciare le quindici corse, l'agente ha scritto sul ticket cosa si aspettava, una riga per raggio di partenza. Il ticket lo chiedeva per un motivo preciso: una misura che non può smentire niente non dice niente.

| partenza | previsto                                    | misurato          |
| -------- | ------------------------------------------- | ----------------- |
| 1,0      | 5 vivi su 5, raggio finale tra 1,10 e 1,25  | 5 su 5, 1,02–1,28 |
| 1,5      | 5 su 5, tra 1,30 e 1,60, in leggera discesa | 5 su 5, 1,27–1,62 |
| 2,5      | 4 su 5, tra 1,60 e 2,10, ancora in discesa  | 4 su 5, 1,64–2,12 |

Sulla carta, quasi tutto giusto. Le storie dietro le righe sono più interessanti dei numeri.

La prima riga non era una previsione. Scrivendola, l'agente si è accorto che i cinque mondi partiti da 1,0 sono esattamente quelli della Persistence: stessi semi, stesso genoma, stesso costruttore. La loro sopravvivenza era già misurata, e l'ha scritto nella previsione stessa.

La terza è quella andata meglio, e per il motivo scritto. Fondatori più grandi tengono più carbonio nei loro corpi, e ne lasciano meno nell'acqua. L'agente ha rifatto il conto a mano: il carbonio rimasto nell'acqua non bastava a pagare il figlio più caro, quel fattore 1,17. All'inizio quindi nessun fondatore poteva riprodursi, finché non ne morivano abbastanza da restituire carbonio all'acqua. La previsione era che in un mondo su cinque questa siccità iniziale sarebbe stata fatale. Il mondo con il seme 10 si è estinto al passo 19.560 senza una sola nascita.

La seconda ha indovinato l'arrivo e sbagliato la strada. Tre mondi su cinque sono crollati a circa 1,15 nei primi diecimila passi, cioè al livello da cui stavano risalendo le corse partite da 1,0, e poi sono risaliti anche loro, fino a 1,3. Gli altri due sono rimasti tra 1,5 e 1,6 per tutta la corsa. Una previsione giusta sul punto d'arrivo può essere sbagliata su tutto il resto.

Il verdetto: l'accuratezza fallisce, con 6 corse su 15 entro il 15% di 1,5. Le corse partite da 1,0 finiscono quasi tutte sotto la banda, quelle partite da 2,5 quasi tutte sopra. Fallisce anche la convergenza, ma per un motivo solo. Le corse sopravvissute finiscono distanti tra loro meno della metà di quanto lo fossero i loro punti di partenza, e da sole passerebbero. Però c'è il mondo del seme 10, estinto nella siccità, e una corsa estinta è una corsa fallita.

Quella regola, applicata alla convergenza, ha una storia breve. Due ticket prima, spostando le quindici corse in un programma a parte, l'agente l'aveva estesa. Fino ad allora una corsa estinta faceva fallire solo l'accuratezza, e la convergenza si misurava sui sopravvissuti. L'agente aveva dichiarato la modifica sul ticket come voluta, aggiungendo che con la legge di allora il verdetto non cambiava: le corse erano tutte estinte. Due ticket dopo, quella regola è l'unica cosa tra un PASS e un FAIL. È stata scritta quando non decideva niente, e ha deciso il verdetto.

C'è un'ultima previsione sbagliata, e non stava nella tabella. Dopo le corse l'agente ha scritto sul ticket una nota su dove la misura aveva smentito le previsioni. E la nota stessa conteneva due affermazioni che la tabella smentiva: che alla fine tutte le corse, da sotto e da sopra, si stavano ancora muovendo verso 1,5, e che i semi più alti erano sempre gli stessi. Una corsa partita da 2,5 era ferma a 1,8 dal passo trentamila, due corse partite da 1,0 si muovevano appena dopo i sessantamila, e l'ordine dei semi cambiava da un raggio all'altro. L'ha trovato un secondo agente, lanciato apposta per rileggere il lavoro contro il ticket, controllando i numeri riga per riga.

L'agente aveva arrotondato la tabella nella direzione della propria storia: la selezione che spinge verso `r_opt`, i semi coerenti tra loro. Non aveva inventato niente, aveva solo letto i numeri come la storia voleva che fossero. La nota è stata corretta prima che il ticket si chiudesse.

Detto con la prudenza giusta, quello che resta è questo. Le corse partite da 1,0 sono salite, quelle partite da 2,5 sono scese, e il caso non porta in discesa. Ogni corsa partita da sotto o da sopra il bersaglio è finita più vicina a `r_opt` di dove era partita. Alla fine quasi tutte si stavano ancora muovendo, qualcuna si era fermata prima. Nessuna ci arriva, nei centomila passi del protocollo. È la prima volta che una popolazione dell'acquario va incontro al numero previsto su carta, ed è anche l'ultima volta che lo misuriamo: con gli organelli, quanto guadagna un corpo non dipenderà più solo dal suo raggio, e `r_opt` smette di avere senso prima di avere una risposta.

L'agente mi ha chiesto se vederlo andare in pensione così fosse una chiusura o una cosa lasciata a metà.

> Una chiusura, il difetto era la sieve non la teoria.

La previsione su carta non era sbagliata. Era il mondo che non la lasciava misurare, e per misurarla è bastato che un genitore pagasse il figlio più caro prima di sapere quale avrebbe avuto.
