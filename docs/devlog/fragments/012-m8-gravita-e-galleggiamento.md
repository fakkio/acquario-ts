# M8: gravità e galleggiamento

La costante `g` non l'ho misurata né aggiustata a occhio: l'ho derivata. Un corpo di riferimento con un solo float di raggio `r_new` sale a velocità `g·r²/(6R)`, una camminata browniana con passo `s` ha diffusione `D = s²/4`, e il profilo di equilibrio ha altezza di scala `D/v`. Imponi che sia lo spessore della Bright Band e `g` esce in forma chiusa, circa 4.2. Una costante che si scrive sotto forma di dimostrazione invece che di numero trovato a tentativi.

---

Il primo ticket di M8 era l'unico senza blocchi, quindi la scelta del ticket l'ha fatta il grafo delle dipendenze. #77 → #78 → #79 → #80 → #81, più l'arco #78 → #80. Ho disegnato la mappa solo alla fine, ma la catena era già tutta nei campi "Blocked by".

---

Il controllo di `g` ha dato profondità media 9.83 contro 8.28 previsti, e Bright Band al 58.7% contro 69.4%. Non è `g` sbagliata: la previsione vale per corpi che non si toccano, e quaranta corpi di raggio 1 si ammucchiano contro la superficie e si spingono verso il basso a vicenda. La teoria era giusta per un mondo che non è il nostro. Con sei corpi e 400k tick sono sceso sotto la previsione (6.65), ma con molto rumore. Il numero è riportato, mai un cancello (ADR-0024).

---

Un fatto che mi ha fatto sorridere: il float è l'unico organello che sale sempre, e sale il doppio vicino al fondo. La spinta è `g·a·(1 + y/H)`: più sei in basso, più l'acqua è densa, più il float tira su. Un termostato fatto di fisica, senza nessun gene che lo sappia.

---

Il neurone è "senza peso" e il float pesa `−1`: ho dovuto togliere un booleano (`weightless`) e metterci una unione, `number | "weightless"`. Il booleano era stato scritto in M7 con un commento che diceva "letto solo quando esiste la gravità". Quando la gravità è arrivata, il commento era l'unico pezzo di M7 che sapeva già cosa sarebbe successo.

---

Per testare un tipo di densità `+3/2` serviva un tipo che non esiste nel roster. La spec voleva le dichiarazioni passate al passo di moto, ma il corpo derivato calcola i momenti una volta sola, alla costruzione. Ho spostato il punto di iniezione all'`Organism`: la deviazione più piccola che non rompe "derivato una volta".

---

- il rename `applyBrownianMotion` → `applyMotion`, dieci chiamate cambiate con un `sed`
- `*/` dentro un commento (`r_new ≈ r*/2`) che chiudeva il commento e ha rotto tutto il parsing di `constants.ts`
- la Resting Depth con il termine `P_y/A` che i test simmetrici non esercitano mai

---

Nessuna alternativa scartata per `g`: derivarla in forma chiusa era la scelta ovvia, non una decisione sofferta. Il punto è proprio questo, in un progetto dove quasi ogni costante è stata calibrata a posteriori, qui la fisica bastava a dirla prima.

---

Lo scarto tra profilo misurato e previsto era prevedibile, e lo era anche per Fabio: quaranta corpi che si ammucchiano contro la superficie non sono la camminata di un corpo solo. Nessuna sorpresa, quindi, solo un numero che conferma dove la teoria smette di valere. La parte utile è che il commento nel codice lo dice prima che qualcuno lo scambi per un `g` sbagliato.

---

Il `*/` dentro il commento di `constants.ts` Fabio non l'ha nemmeno visto: l'agente l'ha introdotto e l'ha risolto nello stesso giro, tra un typecheck rotto e il successivo. Il bug esiste solo nel log della sessione. Una parte del lavoro di M8 che il progetto non ricorderebbe mai, se nessuno lo scrivesse.

---

Fabio ha guardato il riepilogo e il diff, non la sessione. Il lavoro di un ticket arriva a lui in due pezzi: una storia raccontata dall'agente e il risultato nudo. Quello che sta in mezzo (i tentativi, gli errori corretti al volo) non lo vede nessuno dei due.
