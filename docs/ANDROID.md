# Androidi prooviversiooni ehitamine

See projekt kasutab Capacitor 7 veebivaadet. Veebimäng pakitakse APK sisse; mängimiseks pole vaja serverit ega internetti. Identifikaator on `ee.mahubkull.game`, versioon `0.1.0`, minimaalne Android 6 / API 23, sihtplatvorm Android 15 / API 35. Rakenduse suund on portree. Prooviversioon küsib ainult Capacitori vaikimisi internetiõigust; reklaame, oste, analüütikat ega kontosid pole.

## Nõuded

- Node.js 22 või uuem ja `npm ci` projektikataloogis.
- JDK 21.
- Android SDK Platform 35 ja Build Tools 35.0.0.
- Android SDK litsents peab olema aktsepteeritud.
- `ANDROID_HOME` osutab SDK kataloogile. Android Studios sobib ka kohalik `android/local.properties`; seda ei lisata Giti.

Gradle 8.11.1 laaditakse wrapperi kaudu. Jaotuse ametlik SHA-256 on wrapperi konfiguratsioonis fikseeritud. TLS-i kontrolli ei lülitata välja.

## Üks käsk

Projekti juurkataloogis:

```sh
npm ci
bash scripts/build-android.sh
```

Skript ehitab praegustest veebiallikatest tootmisfailid, sünkroonib need Androidi projekti, loob APK ning kontrollib selle allkirja. Tulemus: `artifacts/mahub-kull-debug.apk`. Seda saab proovimiseks telefonile paigaldada või saata ADB kaudu:

```sh
adb install -r artifacts/mahub-kull-debug.apk
```

Tegemist on arenduse prooviallkirjaga. Google Play väljalase vajab enda allkirjastusvõtit, väljalaske AAB-d ja arendajakontot. Hoia võtmed ja paroolid hoidlast väljas. APK ehitamise ning allkirja kontrolli õnnestumine ei asenda päris Androidi seadmes mängimise kontrolli.

## Selle pilvekeskkonna tööriistad

- SDK: `/workspace/android-sdk`
- Gradle'i vahemälu: `/workspace/android-gradle`
- Androidi kohalikud andmed: `/workspace/android-user`
- Täielik JDK: `/workspace/android-jdk` (Eclipse Temurin 21.0.13+9). Süsteemi Java 21 on ainult JRE ja sellel puudub kompilaator.

Need kataloogid on väljaspool hoidlat ja säilitatakse keskkonna failisüsteemi hetktõmmises. Kasuta olemasolevat checkout'i; uue Git worktree loomine pole vajalik.

SDK paigaldati Google'i ametlikust HTTPS-manifestist `https://dl.google.com/android/repository/repository2-3.xml`. Käsureatööriistade arhiivi `commandlinetools-linux-16111833_latest.zip` SHA-1 kontrolliti manifestis avaldatud väärtusega `e025545c62a8e64c7559119566a569fb1dec5f60`. SDK haldur paigaldas `platforms;android-35` ja `build-tools;35.0.0` ning vajalik SDK litsents aktsepteeriti selle arendusehituse jaoks. Emulaatorit ega süsteemikujutist ei paigaldatud.

JDK laaditi Eclipse Adoptiumi ametlikust GitHubi väljalaskest `adoptium/temurin21-binaries`, silt `jdk-21.0.13+9`. Arhiivi SHA-256 kontrolliti sama väljalaske avaldatud väärtusega `d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c`. Kohaliku JDK usaldussertifikaatide fail viitab süsteemi `/etc/ssl/certs/java/cacerts` failile, et säiliks pilve puhverserveri usaldatud CA ning TLS-i kontroll.

Esimesel Gradle'i ehitusel paigaldati lisaks platvormitööriistad ja Build Tools 34.0.0, mida Capacitori alamprojekt vajab. Järgmistel ehitustel on need samas SDK kataloogis olemas.

Pilve Java-võrguliiklus vajab päritud puhverserverit. Ehitusskript tuletab Java puhverserveri hosti ja pordi olemasolevast `HTTPS_PROXY`/`HTTP_PROXY` seadistusest. See ei loe ega kuva autentimisandmeid. Muus arvutis, kus puhverserverit pole, kasutatakse tavalist Java võrguühendust. Ettevalmistatud sõltuvused võimaldavad järgmistel pilveehitustel kasutada Gradle'i vahemälu; uute sõltuvuste jaoks on endiselt vaja võrku.
