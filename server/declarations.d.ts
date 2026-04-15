declare module 'google-trends-api' {
  interface GoogleTrendsQuery {
    keyword: string;
  }

  interface GoogleTrendsApi {
    interestOverTime(options: GoogleTrendsQuery): Promise<string>;
    relatedQueries(options: GoogleTrendsQuery): Promise<string>;
  }

  const googleTrends: GoogleTrendsApi;
  export default googleTrends;
}
