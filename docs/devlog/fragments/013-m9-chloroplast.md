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
