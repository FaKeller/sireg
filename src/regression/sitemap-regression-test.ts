import {LoaderStrategy} from '../load/loader-strategy.interface';
import {FilterStrategy} from '../filter/filter-strategy.interface';
import {AllEntriesStrategy} from '../filter/all-entries.strategy';
import {Observable} from 'rxjs/Observable';
import {SitemapEntry} from '../model/sitemap-entry.model';
import {UrlReplacer} from './url-replacer';
import * as request from 'request';
import {Request, RequestResponse} from 'request';
import {RegressionResultSet} from './result/regression-result-set';
import {RegressionResult} from './result/regression-result';
import winston = require('winston');

export class SitemapRegressionTest {

    private loaders: LoaderStrategy[] = [];
    private filters: FilterStrategy[] = [];
    private urlReplacer: UrlReplacer = new UrlReplacer();

    constructor() {
    }

    public addLoader(loader: LoaderStrategy): this {
        this.loaders.push(loader);
        return this;
    }

    public addFilter(filter: FilterStrategy): this {
        this.filters.push(filter);
        return this;
    }

    public withReplacement(replace: string, by: string): this {
        this.urlReplacer.withReplacement(replace, by);
        return this;
    }

    public regressionTest(): Observable<RegressionResultSet> {
        // 1. load
        let entries: Observable<SitemapEntry[]> = Observable.from(this.loaders)
            // load all
            .flatMap((loader: LoaderStrategy) => loader.load())
            // combine all found SiteUrls to a single array
            .reduce((acc: SitemapEntry[], cur: SitemapEntry[]) => [].concat(acc, cur), [])
            .do((all: SitemapEntry[]) => winston.info(`Loaded ${all.length} URLs`));

        // 2. filter
        for (const filter of this.filters) {
            entries = entries.map((all: SitemapEntry[]) => filter.filter(all));
        }
        entries = entries.do((all: SitemapEntry[]) => winston.info(`About to check ${all.length} filtered URLs`));

        // 3. apply replacements
        // todo: refactor

        // 4. regression
        return entries.flatMap(entries => entries)
            .map(entry => new SitemapEntry(this.urlReplacer.replace(entry.url)))
            .flatMap((entry: SitemapEntry): any => {
                return new Observable(observer => {
                    winston.debug(`About to check ${entry.url}`);
                    const req: Request = request(entry.url, {
                        timeout: 1500,
                    }, (error: any, response: RequestResponse, body: any) => {
                        if (error) {
                            observer.error({'msg': `Could not get ${entry.url}`, err: error});
                        } else {
                            observer.next(new RegressionResult(entry.url, response.statusCode));
                        }
                        observer.complete();
                    });
                    return () => req.abort();
                });
            }, 3)
            .toArray()
            .map((results: RegressionResult[]) => new RegressionResultSet().addResults(results));
    }
}