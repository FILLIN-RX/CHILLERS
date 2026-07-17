const { chromium } = require('playwright');
const mongoose = require('mongoose');
const Movie = require('../../models/Movie').default;
const { connectDB } = require('../../config/db');
const { browserConfig } = require('../../config/browser'); // Note: devra être converti en export/import JS si besoin

async function scrapeFilms() {
    await connectDB();

    const browser = await chromium.launch(browserConfig);
    const page = await browser.newPage();
    
    // Pour la reprise, on pourrait stocker la page dans MongoDB au lieu de STATE_FILE
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
        const url = `https://www.open-otaku.me/?cat=films&page=${currentPage}`;
        console.log(`\n--- Navigation vers ${url} ---`);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        try {
            await page.waitForSelector('.fs-card', { timeout: 15000 });
        } catch (e) {
            console.log("Fin de la liste.");
            hasMorePages = false;
            break;
        }

        let cards = await page.$$('.fs-card');
        console.log(`Films trouvés sur la page : ${cards.length}`);

        for (let i = 0; i < cards.length; i++) {
            let titre = `<film #${i}>`;
            try {
                let currentCards = await page.$$('.fs-card');
                let card = currentCards[i];
                titre = await card.$eval('.fs-card-title', el => el.innerText.trim());

                if (titre.includes("Saison") || titre.includes("Épisode")) continue;

                const existingFilm = await Movie.findOne({ titre: titre });
                if (existingFilm && existingFilm.pageUrl && existingFilm.lien) {
                    console.log(`Film déjà traité : ${titre}`);
                    continue;
                }

                console.log(`Traitement du film : ${titre}`);
                await card.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000);

                const pageUrl = page.url();

                await page.click('button#fs-quick-download', { force: true });
                await page.waitForTimeout(10000);

                let dlLink = await page.$('a#fs-dl-link');
                let link = dlLink ? await dlLink.getAttribute('href') : "#";

                if (link && link !== "#") {
                    await Movie.findOneAndUpdate(
                        { titre: titre },
                        { $set: { titre, pageUrl, lien: link } },
                        { upsert: true }
                    );
                    console.log(`Film sauvegardé dans MongoDB : ${titre}`);
                }

                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await page.waitForSelector('.fs-card');
            } catch (e) {
                console.error(`Erreur film ${titre}:`, e.message);
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded' });
                    await page.waitForSelector('.fs-card');
                } catch (recoveryErr) {
                    console.error(`Récupération échouée pour ${titre}:`, recoveryErr.message);
                }
            }
        }
        currentPage++;
    }
    await browser.close();
    await mongoose.disconnect();
    console.log("Scraping terminé.");
}
scrapeFilms().catch(console.error);
