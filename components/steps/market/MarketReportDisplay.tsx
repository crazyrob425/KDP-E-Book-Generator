import React from 'react';
import { MarketReport } from '../../../types';
import Card from '../../shared/Card';
import Button from '../../shared/Button';

interface MarketReportDisplayProps {
  report: MarketReport;
  onProceed: () => void;
}

const MarketReportDisplay: React.FC<MarketReportDisplayProps> = ({ report, onProceed }) => {
  return (
    <Card className="w-full max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-center text-violet-400 mb-2 font-serif">
        Step 1d: Your Personalized Market Report
      </h2>
      <p className="text-slate-400 text-center mb-8">
        Our AI agents have analyzed the market for your topic. Review the findings below.
      </p>

      <div className="space-y-6">
        {/* Trend Analysis */}
        <Card className="bg-slate-900/50">
          <h3 className="text-xl font-semibold text-emerald-400 mb-2">Trend Analysis & Opportunity</h3>
          <p className="text-slate-300">{report.trendAnalysis}</p>
        </Card>

        {/* Target Audience & Keywords */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-slate-900/50">
            <h3 className="text-xl font-semibold text-emerald-400 mb-2">Target Audience</h3>
            <div className="text-sm space-y-2">
              <p><strong className="text-slate-300">Demographics:</strong> {report.targetAudience.demographics}</p>
              <p><strong className="text-slate-300">Interests:</strong> {report.targetAudience.interests}</p>
              <p><strong className="text-slate-300">Pain Points:</strong> {report.targetAudience.painPoints}</p>
            </div>
          </Card>
          <Card className="bg-slate-900/50">
            <h3 className="text-xl font-semibold text-emerald-400 mb-2">High-Value Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {report.keywords.map((kw, i) => (
                <span key={i} className="bg-slate-700 text-slate-300 px-2 py-1 rounded-full text-xs">{kw}</span>
              ))}
            </div>
          </Card>
        </div>

        {/* Google Trends Simulation */}
        {report.googleTrends && (
             <Card className="bg-slate-900/50">
                <h3 className="text-xl font-semibold text-emerald-400 mb-2">Live Google Trends Insights</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-slate-300">Interest Over Time</h4>
                        <div className="mt-2 space-y-1">
                            {report.googleTrends.interestOverTime.map((item, i) =>(
                                <div key={i} className="flex items-center gap-2 text-sm">
                                    <span className="w-20 text-slate-400">{item.month}</span>
                                    <div className="w-full bg-slate-700 rounded-full h-4">
                                        <div className="bg-violet-500 h-4 rounded-full" style={{width: `${item.value}%`}}></div>
                                    </div>
                                    <span className="w-8 text-right font-semibold">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-300">Top Related Queries</h4>
                        <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                            {report.googleTrends.relatedQueries.map((item, i) => (
                                <li key={i} className="text-slate-300">{item.query} <span className="text-emerald-400 text-xs ml-2">{item.value}</span></li>
                            ))}
                        </ul>
                    </div>
                </div>
             </Card>
        )}

        {/* Competitor Analysis */}
        <Card className="bg-slate-900/50">
          <h3 className="text-xl font-semibold text-emerald-400 mb-4">Competitor Snapshot</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {report.competitorAnalysis.map((comp, i) => (
              <div key={i} className="text-center">
                <div className="w-full h-48 bg-slate-700 rounded-md flex items-center justify-center overflow-hidden mb-2 p-2">
                   <span className="text-slate-400 text-sm font-semibold text-center">{comp.title}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 italic">Success Factor: {comp.successFactor}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <Button onClick={onProceed} className="px-8 py-3 text-lg">
          Proceed to Outline &rarr;
        </Button>
      </div>
    </Card>
  );
};

export default MarketReportDisplay;