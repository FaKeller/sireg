import {container} from './inversify.config';
import {CommanderStatic} from 'commander';
import {Subscription} from 'rxjs/Subscription';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import {TestCaseConfig} from './regression/config/test-case-config';
import {RegressionResultSet} from './regression/result/regression-result-set';
import {SitemapRegressionTestFactory} from './regression/sitemap-regression-test-factory';
import {defaultsDeep} from 'lodash';
import strftime = require('strftime');
import winston = require('winston');

// == configure logger
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
    prettyPrint: true,
    level: process.env.LOG_LEVEL || 'debug',
    colorize: true,
    silent: false,
    stderrLevels: [],
    timestamp: () => strftime('%F %T.%L')
});

const sireg: CommanderStatic = require('commander');

// == define CLI commands
sireg
    .version('0.2.2');

sireg.command('test <config>')
    .description('Execute the given test case')
    .action((configFile: string) => {
        try {
            siregExec(configFile);
        } catch (e) {
            winston.error(`Critical error occucured. Exiting application. Error was:\n ${e.stack}`);
            process.exit(1);
        }
    });


if (!process.argv.slice(2).length) {
    sireg.outputHelp();
}
sireg.parse(process.argv);

async function siregExec(configFile: string): Promise<void> {
    winston.info('Starting sireg');

    // load config
    const config: TestCaseConfig = defaultsDeep(JSON.parse(fs.readFileSync(configFile, 'utf8')), {
        settings: {
            concurrentRequests: 3,
            requestTimeout: 3000
        }
    });
    http.globalAgent.maxSockets = config.settings.concurrentRequests;
    https.globalAgent.maxSockets = config.settings.concurrentRequests;
    const testFactory: SitemapRegressionTestFactory = container.get(SitemapRegressionTestFactory);

    // find violations
    let resultSet: RegressionResultSet;
    let subscription: Subscription;
    await new Promise((acc, err) => {
        subscription = testFactory.factory(config)
            .regressionTest()
            .subscribe(
                (result: RegressionResultSet) => resultSet = result,
                (err: any) => winston.error('An error occured:', err),
                () => acc()
            );
    });
    subscription.unsubscribe();

    // print violations
    if (resultSet && (resultSet.hasViolations || resultSet.hasErrors)) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}