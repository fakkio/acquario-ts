# M9: il cloroplasto

#83, primo ticket di M9. La fotosintesi per disco c'è, ogni cloroplasto fissa carbonio dove si trova. Il golden hash non si è mosso e nessuno l'ha dovuto ri-registrare: un corpo senza cloroplasti fa esattamente il conto di prima, bit per bit, perché il termine passivo non è stato toccato e la somma dei dischi viene aggiunta dopo.

---

Una scelta che il ticket non dice, presa dall'agente (execution how, dentro il perimetro che Fabio aveva fissato): `kChloro` è diventato una costante regolabile, `2·kPhoto`, ma `c_organelle` continua a derivare da `2·kPhoto` e non da `kChloro`. Se l'harness fa uno sweep di `kChloro`, il prezzo del cloroplasto non deve muoversi insieme al suo guadagno, altrimenti lo sweep misurerebbe un cloroplasto che si ripaga da solo. Nessuno l'ha messa in discussione; la revisione l'ha segnalata come "decisione non scritta nel ticket" e l'ha giudicata accettabile.

---

Dove la realtà ha deviato dal piano: il criterio di accettazione dice che il verde si verifica "eseguendo un mondo i cui founder o roster portano cloroplasti". L'app non ha nessun modo di farlo, `main.ts` usa solo il roster di default e il cloroplasto è, per ticket, fuori dal default. L'ha notato la revisione dopo il commit, non l'agente mentre scriveva il codice. Il glifo verde esiste e nessuno l'ha mai visto sullo schermo.

---

Un errore dell'agente, preso subito dal test: nel test del coefficiente zero la formula attesa leggeva la CO₂ dopo che la fotosintesi l'aveva già consumata. Il test falliva con una differenza di 4·10⁻⁵, piccola abbastanza da sembrare un problema di arrotondamento e invece era il valore atteso calcolato nel momento sbagliato.

---

La revisione ha anche trovato due test deboli che passavano senza dimostrare quello che dicevano: quello sulla strozzatura non controlla il rapporto fra la quota del corpo e quella dei cloroplasti, quello sul coefficiente zero confronta solo il termine passivo. Non sono stati rafforzati, il ticket successivo li eredita.

---

#85, la conservazione con i cloroplasti. Il test lungo è scritto in una sera, ma il primo giro è rosso per la ragione sbagliata: il carbonio e l'ossigeno tornano a `1e-9` al primo colpo, quello che non regge è l'asserzione che i portatori di cloroplasti siano ancora vivi. Il ticket lo aveva previsto ("se i fondatori muoiono prima, si ricostruiscono i fondatori, non la tolleranza"), e con il senno di poi è la frase che ha deciso come si lavora: la tolleranza non si tocca, si cambia il mondo.

---

Previsione contraddetta, la prima di M9: l'ipotesi di partenza era che i fondatori in superficie, dove la luce c'è e il throttle della CO₂ morde, fossero i più robusti. Sono i primi a morire. Con tre quarti dei fondatori in superficie la popolazione è a zero entro 10k tick, senza una nascita; con tre quarti in profondità a metà acquario nascono 29 figli e poi la linea si spegne comunque entro 35k tick. Non so ancora perché. Ipotesi non verificate: il cloroplasto denso li fa affondare, o in superficie si pestano la CO₂ a vicenda.

---

Cloroplasti più grandi, peggio. Con raggi fra 0,04 e 0,12 al posto di 0,03-0,07 la popolazione di 48 fondatori è a zero a 10k tick. Il cloroplasto costa (overhead, tessuto) prima di rendere, e un corpo piccolo non regge il prezzo di un organello grosso.

---

Undici configurazioni su dodici hanno finito con zero portatori prima del tick 100k. La sperimentazione è stata cieca: ogni tentativo costa 18 secondi di simulazione e l'unico segnale è una tabella di popolazione ogni 5000 tick. Quello che ha funzionato è stato 32 fondatori, metà in superficie e metà da metà profondità in giù, e per ora non c'è una ragione dietro la scelta, solo il fatto che regge.

---

Nota dell'agente, da tenere solo se serve: i portatori vengono contati a ogni campione da 1000 tick, quindi un'estinzione fra due campioni passerebbe inosservata. Con 32 fondatori non succede, ma la tenuta del test dipende da questa granularità.

---

Per il verdetto di M9: il cloroplasto da solo non sostiene un lignaggio nella sua forma attuale. Se l'harness (#87) misura lo stesso, il numero da spiegare è perché un organello che "fissa carbonio" non basta a pagare se stesso.
