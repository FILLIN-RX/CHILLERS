import dotenv from 'dotenv';
import path from 'path';

// À importer avant tout module qui lit process.env au chargement.
dotenv.config({ path: path.join(__dirname, '../../.env') });
