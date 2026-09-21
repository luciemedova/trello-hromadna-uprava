# Hromadná úprava karet – Power-Up pro Trello

Na boardu přidá tlačítko **Hromadná úprava**. Po kliknutí otevře okno se všemi kartami rozdělenými do sloupců. Karty v něm vyberete a hromadně jim přidáte nebo odeberete štítky.

## Co umí

- **Výběr jednotlivých karet** zaškrtnutím.
- **Výběr celého sloupce** checkboxem v hlavičce sloupce.
- **Výběr rozsahu** přes Shift + klik.
- **Vyhledávání a filtr.** Hledání podle názvu ignoruje diakritiku. Filtr podle štítku umí zobrazit i karty bez štítku. Tlačítko „Vybrat zobrazené“ označí vše, co odpovídá filtru.
- **Úprava štítků.** Klik na štítek ve spodním panelu přepíná mezi stavy přidat (+), odebrat (−) a beze změny. U každého štítku vidíte, kolik vybraných karet ho už má.
- **Šetrné ukládání.** Změny se ukládají přes Trello REST API s ohledem na limity počtu požadavků. Karty, u kterých by se nic nezměnilo, se přeskočí.

## Soubory

| Soubor | Účel |
|---|---|
| `index.html` + `connector.js` | iframe connector – registruje tlačítko na boardu |
| `bulk.html` + `bulk.js` | okno s kartami a úpravou štítků |
| `config.js` | API klíč a název doplňku |
| `icon-dark.svg`, `icon-light.svg` | ikona tlačítka |

## Zprovoznění

### 1. Nahrajte soubory na HTTPS hosting

Nejjednodušší je GitHub Pages:

1. Vytvořte nový repozitář, například `trello-hromadna-uprava`.
2. Nahrajte do něj všechny soubory z této složky.
3. V repozitáři otevřete Settings → Pages a jako zdroj nastavte větev `main`, složku `/ (root)`.
4. Po chvíli poběží na adrese `https://VAS-UCET.github.io/trello-hromadna-uprava/`.

Stejně dobře poslouží Netlify, Vercel nebo váš vlastní server. Podmínkou je jen HTTPS.

### 2. Vytvořte Power-Up v Trellu

1. Otevřete https://trello.com/power-ups/admin a klikněte na **New**.
2. Vyberte svůj Workspace.
3. Zadejte název a jako **Iframe connector URL** vložte adresu `index.html`, například `https://VAS-UCET.github.io/trello-hromadna-uprava/index.html`.
4. V záložce **Capabilities** zapněte **Board buttons**.

### 3. Vygenerujte API klíč

1. V administraci Power-Upu otevřete záložku **API key** a klikněte na **Generate a new API key**.
2. Do **Allowed origins** přidejte origin svého hostingu, například `https://VAS-UCET.github.io`. Zadejte jen doménu, bez cesty a bez lomítka na konci.
3. Klíč vložte do souboru `config.js` a změnu nahrajte na hosting.

### 4. Zapněte Power-Up na boardu

1. Na boardu otevřete nabídku a zvolte **Power-Ups**.
2. Najděte svůj Power-Up v sekci **Custom** a přidejte ho.
3. V horní liště boardu se objeví tlačítko **Hromadná úprava**.

Při prvním otevření doplněk požádá o **povolení přístupu**. Přístup potřebuje ke čtení a zápisu, aby mohl měnit štítky. Token se uloží ve vašem prohlížeči.

## Řešení potíží

- **Tlačítko se na boardu nezobrazuje.**
  - Zkontrolujte, že je v záložce Capabilities zapnuté Board buttons.
  - Zkontrolujte, že URL connectoru vede přímo na `index.html`.
  - Tlačítko uvidí jen členové, kteří mohou board upravovat.
- **Povolení přístupu se neotevře nebo skončí chybou.** Většinou chybí nebo nesedí Allowed origins u API klíče.
- **„V souboru config.js chybí API klíč“.** Klíč není vyplněný, nebo se změna ještě nenahrála na hosting. U GitHub Pages zkuste počkat minutu a obnovit stránku.
- **Chyba 401 při ukládání.** Token vypršel nebo byl odvolán. Klikněte znovu na Povolit přístup.
- **Jiné chyby.** Otevřete konzoli prohlížeče (F12) přímo v okně doplňku. Chyby se vypisují tam.

## Možná rozšíření

Kód je připravený tak, aby šly snadno přidat další hromadné akce, například:

- přesun do jiného sloupce,
- archivace karet,
- přidání členů,
- nastavení termínu.
