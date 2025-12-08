import { INITIAL_LIVES } from './constants.js';

// Lives management system
export class LivesManager {
    constructor() {
        this.lives = INITIAL_LIVES;
        this.livesPurchased = 0;
    }

    reset() {
        this.lives = INITIAL_LIVES;
        this.livesPurchased = 0;
    }

    loseLife() {
        if (this.lives > 0) {
            this.lives--;
        }
        return this.lives;
    }

    addLife() {
        this.lives++;
        this.livesPurchased++;
    }

    getLives() {
        return this.lives;
    }

    hasLives() {
        return this.lives > 0;
    }

    getLivesPurchased() {
        return this.livesPurchased;
    }
}

