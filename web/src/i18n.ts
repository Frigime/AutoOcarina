export type Lang = 'fr' | 'en';

const fr = {
  'app.tagline': 'Dépose une musique, la carte la joue à l’ocarina.',
  'lang.switch': 'English',
  'lang.switchTitle': 'Switch the site to English',
  'device.none': 'Carte non connectée',
  'device.unsupported': 'Navigateur non compatible',
  'device.sending': 'Envoi en cours…',
  'device.playing': '{what} · lecture',
  'device.connected': '{what} connectée',
  'device.board': 'Carte',
  'connect': 'Connecter la carte',
  'dlg.title': 'Quelle carte veux-tu connecter ?',
  'dlg.esp.title': 'ESP32 (Bluetooth)',
  'dlg.esp.desc': 'Reste branchée au PC et joue sur la Switch sans fil. Télécommande et manette depuis le site.',
  'dlg.rp.title': 'Raspberry Pi Pico, RP2040 ou RP2350 (câble)',
  'dlg.rp.desc': 'Branchée au PC pour recevoir les morceaux, puis sur la Switch pour jouer.',
  'cancel': 'Annuler',
  'browser.warning':
    'Ton navigateur ne permet pas de parler à la carte. Ouvre cette page dans <b>Google Chrome</b> ou <b>Microsoft Edge</b> (sur ordinateur). Tu peux quand même préparer et écouter tes morceaux ici.',

  'songs.title': 'Mes morceaux',
  'songs.bootHint': 'Sur la carte : appui court sur <b>BOOT</b> = morceau suivant, appui long = jouer.',
  'songs.add': '+ Nouveau morceau',
  'songs.newName': 'Nouveau morceau',
  'songs.numbered': 'Morceau {n}',
  'songs.untitled': 'Sans titre',
  'songs.max': 'Maximum {n} morceaux.',
  'songs.empty': 'vide',
  'songs.emptyTitle': 'Morceau vide : pas envoyé',
  'songs.ledTitle': 'LED {color}, {n} clignotement(s)',
  'songs.led': 'LED {color}, {n} clignotement(s)',
  'songs.meta': '{n} notes · {time}',
  'songs.up': 'Monter',
  'songs.down': 'Descendre',
  'songs.delete': 'Supprimer',
  'songs.confirmDelete': 'Supprimer « {name} » ?',
  'songs.capacity': '{n} / {max} morceaux · {size} / {maxSize} Ko',
  'songs.speedTestName': 'Test de rapidité',
  'color.0': 'rouge',
  'color.1': 'orange',
  'color.2': 'jaune',
  'color.3': 'vert',
  'color.4': 'cyan',
  'color.5': 'bleu',
  'color.6': 'violet',
  'color.7': 'rose',

  'send': 'Envoyer à la carte',
  'send.upToDate': 'Carte à jour ✓',
  'send.progress': 'Envoi… {p} %',
  'send.doneUsb': 'C’est envoyé ✓ ({size}). Tu peux débrancher la carte.',
  'send.done': 'C’est envoyé ✓ ({size}).',
  'send.noBoard': 'Branche la carte au PC puis clique sur « Connecter la carte ».',
  'send.unplugged': 'Carte débranchée.',
  'send.erased': 'Carte effacée.',
  'send.connectingEsp': 'Connexion à l’ESP32…',
  'send.needChromeEsp': 'Ouvre le site dans Chrome ou Edge pour parler à l’ESP32.',
  'send.needChrome': 'Ouvre le site dans Chrome ou Edge pour parler à la carte.',
  'send.uf2Hint': 'Maintiens BOOT en branchant la carte, puis glisse ce fichier sur le lecteur RPI-RP2.',
  'confirm.unpair': 'Oublier la Switch ? Il faudra refaire l’appairage dans « Changer la prise/l’ordre ».',
  'confirm.bootsel': 'La carte va redémarrer en « clé USB » (RPI-RP2) pour installer un firmware. Continuer ?',
  'confirm.erase': 'Effacer tous les morceaux enregistrés sur la carte ?',
  'import.bad': 'Ce fichier n’est pas une sauvegarde AutoOcarina.',
  'speedTest.added':
    'Le morceau « Test de rapidité » est ajouté. Envoie-le à la carte et joue-le dans le jeu.\n\nIl contient {count} groupes de 16 notes, séparés par un silence, de plus en plus rapides :\n{steps}\n\nRepère le dernier groupe où toutes les notes sont bien jouées (la gamme, puis La / La# en alternance), et mets sa valeur dans « Durée minimale ».',
  'speedTest.step': 'groupe {i} : {ms} ms',

  'remote.title': 'Télécommande',
  'remote.pair': 'Connecter à la Switch',
  'remote.pairTitle': 'Rend la carte visible, se reconnecte à ta Switch et appuie tout seul sur L+R',
  'remote.pairing':
    'Sur la Switch 2, ouvre <b>Manettes › Changer la prise/l’ordre</b>. La carte s’y connecte et appuie toute seule sur L+R (jusqu’à 1 minute).',
  'remote.pad': 'Manette',
  'remote.padTitle': 'Piloter la Switch depuis le site (souris, clavier ou manette de PC)',
  'remote.ocarina': 'Sortir l’ocarina',
  'remote.play': '▶ Jouer',
  'remote.stop': '■ Stop',
  'remote.home': '⌂ Home',
  'remote.lrTitle': 'Confirme la manette dans « Changer la prise/l’ordre »',
  'remote.playHint': '▶ joue le morceau ouvert dans l’éditeur (envoyé d’abord si besoin).',
  'remote.unpair': 'Oublier la Switch (réappairer)',
  'remote.oldFirmware':
    'Le firmware de la carte est ancien : réinstalle-le (Mode d’emploi, étape 1) pour avoir la manette, le bouton de connexion et la langue de l’écran.',
  'bt.0': 'Démarrage du Bluetooth…',
  'bt.1': 'En attente de la Switch : clique <b>Connecter à la Switch</b> et ouvre <b>Manettes › Changer la prise/l’ordre</b> sur la console.',
  'bt.2': 'Connexion à la Switch…',
  'bt.3': '<span class="ok-text">✓ Connectée à la Switch</span>',
  'padview.label': 'Ce que la carte appuie :',

  'assist.button': 'Mode assisté',
  'assist.title': 'Corriger la mélodie : montre au site les bonnes notes, il recalcule',
  'assist.unavailable': 'Analyse d’abord un MP3 (les notes entendues par l’IA sont gardées jusqu’à la fermeture de la page).',
  'assist.help':
    'En gris : les autres notes que l’IA a entendues. <b>Passage faux ?</b> Appuie sur la première bonne note et <b>glisse sur les suivantes</b> : elles deviennent la mélodie, le reste du passage est retiré. <b>Clic</b> sur une note grise : l’ajouter. <b>Clic</b> sur une note colorée : la retirer.',
  'assist.count': '{n} correction(s)',
  'assist.undo': 'Annuler',
  'assist.reset': 'Tout effacer',
  'passage.hint': 'Un passage sonne faux ? <b>Glisse sur le fond de la frise</b> pour le sélectionner (molette : défiler).',
  'passage.selected': 'Passage {from} → {to}.',
  'passage.count': 'Version {i} sur {n}.',
  'passage.original': 'Version d’origine.',
  'passage.none':
    'Pas d’autre version pour ce passage : essaie une sélection plus courte, ou le mode assisté pour surligner les bonnes notes.',
  'passage.next': 'Autre version de ce passage',
  'passage.play': '▶ Écouter le passage',
  'passage.done': '✓ C’est bon',
  'warn.dense':
    'Beaucoup de notes à la seconde ({n}). Si la mélodie n’est pas vraiment aussi rapide, l’accompagnement s’est mêlé à la mélodie : corrige avec le <b>mode assisté</b>, ou essaie un MIDI.',

  'pad.title': 'Manette',
  'pad.help':
    'Clique ou touche les boutons, glisse les sticks. Tu peux aussi utiliser le <b>clavier</b> ou brancher une <b>manette de PC</b> (Xbox, PlayStation…).',
  'pad.keys':
    'Clavier : stick gauche <kbd>{w}</kbd><kbd>{a}</kbd><kbd>{s}</kbd><kbd>{d}</kbd> · croix <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> · A <kbd>{kA}</kbd> B <kbd>{kB}</kbd> X <kbd>{kX}</kbd> Y <kbd>{kY}</kbd> · L <kbd>{kL}</kbd> ZL <kbd>{kZL}</kbd> R <kbd>{kR}</kbd> ZR <kbd>{kZR}</kbd> · + <kbd>Entrée</kbd> − <kbd>⌫</kbd> · Home <kbd>{kH}</kbd> · Capture <kbd>{kC}</kbd>',
  'pad.gamepadNone': 'Manette de PC : aucune (branche-la et appuie sur un bouton).',
  'pad.gamepadFound': 'Manette de PC : {name}',
  'pad.close': 'Fermer (Échap)',
  'pad.notReady': 'La Switch n’est pas connectée : clique d’abord sur « Connecter à la Switch ».',
  'pad.busy': 'Un morceau est en train de jouer : arrête-le pour utiliser la manette.',
  'pad.ok': 'Connectée : tout ce que tu appuies est envoyé à la Switch.',

  'songName.aria': 'Nom du morceau',
  'drop.text': '<strong>Dépose ici un MP3</strong> (ou WAV, OGG, M4A, FLAC) <span class="muted">— ou un fichier MIDI</span>',
  'drop.inMemory': '(morceau original en mémoire)',
  'separate.label':
    '<b>Repérer et isoler la voix avec l’IA</b> (Demucs) — indispensable pour une chanson chantée ; sans effet gênant sur une musique instrumentale. <span class="muted">172 Mo à télécharger une seule fois, puis 1 à 5 min par morceau.</span>',
  'stem.label': 'Mélodie jouée par :',
  'stem.auto': 'deviner',
  'stem.vocals': 'la voix',
  'stem.other': 'les instruments (sans voix, batterie ni basse)',
  'midi.label': 'Piste MIDI :',
  'midi.track': '{name} ({n} notes)',
  'midi.auto': 'Automatique (pistes {tracks})',
  'tab.summary': 'Ajouter une tablature (optionnel, pour des notes exactes)',
  'tab.help':
    'Colle une tablature trouvée en ligne, par exemple <code>L , R , A+Dpad↑ , Y , - , X+Stick↓</code>. Avec un MP3, le site prend les notes de la tablature et le rythme du MP3. Sans MP3, utilise ensuite le <b>tap rythme</b>. <code>A*2</code> = deux fois plus longue, <code>A/2</code> = deux fois plus courte.',
  'tab.error': 'Mot {index} « {token} » ignoré : {message}',
  'analyze': 'Analyser',
  'player.play': '▶ Écouter',
  'player.playMix': '▶ Avec l’original',
  'player.stop': '■ Stop',
  'player.tap': 'Tap rythme',
  'player.down': '−½ ton',
  'player.downTitle': 'Tout baisser d’un demi-ton',
  'player.up': '+½ ton',
  'player.upTitle': 'Tout monter d’un demi-ton',
  'player.zoomOut': 'Dézoomer',
  'player.zoomIn': 'Zoomer',
  'player.board': 'Jouer sur la carte',
  'roll.aria': 'Frise des notes',
  'roll.help':
    'Glisser une note : la déplacer · glisser son bord droit : changer sa durée · double-clic : ajouter · <kbd>Suppr</kbd> : effacer · <kbd>↑</kbd><kbd>↓</kbd> : hauteur · <kbd>Ctrl</kbd> + molette : zoom · molette : défiler · glisser le fond : sélectionner un passage (après l’analyse d’un MP3). Les lignes grises sont hors de portée de l’ocarina.',

  'report.played': 'notes jouées',
  'report.aligned': 'notes calées sur le MP3',
  'report.fidelity': 'de la mélodie jouée (en durée)',
  'report.tooFast': 'notes trop rapides retirées',
  'report.fixed': 'fausses notes de l’IA corrigées',
  'report.transpose': 'demi-tons de transposition',
  'report.folded': 'notes déplacées d’une octave',
  'report.bpm': 'temps par minute (rythme calé dessus)',
  'warn.skipped': '{n} note(s) hors de portée de l’ocarina ne seront pas jouées (en gris).',
  'warn.gameSong': '« {song} » détectée à la note {n} : une note est jouée avec un autre bouton pour ne pas déclencher la chanson.',
  'warn.tooFast':
    '{n} notes sont plus rapides que la « Durée minimale » ({ms} ms). Si ta console suit, baisse-la dans les Réglages : le « Test de rapidité » t’aide à trouver la bonne valeur.',
  'warn.folded':
    'Une partie de la mélodie dépasse la tessiture de l’ocarina : des phrases ont été déplacées d’une octave. Essaie −½ / +½ ton pour comparer.',

  'step.decode': 'Décodage du fichier audio…',
  'step.listen': 'Écoute des notes par l’IA…',
  'step.melody': 'Recherche de la mélodie…',
  'step.tempo': 'Recherche du tempo…',
  'step.align': 'Alignement de la tablature sur le MP3…',
  'step.midi': 'Lecture du MIDI…',
  'step.download': 'Téléchargement de l’IA (une seule fois) : {done} / {total} Mo',
  'step.prepare': 'Préparation de l’IA…',
  'step.separate': 'Séparation des pistes (voix / instruments)…',
  'err.nothing': 'Dépose un fichier (MP3, MIDI…) ou colle une tablature.',
  'err.tabEmpty': 'Aucune note reconnue dans la tablature.',
  'err.midiEmpty': 'Ce fichier MIDI ne contient aucune note.',
  'err.noNotes': 'L’IA n’a trouvé aucune note dans ce fichier.',
  'err.audio': 'Impossible de lire ce fichier audio. Essaie un MP3, WAV ou OGG.',
  'err.bankSongs': 'Maximum {n} morceaux par carte.',
  'err.bankSize': 'Les morceaux font {size} Ko, la carte en accepte {max}.',
  'tabErr.twoNotes': 'deux boutons de note dans le même mot',
  'tabErr.bNormal': 'B n’est pas une note en disposition Normale (il range l’ocarina)',
  'tabErr.lClassic': 'L n’est pas une note en disposition Classique',
  'tabErr.unknown': '« {part} » n’est pas reconnu',
  'tabErr.noBase': 'modificateur sans bouton de note',
  'tabErr.tooMany': 'trop de modificateurs (maximum ±3 demi-tons)',

  'board.lost': 'des données se sont perdues en route',
  'board.tooBig': 'la banque est trop grosse pour la carte',
  'board.crc': 'les données reçues sont abîmées (CRC)',
  'board.flash': 'l’écriture en flash a échoué',
  'board.invalid': 'la banque est invalide',
  'board.error': 'Erreur de la carte : {what}.',
  'board.noAnswer': 'Cette manette ne répond pas. Est-ce bien une carte avec le firmware AutoOcarina ? (sinon, installe-le d’abord)',
  'board.timeout': 'La carte ne répond pas.',
  'serial.open': 'Impossible d’ouvrir le port : ferme les autres programmes qui l’utilisent (Arduino, moniteur série…).',
  'serial.noAnswer': 'Cette carte ne répond pas. Est-ce bien un ESP32 avec le firmware AutoOcarina ?',
  'serial.timeout': 'La carte ne répond plus.',
  'serial.bt': 'La Switch n’est pas connectée : clique sur « Connecter à la Switch ».',
  'serial.crc': 'Les données reçues par la carte sont abîmées : recommence l’envoi.',
  'serial.size': 'Les morceaux sont trop gros pour la carte.',
  'serial.busy': 'La carte est occupée (un morceau joue).',
  'serial.other': 'La carte signale une erreur ({what}).',

  'tapMode.title': 'Tap rythme',
  'tapMode.withAudio': 'Le morceau va démarrer. Tape <kbd>Espace</kbd> (ou touche le cadre) au début de chaque note.',
  'tapMode.noAudio': 'Tape <kbd>Espace</kbd> (ou touche le cadre) au rythme du morceau, une fois par note.',
  'tapMode.count': 'Note {n} / {total}',
  'tapMode.restart': 'Recommencer',
  'tapMode.cancel': 'Annuler (Échap)',

  'combo.dpad': 'Croix',
  'combo.stick': 'Stick',
  'gameSong.0': 'Berceuse de Zelda',
  'gameSong.1': 'Chant d’Epona',
  'gameSong.2': 'Chant de Saria',
  'gameSong.3': 'Chant du Soleil',
  'gameSong.4': 'Chant du Temps',
  'gameSong.5': 'Chant des Tempêtes',
  'gameSong.6': 'Menuet de la Forêt',
  'gameSong.7': 'Boléro du Feu',
  'gameSong.8': 'Sérénade de l’Eau',
  'gameSong.9': 'Nocturne de l’Ombre',
  'gameSong.10': 'Requiem des Esprits',
  'gameSong.11': 'Prélude de la Lumière',

  'settings.title': 'Réglages',
  'set.layout': 'Disposition des boutons (options du jeu)',
  'set.layout.normal': 'Normale : L R A Y X',
  'set.layout.classic': 'Classique : R B A Y X',
  'set.lead': 'Préparation avant chaque note (ms)',
  'set.leadHelp': 'Modificateur tenu et note précédente relâchée avant la note.',
  'set.min': 'Durée minimale d’une note (ms)',
  'set.minHelp': 'Plus elle est basse, plus de notes rapides sont gardées. Trouve la limite de ta console avec le',
  'set.speedTest': 'test de rapidité',
  'set.bpm': 'Tempo d’une tablature sans rythme (BPM)',
  'set.takeout': 'Sortir l’ocarina automatiquement (Croix ←)',
  'set.avoid': 'Éviter de déclencher les chansons du jeu (téléportation…)',
  'set.legato': 'Notes liées (le son ne se coupe pas entre deux notes)',
  'set.legato.safe': 'Oui, sauf quand la croix ou le stick change (conseillé)',
  'set.legato.always': 'Toujours (plus fluide, à tester sur ta console)',
  'set.legato.off': 'Non : relâcher avant chaque note',
  'set.legatoHelp': 'Si le jeu joue de fausses notes en mode « Toujours », reviens au mode conseillé.',

  'more.title': 'Autres options',
  'fw.board': 'Ta carte :',
  'fw.download': 'Télécharger le firmware',
  'more.uf2': 'Télécharger les morceaux (.uf2, RP2040 seulement)',
  'more.fw': 'Télécharger le firmware de la carte choisie (.uf2)',
  'more.bootsel': 'Mettre la carte en mode « clé USB »',
  'more.erase': 'Effacer les morceaux de la carte',
  'more.export': 'Sauvegarder mes morceaux (.json)',
  'more.import': 'Charger une sauvegarde',
  'file.uf2': 'autoocarina_morceaux.uf2',
  'file.backup': 'autoocarina_sauvegarde.json',

  'howto.esp.title': 'Mode d’emploi — ESP32 (Bluetooth)',
  'howto.esp.1':
    '<b>Première fois seulement</b> : installe le <a href="firmware/autoocarina_esp32.bin" download="autoocarina_esp32.bin">firmware ESP32</a> avec l’outil officiel <a href="https://espressif.github.io/esptool-js/" target="_blank" rel="noopener">ESP Tool</a> (Connect, adresse <code>0x0</code>, Program). Il faut un ESP32 « classique » (ESP32-WROOM-32, DevKitC, NodeMCU-32S…) : les ESP32-S2, S3, C3 et C6 n’ont pas le Bluetooth nécessaire.',
  'howto.esp.2': 'Laisse l’ESP32 branché au PC, puis <b>Connecter la carte › ESP32 Bluetooth</b>.',
  'howto.esp.3':
    'Sur la Switch 2 : <b>Paramètres › Manettes et accessoires › Changer la prise/l’ordre</b>, puis clique <b>Connecter à la Switch</b> dans la télécommande. La carte apparaît comme « Pro Controller » et appuie toute seule sur <b>L + R</b>.',
  'howto.esp.4':
    'Lance le jeu, puis utilise la télécommande : <b>Sortir l’ocarina</b>, puis <b>▶ Jouer</b> quand Link est prêt. Les fois suivantes, la carte se reconnecte toute seule à la Switch.',
  'howto.esp.5':
    '<b>Manette</b> : pilote la Switch depuis le site (souris, clavier ou manette de PC), par exemple pour naviguer dans les menus sans reconnecter tes Joy-Con.',
  'howto.rp.title': 'Mode d’emploi — carte RP2040 / RP2350 (câble)',
  'howto.rp.1':
    '<b>Première fois seulement</b> : choisis ta carte et télécharge son firmware. Maintiens le bouton <b>BOOT</b> de la carte en la branchant au PC : un lecteur « RPI-RP2 » (ou « RP2350 ») apparaît. Glisse le firmware dedans.',
  'howto.rp.2': 'Dépose un MP3 (ou un MIDI), clique <b>Analyser</b>, écoute et corrige si besoin sur la frise.',
  'howto.rp.3': 'Carte branchée au PC : <b>Connecter la carte</b>, puis <b>Envoyer à la carte</b> (LED verte = OK).',
  'howto.rp.4':
    'Branche la carte sur la Switch 2, lance le jeu et place-toi en jeu libre. Choisis le morceau avec un appui court sur <b>BOOT</b> (couleur + nombre de clignotements), puis appui long : c’est parti ! Un nouvel appui l’arrête.',
  'howto.rp.5':
    'Manette pas reconnue ? Va dans « Manettes › Changer la prise/l’ordre » et fais un <b>double appui</b> sur BOOT (la carte appuie sur L+R).',
};

export type Key = keyof typeof fr;

const en: Record<Key, string> = {
  'app.tagline': 'Drop in some music, the board plays it on the ocarina.',
  'lang.switch': 'Français',
  'lang.switchTitle': 'Passer le site en français',
  'device.none': 'Board not connected',
  'device.unsupported': 'Browser not supported',
  'device.sending': 'Sending…',
  'device.playing': '{what} · playing',
  'device.connected': '{what} connected',
  'device.board': 'Board',
  'connect': 'Connect the board',
  'dlg.title': 'Which board do you want to connect?',
  'dlg.esp.title': 'ESP32 (Bluetooth)',
  'dlg.esp.desc': 'Stays plugged into the PC and plays on the Switch wirelessly. Remote and controller from the site.',
  'dlg.rp.title': 'Raspberry Pi Pico, RP2040 or RP2350 (cable)',
  'dlg.rp.desc': 'Plugged into the PC to receive songs, then into the Switch to play.',
  'cancel': 'Cancel',
  'browser.warning':
    'Your browser can’t talk to the board. Open this page in <b>Google Chrome</b> or <b>Microsoft Edge</b> (on a computer). You can still prepare and listen to your songs here.',

  'songs.title': 'My songs',
  'songs.bootHint': 'On the board: short press on <b>BOOT</b> = next song, long press = play.',
  'songs.add': '+ New song',
  'songs.newName': 'New song',
  'songs.numbered': 'Song {n}',
  'songs.untitled': 'Untitled',
  'songs.max': '{n} songs maximum.',
  'songs.empty': 'empty',
  'songs.emptyTitle': 'Empty song: not sent',
  'songs.ledTitle': '{color} LED, {n} blink(s)',
  'songs.led': '{color} LED, {n} blink(s)',
  'songs.meta': '{n} notes · {time}',
  'songs.up': 'Move up',
  'songs.down': 'Move down',
  'songs.delete': 'Delete',
  'songs.confirmDelete': 'Delete “{name}”?',
  'songs.capacity': '{n} / {max} songs · {size} / {maxSize} KB',
  'songs.speedTestName': 'Speed test',
  'color.0': 'red',
  'color.1': 'orange',
  'color.2': 'yellow',
  'color.3': 'green',
  'color.4': 'cyan',
  'color.5': 'blue',
  'color.6': 'purple',
  'color.7': 'pink',

  'send': 'Send to the board',
  'send.upToDate': 'Board up to date ✓',
  'send.progress': 'Sending… {p} %',
  'send.doneUsb': 'Sent ✓ ({size}). You can unplug the board.',
  'send.done': 'Sent ✓ ({size}).',
  'send.noBoard': 'Plug the board into the PC, then click “Connect the board”.',
  'send.unplugged': 'Board unplugged.',
  'send.erased': 'Board erased.',
  'send.connectingEsp': 'Connecting to the ESP32…',
  'send.needChromeEsp': 'Open the site in Chrome or Edge to talk to the ESP32.',
  'send.needChrome': 'Open the site in Chrome or Edge to talk to the board.',
  'send.uf2Hint': 'Hold BOOT while plugging in the board, then drop this file onto the RPI-RP2 drive.',
  'confirm.unpair': 'Forget the Switch? You will have to pair again in “Change Grip/Order”.',
  'confirm.bootsel': 'The board will restart as a “USB drive” (RPI-RP2) to install a firmware. Continue?',
  'confirm.erase': 'Erase all the songs stored on the board?',
  'import.bad': 'This file is not an AutoOcarina backup.',
  'speedTest.added':
    'The “Speed test” song has been added. Send it to the board and play it in the game.\n\nIt has {count} groups of 16 notes, separated by a pause, faster and faster:\n{steps}\n\nFind the last group where every note is played correctly (the scale, then A / A# alternating), and put its value in “Minimum note length”.',
  'speedTest.step': 'group {i}: {ms} ms',

  'remote.title': 'Remote control',
  'remote.pair': 'Connect to the Switch',
  'remote.pairTitle': 'Makes the board visible, reconnects to your Switch and presses L+R by itself',
  'remote.pairing':
    'On the Switch 2, open <b>Controllers › Change Grip/Order</b>. The board connects and presses L+R by itself (up to 1 minute).',
  'remote.pad': 'Controller',
  'remote.padTitle': 'Control the Switch from the site (mouse, keyboard or PC controller)',
  'remote.ocarina': 'Take out the ocarina',
  'remote.play': '▶ Play',
  'remote.stop': '■ Stop',
  'remote.home': '⌂ Home',
  'remote.lrTitle': 'Confirms the controller in “Change Grip/Order”',
  'remote.playHint': '▶ plays the song open in the editor (sent first if needed).',
  'remote.unpair': 'Forget the Switch (pair again)',
  'remote.oldFirmware':
    'The board’s firmware is old: reinstall it (How to use, step 1) to get the controller, the connect button and the screen language.',
  'bt.0': 'Starting Bluetooth…',
  'bt.1': 'Waiting for the Switch: click <b>Connect to the Switch</b> and open <b>Controllers › Change Grip/Order</b> on the console.',
  'bt.2': 'Connecting to the Switch…',
  'bt.3': '<span class="ok-text">✓ Connected to the Switch</span>',
  'padview.label': 'What the board presses:',

  'assist.button': 'Assisted mode',
  'assist.title': 'Fix the melody: show the site the right notes, it recalculates',
  'assist.unavailable': 'Analyze an MP3 first (the notes heard by the AI are kept until the page is closed).',
  'assist.help':
    'In grey: the other notes the AI heard. <b>Wrong passage?</b> Press the first right note and <b>drag over the next ones</b>: they become the melody, the rest of the passage is removed. <b>Click</b> a grey note: add it. <b>Click</b> a coloured note: remove it.',
  'assist.count': '{n} fix(es)',
  'assist.undo': 'Undo',
  'assist.reset': 'Clear all',
  'passage.hint': 'A passage sounds wrong? <b>Drag over the timeline background</b> to select it (wheel: scroll).',
  'passage.selected': 'Passage {from} → {to}.',
  'passage.count': 'Version {i} of {n}.',
  'passage.original': 'Original version.',
  'passage.none': 'No other version for this passage: try a shorter selection, or assisted mode to highlight the right notes.',
  'passage.next': 'Another version of this passage',
  'passage.play': '▶ Listen to the passage',
  'passage.done': '✓ Looks good',

  'warn.dense':
    'Lots of notes per second ({n}). If the melody isn’t really that fast, the accompaniment got mixed into the melody: fix it with <b>assisted mode</b>, or try a MIDI.',

  'pad.title': 'Controller',
  'pad.help':
    'Click or touch the buttons, drag the sticks. You can also use the <b>keyboard</b> or plug in a <b>PC controller</b> (Xbox, PlayStation…).',
  'pad.keys':
    'Keyboard: left stick <kbd>{w}</kbd><kbd>{a}</kbd><kbd>{s}</kbd><kbd>{d}</kbd> · D-pad <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> · A <kbd>{kA}</kbd> B <kbd>{kB}</kbd> X <kbd>{kX}</kbd> Y <kbd>{kY}</kbd> · L <kbd>{kL}</kbd> ZL <kbd>{kZL}</kbd> R <kbd>{kR}</kbd> ZR <kbd>{kZR}</kbd> · + <kbd>Enter</kbd> − <kbd>⌫</kbd> · Home <kbd>{kH}</kbd> · Capture <kbd>{kC}</kbd>',
  'pad.gamepadNone': 'PC controller: none (plug it in and press a button).',
  'pad.gamepadFound': 'PC controller: {name}',
  'pad.close': 'Close (Esc)',
  'pad.notReady': 'The Switch isn’t connected: click “Connect to the Switch” first.',
  'pad.busy': 'A song is playing: stop it to use the controller.',
  'pad.ok': 'Connected: everything you press is sent to the Switch.',

  'songName.aria': 'Song name',
  'drop.text': '<strong>Drop an MP3 here</strong> (or WAV, OGG, M4A, FLAC) <span class="muted">— or a MIDI file</span>',
  'drop.inMemory': '(original song in memory)',
  'separate.label':
    '<b>Find and isolate the vocals with AI</b> (Demucs) — essential for a sung song; harmless on instrumental music. <span class="muted">172 MB downloaded once, then 1 to 5 min per song.</span>',
  'stem.label': 'Melody played by:',
  'stem.auto': 'guess',
  'stem.vocals': 'the vocals',
  'stem.other': 'the instruments (no vocals, drums or bass)',
  'midi.label': 'MIDI track:',
  'midi.track': '{name} ({n} notes)',
  'midi.auto': 'Automatic (tracks {tracks})',
  'tab.summary': 'Add a tablature (optional, for exact notes)',
  'tab.help':
    'Paste a tablature found online, for example <code>L , R , A+Dpad↑ , Y , - , X+Stick↓</code>. With an MP3, the site takes the notes from the tablature and the rhythm from the MP3. Without an MP3, then use <b>tap rhythm</b>. <code>A*2</code> = twice as long, <code>A/2</code> = half as long.',
  'tab.error': 'Word {index} “{token}” ignored: {message}',
  'analyze': 'Analyze',
  'player.play': '▶ Listen',
  'player.playMix': '▶ With the original',
  'player.stop': '■ Stop',
  'player.tap': 'Tap rhythm',
  'player.down': '−½ tone',
  'player.downTitle': 'Lower everything by a semitone',
  'player.up': '+½ tone',
  'player.upTitle': 'Raise everything by a semitone',
  'player.zoomOut': 'Zoom out',
  'player.zoomIn': 'Zoom in',
  'player.board': 'Play on the board',
  'roll.aria': 'Note timeline',
  'roll.help':
    'Drag a note: move it · drag its right edge: change its length · double-click: add · <kbd>Del</kbd>: delete · <kbd>↑</kbd><kbd>↓</kbd>: pitch · <kbd>Ctrl</kbd> + wheel: zoom · wheel: scroll · drag the background: select a passage (after analysing an MP3). Grey lines are out of the ocarina’s range.',

  'report.played': 'notes played',
  'report.aligned': 'notes matched to the MP3',
  'report.fidelity': 'of the melody played (by length)',
  'report.tooFast': 'notes too fast, removed',
  'report.fixed': 'AI mistakes fixed',
  'report.transpose': 'semitones of transposition',
  'report.folded': 'notes moved by an octave',
  'report.bpm': 'beats per minute (rhythm locked to it)',
  'warn.skipped': '{n} note(s) out of the ocarina’s range won’t be played (in grey).',
  'warn.gameSong': '“{song}” detected at note {n}: one note is played with another button so the song isn’t triggered.',
  'warn.tooFast':
    '{n} notes are faster than the “Minimum note length” ({ms} ms). If your console keeps up, lower it in Settings: the “Speed test” helps you find the right value.',
  'warn.folded':
    'Part of the melody goes beyond the ocarina’s range: some phrases were moved by an octave. Try −½ / +½ tone to compare.',

  'step.decode': 'Decoding the audio file…',
  'step.listen': 'The AI is listening to the notes…',
  'step.melody': 'Finding the melody…',
  'step.tempo': 'Finding the tempo…',
  'step.align': 'Matching the tablature to the MP3…',
  'step.midi': 'Reading the MIDI…',
  'step.download': 'Downloading the AI (only once): {done} / {total} MB',
  'step.prepare': 'Preparing the AI…',
  'step.separate': 'Separating the tracks (vocals / instruments)…',
  'err.nothing': 'Drop a file (MP3, MIDI…) or paste a tablature.',
  'err.tabEmpty': 'No notes recognized in the tablature.',
  'err.midiEmpty': 'This MIDI file has no notes.',
  'err.noNotes': 'The AI found no notes in this file.',
  'err.audio': 'Can’t read this audio file. Try an MP3, WAV or OGG.',
  'err.bankSongs': '{n} songs maximum per board.',
  'err.bankSize': 'The songs take {size} KB, the board accepts {max}.',
  'tabErr.twoNotes': 'two note buttons in the same word',
  'tabErr.bNormal': 'B isn’t a note in the Normal layout (it puts the ocarina away)',
  'tabErr.lClassic': 'L isn’t a note in the Classic layout',
  'tabErr.unknown': '“{part}” isn’t recognized',
  'tabErr.noBase': 'modifier without a note button',
  'tabErr.tooMany': 'too many modifiers (±3 semitones maximum)',

  'board.lost': 'some data got lost on the way',
  'board.tooBig': 'the bank is too big for the board',
  'board.crc': 'the data received is damaged (CRC)',
  'board.flash': 'writing to flash failed',
  'board.invalid': 'the bank is invalid',
  'board.error': 'Board error: {what}.',
  'board.noAnswer': 'This controller doesn’t answer. Is it a board with the AutoOcarina firmware? (if not, install it first)',
  'board.timeout': 'The board doesn’t answer.',
  'serial.open': 'Can’t open the port: close the other programs using it (Arduino, serial monitor…).',
  'serial.noAnswer': 'This board doesn’t answer. Is it an ESP32 with the AutoOcarina firmware?',
  'serial.timeout': 'The board stopped answering.',
  'serial.bt': 'The Switch isn’t connected: click “Connect to the Switch”.',
  'serial.crc': 'The data received by the board is damaged: send again.',
  'serial.size': 'The songs are too big for the board.',
  'serial.busy': 'The board is busy (a song is playing).',
  'serial.other': 'The board reports an error ({what}).',

  'tapMode.title': 'Tap rhythm',
  'tapMode.withAudio': 'The song is about to start. Tap <kbd>Space</kbd> (or touch the box) at the start of each note.',
  'tapMode.noAudio': 'Tap <kbd>Space</kbd> (or touch the box) to the rhythm of the song, once per note.',
  'tapMode.count': 'Note {n} / {total}',
  'tapMode.restart': 'Start over',
  'tapMode.cancel': 'Cancel (Esc)',

  'combo.dpad': 'Dpad',
  'combo.stick': 'Stick',
  'gameSong.0': 'Zelda’s Lullaby',
  'gameSong.1': 'Epona’s Song',
  'gameSong.2': 'Saria’s Song',
  'gameSong.3': 'Sun’s Song',
  'gameSong.4': 'Song of Time',
  'gameSong.5': 'Song of Storms',
  'gameSong.6': 'Minuet of Forest',
  'gameSong.7': 'Bolero of Fire',
  'gameSong.8': 'Serenade of Water',
  'gameSong.9': 'Nocturne of Shadow',
  'gameSong.10': 'Requiem of Spirit',
  'gameSong.11': 'Prelude of Light',

  'settings.title': 'Settings',
  'set.layout': 'Button layout (game options)',
  'set.layout.normal': 'Normal: L R A Y X',
  'set.layout.classic': 'Classic: R B A Y X',
  'set.lead': 'Preparation before each note (ms)',
  'set.leadHelp': 'Modifier held and previous note released before the note.',
  'set.min': 'Minimum note length (ms)',
  'set.minHelp': 'The lower it is, the more fast notes are kept. Find your console’s limit with the',
  'set.speedTest': 'speed test',
  'set.bpm': 'Tempo of a tablature without rhythm (BPM)',
  'set.takeout': 'Take out the ocarina automatically (D-pad ←)',
  'set.avoid': 'Avoid triggering the game’s songs (teleporting…)',
  'set.legato': 'Linked notes (the sound doesn’t stop between two notes)',
  'set.legato.safe': 'Yes, except when the D-pad or stick changes (recommended)',
  'set.legato.always': 'Always (smoother, test it on your console)',
  'set.legato.off': 'No: release before each note',
  'set.legatoHelp': 'If the game plays wrong notes in “Always” mode, go back to the recommended mode.',

  'more.title': 'More options',
  'fw.board': 'Your board:',
  'fw.download': 'Download the firmware',
  'more.uf2': 'Download the songs (.uf2, RP2040 only)',
  'more.fw': 'Download the firmware for the chosen board (.uf2)',
  'more.bootsel': 'Put the board in “USB drive” mode',
  'more.erase': 'Erase the songs on the board',
  'more.export': 'Back up my songs (.json)',
  'more.import': 'Load a backup',
  'file.uf2': 'autoocarina_songs.uf2',
  'file.backup': 'autoocarina_backup.json',

  'howto.esp.title': 'How to use — ESP32 (Bluetooth)',
  'howto.esp.1':
    '<b>First time only</b>: install the <a href="firmware/autoocarina_esp32.bin" download="autoocarina_esp32.bin">ESP32 firmware</a> with the official <a href="https://espressif.github.io/esptool-js/" target="_blank" rel="noopener">ESP Tool</a> (Connect, address <code>0x0</code>, Program). You need a “classic” ESP32 (ESP32-WROOM-32, DevKitC, NodeMCU-32S…): the ESP32-S2, S3, C3 and C6 lack the Bluetooth this needs.',
  'howto.esp.2': 'Keep the ESP32 plugged into the PC, then <b>Connect the board › ESP32 Bluetooth</b>.',
  'howto.esp.3':
    'On the Switch 2: <b>Settings › Controllers and Accessories › Change Grip/Order</b>, then click <b>Connect to the Switch</b> in the remote. The board shows up as “Pro Controller” and presses <b>L + R</b> by itself.',
  'howto.esp.4':
    'Start the game, then use the remote: <b>Take out the ocarina</b>, then <b>▶ Play</b> when Link is ready. Next time, the board reconnects to the Switch by itself.',
  'howto.esp.5':
    '<b>Controller</b>: control the Switch from the site (mouse, keyboard or PC controller), for example to navigate the menus without reconnecting your Joy-Con.',
  'howto.rp.title': 'How to use — RP2040 / RP2350 board (cable)',
  'howto.rp.1':
    '<b>First time only</b>: pick your board and download its firmware. Hold the board’s <b>BOOT</b> button while plugging it into the PC: an “RPI-RP2” (or “RP2350”) drive appears. Drop the firmware into it.',
  'howto.rp.2': 'Drop an MP3 (or a MIDI), click <b>Analyze</b>, listen and fix it on the timeline if needed.',
  'howto.rp.3': 'Board plugged into the PC: <b>Connect the board</b>, then <b>Send to the board</b> (green LED = OK).',
  'howto.rp.4':
    'Plug the board into the Switch 2, start the game and go to free play. Pick the song with a short press on <b>BOOT</b> (colour + number of blinks), then a long press: off it goes! Another press stops it.',
  'howto.rp.5':
    'Controller not recognized? Go to “Controllers › Change Grip/Order” and <b>double-press</b> BOOT (the board presses L+R).',
};

const DICTS: Record<Lang, Record<Key, string>> = { fr, en };
const STORAGE_KEY = 'ocarina-bot-lang';

function detect(): Lang {
  if (typeof document === 'undefined') return 'fr';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
  }
  return 'en';
}

let lang: Lang = detect();
const listeners = new Set<(l: Lang) => void>();

export const getLang = (): Lang => lang;

export function t(key: Key, vars?: Record<string, string | number>): string {
  const s = DICTS[lang][key] ?? fr[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n as Key)));
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml as Key)));
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle as Key)));
  root
    .querySelectorAll<HTMLElement>('[data-i18n-placeholder]')
    .forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder as Key)));
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria as Key)));
}

export function setLang(l: Lang): void {
  lang = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
  }
  document.documentElement.lang = l;
  applyI18n();
  listeners.forEach((cb) => cb(l));
}

export function onLangChange(cb: (l: Lang) => void): void {
  listeners.add(cb);
}
