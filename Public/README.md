# bpac-print-server

Node webserver som viser etikett-UI-et og sender utskrifter til en Brother-skriver
via **b-PAC SDK** (32-bit COM-komponent).

## Hvordan det henger sammen

- `server.js` – Express-server. Serverer `public/index.html` og eksponerer:
  - `GET /api/config` → returnerer skrivernavn til UI-et
  - `POST /api/print` → tar imot `{ labels: string[], copies: number }`
- `config.json` – her bestemmes **skrivernavnet**, malen (`.lbx`) og navnet på
  tekstobjektet i malen som skal fylles ut.
- `print.ps1` – kjøres av Node via **32-bit PowerShell**
  (`C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`), fordi b-PAC SDK
  kun finnes som 32-bit COM-komponent. Åpner malen, setter teksten, og skriver
  ut via `bpac.Document`.
- `public/index.html` – UI-et du sendte inn, med samme logikk for å legge til/
  fjerne/tømme etiketter. `Skriv Ut`-knappen sender nå listen til `/api/print`.
- `printer.ico` – legg din egen ikonfil her (samme mappe som `server.js`).
  Serveres på `/printer.ico` og brukes som favicon i UI-et.

## Oppsett

1. Installer [b-PAC SDK](https://www.brother.com) på maskinen (32-bit,
   registrerer `bpac.Document`-COM-objektet).
2. `npm install`
3. Rediger `config.json`:
   ```json
   {
     "printerName": "Navnet skriveren har i Windows",
     "templatePath": "C:\\sti\\til\\mal.lbx",
     "objectName": "Navnet på tekstobjektet i malen",
     "port": 3000
   }
   ```
4. Legg `printer.ico` i rotmappen.
5. `npm start`
6. Åpne `http://localhost:3000`

## Om malen (.lbx)

b-PAC krever en `.lbx`-mal laget i P-touch Editor, med minst ett tekstobjekt.
`objectName` i `config.json` må matche navnet på det objektet i malen
(sett i P-touch Editor sine objekt-egenskaper). Hver etikett i listen skriver
teksten inn i det objektet og skriver ut ett eksemplar per "Kopier".

## Feilsøking

- **"Kunne ikke åpne mal"** → sjekk at `templatePath` er riktig og at filen
  finnes på serveren.
- **COM-feil / "bpac.Document"** → b-PAC SDK er ikke installert, eller Node
  finner ikke 32-bit PowerShell (sjekk konsoll-advarsel ved oppstart).
- **Feil skriver brukes** → `printerName` i `config.json` må matche skriverens
  navn nøyaktig slik det står i Windows (Enheter og skrivere).
