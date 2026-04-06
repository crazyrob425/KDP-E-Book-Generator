import React, { useState, useCallback } from 'react';
import * as thirdParty from '../../../services/thirdPartyServices';
import Button from '../../shared/Button';
import LoadingSpinner from '../../shared/LoadingSpinner';

interface ProofreadingPaneProps {
  content: string;
  chapterTitle?: string;
}

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const color =
    score >= 85 ? 'bg-emerald-700 text-emerald-100' :
    score >= 65 ? 'bg-blue-700 text-blue-100' :
    score >= 45 ? 'bg-yellow-700 text-yellow-100' :
    'bg-red-800 text-red-100';
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${color}`}>
      {score}/100
    </span>
  );
};

const ProofreadingPane: React.FC<ProofreadingPaneProps> = ({ content, chapterTitle }) => {
  const [report, setReport] = useState<thirdParty.WritingQualityReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!content?.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await thirdParty.generateWritingQualityReport(content);
      setReport(result);
    } catch (e) {
      setError('Analysis failed. Please try again.');
      console.error('[ProofreadingPane]', e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [content]);

  if (!content?.trim()) {
    return (
      <div className="p-4 text-center text-slate-500 italic text-sm">
        Generate chapter content first to enable proofreading analysis.
      </div>
    );
  }

  return (
    <div className="mt-4 border border-slate-700 rounded-lg bg-slate-800/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-200 text-sm">
          📊 Writing Quality Analysis {chapterTitle ? `— ${chapterTitle}` : ''}
        </h4>
        <Button onClick={runAnalysis} disabled={isAnalyzing} variant="secondary" className="text-xs py-1 px-3">
          {isAnalyzing ? 'Analyzing…' : report ? 'Re-analyze' : 'Analyze'}
        </Button>
      </div>

      {isAnalyzing && (
        <div className="flex justify-center py-4">
          <LoadingSpinner message="Running quality checks…" size="sm" />
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {report && !isAnalyzing && (
        <div className="space-y-4 text-sm text-slate-300">
          {/* Overall score */}
          <div className="flex items-center gap-3">
            <ScoreBadge score={report.qualityScore} />
            <span className="font-medium text-slate-200">{report.qualityLabel}</span>
            <span className="text-slate-400 ml-auto">{report.detectedLanguage}</span>
          </div>

          {/* Statistics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Words', value: report.statistics.wordCount.toLocaleString() },
              { label: 'Sentences', value: report.statistics.sentenceCount.toLocaleString() },
              { label: 'Paragraphs', value: report.statistics.paragraphCount.toLocaleString() },
              { label: 'Reading time', value: report.statistics.readingTimeText },
              { label: 'FK Grade', value: report.readability.fleschKincaidGrade },
              { label: 'Avg words/sent.', value: report.statistics.avgWordsPerSentence },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-700/60 rounded px-3 py-2">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="font-semibold text-slate-100">{value}</p>
              </div>
            ))}
          </div>

          {/* Sentiment */}
          <div>
            <p className="text-xs text-slate-400 mb-1">Sentiment</p>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${report.sentiment.label.includes('Positive') ? 'text-emerald-400' : report.sentiment.label.includes('Negative') ? 'text-red-400' : 'text-slate-300'}`}>
                {report.sentiment.label}
              </span>
              {report.sentiment.positiveWords.length > 0 && (
                <span className="text-xs text-slate-500">
                  (+{report.sentiment.positiveWords.slice(0, 3).join(', ')})
                </span>
              )}
            </div>
          </div>

          {/* Top themes */}
          {report.topThemes.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Top themes</p>
              <div className="flex flex-wrap gap-1">
                {report.topThemes.map((t) => (
                  <span key={t} className="bg-violet-900/50 text-violet-300 text-xs px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Content warnings */}
          {report.hasContentWarnings && (
            <p className="text-yellow-400 text-xs">
              ⚠️ {report.contentWarningCount} content warning{report.contentWarningCount !== 1 ? 's' : ''} detected.
            </p>
          )}

          {/* Suggestions */}
          {report.suggestions.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Suggestions</p>
              <ul className="space-y-1">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-300">
                    <span className="text-violet-400 shrink-0">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Repetition alerts */}
          {report.repetitionAlerts.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Repetition alerts</p>
              <ul className="space-y-1">
                {report.repetitionAlerts.slice(0, 5).map((a, i) => (
                  <li key={i} className="text-xs text-orange-300">
                    "{a.phrase}" — {Math.round(a.similarity * 100)}% similar ({a.occurrences}×)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProofreadingPane;
