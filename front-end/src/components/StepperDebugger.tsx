import React, { useState, useEffect, useRef } from "react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import "../styles/tokyonight.css";

interface CallTrace {
  Opcode: string;
  LineNumber: number;
  File: string;
  ContractAddress: string;
  Depth?: number;
}

interface ContractCalled {
  contractAddress: string;
  callType: string;
  functionSignature: string;
  arguments: Array<{
    name: string;
    type: string;
    value: string;
  }>;
}

interface DebugResult {
  contractsCalled: ContractCalled[];
  errorLineNumber: number;
  revertReason: string;
  debugTrace: CallTrace[];
  sourceCodes?: { [address: string]: { [filename: string]: string } };
}

interface StepperDebuggerProps {
  debugResult: DebugResult;
  transactionHash?: string;
}

const StepperDebugger: React.FC<StepperDebuggerProps> = ({ debugResult, transactionHash }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<'trace' | 'stack'>('trace');
  const [showStorageAccess, setShowStorageAccess] = useState(false);
  const [showEventLogs, setShowEventLogs] = useState(false);
  const sourceCodeRef = useRef<HTMLDivElement>(null);
  const traceListRef = useRef<HTMLDivElement>(null);

  const { debugTrace, sourceCodes, revertReason, contractsCalled } = debugResult;

  // Helper function to get display name (filename or address for unverified)
  const getDisplayName = (trace: CallTrace): string => {
    // If no source codes available or address not found, show address (unverified)
    if (!sourceCodes || !sourceCodes[trace.ContractAddress]) {
      return `${trace.ContractAddress.slice(0, 6)}...${trace.ContractAddress.slice(-4)}`;
    }
    
    const files = sourceCodes[trace.ContractAddress];
    const filenames = Object.keys(files);
    
    // Check if this is an unverified contract by looking at the content
    const firstFile = files[filenames[0]];
    if (firstFile && (
      firstFile.includes('// Source code not available') ||
      firstFile.includes('contract is not verified') ||
      filenames[0] === 'unknown.sol'
    )) {
      return `${trace.ContractAddress.slice(0, 6)}...${trace.ContractAddress.slice(-4)}`;
    }
    
    // For verified contracts, show the filename
    if (trace.File) {
      return trace.File.split('/').pop() || `${trace.ContractAddress.slice(0, 6)}...${trace.ContractAddress.slice(-4)}`;
    }
    
    // Fallback: try to get filename from source codes
    const mainFile = filenames.find(name => 
      name !== 'unknown.sol' && name.endsWith('.sol')
    ) || filenames[0];
    
    if (mainFile && mainFile !== 'unknown.sol') {
      return mainFile.split('/').pop() || `${trace.ContractAddress.slice(0, 6)}...${trace.ContractAddress.slice(-4)}`;
    }
    
    return `${trace.ContractAddress.slice(0, 6)}...${trace.ContractAddress.slice(-4)}`;
  };

  // Filter trace based on checkbox settings
  const filteredTrace = debugTrace.filter(trace => {
    const isStorageAccess = ['SLOAD', 'SSTORE'].includes(trace.Opcode);
    const isEventLog = ['LOG0', 'LOG1', 'LOG2', 'LOG3', 'LOG4'].includes(trace.Opcode);
    
    if (isStorageAccess && !showStorageAccess) return false;
    if (isEventLog && !showEventLogs) return false;
    
    return true;
  });

  const currentTrace = filteredTrace[currentStep] || debugTrace[currentStep];
  const currentSourceCode = sourceCodes?.[currentTrace?.ContractAddress]?.[currentTrace?.File] || "";

  const goToStep = (step: number) => {
    if (step >= 0 && step < filteredTrace.length) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => goToStep(currentStep + 1);
  const prevStep = () => goToStep(currentStep - 1);

  // Auto-scroll to current line when step changes
  useEffect(() => {
    if (sourceCodeRef.current && currentSourceCode && currentTrace) {
      const lineHeight = 1.6 * 0.9 * 16; // line-height * font-size * 16px (rem to px)
      const targetScrollTop = Math.max(0, (currentTrace.LineNumber - 3) * lineHeight);
      
      sourceCodeRef.current.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
  }, [currentStep, currentSourceCode, currentTrace]);

  // Auto-scroll to current trace item in sidebar
  useEffect(() => {
    if (traceListRef.current && sidebarTab === 'trace') {
      const traceItems = traceListRef.current.querySelectorAll('.trace-item');
      const currentTraceItem = traceItems[currentStep];
      
      if (currentTraceItem) {
        currentTraceItem.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentStep, sidebarTab]);

  if (!debugTrace || debugTrace.length === 0) {
    return (
      <div className="debugger-container">
        <div className="debugger-empty">
          <p>No debug trace available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="debugger-container">
      {/* Header with Transaction Status */}
      <div className="debugger-header">
        <div className="header-left">
          <h2>Transaction Debugger</h2>
          {transactionHash && (
            <div className="transaction-info">
              <span className="tx-label">Transaction Hash:</span>
              <span className="tx-hash">{transactionHash}</span>
              <button
                onClick={() => navigator.clipboard.writeText(transactionHash)}
                className="copy-tx-btn"
                title="Copy transaction hash"
              >
                Copy
              </button>
            </div>
          )}
          <div className="transaction-status">
            {revertReason && revertReason !== "Transaction successful!" ? (
              <span className="status-error">
                Failed: {revertReason}
              </span>
            ) : (
              <span className="status-success">
                Successful
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          <div className="step-counter">
            <span className="current-step">{currentStep + 1}</span>
            <span className="step-divider">/</span>
            <span className="total-steps">{filteredTrace.length}</span>
            <span className="step-label">steps</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="debugger-main">
        {/* Left Panel - Source Code */}
        <div className="source-panel">
          <div className="panel-header">
            <div className="panel-title">
              <div className="title-row">
                <h3>{getDisplayName(currentTrace)}</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(currentTrace.ContractAddress)}
                  className="copy-address-btn"
                  title="Copy contract address"
                >
                  Copy
                </button>
              </div>
              <div className="file-path">{currentTrace.File}</div>
            </div>
            <div className="execution-info">
              <span className={`opcode-badge opcode-${currentTrace.Opcode.toLowerCase()}`}>{currentTrace.Opcode}</span>
              <span className="line-indicator">Line {currentTrace.LineNumber}</span>
            </div>
          </div>
          <div className="source-code-viewer">
            {currentSourceCode ? (
              <div className="source-lines" ref={sourceCodeRef}>
                <SyntaxHighlighter
                  language="solidity"
                  style={vscDarkPlus}
                  showLineNumbers={true}
                  lineNumberStyle={{
                    color: 'var(--tn-comment)',
                    backgroundColor: 'var(--tn-bg-alt)',
                    paddingRight: '1rem',
                    minWidth: '4rem',
                    textAlign: 'right'
                  }}
                  wrapLines={true}
                  lineProps={(lineNumber) => {
                    const style: React.CSSProperties = {};
                    if (lineNumber === currentTrace.LineNumber) {
                      style.backgroundColor = 'rgba(255, 215, 0, 0.08)';
                      style.borderLeft = '3px solid var(--tn-yellow)';
                      style.position = 'relative';
                    } else if (Math.abs(lineNumber - currentTrace.LineNumber) <= 2) {
                      style.backgroundColor = 'rgba(255, 215, 0, 0.02)';
                    }
                    return { style };
                  }}
                  customStyle={{
                    margin: 0,
                    backgroundColor: 'var(--tn-bg)',
                    fontSize: '0.9rem',
                    lineHeight: '1.6'
                  }}
                >
                  {currentSourceCode}
                </SyntaxHighlighter>
              </div>
            ) : (
              <div className="source-placeholder">
                <p>Source code not available</p>
                <small>This contract is not verified or source mapping failed</small>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Tabbed Interface */}
        <div className="sidebar">
          {/* Control Panel */}
          <div className="control-panel">
            <div className="control-buttons">
              <button 
                onClick={() => goToStep(0)} 
                disabled={currentStep === 0}
                className="control-btn compact"
                title="Go to first step"
              >
                First
              </button>
              <button 
                onClick={() => goToStep(filteredTrace.length - 1)} 
                disabled={currentStep === filteredTrace.length - 1}
                className="control-btn compact"
                title="Go to last step"
              >
                Last
              </button>
              <button 
                onClick={prevStep} 
                disabled={currentStep === 0}
                className="control-btn compact"
                title="Previous step"
              >
                ↑ Previous
              </button>
              <button 
                onClick={nextStep} 
                disabled={currentStep === filteredTrace.length - 1}
                className="control-btn compact"
                title="Next step"
              >
                ↓ Next
              </button>
            </div>
            <div className="step-input-group">
              <input
                type="number"
                min="1"
                max={filteredTrace.length}
                value={currentStep + 1}
                onChange={(e) => goToStep(parseInt(e.target.value) - 1)}
                className="form-input step-input"
                placeholder={`Jump to step (1-${filteredTrace.length})`}
              />
            </div>
            
            {/* Filter Options */}
            <div className="filter-options">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showStorageAccess}
                  onChange={(e) => {
                    setShowStorageAccess(e.target.checked);
                    setCurrentStep(0);
                  }}
                />
                Storage
              </label>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showEventLogs}
                  onChange={(e) => {
                    setShowEventLogs(e.target.checked);
                    setCurrentStep(0);
                  }}
                />
                Events
              </label>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="sidebar-tabs">
            <button 
              className={`tab-button ${sidebarTab === 'trace' ? 'active' : ''}`}
              onClick={() => setSidebarTab('trace')}
            >
              Trace ({filteredTrace.length})
            </button>
            <button 
              className={`tab-button ${sidebarTab === 'stack' ? 'active' : ''}`}
              onClick={() => setSidebarTab('stack')}
            >
              Stack ({contractsCalled.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="sidebar-content">
            {sidebarTab === 'trace' && (
              <div className="trace-list" ref={traceListRef}>
                <div className="trace-container">
                  {/* Trace items */}
                  <div className="trace-items">
                    {filteredTrace.map((trace, index) => {
                      const depth = trace.Depth || 0;
                      const hasChildrenAfter = index < filteredTrace.length - 1 && 
                        filteredTrace.slice(index + 1).some(t => (t.Depth || 0) > depth);
                      
                      return (
                        <div
                          key={index}
                          className={`trace-item-wrapper`}
                          style={{ 
                            paddingLeft: `${depth * 20}px`,
                            position: 'relative'
                          }}
                        >
                          {/* Vertical line for this depth level */}
                          {depth > 0 && (
                            <div 
                              className="depth-line"
                              style={{
                                position: 'absolute',
                                left: `${(depth - 1) * 20 + 10}px`,
                                top: 0,
                                bottom: hasChildrenAfter ? 0 : '50%',
                                width: '1px',
                                backgroundColor: 'var(--tn-comment)',
                                opacity: 0.3
                              }}
                            />
                          )}
                          
                          {/* Horizontal connector */}
                          {depth > 0 && (
                            <div 
                              className="horizontal-connector"
                              style={{
                                position: 'absolute',
                                left: `${(depth - 1) * 20 + 10}px`,
                                top: '14px',
                                width: '10px',
                                height: '1px',
                                backgroundColor: 'var(--tn-comment)',
                                opacity: 0.3
                              }}
                            />
                          )}
                          
                          <div
                            className={`trace-item ${index === currentStep ? 'current-step' : ''} ${
                              trace.Opcode === 'REVERT' ? 'revert-step' : ''
                            }`}
                            onClick={() => goToStep(index)}
                          >
                            <div className="trace-content">
                              <span className="trace-step">#{index + 1}</span>
                              <span className="trace-opcode">{trace.Opcode}</span>
                              <span className="trace-contract">
                                {getDisplayName(trace)}
                              </span>
                            </div>
                            {trace.Opcode === 'REVERT' && <div className="revert-indicator">REVERT</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {sidebarTab === 'stack' && (
              <div className="stack-list">
                {contractsCalled.map((contract, index) => (
                  <div key={index} className="stack-item">
                    <div className="stack-header">
                      <div className="stack-contract">
                        <div className="contract-info-row">
                          <span className="contract-label">Contract</span>
                          <span className={`call-type-badge call-type-${contract.callType.toLowerCase()}`}>
                            {contract.callType}
                          </span>
                        </div>
                        <span className="contract-address">
                          {contract.contractAddress.slice(0, 6)}...{contract.contractAddress.slice(-4)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="stack-function">
                      <span className="function-label">Function</span>
                      <span className="function-name">
                        {contract.functionSignature === 'Unknown' ? 'Unknown' : contract.functionSignature.split('(')[0]}
                      </span>
                    </div>

                    {contract.arguments && contract.arguments.length > 0 && (
                      <div className="function-arguments">
                        <div className="arguments-header">
                          <span className="arguments-label">Arguments ({contract.arguments.length})</span>
                        </div>
                        <div className="arguments-list">
                          {contract.arguments.map((arg, argIndex) => (
                            <div key={argIndex} className="argument-item">
                              <div className="argument-header">
                                <span className="argument-name">{arg.name || `arg${argIndex}`}</span>
                                <span className="argument-type">{arg.type}</span>
                              </div>
                              <div className="argument-value">
                                <code>{arg.value}</code>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!contract.arguments || contract.arguments.length === 0) && (
                      <div className="no-arguments">
                        <span>No arguments</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepperDebugger; 