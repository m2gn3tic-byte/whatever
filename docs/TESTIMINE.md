# Mängu proovimine

Arvuti veebibrauser on testimise põhiline siht. Lõplik mäng jääb Androidi telefonidele mõeldud rakenduseks; mõlemad kasutavad sama mänguloogikat ja graafikat.

**[Arvuti prooviversiooni ZIP](https://github.com/m2gn3tic-byte/whatever/archive/refs/heads/playtest.zip)** on GitHubis olemas. Allalaadimine tagastas HTTP 200 ning arhiivi HTML-fail on testitud versiooniga bait-baidilt sama. Paki ZIP lahti ja ava **Mahub-kull.html** oma brauseris.

## Miks varasemad lingid ei avanud mängu?

Keskkonna avaldamine säilitab failid pilvemasinas. See ei avalda mängu veebilehte ega muuda `/workspace/...` failiteid allalaadimislinkideks. Arendusserver on samuti pilvemasina protsess, mis ei säili keskkonna taaskäivitamisel. Praegused tööriistad ei paku vestluses avalikku eelvaadet ega kinnitatud failimanuste edastust.

## Brauseris proovimiseks ettevalmistatud versioon

GitHub Pagesi jaoks on valmis veebiversioon alamkataloogile `/whatever/`:

```sh
npm ci
npm run build:pages
```

Tulemus on `dist-pages/`. Pärast avaldamiseks loa saamist saadab `npm run publish:playtest` staatilise lehe harusse `gh-pages` ning iseseisva HTML-faili koos lühijuhendiga harusse `playtest`. Skript ei kasuta sundlükkamist ega muuda lähtekoodi tööpuud. ZIP harust `playtest` sobib arvutis kohe proovimiseks, kui see on GitHubist alla laaditud.

Veebilehe aktiveerimiseks vali hoidlas **Settings → Pages → Deploy from a branch → gh-pages → /(root) → Save**. Alles pärast GitHubi avaldamise lõppu saab aadressi toimimist kontrollida. Keskkonna seadistuse uuesti avaldamist selleks vaja ei ole.

Alternatiivne töövoog `.github/workflows/playtest.yml` kasutab GitHub Actionsi avaldamist. See käivitub ainult käsitsi ning eeldab Pagesi allikaks GitHub Actionsi valimist. Tavapärase testlingi jaoks kasuta ülal kirjeldatud haru varianti; mõlemat korraga seadistada pole vaja.

## Ühe failina kaasa võetav mäng

```sh
npm run build:standalone
```

Tulemus on `artifacts/Mahub-kull.html`. Kood, stiilid ja esemepildid on selles failis koos; mängimiseks pole vaja Node.js-i, serverit, kontot ega API-võtit. Kui fail on päriselt sinu arvutisse edastatud, ava see Chrome'i, Edge'i või Firefoxiga. Pilvemasina failitee üksi seda faili sinu arvutisse ei edasta.

Edenemine salvestatakse brauseri kohalikku salvestusruumi. Kohaliku HTML-faili salvestusreeglid ja erarežiimi piirangud sõltuvad brauserist. Selle pilve hallatud Chromium keelab administraatori reegliga `file://` avamise. Automaattestid käivitavad täpselt sama eksporditud HTML-i võrguühenduseta, täites ainult dokumendi laadimise; kõik lisapäringud on keelatud. Nii kontrollitakse iseseisva faili sisu, kuid päris arvutis failile topeltklõpsamise kontroll jääb eraldi teha.

## Mängimise kontroll

1. Lohista ese kohvrisse või vali ese ja klõpsa sobivat ruutu.
2. Vali ese ning kasuta nuppu **Pööra** või klahvi **R**.
3. Kontrolli, et esemed ei saa kattuda ega kohvri servast välja minna.
4. Proovi vihjet, käigu tagasivõtmist ja taseme uuesti alustamist.
5. Lõpeta tase, mine järgmisele ning värskenda lehte: edenemine peab säilima.
6. Ava tasemete nupust **Päeva kohver**. Veebiversiooni esimese laadimise järel proovi ka võrguühenduseta mängimist.

Veateate korral pane kirja brauser, ekraanisuurus, kohvri number ja viimased sammud. Mängus puuduvad praegu maksed, reklaamid ja pilvesünkroonimine.

## Android

Androidi proovipakett asub `artifacts/mahub-kull-debug.apk`. Selle päris allalaadimine ja telefoni paigaldamine on eraldi samm. Ehituse juhend on [ANDROID.md](ANDROID.md); veebiparandused jõuavad APK-sse käsuga `npm run android:build`. Google Plays avaldamiseks on hiljem vaja väljalaskeallkirja, arendajakontot, kehtiva siht-API nõude kontrolli ja päris seadmeteste.
