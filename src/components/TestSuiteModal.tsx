import React, { useState, useEffect } from 'react';
import { runSMCUnitTests, TestCaseResult } from '../engine/smcTests';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  X,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const executeTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const testResults = runSMCUnitTests();
      setResults(testResults);
      setIsRunning(false);
    }, 400);
  };

  useEffect(() => {
    if (isOpen && results.length === 0) {
      executeTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  return (
    <div
      id="smc-test-suite-modal"
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none font-sans"
    >
      <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#b7bdc6]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[#2b2f36] flex items-center justify-between bg-[#161a1e]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded bg-[#2ebd85]/15 text-[#2ebd85] border border-[#2ebd85]/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                SMC Engine Unit Test Suite
              </h3>
              <span className="text-[10px] text-[#848e9c]">
                Deterministic algorithmic verification on synthetic datasets
              </span>
            </div>
          </div>

          <button
            id="btn-close-tests"
            onClick={onClose}
            className="p-1 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          {/* Status Bar */}
          <div className="flex items-center justify-between p-3 rounded bg-[#1e2329] border border-[#2b2f36]">
            <div className="flex items-center space-x-2">
              <span
                className={`font-mono text-sm font-bold ${
                  passedCount === totalCount && totalCount > 0
                    ? 'text-[#2ebd85]'
                    : 'text-[#f0b90b]'
                }`}
              >
                {passedCount} / {totalCount} Tests Passed
              </span>
              <span className="text-[#5e6673]">•</span>
              <span className="text-[#848e9c] text-[11px]">Zero look-ahead bias validation</span>
            </div>

            <button
              onClick={executeTests}
              disabled={isRunning}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#f0b90b] hover:bg-[#fcd535] text-[#0b0e11] font-bold text-xs transition-all disabled:opacity-50"
            >
              {isRunning ? (
                <RotateCcw className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              <span>{isRunning ? 'Running...' : 'Rerun Suite'}</span>
            </button>
          </div>

          {/* Test Results Table */}
          <div className="border border-[#2b2f36] rounded overflow-hidden bg-[#1e2329] max-h-80 overflow-y-auto">
            <div className="divide-y divide-[#2b2f36]">
              {results.map((test, idx) => (
                <div key={idx} className="p-3 space-y-1 hover:bg-[#2b2f36]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {test.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2ebd85] shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#f6465d] shrink-0" />
                      )}
                      <span className="font-bold text-white text-xs">{test.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#161a1e] border border-[#2b2f36] text-[9px] text-[#848e9c] font-mono">
                        {test.category}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        test.passed
                          ? 'bg-[#2ebd85]/20 text-[#2ebd85]'
                          : 'bg-[#f6465d]/20 text-[#f6465d]'
                      }`}
                    >
                      {test.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#848e9c] pl-5">{test.details}</p>

                  <div className="pl-5 pt-0.5 flex items-center space-x-4 text-[9px] font-mono text-[#5e6673]">
                    <span>
                      Expected: <span className="text-[#b7bdc6]">{test.expected}</span>
                    </span>
                    <span>
                      Actual: <span className="text-[#f0b90b]">{test.actual}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[#2b2f36] bg-[#161a1e] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#1e2329] border border-[#2b2f36] hover:bg-[#2b2f36] text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
