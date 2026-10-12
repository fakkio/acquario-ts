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

---

#86, il cloroplasto entra nel roster di default. Il ticket chiede "un test di mondo che mostri il roster di default mentre inserisce cloroplasti". Non si può scrivere così: in un mondo non innescato le inserzioni sono troppo rare. Ho guardato 12 semi a 8000 tick, e solo 4 avevano un organello qualsiasi (1 con un neurone, uno con due, uno con sedici). Nessun galleggiante, nessun cloroplasto, in nessuno. Il test è diventato una prova sulla legge di mutazione, con ogni prova forzata a evento, che vede tutti e tre i tipi. Mostra che il roster pesca il cloroplasto, non che un mondo lo inserisce.

---

Nota dell'agente: nella chiusura del ticket ho scritto "3 semi su 12"; il conteggio giusto dalla sonda è 4 (semi 1, 5, 11, 12). Corretto qui.

---

Il dato di sfondo: a 8000 tick la popolazione è ancora quasi tutta senza organelli, quindi "il roster di default è M9" vale sulla carta molto prima che nel mondo. Chi legge un grafico dei portatori a 10k tick non sta guardando la competizione fra tre tipi, sta guardando la coda di un'attesa.

---

#87, l'harness `npm run chloroplast`, prime due sezioni. Previsione contraddetta nel verso opposto a quello atteso: la previsione diceva che la CO₂ interna in superficie sarebbe stata consumata dalla fotosintesi, quindi `X` più basso del 260 impegnato, e il pareggio di un cloroplasto nuovo "un po' più in alto" di circa quattro raggi. Misurato: `X` sulla Bright Band 272 ± 7, in superficie 407, pareggio a 5,3 raggi. Il cloroplasto rende più del previsto e comincia a pagarsi più in basso, non più in alto.

---

Errore dell'agente, preso a occhio dalla tabella e non da un test: nella prima versione la profondità di pareggio chiedeva `r*(y) = r_new`, cioè `X = 520`, e l'harness rispondeva "non incrociato dalle fasce". Sembrava un risultato (nessun pareggio, forse il cloroplasto non si ripaga mai). Era una domanda sbagliata: `r* = c_organelle / k` conta il diametro `2r`, quindi un disco a `r_new` copre il suo overhead quando `r*(y) = 2·r_new`, che è dove `X = 260`. Il ticket diceva "il pareggio a `r_new`" e l'agente l'aveva letto alla lettera. L'ha visto perché la colonna `r*/r_new` valeva già 1,28 in superficie e 2,3 a metà banda, quindi il due era sotto gli occhi.

---

La σ del ticket (circa 14 e 11,5) non è quella che l'harness misura (circa 9). Sono due numeri diversi, e il ticket dà il primo come se fosse la previsione del secondo: 14 è la σ del profilo senza pareti, `√(L·H·a_new/A)`, e con le pareti a 0 e 40 la distribuzione si strozza a 9,2 e 8,8. L'agente ha aggiunto alla tabella una colonna "free σ" accanto alla σ prevista con le pareti, così la misura (9,12 e 8,97) combacia con la previsione giusta e il 14 resta leggibile come quello che è. Nessuno ha chiesto la colonna.

---

Una frase che l'agente ha scritto nella nota del report e che il report stesso smentisce: "i corpi si accalcano e si spingono, aspettati una media più profonda". Misurato il contrario, le medie stanno 1-1,5 raggi più su del profilo previsto (14,65 contro 15,46, 22,5 contro 24,04) e la frazione nella Bright Band è più alta (37% contro 33%, 10% contro 7%). Dalla separazione l'agente si aspettava un effetto che non c'è, o che c'è ma è battuto da qualcos'altro. Non so ancora cosa.

---

Due cose che le revisioni hanno segnalato e che l'agente non ha toccato: `predictedProfile` esiste due volte con firme diverse (`buoyancy.ts` e `chloroplast.ts`), e il 260 impegnato è ricopiato a mano nell'harness invece di essere letto da `constants.ts`. Decisione dell'agente: la prima non vale la modifica di uno strumento già in uso, la seconda richiederebbe di esportare una costante dal mondo per uno strumento che non deve modificarlo. Corretto solo l'ordine alfabetico in `package.json`.

---

Una cosa piccola e comica: il comando che pubblicava il commento su GitHub è rimasto appeso due minuti perché un `cat` senza file leggeva uno stdin che non arrivava mai. Non è stato pubblicato niente, e il giro successivo è partito pulito.
