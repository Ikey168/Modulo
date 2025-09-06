const cliProgress = require('cli-progress');
const chalk = require('chalk');

/**
 * Utility functions for creating and managing progress bars
 */

function createProgressBar(title, total) {
    const progressBar = new cliProgress.SingleBar({
        format: chalk.cyan(title) + ' |' + chalk.green('{bar}') + '| {percentage}% || {value}/{total} Tests',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });
    
    progressBar.start(total, 0);
    return progressBar;
}

function createMultiBar(title) {
    const multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {filename} | {value}/{total}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
    }, cliProgress.Presets.shades_grey);
    
    return multibar;
}

module.exports = {
    createProgressBar,
    createMultiBar
};
