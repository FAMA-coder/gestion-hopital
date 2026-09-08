/* ============================================================
   js/install.js — Bouton d'installation PWA
   Affiche le bouton "Installer l'application" de la barre
   superieure dès que le navigateur autorise l'installation
   (evenement beforeinstallprompt), puis déclenche la boîte
   native d'installation.
   ============================================================ */
(function () {
    var button = document.getElementById('install-btn');
    if (!button) return;

    var deferredPrompt = null;

    // Déjà installé (mode autonome) ? Ne rien afficher.
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        return;
    }

    function show() {
        button.hidden = false;
        button.setAttribute('aria-hidden', 'false');
    }
    function hide() {
        button.hidden = true;
        button.setAttribute('aria-hidden', 'true');
    }

    window.addEventListener('beforeinstallprompt', function (e) {
        // Empêche l'invite automatique du navigateur et conserve
        // l'événement pour le déclencher manuellement au clic.
        e.preventDefault();
        deferredPrompt = e;
        show();
    });

    button.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
            deferredPrompt = null;
            hide();
        });
    });

    // L'application a été installée pendant cette session / plus tard.
    window.addEventListener('appinstalled', function () {
        hide();
    });
})();