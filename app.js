import { initDashboard } from './js/dashboard/main.js?v=20260317-15';

document.addEventListener('DOMContentLoaded', () => {
    initDashboard().catch((error) => {
        console.error('Errore inizializzazione dashboard:', error);
        alert('Errore inizializzazione dashboard. Controlla la console.');
    });
});
