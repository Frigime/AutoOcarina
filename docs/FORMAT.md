# Format des données et protocole carte ↔ site

Ce document est le **contrat** entre le site (`web/`) et le firmware (`firmware/`).
Si on change quelque chose ici, il faut changer les deux côtés.

Tous les entiers sont en **petit-boutiste** (little-endian), comme le RP2040.

---

## 1. La « banque » de morceaux

La banque contient jusqu'à **16 morceaux** et pèse au maximum **128 Ko**.
Elle est rangée dans la flash de la carte, à l'adresse **`0x101C0000`**
(offset flash `0x1C0000`), c'est-à-dire les 256 derniers Ko de la flash de 2 Mo.
Le firmware, lui, est au début de la flash : les deux ne se touchent jamais.

### En-tête (16 octets)

| Offset | Taille | Champ | Valeur |
|---|---|---|---|
| 0 | 4 | `magic` | `"OCAR"` |
| 4 | 1 | `version` | `1` |
| 5 | 1 | `songCount` | 0 à 16 |
| 6 | 2 | réservé | `0` |
| 8 | 4 | `totalSize` | taille totale de la banque, en-tête compris |
| 12 | 4 | `crc32` | CRC-32 (IEEE, celui du zip) des octets `[16, totalSize)` |

### Table des morceaux (juste après l'en-tête)

`songCount` entrées de 8 octets :

| Taille | Champ |
|---|---|
| 4 | `offset` : position du morceau depuis le début de la banque |
| 4 | `eventCount` : nombre d'événements |

### Un morceau

| Taille | Champ |
|---|---|
| 24 | nom en UTF-8, complété par des `0` |
| 6 × `eventCount` | les événements |

### Un événement (6 octets)

Un événement veut dire : *« attends `delta` ms après l'événement précédent,
puis mets la manette dans cet état »*.

| Taille | Champ | Détail |
|---|---|---|
| 2 | `delta` | millisecondes depuis l'événement précédent |
| 2 | `buttons` | masque des boutons (voir ci-dessous) |
| 1 | `hat` | croix : 0 haut, 2 droite, 4 bas, 6 gauche, 8 = rien |
| 1 | `ly` | stick gauche vertical : 0 = haut, 128 = centre, 255 = bas |

Le firmware est volontairement **bête** : il rejoue les états à la milliseconde.
Toute l'intelligence (quel bouton, quel modificateur, combien de temps avant)
est dans le site (`web/src/core/compile.ts`). On peut donc régler les timings
sans jamais reflasher la carte.

Masque des boutons (manette HORI « Pokken », identique à GP2040-CE) :

| Bit | Bouton | Bit | Bouton |
|---|---|---|---|
| 0 | Y | 7 | ZR |
| 1 | B | 8 | − |
| 2 | A | 9 | + |
| 3 | X | 10 | clic stick G |
| 4 | L | 11 | clic stick D |
| 5 | R | 12 | HOME |
| 6 | ZL | 13 | Capture |

---

## 2. Le rapport USB envoyé à la console (8 octets)

| Octet | Contenu |
|---|---|
| 0–1 | boutons |
| 2 | croix (hat) |
| 3 | stick G X (toujours 128) |
| 4 | stick G Y |
| 5–6 | stick D X/Y (toujours 128) |
| 7 | **octet d'état** pour le site (toujours `0` tant qu'aucun site n'a dit bonjour) |

---

## 3. Protocole WebHID (site → carte)

La manette HORI possède déjà un rapport de **sortie** de 8 octets (page
« fabricant » `0xFF00`). Le site s'en sert pour parler à la carte, sans
changer l'identité USB : la Switch voit exactement la même manette.

Chaque message fait 8 octets ; l'octet 0 est la commande.

| Code | Commande | Octets 1–7 |
|---|---|---|
| `0x01` | HELLO | `'O' 'C' 'A'` |
| `0x02` | BEGIN | taille totale (u32) |
| `0x03` | DATA | octet 1 = numéro de paquet (& 0xFF), octets 2–7 = 6 octets de données |
| `0x04` | COMMIT | CRC-32 de toutes les données (u32) |
| `0x05` | PLAY | numéro du morceau (`0xFF` = celui sélectionné) |
| `0x06` | STOP | — |
| `0x07` | SELECT | numéro du morceau |
| `0x08` | BOOTSEL | redémarre la carte en mode clé USB (mise à jour du firmware) |
| `0x09` | ERASE | efface la banque |

### Réponse (carte → site) : l'octet 7 du rapport manette

| Valeur | Sens |
|---|---|
| `0x00` | aucune session (c'est ce que voit la Switch) |
| `0x1v` | prête, `v` = version du protocole (1) |
| `0x20` | réception en cours |
| `0x30` | écriture en flash |
| `0x40` | banque enregistrée |
| `0x5e` | erreur `e` : 1 paquet perdu, 2 trop gros, 3 CRC faux, 4 banque invalide, 5 vérification flash |
| `0x60` | lecture en cours |

Le transfert n'a pas besoin d'accusé de réception par paquet : l'USB garantit
l'ordre et la livraison, et le CRC final vérifie le tout. Les données sont
d'abord stockées en RAM et ne sont écrites en flash **qu'après** un CRC correct :
une coupure pendant l'envoi ne peut jamais laisser une banque à moitié écrite.

---

## 4. Carte ESP32 Bluetooth : protocole série

L'ESP32 reste branché au PC et joue sur la Switch en Bluetooth (il se présente
comme une manette Pro). Le site lui parle par le port série USB (Web Serial,
921 600 bauds), avec des commandes texte d'une ligne. Chaque commande reçoit
une réponse `OK …` ou `ERR …`.

| Commande | Effet |
|---|---|
| `HELLO` | répond `OK autoocarina-esp32 <version>` (2 depuis la manette virtuelle) |
| `STATUS` | renvoie une ligne d'état `ST …`, puis `OK` |
| `BEGIN <taille>` | efface la partition des morceaux |
| `DATA <offset> <base64>` | écrit jusqu'à 384 octets de la banque |
| `COMMIT <crc32 hex>` | relit, vérifie le CRC et recharge la banque (`OK <nb morceaux>`) |
| `PLAY <n>` / `STOP` / `SELECT <n>` | lecture (`n = -1` : morceau sélectionné) |
| `TAP <boutons hex> <croix> <stickY> <ms>` | appui ponctuel (télécommande), au format HORI ci-dessus |
| `ERASE` | efface les morceaux |
| `UNPAIR` / `RECONNECT` | oublie la console / relance la connexion Bluetooth |
| `PAD <boutons hex> <croix> <lx> <ly> <rx> <ry>` | (v2) manette virtuelle : état tenu tant que le site le renvoie au moins chaque seconde, puis tout est relâché. Sticks 0..255 (0 = gauche / haut). `ERR occupe` pendant un morceau |
| `PAIR` | (v2) relance le Bluetooth (visible, reconnexion à la dernière console) et appuie tout seul sur L+R dès que la Switch l'accepte (pendant 60 s) |
| `LANG fr` / `LANG en` | (v2) langue de l'écran OLED, retenue par la carte |

La carte envoie d'elle-même `ST bt=<0..3> play=<n> sel=<n> songs=<n>` quand
son état change (`bt` : 0 démarrage, 1 attend la Switch, 2 connexion, 3 prête).
Les autres lignes (`INFO`, `WARN`, `BOOT`) sont des journaux.

La banque a le même format qu'au §1. Elle est rangée dans la partition
`ocarina` de la flash de l'ESP32 (128 Ko, voir `firmware-esp32/partitions.csv`).

## 5. Fichier `.uf2` (solution de secours)

Le site peut aussi produire un `.uf2` qui ne contient **que** la banque
(blocs de 256 octets à partir de `0x101C0000`, famille RP2040 `0xE48BFF56`).
On le glisse sur la carte en mode BOOT ; le firmware n'est pas touché.
