export interface TestCaseConfig {
    /** The title of the test case */
    testCase: string;
    /** The loaders to load URLs from */
    loaders: { 'loader': string, 'options': any }[];
    /** The filter configuration */
    filters?: { 'filter': string, 'options': any }[];
    /** The replacements to perform on the url before issuing the HTTP request */
    replacers?: { 'replacer': string, 'options': any }[];
    /** The reporters used to report the regression test results */
    reporters?: { 'reporter': string, 'options': any }[];
}